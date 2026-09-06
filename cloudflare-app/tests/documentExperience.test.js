import assert from "node:assert/strict";
import test from "node:test";

import { handleCreateDocument, handleDocumentRoute, renderCreateDocument } from "../src/handlers/documents/crud.js";
import { handleDocumentMove } from "../src/handlers/movementHandlers.js";
import { documentLink, documentReturnTo } from "../src/shared/documents/navigation.js";
import { actorFixture } from "./helpers/fixtures.js";
import { createMigratedDatabase } from "./helpers/migratedDatabase.js";
import { sqliteD1 } from "./helpers/sqliteD1.js";

test("문서 복귀는 검색 조건만 보존하고 외부 주소·다른 업무·선택 상태를 거부한다", () => {
  for (const value of ["https://example.com/app", "//example.com/app", "/\\example.com/app", "/admin/users", "/app\n"]) {
    assert.equal(documentReturnTo(value), "");
  }
  const path = documentReturnTo("/documents?q=PV&zone=1&rack=3&face=B&column=2&shelf=1&sort=location&selected=7&page=3&status=disposed");
  assert.equal(path, "/app?q=PV&zone=1&rack=3&face=B&column=2&shelf=1&sort=location");
  const url = new URL(documentLink(7, "edit", path), "https://archive.local");
  assert.equal(url.pathname, "/documents/7/edit");
  assert.equal(url.searchParams.get("returnTo"), path);
});

test("저장 후 다음 등록은 선택한 분류·위치만 이어가고 문서 식별값을 비운다", async (context) => {
  const database = await createMigratedDatabase();
  context.after(() => database.close());
  const env = { DB: sqliteD1(database) };
  const actor = actorFixture();
  const category = database.prepare("SELECT id FROM categories WHERE is_active = 1 LIMIT 1").get();
  const slot = database.prepare("SELECT rs.id FROM rack_slots rs JOIN racks r ON r.id = rs.rack_id WHERE rs.is_active = 1 AND r.is_active = 1 LIMIT 1").get();
  for (const retain of [false, true]) {
    const fields = {
      categoryId: String(category.id), rackSlotId: String(slot.id), rackFace: "A",
      documentNumber: `UX-NEXT-${Number(retain)}`, revisionNumber: "Rev.2", documentName: "연속 등록 검증",
      revisionDate: "2026-09-01", disposalDueYear: "2031", note: "이어가면 안 되는 비고",
      submitAction: "saveAndNext", returnTo: "/app?q=UX", retainCategory: retain ? "1" : "", retainLocation: retain ? "1" : ""
    };
    const response = await handleCreateDocument(new Request("https://archive.local/documents", { method: "POST", body: new URLSearchParams(fields) }), env, actor);
    assert.equal(response.status, 302);
    const next = new URL(response.headers.get("Location"), "https://archive.local");
    assert.equal(next.pathname, "/documents/new");
    assert.equal(next.searchParams.get("continuing"), "1");
    assert.equal(next.searchParams.has("categoryId"), retain);
    assert.equal(next.searchParams.has("rackSlotId"), retain);
    assert.equal(next.searchParams.get("returnTo"), "/app?q=UX");
    for (const key of ["documentNumber", "documentName", "revisionNumber", "revisionDate", "note", "tagIds"]) assert.equal(next.searchParams.has(key), false);
    const html = await (await renderCreateDocument(env, actor, Object.fromEntries(next.searchParams))).text();
    assert.match(html, /name="documentNumber" value=""/);
    assert.match(html, /name="revisionNumber" value=""/);
    assert.doesNotMatch(html, /이어가면 안 되는 비고/);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM documents WHERE document_number = ?").get(fields.documentNumber).count, 1);
  }
});

test("개정·이동 충돌은 입력과 원래 버전을 보존하며 최신 문서를 덮어쓰지 않는다", async (context) => {
  const database = await createMigratedDatabase();
  context.after(() => database.close());
  const env = { DB: sqliteD1(database) };
  const actor = actorFixture();
  database.prepare("UPDATE documents SET revision_date = '2026-01-10', disposal_due_year = 2031, row_version = 9 WHERE id = 1").run();
  const original = database.prepare("SELECT * FROM documents WHERE id = 1").get();
  const shared = { expectedRowVersion: "2", expectedUpdatedAt: "2000-01-01", returnTo: "/app?q=PV" };
  const revision = await handleDocumentRoute(new Request("https://archive.local/documents/1/revise", {
    method: "POST", body: new URLSearchParams({ ...shared, revisionNumber: "Rev.99", revisionDate: "2026-09-01", confirmReplacement: "1" })
  }), env, actor, { id: 1, action: "revise" });
  const revisionHtml = await revision.text();
  assert.match(revisionHtml, /data-error-summary/);
  assert.match(revisionHtml, /name="expectedRowVersion" value="2"/);
  assert.match(revisionHtml, /name="revisionNumber" value="Rev.99"/);
  const movement = await handleDocumentMove(new Request("https://archive.local/documents/1/move", {
    method: "POST", body: new URLSearchParams({ ...shared, rackSlotId: String(original.rack_slot_id), rackFace: original.rack_face, reason: "입력 보존 검증" })
  }), env, actor, 1);
  const movementHtml = await movement.text();
  assert.match(movementHtml, /data-error-summary/);
  assert.match(movementHtml, /name="expectedRowVersion" value="2"/);
  assert.match(movementHtml, /입력 보존 검증/);
  assert.deepEqual(database.prepare("SELECT * FROM documents WHERE id = 1").get(), original);
});
