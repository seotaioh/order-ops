# Assertion review — 의미 있는 assertion (Lab 14)

작성 2026-10-17. 기준 HEAD `f66fc2c`(브랜치 `labs/backfill-08-16`). 대상: `tests/orders.test.ts` 37개 테스트(분리 전)와 분리 뒤 `tests/orders.test.ts`·`tests/payments.test.ts`·`tests/admin.test.ts`. 정책: `docs/order-policy.md`, `docs/payment-policy.md`, `docs/inventory-policy.md`. `src/**`는 읽기만 했다(`git diff --stat -- src` 빈 출력).

## 0. Lab 전제와 이 fork의 차이

| Lab 14 README의 전제 | 이 fork의 실제 |
| --- | --- |
| 시작 상태는 Lab 12 구현 + Lab 13 복구 커밋, 테스트는 Lab 12의 15개 | PR #1~#3·Lab 17 후속·Lab 20 회귀·P1 보강을 거친 **37개** |
| 관리자 구현은 실패 시도로부터 `'결제실패'`를 파생하고 실패 사유 저장 필드가 없다 → E3에서 `it.fails()` 후보 | `src/admin.ts`는 저장 상태 그대로 표시하고 `failure { amountKrw, at, reason }`를 첨부한다(PR #1). `PaymentAttempt.failureReason`이 있다. **정책 불일치·미구현이 남아 있지 않아 `it.fails()`로 표시할 대상이 없다** |
| 얕은 assertion: `creates an order` 201, `gets an order` 200, `lists admin orders` `Array.isArray` | 동일하게 남아 있다(1절). 그 밖의 느슨한 단언 13곳은 2026-10-16 P1(`notes/plans/p1-exact-assertions.md`, reviewer `notes/reviewer-findings-p1-assertions.md`)에서 정확값으로 교체돼 **0건** |
| E2·E3에서 새 assertion 추가 | 이번 작업 범위는 **새 테스트를 짓지 않고 37개를 이름·단언 그대로 파일별로 이동**하는 것(6절). 얕은 4개의 보강은 후속 후보로 적는다(5절) |

## 1. E1 — 정책–assertion 연결표 (assertion 원문 기준)

테스트 이름이 아니라 `expect(...)` 원문으로 판정했다. 줄 번호는 분리 **후** 파일 기준.

### 1-1. 주문 생성·조회

| 정책 문장 | 관찰할 값 | assertion 원문 | 위치 | 판정 |
| --- | --- | --- | --- | --- |
| inventory-policy 「`pending`으로 저장하는 것만으로는 재고를 차감하지 않는다」 | 응답 `status`, 저장 여부, 전후 재고 | `expect(response.status).toBe(201)` / `expect(response.body.status).toBe('pending')` / `expect(orders.has(response.body.id as string)).toBe(true)` / `expect(stockOf('keyboard')).toBe(before)` | `tests/orders.test.ts` `stores a pending order without changing stock when stock is sufficient` | 깊음 — 응답·저장·부수효과 세 관찰면 모두 |
| order-policy 「유효한 주문이 생성되어 저장됨 → `pending`」 | 같음 | `expect(response.status).toBe(201)` **만** | `tests/orders.test.ts:43-47` `creates an order` | **얕음** — 201이면 `status`가 무엇이든, 재고가 줄어도 통과 |
| (조회) 생성한 주문과 조회 응답의 일치 | `id`·`items`·`totalKrw`·`status` | `expect(response.status).toBe(200)` **만** | `tests/orders.test.ts:49-54` `gets an order` | **얕음** — 다른 주문을 돌려줘도 통과. 단, 다른 테스트의 `fetched.body.status` 단언(`payment failure`·`refund flow`·`cancel flow`)이 조회의 `status` 일치는 간접 보장 |

### 1-2. 재고 부족

| 정책 문장 | 관찰할 값 | assertion 원문 | 위치 | 판정 |
| --- | --- | --- | --- | --- |
| inventory-policy 「재고 부족 응답」 `409`, `{ message: 'Insufficient stock', productId }` , 미저장, 불변 | 상태 코드·본문·`orders.size`·재고 | `expect(response.status).toBe(409)` / `expect(response.body).toEqual({ message: 'Insufficient stock', productId: 'monitor' })` / `expect(orders.size).toBe(0)` / `expect(stockOf('monitor')).toBe(before)` | `tests/orders.test.ts` `blocks an order whose quantity exceeds stock…` | 깊음 (P1에서 `not.toBe(201)` → `toBe(409)` + `toEqual` 본문) |
| 「동일 `productId` 수량 합산」 | 6+5 > 10 | 같은 네 단언, `productId: 'mouse'` | `aggregates quantities of the same product before checking stock` | 깊음 |
| 「상품 하나라도 부족하면 … 어떤 상품의 재고도 변경하기 전에 차단」 | 두 상품 재고 | `expect(stockOf('keyboard')).toBe(keyboardBefore)` / `expect(stockOf('monitor')).toBe(monitorBefore)` | `does not change any stock when one product of a multi-item order is short` | 깊음 |
| 「여러 상품이 부족해도 한 상품만 알리며」(첫 상품) | 두 상품 모두 부족일 때 `productId` | 없음 | — | **공백** (backlog P3, P1 reviewer 권고 4). 현재 구현은 요청 순서의 첫 상품을 돌려주므로 추가하면 통과할 것으로 예상 — 미실행 |

### 1-3. 결제 성공·실패·재결제

| 정책 문장 | 관찰할 값 | assertion 원문 | 위치 | 판정 |
| --- | --- | --- | --- | --- |
| inventory-policy 「한 번만 차감」, order-policy `pending → paid` | 상태·재고·성공 이력 수 | `expect(orders.get(orderId)?.status).toBe('paid')` / `expect(stockOf('keyboard')).toBe(before - 2)` / `expect(paymentAttempts.filter((a) => a.orderId === orderId && a.ok)).toHaveLength(1)` | `tests/payments.test.ts` `deducts stock exactly once and marks the order paid` | 깊음 |
| payment-policy 「결제 거부 사유 코드」 `already_paid`/`none` | 2차 결제 본문 | `expect(second.body).toEqual({ message: 'Order is not payable', status: 'paid', reason: 'already_paid', nextAction: 'none' })` | `does not deduct stock again when a paid order is paid a second time` | 깊음 (Issue #6 뒤 정확값) |
| 「결제 시점 재고 부족」 `409`, `pending` 유지, 이력 미기록 | 상태 코드·본문·상태·재고·이력 | `toBe(409)` / `toEqual({ message: 'Insufficient stock', productId: 'monitor' })` / `toBe('pending')` / `toBe(1)` / `toHaveLength(0)` | `refuses to confirm payment when stock became insufficient after order creation` | 깊음 |
| 「결제 실패 시 HTTP 402와 실패 정보 … 카드 정보 포함 금지」, 「삭제하지 않는다」 | 402·본문·보존·조회·재고·이력 | `toBe(402)` / `toBe('payment_failed')` / `toMatchObject({ amountKrw: 49_000, reason: expect.any(String) })` / `expectIso(response.body.failure.at)` / `not.toContain('FAIL-123')` / `fetched.status 200` / `stockOf === before` / `failed toHaveLength(1)` | `returns 402 with failure info, preserves the order as payment_failed, and keeps stock` | 깊음. `reason: expect.any(String)`은 느슨하지만 같은 값이 `(b)`에서 `toBe('card_declined')`로 고정됨(P1 reviewer 권고 3 — 중복 느슨, 비차단) |
| 「`payment_failed` … 재결제하지 않는다」, 거부 본문 `repayment_not_allowed`/`create_new_order` | 400 본문·상태·이력 수·재고 | `toBe(400)` / `toEqual({ … reason: 'repayment_not_allowed', nextAction: 'create_new_order' })` / `paymentAttempts.length toBe(attemptsBefore)` | `rejects re-payment of a payment_failed order…`, `(d) rejects a second FAIL attempt…` | 깊음 |
| 「`reason`은 안전한 사유 코드(현재 `card_declined`)만」 | 응답·관리자 행·이력의 `reason` | `toBe('card_declined')` 3곳 | `(b) reports the failure reason as the approved safe code card_declined` | 깊음 |
| 「카드 정보 … 포함하지 않는다」 | 7개 응답 + 저장소 | `expect(containsToken(response.body)).toBe(false)` × 7 / 저장소 2곳 | `(c) never exposes card tokens or a cardToken key in any response` | 깊음 |
| (기본) 결제 응답이 온다 | `ok` 필드 | `expect(response.body).toHaveProperty('ok')` **만** | `tests/orders.test.ts:56-61` `returns a payment result` | **얕음** — `ok: false`여도, 402여도 통과 |

### 1-4. 관리자 조회

| 정책 문장 | 관찰할 값 | assertion 원문 | 위치 | 판정 |
| --- | --- | --- | --- | --- |
| order-policy 「조건부 … `failure` 객체 하나로 `payment_failed`에만」 | 행 `status`·`failure`·토큰 | `toBe('payment_failed')` / `toMatchObject({ amountKrw: 46_000, reason: expect.any(String) })` / `expectIso(row.failure.at)` / `not.toContain('FAIL-1')` | `tests/admin.test.ts` `shows a payment_failed order with failure amount, time, and reason` | 깊음 |
| 「실패 시도가 존재한다는 이유만으로 … 덮어쓰지 않는다」, 「저장된 주문을 기준으로」 | 행 수·다른 상태 행·`'결제실패'` 부재 | `expect(rows).toHaveLength(orders.size)` / `toBe('pending')` / `toBe('paid')` / `not.toHaveProperty('failure')` × 2 / `rows.some(o => o.status === '결제실패') toBe(false)` | `uses the stored status for other orders and attaches no failure info to them` | 깊음 (행 수는 P1 추가) |
| 같은 문장 — `paid` 주문에 실패 이력이 함께 있을 때 | 200·`paid`·`failure` 없음·이력 2건 보존·재고 | A1~A7 (`toBe(200)`, `toBe('paid')`, `not.toHaveProperty('failure')`, `own toHaveLength(2)`, `not.toContain('결제실패')`, `before - 1`) | `keeps a paid order displayed as paid when a failure record also exists for it (Lab 20 regression)` | 깊음 |
| 「데이터 불일치 … `500`과 `{ message, orderId }` … 내부 예외 메시지는 노출하지 않는다」 | 0건·2건·사유 누락 → 500 본문, 스택 부재 | `toBe(500)` / `toEqual({ message: 'Inconsistent payment failure record', orderId })` / `not.toContain('Error')` / `not.toContain('at ')` / `not.toContain('failed attempts')` | `(a) …` 4개 | 깊음 |
| (기본) 목록이 배열이다 | 배열 여부 | `expect(Array.isArray(response.body)).toBe(true)` **만** | `tests/orders.test.ts:63-67` `lists admin orders` | **얕음** — 빈 배열(`catch → []` 회귀)이어도 통과. 단 `(a)`가 그 회귀를 500 단언으로 막는다 |
| `refunded`·`cancelled` 행의 조건부 정보 | `refund`·`cancellation`·다른 키 부재 | `toEqual({ amountKrw: 49_000, at: expect.any(String) })` / `expectIso` / `not.toHaveProperty('failure')` 등 | `tests/orders.test.ts` `shows refunded orders…`, `shows cancelled orders…` | 깊음 |

### 1-5. 판정 요약

- 깊은 assertion(상태·응답·저장·재고를 값으로 비교): 33개 테스트.
- 얕은 assertion(핵심 값을 묻지 않음): **4개** — `creates an order`, `gets an order`, `returns a payment result`, `lists admin orders`. 모두 강의 기준선 `e8c7010`부터 있던 기본 테스트이며, 각 값은 다른 깊은 테스트가 덮고 있다.
- 느슨한 상태 코드 패턴(`not.toBe(200)`·`not.toBe(201)`·`toBeGreaterThanOrEqual`·`typeof … .at`): `grep -n` 0건(P1 reviewer 「느슨한 단언 잔존」과 동일 결과).
- `it.fails()`·`it.skip()`·`it.todo()`: 0건.
- 정책 문장 중 어떤 assertion도 판정하지 않는 것: 「여러 상품 부족 시 첫 상품만」 1건(backlog P3).

## 2. E2 — 좋은 통과: 이 fork에서 이미 보강된 경로

이번 작업에서 새 assertion을 추가하지는 않았다. README E2가 요구하는 「약한 질문 → 강화할 관찰값」은 2026-10-16에 다음 두 번으로 이미 수행됐고, 그 결과가 1절의 깊은 assertion이다.

| 시점 | 바뀐 것 | 근거 |
| --- | --- | --- |
| Lab 17 후속 (`d1a76b2`, 29 → 36) | 불일치 500 경로 4개, `card_declined` 정확값, 토큰 비노출 전 응답, FAIL 재시도 | `notes/role-split-run-l17.md` 결정 표 4~7 |
| P1 (`faa1da9`, 36 → 37 단언 보강) | 느슨한 13곳 → 409·400 정확 본문, `expectIso` 6곳, 관리자 행 수 | `notes/plans/p1-exact-assertions.md`, reviewer 「정책 대조」 18행 모두 일치 |

## 3. E3 — 관리자 조회 결과 판정

README E3는 「관리자 조회 실패 사유 — 아직 저장·응답할 필드가 없음 → 정책 기준 테스트로 미구현을 드러냄 → `it.fails()`」을 예상한다. 이 fork에서 그 테스트를 일반 `it()`으로 돌리면 어떻게 되는지는 이미 suite에 답이 있다: `(b) reports the failure reason as the approved safe code card_declined`가 `expect((row?.failure as Record<string, unknown>).reason).toBe('card_declined')`를 단언하고 **통과**한다(`npm test` 37 passed).

| 판단축 | 이 fork의 답 | 근거 |
| --- | --- | --- |
| 상태의 정본 | 저장된 `order.status` | `src/admin.ts:88 status: order.status`; order-policy 「저장된 `Order.status`를 그대로 제공함」 |
| 조건부 정보 | `payment_failed`에만 `failure`, `refunded`에만 `refund`, `cancelled`에만 `cancellation` | `src/admin.ts:91-99`; 테스트 `uses the stored status…`, `shows refunded…`, `shows cancelled…` |
| 노출 경계 | 카드 토큰·내부 예외 메시지·스택 없음 | `(c)`, `(a)`의 `not.toContain` |
| 정책 상태 | 관리자 조회 기준은 모두 「확정」. 보류는 PI-1(처리되지 않은 예외의 500 형식)뿐 | `notes/pending-decisions.md` |

따라서 **`it.fails()`로 전환할 항목: 0건.** 정책 불일치도, 미구현도 현재 suite에서 재현되지 않는다. 이것은 "문제가 없다"가 아니라 "현재 assertion이 묻는 범위에서 불일치가 없다"는 뜻이다(미검증 영역은 5절).

## 4. E4 — 비교표

| 분류 | 테스트 / assertion 원문 | 질문한 값 | 정책 근거 | 실제 결과 | 다음 조치 |
| --- | --- | --- | --- | --- | --- |
| **나쁜 통과** | `lists admin orders`: `expect(Array.isArray(response.body)).toBe(true)` (`tests/orders.test.ts:63-67`, `e8c7010`부터 동일) | 배열인가 | order-policy 「저장된 주문을 기준으로 현재 상태와 … 최소 정보를 제공」 — 문장은 행 수·필드·상태를 요구하는데 assertion은 묻지 않음 | 통과. `catch { res.json([]) }` 시절에도 통과했을 assertion | 값은 `uses the stored status…`(행 수·상태·`failure` 부재)와 `(a)`(500)가 덮는다. 이 4개 기본 테스트는 이번 작업 규칙(이름·단언 불변)대로 남겼고, 삭제·강화는 후속 후보(5절) |
| **나쁜 통과** | `creates an order`: `expect(response.status).toBe(201)`; `gets an order`: `expect(response.status).toBe(200)`; `returns a payment result`: `expect(response.body).toHaveProperty('ok')` | 상태 코드 / `ok` 키 존재 | 1-1·1-3 참조 | 통과 | 같음 — 각각 `stores a pending order…`, 각 흐름의 `fetched.body.status`, `deducts stock exactly once…`·`returns 402…`가 값을 고정 |
| **좋은 통과** | `does not deduct stock again when a paid order is paid a second time`: `expect(second.body).toEqual({ message: 'Order is not payable', status: 'paid', reason: 'already_paid', nextAction: 'none' })` + `stockOf toBe(before - 2)` + `paymentAttempts … toHaveLength(1)` | 2차 결제의 정확 본문, 재고 불변, 이력 1건 | payment-policy 「결제 거부 사유 코드」 표 `paid → already_paid / none`; inventory-policy 「중복 차감 금지」 | 통과 | 유지. `reason` 집합이 바뀌면 깨진다 |
| **좋은 통과** | `(a) when a payment_failed order has no failure record`: `expect(response.body).toEqual({ message: 'Inconsistent payment failure record', orderId })` + `not.toContain('Error')` | 불일치 시 500 본문과 내부 문자열 부재 | order-policy 「데이터 불일치의 판정과 응답 (2026-10-16 확정)」 | 통과 | 유지. Lab 15 류의 fallback 복원을 막는 회귀 장치 |
| **좋은 실패** | **해당 없음 (0건)** — 현재 suite에 실패하는 정책 기준 assertion이 없고 `it.fails()`도 없다 | — | — | — | 좋은 실패가 **생기지 않은 이유**: 이 fork는 Lab 14 순서(테스트가 먼저 미구현을 드러냄)와 달리 구현(PR #1)이 정책에 먼저 도달했고, 그 뒤 reviewer가 「테스트 없음」을 찾아 테스트를 추가하자 바로 통과했다(`notes/reviewer-findings-l17.md` (a)(b): 프로브로 동작은 정상, 테스트만 부재). 좋은 실패가 될 **후보**는 PI-1(처리되지 않은 예외 → JSON 500·스택 비노출)이지만, 현재 입력으로 예외에 도달하는 경로를 찾지 못해 테스트를 쓸 수 없다(`notes/pending-decisions.md` 보류). 보류 전환(`cancelled → pending`, `refunded → paid`)이 열리면 그 시점의 첫 테스트가 좋은 실패가 된다 |

Lab 15 인계: README가 넘기라는 「`it.fails()`로 표시한 관리자 테스트와 실패 원문」은 이 fork에 없다. 대신 Lab 15가 제거 대상으로 삼는 `src/admin.ts`의 `catch { res.json([]) }`와 `src/payments.ts`의 `catch (e) { console.log(e) }`는 **PR #1에서 이미 제거**됐고, 그 상태를 `(a)` 4개와 `(c)`가 고정한다(`grep -rn "console\." src/` → `src/server.ts:20` 리슨 로그 1건뿐).

## 5. 남은 공백·후속 후보 (이번 작업에서 수행하지 않음)

| 후보 | 이유 | 비고 |
| --- | --- | --- |
| 얕은 기본 테스트 4개의 값 보강 또는 삭제 | 1-5 | 이번 규칙(37개 이름·단언 불변) 밖. 보강 시 `creates an order`는 `pending`·저장·재고 불변, `gets an order`는 `id`·`items`·`totalKrw`·`status` 일치, `returns a payment result`는 `ok: true`·`paid`, `lists admin orders`는 행 수·필드로 |
| 「여러 상품 부족 시 첫 상품만」 | 1-2 공백 | backlog P3 |
| `reason: expect.any(String)` 2곳, `failed[0].failureReason toBeDefined()` 1곳 | 중복 느슨 (같은 값이 `(b)`에서 정확 고정) | P1 reviewer 권고 3, 선택 정리 |
| PI-1 JSON 500·스택 비노출 테스트 | 도달 경로 없음 | 사람이 500 형식을 정하고 미들웨어를 넣을 때 함께 |

## 6. 파일 분리 결과 (Lab 14 요구 파일 `tests/payments.test.ts`, `tests/admin.test.ts`)

원칙: 새 테스트를 짓지 않고 `tests/orders.test.ts`의 `describe` 블록을 영역별로 **이동**. 공용 헬퍼는 `tests/helpers.ts`로 추출(vitest 기본 include는 `*.test.ts`라 테스트로 수집되지 않음 — `npm test` 출력에 `helpers.ts`가 없음). 이동은 원본 줄 범위를 그대로 복사하는 스크립트로 했고, 이동 전후 블록을 `diff`로 대조해 **바이트 단위 동일**함을 확인했다(아래 검증).

### 6-1. 헬퍼 (`tests/helpers.ts`)

`stockOf`, `expectIso`, `createOrder`, `pay`, `refund`, `cancel`, `OK_TOKEN`, `FAIL_TOKEN`, `containsToken`. 본문은 원본과 같고 `export`만 붙였다. 토큰 상수와 `containsToken`은 원래 `review follow-ups` describe 안의 지역 선언이었는데 `(b)(c)(d)`와 `(a)`가 두 파일로 갈라지므로 헬퍼로 올렸다.

### 6-2. 테스트 → 파일 대응 (37개)

| # | describe | 테스트 이름 | 이동 후 파일 |
| --- | --- | --- | --- |
| 1 | order operations | creates an order | `tests/orders.test.ts` |
| 2 | order operations | gets an order | `tests/orders.test.ts` |
| 3 | order operations | returns a payment result | `tests/orders.test.ts` |
| 4 | order operations | lists admin orders | `tests/orders.test.ts` |
| 5 | inventory policy — order creation | stores a pending order without changing stock when stock is sufficient | `tests/orders.test.ts` |
| 6 | inventory policy — order creation | blocks an order whose quantity exceeds stock without storing it or changing stock | `tests/orders.test.ts` |
| 7 | inventory policy — order creation | aggregates quantities of the same product before checking stock | `tests/orders.test.ts` |
| 8 | inventory policy — order creation | does not change any stock when one product of a multi-item order is short | `tests/orders.test.ts` |
| 9 | payment success | deducts stock exactly once and marks the order paid | `tests/payments.test.ts` |
| 10 | payment success | does not deduct stock again when a paid order is paid a second time | `tests/payments.test.ts` |
| 11 | payment success | refuses to confirm payment when stock became insufficient after order creation | `tests/payments.test.ts` |
| 12 | payment failure | returns 402 with failure info, preserves the order as payment_failed, and keeps stock | `tests/payments.test.ts` |
| 13 | payment failure | rejects re-payment of a payment_failed order without changing status, history, or stock | `tests/payments.test.ts` |
| 14 | admin order list | shows a payment_failed order with failure amount, time, and reason | `tests/admin.test.ts` |
| 15 | admin order list | uses the stored status for other orders and attaches no failure info to them | `tests/admin.test.ts` |
| 16 | admin order list | keeps a paid order displayed as paid when a failure record also exists for it (Lab 20 regression) | `tests/admin.test.ts` |
| 17 | refund flow | refunds a paid order: status refunded, stock restored once, refund recorded | `tests/orders.test.ts` |
| 18 | refund flow | rejects refund of a pending order without changing anything | `tests/orders.test.ts` |
| 19 | refund flow | rejects refund of a payment_failed order without changing anything | `tests/orders.test.ts` |
| 20 | refund flow | does not refund or restore stock twice for the same order | `tests/orders.test.ts` |
| 21 | refund flow | does not allow paying a refunded order again | `tests/orders.test.ts` |
| 22 | refund flow | returns 404 when refunding an unknown order | `tests/orders.test.ts` |
| 23 | refund flow | shows refunded orders in the admin list with refund amount and time only | `tests/orders.test.ts` |
| 24 | cancel flow | cancels a pending order without touching stock and records the cancellation | `tests/orders.test.ts` |
| 25 | cancel flow | rejects cancelling a paid order (policy forbids paid → cancelled) | `tests/orders.test.ts` |
| 26 | cancel flow | rejects cancelling payment_failed and refunded orders | `tests/orders.test.ts` |
| 27 | cancel flow | does not cancel the same order twice | `tests/orders.test.ts` |
| 28 | cancel flow | does not allow paying or refunding a cancelled order | `tests/orders.test.ts` |
| 29 | cancel flow | returns 404 when cancelling an unknown order | `tests/orders.test.ts` |
| 30 | cancel flow | shows cancelled orders in the admin list with the cancellation time only | `tests/orders.test.ts` |
| 31 | review follow-ups (Lab 17 reviewer findings) | (b) reports the failure reason as the approved safe code card_declined | `tests/payments.test.ts` |
| 32 | review follow-ups (Lab 17 reviewer findings) | (c) never exposes card tokens or a cardToken key in any response | `tests/payments.test.ts` |
| 33 | review follow-ups (Lab 17 reviewer findings) | (d) rejects a second FAIL attempt on a payment_failed order and keeps exactly one failure record | `tests/payments.test.ts` |
| 34 | review follow-ups › (a) admin list reports inconsistent failure records with 500 and no internals | when a payment_failed order has no failure record | `tests/admin.test.ts` |
| 35 | 같음 | when a payment_failed order has two failure records | `tests/admin.test.ts` |
| 36 | 같음 | when the failure record has no reason | `tests/admin.test.ts` |
| 37 | 같음 | does not report 500 when records are consistent | `tests/admin.test.ts` |

파일별 수: `orders.test.ts` 22 / `payments.test.ts` 8 / `admin.test.ts` 7 = 37. `refund flow`·`cancel flow`의 관리자 목록 테스트(#23·#30)는 환불·취소 흐름의 일부라 `orders.test.ts`에 남겼다(지시: 환불·취소는 orders에 남김).

### 6-3. 검증 (2026-10-17, 이 세션에서 직접 실행)

| 확인 | 명령 | 결과 |
| --- | --- | --- |
| 이름 집합 불변 | `diff <(git show HEAD:tests/orders.test.ts \| grep "^\s*it(" \| sort) <(cat tests/*.test.ts \| grep "^\s*it(" \| sort)` | 차이 없음 (37) |
| 단언 수 불변 | `grep -c "expect("` HEAD vs 분리 후 4파일 합 | 179 = 179 |
| 블록 바이트 동일 | 원본 줄 범위(38–126, 322–564 / 128–232, 579–640 / 234–320, 642–694) ↔ 새 파일 해당 범위 `diff` | 5개 블록 모두 출력 없음 |
| `npm test` | `vitest run` | `admin.test.ts (7)` `payments.test.ts (8)` `orders.test.ts (22)` — **Test Files 3 passed (3), Tests 37 passed (37)**, 종료 0 |
| `npm run typecheck` | `tsc --noEmit` | 출력 없음, 종료 0 |
| `npm run lint` | `eslint src tests` | 출력 없음, 종료 0 |
| `src/` 무변경 | `git diff --stat -- src` | 빈 출력 |
| 격리 | 세 파일 모두 각 describe의 `beforeEach(resetStore)` 유지. 파일 간 공유 상태는 `src/store.ts` 모듈 싱글턴뿐이며, vitest는 파일을 별도 워커에서 실행 | 전체 실행 37 통과. 단독 실행 `npx vitest run tests/<파일>`: orders 22 / payments 8 / admin 7 각각 통과 |
| 누적 셀프체크 | `node labs/tools/check.mjs 14` | Lab 12~14 필수·선택 산출물 PASS, 앱 검사 3개 PASS, `failure=0, warning=0` |

## 7. 미검증·한계

- 1절의 "깊음/얕음" 판정은 assertion 원문 읽기이고, 「중요한 값이 잘못 바뀌면 실제로 실패하는가」(회귀 감지)를 mutation으로 확인하지는 않았다. P1 reviewer가 18개 정확값 단언을 정책 문장과 글자 단위로 대조한 것(2차 인용)에 기댄다.
- 좋은 실패 0건은 "결함 없음"의 증명이 아니라 "현재 assertion 범위에서 불일치 없음"이다. 미검증 영역은 5절.
