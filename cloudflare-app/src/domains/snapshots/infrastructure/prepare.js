import { FREE_TIER_BUDGET } from "../../../freeTierBudget.js";
import { executeMutationBatch } from "../../../platform/d1/requestGateway.js";
import { isD1ValuePayloadWithinLimit } from "../../../platform/d1/valueSize.js";
import { clean } from "../../../shared/text/normalize.js";
import { NOT_APPLICABLE, revisionForExcel } from "../../../shared/documents/revision.js";
import { auditActorSnapshot } from "../../identity/index.js";
import {
  approvalReferenceRequired,
  APPROVAL_POLICY_VERSION,
  missingPermissionsForSession,
  requiredPermissionsForDiff,
  resolveSnapshotApplyMode
} from "../domain/authorization.js";
import { formatCanonicalErrors, prepareCanonicalSnapshotRows } from "../domain/canonicalRow.js";
import { computeRiskWarnings, summarizeChangeFlags } from "../domain/diff.js";
import { SNAPSHOT_ERROR_CODES, snapshotError } from "../domain/errorCodes.js";
import { computeCanonicalRowsHash } from "../domain/hash.js";
import { matchCanonicalSnapshotRows } from "../domain/matchRows.js";
import { validateRevisionHistorySnapshotChanges } from "../domain/revisionPolicy.js";
import { getDocumentSnapshot, getDocumentSyncState } from "./queries.js";
import { createSnapshotPlan, systemSnapshotAuditStatement } from "./support.js";

