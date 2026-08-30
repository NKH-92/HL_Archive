import { FREE_TIER_BUDGET } from "../../../config.js";
import { readBoolean } from "../../../shared/coercion.js";
import { clean } from "../../../shared/text/normalize.js";
import { createSystemAuditStatement } from "../../audit/index.js";
import { hasChanged } from "../../../platform/d1/result.js";
import { executeMutationBatch } from "../../../platform/d1/requestGateway.js";
import { d1ContainsPattern } from "../../../platform/d1/likePattern.js";
import { createDisposalPlan } from "./plans.js";

const BATCH_STATUSES = new Set(["draft", "frozen", "processing", "completed", "cancelled"]);
const ITEM_STATUSES = new Set(["pending", "excluded", "completed", "changed", "failed"]);

export function normalizeDisposalCriteria(values = {}) {
  const year = positiveInteger(values.disposalDueYear);
  const zone = positiveInteger(values.zoneNumber);
  return {
    disposalDueYear: year >= 1900 && year <= 9999 ? year : 0,
    yearMode: values.yearMode === "lte" ? "lte" : "exact",
    categoryId: positiveInteger(values.categoryId),
    zoneNumber: zone >= 1 && zone <= 3 ? zone : 0,
    rackId: positiveInteger(values.rackId)
  };
}

export function validateDisposalBatchDraft(values = {}) {
  const title = clean(values.title);
  const disposalReason = clean(values.disposalReason);
  const criteria = normalizeDisposalCriteria(values.criteria || values);
  if (!title) return { ok: false, message: "캠페인 제목을 입력해 주세요." };
  if (!disposalReason) return { ok: false, message: "폐기 사유를 입력해 주세요." };
  if (!hasAnyCriteria(criteria)) {
    return { ok: false, message: "폐기 예정 연도, 대분류, 구역, 랙 중 하나 이상의 조건이 필요합니다." };
  }
  return {
    ok: true,
    values: {
      title,
      disposalReason,
      approvalReference: clean(values.approvalReference),
      criteria
    }
  };
}

export async function listDisposalBatches(env, { status = "", limit = 100 } = {}) {
  const safeStatus = BATCH_STATUSES.has(status) ? status : "";
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 200));
  const result = await env.DB.prepare(`
    SELECT
      b.*,
      c.name AS category_name,
      MAX(0, b.target_count - b.completed_count - b.excluded_count - b.changed_count - b.failed_count) AS pending_count
    FROM disposal_batches b
    LEFT JOIN categories c
      ON c.id = CAST(json_extract(b.criteria_json, '$.categoryId') AS INTEGER)
    WHERE (? = '' OR b.status = ?)
    ORDER BY b.created_at DESC, b.id DESC
    LIMIT ?
  `).bind(safeStatus, safeStatus, safeLimit).all();
  return (result.results ?? []).map(hydrateBatch);
}

export async function getDisposalBatch(env, id) {
  const row = await env.DB.prepare(`
    SELECT
      b.*,
      c.name AS category_name,
      MAX(0, b.target_count - b.completed_count - b.excluded_count - b.changed_count - b.failed_count) AS pending_count
    FROM disposal_batches b
    LEFT JOIN categories c
      ON c.id = CAST(json_extract(b.criteria_json, '$.categoryId') AS INTEGER)
    WHERE b.id = ?
  `).bind(id).first();
  return hydrateBatch(row);
}

export async function getDisposalBatchItems(env, batchId, { status = "", limit = 200, offset = 0 } = {}) {
  const safeStatus = ITEM_STATUSES.has(status) ? status : "";
  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 200));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const result = await env.DB.prepare(`
    SELECT *
    FROM disposal_batch_items
    WHERE batch_id = ? AND (? = '' OR status = ?)
    ORDER BY id
    LIMIT ? OFFSET ?
  `).bind(batchId, safeStatus, safeStatus, safeLimit, safeOffset).all();
  return result.results ?? [];
}

export async function previewDisposalCandidates(env, rawCriteria, limit = FREE_TIER_BUDGET.disposalBatchPreviewItems) {
  const criteria = normalizeDisposalCriteria(rawCriteria);
  if (!hasAnyCriteria(criteria)) return [];
  const where = buildCandidateWhere(criteria);
  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || FREE_TIER_BUDGET.disposalBatchPreviewItems, FREE_TIER_BUDGET.disposalBatchPreviewItems)
  );
  const result = await env.DB.prepare(`
    SELECT
      d.id,
      d.document_number,
      d.revision_number,
      d.document_name,
      c.name AS category_name,
      d.disposal_due_year,
      d.updated_at,
      d.row_version,
      ${locationSnapshotSql("d", "r", "rs")} AS location_snapshot
    ${candidateTablesSql()}
    WHERE ${where.sql}
    ORDER BY d.disposal_due_year, c.name, r.zone_number, r.rack_number, d.rack_face, rs.column_number, rs.shelf_number, d.document_number
    LIMIT ?
  `).bind(...where.binds, safeLimit).all();
  return result.results ?? [];
}

