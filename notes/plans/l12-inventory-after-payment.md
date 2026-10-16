# 계획 — 재고 차감을 결제 성공 시점으로 (Lab 12, 회고 작성)

> **이 문서는 회고다.** 이 fork는 Lab 12 시점에 이 계획을 쓰지 않았다. 같은 목적지에 2026-10-16 PR #1(`e8c7010..9cb009c`, 커밋 `1501eb7` 구현 + `477e7ca` 정책 승격)로 먼저 도달했고, 그때의 승인 계획은 `notes/order-status-plan.md`였다. 아래는 Lab 12 README가 요구하는 여덟 영역 형식에 맞춰 **PR #1이 실제로 구현한 내용**(`git diff e8c7010 9cb009c -- src tests`)과 일치하도록 2026-10-17에 다시 적은 것이다. 실제 diff와 다른 "있었으면 좋았을" 계획은 쓰지 않았다. 입력 Issue는 `labs/lecture12/inputs/l12-issue.md`.

## Goal

Issue 「결제 성공 이후에만 재고 반영」의 Acceptance Criteria를 관찰 가능한 결과로 바꾼 것. 각 행의 "관찰 결과"가 그대로 테스트의 assertion이 된다.

| Acceptance Criteria | 관찰 가능한 결과 | 정책 근거 |
| --- | --- | --- |
| 재고가 부족한 주문은 저장되기 전에 거절된다 | `POST /orders`가 `201`이 아닌 응답(PR #1 확정값 `409 { message: 'Insufficient stock', productId }`), `orders.size`가 늘지 않음, `products.get(id).stock` 불변. 같은 `productId`는 합산해 검사하고, 다품목 중 하나만 부족해도 전체 거절 | `docs/inventory-policy.md` 「재고 원칙」 1·2·7번째 문장 |
| 주문 생성만으로 재고가 감소하지 않는다 | `201` + `status: 'pending'` + `orders.has(id) === true` + 생성 전후 `stock` 동일 | 같은 문서 「생성해 `pending`으로 저장하는 것만으로는 재고를 차감하지 않는다」 |
| 성공 결제 뒤에만 주문 수량만큼 재고가 감소한다 | `POST /orders/:id/pay` 성공 → `200 { ok: true }`, 저장 상태 `paid`, `stock === before - quantity`, 성공 시도 이력 정확히 1건. 같은 주문 2차 결제는 거부되고 재고·이력 불변. 생성 뒤 재고가 줄어 결제 시점에 부족하면 결제를 확정하지 않고 `pending` 유지·이력 미기록 | 같은 문서 「결제 성공을 확정하기 직전에 … 다시 검사」「한 번만 차감」; `docs/order-policy.md` `pending → paid` |
| 결제 실패 주문과 시도 기록이 보존된다 | 실패 결제 → `402`, `ok: false`, 저장 상태 `payment_failed`, `GET /orders/:id`가 `200`, 실패 시도 1건(`failureReason` 포함), 재고 불변, 응답에 카드 토큰 없음. `payment_failed` 주문 재결제는 거부되고 상태·이력·재고 불변 | `docs/payment-policy.md` 「결제 원칙」 402·삭제 금지·재결제 금지; `docs/order-policy.md` `pending → payment_failed` 허용, `payment_failed → paid` 금지 |
| test, lint, typecheck가 통과한다 | `npm test` / `npm run lint` / `npm run typecheck` 종료 코드 0 | Issue 완료 조건 |

**미결로 남겨야 했던 것(계획 시점 기준):** 재고 부족 응답의 상태 코드·본문, 결제 시점 재고 부족의 상태·이력, 재결제 거부 응답, 관리자 불일치 응답. PR #1에서는 이 넷을 저장소 소유자가 구현 중 확정했고(`notes/pending-decisions.md` 「2026-10-16 구현 시 확정」), `477e7ca`에서 정책 문서로 승격했다. 테스트는 확정 전 값에 의존하지 않도록 당시 `not.toBe(201)` 수준으로 썼고, 정확값 단언은 2026-10-16 P1(`notes/plans/p1-exact-assertions.md`)에서 보강했다.

## Files to Change

| 파일 | 변경 이유 (어느 완료 기준 때문인가) | 책임 |
| --- | --- | --- |
| `src/store.ts` | 실패 주문을 보존하려면 저장 가능한 실패 상태가 필요. `OrderStatus`에 `payment_failed`, `PaymentAttempt`에 `failureReason?: PaymentFailureReason` 추가 | 상태 타입과 인메모리 저장소 |
| `src/inventory.ts` (신규) | 주문 생성과 결제 성공이 **같은** 합산 검사 규칙을 써야 한다(정책 복제 금지). `aggregateQuantities` / `findInsufficientProduct` / `deductStock` | 재고 검사·1회 차감의 단일 구현 |
| `src/orders.ts` | 생성 시 `product.stock -= quantity` 제거, 저장 전 `findInsufficientProduct` 검사 후 부족이면 저장 없이 거절 | 주문 생성·단건 조회 |
| `src/payments.ts` | 실패 분기 `orders.delete` → `payment_failed` 보존 + 실패 이력 + 402. 성공 분기에 재검사 → `deductStock` → `paid` → 성공 이력 순서. 실패 정보 DTO에서 카드 토큰 제외 | 결제 결과 판정·응답·이력 |
| `src/admin.ts` | 보존된 `payment_failed` 주문을 관리자 목록에 상태 그대로 표시하고 `failure { amountKrw, at, reason }`를 조건부 첨부 | 관리자 목록 구성 |
| `tests/orders.test.ts` | 기존 4개 유지 + 위 Goal 표의 관찰 결과를 assertion으로 추가 | 회귀 방지 |

`src/admin.ts`는 Lab 12 README가 「이번 변경에서 수정하지 않음」으로 둔 파일이다. PR #1은 관리자 실패 정보 표시가 같은 승인 계획(`notes/order-status-plan.md` 「관리자가 실패 주문 조회」)에 들어 있어 함께 바꿨다. 이 차이는 `notes/diff-review-l12.md` 「Scope guard 판단」에 적었다.

## Files to Read First

| 파일 | 읽는 이유 |
| --- | --- |
| `docs/inventory-policy.md` | 검사 시점(저장 전·결제 확정 직전), 합산, 전체 기준, 1회 차감, 실패 시 미차감의 원문 |
| `docs/payment-policy.md` | 402·실패 정보·이력 보존·삭제 금지·동일 주문 재결제 금지 |
| `docs/order-policy.md` | `payment_failed` 정의, 허용·금지 전환표, 관리자 조회 기준(필수·조건부 정보, 노출 제외) |
| `notes/pending-decisions.md` | 사람이 이미 확정한 것(402, 재결제 금지, 관리자 표시 범위, 테스트 범위)과 아직 보류인 것 |
| `AGENTS.md` | Policy Routing(재고 변경 → 세 정책 모두), silent fallback 금지, 테스트 없는 상태 변경 금지 |
| `src/server.ts` | 라우터 마운트 순서(`/orders`에 orders·payments 둘 다) — 테스트가 치는 실제 URL |
| `src/store.ts`, `src/orders.ts`, `src/payments.ts`, `src/admin.ts` | 현재 동작: 생성 시 차감·검사 없음, 실패 시 `orders.delete`, `catch → 200`/`catch → []`, `deriveDisplayStatus()`가 실패 이력으로 `'결제실패'` 파생 |
| `tests/orders.test.ts` (기준 커밋 `e8c7010` 판, 4개) | 현재 assertion이 `201`·`200`·`toHaveProperty('ok')`·`Array.isArray`뿐임을 확인 — 상태·재고·이력은 어떤 테스트도 묻지 않는다 |

## Steps

상태 변화 단위로 나눈다. 각 Step의 "확인 방법"은 Tests 절의 테스트 이름과 대응한다.

| Step | 상태 변화 | 입력 근거 | 허용된 변경 | 예상 수정 범위 | 종료 상태 | 확인 방법 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 저장 가능한 상태 집합 확장 | order-policy `payment_failed` 정의; pending-decisions 「`payment_failed`만 추가」 | `src/store.ts` 타입 2곳 | +5줄 안팎 | `OrderStatus`에 `payment_failed`, `PaymentAttempt.failureReason?` 존재. 동작 변화 없음 | `npm run typecheck` 통과, `npm test` 기존 4개 그대로 통과 |
| 2 | 주문 생성: 차감 없음 + 부족 차단 | inventory-policy 1~3번째 문장 | `src/inventory.ts` 신설(`aggregateQuantities`, `findInsufficientProduct`), `src/orders.ts` 생성 분기 | 신규 ~30줄 + orders 12줄 | 충분: `201`·`pending`·저장·재고 불변. 부족: 저장 안 됨·재고 불변·`201` 아님(확정 뒤 `409`) | 테스트 T1~T4 |
| 3 | 결제 실패: 삭제 → 보존 | payment-policy 402·삭제 금지; order-policy `pending → payment_failed` | `src/payments.ts` 실패 분기(`recordFailure`, `toFailureInfo`), `orders.delete` 제거 | payments ~40줄 | `402 { ok:false, orderId, status:'payment_failed', failure }`, 주문 보존, 실패 이력 1건, 재고 불변, 토큰 미노출 | 테스트 T8 |
| 4 | 결제 성공: 재검사 → 1회 차감 → `paid` | inventory-policy 「확정 직전 재검사」「한 번만」; payment-policy 성공 판정 | `src/inventory.ts` `deductStock`, `src/payments.ts` 성공 분기 | inventory +15줄, payments ~20줄 | `paid`·`stock - q`·성공 이력 1건. 2차 결제 거부·불변. 결제 시점 부족이면 미확정·`pending`·이력 없음 | 테스트 T5~T7 |
| 5 | 재결제 거부의 불변성 | payment-policy 「동일 주문 재결제 정책의 승격」 | `isPayable()`(`pending`만 허용) 유지 — 새 코드 없음 | 0줄(검증만) | `payment_failed` 주문 재결제 → `200` 아님, 상태·이력·재고 불변 | 테스트 T9 |
| 6 | 관리자 목록: 보존된 실패 주문 표시 | order-policy 「관리자 조회 기준」 필수·조건부·노출 제외 | `src/admin.ts` `toAdminOrder`에 `failure` 조건부 첨부, 상태·이력 불일치는 숨기지 않음 | admin ~60줄 | `payment_failed` 행에 `failure { amountKrw, at, reason }`, 다른 상태 행에는 `failure` 없음, 토큰 없음 | 테스트 T10~T11 |

Step 6에서 `deriveDisplayStatus()` 제거와 `catch → []` 제거가 함께 일어났다. 둘 다 Lab 12 README의 「이번 변경에서 수정하지 않음」에 해당하므로, 계획 그대로였다면 **Step 6 착수 전 멈추고 사람 판단**을 받아야 하는 지점이다. PR #1에서는 소유자가 결과 표를 보고 승인했고, Lab 17(`notes/role-split-run-l17.md` 결정 4-b, 결정 2)에서 사후 확정됐다.

## Tests to Add or Update

PR #1 머지 시점(`9cb009c`) `tests/orders.test.ts`의 15개 중 추가 11개. 이름은 당시 그대로이며, 2026-10-17 Lab 14 분리 뒤 위치는 괄호에 적었다.

| # | 테스트 이름 | 연결 Step | 묻는 값 | 현재 파일 |
| --- | --- | --- | --- | --- |
| T1 | `stores a pending order without changing stock when stock is sufficient` | 2 | `201`, `status: 'pending'`, `orders.has`, 재고 동일 | `tests/orders.test.ts` |
| T2 | `blocks an order whose quantity exceeds stock without storing it or changing stock` | 2 | `201` 아님(현재 `409` + 본문), `orders.size === 0`, 재고 동일 | 같음 |
| T3 | `aggregates quantities of the same product before checking stock` | 2 | 6+5 > 10 거절, 미저장, 재고 동일 | 같음 |
| T4 | `does not change any stock when one product of a multi-item order is short` | 2 | 다품목 중 하나 부족 → 전체 거절, 두 상품 재고 모두 동일 | 같음 |
| T5 | `deducts stock exactly once and marks the order paid` | 4 | `200`, `ok`, `paid`, `before - 2`, 성공 이력 1건 | `tests/payments.test.ts` |
| T6 | `does not deduct stock again when a paid order is paid a second time` | 4 | 2차 거부, `paid` 유지, 재고 동일, 이력 1건 | 같음 |
| T7 | `refuses to confirm payment when stock became insufficient after order creation` | 4 | 경쟁 주문 결제 뒤 부족 → 미확정, `pending`, 재고 1, 이력 0 | 같음 |
| T8 | `returns 402 with failure info, preserves the order as payment_failed, and keeps stock` | 3 | `402`, `ok:false`, `payment_failed`, `failure.amountKrw`, 토큰 비포함, 단건 `200`, 재고 동일, 실패 이력 1건 + `failureReason` | 같음 |
| T9 | `rejects re-payment of a payment_failed order without changing status, history, or stock` | 5 | 재결제 거부, 상태·`paymentAttempts.length`·재고 불변 | 같음 |
| T10 | `shows a payment_failed order with failure amount, time, and reason` | 6 | 관리자 행 `payment_failed`, `failure.amountKrw`, `at`, `reason`, 토큰 비포함 | `tests/admin.test.ts` |
| T11 | `uses the stored status for other orders and attaches no failure info to them` | 6 | `pending`/`paid` 행 상태 그대로, `failure` 키 없음, `'결제실패'` 없음 | 같음 |

실행 방법: `npm test`(전체), 한 테스트만은 `npx vitest run -t "<이름>"`. 기대 증거: 종료 코드 0과 통과 수. 기존 4개(`creates an order` 등)는 수정하지 않는다.

## Risks

| 위험 | 영향 | 감지 방법 |
| --- | --- | --- |
| 결제 시점 재고 부족의 상태·응답이 정책 미결 | 임의 확정하면 정책을 코드로 선점 | T7은 `200` 아님·`pending`·이력 0만 단언하고 상태 코드는 묻지 않음. 확정 뒤 정확값으로 보강(P1에서 수행) |
| 생성 시 검사와 결제 시 검사가 서로 다른 규칙으로 갈라짐 | 한쪽만 합산·전체 기준을 어김 | 두 경로가 `src/inventory.ts`의 같은 함수를 호출하는지 `grep -n findInsufficientProduct src/` |
| 중복 차감 | 재고 음수 | T6(2차 결제)·T7(결제 시점 부족), `deductStock`이 전제 위반 시 아무것도 바꾸지 않고 throw |
| 실패 정보에 카드 토큰·내부 오류 유입 | 노출 제외 정책 위반 | T8·T10의 `not.toContain(token)`; `ParsedCardToken.value` 제거로 토큰 보유 경로 자체를 없앰 |
| `deriveDisplayStatus()`·`catch → []` 변경이 Issue Out of Scope(관리자 표시 교정)와 Lab 15 영역에 걸침 | 승인 없이 범위 확대 | diff review 「Scope guard 판단」에서 파일·동작 단위로 대조, 사람 결정 기록 |
| 기존 테스트 4개가 응답 형태만 봐서 회귀를 못 잡음 | 깨져도 초록 | T1~T11이 상태·재고·이력을 직접 비교 |

## Out of Scope

- 외부 결제사 연동, 데이터베이스 도입 (Issue 명시)
- 환불(`refunded`)·취소(`cancelled`) 흐름 — PR #2, #3에서 별도 수행
- 네트워크 수준 재시도, 부분 환불 (정책 보류)
- Issue가 제외한 「관리자 표시 상태 계산 교정」 — **단, PR #1은 실패 주문 보존과 분리할 수 없다고 보고 소유자 승인 아래 `deriveDisplayStatus()`를 저장 상태 그대로 표시하는 구현으로 교체했다.** 이 계획이 Lab 12 시점에 쓰였다면 이 항목은 Out of Scope로 두고 Lab 18 VOC 기준선으로 남겼어야 한다. 차이는 diff review에 기록
- Lab 15가 다룰 payments·admin의 예외 fallback 제거 — **PR #1에서 함께 제거됨**(`AGENTS.md` silent fallback 금지 근거). 위와 같은 처리

## Stop Conditions

- 결제 시점 재고 부족·재결제 거부·재고 부족 응답·관리자 불일치 중 하나라도 코드에 값이 필요한데 사람 결정이 없으면 해당 Step 전에 멈춘다. (PR #1: 소유자가 대화에서 확정 → `477e7ca`로 정책 승격)
- 변경 파일이 Files to Change의 6개를 넘거나, 한 Step의 diff가 예상 범위의 2배를 넘으면 다음 Step 전에 멈추고 계획 수정·분리·되돌리기를 요청한다. (PR #1 실제: `src/inventory.ts` 신설로 파일 6개, `src/payments.ts` +121/−80 — 예상 범위 초과. 이 조건대로였다면 Step 3~4 사이에 한 번 멈췄어야 한다)
- `src/admin.ts`의 `deriveDisplayStatus()`나 `catch` fallback을 건드려야 한다고 판단되면 멈추고 Out of Scope 해제를 사람에게 묻는다.
- 테스트가 실패했을 때 정책 값을 바꿔 맞추지 않는다. 기대값이 정책 문장과 같은지 먼저 확인하고, 다르면 그것이 발견이다.
- `npm test` / `npm run lint` / `npm run typecheck` 중 하나라도 실패하면 완료로 표시하지 않는다.
- 반복 한도: 같은 Step의 구현·검증을 3회 돌려도 종료 상태에 도달하지 못하면 멈추고 보고한다.

## Approval Gate (회고)

| 항목 | PR #1에서 실제로 있었던 것 | Lab 12 형식이 요구하는 것 |
| --- | --- | --- |
| 승인 주체·시점 | 저장소 소유자, 2026-10-16 구현 전 「진행」(계획 `notes/order-status-plan.md` + 보류값 3개 기본안 제시) | 같음 |
| 승인한 Steps·파일 | 변경 범위 표 5행(`store`·`orders`·`payments`·`admin`·`tests`) | 파일 목록 + Step별 예상 규모 |
| 승인 전 무변경 증거 | 기록 없음 (`git status` 출력을 남기지 않았다) | `git diff --stat -- src tests` 빈 출력 |
| 승인 후 범위 밖 변경의 재승인 | 구현 뒤 결과 표로 일괄 승인. Step별 재승인 없음 | 예상 밖 파일·규모 발견 시 다음 Step 전 재승인 |

이 표의 두 번째·세 번째 차이가 Lab 17 역할 분리 실행에서 「계획에 있었나를 대조한 사람이 없었다」로 드러난 원인이다(`notes/role-split-run-l17.md` 「두 방식 비교」).
