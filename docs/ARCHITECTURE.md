# 아키텍처 및 유지보수 가이드

이 문서는 코드 수정 전에 반드시 읽는다. UI 시각 규칙은 [DESIGN.md](./DESIGN.md), 운영 절차는
[OPERATIONS.md](./OPERATIONS.md), 권한 정책은 [PERMISSIONS.md](./PERMISSIONS.md)를 따른다.

## 의존성 방향

요청은 위에서 아래로만 흐른다.

```text
src/index.js                 공개 경로, 세션, CSRF, 보안 헤더, 전역 오류 경계
  └─ src/handlers/           route registry 결과를 use case와 view에 연결
       ├─ src/domains/<name>/index.js
       │    ├─ domain/       순수 정책, 상태 machine, 값 규칙
       │    ├─ application/  실제 orchestration·policy가 필요한 use case만
       │    ├─ infrastructure/ D1 query, command, BatchPlan
       │    └─ web/          parser, presenter, 도메인 전용 view
       ├─ src/readModels/    여러 도메인을 조합하는 명시적 read model
       └─ src/views/         공용 shell과 페이지 조립
src/platform/                D1, HTTP, crypto, security, observability 구현
src/shared/                  업무 의미가 없는 text, CSV, pagination, coercion
```

- 다른 도메인은 상대 도메인의 내부 파일 대신 공개 `index.js`만 import한다.
- cross-domain dashboard/report는 `src/readModels/`에서 조합한다.
- `platform/`은 업무 도메인을 import하지 않는다.
- 삭제된 전역 façade `db.js`, `html.js`, `utils.js`를 다시 만들거나 import하지 않는다.
- 과거 `src/data/*` 구현은 각 domain으로 이관했다. production 코드는 `src/data`를 import하지 않는다. D1 결과/OCC helper는 `platform/d1`, 문서·검색·랙·세트 SQL shape는 사용하는 도메인이 직접 소유한다.
- `application/`은 실제 orchestration·policy·port가 있을 때만 둔다. repository 함수를 그대로 전달하는 factory/service wrapper는 만들지 않는다.
- Workers 배포 소스에서 Node API를 사용하지 않는다.
- 코드 주석은 한국어로 작성한다.

`tests/architectureBoundaries.test.js`와 `tests/publicArchitectureContracts.test.js`가 이 규칙과
전역 façade 소비자 0을 검사한다.

## 주요 소유권

| 위치 | 소유 책임 |
|---|---|
| `src/app/routeRegistry.js` | route id, method, path, auth, permission, POST 보안 정책 |
| `src/domains/documents/` | 문서 검증·폼·조회·명령·낙관적 잠금·BatchPlan |
| `src/domains/disposal/` | 폐기 작업 상태 machine, 동결 snapshot, 재개 처리 |
| `src/domains/imports/` | CSV 작업 상태 machine, staging, 재개 처리 |
| `src/domains/snapshots/` | 엑셀 전체 대장 query/lifecycle/staging/prepare/apply/export. `repository.js`는 공개 조립점이며 원자 반영은 `apply.js` + `applyPlan.js`가 소유 |
| `src/domains/identity/` | Actor, 사용자 상태, 비밀번호 policy, capability, 사용자 command/query |
| `src/domains/masters/` | 대분류·태그 query/command/view |
| `src/domains/racks/` | 랙 규격, 면·열 방향, 도면 geometry, slot, query/command |
| `src/domains/search/` | 검색 repository/presenter, 고수준 동기화·유지보수 계약, browser/server 공통 공개 API |
| `src/domains/search/infrastructure/projection.js` | Core D1 검색 projection 쓰기, dirty 배출, in-place 재색인 |
| `src/domains/search/domain/indexTerms.js` | FTS 색인 term(2·3-gram, 한글 초성) 단일 출처 |
| `src/domains/sets/` | 세트 query/command, 잠금, 이력, presenter |
| `src/domains/audit/` | 시스템 감사 INSERT, filter query, audit presenter |
| `src/domains/dataQuality/` | 품질 issue catalog, 상세 query, 작업목록 view |
| `src/readModels/adminDashboard.js` | 권한별 사용자·품질·검색 통계를 조합하는 관리자 read model |
| `src/views/layout.js` | 공용 HTML shell, navigation, `page()` |
| `src/platform/web/` | RenderContext, safe embedded JSON, 구조적 HTML 보안 렌더링 |
| `src/platform/d1/` | 요청 예산, BatchPlan, expected-change, 결과 변경 판정, optimistic-lock SQL helper와 제약 오류 변환 |
| `migrations/` | append-only D1 schema 이력 |

