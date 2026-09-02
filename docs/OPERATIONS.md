# 배포 및 운영 절차

이 문서는 **현재 운영 방법의 단일 출처**다. 완료된 구현 단계와 과거 검증 결과는 Git commit·PR·migration·release evidence에서 확인하고 이 문서에 누적하지 않는다.

운영 resource 이름과 binding은 `cloudflare-app/wrangler.jsonc`를 단일 출처로 사용한다. 운영 변경은 GitHub Actions의 `Deploy Production` workflow로만 수행하며 로컬에서 원격 migration이나 production deploy를 실행하지 않는다.

## 1. 시스템 지위와 위험 수용

- 공식 원본은 업무 책임자가 서명해 보관하는 Excel 문서대장이다. Worker/D1은 검색·위치 확인과 운영 업무를 지원하는 보조 시스템이다.
- 웹 데이터와 서명 대장이 다르면 서명 대장을 기준으로 정정하거나 재적재한다.
- 매월 1회와 대량·중요 변경 직후 현재 대장을 추출하고 문서 수, 대장 version, canonical hash와 인쇄용 관리대장을 대조한 뒤 서명본을 접근 통제된 사내 위치에 보존한다.
- 단기 복구는 Core D1 Time Travel을 우선 사용한다. Time Travel 범위를 벗어나거나 D1 시점 복구가 부적합한 경우 마지막 서명 Excel을 새 Core D1의 bootstrap/snapshot 경로로 재적재한다.
- 검색 projection은 같은 Core D1의 파생 데이터다. 별도 Search D1을 runtime에서 사용하지 않으며 Core 복구 후 필요하면 projection만 재색인한다.
- 평시에는 `workers.dev` + 애플리케이션 로그인을 접근 경계로 사용한다. Cloudflare Access, 별도 장기 DB 백업, 계정별 초기 비밀번호 등 추가 통제는 실제 운영 근거와 별도 승인이 생길 때 적용한다.
- 비밀번호 최소 길이와 공개 URL 사용 등 수용한 잔여 위험의 승인 증거는 저장소 문서에 반복 기재하지 않고 해당 PR과 production Environment 승인 기록을 사용한다.

### Break-glass: 공개 로그인 경계 차단

로그인 자동 시도, credential 위험 또는 접근 경계 사고가 발생하면:

1. Cloudflare Dashboard에서 운영 Worker에 Access를 적용해 공개 로그인을 차단한다.
2. release smoke가 필요한 경우 production secret으로 관리하는 승인된 service token만 사용한다.
3. 검증된 커스텀 도메인으로 전환하면 `workers.dev` 직접 접근을 차단하고 로그인·검색·관리 smoke를 다시 수행한다.
4. 전환 시각, 실행자, 사유, 정책 변경, token 폐기와 smoke 결과를 incident 기록에 남긴다.

## 2. 현재 런타임 구조

- Worker binding: Core D1 `DB` 하나.
- 검색: `search_projection_documents` + FTS + `search_projection_dirty`.
- 개별 등록·수정·이동·폐기·복구는 가능한 경우 같은 요청에서 해당 문서 projection을 즉시 동기화한다.
- 즉시 동기화가 실패하면 Core 변경은 유지하고 dirty 행이 복구 경로가 된다.
- Cron은 5분 주기로 dirty 배출, 전체 재색인 전진과 인증 housekeeping을 수행한다.
- `search_projection_state.generation`이 현재 cursor generation의 권위 상태다.
- `search_index_state`는 직전 Worker rollback 호환용 mirror로만 남아 있다. 제거는 rollback 관찰 종료 후 별도 contract migration으로 수행한다.

## 3. 배포 trigger

`main`에 병합된 `cloudflare-app/**` 또는 배포 workflow 변경은 운영 배포 대상이다.

다음과 같은 변경만 있는 commit은 CI만 실행하고 production deploy를 새로 만들지 않는다.

- `cloudflare-app/tests/**` only
- `cloudflare-app/migrations/released-baseline.json` only
- README / `docs/**`
- PR template와 Git 관리 파일

실제 `src/**`, `public/**`, migration SQL, package, script 또는 workflow runtime 변경이 테스트/문서 변경과 함께 있으면 정상 배포한다. 수동 `workflow_dispatch`는 production Environment 승인 후 실행할 수 있다.

