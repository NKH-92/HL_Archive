import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createMigratedDatabase, migrationFiles } from "./helpers/migratedDatabase.js";

const CORE_TABLES = [
  "app_users",
  // 0051에서 runtime 미사용 legacy bootstrap job table을 제거했다.
  "bootstrap_runtime_control",
  "capacity_policy",
  "document_capacity_state",
  "categories",
  "disposal_batch_items",
  "disposal_batches",
  "disposal_logs",
  "document_audit_logs",
  "document_import_items",
  "document_import_jobs",
  "document_movements",
  "document_revision_links",
  "document_set_items",
  "document_set_logs",
  "document_sets",
  "document_snapshot_exclusions",
  "document_snapshot_export_manifests",
  "document_snapshot_export_pages",
  "document_snapshot_membership",
  "document_snapshot_rows",
  "document_snapshots",
  "document_sync_state",
  "document_tags",
  "documents",
  "floor_plan_regions",
  "identity_security_remediations",
  "login_throttle",
  "login_throttle_v2",
  "rack_slots",
  "racks",
  "search_clicks",
  // 0049에서 search_event_clock·search_index_outbox를 제거했다. 0050부터 cursor는 projection state를
  // 사용하고 search_index_state는 이전 Worker rollback용 generation mirror로만 남는다.
  "search_index_state",
  "search_logs",
  // Core projection: 검색 FTS5를 Core D1 안에 두어 크로스 DB 보상 계층을 제거한다.
  // *_fts_* 는 external content FTS5의 shadow table이다.
  "search_projection_dirty",
  "search_projection_documents",
  "search_projection_fts",
  "search_projection_fts_config",
  "search_projection_fts_data",
  "search_projection_fts_docsize",
  "search_projection_fts_idx",
  "search_projection_state",
  "system_audit_logs",
  "tags",
  // 애플리케이션 MFA는 0044에서 제거했고 0051에서 dead storage까지 정리했다.
  "user_role_templates"
].sort();

const IMMUTABILITY_TRIGGERS = [
  "trg_category_row_version_compat",
  "trg_category_sync_version_delete",
  "trg_category_sync_version_insert",
  "trg_category_sync_version_update",
  "trg_disposal_logs_no_update",
  "trg_demo_readonly_user_insert_guard",
  "trg_demo_readonly_user_update_guard",
  "trg_document_audit_logs_no_delete",
  "trg_document_audit_logs_no_update",
  "trg_document_capacity_insert",
  "trg_document_capacity_reinclude",
  "trg_document_capacity_state_delete",
  "trg_document_capacity_state_insert",
  "trg_document_capacity_state_update",
  "trg_document_excel_row_key",
  "trg_document_movements_no_delete",
  "trg_document_movements_no_update",
  "trg_document_revision_links_no_delete",
  "trg_document_revision_links_no_update",
  "trg_document_set_logs_no_delete",
  "trg_document_set_logs_no_update",
  "trg_document_set_row_version_compat",
  "trg_document_sync_version_delete",
  "trg_document_sync_version_insert",
  "trg_document_sync_version_update",
  "trg_document_tag_sync_version_delete",
  "trg_document_tag_sync_version_insert",
  "trg_identity_security_remediations_no_delete",
  "trg_identity_security_remediations_no_update",
  "trg_rack_row_version_compat",
  "trg_rack_slot_sync_version_delete",
  "trg_rack_slot_sync_version_insert",
  "trg_rack_slot_sync_version_update",
  "trg_rack_sync_version_delete",
  "trg_rack_sync_version_insert",
  "trg_rack_sync_version_update",
  "trg_revision_linked_document_no_delete",
  "trg_revision_linked_identity_no_update",
  "trg_revision_previous_no_restore",
  // 0049: trg_search_clock_* 12개와 trg_search_outbox_* 5개는 제거했다. 파생 색인 신호는
  // projection dirty 큐 하나로 모인다.
  // Core projection dirty 큐. 색인 본문은 JS(n-gram·초성)가 만들므로 trigger는 대상 표시만 한다.
  "trg_search_projection_document_delete",
  "trg_search_projection_document_insert",
  "trg_search_projection_document_tag_delete",
  "trg_search_projection_document_tag_insert",
  "trg_search_projection_document_update",
  // 0047/0048: reference 이름 변경은 전체 재구축(trg_search_rebuild_*) 대신 영향 문서만 표시한다.
  // 0049에서 outbox·clock 쓰기를 걷어냈고 0050은 projection/legacy cursor generation dual-write와 dirty 표시만 남긴다.
  "trg_search_scope_category_update",
  "trg_search_scope_rack_slot_update",
  "trg_search_scope_rack_update",
  "trg_search_scope_tag_update",
  "trg_security_review_no_approval",
  "trg_system_audit_logs_no_delete",
  "trg_system_audit_logs_no_update",
  "trg_system_role_template_no_delete",
  "trg_system_role_template_no_update",
  "trg_tag_row_version_compat",
  "trg_tag_sync_version_delete",
  "trg_tag_sync_version_insert",
  "trg_tag_sync_version_update",
  "trg_user_enable_requires_epoch_rotation",
  "trg_user_status_session_epoch_compat",
  "trg_bootstrap_lock_categories_delete",
  "trg_bootstrap_lock_categories_insert",
  "trg_bootstrap_lock_categories_update",
  "trg_bootstrap_lock_document_tags_delete",
  "trg_bootstrap_lock_document_tags_insert",
  "trg_bootstrap_lock_documents_delete",
  "trg_bootstrap_lock_documents_insert",
  "trg_bootstrap_lock_documents_update",
  "trg_bootstrap_lock_rack_slots_delete",
  "trg_bootstrap_lock_rack_slots_insert",
  "trg_bootstrap_lock_rack_slots_update",
  "trg_bootstrap_lock_racks_delete",
  "trg_bootstrap_lock_racks_insert",
  "trg_bootstrap_lock_racks_update",
  "trg_bootstrap_lock_tags_delete",
  "trg_bootstrap_lock_tags_insert",
  "trg_bootstrap_lock_tags_update"
].sort();

