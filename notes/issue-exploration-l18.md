# Issue #6 탐색 결과 (Lab 18 E3)

입력은 [Issue #6](https://github.com/seotaioh/order-ops/issues/6) 본문뿐이다. 탐색 기준 커밋은 `3718f3b`(브랜치 `lab18/issue-kickoff`)이며, `git diff --stat 10bc0a1 HEAD -- src tests`가 비어 있어 `src/`·`tests/`는 main `10bc0a1`과 동일하다. 코드는 수정하지 않았다. 재현은 서버를 띄우지 않고 스크래치 디렉터리의 supertest 스크립트로 `app`을 직접 호출했다(`npx tsx`). 카드 토큰은 모사 접두사(`FAIL-…`, `CARD-…`)만 썼다.

## 재현 결과

### 현재 코드 (`src/` = main `10bc0a1`)

Issue의 Current Behavior 1~5가 **그대로 재현됐다.**

| 단계 | 요청 | 응답 | 저장 상태 (프로브가 `store`를 직접 읽음) |
| --- | --- | --- | --- |
| 1 | `POST /orders` `{"items":[{"productId":"keyboard","quantity":1}]}` | `201`, `status: "pending"`, `totalKrw: 49000` | 재고 keyboard 5 |
| 2 | `POST /orders/:id/pay` `{"cardToken":"FAIL-…"}` | `402 { ok:false, orderId, status:"payment_failed", failure:{ reason:"card_declined", amountKrw:49000, at } }` | `status=payment_failed`, 실패 이력 1건(`ok:false, failureReason:"card_declined"`), 재고 5 |
| 3 | `POST /orders/:id/pay` `{"cardToken":"CARD-…"}` (재결제) | **`400 { "message": "Order is not payable" }`** | `status=payment_failed`, 실패 이력 **여전히 1건**, 재고 **5 (변화 없음)** |
| 4 | `GET /orders/:id` | `200`, `status: "payment_failed"` (본문은 `Order` 원본 그대로, `failure` 정보 없음) | — |
| 5 | `GET /admin/orders` | `200`, 해당 행 `{ id, totalKrw, status:"payment_failed", createdAt, failure:{ amountKrw, at, reason:"card_declined" } }` | — |

추가 관찰(같은 프로브):

- 결제 가능 상태가 아닌 다른 주문도 **같은 본문**으로 거부된다: `paid` 재결제 → `400 {"message":"Order is not payable"}`, `cancelled` 결제 → 동일, `refunded` 재결제 → 동일. Issue의 「모든 경우에 같은 문구」 관찰이 맞다.
- `payment_failed` 주문에 **빈 토큰**(`""`) 또는 **토큰 누락**(`{}`)을 보내도 `400 Order is not payable`이다. 대조로 `pending` 주문에 빈 토큰을 보내면 `400 {"message":"Invalid card token"}`이다. 상태 검사가 토큰 검사보다 먼저 실행된다는 뜻이다(아래 「관련 코드」).
- 같은 상태의 환불·취소 거부는 본문에 `status`가 들어 있다: `400 {"message":"Order is not refundable","status":"payment_failed"}`, `400 {"message":"Order is not cancellable","status":"payment_failed"}`. 결제 거부만 `status` 없이 `message` 하나다.
- 실패 주문 A 뒤에 **새 주문 B**를 만들어 `CARD-…`로 결제하면: B 결제 `200 ok:true`, `GET /orders/B` → `paid`, 관리자 목록은 A 행 `payment_failed`(+`failure`)·B 행 `paid` 두 줄, 재고 5→4. 즉 「상세는 결제 완료, 관리자 목록에는 결제실패 행이 남아 있음」이 **서로 다른 두 주문**이라면 현재 코드에서도 관찰된다(원인 가설 H4).
- 테스트 기준선: `npm test` → `tests/orders.test.ts` 36건 전부 통과(vitest v2.1.9).

### v0 코드 (`e8c7010`, `git diff 22b5de9 e8c7010 -- src`가 비어 있어 초기 커밋과 동일)

`git archive e8c7010 src`로 꺼낸 소스에 같은 프로브를 돌렸다.

| 단계 | 응답 | 저장 상태 |
| --- | --- | --- |
| 1 | `201 pending` | 재고 keyboard 5 → **4** (v0는 `src/orders.ts:62`에서 주문 생성 시 재고를 차감) |
| 2 `FAIL-…` | **`200 {"ok":false}`** | 주문 **삭제됨**(`orders.delete`), 실패 이력 1건(사유 코드 없음), 재고 4 유지 |
| 3 `CARD-…` 재결제 | **`404 {"message":"Order not found"}`** | — |
| 4 `GET /orders/:id` | `404` | — |
| 5 `GET /admin/orders` | `200 []` (행 없음) | — |

v0에서도 VOC가 말한 「두 번째 결제 성공」은 일어나지 않는다. 결제 실패 즉시 주문이 삭제되므로 재결제는 404다.

## 관련 정책

| 문서·위치 | 문장 (인용) | 이 Issue와의 관계 |
| --- | --- | --- |
| `docs/payment-policy.md:14` | 「`payment_failed`가 된 동일 주문에는 새 결제를 시도하거나 성공 처리하지 않는다. 거부된 재결제 요청은 기존 주문 상태와 결제 이력을 변경하지 않아야 한다.」 | 재결제 금지의 원칙 문장. AC 「상태」「저장 결과」의 근거 |
| `docs/payment-policy.md:17-21` 「동일 주문 재결제 정책의 승격」 | 「이 결정은 사람이 명시적으로 확정했으며 … 후속 작업은 이 정책을 다시 선택하거나 재결제를 묵시적으로 허용해서는 안 된다.」 | (B)는 이 문장을 뒤집어야 한다 → 사람 결정 1 |
| `docs/payment-policy.md:23` | 「네트워크 오류나 인프라 오류 때문에 같은 요청을 다시 전송하는 기술적 재시도의 허용 여부, 식별 방식과 횟수 제한은 이 결정에 포함되지 않는다.」 (`:55` 보류 사항에도 같은 항목) | 현재 코드는 재결제와 기술적 재시도를 구분할 수단이 없어 둘 다 같은 400을 받는다. 보류 항목이므로 확정하지 않는다 |
| `docs/payment-policy.md:41` 「확정된 응답 (2026-10-16)」 | 「`payment_failed` 주문 재결제 요청 → `400 Bad Request`, `{ "message": "Order is not payable" }` (결제 가능 상태가 아닌 주문에 쓰던 기존 응답을 그대로 사용) / 상태·이력·재고 변경 없음」 | 현재 응답은 **확정 문서와 일치**한다. (A)로 본문·상태 코드를 바꾸면 이 행을 함께 고쳐야 한다 → 사람 결정 2·3 |
| `docs/payment-policy.md:12` | 「외부에 제공하는 실패 정보에는 카드 정보, 내부 오류, 예외 메시지와 스택 트레이스를 포함하지 않는다.」 | (A)에서 거부 본문에 넣을 수 있는 정보의 상한 |
| `docs/payment-policy.md:49-51` | 환불 거부 `400 { "message": "Order is not refundable", "status" }`; `refunded`·`cancelled` 주문의 결제는 「같은 응답(`Order is not payable`)으로 거부」 | 거부 본문에 `status`를 넣는 선례(환불·취소)와, 결제 거부 문구가 네 상태에 공유된다는 확정 |
| `docs/order-policy.md:33` 전환표 | 「`payment_failed` → 같은 주문 재결제 성공 처리 → `paid` → **금지** → 실패 주문의 재결제를 허용하지 않기로 승인함」 | (B)의 전제가 되는 금지 전환. `:34` `payment_failed → pending`도 금지 |
| `docs/order-policy.md:44` | 「상태를 바꾸지 않는 조회와 거부 응답은 전환으로 간주하지 않는다. 금지 또는 보류된 요청은 기존 주문 상태와 보존된 이력을 변경하지 않아야 한다.」 | (A)는 전환이 아니므로 전환표를 건드리지 않고도 가능하다는 근거 |
| `docs/order-policy.md:53-55`, `:69`, `:74-77` 관리자 조회 기준 | 「결제 실패 정보는 `payment_failed` 주문에만 조건부로 제공」, 「`payment_failed` 주문의 실패 이력이 정확히 하나가 아니면 … 불일치다. 재결제가 금지되어 있으므로 2개 이상은 정상 흐름에서 생기지 않는다. … `500`」 | 거부된 재결제를 `paymentAttempts`에 `ok:false`로 남기는 설계는 이 불변식을 깨 관리자 목록을 500으로 만든다(아래 「확인한 사실」 8) |
| `docs/order-policy.md:80-88` 노출 제외 정보 | 카드 토큰·내부 예외·원시 오류 응답을 관리자 목록에 포함하지 않음 | 관리자 쪽 후속 정보를 늘릴 때의 상한 |
| `AGENTS.md:22`, `:34` | 「요청한 동작이 정책에서 보류되어 있으면 편집 전에 멈춘다」, 「사람의 승인이 필요한 정책을 임의로 확정하지 않는다」 | 이 탐색에서 (A)/(B)·상태 코드·형식을 확정하지 않는 이유 |
| `notes/pending-decisions.md:27-36`, `:80-82` | 「실패 주문은 재결제를 허용하지 않는다 … 확정」, 「`payment_failed` 주문 재결제 거부 응답: 기존 `400 { message: 'Order is not payable' }` 유지, 새 정책을 만들지 않음 … 확정」 | 두 결정 모두 사람이 확정한 기록. Issue의 사람 결정 1·2는 이 확정을 **재검토**하는 질문이다 |

## 관련 코드

| 역할 | 위치 | 내용 |
| --- | --- | --- |
| 재결제 거부를 결정하는 함수 | `src/payments.ts:40-43` `isPayable(order)` | `order.status === 'pending' && order.totalKrw > 0`만 참. `payment_failed`·`paid`·`cancelled`·`refunded`를 구분하지 않고 boolean 하나를 돌려준다 |
| 거부 응답 문구가 만들어지는 곳 | `src/payments.ts:86-89` | `if (!isPayable(order)) { res.status(400).json({ message: 'Order is not payable' }); return; }` — 고정 문자열 하나. 상태·사유·다음 행동 필드 없음 |
| 거부 분기의 실행 순서 | `src/payments.ts:80-95` | 404(주문 없음) → **400 not payable** → 400 Invalid card token 순. 그래서 `payment_failed` 주문은 토큰 유효성과 무관하게 `not payable`을 받는다(재현 결과 (ii)) |
| 실패 이력이 저장되는 위치 | `src/store.ts:26-33` `PaymentAttempt`, `:56` `paymentAttempts: PaymentAttempt[]`; `src/payments.ts:56-66` `recordFailure()` (`paymentAttempts.push`, `failureReason: 'card_declined'`), `:97-108` 실패 분기(`order.status = 'payment_failed'`, 402) | 이력은 **결제 처리 단계에 진입한 시도만** 남는다. 거부 분기(`:86-89`)는 `recordFailure`/`recordSuccess` 이전에 `return`하므로 거부된 재결제는 어떤 이력도 남기지 않는다 |
| 관리자 목록이 실패 정보를 붙이는 위치 | `src/admin.ts:84-101` `toAdminOrder()` (`:91-93` `status === 'payment_failed'`일 때만 `base.failure = findFailure(order)`); `:54-64` `findFailure()` | `paymentAttempts.filter(orderId 일치 && !ok)`가 **정확히 1건**이 아니면 `InconsistentRecordError` → `:105-116`에서 `500 { message: 'Inconsistent payment failure record', orderId }` |
| 관리자 행에 없는 것 | `src/admin.ts:28-39` `AdminOrder` | 필드는 `id`·`totalKrw`·`status`·`createdAt`·`failure?`·`refund?`·`cancellation?`. 재결제 시도 여부, 거부 횟수, 대체 주문(새 주문) 연결 같은 후속 처리 정보는 없다 |
| 고객 단건 조회 | `src/orders.ts:80-89` `GET /orders/:id` | 저장된 `Order`를 그대로 직렬화. `failure`·사유·안내 없음(`notes/pending-decisions.md:148-150` PI-6 DTO 메모와 연결) |
| 라우터 결합 | `src/server.ts:11-15` | `/orders`에 orders·payments·refunds·cancellations 라우터, `/admin`에 admin 라우터 |
| 거부 본문 선례 | `src/refunds.ts:32`, `src/cancellations.ts:30` | `{ message: 'Order is not refundable' \| 'Order is not cancellable', status: order.status }` — 거부 사유로 `status`를 붙이는 기존 형식 |

## 관련 테스트

모두 `tests/orders.test.ts`. `npm test` 36건 통과(이번 세션 실행).

| 테스트 이름 | 위치 | 단언하는 것 | Issue AC와의 간격 |
| --- | --- | --- | --- |
| `payment failure › rejects re-payment of a payment_failed order without changing status, history, or stock` | `:195-208` | `CARD-…` 재결제 → `status !== 200`, 주문 `payment_failed`, `paymentAttempts.length` 불변, 재고 불변 | 응답은 `not.toBe(200)`만 — **HTTP 코드·본문 정확값 미단언** |
| `review follow-ups › (d) rejects a second FAIL attempt on a payment_failed order and keeps exactly one failure record` | `:524-541` | `FAIL-…` 재시도 → **`400`**, 본문 **`toEqual({ message: 'Order is not payable' })`**, 주문 `payment_failed`, 해당 주문 `!ok` 이력 정확히 1건, 재고 불변, 관리자 200 + `failure.reason === 'card_declined'` | 현재 응답을 **정확값으로 고정**한다. (A)로 상태 코드나 본문 필드를 바꾸면 이 테스트가 실패한다(`toEqual`이라 필드 추가도 실패) |
| `payment failure › returns 402 with failure info, preserves the order as payment_failed, and keeps stock` | `:171-193` | 첫 실패의 402 본문, 토큰 비노출, 실패 이력 1건 | 재현 2단계의 기존 보장 |
| `payment success › does not deduct stock again when a paid order is paid a second time` | `:137-149` | `paid` 재결제 `status !== 200` | 같은 거부 분기를 쓰는 이웃 상태. 문구 변경 시 영향 범위 |
| `refund flow › does not allow paying a refunded order again` | `:324-336` | `refunded` 재결제 `status !== 200` | 같은 분기 |
| `cancel flow › does not allow paying or refunding a cancelled order` | `:433-447` | `cancelled` 결제 `status !== 200` | 같은 분기 |
| `admin order list › shows a payment_failed order with failure amount, time, and reason` | `:216-230` | 관리자 행의 `failure` | 재현 5단계의 기존 보장 |
| `(a) … when a payment_failed order has two failure records` | `:569-575` | 실패 이력 2건 → 관리자 `500` | 거부 재결제를 `ok:false` 이력으로 남기면 안 되는 이유를 고정 |
| `(c) never exposes card tokens or a cardToken key in any response` | `:501-522` | 모든 응답에 토큰·`cardToken` 키 없음 | (A) 본문 설계의 제약을 검증하는 기존 장치 |

Issue 「테스트 증거」 AC가 요구하는 「상태·응답·저장 결과를 한 테스트에서 판정」은 `CARD-…` 재결제에 대해서는 **아직 없다**(`:195-208`은 응답 정확값을 보지 않고, `:524-541`은 `FAIL-…` 재시도만 다룬다).

## 확인한 사실

1. 현재 코드에서 Issue의 Current Behavior 1~5가 그대로 재현된다(「재현 결과」 표, 프로브 출력).
2. 재결제 거부 뒤 주문 상태 `payment_failed`, 실패 이력 1건, 재고 5가 모두 유지된다(프로브가 `store.orders`·`paymentAttempts`·`products`를 직접 읽음; `tests/orders.test.ts:195-208`, `:524-541`도 같은 내용을 고정).
3. 거부 응답 `400 { "message": "Order is not payable" }`은 `docs/payment-policy.md:41`의 확정 응답 및 `notes/pending-decisions.md:80-82`의 사람 결정과 일치한다. 즉 현재 동작은 결함이 아니라 **정책대로**다. Issue가 문제 삼는 것은 「안내 부재」다.
4. 같은 문구가 `paid`·`cancelled`·`refunded`·`payment_failed` 네 상태에 공유된다(프로브). `src/payments.ts:41-42`의 `isPayable`이 boolean만 돌려주고 `:87`이 고정 문자열을 쓰기 때문이다. 정책도 공유를 명시한다(`docs/payment-policy.md:41`, `:50-51`).
5. 상태 검사가 토큰 검사보다 먼저라서 `payment_failed` 주문은 토큰이 비어 있어도 `not payable`을 받는다(프로브 (ii), `src/payments.ts:86-95`).
6. 거부된 재결제는 어떤 이력도 남기지 않는다(`src/payments.ts:86-89`가 `recordFailure` 전에 `return`; 프로브에서 이력 1→1). 그래서 관리자 목록에는 「고객이 재결제를 시도했다」는 정보가 **구조적으로 없다**. 이는 `docs/payment-policy.md:14` 「결제 이력을 변경하지 않아야 한다」와 부합한다.
7. 관리자 행(`src/admin.ts:28-39`)에는 후속 처리 정보(재시도 여부, 대체 주문, 안내 여부)가 없고, 고객 단건 조회(`src/orders.ts:88`)에는 실패 정보 자체가 없다. 실패 사유가 고객에게 전달되는 유일한 시점은 첫 실패의 402 응답이다.
8. 거부 재결제를 `paymentAttempts`에 `ok:false`로 기록하는 설계는 `src/admin.ts:55-57`의 「실패 이력 정확히 1건」 불변식을 깨 관리자 목록 전체를 `500`으로 만든다(`tests/orders.test.ts:569-575`가 그 동작을 고정). 후속 설계 시 제약이다.
9. 환불·취소 거부는 `{ message, status }` 형식이고(`src/refunds.ts:32`, `src/cancellations.ts:30`, 프로브 (iii)), 결제 거부만 `{ message }`다. 거부 본문에 상태를 싣는 선례는 이미 저장소 안에 있다.
10. 기존 테스트 `(d)`(`:534-535`)가 `400`과 본문을 `toEqual`로 고정한다. (A)·(B) 어느 쪽이든 응답을 바꾸면 이 테스트와 `docs/payment-policy.md:41`을 같은 변경에서 고쳐야 한다(이는 kickoff Stop condition 「기대값이 정책과 다름」의 대상이 아니라, 정책 변경이 먼저인 경우다).
11. `src/payments.ts`의 이력은 `22b5de9`(초기)와 `1501eb7` 두 커밋뿐이다(`git log --oneline -- src/payments.ts`). `e8c7010`은 초기 커밋과 `src/`가 같다(`git diff 22b5de9 e8c7010 -- src` 비어 있음).
12. v0에서는 첫 실패가 `200 {"ok":false}` + 주문 삭제이고 재결제는 `404`다(프로브). VOC의 「두 번째 결제 성공 응답」은 **v0에서도 현재 코드에서도 재현되지 않는다.**
13. Lab 17 README(`labs/lecture17/README.md:13-14`, `:112`)는 「실패 주문은 보존되지만 … `deriveDisplayStatus()`는 수정하지 않음 … 잘못된 표시 상태가 관찰 가능해집니다. 이 현상은 Lab 18 VOC Issue의 출발점입니다」라고 적는다. 이 fork는 그 중간 상태를 거치지 않았다(`notes/role-split-run-l17.md:8-15`, `:96`, `:115`; PR #1에서 `deriveDisplayStatus()`가 제거됨).
14. 현재 코드에서 실패 주문 A 뒤 새 주문 B를 결제하면 B 상세 `paid`, 관리자 목록에 A `payment_failed`·B `paid`가 함께 남는다(프로브 (i)). 정책대로의 정상 동작이다.

## 원인 가설과 검증 방법

「안내 부재」의 직접 원인은 사실 4·6·7에서 코드로 확인된다(가설이 아님): 거부 분기가 상태를 구분하지 않는 고정 문자열이고, 거부가 이력을 남기지 않으며, 고객 조회와 관리자 행에 후속 안내 필드가 없다. 아래는 **VOC가 관찰한 환경**에 대한 가설이다.

| # | 가설 | 지지 근거 | 반증 근거 | 검증 방법 | 판정 |
| --- | --- | --- | --- | --- | --- |
| H1 | VOC 환경 = Lab 17이 전제한 업스트림 중간 상태(실패 주문 보존 + `deriveDisplayStatus()` 유지). 그 상태에서 재결제가 성공하면 상세는 `paid`, 관리자는 실패 이력 존재만으로 `결제실패`를 표시해 VOC와 정확히 일치한다 | `labs/lecture17/README.md:112`가 이 현상을 「Lab 18 VOC의 출발점」이라고 명시. v0 `src/admin.ts:14-20` `deriveDisplayStatus()`는 실패 이력이 하나라도 있으면 `결제실패` | 이 fork의 git 이력에 그 중간 상태 코드가 없음(사실 11·13) | 업스트림 템플릿 저장소의 Lab 17 시작 커밋을 받아 같은 프로브(`scratchpad/probe/repro.mts`)를 돌린다. 이 fork 안에서는 검증 불가 | **미검증(가장 유력)** |
| H2 | VOC 환경 = v0(`e8c7010`) | Issue 지시문의 후보 | 프로브: v0는 실패 시 주문 삭제, 재결제 `404`, 관리자 행 없음 → VOC의 「성공 응답」「관리자에 결제실패 표시」 둘 다 불가 | 완료(프로브) | **기각** |
| H3 | VOC 환경 = 현재 코드이며 고객이 **같은 주문**으로 재결제 | — | 프로브: 재결제 `400`, 상세 `payment_failed` → 「성공 응답」「상세 결제 완료」 불가 | 완료(프로브) | **기각** |
| H4 | VOC 환경 = 현재 코드이며 고객이 **새 주문**을 만들어 결제했고 이를 「다시 결제」로 서술함. 상세(새 주문)는 `paid`, 관리자 목록에는 원래 주문이 `payment_failed`로 남아 「계속 결제실패로 표시」로 보임 | 프로브 (i)에서 같은 관찰이 재현됨(사실 14). VOC는 주문 ID를 적지 않음 | VOC 추가 정보 「동일 주문에서 첫 결제 토큰은 `FAIL`」·「두 번째 결제 요청은 성공 응답」 — 「동일 주문」 서술과 충돌. 단 식별 정보가 제거돼 주문 ID 동일 여부는 VOC로 확인 불가 | VOC 접수 채널에 「두 결제의 주문 ID가 같았는가」를 되묻는다(사람). 이 fork 안에서는 더 좁힐 수 없음 | **미검증(대안)** |

H1·H4 어느 쪽이든 **이 fork의 현재 코드에서 사용자가 부딪히는 것**은 「실패한 주문을 다시 결제할 수 없고, 왜 안 되는지·무엇을 해야 하는지 어디에도 없다」로 같다. Issue가 이것을 Current Behavior로 잡은 것은 재현과 일치한다.

## Acceptance Criteria·사람 결정 대조

### Acceptance Criteria

| AC | 탐색으로 답할 수 있는가 | 현재 상태 | 남는 것 |
| --- | --- | --- | --- |
| 상태: 재결제 요청 뒤 `payment_failed`·실패 이력 1건 | 예 | **이미 성립**(프로브, `tests/orders.test.ts:205-206`, `:536-537`) | (B)를 택하면 이 AC 자체가 바뀐다 |
| 응답: HTTP 상태·본문이 (A)/(B) 결정에 맞음 | 아니오 | 현재 `400 { message }`. (A)의 「거부 사유와 다음 행동을 구분하는 필드」는 없음 | 사람 결정 1·2·3이 끝나야 값이 정해진다. 결정 전에는 테스트 기대값을 쓸 수 없다 |
| 저장 결과: 재고·결제 이력·주문 상태 불변 | 예 | **이미 성립**(프로브: 재고 5→5, 이력 1→1, 상태 유지; `:207`, `:538`) | — |
| 테스트 증거: `tests/orders.test.ts`에 세 가지를 판정하는 테스트, `npm test` 통과 | 부분 | 상태·저장 결과 단언은 있음. `CARD-…` 재결제의 **응답 정확값 단언은 없음**(`:204`는 `not.toBe(200)`). `FAIL-…` 재시도는 `(d)`가 현재 값으로 고정 | 결정 뒤 새 테스트 추가 + `(d)` `:534-535` 기대값 갱신 |

### Human Decision Needed

| # | 질문 | 탐색이 보탤 수 있는 사실 | 결정 주체 |
| --- | --- | --- | --- |
| 1 | 재결제 금지 유지(A) / 변경(B) | 금지는 두 정책에 「확정·승격」으로 적혀 있고(`docs/payment-policy.md:17-21`, `docs/order-policy.md:33`, `:51`) 사람 결정 기록이 있다(`notes/pending-decisions.md:27-36`). (B)는 전환표 `:33`·`:34`, 승격 절, 관리자 불변식(`docs/order-policy.md:77` 「2개 이상은 정상 흐름에서 생기지 않는다」), `src/admin.ts:55-57`, 테스트 `(d)`·`:569-575`까지 연쇄로 바뀌며 Issue Out of Scope다. (A)는 `docs/order-policy.md:44`에 따라 전환이 아니므로 전환표를 건드리지 않는다 | **사람**. 이 탐색은 선택하지 않는다(`AGENTS.md:34`) |
| 2 | (A)일 때 `400` 유지 / `409` | `409`는 이미 「결제 시점 재고 부족」(`src/payments.ts:114`, `docs/payment-policy.md:42`)과 주문 생성 재고 부족(`src/orders.ts:64`)에 쓰이며 본문 형식이 `{ message, productId }`로 다르다. `400`은 환불·취소 거부(`{ message, status }`)와 입력 오류(`Invalid card token`)에 쓰인다. 어느 쪽이든 `(d)` `:534`와 `docs/payment-policy.md:41`을 함께 고쳐야 한다 | **사람** |
| 3 | 다음 행동 안내 형식(예 `nextAction: "create_new_order"`) | 저장소 안에 `nextAction` 선례는 없다(grep: Issue 초안에만 등장). 가장 가까운 선례는 거부 본문의 `status` 필드(`src/refunds.ts:32`, `src/cancellations.ts:30`). 상한: 카드 정보·내부 오류 금지(`docs/payment-policy.md:12`), 테스트 `(c)` `:501-522`가 토큰 비노출을 검사. 참고로 「기술적 재시도」는 정책 보류(`docs/payment-policy.md:23`, `:55`)라 안내 문구가 재시도 허용을 암시하면 보류 사항을 묵시적으로 확정하는 셈이 된다 | **사람** |
| 4 | VOC 환경 확인 방법 | 이 fork 이력(v0·현재)에서는 VOC의 「성공 응답」이 재현되지 않는다(사실 12). 유일한 유력 후보는 업스트림 Lab 17 전제 상태(H1)이며 이 fork에는 없다. 대안으로 새 주문 경로(H4)는 현재 코드에서 같은 관찰을 낸다. 둘을 가르려면 업스트림 코드 입수 또는 VOC 채널 재질의가 필요하다 | **사람**이 「현재 코드 기준」으로 닫을지 정한다. 탐색은 「fork 안에서는 더 확인할 수 없다」까지만 말할 수 있다 |

## 아직 확인하지 못한 것

- VOC가 관찰한 실제 환경과 코드 버전(H1·H4 미검증). 업스트림 템플릿 저장소의 Lab 17 시작 코드는 이 세션에서 입수하지 않았다.
- VOC의 두 결제가 같은 주문 ID였는지(식별 정보 제거로 원문에서 확인 불가).
- 고객용 화면·채널이 `400` 본문의 `message`를 어떻게 보여 주는지(이 저장소에 UI 없음, Issue Out of Scope).
- `npm run lint`·`npm run typecheck`는 이번 세션에서 실행하지 않았다(코드 변경이 없어 `npm test`만 기준선으로 돌렸다).
- 네트워크 수준 재시도(같은 요청 재전송)를 현재 코드가 재결제와 구분하지 못한다는 점은 코드로 확인했지만, 운영에서 실제로 그런 재전송이 발생하는지는 확인하지 않았다(정책 보류 항목).
- 처리되지 않은 예외의 500 응답 형식(PI-1, `notes/pending-decisions.md:144-146`)은 이 Issue 경로에서 발생하지 않는 것으로 보이나 전수 확인은 하지 않았다.

## 다음 단계(구현은 하지 않음)

1. 이 문서를 Issue #6 코멘트로 게시한다(승인자 확인 후).
2. 사람 결정 1~4의 답을 받는다. 결정 1이 (B)면 Issue Out of Scope이자 kickoff Stop condition(「정책이 금지한 전환」)이므로 별도 정책 변경 작업으로 분리하고 이 Issue는 멈춘다.
3. 결정 1이 (A)면 `docs/prompts/planner.md` 역할로 `notes/plans/issue-6-repayment-rejection-guidance.md`를 쓴다. 검증 계약 시나리오는 Issue AC 네 개를 그대로 쓰고, 변경 후보 범위는 다음으로 한정한다(계획 단계에서 확정): `src/payments.ts:86-89`(거부 본문), `tests/orders.test.ts:195-208`·`:524-541`(기대값 갱신 + `CARD-…` 재결제의 응답·상태·저장 결과를 한 테스트로 판정), `docs/payment-policy.md:41`(확정 응답 표 갱신, 사람 승인 필요), `notes/pending-decisions.md`(결정 기록). `isPayable()`의 boolean 시그니처를 상태별 사유로 바꿀지는 계획에서 다룬다. 관리자 목록 변경은 결정 3에 「운영자 안내」가 포함될 때만 범위에 넣는다.
4. plan 승인 전에는 `src/`·`tests/`를 바꾸지 않는다.