## 4. 로컬 준비

Node.js 24와 npm lockfile을 사용한다.

```powershell
cd cloudflare-app
npm ci
Copy-Item .dev.vars.example .dev.vars
npm run db:migrate:local
npm run check
npm test
npm run dev
```

`.dev.vars`의 `SESSION_SECRET`, `AUTH_HMAC_SECRET`은 서로 다른 최소 32자의 무작위 값으로 설정하고 commit하지 않는다.

새 migration을 추가한 뒤에는:

```powershell
npm run db:manifest
```

으로 `migrations/manifest.json`을 갱신한다. 과거 migration SQL과 `released-baseline.json`의 기존 공개 이력은 수정하지 않는다.

## 5. PR 사전 검증

```powershell
cd cloudflare-app
npm ci
npm run verify
npm run audit:dependencies
npm run release:evidence
$env:CLOUDFLARE_ENV = "production"
$env:D1_TARGET_DATABASE_ID = "<production DB id>"
npm run deploy:dry
```

`deploy:dry`는 실제 배포나 원격 migration을 수행하지 않는다. CI는 PR base의 모든 migration SQL을 변경 불가 이력으로 비교하고, PR base의 `released-baseline.json`에 기록된 실제 공개 migration의 checksum·schema 기준선도 별도로 보존한다. 따라서 migration이 `main`에 병합된 뒤 운영 배포가 중단되어도 공개 기준선을 거짓으로 앞당기지 않고 복구 PR을 만들 수 있다.

## 6. 운영 배포 흐름

`main` 병합 후 production Environment 승인을 받은 한 SHA에 대해 다음 순서를 지킨다.

1. 같은 SHA를 다시 검증하고 release evidence를 생성한다.
2. 현재 100% traffic Worker version과 metadata를 rollback 대상으로 기록한다.
3. 배포에 사용할 수 있는 Admin 존재와 현재 Worker의 health·version·rollback compatibility marker를 확인한다. Admin은 승인 상태, 사용자 관리 권한, 최초 비밀번호 변경 완료, 보안 검토 해제 조건을 모두 만족해야 하며 보안 복구를 마친 메인 Admin도 인정한다.
4. Core D1의 현재 Time Travel bookmark를 release SHA·run ID·database ID와 함께 pre-mutation artifact로 기록한다.
5. append-only migration을 적용하고 동일한 Admin readiness를 다시 확인한다.
6. 신규 schema에서 release run 전용 smoke 계정을 만들고 이전 Worker와의 필수 호환 경로를 확인한다.
7. release SHA metadata와 함께 Worker를 production에 배포한다.
8. `/healthz`, `/readyz`, version, HTTPS/asset, 로그인, 검색, 사용자 관리 smoke를 실행한다.
9. Worker 배포 또는 smoke 실패 시 기록된 이전 100% version으로 rollback하고 인증·검색 smoke를 다시 수행한다.
10. 성공·실패와 관계없이 release 전용 계정을 제거하고 recovery/migration/deploy/smoke/rollback evidence를 보존한다.
11. migration이 포함됐다면 후속 baseline-only PR에서 `released-baseline.json`을 실제 운영에 공개된 migration까지 전진시킨다.

D1 복구는 데이터 상태를 되돌리는 파괴적 작업이므로 자동 rollback하지 않는다. [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)에 따라 별도 승인한다.

## 7. Migration과 rollback

최초 대량등록이 `applying` 상태인 동안에는 예약 작업을 이해하지 못하는 이전 Worker로 rollback하지 않는다. 긴급 rollback이 필요하면 현재 Worker로 자동 분할 반영을 완료하거나, 숨김 상태 문서와 예약 상태를 정리하는 별도 복구 계획을 승인한 뒤 진행한다.