export async function prepareDocumentSnapshot(env, snapshotId, options, _legacyPrepareRows, actor) {
  const snapshot = await getDocumentSnapshot(env, snapshotId);
  if (!snapshot) return snapshotError(SNAPSHOT_ERROR_CODES.SNAPSHOT_NOT_FOUND, "엑셀 동기화 작업을 찾을 수 없습니다.");
  if (snapshot.status === "ready" || snapshot.status === "completed") return { ok: true, snapshot };
  if (snapshot.status !== "staging") {
    return snapshotError(SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_STATE, "검증할 수 없는 동기화 작업 상태입니다.");
  }

  const [rowResult, membershipResult, documentResult, revisionLinkResult, state] = await Promise.all([
    env.DB.prepare(`
      SELECT row_number, row_key, source_row_key, source_json
      FROM document_snapshot_rows
      WHERE snapshot_id = ?
      ORDER BY row_number
    `).bind(snapshotId).all(),
    env.DB.prepare(`
      SELECT row_number, row_key, base_row_version, base_hash
      FROM document_snapshot_membership
      WHERE snapshot_id = ?
      ORDER BY row_number
    `).bind(snapshotId).all(),
    env.DB.prepare(`
      SELECT
        d.id, d.storage_code, d.excel_row_key, d.sync_state, d.category_id, d.document_number,
        d.revision_number, d.revision_date, d.disposal_due_year, d.document_name,
        d.note, d.rack_slot_id, d.rack_face, d.status, d.row_version,
        rs.slot_code AS current_slot_code,
        rs.column_number AS current_column_number,
        rs.shelf_number AS current_shelf_number,
        r.id AS current_rack_id,
        r.code AS current_rack_code,
        r.zone_number AS current_zone_number,
        r.rack_number AS current_rack_number,
        r.is_single_sided AS current_rack_is_single_sided,
        GROUP_CONCAT(dt.tag_id, ',') AS tag_ids
      FROM documents d
      JOIN rack_slots rs ON rs.id = d.rack_slot_id
      JOIN racks r ON r.id = rs.rack_id
      LEFT JOIN document_tags dt ON dt.document_id = d.id
      GROUP BY d.id
      ORDER BY d.id
    `).all(),
    env.DB.prepare(`
      SELECT previous_document_id, new_document_id
      FROM document_revision_links
    `).all(),
    getDocumentSyncState(env)
  ]);
  const stagedRows = rowResult.results ?? [];
  const membershipRows = membershipResult.results ?? [];
  const schemaVersion = Number(snapshot.schema_version || 1);
  // schema v2 이상 정식 클라이언트는 membership을 먼저 보내지만, 배포 중 열린 탭처럼
  // 전체 행을 staging한 호출도 전환 릴리스 동안 호환한다.
  const usesMembership = schemaVersion >= 2 && membershipRows.length > 0;
  const receivedCount = usesMembership ? membershipRows.length : stagedRows.length;
  if (receivedCount !== Number(snapshot.total_count) || stagedRows.length !== Number(snapshot.staged_count)) {
    return failSnapshotValidation(
      env,
      snapshotId,
      `전체 ${snapshot.total_count}행 중 ${receivedCount}행의 membership만 전송되었습니다.`,
      actor,
      false,
      SNAPSHOT_ERROR_CODES.SNAPSHOT_ROW_COUNT_MISMATCH
    );
  }
  if (
    usesMembership &&
    snapshot.mode !== "bootstrap" &&
    stagedRows.length > FREE_TIER_BUDGET.excelSnapshotDeltaMaxItems
  ) {
    return failSnapshotValidation(
      env,
      snapshotId,
      `일상 변경 영향은 최대 ${FREE_TIER_BUDGET.excelSnapshotDeltaMaxItems}건입니다. 최신 대장을 기준으로 작업을 나누세요.`,
      actor,
      false,
      SNAPSHOT_ERROR_CODES.SNAPSHOT_ROW_COUNT_MISMATCH
    );
  }
  if (state.currentVersion !== Number(snapshot.base_version)) {
    return failSnapshotValidation(
      env,
      snapshotId,
      "검증 중 문서고가 변경되었습니다. 최신 엑셀로 다시 시작하세요.",
      actor,
      true,
      SNAPSHOT_ERROR_CODES.SNAPSHOT_STALE
    );
  }

  const documents = documentResult.results ?? [];
  const preservedLocationsByRowKey = new Map();
  const preservedSlotsById = new Map();
  for (const document of documents) {
    const slot = currentDocumentSlot(document);
    if (!slot) continue;
    preservedSlotsById.set(Number(slot.id), slot);
    const rowKey = clean(document.excel_row_key);
    if (snapshot.mode !== "bootstrap" && document.sync_state === "current" && rowKey) {
      preservedLocationsByRowKey.set(rowKey, {
        slot,
        rackFace: clean(document.rack_face)
      });
    }
  }

  const lookup = {
    categoryNames: new Map((options.categories || []).map((category) => [Number(category.id), category.name])),
    tagNames: new Map((options.tags || []).map((tag) => [Number(tag.id), tag.name])),
    slotsById: new Map((options.slots || []).map((slot) => [Number(slot.id), slot]))
  };
  for (const [slotId, slot] of preservedSlotsById) lookup.slotsById.set(slotId, slot);

  let sourceRows;
  try {
    sourceRows = stagedRows.map((row) => ({
      ...JSON.parse(row.source_json),
      rowNumber: Number(row.row_number),
      sourceRowKey: clean(row.source_row_key),
      rowKey: clean(row.source_row_key || row.row_key)
    }));
    if (usesMembership) {
      const stagedNumbers = new Set(stagedRows.map((row) => Number(row.row_number)));
      const documentsByKey = new Map(documents.map((document) => [clean(document.excel_row_key), document]));
      for (const membership of membershipRows) {
        const rowNumber = Number(membership.row_number);
        if (stagedNumbers.has(rowNumber)) continue;
        const document = documentsByKey.get(clean(membership.row_key));
        if (!document || document.sync_state !== "current") {
          throw new Error(`${rowNumber}행의 기준 문서를 찾을 수 없습니다.`);
        }
        if (
          Number(membership.base_row_version || 0) > 0 &&
          Number(membership.base_row_version) !== Number(document.row_version)
        ) {
          throw new Error(`${rowNumber}행의 기준 버전이 현재 문서와 다릅니다.`);
        }
        sourceRows.push(sourceRowFromCurrentDocument(document, membership, lookup));
      }
      sourceRows.sort((left, right) => Number(left.rowNumber) - Number(right.rowNumber));
    }
  } catch {
    return failSnapshotValidation(env, snapshotId, "저장된 엑셀 행 또는 기준 membership을 읽을 수 없습니다.", actor);
  }

  const prepared = prepareCanonicalSnapshotRows(sourceRows, {
    ...options,
    preservedLocationsByRowKey
  });
  if (!prepared.ok) {
    return failSnapshotValidation(
      env,
      snapshotId,
      formatCanonicalErrors(prepared.errors),
      actor,
      false,
      SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD,
      { errors: prepared.errors }
    );
  }

  const existingDocuments = snapshot.mode === "bootstrap"
    ? documents.filter((document) => !isInitialBootstrapSeed(document))
    : documents;
  const match = matchCanonicalSnapshotRows(prepared.items, existingDocuments, {
    managedMode: snapshot.mode !== "bootstrap",
    lookup
  });
  if (!match.ok) {
    return failSnapshotValidation(
      env,
      snapshotId,
      formatCanonicalErrors(match.errors),
      actor,
      false,
      match.errors[0]?.code || SNAPSHOT_ERROR_CODES.SNAPSHOT_IDENTITY_CONFLICT,
      { errors: match.errors }
    );
  }

  const revisionPolicy = validateRevisionHistorySnapshotChanges(
    match.items,
    revisionLinkResult.results ?? []
  );
  if (!revisionPolicy.ok) {
    return failSnapshotValidation(
      env,
      snapshotId,
      formatCanonicalErrors(revisionPolicy.errors),
      actor,
      false,
      SNAPSHOT_ERROR_CODES.SNAPSHOT_REVISION_HISTORY_CONFLICT,
      { errors: revisionPolicy.errors }
    );
  }

  const summary = summarizeChangeFlags(match.items, match.exclusions.length);
  const autoCategoryNames = [...new Map(
    prepared.items
      .filter((item) => Number(item.values.categoryId || 0) === 0)
      .map((item) => [clean(item.values.categoryName).toLowerCase(), clean(item.values.categoryName)])
      .filter(([key]) => Boolean(key))
  ).values()].sort((left, right) => left.localeCompare(right, "ko"));
  const requiredPermissions = requiredPermissionsForDiff(summary);
  const missing = missingPermissionsForSession(actor, requiredPermissions);
  if (Number(summary.restoreCount) > 0 && actor?.role !== "Admin" && !missing.includes("Admin")) {
    missing.push("Admin(폐기 해제)");
  }
  const baselineCurrentDocumentCount = existingDocuments.filter((document) => document.sync_state === "current").length;
  const warnings = computeRiskWarnings({
    summary,
    currentDocumentCount: baselineCurrentDocumentCount,
    missingPermissions: missing,
    identityChangeCount: match.identityChangeCount,
    blankKeyCreateCount: match.blankKeyCreateCount,
    autoCategoryNames
  });
  const approvalRequired = approvalReferenceRequired(summary, {
    identityChangeCount: match.identityChangeCount,
    warnings
  }) ? 1 : 0;
  const canonicalRowsHash = await computeCanonicalRowsHash(match.items);
  const actorSnapshot = auditActorSnapshot(actor);
  const changePayloads = match.items.map((item) => snapshotChangePayload(item, {
    bootstrap: snapshot.mode === "bootstrap"
  }));
  const changeChunks = splitSnapshotPayloadChunks(changePayloads);
  const exclusionPayloads = match.exclusions.map((item) => ({
    documentId: item.documentId,
    excelRowKey: item.excelRowKey,
    expectedRowVersion: item.expectedRowVersion,
    beforeJson: JSON.stringify(item.before)
  }));
  const exclusionChunks = splitSnapshotPayloadChunks(exclusionPayloads);
  const fixedPrepareStatements = 3; // 기존 exclusion 삭제 + snapshot ready + system audit
  if (
    changeChunks.length + exclusionChunks.length + fixedPrepareStatements
      > FREE_TIER_BUDGET.maxD1MutationStatementsPerBatch
  ) {
    return failSnapshotValidation(
      env,
      snapshotId,
      "검증 결과가 한 요청의 안전한 D1 payload 범위를 초과했습니다. 비고·태그 길이를 줄인 뒤 다시 시도하세요.",
      actor,
      false,
      SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD
    );
  }
  const changeStatements = changeChunks.map((chunk) => snapshotRowChangeStatement(env, snapshotId, chunk));
  const exclusionStatements = exclusionChunks.map((chunk) => snapshotExclusionInsertStatement(env, snapshotId, chunk));

  const statements = [
    env.DB.prepare(`
      DELETE FROM document_snapshot_exclusions
      WHERE snapshot_id = ?
        AND EXISTS (SELECT 1 FROM document_snapshots WHERE id = ? AND status = 'staging')
    `).bind(snapshotId, snapshotId),
    ...changeStatements,
    ...exclusionStatements,
    env.DB.prepare(`
      UPDATE document_snapshots
      SET status = 'ready',
          create_count = ?, update_count = ?, unchanged_count = ?, exclude_count = ?,
          metadata_count = ?, move_count = ?, dispose_count = ?, restore_count = ?,
          tag_change_count = ?, reinclude_count = ?, identity_change_count = ?,
          required_permissions_json = ?, warnings_json = ?, canonical_rows_hash = ?,
          baseline_current_document_count = ?, approval_required = ?,
          approval_policy_version = ?,
          error_summary = NULL, validation_errors_json = NULL,
          prepared_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'staging' AND base_version = (
        SELECT current_version FROM document_sync_state WHERE id = 1
      )
      RETURNING *
    `).bind(
      summary.createCount,
      summary.updateCount,
      summary.unchangedCount,
      summary.excludeCount,
      summary.metadataCount,
      summary.moveCount,
      summary.disposeCount,
      summary.restoreCount,
      summary.tagChangeCount,
      summary.reincludeCount,
      match.identityChangeCount,
      JSON.stringify(requiredPermissions),
      JSON.stringify(warnings),
      canonicalRowsHash,
      baselineCurrentDocumentCount,
      approvalRequired,
      APPROVAL_POLICY_VERSION,
      snapshotId
    ),
    systemSnapshotAuditStatement(env, snapshotId, "prepare", "엑셀 문서대장 변경 검토 완료", actorSnapshot, {
      ...summary,
      requiredPermissions,
      missingPermissions: missing,
      warnings,
      canonicalRowsHash,
      baselineCurrentDocumentCount,
      approvalRequired: Boolean(approvalRequired),
      approvalPolicyVersion: APPROVAL_POLICY_VERSION,
      applyMode: resolveSnapshotApplyMode(env),
      autoCategoryNames
    }, "ready")
  ];
  const results = await executeMutationBatch(env, createSnapshotPlan("prepare", statements));
  const readyResultIndex = 1 + changeStatements.length + exclusionStatements.length;
  const ready = results[readyResultIndex]?.results?.[0];
  if (!ready) {
    return failSnapshotValidation(
      env,
      snapshotId,
      "검증 중 문서고가 변경되었습니다. 최신 엑셀로 다시 시작하세요.",
      actor,
      true,
      SNAPSHOT_ERROR_CODES.SNAPSHOT_STALE,
      { stale: true, warnings }
    );
  }
  return {
    ok: true,
    snapshot: ready,
    summary,
    requiredPermissions,
    missingPermissions: missing,
    warnings,
    canonicalRowsHash,
    statementCount: statements.length
  };
}
async function failSnapshotValidation(env, snapshotId, message, actor, stale = false, code = SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, extras = {}) {
  const summary = clean(message).slice(0, 2000) || "엑셀 검증에 실패했습니다.";
  const actorSnapshot = auditActorSnapshot(actor);
  const statements = [
    env.DB.prepare(`
      UPDATE document_snapshots
      SET status = 'failed', error_summary = ?, validation_errors_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'staging'
    `).bind(summary, Array.isArray(extras.errors) ? JSON.stringify(extras.errors) : null, snapshotId),
    systemSnapshotAuditStatement(env, snapshotId, "validation_failed", "엑셀 문서대장 검증 실패", actorSnapshot, { message: summary, code, ...extras }, "failed")
  ];
  await executeMutationBatch(env, createSnapshotPlan("validation-failed", statements));
  return { ok: false, stale, code, message: summary, ...extras };
}

