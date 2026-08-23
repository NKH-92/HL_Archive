import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadDocumentFormOptions } from "../src/domains/documents/index.js";
import {
  createDocumentSnapshotExport,
  createDocumentSnapshot,
  finalizeDocumentSnapshotExport,
  getDocumentSnapshotExportPage,
  prepareDocumentSnapshot,
  stageDocumentSnapshotMembership
} from "../src/domains/snapshots/index.js";
import { FREE_TIER_BUDGET } from "../src/freeTierBudget.js";
import { actorFixture } from "./helpers/fixtures.js";
import { createMigratedDatabase } from "./helpers/migratedDatabase.js";
import { sqliteD1 } from "./helpers/sqliteD1.js";

function plan(database, sql) {
  return database.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((row) => String(row.detail || "")).join("\n");
}

test("초기 적재 리허설은 현재 workbook schema 상수를 직접 사용한다", () => {
  const source = readFileSync(new URL("../scripts/rehearse-initial-load.mjs", import.meta.url), "utf8");
  assert.match(source, /EXCEL_SNAPSHOT_SCHEMA_VERSION/);
  assert.match(source, /schemaVersion: EXCEL_SNAPSHOT_SCHEMA_VERSION/);
  assert.doesNotMatch(source, /schemaVersion:\s*\d+/);
});

test("초기 적재 최종 schema는 documents index를 핵심 조회 패턴만 남긴다", async () => {
  const database = await createMigratedDatabase();
  try {
    const indexes = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
        AND tbl_name = 'documents'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all().map((row) => row.name);

    assert.deepEqual(indexes, [
      "idx_documents_current_identity",
      "idx_documents_current_name",
      "idx_documents_current_status_updated",
      "idx_documents_excel_row_key",
      "idx_documents_location_current_state"
    ]);
    assert.match(
      plan(database, "SELECT id FROM documents WHERE sync_state = 'current' AND status = 'active' ORDER BY updated_at DESC, id DESC LIMIT 30"),
      /idx_documents_current_status_updated/
    );
    assert.match(
      plan(database, "SELECT id FROM documents WHERE sync_state = 'current' AND UPPER(document_number) <> 'N/A' AND revision_number IS NOT NULL AND UPPER(document_number) = UPPER('MR-2026-001')"),
      /idx_documents_current_identity/
    );
    assert.match(
      plan(database, "SELECT id FROM documents WHERE sync_state = 'current' AND document_name = '2026년 1분기 제조기록서' COLLATE NOCASE ORDER BY id DESC LIMIT 30"),
      /idx_documents_current_name/
    );
  } finally {
    database.close();
  }
});

test("초기 적재 최종 schema는 rollback shape를 보존하면서 연결·staging index write를 줄인다", async () => {
  const database = await createMigratedDatabase();
  try {
    const documentTagsSql = database.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'document_tags'"
    ).get().sql;
    const membershipSql = database.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'document_snapshot_membership'"
    ).get().sql;
    const snapshotRowsSql = database.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'document_snapshot_rows'"
    ).get().sql;
    assert.match(documentTagsSql, /WITHOUT ROWID/i);
    assert.match(membershipSql, /WITHOUT ROWID/i);
    assert.match(snapshotRowsSql, /id INTEGER GENERATED ALWAYS AS \(row_number\) VIRTUAL/i, "직전 Worker가 읽는 staging id 열은 유지한다");
    assert.match(snapshotRowsSql, /WITHOUT ROWID/i, "30,000행 staging write amplification을 줄인다");

    const removedIndexes = [
      "idx_rack_slots_rack_layout",
      "idx_document_set_items_set",
      "idx_document_snapshot_exclusions_snapshot",
      "idx_document_snapshot_membership_key",
      "idx_document_tags_tag_document",
      "idx_document_snapshot_rows_action",
      "idx_search_projection_category",
      "idx_search_projection_location",
      "idx_search_projection_updated",
      "idx_search_projection_number"
    ];
    for (const name of removedIndexes) {
      assert.equal(
        database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = ?").get(name).count,
        0,
        `${name}은 최종 schema에 남지 않아야 한다`
      );
    }
  } finally {
    database.close();
  }
});

