# Lab 18 E1 — VOC와 Issue 초안의 작업 가능성 비교

입력: `labs/fixtures/l18-voc-report.md`(VOC), `.github/ISSUE_TEMPLATE/workflow-task.md`(Lab 08 템플릿), `labs/lecture08/inputs/bad-issue-sample.md`와 `notes/issue-diagnosis-l08.md`(나쁜 Issue의 선례). 코드는 수정하지 않았다.

## 이 fork에서 VOC를 재현한 결과 (2026-10-16, main `10bc0a1`)

| 단계 | VOC가 말하는 것 | 현재 코드의 실제 동작 | 근거 |
| --- | --- | --- | --- |
| 첫 결제 (`FAIL…` 토큰) | 실패 | `402`, 주문 `payment_failed` 보존, 실패 이력 기록 | `src/payments.ts` 실패 분기, curl 재현 |
| 두 번째 결제 (정상 토큰) | 성공 응답 | **`400 { message: 'Order is not payable' }`** — 거부됨 | `isPayable()`은 `pending`만 허용. `docs/payment-policy.md` 「동일 주문 재결제 정책의 승격」 |
| 주문 상세 | 결제 완료 | `payment_failed` | `GET /orders/:id` |
| 관리자 목록 | 결제실패 | `payment_failed` + `failure { amountKrw, at, reason }` | `src/admin.ts` |

VOC의 핵심 증상(「상세는 결제 완료, 관리자는 결제실패」)은 **이 fork에서 발생할 수 없다.** 재결제 자체가 정책으로 막혀 있기 때문이다. 대신 고객이 실제로 부딪히는 것은 「실패한 주문을 다시 결제할 수 없다」이며, 이것이 이 fork에서 Issue로 다룰 관찰 가능한 사실이다. Lab 18 원문이 전제한 표시 상태 결함(`deriveDisplayStatus()`)은 PR #1에서 소유자 승인으로 제거됐다(`notes/role-split-run-l17.md` 「남은 위험」).

## 템플릿 필드별 대조

| 템플릿 필드 | VOC 한 줄에서 채울 수 있는가 | 빠진 것 / 사람 결정 |
| --- | --- | --- |
| Summary | 부분 — 「재결제 뒤 관리자 표시 불일치」로 쓸 수 있으나 이 fork에서는 사실이 아님 | 이 fork의 사실(「재결제 거부」)로 다시 써야 함 |
| Context | 있음 — 접수 시각, 고객 식별 정보·카드 정보 제거됨 | 어느 환경(로컬 v0, 운영?)에서 관찰했는지 없음 |
| Current Behavior | **없음** — VOC는 고객 체감만 있고 HTTP 상태·응답 본문·저장 상태가 없음 | 재현 절차를 코드로 만들어야 함(위 표) |
| Expected Behavior | **공백** — 고객 기대(「재결제가 되고 관리자도 결제 완료로」)와 정책(「실패 주문은 재결제하지 않는다」)이 충돌 | **사람 결정**: 정책 유지(고객에게 새 주문 안내) / 정책 변경(재결제 허용) |
| Scope / Out of Scope | 없음 | 응답 메시지 개선만 할지, 상태 전환 정책을 바꿀지에 따라 전혀 다름 |
| Acceptance Criteria | 없음 — 「주문을 다시 처리해야 하는지 확인」은 판정 불가 | 상태·응답·저장 결과·테스트 증거 네 축으로 다시 써야 함. Expected가 정해지기 전에는 확정 불가 |
| Human Decision Needed | 없음 | 위 Expected 충돌이 핵심. 추가로 「거부 응답에 안내 문구·다음 행동을 넣을지」 |
| References | 없음 | `docs/payment-policy.md`, `docs/order-policy.md` 전환표, `src/payments.ts`, `tests/orders.test.ts` 재결제 테스트 |

## 좋은 Issue와 나쁜 Issue의 차이

| 축 | 나쁜 Issue (Lab 08 샘플, VOC 원문 그대로) | 좋은 Issue (이번에 쓸 것) |
| --- | --- | --- |
| 현재 동작 | 「이상하다」「결제실패로 나온다」 — 체감 서술 | 요청·응답·상태를 순서대로, HTTP 코드와 본문 포함 |
| 기대 동작 | 고객 바람을 그대로 요구 | 정책과 충돌하면 기대를 확정하지 않고 사람 결정으로 올림 |
| 재현 | 없음 | curl 3줄과 관찰 대상(`GET /orders/:id`, `/admin/orders`) |
| 완료 기준 | 「확인해 주세요」 | 관찰 가능한 참·거짓 판정 + 테스트 이름 |
| 민감정보 | 토큰·고객 정보가 섞일 위험 | 모사 토큰 접두사(`FAIL`)만, 식별 정보 없음 |
| 범위 | 「재고 문제도 같이」처럼 열려 있음 | 포함·제외를 분리, 정책 변경은 별도 결정 |
| 정책 연결 | 없음 | 구현 전에 읽을 정책 문서와 문장을 References에 |

## 사람 결정 지점 (Issue 등록 전)

1. **Expected Behavior**: 실패 주문 재결제 금지 정책을 유지할지. 유지하면 Issue의 목표는 「거부 응답이 고객·운영자에게 다음 행동(새 주문)을 알려 주는가」로 좁혀지고, 변경하면 주문 상태 정책의 금지 전환을 다시 열어야 한다.
2. **Issue 등록 위치**: 원본 템플릿 저장소가 아니라 이 fork(`seotaioh/order-ops`). 현재 Issues 기능이 꺼져 있어 켜야 한다(저장소 설정 변경).
3. **공개 여부**: fork는 공개 저장소다. VOC fixture는 이미 식별 정보가 제거돼 있으므로 올려도 되지만, 실제 고객 VOC라면 비공개 저장소여야 한다.

## 등록된 Issue (E2)

- URL: https://github.com/seotaioh/order-ops/issues/6 (2026-10-16, fork의 Issues 기능을 켠 뒤 등록)
- 본문은 `notes/issue-draft-l18.md`와 같다. 고객 식별 정보·카드 정보·실제 토큰 없음(모사 접두사만).
- 소유자 결정: Issues 기능 켜기·등록·탐색 코멘트 게시를 2026-10-16 승인.

## 탐색 코멘트 (E3)

- Issue #6에 `notes/issue-exploration-l18.md`를 코멘트로 게시했다(2026-10-16). 탐색은 Issue 본문만 입력으로 받은 별도 에이전트가 수행했고, 코드 변경은 없다(`git status -- src tests docs` 비어 있음).
- 결과 요지: Current Behavior 1~5 재현됨. 현재 거부 응답은 정책 확정값과 일치하므로 결함이 아니라 「안내 부재」가 쟁점. VOC의 「두 번째 결제 성공」은 v0·현재 코드 어디서도 재현되지 않으며, 유력 가설은 업스트림 Lab 17 전제 상태(H1) 또는 새 주문 경로(H4). 사람 결정 4건은 열어 둔 채 구현을 멈췄다.