function sourceRowFromCurrentDocument(document, membership, lookup) {
  const categoryName = lookup.categoryNames?.get(Number(document.category_id)) || "";
  const slot = lookup.slotsById?.get(Number(document.rack_slot_id));
  const tagIds = String(document.tag_ids || "").split(",").map(Number).filter(Number.isInteger);
  const tagNames = tagIds.map((id) => lookup.tagNames?.get(id) || "").filter(Boolean);
  return {
    rowNumber: Number(membership.row_number),
    sourceRowKey: clean(membership.row_key),
    rowKey: clean(membership.row_key),
    documentNumber: clean(document.document_number),
    revisionNumber: revisionForExcel(document.revision_number),
    revisionDate: clean(document.revision_date) || NOT_APPLICABLE,
    disposalDueYear: document.disposal_due_year ?? NOT_APPLICABLE,
    documentName: clean(document.document_name),
    category: clean(categoryName),
    rackCode: clean(slot?.code),
    zoneNumber: Number(slot?.zone_number || 0),
    rackNumber: Number(slot?.rack_number || 0),
    rackColumn: Number(slot?.column_number || 0),
    shelfNumber: Number(slot?.shelf_number || 0),
    rackFace: clean(document.rack_face),
    tags: tagNames.join(";") || NOT_APPLICABLE,
    note: clean(document.note) || NOT_APPLICABLE,
    status: document.status === "disposed" ? "폐기" : "보관중"
  };
}

