# D1 및 공식 Excel 대장 복구 절차

이 시스템의 공식 원본은 업무 책임자가 서명해 보관하는 Excel 문서대장이다. 운영 데이터의 단기 복구는 Core D1 Time Travel을 우선 사용하고, 복구 가능 범위를 벗어나거나 D1 시점 복구가 부적합한 경우 마지막 서명 Excel을 새 Core D1의 bootstrap/snapshot 경로로 재적재한다.

검색 projection은 같은 Core D1 안의 파생 데이터이므로 별도 백업·복구 시점을 맞추지 않는다. 위험 수용과 평시 백업 정책은 [OPERATIONS.md](./OPERATIONS.md)를 단일 출처로 사용한다.

## 1. 사고 직후

1. 추가 쓰기와 배포를 중지한다.
2. 애플리케이션 오류인지 데이터 손상·비호환 schema인지 구분한다.
3. 검색 결과만 이상하고 문서 상세가 정상이면 먼저 projection 지연/손상을 의심한다. 이 경우 Core 복구가 아니라 재색인을 수행한다.
4. 데이터 복구가 필요하면 손상 시각, 목표 시점, 예상 데이터 손실 범위, 현재 release SHA와 Worker version을 기록한다.
5. production Environment 승인권자와 복구 대상 Core DB와 bookmark/timestamp를 확인한다.

D1 restore는 대상 DB의 현재 상태를 되돌리는 파괴적 작업이므로 배포 workflow에서 자동 실행하지 않는다.

## 2. Break-glass

공개 로그인 경계를 즉시 차단해야 하는 사고라면:

1. Cloudflare Dashboard에서 운영 Worker에 Access를 적용한다.
2. 필요한 운영 smoke는 승인된 service token만 사용한다.
3. 검증된 커스텀 도메인으로 전환하면 `workers.dev` 직접 접근을 차단한다.
4. Access 정책, token, 주소 변경은 복구 자체와 분리해 incident 승인을 기록한다.

비밀값은 문서·artifact·로그에 남기지 않는다.

## 3. 배포 전 복구 지점

`Deploy Production` workflow는 mutation 전에 Core D1의 Time Travel bookmark를 기록한다.

release evidence에는 다음 비민감 metadata만 남긴다.

- release SHA와 GitHub run ID
- environment
- Core database 이름과 ID
- Core Time Travel bookmark

Guarded migration은 이 metadata가 현재 run/SHA/environment/database ID와 일치할 때만 실행된다. 실제 복구 가능 기간은 해당 시점 Cloudflare D1 정책을 확인한다.

## 4. 복구 가능 시점 확인

최소 권한 D1 token으로 읽기 전용 확인을 먼저 수행한다.

먼저 `wrangler.jsonc`의 `env.production.d1_databases`에서 `DB` binding의 database 이름과 ID를 확인하고, 배포된 운영 Worker의 `DB` binding 및 해당 release evidence의 Core database ID와 일치하는지 대조한다. 아래 명령의 `DB`는 이 production binding을 해석하므로, 과거 DB 이름을 직접 입력해 다른 D1을 조회하거나 복구하는 실수를 방지한다.

```powershell
cd cloudflare-app
npx wrangler d1 info DB --env production
```

```powershell
cd cloudflare-app
npx wrangler d1 time-travel info DB --env production --json
```

배포 직전 상태로 복구할 때는 해당 release evidence의 bookmark를 사용한다. 특정 사고 시각을 사용할 때는 Cloudflare가 반환하는 실제 보존 범위 안인지 확인한다.

## 5. Worker rollback과 D1 restore 구분

### Worker rollback

다음 조건이면 D1을 되돌리지 않고 기록된 이전 100% traffic Worker version으로 rollback한다.

- 문제의 원인이 application/runtime에 있다.
- 현재 DB schema가 이전 Worker와 호환된다.
- 데이터 자체의 손상 근거가 없다.

### D1 restore

데이터 손상 또는 잘못된 mutation을 되돌려야 할 때만 별도 승인 후 수행한다.

```powershell
npx wrangler d1 time-travel restore DB --env production --bookmark "<CORE_BOOKMARK>"
```

실행 직전 `d1 info DB --env production` 결과의 database 이름·ID, bookmark와 승인 기록을 다시 대조한다. 명시적 database 이름을 대신 사용해야 하는 예외 상황이면 release evidence에 기록된 Core database ID와의 일치를 별도로 증명한다.

## 6. D1 restore 후 검증

1. Core migration 상태를 확인한다.
2. `/healthz`, `/readyz`와 기대 Worker version을 확인한다.
3. 승인 계정 로그인, 정확 문서번호 검색, 일반 검색과 문서 상세를 표본 확인한다.
4. 서명 Excel 표본과 구역/랙/면/열/선반 위치를 대조한다.
5. 최근 감사·이동·폐기 이력을 표본 확인한다.
6. readiness를 통과한 Admin의 사용자 관리 화면 접근을 확인한다.
7. projection을 필요하면 `pending`으로 예약하고 Cron/유지보수 경로로 재색인한다.
8. projection `ready`, indexed count = current 문서 수, dirty 0을 확인한다.
9. release SHA, Worker version, 복구 DB/bookmark, 승인, 명령 결과와 검증 결과를 incident 기록에 남긴다.

projection 재색인 실패는 Core를 다시 restore하는 이유가 아니다. Core가 정상이라면 projection만 초기화·재생성한다.

