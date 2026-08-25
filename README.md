# 한림 문서고 관리 시스템

[![CI](https://github.com/NKH-92/hanlim-archive/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/NKH-92/hanlim-archive/actions/workflows/ci.yml)

종이 문서의 검색·보관 위치 확인, 등록·수정·개정, 폐기, Excel 문서대장 동기화와 감사이력을 관리하는 사내 웹 애플리케이션입니다. Cloudflare Workers + D1 + 정적 Assets로 운영하며 실제 배포 소스는 [`cloudflare-app/`](./cloudflare-app/)입니다.

공식 원본(system of record)은 업무 책임자가 서명해 보관하는 **Excel 문서대장**입니다. Worker/D1은 검색·위치 확인과 운영 업무를 지원하며, 웹 데이터와 서명 대장이 다르면 서명 대장을 기준으로 정정·복구합니다.

- 런타임: Cloudflare Workers + 단일 Core D1
- 개발: Node.js 24, JavaScript ESM
- 기본 브랜치: `main`
- 배포: GitHub Actions + `production` Environment 승인
- 검색: Core D1 내부 FTS projection + dirty queue
- 용량 정책: 27,000건 운영 경고, 30,000건 기술 상한. 월별 확인은 [운영 절차](./docs/OPERATIONS.md#12-월별-무료티어-운영-점검)를 따른다.

## 주요 업무

### 검색·위치 확인

문서명, 문서번호, 개정번호, 대분류와 태그로 현재 문서를 검색하고 구역·랙·면·열·선반 위치를 확인합니다. 내부 식별자인 `storage_code`/`ARC-*`는 사용자 검색 결과와 내보내기 파일에 노출하지 않습니다.

### 문서 관리

권한에 따라 신규 등록, 일반정보 수정, 위치 이동, 개정, 폐기와 복구를 수행합니다. 문서 수정·이동은 `updated_at`과 단조 증가 `row_version`을 함께 검사하고, 다중 변경은 감사·이력과 상태 변경을 하나의 D1 batch에 둡니다.

### Excel 전체 동기화

현재 대장을 XLSX로 추출하고 편집한 한 파일을 완전한 현재 대장 snapshot으로 검증합니다. 신규·변경·위치·폐기·복구·유지·제외 diff를 확인한 뒤 명시적으로 반영하며, 파일에서 빠진 문서는 hard delete하지 않고 `excluded`로 보존합니다.

### 정기폐기

폐기 예정 연도·대분류 등의 조건으로 대상을 동결해 하나의 캠페인으로 관리합니다. 서버는 재개 가능한 chunk로 처리하고, 동결 후 변경된 문서는 자동 폐기하지 않습니다. 캠페인 집계, 결과 CSV와 문서별 감사이력을 함께 보존합니다.

### 계정·권한·감사

공개 회원가입은 제공하지 않습니다. 시스템관리자는 사용자 관리에서 승인된 조회 전용 User를 단건 추가할 수 있으며, 신규 계정은 최초 로그인에서 임시 비밀번호 변경이 강제됩니다. 일반 User는 `can_*` 권한을 매 요청 DB에서 재검증하며 Admin은 전체 권한을 가집니다. 로그아웃·비밀번호 변경·사용중지·재활성화는 `session_epoch`를 회전시켜 기존 세션을 폐기합니다.

정확한 권한과 route 정책은 [권한 운영 가이드](./docs/PERMISSIONS.md)와 [자동 생성 route catalog](./docs/generated/ROUTE_PERMISSION_CATALOG.md)를 사용합니다.

## 아키텍처

```text
src/index.js
  └─ handlers/
       ├─ domains/<name>/
       │    ├─ domain/
       │    ├─ application/   # 실제 orchestration/policy가 있을 때만
       │    ├─ infrastructure/
       │    └─ web/
       ├─ readModels/
       └─ views/
platform/
shared/
```

핵심 원칙:

- route 해석의 단일 출처는 `src/app/routeRegistry.js`입니다.
- 업무 규칙과 SQL은 각 domain이 소유하며 과거 `src/data` 계층을 사용하지 않습니다.
- `application/`은 실제 use-case orchestration이나 policy가 있을 때만 둡니다. 단순 forwarding wrapper는 만들지 않습니다.
- 검색 projection은 권위 데이터가 아니라 Core D1에서 재생성 가능한 파생 데이터입니다.
- migration은 append-only이며 이미 공개된 SQL과 checksum을 수정하거나 삭제하지 않습니다.
- CSP nonce, CSRF, trusted Origin, 서버 권한 검사와 D1 원자성/OCC 계약을 유지합니다.

세부 불변식과 소유권은 [ARCHITECTURE.md](./docs/ARCHITECTURE.md)를 따릅니다.

## 저장소 구조

| 위치 | 역할 |
|---|---|
| `cloudflare-app/src/` | Worker runtime, domain, handler, view, platform 코드 |
| `cloudflare-app/public/` | 배포 정적 자산 |
| `cloudflare-app/migrations/` | append-only D1 migration, manifest, released baseline |
| `cloudflare-app/scripts/` | 검증·배포·migration·복구 guard |
| `cloudflare-app/tests/` | 현재 계약 기준 회귀·통합 테스트 |
| `.github/workflows/` | CI, 운영 배포, 사용자/Admin provisioning |
| `docs/` | 현재 아키텍처·운영·복구·권한·디자인·향후 작업 |

`public/assets/app.css`, `app.js`, `search-core.js`, `exceljs.min.js`, `jszip.min.js`는 배포 자산입니다. 생성 자산은 `npm run check:browser`가 source/dependency와의 drift를 검사하므로 직접 수정하거나 임의 삭제하지 않습니다.

## 로컬 개발

필수 환경은 Node.js `>=24 <25`, npm lockfile, Wrangler입니다.

```powershell
cd .\cloudflare-app
npm ci
Copy-Item .\.dev.vars.example .\.dev.vars
npm run db:migrate:local
npm run dev
```

`.dev.vars`의 `SESSION_SECRET`, `AUTH_HMAC_SECRET`은 서로 다른 최소 32자의 무작위 값으로 설정하고 commit하지 않습니다.

## 검증

명령은 `cloudflare-app/`에서 실행합니다.

| 명령 | 용도 |
|---|---|
| `npm run check` | JavaScript 문법 검사 |
| `npm run typecheck` | 정적 타입 검사 |
| `npm run lint` | ESLint |
| `npm run format:check` | 형식 검사 |
| `npm run check:migrations` | migration·checksum·schema·FK 검사 |
| `npm run check:routes` | route catalog drift 검사 |
| `npm run check:browser` | 생성 browser asset drift 검사 |
| `npm test` | 전체 Node.js 테스트 |
| `npm run verify` | 위 핵심 검증 통합 실행 |
| `npm run audit:dependencies` | high 이상 dependency 취약점 검사 |
| `npm run deploy:dry` | 실제 배포 없이 production bundle/target 검증 |

일반 변경의 최종 확인:

```powershell
npm run verify
npm run audit:dependencies
```

## 변경 규칙

1. `main`에 직접 push하지 않고 기능 브랜치와 PR을 사용합니다.
2. 과거 migration SQL·checksum·released baseline 이력을 임의 수정하지 않습니다.
3. 현재 계약이 바뀌면 source, 테스트, 생성 자산과 권위 문서를 함께 갱신합니다.
4. 완료된 구현 과정과 과거 의사결정의 상세 이력은 중복 문서로 남기지 않고 Git commit·PR·migration·release evidence를 사용합니다.
5. 로컬에서 원격 migration 또는 production deploy를 실행하지 않습니다.

## 운영·복구 문서

- [아키텍처 및 유지보수 가이드](./docs/ARCHITECTURE.md)
- [배포 및 운영 절차](./docs/OPERATIONS.md)
- [D1 및 공식 Excel 대장 복구 절차](./docs/BACKUP_RESTORE.md)
- [권한 운영 가이드](./docs/PERMISSIONS.md)
- [UI 디자인 규칙](./docs/DESIGN.md)
- [개선 백로그](./docs/ROADMAP.md)
- [자동 생성 route/permission catalog](./docs/generated/ROUTE_PERMISSION_CATALOG.md)

운영 위험 수용, 배포 순서, 초기 10,000건 전환, 정기폐기, 사용자 등록과 월별 무료티어 점검은 `OPERATIONS.md`를 단일 출처로 사용합니다. 데이터 손상·Time Travel·서명 Excel 기반 재적재는 `BACKUP_RESTORE.md`를 따릅니다.

## 보안

기본·임시 비밀번호, 실제 사용자 정보, API token, cookie, D1 export와 `.dev.vars`를 저장소·issue·PR에 기록하지 않습니다. `security_review_required` 계정은 일반 승인으로 복구하지 않고 별도 보안 검토와 credential 재발급 절차를 사용합니다.