export async function createDisposalBatch(env, rawValues, actor) {
  const validation = validateDisposalBatchDraft(rawValues);
  if (!validation.ok) return validation;
  const values = validation.values;
  const temporaryCode = `DSP-TEMP-${crypto.randomUUID()}`;
  const actorId = requiredActorId(actor);
  const permissions = actorPermissionsSnapshot(actor);
  const criteriaJson = JSON.stringify(values.criteria);
  const statements = [
    env.DB.prepare(`
      INSERT INTO disposal_batches (
        batch_code, title, criteria_json, disposal_reason, approval_reference,
        created_by_user_id, created_by_name
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(
      temporaryCode,
      values.title,
      criteriaJson,
      values.disposalReason,
      values.approvalReference || null,
      actorId,
      actorName(actor)
    ),
    env.DB.prepare(`
      INSERT INTO system_audit_logs (
        entity_type, entity_id, entity_reference, action, actor_user_id,
        actor_username_snapshot, actor_display_name_snapshot, actor_permissions_snapshot,
        summary, details_json
      )
      SELECT
        'disposal_batch', id, 'DSP-' || strftime('%Y', 'now') || '-' || printf('%04d', id),
        'create', ?, ?, ?, ?, '폐기 캠페인 생성',
        json_object('title', title, 'criteria', json(criteria_json), 'disposalReason', disposal_reason)
      FROM disposal_batches
      WHERE batch_code = ?
    `).bind(actorId, actorUsername(actor), actorName(actor), permissions, temporaryCode),
    env.DB.prepare(`
      UPDATE disposal_batches
      SET batch_code = 'DSP-' || strftime('%Y', 'now') || '-' || printf('%04d', id),
          updated_at = CURRENT_TIMESTAMP
      WHERE batch_code = ?
    `).bind(temporaryCode)
  ];
  const results = await executeMutationBatch(env, createDisposalPlan("create", statements, "temporary-batch-code"));
  const id = Number(results[0]?.results?.[0]?.id || 0);
  if (!id) throw new Error("폐기 캠페인 생성 결과를 확인할 수 없습니다.");
  return { ok: true, id };
}

// 통합 폐기 화면에서 사용자가 직접 고른 소량 문서를 즉시 동결된 작업으로 만든다.
export async function createSelectedDisposalBatch(env, rawValues, actor) {
  const ids = [...new Set((rawValues?.documentIds || [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0))];
  const disposalReason = clean(rawValues?.disposalReason);
  const approvalReference = clean(rawValues?.approvalReference);
  const maxItems = FREE_TIER_BUDGET.disposalProcessChunkSize;
  if (!ids.length) return { ok: false, message: "폐기할 문서를 하나 이상 선택해 주세요." };
  if (ids.length > maxItems) return { ok: false, message: `한 번에 최대 ${maxItems}건까지 폐기할 수 있습니다.` };
  if (!disposalReason) return { ok: false, message: "폐기 사유를 입력해 주세요." };
  const confirmedTargetCount = Number(rawValues?.confirmedTargetCount);
  if (!readBoolean(rawValues?.confirmDisposal) || !Number.isInteger(confirmedTargetCount) || confirmedTargetCount !== ids.length) {
    return { ok: false, message: `선택한 실제 원본 ${ids.length}부와 확인 수량이 일치하는지 다시 확인해 주세요.` };
  }

  const placeholders = ids.map(() => "?").join(", ");
  const selected = await env.DB.prepare(`
    SELECT id
    FROM documents
    WHERE id IN (${placeholders}) AND status = 'active' AND sync_state = 'current'
  `).bind(...ids).all();
  if ((selected.results ?? []).length !== ids.length) {
    return { ok: false, message: "선택한 문서 중 상태가 변경된 항목이 있습니다. 목록을 새로고침한 뒤 다시 선택해 주세요." };
  }

  const temporaryCode = `DSP-TEMP-${crypto.randomUUID()}`;
  const actorId = requiredActorId(actor);
  const actorDisplayName = actorName(actor);
  const permissions = actorPermissionsSnapshot(actor);
  const criteriaJson = JSON.stringify({ mode: "selected", documentIds: ids });
  const statements = [
    env.DB.prepare(`
      INSERT INTO disposal_batches (
        batch_code, title, criteria_json, disposal_reason, approval_reference,
        created_by_user_id, created_by_name
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(
      temporaryCode,
      `선택 원본 폐기 ${ids.length}부`,
      criteriaJson,
      disposalReason,
      approvalReference || null,
      actorId,
      actorDisplayName
    ),
    env.DB.prepare(`
      INSERT INTO system_audit_logs (
        entity_type, entity_id, entity_reference, action, actor_user_id,
        actor_username_snapshot, actor_display_name_snapshot, actor_permissions_snapshot,
        summary, details_json
      )
      SELECT
        'disposal_batch', id, 'DSP-' || strftime('%Y', 'now') || '-' || printf('%04d', id),
        'create', ?, ?, ?, ?, '선택 문서 폐기 작업 생성',
        json_object('documentCount', ?, 'disposalReason', disposal_reason, 'approvalReference', approval_reference)
      FROM disposal_batches
      WHERE batch_code = ?
    `).bind(actorId, actorUsername(actor), actorDisplayName, permissions, ids.length, temporaryCode),
    env.DB.prepare(`
      INSERT INTO disposal_batch_items (
        batch_id, document_id, document_number_snapshot, revision_number_snapshot,
        document_name_snapshot, category_snapshot, location_snapshot,
        disposal_due_year_snapshot, expected_updated_at, expected_document_version
      )
      SELECT
        b.id, d.id, d.document_number, COALESCE(d.revision_number, 'N/A'), d.document_name, c.name,
        ${locationSnapshotSql("d", "r", "rs")}, d.disposal_due_year, d.updated_at, d.row_version
      FROM disposal_batches b
      CROSS JOIN documents d
      JOIN categories c ON c.id = d.category_id
      JOIN rack_slots rs ON rs.id = d.rack_slot_id
      JOIN racks r ON r.id = rs.rack_id
      WHERE b.batch_code = ? AND d.id IN (${placeholders}) AND d.status = 'active' AND d.sync_state = 'current'
    `).bind(temporaryCode, ...ids),
    env.DB.prepare(`
      UPDATE disposal_batches
      SET batch_code = 'DSP-' || strftime('%Y', 'now') || '-' || printf('%04d', id),
          status = 'frozen',
          target_count = CASE
            WHEN (SELECT COUNT(*) FROM disposal_batch_items WHERE batch_id = disposal_batches.id) = ?
            THEN ? ELSE NULL
          END,
          frozen_by_user_id = ?, frozen_by_name = ?, frozen_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE batch_code = ?
        AND EXISTS (SELECT 1 FROM disposal_batch_items WHERE batch_id = disposal_batches.id)
      RETURNING id, target_count
    `).bind(ids.length, ids.length, actorId, actorDisplayName, temporaryCode)
  ];
  const results = await executeMutationBatch(env, createDisposalPlan("create-selected", statements, "selected-active-documents"));
  const row = results[3]?.results?.[0];
  const id = Number(row?.id || 0);
  if (!id) throw new Error("선택 문서 폐기 작업 생성 결과를 확인할 수 없습니다.");
  return { ok: true, id, count: Number(row.target_count || 0) };
}

export async function getDisposalHistoryPage(env, { query = "", page = 1, pageSize = 30 } = {}) {
  const cleanQuery = clean(query);
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || 30, 100));
  const offset = (safePage - 1) * safePageSize;
  const like = d1ContainsPattern(cleanQuery);
  const where = `d.status = 'disposed' AND d.sync_state = 'current' AND (
    ? = '' OR d.document_number LIKE ? ESCAPE '\\' OR d.revision_number LIKE ? ESCAPE '\\' OR d.document_name LIKE ? ESCAPE '\\'
  )`;
  const countRow = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM documents d
    WHERE ${where}
  `).bind(cleanQuery, like, like, like).first();
  const result = await env.DB.prepare(`
    SELECT
      dl.id, d.id AS document_id, dl.disposal_batch_id, dl.reason, dl.performed_by, dl.created_at,
      d.document_number, d.revision_number, d.document_name, d.status, d.updated_at,
      c.name AS category_name,
      ${locationSnapshotSql("d", "r", "rs")} AS location_snapshot,
      b.batch_code, b.approval_reference
    FROM documents d
    LEFT JOIN disposal_logs dl ON dl.id = (
      SELECT latest.id
      FROM disposal_logs latest
      WHERE latest.document_id = d.id AND latest.action = 'disposed'
      ORDER BY latest.id DESC
      LIMIT 1
    )
    JOIN categories c ON c.id = d.category_id
    JOIN rack_slots rs ON rs.id = d.rack_slot_id
    JOIN racks r ON r.id = rs.rack_id
    LEFT JOIN disposal_batches b ON b.id = dl.disposal_batch_id
    WHERE ${where}
    ORDER BY COALESCE(dl.created_at, d.updated_at) DESC, d.id DESC
    LIMIT ? OFFSET ?
  `).bind(cleanQuery, like, like, like, safePageSize, offset).all();
  const totalItems = Number(countRow?.count || 0);
  return {
    items: result.results ?? [],
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / safePageSize))
    }
  };
}

export async function updateDisposalBatch(env, id, rawValues, actor, expectedUpdatedAt = "") {
  const validation = validateDisposalBatchDraft(rawValues);
  if (!validation.ok) return validation;
  const values = validation.values;
  const lock = clean(expectedUpdatedAt);
  const guardSql = `FROM disposal_batches WHERE id = ? AND status = 'draft'${lock ? " AND updated_at = ?" : ""}`;
  const guardBinds = [id, ...(lock ? [lock] : [])];
  const statements = [
    createSystemAuditStatement(env, {
      entityType: "disposal_batch",
      entityId: id,
      action: "update",
      actor,
      summary: "폐기 캠페인 초안 수정",
      details: { title: values.title, criteria: values.criteria, disposalReason: values.disposalReason }
    }, { guardSql, guardBinds }),
    env.DB.prepare(`
      UPDATE disposal_batches
      SET title = ?, criteria_json = ?, disposal_reason = ?, approval_reference = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'draft'${lock ? " AND updated_at = ?" : ""}
    `).bind(
      values.title,
      JSON.stringify(values.criteria),
      values.disposalReason,
      values.approvalReference || null,
      ...guardBinds
    )
  ];
  const results = await executeMutationBatch(env, createDisposalPlan("update", statements, "draft+updated-at"));
  return hasChanged(results[1])
    ? { ok: true }
    : { ok: false, message: "초안 상태가 아니거나 다른 사용자가 먼저 수정했습니다." };
}

export async function freezeDisposalBatch(env, id, actor, expectedUpdatedAt = null, confirmation = {}) {
  const batch = await getDisposalBatch(env, id);
  if (!batch) return { ok: false, message: "폐기 캠페인을 찾을 수 없습니다." };
  if (batch.status === "frozen") return { ok: true, count: batch.target_count };
  if (batch.status !== "draft") return { ok: false, message: "초안 상태의 캠페인만 동결할 수 있습니다." };
  if (!hasAnyCriteria(batch.criteria)) return { ok: false, message: "하나 이상의 폐기 조건이 필요합니다." };

  const expectedAt = clean(expectedUpdatedAt);
  if (!expectedAt) {
    return { ok: false, message: "동결 전 초안 버전 확인 값이 필요합니다. 화면을 새로고침한 뒤 다시 시도하세요." };
  }
  if (expectedAt !== clean(batch.updated_at)) {
    return { ok: false, message: "초안이 변경되었습니다. 미리보기를 다시 확인한 뒤 동결하세요." };
  }

  const count = await countDisposalCandidates(env, batch.criteria);
  if (count === 0) return { ok: false, message: "조건에 맞는 보관중 문서가 없어 동결할 수 없습니다." };
  if (count > FREE_TIER_BUDGET.disposalBatchMaxItems) {
    return { ok: false, message: `대상이 ${FREE_TIER_BUDGET.disposalBatchMaxItems}건을 초과합니다. 조건을 더 좁혀 주세요.` };
  }
  const confirmedCount = Number(confirmation.confirmedTargetCount);
  if (!readBoolean(confirmation.confirmPreview) || !Number.isInteger(confirmedCount) || confirmedCount !== count) {
    return { ok: false, message: `최신 미리보기 ${count}건과 폐기 조건을 확인하세요.` };
  }

  const where = buildCandidateWhere(batch.criteria);
  const countWhere = buildCandidateWhere(batch.criteria, { document: "d2", category: "c2", rack: "r2", slot: "rs2" });
  const countSql = `(SELECT COUNT(*) ${candidateTablesSql({ document: "d2", category: "c2", rack: "r2", slot: "rs2" })} WHERE ${countWhere.sql})`;
  const candidateCountGuard = `${countSql} BETWEEN 1 AND ${Number(FREE_TIER_BUDGET.disposalBatchMaxItems)}`;
  const actorId = requiredActorId(actor);
  const criteriaJson = JSON.stringify(batch.criteria);
  const statements = [
    createSystemAuditStatement(env, {
      entityType: "disposal_batch",
      entityId: id,
      entityReference: batch.batch_code,
      action: "freeze",
      actor,
      summary: "폐기 대상 동결",
      details: { criteria: batch.criteria, targetCount: count, expectedUpdatedAt: expectedAt }
    }, {
      guardSql: `FROM disposal_batches b WHERE b.id = ? AND b.status = 'draft' AND b.updated_at = ? AND b.criteria_json = ? AND ${candidateCountGuard}`,
      guardBinds: [id, expectedAt, criteriaJson, ...countWhere.binds]
    }),
    env.DB.prepare(`
      INSERT OR IGNORE INTO disposal_batch_items (
        batch_id, document_id, document_number_snapshot, revision_number_snapshot,
        document_name_snapshot, category_snapshot, location_snapshot,
        disposal_due_year_snapshot, expected_updated_at, expected_document_version
      )
      SELECT
        b.id, d.id, d.document_number, COALESCE(d.revision_number, 'N/A'), d.document_name, c.name,
        ${locationSnapshotSql("d", "r", "rs")}, d.disposal_due_year, d.updated_at, d.row_version
      FROM disposal_batches b
      CROSS JOIN documents d
      JOIN categories c ON c.id = d.category_id
      JOIN rack_slots rs ON rs.id = d.rack_slot_id
      JOIN racks r ON r.id = rs.rack_id
      WHERE b.id = ? AND b.status = 'draft' AND b.updated_at = ? AND b.criteria_json = ?
        AND ${where.sql} AND ${candidateCountGuard}
    `).bind(id, expectedAt, criteriaJson, ...where.binds, ...countWhere.binds),
    env.DB.prepare(`
      UPDATE disposal_batches
      SET status = 'frozen',
          target_count = (SELECT COUNT(*) FROM disposal_batch_items WHERE batch_id = ?),
          frozen_by_user_id = ?, frozen_by_name = ?, frozen_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'draft' AND updated_at = ? AND criteria_json = ?
        AND EXISTS (SELECT 1 FROM disposal_batch_items WHERE batch_id = ?)
        AND (SELECT COUNT(*) FROM disposal_batch_items WHERE batch_id = ?) = (${countSql})
    `).bind(id, actorId, actorName(actor), id, expectedAt, criteriaJson, id, id, ...countWhere.binds)
  ];
  const results = await executeMutationBatch(env, createDisposalPlan("freeze", statements, "draft+frozen-snapshot"));
  if (!hasChanged(results[2])) {
    return { ok: false, message: "동결 중 대상이 변경되었습니다. 미리보기를 다시 확인해 주세요." };
  }
  const frozen = await getDisposalBatch(env, id);
  return { ok: true, count: Number(frozen?.target_count || 0) };
}

export async function setDisposalBatchItemExcluded(env, batchId, itemId, excluded, reason, actor) {
  const batch = await getDisposalBatch(env, batchId);
  if (!batch) return { ok: false, message: "폐기 캠페인을 찾을 수 없습니다." };
  if (batch.status !== "frozen") return { ok: false, message: "동결 후 처리 시작 전 항목만 변경할 수 있습니다." };
  const cleanReason = clean(reason);
  if (excluded && !cleanReason) return { ok: false, message: "제외 사유를 입력해 주세요." };
  const fromStatus = excluded ? "pending" : "excluded";
  const toStatus = excluded ? "excluded" : "pending";
  const action = excluded ? "exclude" : "include";
  const statements = [
    createSystemAuditStatement(env, {
      entityType: "disposal_batch",
      entityId: batchId,
      entityReference: batch.batch_code,
      action,
      actor,
      summary: excluded ? "폐기 대상 제외" : "폐기 대상 재포함",
      details: { itemId, reason: cleanReason }
    }, {
      guardSql: `FROM disposal_batch_items i JOIN disposal_batches b ON b.id = i.batch_id WHERE i.id = ? AND i.batch_id = ? AND i.status = ? AND b.status = 'frozen'`,
      guardBinds: [itemId, batchId, fromStatus]
    }),
    env.DB.prepare(`
      UPDATE disposal_batch_items
      SET status = ?, exclusion_reason = ?, result_message = NULL, processing_token = NULL
      WHERE id = ? AND batch_id = ? AND status = ?
        AND EXISTS (SELECT 1 FROM disposal_batches WHERE id = ? AND status = 'frozen')
    `).bind(toStatus, excluded ? cleanReason : null, itemId, batchId, fromStatus, batchId),
    aggregateDisposalBatchStatement(env, batchId, actor, false)
  ];
  const results = await executeMutationBatch(env, createDisposalPlan("include-exclude", statements, "draft-or-frozen-item"));
  if (!hasChanged(results[1])) {
    const current = await getDisposalBatchItem(env, batchId, itemId);
    return current?.status === toStatus
      ? { ok: true }
      : { ok: false, message: "항목 상태가 변경되어 처리할 수 없습니다." };
  }
  return { ok: true };
}

export async function startDisposalBatch(env, id, actor, confirmation = {}) {
  const batch = await getDisposalBatch(env, id);
  if (!batch) return { ok: false, message: "폐기 캠페인을 찾을 수 없습니다." };
  if (batch.status === "processing") return { ok: true };
  if (batch.status !== "frozen") return { ok: false, message: "동결된 캠페인만 처리를 시작할 수 있습니다." };
  const confirmedCount = Number(confirmation.confirmedTargetCount);
  if (!readBoolean(confirmation.confirmStart) || !Number.isInteger(confirmedCount) || confirmedCount !== Number(batch.target_count || 0)) {
    return { ok: false, message: `동결 대상 ${Number(batch.target_count || 0)}건을 확인한 뒤 폐기 처리를 시작하세요.` };
  }
  const guardSql = "FROM disposal_batches WHERE id = ? AND status = 'frozen'";
  const statements = [
    createSystemAuditStatement(env, {
      entityType: "disposal_batch", entityId: id, entityReference: batch.batch_code,
      action: "start", actor, summary: "폐기 처리 시작"
    }, { guardSql, guardBinds: [id] }),
    env.DB.prepare(`
      UPDATE disposal_batches
      SET status = 'processing', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'frozen'
    `).bind(id)
  ];
  const results = await executeMutationBatch(env, createDisposalPlan("start", statements, "frozen"));
  return hasChanged(results[1]) ? { ok: true } : { ok: false, message: "캠페인 상태가 변경되었습니다." };
}

export async function processDisposalBatch(env, id, actor) {
  const batch = await getDisposalBatch(env, id);
  if (!batch) return { ok: false, message: "폐기 캠페인을 찾을 수 없습니다." };
  if (batch.status === "completed") return { ok: true, done: true, batch };
  if (batch.status !== "processing") return { ok: false, message: "먼저 동결된 캠페인의 처리를 시작해 주세요." };

  const token = crypto.randomUUID();
  const actorId = requiredActorId(actor);
  const actorDisplayName = actorName(actor);
  const actorRole = clean(actor?.role) || "User";
  const chunkSize = FREE_TIER_BUDGET.disposalProcessChunkSize;
  const statements = [
    env.DB.prepare(`
      UPDATE disposal_batch_items
      SET processing_token = ?
      WHERE id IN (
        SELECT i.id
        FROM disposal_batch_items i
        JOIN disposal_batches b ON b.id = i.batch_id
        WHERE i.batch_id = ? AND i.status = 'pending' AND i.processing_token IS NULL
          AND b.status = 'processing'
        ORDER BY i.id
        LIMIT ?
      )
      AND status = 'pending' AND processing_token IS NULL
    `).bind(token, id, chunkSize),
    env.DB.prepare(`
      INSERT OR IGNORE INTO disposal_logs (
        document_id, action, performed_by, reason, disposal_batch_id, disposal_batch_item_id
      )
      SELECT d.id, 'disposed', ?, b.disposal_reason, b.id, i.id
      FROM disposal_batch_items i
      JOIN disposal_batches b ON b.id = i.batch_id
      JOIN documents d ON d.id = i.document_id
      WHERE i.batch_id = ? AND i.processing_token = ? AND i.status = 'pending'
        AND d.status = 'active' AND d.sync_state = 'current'
        AND d.updated_at = i.expected_updated_at
        AND d.row_version = i.expected_document_version
    `).bind(actorDisplayName, id, token),
    env.DB.prepare(`
      INSERT OR IGNORE INTO document_audit_logs (
        document_id, storage_code, document_number, action, actor, actor_role,
        summary, details, actor_user_id, actor_username,
        disposal_batch_id, disposal_batch_item_id
      )
      SELECT
        d.id, d.storage_code, d.document_number, 'dispose', ?, ?, '폐기 캠페인 문서 폐기',
        json_object(
          'before', json_object('status', d.status, 'updatedAt', d.updated_at, 'location', i.location_snapshot),
          'after', json_object('status', 'disposed'),
          'reason', b.disposal_reason,
          'disposalBatchCode', b.batch_code
        ),
        ?, ?, b.id, i.id
      FROM disposal_batch_items i
      JOIN disposal_batches b ON b.id = i.batch_id
      JOIN documents d ON d.id = i.document_id
      JOIN disposal_logs dl
        ON dl.disposal_batch_item_id = i.id
        AND dl.disposal_batch_id = i.batch_id
        AND dl.document_id = i.document_id
      WHERE i.batch_id = ? AND i.processing_token = ? AND i.status = 'pending'
        AND d.status = 'active' AND d.sync_state = 'current'
        AND d.updated_at = i.expected_updated_at
        AND d.row_version = i.expected_document_version
    `).bind(actorDisplayName, actorRole, actorId, actorUsername(actor), id, token),
    env.DB.prepare(`
      UPDATE documents AS d
      SET status = 'disposed', row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE d.status = 'active' AND d.sync_state = 'current'
        AND EXISTS (
          SELECT 1
          FROM disposal_batch_items i
          JOIN disposal_logs dl
            ON dl.disposal_batch_item_id = i.id
            AND dl.disposal_batch_id = i.batch_id
            AND dl.document_id = i.document_id
          JOIN document_audit_logs al
            ON al.disposal_batch_item_id = i.id
            AND al.disposal_batch_id = i.batch_id
            AND al.document_id = i.document_id
          WHERE i.document_id = d.id AND i.batch_id = ? AND i.processing_token = ?
            AND i.status = 'pending' AND d.updated_at = i.expected_updated_at
            AND d.row_version = i.expected_document_version
        )
    `).bind(id, token),
    env.DB.prepare(`
      UPDATE disposal_batch_items AS i
      SET status = 'completed', result_message = '폐기 완료', processed_at = CURRENT_TIMESTAMP,
          processing_token = NULL
      WHERE i.batch_id = ? AND i.processing_token = ? AND i.status = 'pending'
        AND EXISTS (
          SELECT 1 FROM disposal_logs dl
          WHERE dl.disposal_batch_item_id = i.id
            AND dl.disposal_batch_id = i.batch_id
            AND dl.document_id = i.document_id
        )
        AND EXISTS (
          SELECT 1 FROM document_audit_logs al
          WHERE al.disposal_batch_item_id = i.id
            AND al.disposal_batch_id = i.batch_id
            AND al.document_id = i.document_id
        )
        AND EXISTS (SELECT 1 FROM documents d WHERE d.id = i.document_id AND d.status = 'disposed')
    `).bind(id, token),
    env.DB.prepare(`
      UPDATE disposal_batch_items AS i
      SET
        status = CASE
          WHEN NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = i.document_id) THEN 'failed'
          WHEN EXISTS (
            SELECT 1 FROM documents d
            WHERE d.id = i.document_id AND (
              d.status <> 'active'
              OR d.sync_state <> 'current'
              OR d.updated_at <> i.expected_updated_at
              OR d.row_version <> i.expected_document_version
            )
          ) THEN 'changed'
          ELSE 'failed'
        END,
        result_message = CASE
          WHEN NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = i.document_id) THEN '문서를 찾을 수 없습니다.'
          WHEN EXISTS (SELECT 1 FROM documents d WHERE d.id = i.document_id AND d.status <> 'active') THEN '문서 상태가 변경되었습니다.'
          WHEN EXISTS (SELECT 1 FROM documents d WHERE d.id = i.document_id AND d.sync_state <> 'current') THEN '문서가 현재 대장 상태가 아닙니다.'
          WHEN EXISTS (
            SELECT 1 FROM documents d
            WHERE d.id = i.document_id
              AND (d.updated_at <> i.expected_updated_at OR d.row_version <> i.expected_document_version)
          ) THEN '동결 후 문서 정보가 변경되었습니다.'
          ELSE '폐기 처리 결과를 확인할 수 없습니다.'
        END,
        processed_at = CURRENT_TIMESTAMP,
        processing_token = NULL
      WHERE i.batch_id = ? AND i.processing_token = ? AND i.status = 'pending'
    `).bind(id, token),
    createSystemAuditStatement(env, {
      entityType: "disposal_batch", entityId: id, entityReference: batch.batch_code,
      action: "complete", actor, summary: "폐기 캠페인 완료"
    }, {
      guardSql: `FROM disposal_batches b WHERE b.id = ? AND b.status = 'processing' AND NOT EXISTS (SELECT 1 FROM disposal_batch_items i WHERE i.batch_id = b.id AND i.status = 'pending')`,
      guardBinds: [id]
    }),
    aggregateDisposalBatchStatement(env, id, { ...actor, userId: actorId }, true)
  ];

  if (statements.length > 10 || statements.length > FREE_TIER_BUDGET.maxD1StatementsPerRequest) {
    throw new Error("폐기 처리 statement 예산을 초과했습니다.");
  }
  const results = await executeMutationBatch(env, createDisposalPlan("process", statements, "processing+claim-token"));
  const row = results[results.length - 1]?.results?.[0];
  const updated = hydrateBatch(row) || { ...batch };
  return { ok: true, done: updated.status === "completed", batch: updated, statementCount: statements.length + 1 };
}

export async function cancelDisposalBatch(env, id, actor) {
  const batch = await getDisposalBatch(env, id);
  if (!batch) return { ok: false, message: "폐기 캠페인을 찾을 수 없습니다." };
  if (batch.status === "cancelled") return { ok: true };
  if (!new Set(["draft", "frozen"]).has(batch.status)) {
    return { ok: false, message: "처리가 시작된 캠페인은 취소할 수 없습니다." };
  }
  const guardSql = "FROM disposal_batches WHERE id = ? AND status IN ('draft', 'frozen')";
  const statements = [
    createSystemAuditStatement(env, {
      entityType: "disposal_batch", entityId: id, entityReference: batch.batch_code,
      action: "cancel", actor, summary: "폐기 캠페인 취소"
    }, { guardSql, guardBinds: [id] }),
    env.DB.prepare(`
      UPDATE disposal_batches
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status IN ('draft', 'frozen')
    `).bind(id)
  ];
  const results = await executeMutationBatch(env, createDisposalPlan("cancel", statements, "draft-or-frozen-or-processing"));
  return hasChanged(results[1]) ? { ok: true } : { ok: false, message: "캠페인 상태가 변경되었습니다." };
}

export async function getDisposalBatchExportRows(env, id) {
  const result = await env.DB.prepare(`
    SELECT
      b.batch_code, b.title, b.criteria_json, b.disposal_reason, b.approval_reference,
      b.created_by_name, b.frozen_by_name, b.completed_by_name,
      b.created_at, b.frozen_at, b.completed_at,
      i.document_number_snapshot, i.revision_number_snapshot, i.document_name_snapshot,
      i.category_snapshot, i.location_snapshot, i.disposal_due_year_snapshot,
      i.status AS item_status, i.exclusion_reason, i.result_message, i.processed_at
    FROM disposal_batches b
    JOIN disposal_batch_items i ON i.batch_id = b.id
    WHERE b.id = ?
    ORDER BY i.id
  `).bind(id).all();
  return result.results ?? [];
}

export async function countDisposalCandidates(env, rawCriteria) {
  const criteria = normalizeDisposalCriteria(rawCriteria);
  if (!hasAnyCriteria(criteria)) return 0;
  const where = buildCandidateWhere(criteria);
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    ${candidateTablesSql()}
    WHERE ${where.sql}
  `).bind(...where.binds).first();
  return Number(row?.count || 0);
}