test("migration 번호는 연속이고 released baseline의 모든 공개 이력을 보존한다", async () => {
  const migrations = await validatedMigrationFiles();
  const baseline = JSON.parse(await readFile(new URL("../migrations/released-baseline.json", import.meta.url), "utf8"));
  const releasedNumber = Number(String(baseline.releasedThrough).slice(0, 4));

  const numbers = migrations.map(({ number }) => number);
  const expected = Array.from({ length: migrations.at(-1).number }, (_, index) => index + 1);
  assert.deepEqual(numbers, expected, "migration 번호는 0001부터 연속이어야 한다");
  assert.ok(releasedNumber > 0 && releasedNumber <= migrations.at(-1).number);
  assert.deepEqual(
    migrations.slice(0, releasedNumber).map(({ name }) => name),
    Object.keys(baseline.checksums).slice(0, releasedNumber),
    "released baseline에 공개된 migration은 삭제·재번호화할 수 없다"
  );
  assert.equal(migrations[releasedNumber - 1].name, baseline.releasedThrough);
});

test("전체 migration을 순차 적용하면 핵심 schema와 FK 무결성이 유지된다", async () => {
  const database = await createMigratedDatabase();

  try {
    assert.equal(database.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);

    const tables = database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all().map(({ name }) => name);
    const triggers = database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'trigger'
      ORDER BY name
    `).all().map(({ name }) => name);

    assert.equal(tables.length, CORE_TABLES.length, "핵심 업무 테이블 수");
    assert.deepEqual(tables, CORE_TABLES);
    assert.equal(triggers.length, IMMUTABILITY_TRIGGERS.length, "감사·이력·동기화 trigger 수");
    assert.deepEqual(triggers, IMMUTABILITY_TRIGGERS);
  } finally {
    database.close();
  }
});

async function validatedMigrationFiles() {
  const migrations = (await migrationFiles()).map(({ name, number }) => {
    const match = name.match(/^(\d{4})_[a-z0-9_]+\.sql$/);
    assert.ok(match, `migration 파일명 형식 오류: ${name}`);
    assert.equal(number, Number(match[1]));
    return { name, number };
  }).sort((left, right) => left.number - right.number || left.name.localeCompare(right.name));

  const duplicateNumbers = migrations
    .filter((migration, index) => index > 0 && migration.number === migrations[index - 1].number)
    .map(({ number }) => String(number).padStart(4, "0"));
  assert.deepEqual(duplicateNumbers, [], "migration 번호 중복");
  return migrations;
}

test("권한 migration은 disabled 상태·업무 권한·전역 감사를 도입한 이력을 보존한다", async () => {
  const sql = await readFile(new URL("../migrations/0021_permissions_and_system_audit.sql", import.meta.url), "utf8");
  const permissionColumns = [
    "can_manage_documents",
    "can_move_documents",
    "can_manage_disposals",
    "can_manage_sets",
    "can_manage_masters",
    "can_manage_users",
    "can_view_audit"
  ];
  assert.match(sql, /status IN \('pending', 'approved', 'rejected', 'disabled'\)/);
  for (const column of permissionColumns) assert.match(sql, new RegExp(`${column} INTEGER NOT NULL DEFAULT 0`));
  assert.match(sql, /CASE WHEN role = 'Admin' THEN 1 ELSE 0 END/);
  assert.match(sql, /CREATE TABLE system_audit_logs/);
  assert.match(sql, /CREATE INDEX idx_system_audit_entity/);
  assert.match(sql, /CREATE TRIGGER trg_system_audit_logs_no_update/);
  assert.match(sql, /CREATE TRIGGER trg_system_audit_logs_no_delete/);
  assert.match(sql, /ALTER TABLE document_audit_logs ADD COLUMN actor_user_id INTEGER/);
  assert.match(sql, /ALTER TABLE document_audit_logs ADD COLUMN actor_username TEXT/);
  assert.doesNotMatch(sql, /actor_user_id[^;]*REFERENCES app_users/is);
});

test("권한 migration은 기존 Admin을 보존하고 disabled 사용자를 저장할 수 있다", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    for (const migration of [
      "0001_initial.sql",
      "0002_app_users.sql",
      "0003_document_audit_logs.sql",
      "0006_app_user_roles_and_admin.sql"
    ]) {
      database.exec(await readFile(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
    }
    database.prepare(`
      INSERT INTO app_users (username, display_name, password_salt, password_hash, status, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("admin", "관리자", "salt", "hash", "approved", "Admin");
    database.exec(await readFile(new URL("../migrations/0021_permissions_and_system_audit.sql", import.meta.url), "utf8"));
    database.prepare(`
      INSERT INTO app_users (username, display_name, password_salt, password_hash, status, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("disabled-user", "중지 사용자", "salt", "hash", "disabled", "User");

    const admin = database.prepare(`
      SELECT can_manage_documents, can_move_documents, can_manage_disposals,
             can_manage_sets, can_manage_masters, can_manage_users, can_view_audit
      FROM app_users WHERE username = 'admin'
    `).get();
    assert.deepEqual(Object.values(admin), [1, 1, 1, 1, 1, 1, 1]);
    assert.equal(database.prepare("SELECT status FROM app_users WHERE username = 'disabled-user'").get().status, "disabled");
    assert.ok(database.prepare("PRAGMA table_info(document_audit_logs)").all().some((column) => column.name === "actor_user_id"));
  } finally {
    database.close();
  }
});

test("과거 영구 release-smoke 계정은 최종 schema에서 격리된 상태다", async () => {
  const database = await createMigratedDatabase();
  try {
    const user = database.prepare(`
      SELECT status, role, must_change_password,
             can_manage_documents, can_move_documents, can_manage_disposals,
             can_manage_sets, can_manage_masters, can_manage_users, can_view_audit
      FROM app_users
      WHERE username = 'release-smoke@hanlim.internal'
    `).get();
    assert.deepEqual({ ...user }, {
      status: "rejected",
      role: "User",
      must_change_password: 1,
      can_manage_documents: 0,
      can_move_documents: 0,
      can_manage_disposals: 0,
      can_manage_sets: 0,
      can_manage_masters: 0,
      can_manage_users: 0,
      can_view_audit: 0
    });
  } finally {
    database.close();
  }
});