function currentDocumentSlot(document) {
  const id = Number(document.rack_slot_id || 0);
  const rackId = Number(document.current_rack_id || 0);
  const code = clean(document.current_rack_code);
  const columnNumber = Number(document.current_column_number || 0);
  const shelfNumber = Number(document.current_shelf_number || 0);
  if (!id || !rackId || !code || !columnNumber || !shelfNumber) return null;
  return {
    id,
    slot_code: clean(document.current_slot_code),
    column_number: columnNumber,
    shelf_number: shelfNumber,
    rack_id: rackId,
    code,
    zone_number: Number(document.current_zone_number || 0),
    rack_number: Number(document.current_rack_number || 0),
    is_single_sided: Number(document.current_rack_is_single_sided || 0)
  };
}

function isInitialBootstrapSeed(document) {
  const storageCode = clean(document.storage_code);
  const documentNumber = clean(document.document_number);
  const note = clean(document.note);
  return note === "Cloudflare 테스트 기본 문서" && (
    (storageCode === "ARC-000001" && documentNumber === "MR-2026-001") ||
    (storageCode === "ARC-000002" && documentNumber === "PV-2026-014")
  );
}

function snapshotChangePayload(item, { bootstrap = false } = {}) {
  const normalizedJson = JSON.stringify({
    schemaVersion: 1,
    rowKey: item.rowKey,
    values: item.values,
    status: item.status,
    changeFlags: item.changeFlags,
    changedFields: item.changedFields
  });
  return {
    rowNumber: Number(item.rowNumber),
    action: item.action,
    matchedDocumentId: item.matchedDocumentId || null,
    rowKey: item.rowKey,
    expectedRowVersion: item.expectedRowVersion,
    beforeJson: bootstrap ? null : (item.before ? JSON.stringify(item.before) : null),
    // bootstrap 신규행은 화면이 normalized_json을 fallback으로 읽고 apply도 normalized_json만 쓴다.
    // 동일한 최대 30,000개 after payload를 중복 저장하지 않는다.
    afterJson: bootstrap ? null : (item.after ? JSON.stringify(item.after) : null),
    changedFieldsJson: JSON.stringify(item.changedFields || []),
    changeFlagsJson: JSON.stringify(item.changeFlags || []),
    normalizedJson
  };
}