- migration은 append-only다.
- additive 변경은 이전 Worker와 함께 동작하는 expand 단계로 먼저 적용한다.
- schema 제거는 이전 Worker의 runtime 참조가 0임을 확인한 뒤 별도 contract migration으로 수행한다.
- destructive migration과 그 schema 제거에 의존하는 application code를 같은 release에 묶지 않는다.
- D1에는 일반적인 down migration을 사용하지 않는다.
- 애플리케이션 문제이고 schema가 호환될 때만 이전 Worker version으로 rollback한다.
- 데이터 손상이나 비호환 schema 문제는 Worker rollback으로 완료 처리하지 않고 복구 절차를 시작한다.
- 인증의 `session_epoch`, 기준정보의 `row_version`, 문서 개정 링크 보호 trigger 등 rollback 중에도 필요한 DB 불변식은 직전 Worker가 이해할 수 있는 shape로 유지한다.

현재 공개 migration의 권위 기준은 `migrations/released-baseline.json`이다. 과거 migration을 합치거나 삭제하지 않는다.

## 8. 배포 후 확인

- `/healthz`와 기대한 Worker version/rollback compatibility marker.
- `/readyz` 200. 파생 검색 색인 지연은 readiness 실패 사유로 사용하지 않는다.
- `/signup` 404.
- HTTPS 전송 경계와 정적 asset 상태/MIME/ETag.
- 미인증 업무 경로의 로그인 redirect.
- 승인 계정의 검색·문서 상세 표본.
- 검증된 Admin의 사용자 관리 화면 접근.
- migration pending 0.
- 관리자 화면에서 projection `ready`, 색인 수 = current 문서 수, dirty = 0.
- Worker/D1 오류, JavaScript console 오류, CSP 위반 부재.

projection이 `pending`이거나 dirty가 남아 있으면 대량 등록·폐기를 시작하지 않고 Cron 복구가 `ready`/dirty 0까지 전진하는지 확인한다.

## 9. 문서 반영 방식

### 개별 관리

`+ 문서 등록`과 `/app` 문서 작업 공간에서 신규 등록, 정보 수정, 개정, 위치 이동, 폐기·복구를 수행한다. 개별 변경은 즉시 현재 대장에 포함되고 다음 Excel 추출에도 반영된다.

동일 바인더의 새 개정은 전용 `문서 개정` 경로를 사용하고 이전본과 현재본의 연결 이력을 보존한다.

### Excel 전체 동기화

업로드한 한 파일을 완전한 현재 대장으로 검토한다. 파일에 없는 문서는 hard delete하지 않고 `excluded`로 전환한다.

운영 순서:

1. `엑셀 대장 동기화`에서 현재 대장을 추출한다.
2. 보이는 14개 업무 열만 편집한다. `랙 위치 (구역)`은 1·2·3 중 하나이며 `문서종류`와 `랙 위치 (번호)` 사이에 둔다. 열·선반은 랙과 면에 관계없이 해당 면을 바라본 기준으로 왼쪽부터 1열, 아래부터 1선반을 입력한다. 숨김 관리 ID·schema/version/hash 열을 임의 삭제·복사하지 않는다.
3. 파일을 선택하면 브라우저가 구조를 확인하고 chunk로 staging한다. staging 중 현재 대장은 바뀌지 않는다.
4. 신규·정보 변경·위치 이동·폐기·폐기 해제·유지·제외와 before/after를 검토한다.
5. 동기화 사유를 입력하고, 위험 diff가 있으면 승인 참조와 제외 건수를 재확인한다.
6. 최종 apply는 `can_apply_document_snapshots`와 diff에 필요한 추가 권한을 검사한 뒤 하나의 D1 batch에서 확정한다.
7. 반영 후 새 Excel을 추출해 문서 수, version, canonical hash와 인쇄용 관리대장을 확인한다.

개정 링크의 문서번호·개정번호 변경과 개정으로 자동 폐기된 이전본의 복구는 Excel 동기화로 처리하지 않는다.

### apply mode

`EXCEL_SNAPSHOT_APPLY_MODE`:

1. `disabled`: prepare 가능, apply 차단.
2. `admin-only`: Admin만 apply. 기본 안전값.
3. `permissioned`: `can_apply_document_snapshots` + diff 기반 추가 권한.

### 데이터 감사

production 원본이 아니라 backup/export 사본에서 read-only 감사를 먼저 수행한다.

```powershell
node scripts/audit-excel-snapshot-data.mjs --db path\to\backup.sqlite --out reports\excel-snapshot-audit.json --abandoned-days 7
```

