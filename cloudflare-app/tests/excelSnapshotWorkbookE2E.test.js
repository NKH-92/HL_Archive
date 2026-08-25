import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

import { loadDocumentFormOptions } from "../src/domains/documents/index.js";
import {
  createDocumentSnapshot,
  EXCEL_SNAPSHOT_HEADERS,
  getDocumentSnapshotExport,
  prepareDocumentSnapshot,
  stageDocumentSnapshotMembership,
  stageDocumentSnapshotRows,
  utcDateToDateOnly
} from "../src/domains/snapshots/index.js";
import { FREE_TIER_BUDGET } from "../src/freeTierBudget.js";
import { actorFixture } from "./helpers/fixtures.js";
import { createMigratedDatabase } from "./helpers/migratedDatabase.js";
import { sqliteD1 } from "./helpers/sqliteD1.js";

test("서버 export를 실제 XLSX로 생성·재파싱한 무수정 파일은 0-diff다", async () => {
  const database = await createMigratedDatabase();
  const env = { DB: sqliteD1(database) };
  const actor = actorFixture();
  try {
    database.prepare(`
      UPDATE documents
      SET revision_date = COALESCE(revision_date, '2026-07-20'),
          disposal_due_year = COALESCE(disposal_due_year, 2031)
    `).run();
    database.prepare("UPDATE documents SET revision_date = '2026' WHERE id = (SELECT MIN(id) FROM documents)").run();
    const inactiveDocument = database.prepare(`
      SELECT d.excel_row_key
      FROM documents d
      JOIN rack_slots slot ON slot.id = d.rack_slot_id
      JOIN racks rack ON rack.id = slot.rack_id
      WHERE d.sync_state = 'current'
        AND (rack.is_active = 0 OR slot.is_active = 0)
      LIMIT 1
    `).get();
    assert.ok(inactiveDocument?.excel_row_key, "fixture에 사용 중지된 현재 문서 위치가 있어야 한다");
    const exported = await getDocumentSnapshotExport(env, actor);
    assert.ok(exported.documents.some((document) => document.revisionDate === "2026"));
    assert.ok(exported.documents.some((document) => document.rowKey === inactiveDocument.excel_row_key));
    const workbookBytes = await buildWorkbook(exported);
    const rows = await parseWorkbook(workbookBytes);
    const digest = await crypto.subtle.digest("SHA-256", workbookBytes);
    const sourceHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const created = await createDocumentSnapshot(env, {
      sourceName: "untouched-roundtrip.xlsx",
      sourceHash,
      sourceSize: workbookBytes.byteLength,
      syncReason: "엑셀 무수정 왕복 동기화 검증",
      totalCount: rows.length,
      schemaVersion: exported.schemaVersion,
      mode: "managed",
      baseVersion: exported.baseVersion,
      currentSnapshotId: exported.currentSnapshotId || "",
      exportManifestId: exported.exportManifestId,
      canonicalExportHash: exported.canonicalExportHash,
      hasRowKeys: true
    }, actor);
    assert.equal(created.ok, true, created.message);
    const exportByKey = new Map(exported.documents.map((document) => [document.rowKey, document]));
    for (let index = 0; index < rows.length; index += FREE_TIER_BUDGET.excelSnapshotMembershipChunkSize) {
      const membership = rows.slice(index, index + FREE_TIER_BUDGET.excelSnapshotMembershipChunkSize).map((row) => ({
        rowNumber: row.rowNumber,
        rowKey: row.sourceRowKey,
        baseRowVersion: exportByKey.get(row.sourceRowKey)?.baseRowVersion || "",
        baseHash: ""
      }));
      const staged = await stageDocumentSnapshotMembership(env, created.id, membership);
      assert.equal(staged.ok, true, staged.message);
    }
    const prepared = await prepareDocumentSnapshot(
      env,
      created.id,
      await loadDocumentFormOptions(env, { activeOnly: true }),
      null,
      actor
    );
    assert.equal(prepared.ok, true, prepared.message);
    assert.equal(Number(prepared.snapshot.create_count), 0);
    const unexpectedUpdates = database.prepare("SELECT row_number, changed_fields_json, before_json, after_json FROM document_snapshot_rows WHERE snapshot_id = ? AND action = 'update'").all(created.id);
    assert.equal(Number(prepared.snapshot.update_count), 0, JSON.stringify(unexpectedUpdates));
    assert.equal(Number(prepared.snapshot.exclude_count), 0);
    assert.equal(Number(prepared.snapshot.unchanged_count), exported.documents.length);
    assert.equal(Number(prepared.snapshot.identity_change_count), 0);
  } finally {
    database.close();
  }
});

