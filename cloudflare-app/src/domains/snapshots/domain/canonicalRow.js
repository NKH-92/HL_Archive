import { validateDocumentRecordFields, validateDocumentTextFields } from "../../documents/index.js";
import { normalizeRackFace } from "../../racks/index.js";
import { clean } from "../../../shared/text/normalize.js";
import { NOT_APPLICABLE, normalizeImportedRevision } from "../../../shared/documents/revision.js";
import { isValidImportedRevisionDate, normalizeImportedRevisionDate } from "./dateOnly.js";
import { SNAPSHOT_ERROR_CODES } from "./errorCodes.js";
import { isStableRowKey } from "./identity.js";

const STATUS_MAP = Object.freeze({
  보관중: "active",
  폐기: "disposed",
  active: "active",
  disposed: "disposed"
});

function fieldError(rowNumber, field, code, message) {
  return { rowNumber, field, code, message };
}

function normalizedRackCode(zoneNumber, rackNumber) {
  return `${zoneNumber}-${String(rackNumber).padStart(2, "0")}`;
}

function slotPositionKey(slot) {
  return `${slot.code}|${slot.column_number}|${slot.shelf_number}`;
}

function parseStrictInteger(raw, { allowLeadingZero = true } = {}) {
  const text = clean(raw);
  if (!text) return { ok: false };
  if (!/^\d+$/.test(text)) return { ok: false };
  if (!allowLeadingZero && text.length > 1 && text.startsWith("0")) return { ok: false };
  const number = Number(text);
  if (!Number.isInteger(number)) return { ok: false };
  return { ok: true, value: number };
}

function normalizeStrictStatus(raw) {
  const text = clean(raw);
  if (!text) return { ok: false };
  const mapped = STATUS_MAP[text] || STATUS_MAP[text.toLowerCase()];
  if (!mapped) return { ok: false };
  return { ok: true, value: mapped };
}

function normalizeStrictFace(raw) {
  const text = clean(raw);
  if (!text) return { ok: false };
  const face = normalizeRackFace(text);
  if (face !== "A" && face !== "B") return { ok: false };
  return { ok: true, value: face };
}

function parseTagNames(raw) {
  const text = clean(raw);
  if (!text || text.toUpperCase() === NOT_APPLICABLE) return [];
  const names = text.split(/[;,|]/).map((name) => clean(name)).filter(Boolean);
  const seen = new Set();
  const unique = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  return unique;
}

/**
 * 전체 대장 전용 엄격 parser. CSV 가져오기와 달리 공란·오타를 기본값으로 보정하지 않는다.
 */