## 절대 깨면 안 되는 불변식

1. **검색 단일 출처**: `src/searchCore.js`는 외부 스코프에 의존하지 않는 서버/browser 공통 ESM이다.
   `build:browser`가 `public/assets/search-core.js`를 생성하며 runtime source serialization이나
   `__name` shim을 사용하지 않는다.
2. **escapeHtml 자기완결성**: 클라이언트 bootstrap이 함수 소스를 직렬화하므로
   `src/ui/html/escape.js`의 `escapeHtml()`은 외부 참조 없이 실행되어야 한다.
3. **CSP·CSRF**: 모든 페이지는 `page()`를 거친다. `RenderContext`가 요청별 nonce와 CSRF 값을
   소유하고 `secureHtmlDocument`가 실제 opening tag를 판독해 모든 POST form에 token 하나,
   모든 inline executable script/style에 nonce 하나를 적용한다. `style` 속성과 동적 CSSOM
   mutation은 사용하지 않고, 동적 도면 값은 nonce가 붙는 `<style>` 규칙으로 렌더링한다.
   정규식 보안 후처리를 추가하지 않는다.
4. **정적 UI asset**: 전역 CSS/JS는 `src/views/styles.js`, `clientScript.js`에서 build 시 생성한
   `public/assets/app.css`, `app.js`다. Excel 동기화 코드는 일반 화면의 전역 JS에서 분리해 해당 화면에서만
   `excel-app.js`를 지연 로드한다. ExcelJS와 OOXML 호환 처리용 JSZip도 build 시
   `public/assets/exceljs.min.js`, `jszip.min.js`로 고정하며 `check:browser`가 여섯 asset의 drift를 차단한다.
5. **D1 원자성**: 다중 변경은 `env.DB.batch()` 한 경계에 둔다. 감사·이력 INSERT가 상태
   UPDATE/DELETE보다 먼저 오고, 마지막 mutation guard가 no-op과 경합을 검출해야 한다.
6. **낙관적 잠금**: 문서 수정·이동은 `updated_at`과 단조 증가 `row_version`을 함께 검사한다. 대분류·태그·랙·문서 세트의 수정·상태 변경·구성 변경도 화면에서 받은 `expectedRowVersion`과 DB `row_version`이 일치할 때만 수행한다.
7. **랙 규칙**: 한 면은 7열 × 6선반, 저장 face는 A/B, 표시는 단면 `13`, 양면 `13-1`/`13-2`다.
   랙과 면에 관계없이 해당 면을 바라본 사용자 기준으로 왼쪽부터 1열, 아래부터 1선반이며 화면에서 열을 mirror하지 않는다.
8. **내부 식별자 비노출**: `storage_code`와 `ARC-*`는 검색, CSV, 공개 read model에 노출하지 않는다.
9. **장기 작업 재개성**: disposal/import는 claim token과 terminal 상태를 보존하고 재호출이 중복
   mutation을 만들지 않아야 한다.
10. **migration append-only**: 과거 migration과 checksum은 수정하지 않는다. 스키마 변경은 항상
    다음 번호의 새 migration이며 수동 SQL을 운영 절차로 만들지 않는다. CI는 PR base의 released baseline과
    비교해 과거 SQL·checksum·schema 계약을 함께 바꾸는 우회도 거부한다.