/** D1 value 상한을 넘지 않게 JSON payload를 재귀적으로 반분한다. */
function splitSnapshotPayloadChunks(items) {
  if (!items.length) return [];
  const json = JSON.stringify(items);
  if (isD1ValuePayloadWithinLimit(json)) return [{ items, json }];
  if (items.length === 1) {
    throw new RangeError("snapshot payload 한 행이 D1 value 안전 상한을 초과했습니다.");
  }
  const middle = Math.ceil(items.length / 2);
  return [
    ...splitSnapshotPayloadChunks(items.slice(0, middle)),
    ...splitSnapshotPayloadChunks(items.slice(middle))
  ];
}

function snapshotRowChangeStatement(env, snapshotId, chunk) {
  return env.DB.prepare(`
    WITH changes AS MATERIALIZED (
      SELECT
        CAST(json_extract(value, '$.rowNumber') AS INTEGER) AS row_number,
        value
      FROM json_each(?)
    )
    UPDATE document_snapshot_rows AS row
    SET row_key = json_extract(changes.value, '$.rowKey'),
        normalized_json = json_extract(changes.value, '$.normalizedJson'),
        before_json = json_extract(changes.value, '$.beforeJson'),
        after_json = json_extract(changes.value, '$.afterJson'),
        changed_fields_json = json_extract(changes.value, '$.changedFieldsJson'),
        change_flags_json = json_extract(changes.value, '$.changeFlagsJson'),
        expected_row_version = CAST(json_extract(changes.value, '$.expectedRowVersion') AS INTEGER),
        action = json_extract(changes.value, '$.action'),
        matched_document_id = CAST(json_extract(changes.value, '$.matchedDocumentId') AS INTEGER)
    FROM changes
    WHERE row.snapshot_id = ?
      AND row.row_number = changes.row_number
      AND row.row_number IN (SELECT row_number FROM changes)
      AND EXISTS (SELECT 1 FROM document_snapshots WHERE id = ? AND status = 'staging')
  `).bind(chunk.json, snapshotId, snapshotId);
}

function snapshotExclusionInsertStatement(env, snapshotId, chunk) {
  return env.DB.prepare(`
    INSERT INTO document_snapshot_exclusions (
      snapshot_id, document_id, excel_row_key, expected_row_version, before_json
    )
    SELECT
      ?,
      CAST(json_extract(item.value, '$.documentId') AS INTEGER),
      json_extract(item.value, '$.excelRowKey'),
      CAST(json_extract(item.value, '$.expectedRowVersion') AS INTEGER),
      json_extract(item.value, '$.beforeJson')
    FROM json_each(?) item
    WHERE EXISTS (SELECT 1 FROM document_snapshots WHERE id = ? AND status = 'staging')
  `).bind(snapshotId, chunk.json, snapshotId);
}
