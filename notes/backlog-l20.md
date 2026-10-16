# Backlog (Lab 20)

Lab 01~20을 거치며 남은 후속 작업과 Automation 후보. 우선순위는 **P1(다음 작업) · P2(이번 분기) · P3(필요할 때)**. 각 항목에 완료 조건을 적는다. 담당의 「사람」은 저장소 소유자다.

## 후속 작업

| 우선순위 | 항목 | 출처 | 완료 조건 | 담당 |
| --- | --- | --- | --- | --- |
| P1 | Issue #6 사람 결정 1~3 답하기 (재결제 금지 유지 A / 변경 B, A일 때 400 vs 409, 다음 행동 안내 형식) | Lab 18, `notes/issue-exploration-l18.md` | 결정이 `notes/pending-decisions.md`와 `docs/payment-policy.md`에 기록되고, A면 `src/payments.ts` 거부 본문 + 테스트 `(d)` 기대값 + 정책 확정 표가 같은 PR에서 갱신됨. B면 별도 정책 변경 작업으로 분리 | 사람 → 에이전트 |
| P1 | 정책 확정 응답의 정확값 단언 보강 (`Insufficient stock` 409 본문, `Order is not refundable`·`Order is not cancellable` 400 본문, `failure.at`·`refund.at`·`cancellation.at` ISO 8601, 관리자 행 수) | Lab 17 reviewer, Lab 19 후보 B 시험 실행 | `tests/orders.test.ts`에 각 문자열·상태 코드 정확값 단언이 있고 `npm test` 통과. Lab 19 후보 B 점검 ④가 0건 | 에이전트(계획 승인 뒤) |
| P2 | 처리되지 않은 예외의 500 응답 형식(PI-1): JSON 에러 미들웨어 vs 운영 `NODE_ENV=production` 명문화 | Lab 17 reviewer | 사람이 형식을 정하고 `docs/payment-policy.md`/`order-policy.md` 노출 제외 절에 반영, 미들웨어를 넣으면 스택 비노출 테스트 추가 | 사람 결정 → 에이전트 |
| P2 | 결제 실패율 지표와 임계 알림 (로그 1 `metric=payment_attempts … failure_rate … alert`) | Lab 20 incident C3 | 결제 시도마다 성공·실패를 집계하는 지점이 코드에 있고, 5분 창 실패율이 임계(사람이 정함)를 넘으면 알림 조건이 판정 가능. 메모리 저장소 한계는 문서화 | 사람(임계값) → 에이전트 |
| P2 | Lab 8~16 산출물 공백 채우기 (`notes/issue-draft-l08.md`, `docs/templates/implementation-plan.md`, `docs/prompts/test-generation.md`·`pr-description.md`·`self-review.md`, `notes/session-handoff.md`, `notes/diff-review-l12.md`, `notes/error-log-l13.md`, `docs/checklists/hallucination-guard.md`, `notes/assertion-review-l14.md`, `tests/payments.test.ts`·`tests/admin.test.ts`, `docs/retry-stop-matrix.md`, `docs/checklists/pr-preflight.md`, `.github/pull_request_template.md`, `notes/pr-draft-l16.md`) | `node labs/tools/check.mjs 20` 실패 16건 | 셀프체크 failure=0. 코드 쪽은 이미 같은 목적지에 있으므로 테스트 파일 2개는 기존 `orders.test.ts`를 영역별로 나누는 작업 | 에이전트 |
| P3 | 응답 DTO 분리(PI-6): 결제 성공 응답과 `GET /orders/:id`가 원본 `Order`를 그대로 직렬화 | Lab 17 reviewer | `Order`에 민감 필드를 추가하기 전에 DTO 도입 여부 결정 | 사람 결정 |
| P3 | 보류 전환 결정: `cancelled → pending` 재개, `refunded → paid`, 부분 환불, 외부 결제사 비동기 환불, 네트워크 재시도 | `docs/*-policy.md` 보류 사항 | 각 항목이 허용/금지로 확정되어 전환표에 들어가거나 보류 유지 사유가 기록됨 | 사람 결정 |
| P3 | VOC 환경 확인(Issue #6 결정 4): 로그 2 환경이 강의 원본의 중간 상태인지 | Lab 18·20 | 업스트림 코드로 재현하거나 「현재 코드 기준」으로 Issue를 닫음 | 사람 |
| P3 | upstream(`RainaKim/order-ops`) 원격 추가와 강의 업데이트 수신 절차 확인 | README | `git remote -v`에 upstream, 첫 `fetch upstream` 성공, README 표가 fork 상태와 충돌하지 않는지 확인 | 사람 |

## Automation 후보 (`docs/automation/candidates.md`)

| 후보 | 상태 | 다음 단계 | 완료 조건 |
| --- | --- | --- | --- |
| A 검증 묶음 | 수동 실행 통과(2026-10-16) | 예약 실행 생성(사람 승인) — PR head 갱신·머지 직후 | 두 번 연속 예약 실행이 보고서를 남기고, 실패 시 알림이 소유자에게 도달 |
| B PR 사전 점검 | 수동 실행 통과, 실제 신호 3건 확인 | 패턴 ②(민감정보) 즉시 알림 경로 확정 뒤 예약 | 실제 PR 한 건에서 보고서가 사람 판단 없이 읽히고, 거짓 양성이 2건 이하 |
| C Issue 탐색 초안 | 미실행 (수동 절차만 Lab 18에서 수행) | 같은 프롬프트로 수동 1회 실행 | 초안이 `docs/prompts/issue-kickoff.md` 1단계 형식을 갖추고, 게시 전 멈춤이 지켜짐 |
| D 정책·결정·코드 정합 점검 | 미실행 (B의 ④가 일부) | 수동 1회 실행 | 표 3개가 나오고 현재 알려진 표류(P1 두 번째 항목)를 정확히 잡음 |

모든 후보는 `docs/automation/stop-conditions.md`의 다섯 중단 조건과 재시도 상한을 따른다. 예약 작업 생성 자체가 외부 변경이므로 사람 승인 뒤에만 만든다.

## 하지 않기로 한 것

- 실패 이력 삭제로 표시 문제를 숨기는 것 (주문 상태 정책 위반)
- 실결제 제공자 연동 (`AGENTS.md` 금지)
- README의 v0 기준 엔드포인트 표 수정 (업스트림 업데이트 충돌 회피. 자체 문서는 `docs/`에)