11. **엑셀 대장 전체 동기화**: 사용자가 올리는 한 파일은 현재 대장의 완전한 snapshot이다. 브라우저는
    XLSX를 읽고 만들며 Worker는 정규화된 50행 이하 chunk만 받는다. 검증 실패·권한 부족·버전 경합은
    현재 문서를 한 행도 바꾸지 않고, 빠진 문서는 hard delete 대신 `document_snapshot_exclusions`와
    `sync_state = 'excluded'`로 이력만 보존한다. 최종 반영은 전용 권한과 위치·폐기 권한을 우회하지 않으며,
    날짜는 UTC calendar date로만 왕복한다. 동기화 사유는 작업 생성 전에 필수로 입력받아 snapshot과
    시작 감사에 저장하고, 최종 반영 시 저장된 사유를 다시 확인한다.
12. **엑셀 행 식별자**: 보이는 14개 한글 열의 순서와 이름은 고정하며 `랙 위치 (구역)`은 `문서종류`와
    `랙 위치 (번호)` 사이에 둔다. `excel_row_key`는 숨김 15열에만 기록하며 `storage_code`를 대체 공개하지 않는다.
    파일의 `baseVersion`이 현재 버전과 다르면 반영을 막는다.
13. **OOXML 호환성**: 일반 XLSX는 ExcelJS로 바로 읽고, 표준 namespace 접두사와 절대 relationship을 쓰는
    XLSX만 브라우저에서 상대 경로·기본 namespace 형태로 정규화한 뒤 다시 읽는다. 원본 파일 hash는 바꾸지 않는다.
14. **엑셀 출처와 압축 예산**: export API는 DB에 manifest ID·base version·현재 snapshot·canonical export hash를
    먼저 기록하고 XLSX 숨김 metadata에 manifest ID를 넣는다. managed 업로드는 현재 상태와 manifest를 다시 대조한다.
    브라우저는 원본 20MB, ZIP 500항목, 비압축 합계 100MB를 넘는 파일을 workbook 해석 전에 거부하고 서버도 보고된
    원본 크기 상한을 재검사한다.
15. **개별 관리와 개정 경계**: 웹의 문서 추가·정보 수정·개정·위치 이동·폐기는 모두 `sync_state = 'current'`
    대장과 단조 증가 version에 반영되어 다음 Excel export와 인쇄용 시트의 입력이 된다. Excel snapshot은
    `document_revision_links`에 연결된 문서의 문서번호·개정번호를 바꾸거나 자동 폐기된 이전본을 복원할 수 없다.
    prepare 검증과 최종 apply SQL guard가 이 규칙을 각각 검사한다.
16. **세션 즉시 폐기**: signed cookie에는 `sessionEpoch`를 포함하고 매 요청 DB의 `session_epoch`와 비교한다.
    로그아웃·비밀번호 변경·사용중지·재활성화는 epoch를 단조 증가시켜 복사된 cookie도 즉시 무효화한다.
    `security_review_required` 계정은 status·비밀번호와 무관하게 로그인과 기존 session을 모두 거부한다.
17. **검색 cursor 단조성**: 브라우저 전체 검색 인덱스와 그 ETag 계약은 종료했다. 텍스트 검색의 `더보기` cursor는
    `search_projection_state.generation`을 포함하며 문서·태그·기준정보 변경 trigger가 generation을 증가시킨다.
    오래된 cursor는 fingerprint 또는 generation 불일치 시 `SEARCH_CURSOR_STALE`로 거부한다.
18. **CSV 수식 비활성화**: 모든 CSV writer는 선행 공백·제어문자 뒤의 `=`, `+`, `-`, `@`까지 검사해
    스프레드시트 수식으로 실행되지 않도록 apostrophe를 붙인 뒤 RFC 4180 quoting을 적용한다.
19. **rollback 호환성**: migration은 이전 Worker와 함께 동작하는 additive 변경을 먼저 적용한다.
    배포 전 현재 100% traffic Worker를 rollback 대상으로 기록하고, migration 전후 인증과 핵심 쓰기
    불변식을 확인한다. 비호환 schema 제거는 별도 release로 분리한다.