감사 스크립트는 자동 UPDATE/DELETE를 하지 않는다. append-only 감사 이력은 삭제하지 않고 correction event로 보완한다. 장기 staging/ready snapshot은 반영 전 취소 경로를 사용한다.

## 10. 정기폐기 캠페인

폐기 캠페인은 전자결재가 아니라 승인된 외부 결재 문서를 근거로 대상 snapshot을 동결하고 분할 처리하는 도구다.

1. `/documents/disposal`에서 `정기폐기`를 시작한다.
2. 폐기 예정 연도와 대분류 등 최소 한 조건을 선택하고 정확한 총 대상을 확인한다.
3. 캠페인 제목, 폐기 사유와 외부 승인 참조를 입력한다.
4. 최종 확인 시 문서 ID·문서번호·`updated_at`·`row_version`·위치·상태를 동결한다. 확인 시점의 실제 대상 수가 달라지면 실행하지 않는다.
5. 서버는 25건씩 재개 가능한 chunk로 처리한다. 네트워크가 끊기면 같은 캠페인을 재개한다.
6. 동결 이후 문서가 수정·이동·폐기되면 해당 항목은 `changed` 또는 기존 처리 상태로 남기고 자동 폐기하지 않는다.
7. 완료 후 조건, 사유, 승인 참조, 총 대상, 완료·제외·변경·실패 집계와 CSV를 대조한다.
8. 잘못 폐기한 문서는 권한자가 문서 상세에서 사유를 입력해 복구하며 원 캠페인 항목과 감사이력은 삭제하지 않는다.

반복 오류가 나면 새 캠페인을 만들지 않고 현재 캠페인의 실패 항목과 Worker request ID를 조사한다.

소량 선택 폐기는 별도 직접 경로를 사용하며 현재 상한은 `FREE_TIER_BUDGET.directBulkDisposeMaxItems`가 단일 출처다.

## 11. 최초 최대 30,000건 실사용 전환

테스트 데이터가 들어 있는 운영·검증 DB를 DELETE해서 실대장으로 재사용하지 않는다. 실사용 전환은 새 Core D1에 전체 migration을 적용한 뒤 승인 Excel bootstrap → projection 재색인 → 검증 → Worker binding 전환 순서로 수행한다.

### 용량 계약

- 최초 승인 파일 상한: 30,000행.
- 운영 경고: 27,000 current 문서.
- 기술 상한: 30,000 current 문서. 30,001번째 등록·재포함·snapshot apply는 DB trigger가 transaction을 차단한다.
- managed snapshot의 실제 변경 영향 상한과 chunk는 `FREE_TIER_BUDGET`을 단일 출처로 사용한다.
- 최초 파일의 브라우저 전송은 50행씩 자동 분할된다. 승인 뒤 5,000건씩 다음 UTC 일자부터 Cron이 자동 생성하고, 마지막 생성일 다음 UTC 일자에 전체 공개를 확정한다. 사용자가 묶음 크기를 정하지 않는다.
- 반영 중에는 일반 문서·태그·분류·랙 변경이 DB에서 잠긴다. 실패하면 같은 진행 건수에서 1시간 뒤 재시도하고, 완료 전 문서는 일반 목록에 공개하지 않는다.
- 초기 적재와 대량 작업 전에는 D1 계정의 당일 `rows_written`을 확인한다. 저장소의 내부 대응선은 `FREE_TIER_BUDGET` 값으로 판단하고 실제 Cloudflare 사용량이 권위값이다.

### 구조 리허설

```powershell
npm run rehearse:initial-load -- --count=30000
```

이 명령은 메모리 SQLite에서 전체 migration과 실제 snapshot bootstrap 계약을 목표 규모로 검증한다. Cloudflare CPU, 네트워크 SLA 또는 실제 D1 `rows_written`을 대신하지 않는다. 특정 날짜의 과거 실행 시간은 운영 기준으로 사용하지 않는다.

### 전환 확인