async function getDisposalBatchItem(env, batchId, itemId) {
  return env.DB.prepare(`
    SELECT id, batch_id, status
    FROM disposal_batch_items
    WHERE id = ? AND batch_id = ?
  `).bind(itemId, batchId).first();
}

function aggregateDisposalBatchStatement(env, batchId, actor, returnRow) {
  const actorId = Number(actor?.userId ?? actor?.id ?? 0) || null;
  const suffix = returnRow ? ` RETURNING *, MAX(0, target_count - completed_count - excluded_count - changed_count - failed_count) AS pending_count` : "";
  return env.DB.prepare(`
    UPDATE disposal_batches
    SET
      completed_count = (SELECT COUNT(*) FROM disposal_batch_items WHERE batch_id = ? AND status = 'completed'),
      excluded_count = (SELECT COUNT(*) FROM disposal_batch_items WHERE batch_id = ? AND status = 'excluded'),
      changed_count = (SELECT COUNT(*) FROM disposal_batch_items WHERE batch_id = ? AND status = 'changed'),
      failed_count = (SELECT COUNT(*) FROM disposal_batch_items WHERE batch_id = ? AND status = 'failed'),
      status = CASE
        WHEN status = 'processing' AND NOT EXISTS (
          SELECT 1 FROM disposal_batch_items WHERE batch_id = ? AND status = 'pending'
        ) THEN 'completed'
        ELSE status
      END,
      completed_by_user_id = CASE
        WHEN status = 'processing' AND NOT EXISTS (
          SELECT 1 FROM disposal_batch_items WHERE batch_id = ? AND status = 'pending'
        ) THEN ? ELSE completed_by_user_id END,
      completed_by_name = CASE
        WHEN status = 'processing' AND NOT EXISTS (
          SELECT 1 FROM disposal_batch_items WHERE batch_id = ? AND status = 'pending'
        ) THEN ? ELSE completed_by_name END,
      completed_at = CASE
        WHEN status = 'processing' AND NOT EXISTS (
          SELECT 1 FROM disposal_batch_items WHERE batch_id = ? AND status = 'pending'
        ) THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?${suffix}
  `).bind(batchId, batchId, batchId, batchId, batchId, batchId, actorId, batchId, actorName(actor), batchId, batchId);
}