20. **30,000건 용량·초기 적재 경계**: 현재 대장은 27,000건부터 운영 경고, 30,000건에서 DB trigger와 application
    guard가 신규 등록·재포함·엑셀 반영을 함께 차단한다. 용량 검사는 매번 전체 COUNT를 하지 않고 trigger가 유지하는
    `document_capacity_state`를 읽는다. managed v2의 전체 membership은 1,000행, 실제 변경행은 50행씩 전송하며 일상
    변경 영향은 1,000건을 넘길 수 없다. 최초 bootstrap 행 전송도 50행씩 자동 분할하고, 승인 뒤 실제 문서 생성은
    다음 UTC 일자부터 Cron이 1일 최대 5,000건씩 재개한다. 중간 문서는 `excluded`로 숨기고 마지막 생성일 다음 UTC 일자에
    current로 확정하여 쓰기량을 겹치지 않게 하며, 그동안 문서·태그·랙·분류 변경을 DB trigger가 차단한다. 승인 Excel 자체가 초기 상태의 출처이므로
    수만 개의 가상 create/dispose audit을 중복 생성하지 않고 snapshot row·canonical hash·system apply audit과
    `last_snapshot_id`로 행별 provenance를 보존한다.
21. **검색 projection은 Core D1 안의 파생 데이터**: `DB`는 문서·사용자·감사·권한의 유일한 권위 저장소이며
    검색 projection(`search_projection_documents`, `search_projection_fts`)도 같은 DB에 둔다. projection에는
    `storage_code`, 사용자, 감사정보를 저장하지 않는다. 검색 후보는 최대 200개 ID이며 Core에서 현재 상태·필터를
    재검증한 뒤 최대 30건과 opaque cursor만 응답한다. cursor 무효화는 projection과 같은 소유권에 있는
    `search_projection_state.generation`을 사용한다. migration 0050의 expand 기간에는 이전 Worker rollback을 위해
    `search_index_state.generation`도 같은 trigger에서 함께 증가시킨다. 색인 본문(`normalized_text`)은 n-gram과 한글 초성을 만드는
    `domains/search/domain/indexTerms.js`가 유일한 출처다. SQL trigger로 재현할 수 없으므로 trigger는 재색인 대상만
    `search_projection_dirty`에 표시하고, 색인 쓰기는 항상 애플리케이션이 수행한다. projection 쓰기와 dirty 행
    삭제는 하나의 `env.DB.batch()`에 두므로 **"projection 최신 OR 문서가 dirty"가 트랜잭션으로 보장된다.**
    경합 처리는 lease가 아니라 `(document_id, event_version)` 삭제 건수 assertion 하나로 끝난다. 오래된 내용을
    쓰려던 batch는 전체 rollback되고 dirty 행이 큐에 남아 재처리된다. 전체 재색인은 physical generation과
    cutover 없이 in-place upsert로 진행하므로 재색인 중에도 검색 결과가 비지 않는다.
22. **파생 색인은 배포 게이트가 아니다**: `/readyz`의 필수 조건은 Core D1 schema가 기대 migration에 도달하는 것뿐이며
    이 판정에 사용하는 조회는 Core D1 3문장(`d1_migrations`, `search_projection_state`, `search_projection_dirty`)이다.
    projection 재색인 지연과 dirty 잔량은 `warnings`로 노출하고 관리자 화면에서 확인한다. 파생 색인의
    지연을 준비 실패로 올리면 파생 데이터 지연이 곧 서비스 중단 판정이 되어 격리 목적과 반대로 작동한다.
    Cron 한 invocation은 요청당 statement 예산 48개 안에서 dirty 배출과 재색인 chunk를 순서대로 수행한다.
    개별 문서 변경은 Cron을 기다리지 않고 같은 요청에서 projection을 배출한다.
23. **검색 전용 D1은 존재하지 않는다**: Worker는 모든 환경에서 `DB` 하나만 바인딩한다. `SEARCH_DB` binding,
    두 번째 migration 체인, 그리고 cross-DB 정합성을 위해 존재했던 outbox lease·processor lease·문서별
    watermark·삭제 tombstone·active/building/previous generation·rebuild token·cutover fence는 모두 제거했다.