1. 현재 migration chain 전체를 새 Core에 적용한다.
2. 승인 Excel을 bootstrap으로 검증·예약하고 snapshot 상세의 `반영 건수 / 전체 건수`가 UTC 일자마다 전진하는지 확인한다.
3. 완료 후 문서 수, identity, FK, 분류·상태·위치·태그 집계와 canonical hash를 대조한다.
4. projection이 `ready`, indexed count = current 문서 수, dirty 0이 될 때까지 재색인을 전진시킨다.
5. 새 schema의 Excel을 무수정 재업로드해 create/update/exclude가 0인지 확인한다.
6. 정확 문서번호, 일반 검색, 오래된 문서, 초성·한영 자판, cursor, fallback 표본을 시험한다.
7. 일반 목록에 폐기 문서가 없고 `폐기 문서` 탭에는 현재 폐기 상태 문서만 있는지 확인한다.
8. `npm run verify`, `npm run deploy:dry`, Time Travel 복구와 재색인 훈련을 완료한다.

쓰기 개방 전 rollback은 이전 Worker와 이전 Core binding으로 돌아갈 수 있다. 쓰기 개방 후에는 신규 Core를 유지한 채 호환 Worker로 rollback하며, 기존 Core는 안정화 승인 전까지 삭제하지 않는다.

## 12. 무료티어·용량 점검

Cloudflare의 Free 한도는 변경될 수 있으므로 월별 점검 시 공식 Workers/D1 한도를 다시 확인한다. 저장소 문서에 특정 시점의 플랫폼 한도를 영구 고정하지 않는다.

매월 직전의 완결된 7일 UTC 기간을 기준으로 다음을 기록한다.

- Worker 일 요청량과 오류/outcome.
- 로그인 CPU p50/p95와 CPU 초과 여부.
- 계정 전체 D1 `rows_read`, `rows_written`과 Core D1 상세.
- Core D1 크기와 Time Travel 상태.
- projection dirty 최대 지연, 재색인 상태와 indexed count.
- Actions 사용량과 API token 최소권한.

내부 경보·정지선은 `FREE_TIER_BUDGET`과 운영 runbook의 현재 값으로 판단한다. raw 로그·사용자 정보는 저장소에 넣지 않고 접근 통제된 운영 증적 위치에 보존한다.

`npm run measure:search-consolidation`은 현재 단일 D1 구조의 용량·statement·재색인·contention 게이트를 재검증하는 운영 측정 도구로 유지한다. 완료된 Search D1 전환 단계의 이력을 재현하는 도구로 사용하지 않는다.

## 13. 호환 계약

현재 남아 있는 호환 경계는 이유가 있을 때만 유지한다.

- `search_index_state`: 직전 Worker rollback generation mirror.
- `login_throttle`: 이전 schema Worker와의 로그인 throttle fallback 및 credential reset cleanup.
- 내부 `permanentlyDeleteDocument`: 현재 HTTP route는 404지만 직전 Worker rollback 계약 때문에 domain 내부 기능을 유지한다.
- `/api/search-index`: 폐기된 브라우저 전체 색인 endpoint에 DB 없는 410을 반환한다.
- `includeDisposed`: 과거 URL 입력은 파싱하지만 일반 목록은 active로 고정한다. 폐기 문서는 전용 탭에서만 조회한다.

이 경계는 영구 기능이 아니다. rollback/client 관찰 기간 종료와 실제 사용 여부를 확인한 뒤 각각 별도 정리한다. 제거 조건은 [ROADMAP.md](./ROADMAP.md)에 기록한다.

## 14. 사용자·Admin 운영

### 런타임 secret

- `SESSION_SECRET`: 세션 서명용, 최소 32자.
- `AUTH_HMAC_SECRET`: 로그인 제한 식별자용, 최소 32자.

두 값은 재사용하지 않는다.

### release smoke 계정

release마다 무작위 reader와 제한된 관리 smoke 계정을 만들고 runner 임시 credential 파일에만 저장한다. 성공·실패와 관계없이 cleanup하며 만료 계정은 다음 release와 Cron janitor가 정리한다.

### 사용자 일괄 등록

명단과 초기 비밀번호는 저장소·migration·PR에 넣지 않고 production Environment secret으로만 전달한다.

```powershell
npm run users:roster -- --input ..\명단.xlsx --out provisioning-local\user-roster.json
```