test("검색 cursor generation은 projection 상태와 rollback mirror를 함께 갱신한다", async () => {
  const database = await createMigratedDatabase();
  try {
    const projectionBefore = database.prepare(
      "SELECT generation FROM search_projection_state WHERE id = 1"
    ).get().generation;
    const rollbackMirrorBefore = database.prepare(
      "SELECT generation FROM search_index_state WHERE id = 1"
    ).get().generation;
    assert.equal(projectionBefore, rollbackMirrorBefore);

    database.prepare(`
      UPDATE documents
      SET document_name = document_name || ' 수정'
      WHERE id = (SELECT MIN(id) FROM documents)
    `).run();

    const projectionAfter = database.prepare(
      "SELECT generation FROM search_projection_state WHERE id = 1"
    ).get().generation;
    const rollbackMirrorAfter = database.prepare(
      "SELECT generation FROM search_index_state WHERE id = 1"
    ).get().generation;
    assert.ok(projectionAfter > projectionBefore);
    assert.equal(projectionAfter, rollbackMirrorAfter);
  } finally {
    database.close();
  }
});

test("30,000건 운영 정책은 27,000 경고와 자동 분할 경계를 고정한다", () => {
  assert.equal(FREE_TIER_BUDGET.documentCapacityWarningCount, 27000);
  assert.equal(FREE_TIER_BUDGET.documentCapacityHardCount, 30000);
  assert.equal(FREE_TIER_BUDGET.excelSnapshotMaxItems, 30000);
  assert.equal(FREE_TIER_BUDGET.excelSnapshotDeltaMaxItems, 1000);
  assert.equal(FREE_TIER_BUDGET.searchCandidateMaxItems, 200);
  assert.equal(FREE_TIER_BUDGET.searchResponseMaxItems, 30);
    assert.equal(FREE_TIER_BUDGET.searchRebuildChunkSize, 500);
  assert.equal(FREE_TIER_BUDGET.bootstrapApplyChunkSize, 5000);
  assert.equal(FREE_TIER_BUDGET.initialLoadDailyRowsWrittenStop, 95000);
});

test("용량 trigger는 하드 상한의 다음 current 문서를 원자 차단한다", async () => {
  const database = await createMigratedDatabase();
  try {
    database.prepare(`
      UPDATE capacity_policy
      SET warning_document_count = 2, hard_document_count = 3
      WHERE id = 1
    `).run();
    database.exec(`
      INSERT INTO documents (
        storage_code, category_id, document_number, revision_number, document_name,
        rack_slot_id, rack_face, status, sync_state
      )
      SELECT
        'ARC-CAP-3', category_id, 'CAP-3', 'Rev.0', '용량 경계 문서',
        rack_slot_id, rack_face, 'active', 'current'
      FROM documents
      ORDER BY id
      LIMIT 1;
    `);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM documents WHERE sync_state = 'current'").get().count, 3);
    assert.throws(() => database.exec(`
      INSERT INTO documents (
        storage_code, category_id, document_number, revision_number, document_name,
        rack_slot_id, rack_face, status, sync_state
      )
      SELECT
        'ARC-CAP-4', category_id, 'CAP-4', 'Rev.0', '상한 초과 문서',
        rack_slot_id, rack_face, 'active', 'current'
      FROM documents
      ORDER BY id
      LIMIT 1;
    `), /DOCUMENT_CAPACITY_EXCEEDED/);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM documents WHERE sync_state = 'current'").get().count, 3);
  } finally {
    database.close();
  }
});