24. **폐기 문서 분리**: 일반 `/app`과 `/documents`는 항상 `status = 'active'`만 조회하고 상태 선택기를 제공하지 않는다.
    현재 폐기 문서는 `/documents/disposal?tab=documents`에서 별도로 조회한다. 문서 원본 행은 복구와 FK를 위해
    `documents.status = 'disposed'`로 유지하고, 폐기 행위·사유·담당자·캠페인은 불변 `disposal_logs`에 별도 저장한다.
    관리 Excel의 `문서데이터`는 동기화 무결성을 위해 폐기행도 보존하지만 `인쇄용 관리대장`은 폐기행을 제외한다.
    `search_index_outbox`와 전역 `search_event_clock`, 그리고 그 둘에 쓰던 17개 trigger도 제거했으므로
    파생 색인 신호는 `search_projection_dirty` 하나로 모인다. migration 0050부터 runtime cursor는
    `search_projection_state.generation`을 사용하며 `search_index_state`는 이전 Worker rollback용 mirror로만 남긴다.
    충분한 rollback 관찰 기간 뒤 별도 contract migration에서 제거한다. 제거 조건은 [ROADMAP.md](./ROADMAP.md)에 기록한다.
24. **인증 재검증과 임시 계정 수명**: 비밀번호 최소 길이는 6자이며 신규 PBKDF2-SHA256 record는
    현재 구현 정책인 PBKDF2-SHA256 100,000회 반복을 사용한다. legacy raw digest는 성공한 로그인에서
    CAS 방식으로 반복 횟수를 명시하는 self-describing record로 전환하며, 런타임 상한을 넘는 record는
    PBKDF2 실행 전에 fail-closed한다. 계정 상태와
    session epoch는 매 요청 DB에서 재검증하고, 반복 로그인 실패는 HMAC 기반 계정·IP 제한으로 차단한다.
    공개 가입은 항상 404로 유지한다. 시스템관리자의 승인 사용자 단건 추가는 조회 전용 User와 최초 비밀번호 변경
    강제 상태만 만들며, 감사 INSERT와 계정 INSERT를 같은 D1 batch에서 실행한다. Admin 승격과 추가 권한은 생성 요청과
    분리한다.
    release smoke 계정은 45분 TTL과 필요한 단일 권한만 가지며 다음 release와 Cron janitor가 누수를 제거한다.
25. **시연 조회 모드의 이중 경계**: `app_users.access_mode = 'demo_readonly'`는 일반 역할 템플릿과 분리한다.
    세션은 매 요청 DB 값을 재검증하고, 인증 라우트 descriptor의 `demoAccess`가 허용한 GET에만 read guard를 연다.
    모든 업무 POST와 export/raw GET은 중앙 라우터에서 닫으며 HTML의 inert form·download 숨김은 보조 안내다.
    migration 0060 trigger는 이 모드의 User·viewer·권한 0 불변조건과 access mode 해제를 DB에서도 거부한다.
25. **운영 version 격리**: 기본 Wrangler 환경은 운영 Worker·D1을 가리키지 않고 preview URL을 만들지 않는다.
    배포 전에 현재 100% traffic version을 기록하고 guarded deploy로 production에 직접 배포한다. canonical
    운영 URL smoke가 실패하면 기록한 version으로 rollback하고 다시 검증한다.

## 데이터 무결성 계약

- audit/history INSERT는 상태 UPDATE/DELETE보다 먼저 같은 `env.DB.batch()`에서 실행한다.
- 선행 INSERT도 application 사전조회가 아니라 같은 pre-state SQL guard를 사용한다.
- batch 마지막 mutation의 변경 행 수로 no-op과 낙관적 잠금 경합을 감지한다.
- 모든 SQL 값은 bind parameter로 전달한다. 권위 데이터와 검색 projection을 합친 요청당 내부 D1 statement
  예산은 48개, 원자 mutation `BatchPlan`은 40개다. statement당 bind parameter, LIKE pattern과
  JSON value payload 상한은 `FREE_TIER_BUDGET`과 D1 request gateway를 단일 출처로 사용한다.
  최대 200개 ID를 다루는 세트 작업은 JSON 한 bind와 `json_each()`를 사용한다.