1. roster JSON을 생성하고 검증한다.
2. `USER_PROVISION_ROSTER`, `USER_PROVISION_PASSWORD`를 production Environment secret에 임시 등록한다.
3. `Provision Archive Users` workflow를 승인해 한 번 실행한다.
4. 신규 계정은 승인된 조회 전용 User + `must_change_password=1`로 시작한다.
5. 기존 계정은 credential·권한을 덮어쓰지 않고 허용된 프로필 정보만 갱신한다.
6. 완료 후 임시 secret을 삭제하고 아직 최초 비밀번호를 바꾸지 않은 계정을 운영 점검한다.

공용 초기 비밀번호를 사용하는 동안에는 최초 로그인 전 선점 위험이 남는다. 등록 직후 변경을 안내하고 미사용 계정을 점검한다.

### 승인 사용자 단건 등록

시스템관리자는 `/admin/settings`의 `승인 사용자 추가`에서 이메일, 이름, 부서와 계정별 임시 비밀번호를 입력한다.

1. 신규 계정은 승인된 조회 전용 User + `must_change_password=1`로만 생성한다.
2. 추가 권한은 생성 완료 후 사용자 권한 화면에서 별도로 부여한다. 이 화면에서 Admin 계정을 직접 만들지 않는다.
3. 중복 아이디와 알려진 메인 Admin·release smoke 아이디는 거부한다.
4. 임시 비밀번호는 사용자에게 별도 보안 채널로 전달한다. 화면 오류, 감사로그, 저장소, issue와 PR에 기록하지 않는다.
5. 다수 계정을 같은 초기 비밀번호로 등록해야 할 때는 위 `Provision Archive Users` workflow를 사용한다.

### 본사 시연 조회 계정

`review@test.com`은 `Provision Demo Reviewer` workflow로만 생성한다. 표시 이름은 `본사 인사팀 검토`, 팀은 `본사 인사팀`, access mode는 `demo_readonly`로 고정한다. 기존 `USER_PROVISION_PASSWORD` production Environment secret을 초기 비밀번호로 사용하고 최초 로그인에서 변경을 강제하지만, 변경 완료 뒤에는 자기 비밀번호 변경 POST도 다시 차단한다. 계정은 자동 만료하지 않는다.

workflow는 migration 0060이 적용된 운영 DB에서 동일 아이디가 없을 때만 생성한다. 같은 아이디가 일반 계정이거나 시연 정책과 다르면 덮어쓰거나 비밀번호를 초기화하지 않고 실패한다. 이미 정확한 시연 계정이면 credential을 건드리지 않고 성공한다. 시연 종료 뒤 시스템관리자가 계정을 `사용중지`하고, 다시 사용할 때는 비밀번호 초기화로 `must_change_password = 1`을 재설정한 뒤 `다시 사용`한다.

시연 중에는 실제 문서·사용자·감사 데이터를 표시하므로 계정과 초기 비밀번호를 승인된 검토자에게만 별도 보안 채널로 전달한다. 화면의 저장 폼은 비활성화되고 서버는 업무 POST, 다운로드·CSV·raw export GET을 차단한다. 배포 smoke는 45분 TTL의 별도 `demo_readonly` 계정으로 화면 조회와 차단을 검증하므로 최종 `review@test.com`의 최초 비밀번호 상태를 소비하지 않는다.

### 독립 Admin

메인 Admin이 보안 복구와 최초 비밀번호 변경을 마쳤다면 배포 readiness에서 정상 Admin으로 인정한다. 사용할 수 있는 Admin이 전혀 없거나 별도 비상 관리자를 운영하기로 한 경우에만 production Environment 승인 후 `Provision Independent Admin` workflow를 사용한다. 기존 계정을 덮어쓰지 않으며 알려진 bootstrap/smoke 사용자명은 거부한다.

## 15. 증적과 비밀정보

- release SHA, Worker version, migration 결과, Time Travel bookmark metadata, smoke/rollback 결과는 release evidence로 보존한다.
- D1 데이터 사본, secret 값, 기본·임시 비밀번호, 개인 계정 정보는 GitHub artifact·로그·저장소·issue·PR에 넣지 않는다.
- 운영 데이터 복구는 [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)를 따른다.