function buildCandidateWhere(criteria, aliases = {}) {
  const d = aliases.document || "d";
  const r = aliases.rack || "r";
  const clauses = [`${d}.status = 'active'`, `${d}.sync_state = 'current'`];
  const binds = [];
  if (criteria.disposalDueYear) {
    clauses.push(`${d}.disposal_due_year ${criteria.yearMode === "lte" ? "<=" : "="} ?`);
    binds.push(criteria.disposalDueYear);
  }
  if (criteria.categoryId) {
    clauses.push(`${d}.category_id = ?`);
    binds.push(criteria.categoryId);
  }
  if (criteria.zoneNumber) {
    clauses.push(`${r}.zone_number = ?`);
    binds.push(criteria.zoneNumber);
  }
  if (criteria.rackId) {
    clauses.push(`${r}.id = ?`);
    binds.push(criteria.rackId);
  }
  return { sql: clauses.join(" AND "), binds };
}

function candidateTablesSql(aliases = {}) {
  const d = aliases.document || "d";
  const c = aliases.category || "c";
  const r = aliases.rack || "r";
  const rs = aliases.slot || "rs";
  return `FROM documents ${d}
    JOIN categories ${c} ON ${c}.id = ${d}.category_id
    JOIN rack_slots ${rs} ON ${rs}.id = ${d}.rack_slot_id
    JOIN racks ${r} ON ${r}.id = ${rs}.rack_id`;
}

