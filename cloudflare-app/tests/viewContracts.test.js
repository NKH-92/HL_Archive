import assert from "node:assert/strict";
import test from "node:test";

import { dataQualityPage } from "../src/domains/dataQuality/index.js";
import { loginPage } from "../src/views/authViews.js";
import { adminDashboardPage, passwordPage, userPasswordResetPage } from "../src/views/adminViews.js";
import { disposalBatchFormPage, disposalBatchListPage, periodicDisposalPage } from "../src/views/disposalBatchViews.js";
import { documentImportJobCreatePage, documentImportJobsPage } from "../src/views/importJobViews.js";
import { canMoveDocuments, movementFormPage, movementsPage } from "../src/views/movementViews.js";
import { rackConfigurePage, rackDetailsPage, rackFormPage, racksPage } from "../src/views/rackViews.js";
import { searchReportPage } from "../src/views/searchViews.js";
import { setClonePage, setFormPage, setsPage } from "../src/views/setViews.js";
import { documentSnapshotDetailPage, documentSnapshotPage } from "../src/views/snapshotViews.js";

const CSRF_TOKEN = "view-contract-csrf-token-1234567890";
const admin = { username: "admin@hanlim.com", displayName: "관리자", role: "Admin", csrfToken: CSRF_TOKEN };
const viewer = { username: "viewer@hanlim.com", displayName: "조회자", role: "User", csrfToken: CSRF_TOKEN };

test("로그인과 최초 비밀번호 변경 화면은 등록 이메일·보안 폼 계약을 유지한다", async () => {
  const login = await htmlPage(loginPage({
    returnUrl: `/app?next="><script>alert(1)</script>`,
    error: "",
    setupWarning: `<img src=x onerror=alert(1)>`,
  }), "로그인");

  assert.match(login, /등록된 사내 이메일 계정만 로그인할 수 있습니다/);
  assert.match(login, /<input name="username" type="email" autocomplete="username" required>/);
  assertPostForm(login, "/login", ["returnUrl", "username", "password"], { csrf: false });
  assert.doesNotMatch(login, /href="\/signup"/);
  assert.doesNotMatch(login, /<img src=x|<script>alert\(1\)<\/script>/);
  assert.match(login, /&lt;img src=x onerror=alert\(1\)&gt;/);

  const password = await htmlPage(passwordPage({ session: admin, required: true }), "비밀번호 변경");
  assert.match(password, /최초 로그인입니다/);
  assert.match(password, /<dialog[^>]+id="required-password-change"[^>]+open[^>]+data-auto-open-modal[^>]+data-forced-modal/);
  assert.match(password, /첫 로그인 비밀번호 변경/);
  assert.doesNotMatch(password, /data-close-modal/);
  assertPostForm(password, "/account/password", ["currentPassword", "newPassword", "confirmPassword"]);
});

test("관리자 비밀번호 초기화 화면은 세션 종료와 다음 로그인 변경 강제를 명시한다", async () => {
  const html = await htmlPage(userPasswordResetPage({
    session: admin,
    user: {
      id: 7,
      username: "target<script>@hanlim.com",
      display_name: "초기화 <대상>"
    },
    minLength: 6
  }), "비밀번호 초기화");

  assertPostForm(
    html,
    "/admin/users/7/reset-password",
    ["temporaryPassword", "confirmPassword", "confirmReset"]
  );
  assert.match(html, /기존 로그인 세션이 모두 종료됩니다/);
  assert.match(html, /새 비밀번호로 변경해야만 시스템을 이용/);
  assert.match(html, /minlength="6"/);
  assert.match(html, /target&lt;script&gt;@hanlim\.com/);
  assert.doesNotMatch(html, /target<script>@hanlim\.com/);
});

