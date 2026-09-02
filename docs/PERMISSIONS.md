# 권한 운영 가이드

계정은 이메일을 로그인 아이디로 사용하고 이름은 `display_name`, 팀(부서)은 `team`에 보관한다. `team`은 사용자 관리·역할 반영 화면의 표시·선별용 값이며 권한 판정에는 사용하지 않는다. 명단 일괄 등록 절차는 [운영 절차](./OPERATIONS.md#사용자-일괄-등록)를 따른다.

Admin은 세부 flag와 관계없이 모든 권한을 가진다. 일반 User는 DB에서 매 요청 다시 읽은 `can_*` 권한만 사용할 수 있다. 미인증·disabled·rejected 사용자와 `security_review_required = 1`인 사용자는 업무 route에 진입할 수 없다. 메뉴 숨김은 편의 기능이며 모든 쓰기·관리 route는 서버에서 다시 검사한다.

`app_users.access_mode = 'demo_readonly'`는 본사 시연을 위한 별도 조회 모드다. 이 계정은 `User`·`viewer`·8개 `can_* = 0`을 유지하며, 라우트 카탈로그가 `screen` 또는 `interactive-read`로 표시한 GET만 일시적인 조회 권한으로 연다. 업무 POST는 서버에서 일괄 403으로 차단하고 export·CSV·snapshot raw page GET도 차단한다. 로그아웃과 최초 로그인 직후 강제 비밀번호 변경만 예외다. 화면의 비활성화·숨김은 안내 계층이며 실제 보안 경계는 서버 라우트와 DB trigger다.

## 권한 catalog

| 권한 | 허용 업무 |
|---|---|
| `can_manage_documents` | 문서 등록·수정, CSV 가져오기, 데이터 품질 수정, 엑셀 대장 추출·검증 |
| `can_move_documents` | 문서 위치 이동과 이동 이력 |
| `can_manage_disposals` | 폐기 캠페인과 문서 폐기 |
| `can_manage_sets` | 준비 문서 세트 생성·수정·잠금·문서 추가/제외 |
| `can_manage_masters` | 랙·대분류·태그 관리 |
| `can_manage_users` | 등록 계정 상태·권한 변경 |
| `can_view_audit` | 전역 감사, 검색 리포트, 문서 감사 이력 |
| `can_apply_document_snapshots` | 엑셀 전체 대장 최종 반영(기본 0, `문서관리` 역할에도 자동 부여하지 않음) |

## 주요 route 정책

| 기능 | 요구 조건 |
|---|---|
| 검색·문서 조회·도면·세트 조회 | 인증 사용자 |
| 문서 생성·수정·CSV·데이터 품질 | `can_manage_documents` |
| 엑셀 대장 추출·업로드·prepare | `can_manage_documents` |
| 엑셀 대장 최종 반영 | `can_manage_documents` + `can_apply_document_snapshots` (+ 위치/폐기 변경 시 각 권한, 폐기 해제는 Admin) |
| 위치 이동 | `can_move_documents` |
| 이동 이력 | `can_move_documents` 또는 `can_view_audit` |
| 폐기·캠페인 | `can_manage_disposals` |
| 폐기 해제 | Admin |
| 준비 문서 세트 변경·잠금·복제 | `can_manage_sets` |
| 랙·대분류·태그 | `can_manage_masters` |
| 사용자 상태·개별 권한 | `can_manage_users` |
| 역할 템플릿 조회·편집·명시적 일괄 반영 | `Admin` + `can_manage_users` |
| 사용자 비밀번호 초기화 | `Admin`만 가능(자기 계정·보안 검토 계정 제외) |
| 전역 감사·검색 리포트 | `can_view_audit` |
| `/admin` | 관리 권한 중 하나 이상, 내부 데이터는 개별 권한으로 제한 |

정확한 route descriptor 대응표는 `npm run docs:routes`로 생성되는 [route catalog](./generated/ROUTE_PERMISSION_CATALOG.md)를 사용한다. POST form은 permission 외에도 trusted Origin과 현재 session의 CSRF token이 필요하다.

문서 완전삭제는 현재 route로 제공하지 않으며 `POST /documents/:id/delete-permanent`는 인증 후에도 404를 반환한다. 이전 Worker rollback 호환을 위해 내부 도메인 함수 `permanentlyDeleteDocument`와 기존 감사 event/라벨은 유지하지만, 현재 handler나 route에서는 호출하지 않는다.

## DB 역할 템플릿

- 조회: 추가 권한 없음
- 문서관리: 문서 등록·수정, 위치 이동, 폐기, 준비 문서 세트 관리
- 시스템관리: 8개 권한 전체. 복구·권한 경계의 기준이므로 이름과 권한을 수정하거나 삭제할 수 없다.

역할 템플릿은 DB의 `user_role_templates`에서 관리한다. 역할 정의의 단일 출처는 이 테이블이며 애플리케이션 코드에는 역할 상수를 두지 않는다. 사용자에게 템플릿을 적용하면 `app_users.role_template_key`와 8개 `can_*` 플래그를 함께 저장하지만, 실제 route authorization은 계속 세부 플래그를 기준으로 판단한다. 체크박스를 개별 조정한 계정이나 저장된 플래그가 현재 템플릿과 다른 계정은 `사용자 지정`으로 표시한다.

개별 사용자 권한 화면에서 역할을 선택해 저장하면 브라우저 script와 무관하게 **서버가 그 역할의 현재 권한을 다시 읽어 적용**한다. 화면이 렌더링할 때 본 템플릿 버전을 함께 전송하므로, 편집 중 템플릿이 바뀌면 저장을 거부하고 새로고침을 요구한다. 개별 예외를 주려면 `사용자 지정`을 선택해야 하며 이때만 체크박스 값이 권한의 근거가 된다.

템플릿 편집은 기존 사용자 권한을 자동으로 바꾸지 않는다. 시스템 관리자가 편집 화면에서 대상을 명시적으로 선택한 경우에만 사용자별 감사로그와 `row_version` OCC를 남기며 한 D1 batch로 반영한다. 일괄 반영 후보는 승인된 일반 계정으로 한정하며 대기·반려·사용중지·보안 검토·`demo_readonly` 계정은 제외한다. 선택 사용자 중 한 명이라도 버전이 바뀌면 전체 반영을 취소한다. D1 statement 상한 때문에 한 요청에서 최대 38명을 선택하며, 더 많은 사용자는 새 목록을 확인한 뒤 다음 batch로 나눈다.

`app_users.row_version`은 역할·권한 화면의 OCC 기준이다. 상태 전이(승인·반려·사용중지·재사용·재가입 요청)와 권한·역할 변경은 모두 이 값을 올리므로 편집 화면을 열어둔 사이 계정 상태가 바뀌면 저장이 거부된다. 비밀번호 변경·초기화·로그아웃처럼 credential과 `session_epoch`만 바꾸는 경로는 권한 편집 결과를 무효화하지 않아 올리지 않는다.

권한 변경은 전역 감사로그에 남긴다. session cookie는 DB의 `session_epoch`와 매 요청 대조하며 로그아웃·비밀번호 변경·사용중지·재활성화 때 epoch를 증가시킨다. 따라서 복사된 cookie도 다음 요청부터 거부된다. `security_review_required` 계정은 일반 승인 처리로 되살릴 수 없고 별도 보안 검토·credential 재발급 절차가 필요하다. 퇴사·업무변경 시 계정을 삭제하지 말고 먼저 사용중지해 과거 감사 snapshot을 보존한다. 분기마다 승인 사용자와 권한을 검토하고 최소권한을 유지한다.