test("schema v4 membership은 30,000행 상한에서도 source JSON 재전송을 요구하지 않는다", async () => {
  const database = await createMigratedDatabase();
  const env = { DB: sqliteD1(database), EXCEL_SNAPSHOT_APPLY_MODE: "permissioned" };
  const actor = actorFixture();
  try {
    database.prepare(`
      UPDATE documents
      SET revision_date = COALESCE(revision_date, '2026-01-01'),
          disposal_due_year = COALESCE(disposal_due_year, 2031),
          rack_slot_id = (
            SELECT slot.id
            FROM rack_slots slot
            JOIN racks rack ON rack.id = slot.rack_id
            WHERE slot.is_active = 1 AND rack.is_active = 1
            ORDER BY rack.zone_number, rack.rack_number, slot.column_number, slot.shelf_number
            LIMIT 1
          )
    `).run();
    const exportManifest = await createDocumentSnapshotExport(env, actor);
    assert.equal(exportManifest.schemaVersion, 4);
    assert.equal("documents" in exportManifest, false, "manifest 생성은 문서 전량을 메모리에 적재하지 않는다");
    const exportPage = await getDocumentSnapshotExportPage(env, exportManifest.exportManifestId, 1);
    assert.equal(exportPage.ok, true, exportPage.message);
    assert.equal(exportPage.documents.length, exportManifest.documentCount);
    const finalized = await finalizeDocumentSnapshotExport(env, exportManifest.exportManifestId);
    assert.equal(finalized.ok, true, finalized.message);
    assert.equal(finalized.documentCount, exportManifest.documentCount);
    assert.match(finalized.canonicalExportHash, /^[a-f0-9]{64}$/);
    const exported = {
      ...exportManifest,
      documents: exportPage.documents,
      canonicalExportHash: finalized.canonicalExportHash
    };
    const created = await createDocumentSnapshot(env, {
      sourceName: "membership-v3.xlsx",
      sourceHash: "a".repeat(64),
      sourceSize: 4096,
      syncReason: "schema v4 membership 무변경 검증",
      totalCount: exported.documents.length,
      schemaVersion: 4,
      mode: "managed",
      baseVersion: exported.baseVersion,
      currentSnapshotId: exported.currentSnapshotId || "",
      exportManifestId: exported.exportManifestId,
      canonicalExportHash: exported.canonicalExportHash,
      hasRowKeys: true
    }, actor);
    assert.equal(created.ok, true, created.message);
    const membership = exported.documents.map((document, index) => ({
      rowNumber: index + 2,
      rowKey: document.rowKey,
      baseRowVersion: document.baseRowVersion,
      baseHash: ""
    }));
    const stagedMembership = await stageDocumentSnapshotMembership(env, created.id, membership);
    assert.equal(stagedMembership.ok, true, stagedMembership.message);
    const prepared = await prepareDocumentSnapshot(
      env,
      created.id,
      await loadDocumentFormOptions(env, { activeOnly: true }),
      null,
      actor
    );
    assert.equal(prepared.ok, true, prepared.message);
    assert.equal(Number(prepared.snapshot.staged_count), 0);
    assert.equal(Number(prepared.snapshot.unchanged_count), exported.documents.length);
    assert.equal(Number(prepared.snapshot.update_count), 0);
  } finally {
    database.close();
  }
});

test("구역 cursor는 같은 랙 번호의 export page를 누락·중복 없이 잇는다", async () => {
  const database = await createMigratedDatabase();
  const env = { DB: sqliteD1(database) };
  const actor = actorFixture();
  try {
    database.prepare("UPDATE racks SET is_active = 1 WHERE zone_number = 2 AND rack_number = 1").run();
    database.prepare(`
      UPDATE rack_slots SET is_active = 1
      WHERE rack_id = (SELECT id FROM racks WHERE zone_number = 2 AND rack_number = 1)
    `).run();
    database.prepare(`
      UPDATE documents
      SET rack_slot_id = (
        SELECT slot.id FROM rack_slots slot
        JOIN racks rack ON rack.id = slot.rack_id
        WHERE rack.zone_number = 2 AND rack.rack_number = 1
        ORDER BY slot.column_number, slot.shelf_number LIMIT 1
      )
      WHERE id = (SELECT MAX(id) FROM documents)
    `).run();

    const manifest = await createDocumentSnapshotExport(env, actor);
    database.prepare("UPDATE document_snapshot_export_manifests SET page_size = 1 WHERE manifest_id = ?")
      .run(manifest.exportManifestId);
    const first = await getDocumentSnapshotExportPage(env, manifest.exportManifestId, 1);
    const second = await getDocumentSnapshotExportPage(env, manifest.exportManifestId, 2);
    assert.equal(first.ok, true, first.message);
    assert.equal(second.ok, true, second.message);
    assert.deepEqual([first.documents[0].zoneNumber, second.documents[0].zoneNumber], [1, 2]);
    assert.equal(first.documents[0].rackNumber, second.documents[0].rackNumber);
    assert.notEqual(first.documents[0].rowKey, second.documents[0].rowKey);
    const finalized = await finalizeDocumentSnapshotExport(env, manifest.exportManifestId);
    assert.equal(finalized.ok, true, finalized.message);
    assert.equal(finalized.pageCount, 2);
  } finally {
    database.close();
  }
});