test("관리자 dashboard는 전문 도구를 권한별 고급 영역에 두고 엑셀 동기화를 일반 관리 영역에 유지한다", async () => {
  const documentManager = { ...viewer, can_manage_documents: true };
  const documentHtml = await htmlPage(adminDashboardPage({
    session: documentManager,
    pendingCount: 0
  }), "운영 관리");
  assert.match(documentHtml, /<section class="panel management-section is-advanced">/);
  assert.match(documentHtml, /관리자 고급 도구[\s\S]*<span class="count-badge">고급<\/span>/);
  assert.match(documentHtml, /href="\/document-import-jobs"[\s\S]*CSV 가져오기/);
  assert.match(documentHtml, /href="\/admin\/data-quality"[\s\S]*데이터 품질/);
  assert.match(documentHtml, /데이터 및 감사[\s\S]*href="\/documents\/import"[\s\S]*엑셀 대장 동기화/);
  assert.doesNotMatch(documentHtml, /href="\/sets"|href="\/admin\/search-report"/);

  const setHtml = await htmlPage(adminDashboardPage({
    session: { ...viewer, can_manage_sets: true },
    pendingCount: 0
  }), "운영 관리");
  assert.match(setHtml, /관리자 고급 도구[\s\S]*href="\/sets"[\s\S]*준비 문서 세트/);
  assert.doesNotMatch(setHtml, /href="\/document-import-jobs"|href="\/admin\/data-quality"|href="\/admin\/search-report"/);

  const auditHtml = await htmlPage(adminDashboardPage({
    session: { ...viewer, can_view_audit: true },
    pendingCount: 0
  }), "운영 관리");
  assert.match(auditHtml, /관리자 고급 도구[\s\S]*href="\/admin\/search-report"[\s\S]*검색 리포트/);
  assert.doesNotMatch(auditHtml, /href="\/document-import-jobs"|href="\/admin\/data-quality"|href="\/sets"/);
});