- 폐기·CSV 작업은 claim token과 terminal 상태를 보존해 재호출 시 중복 기록을 만들지 않는다.
- 감사·이동·세트 이력은 append-only trigger를 유지하고, 내부 `storage_code`는 DB·감사 내부에서만 사용한다.
- 엑셀 snapshot apply는 claim → 문서별 감사 → set-based diff → 전역 감사 → version 확정을 40문장 이하
  한 `env.DB.batch()`에 두며, 이전 snapshot id와 정규화 행을 보존한다.

상세 route와 permission 대응표는 `npm run docs:routes`로 생성되는
[route catalog](./generated/ROUTE_PERMISSION_CATALOG.md)를 사용한다. 이 파일은 직접 편집하지 않는다.

## 검증 매핑

| 계약 | 대표 테스트 |
|---|---|
| 계층 방향·공개 API | `architectureBoundaries.test.js`, `publicArchitectureContracts.test.js` |
| migration 연속성·schema·FK | `migrationChainContracts.test.js` |
| D1 순서·guard·rollback | `criticalMutationContracts.test.js`, `dataIntegrity.test.js` |
| 인증·권한·CSP·CSRF | `auth.test.js`, `permissions.test.js`, `security.test.js` |
| 문서 query·mutation·OCC·직접 폐기 | `documentsQueryDomain.test.js`, `documentPersistenceContracts.test.js`, `documentCommandPlans.test.js` |
| 세트·랙 persistence와 geometry | `setsPersistenceContracts.test.js`, `setsDomain.test.js`, `racksDomain.test.js` |
| identity 상태·역할 템플릿 persistence | `identityPersistence.test.js`, `identityDomain.test.js` |
| 폐기·CSV 재개와 예산 | `batchJobs.test.js`, `freeTierBudget.test.js` |
| 초기 적재·용량·rollback shape | `initialLoadContracts.test.js` |
| 엑셀 300건 교체·diff·구버전 차단 | `excelSnapshotSync.test.js` |
| 실제 XLSX export→parse 무수정 0-diff | `excelSnapshotWorkbookE2E.test.js` |
| manifest·bootstrap·ZIP·감사 보강 | `excelSnapshotCompletion.test.js`, `excelOpenXmlCompatibility.test.js` |
| 웹 개별 변경 export 포함·개정 이력 경계 | `documentLedgerIntegration.test.js` |
| 검색 query/presenter와 server/browser 일치 | `searchRepositoryContracts.test.js`, `searchParity.test.js`, `searchBehavior.test.js` |
| Core projection dirty·재색인·읽기 parity | `searchProjection.test.js` |
| 파생 색인이 `/readyz`를 닫지 않음 | `readinessContracts.test.js` |

## 변경 절차

새 route는 `routeRegistry.js` descriptor → 해당 domain 공개 API/handler → view 순서로 연결한다.
화면은 반드시 `page()`를 사용한다. 여러 도메인의 조회를 합치면 handler 안에 임시 SQL을 만들지 말고
이름 있는 `readModels/` 모듈을 추가한다.

스키마 변경은 새 migration을 추가하고 전체 chain replay와 checksum 검사를 통과시킨다. 쓰기 use case는
이름 있는 `BatchPlan`에 step, guard, audit event id, statement budget을 고정한다.

```powershell
cd cloudflare-app
npm run check
npm test
npm run verify
npx wrangler deploy --dry-run
```

운영·배포·용량과 현재 rollback compatibility 제거 조건은 [OPERATIONS.md](./OPERATIONS.md)와
[ROADMAP.md](./ROADMAP.md)를 따른다.

`main` 푸시는 GitHub Actions가 운영 migration과 배포를 수행하므로 로컬 작업에서는 명시적 요청 없이
push, 원격 migration, production deploy를 실행하지 않는다.
