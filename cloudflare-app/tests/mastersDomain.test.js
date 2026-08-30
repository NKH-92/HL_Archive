import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as masters from "../src/domains/masters/index.js";
import { validateMasterValues } from "../src/domains/masters/domain/policy.js";
import { parseCategoryForm, parseTagForm } from "../src/domains/masters/web/forms.js";

test("masters form parser와 validation은 HTTP 입력을 정규화하고 기존 메시지를 유지한다", () => {
  const category = parseCategoryForm(form({ name: "  품질  ", description: " 설명 ", sortOrder: "4", isActive: "1", expectedRowVersion: "7" }), 3);
  assert.deepEqual(category, { id: 3, name: "품질", description: "설명", sortOrder: 4, isActive: true, expectedRowVersion: 7 });
  assert.deepEqual(parseTagForm(form({ name: " 태그 " }), 0), { id: 0, name: "태그", description: "", isActive: true });
  assert.deepEqual(validateMasterValues("category", { name: "" }), {
    ok: false,
    message: "카테고리 이름은 필수입니다.",
    values: { id: 0, name: "", description: "", isActive: true, sortOrder: 0 }
  });
  assert.equal(validateMasterValues("category", { id: 3, name: "품질", isActive: true }).ok, false);
});

test("masters 공개 API는 query·command·view를 한 경계에서 제공한다", () => {
  for (const name of ["getCategories", "getActiveCategories", "getTags", "getActiveTags", "upsertCategory", "deleteCategory", "upsertTag", "deleteTag"]) {
    assert.equal(typeof masters[name], "function", name);
  }
  assert.equal(typeof masters.categoriesPage, "function");
  assert.equal(typeof masters.tagsPage, "function");
});

test("masters 수정·사용중지 폼은 동일한 expectedRowVersion을 제출한다", async () => {
  const response = masters.categoriesPage({
    session: { username: "admin", displayName: "관리자", role: "Admin", csrfToken: "csrf-token-123" },
    categories: [{ id: 3, name: "품질", description: "", sort_order: 1, is_active: 1, row_version: 7 }]
  });
  const html = await response.text();
  assert.equal((html.match(/name="expectedRowVersion" value="7"/g) || []).length, 2);
});

test("대분류 관리는 정렬 숫자 대신 필요한 기능과 확장 가능한 목록을 제공한다", async () => {
  const response = masters.categoriesPage({
    session: { username: "admin", displayName: "관리자", role: "Admin", csrfToken: "csrf-token-123" },
    categories: [
      { id: 3, name: "제조", description: "제조 문서", sort_order: 30, is_active: 1, row_version: 7 },
      { id: 4, name: "품질", description: "품질 문서", sort_order: 10, is_active: 0, row_version: 8 }
    ]
  });
  const html = await response.text();

  assert.match(html, /class="page-head master-page-head"/);
  assert.match(html, /<strong>필요한 기능<\/strong>/);
  assert.match(html, /찾기 · 추가 · 이름과 설명 수정 · 사용중지와 다시 사용/);
  assert.match(html, /data-master-search/);
  assert.match(html, /data-master-inactive-toggle/);
  assert.match(html, /data-master-row data-master-active="true"/);
  assert.match(html, /data-master-row data-master-active="false"/);
  assert.match(html, /type="hidden" name="sortOrder" value="30"/);
  assert.doesNotMatch(html, /정렬 순서|type="number"/);
  assert.match(html, /사용중지하면 새 문서 등록 화면에서만 숨겨지며 기존 문서에는 그대로 남습니다/);
  assert.match(html, /다시 사용하면 새 문서 등록과 대분류 선택 목록에 표시됩니다/);
});

test("태그 수정 입력란은 각 태그 이름을 포함한 접근 가능한 이름을 제공한다", async () => {
  const response = masters.tagsPage({
    session: { username: "admin", displayName: "관리자", role: "Admin", csrfToken: "csrf-token-123" },
    tags: [{ id: 3, name: "중요문서", description: "우선 관리", is_active: 1, row_version: 7 }]
  });
  const html = await response.text();

  assert.match(html, /name="name" value="중요문서" aria-label="중요문서 태그 이름"/);
  assert.match(html, /name="description" value="우선 관리" aria-label="중요문서 태그 설명"/);
});

test("masters의 SQL은 infrastructure에만 존재한다", async () => {
  const nonInfrastructure = [
    "../src/domains/masters/domain/policy.js",
    "../src/domains/masters/application/service.js",
    "../src/domains/masters/web/forms.js",
    "../src/domains/masters/web/handlers.js",
    "../src/domains/masters/web/views.js",
    "../src/domains/masters/service.js",
    "../src/domains/masters/index.js"
  ];
  for (const relative of nonInfrastructure) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\b(?:SELECT|INSERT|UPDATE|DELETE)\s+(?:INTO|FROM|[a-z_])/i, relative);
  }
});

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