function locationSnapshotSql(documentAlias, rackAlias, slotAlias) {
  return `printf(
    '%d구역 / %s번 랙 / %d열 / %d선반',
    ${rackAlias}.zone_number,
    CASE WHEN ${rackAlias}.is_single_sided = 1
      THEN CAST(${rackAlias}.rack_number AS TEXT)
      ELSE CAST(${rackAlias}.rack_number AS TEXT) || '-' || CASE ${documentAlias}.rack_face WHEN 'B' THEN '2' ELSE '1' END
    END,
    ${slotAlias}.column_number,
    ${slotAlias}.shelf_number
  )`;
}

function hydrateBatch(row) {
  if (!row) return null;
  let criteria = {};
  try {
    criteria = normalizeDisposalCriteria(JSON.parse(row.criteria_json || "{}"));
  } catch {
    criteria = normalizeDisposalCriteria();
  }
  return { ...row, criteria };
}

function hasAnyCriteria(criteria) {
  return Boolean(criteria.disposalDueYear || criteria.categoryId || criteria.zoneNumber || criteria.rackId);
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function requiredActorId(actor) {
  const id = Number(actor?.userId ?? actor?.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("작업 사용자 ID를 확인할 수 없습니다.");
  return id;
}

function actorName(actor) {
  return clean(actor?.displayName) || clean(actor?.username) || "알 수 없음";
}

function actorUsername(actor) {
  return clean(actor?.username) || "unknown";
}

function actorPermissionsSnapshot(actor) {
  const snapshot = { role: clean(actor?.role) || "User" };
  for (const [key, value] of Object.entries(actor || {})) {
    if (key.startsWith("can_") || key === "canViewAudit") snapshot[key] = Boolean(value);
  }
  return JSON.stringify(snapshot);
}