test("다른 문서는 사용 중지된 현재 문서 위치로 이동할 수 없다", async () => {
  const database = await createMigratedDatabase();
  const env = { DB: sqliteD1(database) };
  const actor = actorFixture();
  try {
    const exported = await getDocumentSnapshotExport(env, actor);
    const inactive = exported.documents.find((document) => {
      const row = database.prepare(`
        SELECT rack.is_active AS rack_active, slot.is_active AS slot_active
        FROM documents d
        JOIN rack_slots slot ON slot.id = d.rack_slot_id
        JOIN racks rack ON rack.id = slot.rack_id
        WHERE d.excel_row_key = ?
      `).get(document.rowKey);
      return Number(row?.rack_active) === 0 || Number(row?.slot_active) === 0;
    });
    const targetIndex = exported.documents.findIndex((document) => document.rowKey !== inactive?.rowKey);
    assert.ok(inactive && targetIndex >= 0, "활성 위치 문서와 사용 중지 위치 문서가 모두 필요하다");

    const rows = exported.documents.map((document, index) => ({
      rowNumber: index + 2,
      sourceRowKey: document.rowKey,
      source: index === targetIndex ? {
        ...document,
        zoneNumber: inactive.zoneNumber,
        rackNumber: inactive.rackNumber,
        rackColumn: inactive.rackColumn,
        shelfNumber: inactive.shelfNumber,
        rackFace: inactive.rackFace
      } : document
    }));
    const created = await createDocumentSnapshot(env, {
      sourceName: "inactive-location-move.xlsx",
      sourceHash: "7".repeat(64),
      sourceSize: 4096,
      syncReason: "사용 중지 위치 이동 차단 검증",
      totalCount: rows.length,
      schemaVersion: exported.schemaVersion,
      mode: "managed",
      baseVersion: exported.baseVersion,
      currentSnapshotId: exported.currentSnapshotId || "",
      exportManifestId: exported.exportManifestId,
      canonicalExportHash: exported.canonicalExportHash,
      hasRowKeys: true
    }, actor);
    assert.equal(created.ok, true, created.message);
    assert.equal((await stageDocumentSnapshotRows(env, created.id, rows)).ok, true);
    const prepared = await prepareDocumentSnapshot(
      env,
      created.id,
      await loadDocumentFormOptions(env, { activeOnly: true }),
      null,
      actor
    );
    assert.equal(prepared.ok, false);
    assert.ok(prepared.errors.some((error) => error.rowNumber === targetIndex + 2 && error.field === "location"));
  } finally {
    database.close();
  }
});

test("사용 중지된 양면 랙의 현재 문서는 면만 바꿀 수 없다", async () => {
  const database = await createMigratedDatabase();
  const env = { DB: sqliteD1(database) };
  const actor = actorFixture();
  try {
    const exported = await getDocumentSnapshotExport(env, actor);
    const inactive = exported.documents.find((document) => {
      const row = database.prepare(`
        SELECT rack.is_active AS rack_active, slot.is_active AS slot_active, rack.is_single_sided
        FROM documents d
        JOIN rack_slots slot ON slot.id = d.rack_slot_id
        JOIN racks rack ON rack.id = slot.rack_id
        WHERE d.excel_row_key = ?
      `).get(document.rowKey);
      return (Number(row?.rack_active) === 0 || Number(row?.slot_active) === 0) && Number(row?.is_single_sided) === 0;
    });
    assert.ok(inactive, "사용 중지된 양면 랙의 현재 문서가 필요하다");

    const rows = exported.documents.map((document, index) => ({
      rowNumber: index + 2,
      sourceRowKey: document.rowKey,
      source: document.rowKey === inactive.rowKey ? {
        ...document,
        rackFace: document.rackFace === "1면" ? "2면" : "1면"
      } : document
    }));
    const created = await createDocumentSnapshot(env, {
      sourceName: "inactive-rack-face-change.xlsx",
      sourceHash: "5".repeat(64),
      sourceSize: 4096,
      syncReason: "사용 중지 위치 면 변경 차단 검증",
      totalCount: rows.length,
      schemaVersion: exported.schemaVersion,
      mode: "managed",
      baseVersion: exported.baseVersion,
      currentSnapshotId: exported.currentSnapshotId || "",
      exportManifestId: exported.exportManifestId,
      canonicalExportHash: exported.canonicalExportHash,
      hasRowKeys: true
    }, actor);
    assert.equal(created.ok, true, created.message);
    assert.equal((await stageDocumentSnapshotRows(env, created.id, rows)).ok, true);
    const prepared = await prepareDocumentSnapshot(
      env,
      created.id,
      await loadDocumentFormOptions(env, { activeOnly: true }),
      null,
      actor
    );
    assert.equal(prepared.ok, false);
    assert.ok(prepared.errors.some((error) => error.field === "location"));
  } finally {
    database.close();
  }
});