## 7. 서명 Excel 기반 장기 복구

D1 시점 복구를 사용할 수 없거나 서명 대장을 기준으로 새 환경을 만들어야 할 경우:

1. 마지막 승인된 Excel 파일의 파일 SHA-256, 승인 참조, 문서 수와 업무 집계를 기록한다.
2. 새 Core D1을 생성한다. 기존 손상 DB를 DELETE/초기화해 bootstrap용으로 재사용하지 않는다.
3. 저장소의 현재 migration chain을 번호순으로 모두 적용한다.
4. Worker binding을 바꾸기 전에 격리 환경에서 bootstrap을 준비한다.
5. Excel의 구조, identity 중복, 기준정보, 위치, 태그, 날짜와 create/update/exclude 요약을 승인 기록과 대조한다.
6. bootstrap apply 후 문서·태그·분류·상태·위치 집계와 canonical hash를 대조한다.
7. projection 재색인을 완료하고 검색·위치 표본을 다시 검증한다.
8. 승인 후 Worker binding을 새 Core로 전환한다.

초기 seed가 기대 상태가 아니거나 현재 snapshot이 이미 존재하면 bootstrap을 강행하지 않고 새 빈 DB에서 다시 시작한다.

## 8. 빈 DB 로컬 복구 리허설

리허설은 격리된 로컬 SQLite/D1에서만 수행한다. `--remote`, production DB ID, 운영 binding을 사용하지 않는다.

### 자동 검증

```powershell
cd cloudflare-app
npm run check:migrations
node --test tests/excelSnapshotSync.test.js
node --test tests/excelSnapshotWorkbookE2E.test.js
node --test tests/searchProjection.test.js
node --test tests/initialLoadContracts.test.js
node --test tests/thirtyThousandTransition.test.js
node --test tests/racksDomain.test.js
npm run rehearse:initial-load -- --count=30000
```

이 검증은 다음 계약을 확인한다.

- 빈 DB에 현재 migration chain 전체가 순차 적용된다.
- snapshot bootstrap/apply가 원자적으로 동작한다.
- managed 0-diff 재업로드가 create/update/exclude 0으로 준비된다.
- current identity, FK와 문서 수가 보존된다.
- projection dirty 배출과 in-place 재색인이 `ready`까지 전진한다.
- 30,000건 구조에서 payload, statement, 자동 5,000건 분할과 capacity 계약이 성립한다.
- 랙 위치 표현과 검색 결과의 물리 위치 계약이 유지된다.

로컬 실행 시간은 운영 성능 SLA로 사용하지 않는다. 운영 승인 전에는 실제 서명 Excel 사본과 실제 Cloudflare 지표로 다시 검증한다.

## 9. 로컬 집계 확인 예시

복구 환경에서 최소한 다음 항목을 대조한다.

```sql
SELECT sync_state, status, COUNT(*) AS count
FROM documents
GROUP BY sync_state, status
ORDER BY sync_state, status;

SELECT UPPER(document_number) AS document_number,
       UPPER(revision_number) AS revision_number,
       COUNT(*) AS count
FROM documents
WHERE sync_state = 'current'
GROUP BY UPPER(document_number), UPPER(revision_number)
HAVING COUNT(*) > 1;

SELECT c.name, COUNT(*) AS count
FROM documents d
JOIN categories c ON c.id = d.category_id
WHERE d.sync_state = 'current'
GROUP BY c.id, c.name
ORDER BY c.name;

SELECT r.zone_number, r.rack_number, d.rack_face,
       rs.column_number, rs.shelf_number, COUNT(*) AS count
FROM documents d
JOIN rack_slots rs ON rs.id = d.rack_slot_id
JOIN racks r ON r.id = rs.rack_id
WHERE d.sync_state = 'current'
GROUP BY r.zone_number, r.rack_number, d.rack_face,
         rs.column_number, rs.shelf_number
ORDER BY r.zone_number, r.rack_number, d.rack_face,
         rs.column_number, rs.shelf_number;

SELECT t.name, COUNT(*) AS count
FROM document_tags dt
JOIN documents d ON d.id = dt.document_id
JOIN tags t ON t.id = dt.tag_id
WHERE d.sync_state = 'current'
GROUP BY t.id, t.name
ORDER BY t.name;
```

current identity 중복 query는 0행이어야 한다. 집계 결과는 서명 Excel과 승인 기록을 기준으로 판정한다.

## 10. 개정 링크와 version 경합

`document_revision_links`로 연결된 문서의 문서번호·개정번호를 Excel snapshot으로 바꾸거나 개정으로 자동 폐기된 이전본을 복구하지 않는다. prepare 검증 또는 apply guard가 충돌하면 전체 반영을 중단하고 전용 문서 개정 절차를 사용한다.

Excel 추출 뒤 문서·분류·태그·랙이 변경되면 `baseVersion`이 stale해질 수 있다. 충돌 시 오래된 파일을 강행하지 않고 최신 대장을 다시 추출해 승인·hash·집계를 재확인한다.

## 11. 증적

복구 기록에는 최소한 다음을 남긴다.

- 사고 시각과 원인 분류
- release SHA와 Worker version
- Core database ID와 bookmark/timestamp
- 승인 기록
- 실행 명령과 결과
- 복구 전후 문서 수/version/hash
- 검색·위치·감사 표본 결과

DB 데이터 사본, 비밀번호, token, cookie와 개인정보는 저장소나 공개 artifact에 넣지 않는다.