export function prepareCanonicalSnapshotRows(rows, { categories, tags, slots, preservedSlotsByRowKey }) {
  const categoryByName = new Map(categories.map((category) => [category.name.toLowerCase(), category]));
  const tagByName = new Map(tags.map((tag) => [tag.name.toLowerCase(), tag]));
  const slotByPosition = new Map(slots.map((slot) => [slotPositionKey(slot), slot]));
  const errors = [];
  const items = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || {};
    const rowNumber = Number(row.rowNumber) || index + 2;
    const sourceRowKey = clean(row.sourceRowKey ?? row.rowKey);
    const categoryName = clean(row.category) || NOT_APPLICABLE;
    const zoneParsed = parseStrictInteger(row.zoneNumber, { allowLeadingZero: false });
    const rackParsed = parseStrictInteger(row.rackNumber, { allowLeadingZero: false });
    const rackCode = zoneParsed.ok && rackParsed.ok
      ? normalizedRackCode(zoneParsed.value, rackParsed.value)
      : "";
    const columnParsed = parseStrictInteger(row.rackColumn ?? row.columnNumber ?? row.column);
    const shelfParsed = parseStrictInteger(row.shelfNumber ?? row.shelf);
    const disposalText = clean(row.disposalDueYear);
    const disposalMissing = !disposalText || disposalText.toUpperCase() === NOT_APPLICABLE;
    const disposalParsed = disposalMissing ? { ok: true, value: null } : parseStrictInteger(disposalText);
    const statusParsed = normalizeStrictStatus(row.status);
    const faceParsed = normalizeStrictFace(row.rackFace);
    const category = categoryByName.get(categoryName.toLowerCase());
    const positionKey = columnParsed.ok && shelfParsed.ok
      ? `${rackCode}|${columnParsed.value}|${shelfParsed.value}`
      : "";
    const activeSlot = positionKey ? slotByPosition.get(positionKey) : null;
    const preservedSlot = sourceRowKey ? preservedSlotsByRowKey?.get(sourceRowKey) : null;
    // 사용 중지된 랙은 일반 선택지에 다시 노출하지 않는다. 다만 현재 문서가 이미 그 위치에
    // 있다면 같은 관리 ID·같은 좌표인 행에 한해서 무수정 왕복과 메타데이터 수정을 허용한다.
    const slot = activeSlot || (
      preservedSlot && positionKey === slotPositionKey(preservedSlot)
        ? preservedSlot
        : null
    );
    const tagNames = parseTagNames(row.tags);
    const tagIds = [];
    const tagLabels = [];

    const revisionDateRaw = clean(row.revisionDate);
    const revisionDateMissing = !revisionDateRaw || revisionDateRaw.toUpperCase() === NOT_APPLICABLE;
    const revisionDate = revisionDateMissing ? "" : normalizeImportedRevisionDate(revisionDateRaw);
    if (!revisionDateMissing && !isValidImportedRevisionDate(revisionDate)) {
      errors.push(fieldError(rowNumber, "revisionDate", SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, "제·개정일은 YYYY, YYYY-MM-DD 또는 YYYY.MM.DD 형식의 유효한 값이어야 합니다."));
    }
    if (!disposalParsed.ok) {
      errors.push(fieldError(rowNumber, "disposalDueYear", SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, "폐기 예정 년도는 정수 또는 N/A여야 합니다."));
    }
    if (!clean(row.documentName)) {
      errors.push(fieldError(rowNumber, "documentName", SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, "문서명은 필수입니다."));
    }
    // 등록되지 않은 문서종류는 검토 단계에서 임시 categoryId=0으로 유지한다.
    // 실제 기준정보 생성과 ID 해석은 사용자가 최종 반영할 때 같은 DB batch 안에서 수행한다.
    if (!zoneParsed.ok || zoneParsed.value < 1 || zoneParsed.value > 3) {
      errors.push(fieldError(rowNumber, "zoneNumber", SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, "랙 위치 (구역)은 1, 2, 3 중 하나여야 합니다."));
    }
    if (!rackParsed.ok || !columnParsed.ok || !shelfParsed.ok || !slot) {
      errors.push(fieldError(rowNumber, "location", SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, `존재하지 않거나 공란인 위치(${zoneParsed.ok ? `${zoneParsed.value}구역` : "-"} / ${rackParsed.ok ? `${rackParsed.value}번 랙` : "-"} / ${clean(row.rackColumn) || "-"}열 / ${clean(row.shelfNumber) || "-"}선반)입니다.`));
    }
    if (!faceParsed.ok) {
      errors.push(fieldError(rowNumber, "rackFace", SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, "랙 면은 단면/1면/2면(또는 A/B)만 허용하며 공란은 오류입니다."));
    } else if (slot && Number(slot.is_single_sided) === 1 && faceParsed.value === "B") {
      errors.push(fieldError(rowNumber, "rackFace", SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, "단면 랙에는 2면(B)을 입력할 수 없습니다."));
    }
    if (!statusParsed.ok) {
      errors.push(fieldError(rowNumber, "status", SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, "상태는 보관중 또는 폐기만 입력할 수 있습니다."));
    }

    for (const tagName of tagNames) {
      const tag = tagByName.get(tagName.toLowerCase());
      if (!tag) {
        errors.push(fieldError(rowNumber, "tags", SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, `존재하지 않는 태그(${tagName})입니다.`));
      } else {
        tagIds.push(Number(tag.id));
        tagLabels.push(tag.name);
      }
    }

    if (sourceRowKey && !isStableRowKey(sourceRowKey)) {
      errors.push(fieldError(rowNumber, "sourceRowKey", SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, "숨김 관리 ID 형식이 올바르지 않습니다."));
    }

    const values = {
      documentNumber: clean(row.documentNumber) || NOT_APPLICABLE,
      revisionNumber: normalizeImportedRevision(row.revisionNumber),
      revisionDate: revisionDateMissing ? null : revisionDate,
      disposalDueYear: disposalParsed.ok ? disposalParsed.value : null,
      documentName: clean(row.documentName),
      categoryId: category?.id ?? 0,
      categoryName: category?.name || categoryName,
      rackSlotId: slot?.id ?? 0,
      rackCode: slot?.code || rackCode,
      zoneNumber: slot ? Number(slot.zone_number) : (zoneParsed.ok ? zoneParsed.value : null),
      rackNumber: slot ? Number(slot.rack_number) : (rackParsed.ok ? rackParsed.value : null),
      rackColumn: columnParsed.ok ? columnParsed.value : null,
      shelfNumber: shelfParsed.ok ? shelfParsed.value : null,
      rackFace: faceParsed.ok ? faceParsed.value : "",
      note: clean(row.note).toUpperCase() === NOT_APPLICABLE ? null : (clean(row.note) || null),
      tagIds: [...new Set(tagIds)].sort((a, b) => a - b),
      tagNames: [...new Set(tagLabels)].sort((a, b) => a.localeCompare(b, "ko"))
    };

    const textError = validateDocumentTextFields({ ...values, revisionNumber: values.revisionNumber || NOT_APPLICABLE });
    if (textError) {
      errors.push(fieldError(rowNumber, "text", SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, textError));
    }
    const recordError = validateDocumentRecordFields(values, { required: false, allowYearOnlyRevisionDate: true });
    if (recordError) {
      errors.push(fieldError(rowNumber, "record", SNAPSHOT_ERROR_CODES.SNAPSHOT_INVALID_FIELD, recordError));
    }

    items.push({
      rowNumber,
      sourceRowKey: sourceRowKey || null,
      rowKey: sourceRowKey || null,
      values,
      status: statusParsed.ok ? statusParsed.value : "active"
    });
  }

  return {
    ok: errors.length === 0,
    items,
    errors
  };
}

export function formatCanonicalErrors(errors, { limit = 20 } = {}) {
  const list = Array.isArray(errors) ? errors : [];
  const lines = list.slice(0, limit).map((error) => {
    if (typeof error === "string") return error;
    return `${error.rowNumber}행: ${error.message}`;
  });
  if (list.length > limit) lines.push(`외 ${list.length - limit}건`);
  return lines.join(" / ");
}