test("bootstrap seed 관리 ID는 사용 중지 위치 예외를 얻지 않는다", async () => {
  const database = await createMigratedDatabase();
  const env = { DB: sqliteD1(database) };
  const actor = actorFixture();
  try {
    const exported = await getDocumentSnapshotExport(env, actor);
    const inactive = exported.documents.find((document) => {
      const row = database.prepare(`
        SELECT rack.is_active AS rack_active, slot.is_active AS slot_active
        FROM documents d
        JOIN rack_slots slot ON slot.id = d.rack_slot_id
        JOIN racks rack ON rack.id = slot.rack_id
        WHERE d.excel_row_key = ?
      `).get(document.rowKey);
      return Number(row?.rack_active) === 0 || Number(row?.slot_active) === 0;
    });
    assert.ok(inactive, "사용 중지 위치의 bootstrap seed가 필요하다");

    const created = await createDocumentSnapshot(env, {
      sourceName: "bootstrap-inactive-seed.xlsx",
      sourceHash: "4".repeat(64),
      sourceSize: 4096,
      syncReason: "bootstrap seed 위치 예외 차단 검증",
      totalCount: 1,
      schemaVersion: exported.schemaVersion,
      mode: "bootstrap",
      hasRowKeys: true,
      bootstrapConfirmation: "BOOTSTRAP",
      backupConfirmed: true
    }, actor);
    assert.equal(created.ok, true, created.message);
    assert.equal((await stageDocumentSnapshotRows(env, created.id, [{
      rowNumber: 2,
      sourceRowKey: inactive.rowKey,
      source: inactive
    }])).ok, true);
    const prepared = await prepareDocumentSnapshot(
      env,
      created.id,
      await loadDocumentFormOptions(env, { activeOnly: true }),
      null,
      actor
    );
    assert.equal(prepared.ok, false);
    assert.ok(prepared.errors.some((error) => error.field === "location"));
  } finally {
    database.close();
  }
});

async function buildWorkbook(payload) {
  const workbook = new ExcelJS.Workbook();
  const data = workbook.addWorksheet("문서데이터");
  data.addRow([...EXCEL_SNAPSHOT_HEADERS, "관리 ID"]);
  for (const document of payload.documents) {
    data.addRow([
      document.documentNumber,
      document.revisionNumber,
      utcDate(document.revisionDate),
      document.disposalDueYear,
      document.documentName,
      document.category,
      document.zoneNumber,
      document.rackNumber,
      document.rackColumn,
      document.shelfNumber,
      document.rackFace,
      document.tags,
      document.note,
      document.status,
      document.rowKey
    ]);
  }
  data.getColumn(15).hidden = true;
  const meta = workbook.addWorksheet("_시스템정보", { state: "veryHidden" });
  meta.addRows([
    ["schemaVersion", payload.schemaVersion],
    ["baseVersion", payload.baseVersion],
    ["currentSnapshotId", payload.currentSnapshotId || ""],
    ["exportManifestId", payload.exportManifestId],
    ["canonicalExportHash", payload.canonicalExportHash]
  ]);
  return workbook.xlsx.writeBuffer();
}

async function parseWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const data = workbook.getWorksheet("문서데이터");
  assert.deepEqual(EXCEL_SNAPSHOT_HEADERS.map((_, index) => cellText(data.getCell(1, index + 1))), [...EXCEL_SNAPSHOT_HEADERS]);
  assert.equal(data.getColumn(15).hidden, true);
  return Array.from({ length: data.actualRowCount - 1 }, (_, index) => {
    const rowNumber = index + 2;
    const row = data.getRow(rowNumber);
    return {
      rowNumber,
      sourceRowKey: cellText(row.getCell(15)),
      source: {
        documentNumber: cellText(row.getCell(1)),
        revisionNumber: cellText(row.getCell(2)),
        revisionDate: row.getCell(3).value instanceof Date ? utcDateToDateOnly(row.getCell(3).value) : cellText(row.getCell(3)),
        disposalDueYear: cellText(row.getCell(4)),
        documentName: cellText(row.getCell(5)),
        category: cellText(row.getCell(6)),
        zoneNumber: cellText(row.getCell(7)),
        rackNumber: cellText(row.getCell(8)),
        rackColumn: cellText(row.getCell(9)),
        shelfNumber: cellText(row.getCell(10)),
        rackFace: cellText(row.getCell(11)),
        tags: cellText(row.getCell(12)),
        note: cellText(row.getCell(13)),
        status: cellText(row.getCell(14))
      }
    };
  });
}

function utcDate(value) {
  if (/^\d{4}$/.test(String(value))) return String(value);
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function cellText(cell) {
  const value = cell?.value;
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
