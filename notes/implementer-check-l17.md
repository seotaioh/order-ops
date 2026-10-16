# Implementer 대조 기록 — Lab 17 E2 관리자 결제 실패 사유 노출

> 역할: implementer (`docs/prompts/implementer.md`). 코드는 수정하지 않았다. 계획과 머지된 구현을 대조하고 결과만 기록한다.
> 작성: 2026-10-16. 작업 트리 HEAD `f99731f` (브랜치 `lab17/role-split`), 시작 시 미추적 파일은 `.claude/`, `docs/prompts/`, `notes/plans/`. 작성 완료 시점에는 `notes/role-split-run-l17.md`(이 세션이 만든 파일 아님 — 병행 작업 산출물로 추정, 미확인)도 미추적 상태로 존재.

## 대조 대상

| 항목 | 값 |
| --- | --- |
| 승인된 계획 | `notes/plans/l17-admin-failure-reason.md` (승인 기록: 소유자 seotaioh, 2026-10-16 18:10 KST, 결정 1=A-ii / 2=a / 3=a / 4=b) |
| 구현 diff 범위 | `e8c7010..9cb009c` (PR #1 `feat/order-status-payment-failed`, 커밋 `1501eb7` 구현 + `477e7ca` 정책 승격 + 머지 `9cb009c`) |
| 변경 파일 11개 (`git diff --name-only e8c7010 9cb009c`) | `docs/inventory-policy.md`, `docs/order-policy.md`, `docs/payment-policy.md`, `notes/order-status-implementation.md`(신규), `notes/pending-decisions.md`, `src/admin.ts`, `src/inventory.ts`(신규), `src/orders.ts`, `src/payments.ts`, `src/store.ts`, `tests/orders.test.ts` |
| 9cb009c 이후 HEAD까지 | PR #2 환불(`fb5a3c2`), PR #3 취소(`1a6ef15`), PR #4 handoff 문서. `src/admin.ts`·`src/store.ts`·`src/inventory.ts`·`tests/orders.test.ts`가 추가로 바뀌었으나 이 기록의 대조 대상은 아니다. 단, 아래 「시나리오 ↔ 테스트 매핑」은 지시대로 **HEAD의 `tests/orders.test.ts`** 기준이며, `payment failure`·`admin order list` describe 블록은 9cb009c와 HEAD가 동일함을 `diff`로 확인했다 |

주의할 전제: PR #1은 이 계획(l17)을 보고 쓴 구현이 아니라 먼저 승인된 `notes/order-status-plan.md`(재고 시점 변경·402·재결제 거부 포함)를 따른 구현이다. l17 계획 자체가 결정 1 배경에서 그 사실을 적고 있다. 따라서 아래 「범위 밖」 판정은 「l17 계획 문장 기준으로 범위 밖」이라는 뜻이지, 승인 없이 들어간 변경이라는 뜻은 아니다. 승인 여부는 「판정」 열에 따로 적었다.

## 계획 대비 차이

판정 기준: **범위 안** = 계획 「바꾼다」 행에 해당 / **승인으로 해제** = 계획은 금지했으나 승인 기록의 결정으로 풀림 / **범위 밖** = 계획이 「건드리지 않는다」로 적었거나 변경 범위 표에 없는 변경.

| # | 항목 | 계획 문장 | 실제 diff 근거 | 판정 |
| --- | --- | --- | --- | --- |
| 1 | `src/store.ts` — `PaymentFailureReason = 'card_declined'` 리터럴 유니온, `PaymentAttempt.failureReason?` 추가 | ① 「`PaymentAttempt`에 실패 사유 필드 추가. 값 타입은 문자열 리터럴 유니온 … 성공 시도에는 값이 없다」; 결정 2 = a(`card_declined`, 필드명 `failureReason`) | `+export type PaymentFailureReason = 'card_declined';` / `+  failureReason?: PaymentFailureReason;` | 범위 안 |
| 2 | `src/store.ts` — `OrderStatus`에 `'payment_failed'` 추가 | ② 「`OrderStatus`에 `'payment_failed'` 추가」(결정 1 = A) | `-export type OrderStatus = 'pending' \| 'paid' \| 'cancelled';` → `+ … 'payment_failed' \| 'cancelled'` | 범위 안 |
| 3 | `src/store.ts` — 그 외 | 「`Product`·`Order`·`OrderItem` 구조, `seedProducts`, `resetStore()` … 카드 토큰 저장 필드를 추가하지 않는다」 | diff에 해당 변경 없음(7줄 변경 전부 #1·#2) | 범위 안 (준수) |
| 4 | `src/payments.ts` — 실패 분기에서 사유 기록 | ③ 「실패 분기에서 `recordAttempt`에 사유 코드를 함께 기록 (`createAttempt` 시그니처에 사유 인자 추가, 성공 호출은 사유 없음)」 | `createAttempt`/`recordAttempt` 대신 `recordSuccess(order)`·`recordFailure(order, failureReason)`로 분리. 실패 호출 `recordFailure(order, 'card_declined')`, 성공 호출에는 사유 없음 | 범위 안 (목적 동일, 구현 방식만 다름 — 계획의 「시그니처에 인자 추가」를 함수 분리로 대체) |
| 5 | `src/payments.ts` — `orders.delete` 제거, `order.status = 'payment_failed'` | ④ (결정 1 = A) | `-        orders.delete(orderId);` / `+      order.status = 'payment_failed';` | 범위 안 |
| 6 | `src/payments.ts` — 실패 응답 `402 { ok:false, orderId, status, failure:{reason, amountKrw, at} }` | ⑤ 「`200 { ok: false }`는 결정 1-A-ii에서 달리 정하지 않는 한 그대로」; 승인 기록 결정 1 = **A-ii**, 본문 형식 명시 | `+      res.status(402).json({ ok: false, orderId: order.id, status: order.status, failure: toFailureInfo(attempt) })` | 승인으로 해제 (결정 1-A-ii, 본문 형식도 승인 기록과 일치) |
| 7 | `src/payments.ts` — `parseCardToken()`에서 `value` 필드 제거 | 「건드리지 않는다: `parseCardToken()`」 | `-  value: string;` / `-    value: cardToken,` → `+  return { shouldFail: cardToken.startsWith('FAIL') };` | **범위 밖** (토큰 비노출 방향의 축소이지만 계획이 명시적으로 미수정 대상으로 적은 함수) |
| 8 | `src/payments.ts` — 성공 분기에 재고 재검사(`findInsufficientProduct` → `409 Insufficient stock`)와 `deductStock()` 추가, `completePayment()` 제거 | 「건드리지 않는다: 성공 분기(`completePayment`), 재고 처리(이 파일엔 없음)」; 「요청에 없어 넣지 않는 개선: 재고 차감 시점 변경, 재고 부족 차단」 | `+    const insufficient = findInsufficientProduct(order.items); … res.status(409) …` / `+    deductStock(order.items);` / `-function completePayment` | **범위 밖** (`notes/order-status-plan.md` 범위이며 소유자 확정 — `docs/payment-policy.md` 「확정된 응답」 표의 「결제 시점 재고 부족」 행) |
| 9 | `src/payments.ts` — `try { … } catch (e) { console.log(e); res.json({ ok:false }) }` 제거, `rejectInvalidRequest` 인라인 | 「건드리지 않는다: `catch` fallback」 | `-    } catch (e) { -      console.log(e); -      res.json({ ok: false });` 삭제 | **범위 밖** (계획은 payments.ts의 catch를 미수정으로 적음. 결정 3-a의 「catch → [] 제거」는 `src/admin.ts` 쪽 문장이다. 다만 AGENTS.md Rules 「silent fallback 금지」와는 부합) |
| 10 | `src/payments.ts` — `isPayable()`·라우트 경로·재결제 거부 | 「건드리지 않는다 … 재결제 거부 로직을 새로 쓰지 않는다」 | `isPayable` 본문 동일(주석만 추가), 경로 `/:id/pay` 동일, 재결제는 기존 `400 Order is not payable` 분기 그대로 | 범위 안 (준수) |
| 11 | `src/admin.ts` — `failure?: { amountKrw, at, reason }` 선택 필드, `order.status === 'payment_failed'`일 때만 첨부, 실패 이력은 `orderId` 일치 && `!ok`만 사용, 다른 상태에는 키 자체 없음 | ⑥⑦ | `+  failure?: AdminPaymentFailure;` / `+  if (order.status === 'payment_failed') { base.failure = findFailure(order); }` / `filter(a => a.orderId === order.id && !a.ok)` | 범위 안 |
| 12 | `src/admin.ts` — 실패 이력이 정확히 1개가 아니거나 `failureReason` 누락이면 `InconsistentFailureRecordError` → 목록 전체 `500 { message: 'Inconsistent payment failure record', orderId }` | ⑦ 「실패 이력이 정확히 하나가 아닐 때의 동작은 결정 3 확정 전까지 구현하지 않는다」; 승인 기록 결정 3 = **a** (`500 { message, orderId }`, 내부 예외 미노출) | `+  if (failed.length !== 1) throw …` / `+      res.status(500).json({ message: 'Inconsistent payment failure record', orderId: error.orderId });` | 승인으로 해제 (결정 3-a). 내부 예외 메시지(`error.message`)는 응답에 넣지 않음 — P6 준수 |
| 13 | `src/admin.ts` — `catch { res.json([]) }` 제거, `InconsistentFailureRecordError` 외 예외는 `throw error`로 재전파 | 「건드리지 않는다: `catch { res.json([]) }` fallback(요청 밖·Lab 12 보존 경계)」; 승인 기록 결정 3 「기존 `catch → []`는 silent fallback이라 제거」 | `-  } catch { -    res.json([]);` → `+  } catch (error) { if (error instanceof InconsistentFailureRecordError) {…} throw error; }` | 승인으로 해제 (결정 3-a의 명시 문장) |
| 14 | `src/admin.ts` — `deriveDisplayStatus()`·`DisplayStatus` 타입 삭제, `status: order.status`(타입 `OrderStatus`) | 「**`deriveDisplayStatus()` 본문 한 글자도 바꾸지 않는다.** `DisplayStatus` 타입 선언, `status: deriveDisplayStatus(order)` 호출」 미수정; 승인 기록 결정 4 = **b** 「`deriveDisplayStatus()`를 정책대로(저장 상태 그대로 표시) 교체하는 범위를 승인 … 이 계획의 「건드리지 않는다」 행은 소유자 결정으로 해제」 | `-function deriveDisplayStatus(order: Order): DisplayStatus { … }` 전체 삭제, `-type DisplayStatus = …` 삭제, `+    status: order.status,` | 승인으로 해제 (결정 4-b). Lab 17 README 전제(미수정)와는 다름 — reviewer는 「Lab 전제와의 차이(소유자 승인)」로 분류 |
| 15 | `src/admin.ts` — 기존 4개 필드(`id`,`totalKrw`,`status`,`createdAt`), 라우트 경로, `orders.values()` 순회 | 「건드리지 않는다」 | 4필드 유지, `adminRouter.get('/orders')` 유지, `Array.from(orders.values(), toAdminOrder)` 유지 | 범위 안 (준수) |
| 16 | `src/inventory.ts` 신설 (`aggregateQuantities`, `findInsufficientProduct`, `deductStock`) | 변경 범위 표에 없는 파일. 「요청에 없어 넣지 않는 개선: 재고 차감 시점 변경, 재고 부족 차단」 | `new file mode 100644`, 45줄 | **범위 밖** (`notes/order-status-plan.md` 범위, 소유자 확정 — `docs/inventory-policy.md` 「재고 부족 응답」) |
| 17 | `src/orders.ts` — 생성 시 재고 차감 제거, 저장 전 합산 재고 검사, 부족 시 `409 { message:'Insufficient stock', productId }` | 「건드리지 않는다: 전부. 재고 차감 시점(생성 시 차감), 재고 검사 부재, 생성·단건 조회 응답」 | `-  for (const item of items) { … product.stock -= item.quantity; }` → `+  const insufficient = findInsufficientProduct(items); if (…) { res.status(409)… }` | **범위 밖** (동일 근거: order-status-plan 범위, 소유자 확정) |
| 18 | `src/server.ts` | 「건드리지 않는다: 전부」 | diff 없음 | 범위 안 (준수) |
| 19 | `tests/orders.test.ts` — 기존 4개 테스트 | ⑧ 「기존 4개 테스트는 유지 … 기대값을 낮추지 않는다」 | 4개 모두 존재. 본문을 `createOrder`/`pay` 헬퍼로 바꿨으나 단언(`201`, `200`, `toHaveProperty('ok')`, `Array.isArray`)은 동일 | 범위 안 (준수) |
| 20 | `tests/orders.test.ts` — S1~S5 추가 | ⑧ 「시나리오 S1–S5 추가」 | `payment failure` 2개 + `admin order list` 2개 테스트가 S1~S5를 부분적으로 덮음(상세는 다음 절) | 범위 안 (단 검증 계약의 일부 단언 누락 — 다음 절) |
| 21 | `tests/orders.test.ts` — 재고 정책·결제 성공 재고 테스트 7개 추가 (`inventory policy — order creation` 4개, `payment success` 3개) | ⑧는 S1–S5만 열거. 재고는 계획 범위 밖 | 7개 `it(…)` 추가 | **범위 밖** (#8·#16·#17의 검증 테스트. 코드가 범위 밖이면 테스트도 범위 밖으로 분류) |
| 22 | 검증 계약 공통 준비 「실패 토큰은 테스트마다 고유하고 식별 가능한 문자열(예: `FAIL-SECRET-TOKEN-7f3a`)」 | 같은 문장 | 사용 토큰은 `FAIL-123`(2회), `FAIL-1`(1회). 고유하지 않고, `'FAIL-1'`은 `'FAIL-123'`의 접두사라 문자열 검색 판별력이 약함 | 범위 안이나 **계약 미준수** (토큰 비노출 판정의 신뢰도 저하. 기능 차이 아님) |
| 23 | `docs/inventory-policy.md`, `docs/order-policy.md`, `docs/payment-policy.md` 수정 (보류 항목을 「(2026-10-16 확정)」 절로 승격, 「현재 제공 여부」 열 갱신) | 「이 계획은 정책 문서를 고치지 않는다. … 갱신은 승인자가 별도로 지시한다」 | 3파일 36줄 변경(커밋 `477e7ca`) | **범위 밖** (단 승인 기록이 이 문서들의 확정 문장을 결정 1~3의 근거로 인용하므로 소유자가 내용을 승인한 변경. 「별도 지시」가 있었는지는 이 기록으로 확인 불가 — 미확인) |
| 24 | `notes/pending-decisions.md` — 「2026-10-16 구현 시 확정」 절 추가 | 「건드리지 않는다」 | 20줄 추가 | **범위 밖** (#23과 동일 성격) |
| 25 | `notes/order-status-implementation.md` 신설 | 변경 범위 표에 없음. `implementer.md` 출력 규정(`notes/<topic>-implementation.md`)에는 부합 | 40줄 신규 | **범위 밖** (기록 파일. 코드·정책 아님) |

집계: 범위 안 12건(#1–5, #10, #11, #15, #18–20, #22는 범위 안이지만 계약 미준수로 별도 표기) / 승인으로 해제 4건(#6, #12, #13, #14) / **범위 밖 9건**(#7, #8, #9, #16, #17, #21, #23, #24, #25).

범위 밖 9건의 성격 구분:
- 코드 동작 변경 4건: #8(결제 시 재고 재검사·차감), #16(`src/inventory.ts`), #17(생성 시 재고 차단·미차감), #9(payments.ts catch 제거). 이 중 #8·#16·#17은 `notes/order-status-plan.md`와 정책 문서 「확정」 절에 소유자 확정 근거가 있고, #9는 AGENTS.md Rules에 근거가 있으나 l17 계획은 명시적으로 미수정으로 적었다.
- 코드 정리 1건: #7(`parseCardToken` `value` 제거). 동작상 토큰 노출 경로를 좁히는 방향.
- 테스트 1건: #21(재고 테스트 7개).
- 문서·기록 3건: #23, #24, #25.

## 시나리오 ↔ 테스트 매핑

기준: HEAD `tests/orders.test.ts` (`payment failure`·`admin order list` 블록은 9cb009c와 동일). 「부분」은 테스트가 있으나 계획의 기대 결과 중 일부 단언이 빠진 경우.

| ID | 시나리오 | 매핑된 테스트 (describe › it) | 판정 | 빠진 단언 |
| --- | --- | --- | --- | --- |
| S1 | 실패 주문의 실패 정보 노출 | `admin order list › shows a payment_failed order with failure amount, time, and reason` (관리자 행·`failure.amountKrw === 46_000`·`reason` 문자열·`at` 문자열); `payment failure › returns 402 with failure info, preserves the order as payment_failed, and keeps stock` (`GET /orders/:id` 200·`status === 'payment_failed'`) | 부분 | `failure.reason === 'card_declined'` 정확값 미단언(`expect.any(String)`), `failure.at` ISO 8601 형식 미단언(`typeof === 'string'`만). 관리자 행 `status`는 `'payment_failed'`로 단언 — 결정 4-b 반영(계획 원문의 `'결제실패'` 단언은 해제됨) |
| S2 | 카드 토큰 비노출 | `payment failure › returns 402 …` (`JSON.stringify(response.body)`에 `FAIL-123` 없음 — 402 응답만); `admin order list › shows a payment_failed order …` (`JSON.stringify(row)`에 `FAIL-1` 없음 — 관리자 행만) | 부분 | `GET /orders/:id` 응답 본문의 토큰 비포함 미단언, `cardToken` 키가 어느 깊이에도 없음 미단언, `failure.reason`이 토큰의 부분 문자열이 아님 미단언, 토큰이 테스트별 고유 문자열 아님(#22) |
| S3 | 일반 주문에 `failure` 없음 | `admin order list › uses the stored status for other orders and attaches no failure info to them` (`pending`/`paid` 행 `not.toHaveProperty('failure')`, 각 `status` 단언) | 충족 | — |
| S4 | 실패 주문 보존 | `payment failure › returns 402 …` (`GET /orders/:id` 200, `status === 'payment_failed'`) | 부분 | 「관리자 목록 행 수 = 생성한 주문 수」 미단언(관리자 테스트는 `find`로 해당 행 존재만 확인) |
| S5 | 보존된 실패 주문 재결제가 상태·이력을 바꾸지 않음 | `payment failure › rejects re-payment of a payment_failed order without changing status, history, or stock` (`status !== 200`, 저장 상태 `payment_failed` 유지, `paymentAttempts.length` 불변) + 같은 블록 첫 테스트의 `failed.toHaveLength(1)` | 부분 | `400`과 `{ message: 'Order is not payable' }` 정확값 미단언(`not.toBe(200)`만). 재결제 **후** 해당 `orderId`·`ok===false` 레코드가 정확히 1개라는 단언은 없고, 길이 불변으로 간접 보장 |
| S6 | `deriveDisplayStatus()` 무변경 | 해당 함수가 삭제됨(결정 4-b). 관찰 증거: `admin order list › uses the stored status …`의 `rows.some(o => o.status === '결제실패') === false` | 승인으로 해제 (계획 원문 기준으로는 **불충족** — 아래 명령 (5) 출력 있음) | 계획의 S6 판정 기준(「함수 본문 diff 없음」, 「관리자 `status === '결제실패'`」)은 결정 4-b로 반대 방향이 됐다. 그 반대 방향을 단언하는 테스트는 있음 |
| S7 | 데이터 불일치(실패 이력 0개 또는 2개 이상) → `500` | 없음. `grep -n "500\|Inconsistent" tests/orders.test.ts` 매치 없음 | **미검증** | 구현(`src/admin.ts` `findFailure` + `500` 분기)은 있으나 스토어를 직접 조작해 0개·2개·`failureReason` 누락 경로를 호출하는 테스트가 없다. AGENTS.md Rules 「해당 동작을 검증하는 테스트 없이 상태를 변경하지 않는다」 관점에서 reviewer 확인 필요 |

## 실행한 명령과 결과

작업 디렉터리 `/Users/stosgh/Code/order-ops`, HEAD `f99731f`. 1~3번은 HEAD 전체(PR #2·#3 포함)에 대한 결과이지 PR #1 단독 결과가 아니다.

| 순서 | 명령 | 결과 원문(요약 줄) | 통과 기준 대비 |
| --- | --- | --- | --- |
| 1 | `npm test` | `✓ tests/orders.test.ts (29 tests) 48ms` / `Test Files  1 passed (1)` / `Tests  29 passed (29)` (vitest v2.1.9) | 통과. 기존 4 + PR #1 추가 11 + PR #2·#3 추가 14 = 29 |
| 2 | `npm run typecheck` | `> tsc --noEmit` 출력 없음, 종료 코드 0 | 통과 |
| 3 | `npm run lint` | `> eslint src tests` 출력 없음, 종료 코드 0 | 통과 |
| 4 | `git diff e8c7010 9cb009c --stat` (계획 (4)) | `11 files changed, 475 insertions(+), 90 deletions(-)` — 파일 목록은 「대조 대상」 참조 | **불충족**: 계획 기준 허용 집합(`src/store.ts`, `src/payments.ts`, `src/admin.ts`, `tests/orders.test.ts`) 외 7개 파일(`src/inventory.ts`, `src/orders.ts`, docs 3, notes 2) 포함 → 「계획 대비 차이」 #16·#17·#23·#24·#25 |
| 5 | `diff <(git show e8c7010:src/admin.ts \| sed -n '/^function deriveDisplayStatus/,/^}/p') <(git show 9cb009c:src/admin.ts \| sed -n '…')` (계획 (5), 9cb009c 기준) | `1,7d0` + 기준 함수 7줄 전부 `<`로 출력 (우측 비어 있음 = 함수 삭제), 종료 코드 1 | 계획 원문 기준 **불충족**, 결정 4-b로 **승인 해제**. HEAD 작업 트리 기준으로도 동일 출력(`grep deriveDisplayStatus\|결제실패 src/admin.ts` 매치 없음) |
| 6 | `git diff e8c7010 9cb009c -- src tests \| grep -nE '^\+' \| grep -nE -e 'cardToken' -e 'card\.value'` (계획 (6)) | 매치 4줄: `+  return { shouldFail: cardToken.startsWith('FAIL') };`(parseCardToken 내부), `+    const card = parseCardToken(req.body.cardToken);`(기존 유입 지점), `+async function pay(orderId: string, cardToken: string) {`·`+  … .send({ cardToken });`(테스트 헬퍼) | 통과. 4줄 모두 계획이 허용한 「기존 `parseCardToken`/`req.body.cardToken` 줄」 또는 테스트의 요청 전송부이며, `src/admin.ts`·`src/store.ts`·`PaymentAttempt` 생성 경로(`recordFailure`)에 토큰 값이 들어가는 줄은 없음. `card.value` 매치 0건(필드 자체 삭제, #7) |
| 보조 | `git diff --name-only 9cb009c HEAD -- src tests` | `src/admin.ts src/cancellations.ts src/inventory.ts src/refunds.ts src/server.ts src/store.ts tests/orders.test.ts` | HEAD가 대조 범위보다 앞서 있음을 확인(위 「대조 대상」 주석) |
| 보조 | `payment failure`·`admin order list` describe 블록 9cb009c ↔ HEAD `diff` | 차이 없음(종료 코드 0; admin 블록은 sed 범위 끝에 다음 describe 헤더 2줄이 끼어든 것 외 동일) | 시나리오 매핑을 HEAD 기준으로 해도 PR #1 테스트와 같음 |

실행하지 않은 것: 수동 `npm start` + curl 재현(`notes/order-status-implementation.md`에 PR #1 작성자가 수행했다고 적혀 있으나 이 세션에서 재실행하지 않음 — 2차 보고). S7 경로의 실제 `500` 응답은 테스트도 수동 재현도 없어 **미검증**.

## Handoff

- 계획 경로: `/Users/stosgh/Code/order-ops/notes/plans/l17-admin-failure-reason.md` (승인 기록 포함)
- 이 기록 경로: `/Users/stosgh/Code/order-ops/notes/implementer-check-l17.md`
- diff 범위: `e8c7010..9cb009c` (PR #1). 검증 명령은 HEAD `f99731f`에서 실행(PR #2·#3·#4 포함 상태).
- 코드 수정: 없음. `src/`·`tests/`·`docs/` 미변경(`git status --short`: 추적 파일 변경 0건. 미추적은 `.claude/`, `docs/prompts/`, `notes/plans/`, 이 기록, 그리고 이 세션이 만들지 않은 `notes/role-split-run-l17.md`).
- 범위 밖 항목 9건 (계획 대비 차이 #번호):
  - #7 `src/payments.ts` `parseCardToken()` `value` 필드 제거
  - #8 `src/payments.ts` 성공 분기 재고 재검사 `409` + `deductStock()`
  - #9 `src/payments.ts` `try/catch → 200 {ok:false}` fallback 제거
  - #16 `src/inventory.ts` 신설
  - #17 `src/orders.ts` 생성 시 재고 차감 제거·부족 시 `409`
  - #21 `tests/orders.test.ts` 재고 테스트 7개 추가
  - #23 `docs/inventory-policy.md`·`docs/order-policy.md`·`docs/payment-policy.md` 수정
  - #24 `notes/pending-decisions.md` 수정
  - #25 `notes/order-status-implementation.md` 신설
- 승인으로 해제된 항목 4건: #6(402 응답, 결정 1-A-ii), #12(불일치 500, 결정 3-a), #13(admin catch→[] 제거, 결정 3-a), #14(`deriveDisplayStatus()` 삭제, 결정 4-b)
- reviewer가 판단할 것:
  1. 범위 밖 9건 중 코드 4건(#7·#8·#9·#16·#17)을 「다른 승인 계획(`notes/order-status-plan.md`)의 범위」로 수용할지, l17 계획 이탈로 기록할지. l17 계획 자체가 해당 계획의 존재를 결정 1 배경에 적어 두었다.
  2. S7(불일치 → 500) 테스트 부재 — 구현은 있으나 검증 없음. AGENTS.md Rules 위반 여부.
  3. S1·S2·S4·S5의 누락 단언(사유 정확값 `card_declined`, ISO 8601, `GET /orders/:id`의 토큰 비포함, `cardToken` 키 부재, 재결제 `400`·메시지 정확값, 관리자 행 수) 보강 요구 여부.
  4. #22 실패 토큰이 테스트별 고유 문자열이 아닌 점(`FAIL-1`이 `FAIL-123`의 접두사).
  5. #23·#24 정책 문서 수정에 대한 「승인자의 별도 지시」 존재 여부 — 이 기록으로는 확인 불가.