test("랙 목록·설정·상세·폼은 위치 구조와 입력 계약을 공개 배럴에서 유지한다", async () => {
  const list = await htmlPage(racksPage({
    session: admin,
    racks: [{ id: 7, zone_number: 1, rack_number: 2, code: `1-02<script>bad()</script>`, is_single_sided: 0, active_document_count: 3 }]
  }), "랙 관리");
  assert.match(list, /<h1>보관 랙 목록<\/h1>/);
  assert.match(list, /href="\/racks\/7"/);
  assert.match(list, /1-02&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(list, /<script>bad\(\)<\/script>/);

  const configure = await htmlPage(rackConfigurePage({ session: admin, counts: { 1: 2, 2: 3, 3: 4 }, expectedVersion: 41 }), "랙 설정");
  assertPostForm(configure, "/racks/configure", ["zone1Count", "zone2Count", "zone3Count", "expectedVersion"]);
  assert.match(configure, /name="expectedVersion" value="41"/);

  const details = await htmlPage(rackDetailsPage({
    session: admin,
    rack: { id: 7, code: "1-02", zone_number: 1, rack_number: 2, is_single_sided: 0, column_count: 7, shelf_count: 6 },
    documents: [],
    grid: [],
    selectedFace: "B"
  }), "1-02 랙");
  assert.match(details, /role="grid" aria-rowcount="6" aria-colcount="7"/);
  assert.match(details, /2-2면 위치 격자/);
  assert.match(details, /<span>1열<\/span><strong>면을 바라본 모습<\/strong><span>7열<\/span>/);
  assert.ok(details.indexOf(">1열 · 6선반<") < details.indexOf(">7열 · 6선반<"));
  assert.ok(details.indexOf(">1열 · 6선반<") < details.indexOf(">1열 · 1선반<"));
  assert.match(details, /왼쪽부터 1열, 아래부터 1선반/);
  assert.doesNotMatch(details, /오른쪽이 1열|1열 오른쪽|통로 안쪽/);
  assert.match(details, /href="\/racks\/7\/edit"/);

  const form = await htmlPage(rackFormPage({
    session: admin,
    action: "/racks",
    title: "랙 추가",
    values: { zoneNumber: 2, rackNumber: 8, name: `<b>위험</b>`, description: `설명 <script>x</script>` }
  }), "랙 추가");
  assertPostForm(form, "/racks", ["zoneNumber", "rackNumber", "name", "description", "isSingleSided", "isActive"]);
  assert.match(form, /value="&lt;b&gt;위험&lt;\/b&gt;"/);
  assert.match(form, /랙 번호는 구역마다 1번부터 별도로 사용합니다/);
  assert.doesNotMatch(form, /<script>x<\/script>/);

  const editForm = await htmlPage(rackFormPage({
    session: admin,
    action: "/racks/7/edit",
    title: "랙 수정",
    values: { id: 7, zone_number: 1, rack_number: 2, row_version: 6, is_active: 1 }
  }), "랙 수정");
  assertPostForm(editForm, "/racks/7/edit", ["expectedRowVersion", "zoneNumber", "rackNumber"]);
  assert.match(editForm, /name="expectedRowVersion" value="6"/);
});

test("위치 이동 화면은 권한 판정·낙관적 잠금·이력 escape 계약을 유지한다", async () => {
  const mover = { ...viewer, can_move_documents: true };
  assert.equal(canMoveDocuments(mover), true);
  assert.equal(canMoveDocuments(viewer), false);

  const document = {
    id: 11,
    document_number: `DOC-11<script>x</script>`,
    document_name: `이동 <img src=x>`,
    rack_slot_id: 3,
    rack_face: "A",
    rack_code: "1-02",
    zone_number: 1,
    rack_number: 2,
    is_single_sided: 0,
    column_number: 3,
    shelf_number: 4,
    updated_at: "2026-07-17 12:00:00",
    row_version: 9
  };
  const slots = [{ id: 3, zone_number: 1, rack_number: 2, column_number: 3, shelf_number: 4, is_single_sided: 0, label: "1구역 <위치>" }];
  const form = await htmlPage(movementFormPage({ session: mover, document, slots, values: { reason: `<script>이유</script>` } }), "문서 위치 이동");
  assertPostForm(form, "/documents/11/move", ["expectedUpdatedAt", "expectedRowVersion", "rackSlotId", "rackFace", "reason"]);
  assert.match(form, /name="expectedRowVersion" value="9"/);
  assert.match(form, /1구역 &lt;위치&gt;/);
  assert.doesNotMatch(form, /<script>이유<\/script>|<img src=x>/);

  const history = await htmlPage(movementsPage({
    session: mover,
    query: `담당자"><script>x</script>`,
    result: {
      page: 1,
      totalPages: 1,
      items: [{
        document_id: 11,
        created_at: "2026-07-17",
        document_number_snapshot: "DOC-11",
        from_location_snapshot: "1구역 2-1",
        to_location_snapshot: "2구역 <새 위치>",
        reason: `<img src=x onerror=1>`,
        performed_by_name: "담당자",
        performed_by_username: "user@hanlim.com"
      }]
    }
  }), "위치 이동 이력");
  assertGetForm(history, "/admin/movements", ["q"]);
  assert.match(history, /2구역 &lt;새 위치&gt;/);
  assert.match(history, /&lt;img src=x onerror=1&gt;/);
  assert.doesNotMatch(history, /<img src=x onerror=1>/);
});

test("데이터 품질과 검색 리포트는 작업 링크·집계·사용자 값 escape 계약을 유지한다", async () => {
  const quality = await htmlPage(dataQualityPage({
    session: admin,
    result: {
      issues: [{ key: "missing-location", label: "누락 <위치>" }],
      issue: "missing-location",
      label: "누락 위치",
      totalItems: 1,
      page: 1,
      totalPages: 1,
      items: [{
        id: 21,
        document_number: "DOC-21",
        revision_number: "R1",
        document_name: `<script>품질</script>`,
        category_name: "분류",
        status: "active"
      }]
    }
  }), "데이터 품질");
  assert.match(quality, /aria-label="데이터 품질 문제 유형"/);
  assert.match(quality, /href="\/admin\/data-quality\?issue=missing-location" class="chip active"/);
  assert.match(quality, /href="\/documents\/21\/edit"/);
  assert.match(quality, /&lt;script&gt;품질&lt;\/script&gt;/);

  const report = await htmlPage(searchReportPage({
    session: admin,
    report: {
      topQueries: [{ query_text: `<svg onload=1>`, hits: 4, last_result_count: 2, last_searched_at: "2026-07-17" }],
      failedQueries: [{ query_text: `실패"><img src=x>`, hits: 3, last_searched_at: "2026-07-17" }],
      topDocuments: [{ id: 8, document_number: "DOC-8", document_name: `<b>문서</b>`, click_count: 5 }]
    }
  }), "검색 리포트");
  assert.match(report, /자주 찾는 검색어/);
  assert.match(report, /결과 없는 검색어/);
  assert.match(report, /href="\/documents\/8"/);
  assert.match(report, /&lt;svg onload=1&gt;|&lt;b&gt;문서&lt;\/b&gt;/);
  assert.doesNotMatch(report, /<svg onload=1>|<img src=x>|<b>문서<\/b>/);
});

test("준비 문서 세트 목록과 생성 폼은 관리 권한에 따른 동작 노출을 유지한다", async () => {
  const manager = { ...viewer, can_manage_sets: true };
  const fixture = [{ id: 4, name: `<b>감사 세트</b>`, description: `설명 <script>x</script>`, document_count: 2, disposed_count: 1 }];
  const managed = await htmlPage(setsPage({ session: manager, sets: fixture, filters: { q: "감사", status: "disposed", sort: "updated" } }), "준비 문서 세트");
  const readonly = await htmlPage(setsPage({ session: viewer, sets: fixture }), "준비 문서 세트");
  assert.match(managed, /href="\/sets\/new">세트 만들기<\/a>/);
  assert.doesNotMatch(readonly, /href="\/sets\/new"/);
  assert.match(managed, /&lt;b&gt;감사 세트&lt;\/b&gt;/);
  assert.doesNotMatch(managed, /<script>x<\/script>/);
  assert.match(managed, /name="q" value="감사"/);
  assert.match(managed, /value="disposed" selected>폐기 포함/);
  assert.match(managed, /value="updated" selected>최근 수정순/);

  const form = await htmlPage(setFormPage({
    session: manager,
    action: "/sets",
    title: "세트 만들기",
    values: { name: `<img src=x>`, description: `설명 & 확인` }
  }), "세트 만들기");
  assertPostForm(form, "/sets", ["name", "description"]);
  assert.match(form, /value="&lt;img src=x&gt;"/);
  assert.match(form, /설명 &amp; 확인/);

  const editForm = await htmlPage(setFormPage({
    session: manager,
    action: "/sets/4/edit",
    title: "세트 수정",
    values: { id: 4, name: "감사 세트", row_version: 8 }
  }), "세트 수정");
  assertPostForm(editForm, "/sets/4/edit", ["expectedRowVersion", "name", "description"]);
  assert.match(editForm, /name="expectedRowVersion" value="8"/);

  const cloneForm = await htmlPage(setClonePage({
    session: manager,
    set: { id: 4, name: "감사 세트", row_version: 8 },
    documentCount: 12
  }), "준비 문서 세트 복제");
  assertPostForm(cloneForm, "/sets/4/clone", ["expectedRowVersion", "name"]);
  assert.match(cloneForm, /원본 구성원 12건/);
  assert.match(cloneForm, /새 세트 상태[\s\S]*편집 가능/);
});

test("CSV 가져오기 목록과 생성 폼은 작업 링크·multipart 입력 계약을 유지한다", async () => {
  const list = await htmlPage(documentImportJobsPage({
    session: admin,
    jobs: [{
      id: 3,
      job_code: "IMP-3",
      source_name: `<script>원본</script>`,
      status: "ready",
      total_count: 5,
      completed_count: 1,
      failed_count: 1,
      pending_count: 3,
      created_by_name: "관리자",
      created_at: "2026-07-17"
    }]
  }), "CSV 가져오기 작업");
  assert.match(list, /href="\/document-import-jobs\/3"/);
  assert.match(list, /&lt;script&gt;원본&lt;\/script&gt;/);
  assert.doesNotMatch(list, /<script>원본<\/script>/);

  const form = await htmlPage(documentImportJobCreatePage({ session: admin }), "CSV 가져오기");
  assertPostForm(form, "/document-import-jobs", ["csvFile", "csvText"]);
  assert.match(form, /enctype="multipart\/form-data"/);
  assert.match(form, /accept="\.csv,text\/csv"/);
  assert.match(form, /면을 바라본 기준으로 왼쪽부터 1열, 아래부터 1선반/);
});

test("엑셀 대장 동기화 화면은 단일 엑셀 전체 동기화 흐름만 제공한다", async () => {
  const manager = await htmlPage(documentSnapshotPage({
    session: admin,
    state: { currentVersion: 3, updatedAt: "2026-07-20" },
    snapshots: []
  }), "엑셀 대장 동기화");
  const managerMain = manager.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
  assert.match(managerMain, /<h1>엑셀 대장 동기화<\/h1>/);
  assert.doesNotMatch(managerMain, /방법 1/);
  assert.match(managerMain, /<h2>엑셀 전체 동기화<\/h2>/);
  assert.doesNotMatch(managerMain, /방법 2|시스템 개별 관리|is-transaction/);
  assert.doesNotMatch(managerMain, /ledger-method-card/);
  assert.match(managerMain, /id="excel-full-sync"/);
  assert.match(managerMain, /data-excel-snapshot-upload/);
  assert.match(managerMain, /name="syncReason" required minlength="10" maxlength="500"/);
  assert.match(managerMain, /작업 생성 시 감사 이력에 저장됩니다/);
  assert.ok(manager.indexOf('/assets/jszip.min.js') < manager.indexOf('/assets/exceljs.min.js'));
  assert.ok(manager.indexOf('/assets/exceljs.min.js') < manager.indexOf('/assets/excel-app.js'));
  assert.match(managerMain, /accept="\.xlsx/);
  assert.match(managerMain, /data-excel-export/);
  assert.match(managerMain, /현재 대장 버전/);
  assert.match(managerMain, /최신 대장 내보내기[\s\S]*업로드[\s\S]*구조·데이터 검증[\s\S]*변경 검토[\s\S]*승인·적용/);
  assert.match(managerMain, /data-excel-base-version/);
  assert.match(managerMain, /data-excel-exported-at/);
  assert.match(managerMain, /data-excel-stale-warning/);
  assert.match(managerMain, /aria-label="엑셀 대장 동기화 단계"/);
  assert.match(managerMain, /class="workflow-step is-current" aria-current="step"/);
  assert.match(managerMain, /class="workflow-current-step">[\s\S]*현재 단계 1\/5[\s\S]*최신 대장 내보내기/);
  assert.match(managerMain, /최신 대장을 추출해 수정한 파일/);
  assert.match(managerMain, /개정 이력의 문서번호·개정번호 변경/);
  assert.match(managerMain, /랙과 면에 관계없이 해당 면을 바라본 기준으로 왼쪽부터 1열, 아래부터 1선반/);

  const detail = await htmlPage(documentSnapshotDetailPage({
    session: admin,
    snapshot: {
      id: 7, snapshot_code: "SNP-2026-0007", source_name: "대장.xlsx", status: "ready",
      total_count: 300, create_count: 20, update_count: 3, unchanged_count: 275, exclude_count: 2,
      metadata_count: 2, move_count: 1, dispose_count: 0, restore_count: 0, tag_change_count: 0, reinclude_count: 0,
      base_version: 3, previous_snapshot_id: 6, created_by_name: "관리자", created_at: "2026-07-20",
      apply_reason: "2026년 정기 문서고 대장 현행화",
      source_hash: "a".repeat(64)
    },
    rows: [{
      row_number: 2,
      action: "update",
      changed_fields_json: JSON.stringify(["documentName"]),
      change_flags_json: JSON.stringify(["METADATA"]),
      after_json: JSON.stringify({ values: { documentNumber: "DOC-1", revisionNumber: "Rev.0", documentName: "변경 문서", status: "active" } }),
      before_json: JSON.stringify({ values: { documentNumber: "DOC-1", revisionNumber: "Rev.0", documentName: "이전 문서", status: "active" } })
    }],
    exclusions: [{
      before_json: JSON.stringify({ values: { documentNumber: "DOC-EX", revisionNumber: "Rev.0", documentName: "제외 예정 문서", status: "active" } })
    }],
    canApply: true,
    requiredPermissions: ["can_manage_documents", "can_apply_document_snapshots", "can_move_documents"]
  }), "SNP-2026-0007 엑셀 동기화");
  assertPostForm(detail, "/document-snapshots/7/apply", ["applyReason", "approvalReference", "confirmedExcludeCount", "confirmExclude"]);
  assert.match(detail, /동기화 사유:<\/strong> 2026년 정기 문서고 대장 현행화/);
  assert.match(detail, /<textarea name="applyReason"[^>]*>2026년 정기 문서고 대장 현행화<\/textarea>/);
  assert.match(detail, /신규[\s\S]*20/);
  assert.match(detail, /변경 문서/);
  assert.match(detail, /제외 예정 문서/);
  assert.match(detail, /대장 제외 예정/);
  assert.match(detail, /class="button">현재 대장으로 반영<\/button>/);
});

test("폐기 캠페인 목록과 초안 폼은 조건 필드·민감 값 escape 계약을 유지한다", async () => {
  const list = await htmlPage(disposalBatchListPage({
    session: admin,
    batches: [{
      id: 9,
      batch_code: "DSP-9",
      title: `<img src=x>폐기`,
      status: "draft",
      criteria: { disposalDueYear: 2030, yearMode: "exact", categoryId: 2, zoneNumber: 0, rackId: 0 },
      category_name: "품질",
      disposal_reason: "보존기간 만료",
      approval_reference: "QA-2030-01",
      target_count: 2,
      completed_count: 0,
      excluded_count: 0,
      changed_count: 0,
      failed_count: 0,
      created_by_name: "관리자",
      created_at: "2026-07-17"
    }]
  }), "정기폐기 캠페인 이력");
  assert.match(list, /href="\/disposal-batches\/9"/);
  assert.match(list, /&lt;img src=x&gt;폐기/);
  assert.match(list, /보존기간 만료/);
  assert.match(list, /QA-2030-01/);
  assert.match(list, /대분류 품질/);
  assert.doesNotMatch(list, /<img src=x>폐기/);

  const form = await htmlPage(disposalBatchFormPage({
    session: admin,
    values: { title: `<script>초안</script>`, disposalReason: `기한 & 만료`, criteria: { disposalDueYear: 2030 } },
    categories: [{ id: 2, name: `<b>분류</b>` }],
    racks: [{ id: 7, zone_number: 1, rack_number: 2 }]
  }), "폐기 캠페인 생성");
  assertPostForm(form, "/disposal-batches", ["title", "disposalReason", "approvalReference", "disposalDueYear", "yearMode", "categoryId", "zoneNumber", "rackId"]);
  assert.match(form, /value="&lt;script&gt;초안&lt;\/script&gt;"/);
  assert.match(form, /기한 &amp; 만료/);
  assert.match(form, /&lt;b&gt;분류&lt;\/b&gt;/);
  assert.doesNotMatch(form, /<script>초안<\/script>|<b>분류<\/b>/);

  const periodic = await htmlPage(periodicDisposalPage({
    session: admin,
    values: {
      criteria: { disposalDueYear: 2030, yearMode: "exact", categoryId: 2, zoneNumber: 0, rackId: 0 }
    },
    categories: [{ id: 2, name: "품질" }],
    years: [2030],
    targetCount: 275,
    maxTargetCount: 5000,
    preview: [{
      document_number: "SOP-QA-001",
      revision_number: "Rev.1",
      document_name: "품질 절차서",
      category_name: "품질",
      disposal_due_year: 2030,
      location_snapshot: "1구역 / 1번 랙"
    }]
  }), "정기폐기 캠페인");
  assertPostForm(periodic, "/documents/dispose-filtered", [
    "title",
    "reason",
    "approvalReference",
    "disposalDueYear",
    "categoryId",
    "confirmedTargetCount",
    "confirmDisposal"
  ]);
  assert.match(periodic, /전체 275건 선택됨/);
  assert.match(periodic, /총 폐기 문서 수가 <strong>275건<\/strong>이 맞습니까/);
  assert.match(periodic, /예, 275건 전체 폐기합니다/);
});

async function htmlPage(response, title) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("Cache-Control"), "no-store");

  const policy = response.headers.get("Content-Security-Policy") || "";
  const nonce = policy.match(/script-src 'self' 'nonce-([^']+)'/)?.[1];
  assert.ok(nonce, "CSP script nonce가 필요하다");

  const html = await response.text();
  assert.match(html, new RegExp(`<title>${escapePattern(title)} - 한림문서고<\\/title>`));
  assert.match(html, /<main id="main-content"/);
  for (const match of html.matchAll(/<(?:script|style)\b([^>]*)>/gi)) {
    assert.match(match[1], new RegExp(`\\bnonce="${escapePattern(nonce)}"`));
  }
  return html;
}

function assertPostForm(html, action, names, { csrf = true } = {}) {
  const form = html.match(new RegExp(`<form\\b[^>]*method="post"[^>]*action="${escapePattern(action)}"[^>]*>([\\s\\S]*?)<\\/form>`));
  assert.ok(form, `POST form ${action}`);
  if (csrf) assert.match(form[1], new RegExp(`name="csrf_token" value="${escapePattern(CSRF_TOKEN)}"`));
  for (const name of names) assert.match(form[1], new RegExp(`name="${escapePattern(name)}"`));
}

function assertGetForm(html, action, names) {
  const form = html.match(new RegExp(`<form\\b[^>]*method="get"[^>]*action="${escapePattern(action)}"[^>]*>([\\s\\S]*?)<\\/form>`));
  assert.ok(form, `GET form ${action}`);
  for (const name of names) assert.match(form[1], new RegExp(`name="${escapePattern(name)}"`));
}

function escapePattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
