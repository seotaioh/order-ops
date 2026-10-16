# 계획 — 관리자 주문 목록에 결제 실패 사유 노출 (Lab 17 E2)

> **North Star**: 관리자가 `GET /admin/orders` 한 번으로 결제 실패 주문의 실패 사유·금액·시각을 보되, 카드 토큰은 절대 보지 못한다.

| 항목 | 값 |
| --- | --- |
| 역할 | planner (`docs/prompts/planner.md`) — 코드 수정 없음 |
| 기준 코드 | 커밋 `e8c7010` (`docs: refine lab 16 review gates`, 2026-10-16 01:26 KST). 현재 작업 트리가 아니라 `git show e8c7010:<path>`로 읽은 내용을 근거로 한다 |
| 정책 원문 | 현재 트리의 `docs/order-policy.md`, `docs/payment-policy.md`. 단, 「(2026-10-16 확정)」·「(2026-10-16 구현)」 표기 문장은 이 요청 **이후** 확정이므로 근거로 쓰지 않고 「사람 결정 필요」 후보로만 다룬다. 어느 문장이 기준 시점에 있었는지는 `git diff e8c7010 HEAD -- docs/order-policy.md docs/payment-policy.md`로 확인했다 |
| 승인 상태 | **미승인.** 「사람 결정 필요」 4건에 답이 적힌 뒤에만 implementer로 넘긴다 |

---

## 요청 요약

요청 원문 (출처: `labs/lecture17/README.md` E2):

> 관리자 주문 목록(`GET /admin/orders`)에 결제 실패 주문의 실패 사유를 정책대로 노출한다. 민감한 결제 토큰은 노출하지 않는다. `deriveDisplayStatus()`의 기존 동작은 이번 작업에서 수정하지 않는다.

완료 조건 (요청자의 말 보존, Lab 17 E2 검증 항목):

- [ ] 관리자 응답에 정책에서 정한 실패 정보가 추가된다.
- [ ] 민감한 결제 토큰은 노출되지 않는다.
- [ ] `deriveDisplayStatus()` diff가 없다.
- [ ] 두 방식의 변경 범위와 검증 결과가 기록됐다. (이 계획이 역할 분리 쪽의 변경 범위 기록이다)

### 기준 코드(e8c7010)의 사실

| 파일 | 사실 | 요청과의 관계 |
| --- | --- | --- |
| `src/store.ts` | `OrderStatus = 'pending' \| 'paid' \| 'cancelled'`. `PaymentAttempt { orderId, ok, amountKrw, at }` — **실패 사유 필드 없음**. 카드 토큰은 저장하지 않음 | 노출할 사유 데이터가 아직 존재하지 않음 |
| `src/payments.ts` | `cardToken`이 `FAIL`로 시작하면 `recordAttempt(order, false)` 후 **`orders.delete(orderId)`**, 응답 `200 { ok: false }`. 성공 시 `status = 'paid'`. `isPayable()`은 `status === 'pending' && totalKrw > 0` | 실패 주문이 삭제되므로 관리자 목록에 실패 주문 행 자체가 생기지 않음 |
| `src/admin.ts` | `AdminOrder { id, totalKrw, status, createdAt }`. `deriveDisplayStatus()`(14–20행)는 해당 주문의 실패 이력이 하나라도 있으면 `'결제실패'`, 아니면 `order.status`. `GET /orders`는 `orders.values()`만 순회하고 예외 시 `[]` 반환 | 이번 변경의 중심 파일. `deriveDisplayStatus()`는 수정 금지 |
| `src/orders.ts` | 주문 생성 시 재고 즉시 차감, 재고 검사 없음 | 요청 범위 밖 — 건드리지 않음 |
| `tests/orders.test.ts` | 4개 테스트: 생성 201, 조회 200, 결제 응답에 `ok` 존재, 관리자 응답이 배열 | 실패 정보·토큰 비노출·주문 보존을 전혀 검증하지 않음 |

### 요청과 기준 코드 사이의 간극 (계획이 다뤄야 할 두 문제)

1. **실패 사유 필드가 없다** — 저장·응답 어디에도 없다. 정책(기준 시점 원문)이 「목표 정책을 위해 추가 저장·제공이 필요함」이라고 명시하므로 **요청 범위 안**으로 본다.
2. **실패 주문이 삭제된다** — 삭제되는 한 관리자 목록에 실패 주문 행이 없으므로 실패 사유 노출은 관찰·검증이 불가능하다. Lab 17 README는 「실패 주문은 보존되지만」을 시작 전 상태로 전제하지만 e8c7010은 그 전제를 충족하지 않는다. 보존을 이번 변경에 끌어들일지, 선행 작업으로 분리할지는 **범위 결정이므로 「사람 결정 필요 1」**로 보낸다. 아래 변경 범위는 「최소 보존을 포함하는 안(A)」을 기준으로 적고, 조건부 행을 표시한다.

---

## 정책 근거

바꿀 동작마다 어느 정책의 어느 문장이 근거인지 적는다. 「기준 시점」= e8c7010에 이미 있던 문장.

| # | 바꿀 동작 | 근거 문서·절 | 근거 문장 (요지) | 기준 시점 존재 |
| --- | --- | --- | --- | --- |
| P1 | 실패 사유를 저장하고 관리자 응답에 제공 | `docs/order-policy.md` 「관리자 조회 기준 › 필수·조건부 정보」 조건부 행 「결제 실패 사유」 | 표시 조건 `status === "payment_failed"`. 기준 시점 원문: 「현재 `PaymentAttempt`와 관리자 응답에 실패 사유 필드가 없으므로 목표 정책을 위해 추가 저장·제공이 필요함」 | 예 |
| P2 | 실패 금액·시각도 함께 제공 | 같은 표의 「결제 실패 금액」·「결제 실패 시각」 행; `notes/pending-decisions.md` 「관리자 목록에 실패 정보를 어느 범위까지 표시할까요?」 | 금액·시각은 `PaymentAttempt`에 「저장만 함」. 사람 결정 확정: 「실패 상태, 금액, 시각과 결제 실패 사유를 모두 표시한다」 | 예 |
| P3 | 조건부 정보는 `payment_failed` 주문에만 붙이고 일반 주문에는 붙이지 않음 | `docs/order-policy.md` 「관리자 조회 기준」 | 「조건부 정보는 일반 주문에 빈 값이나 추정값으로 붙이지 않는다」 | 예 |
| P4 | 첨부 조건은 **저장된** 주문 상태 | `docs/order-policy.md` 「`payment_failed` 주문 표시 조건」 | 「`order.status === "payment_failed"`일 때만 … 실패 시도가 존재한다는 이유만으로 … 덮어쓰지 않는다」 | 예 |
| P5 | 실패 정보의 출처는 해당 주문의 실패 이력뿐 | 같은 절 | 「실패 금액·시각·사유는 해당 주문의 실패 결제 이력에서 가져오며, 다른 주문의 이력이나 성공 이력을 결합하지 않는다」 | 예 |
| P6 | 카드 토큰 비노출, 사유는 안전한 코드만 | `docs/order-policy.md` 「노출 제외 정보」; `docs/payment-policy.md` 「결제 원칙」 | 「카드 토큰 … 원문·마스킹 여부와 관계없이 관리자 주문 목록에 포함하지 않음」, 「결제 실패 사유는 … 안전한 사유 코드나 정제된 설명이어야 하며, 카드 정보·내부 오류·스택 메시지·원시 오류 응답을 포함해서는 안 된다」, 「외부에 제공하는 실패 정보에는 카드 정보, 내부 오류, 예외 메시지와 스택 트레이스를 포함하지 않는다」 | 예 |
| P7 | 실패 주문을 삭제하지 않고 `orders`에 보존 (**결정 1에 종속**) | `docs/order-policy.md` 「상태 정의」·「`payment_failed` 주문 표시 조건」; `docs/payment-policy.md` 「결제 원칙」 | 「`payment_failed` 주문은 … 삭제하지 않고 보존한다」, 「관리자 목록의 기준은 `orders`에 보존된 주문이다. 결제 실패 주문도 삭제하지 않고 목록에 포함한다」, 「결제 실패 주문을 삭제하지 않는다」. 전환표 `pending → payment_failed` 허용 | 예 |
| P8 | 테스트 없이 상태를 바꾸지 않음 | `AGENTS.md` Rules | 「해당 동작을 검증하는 테스트 없이 상태를 변경하지 않는다」 | 예 |

근거로 쓰지 않은 문장 (요청 이후 확정 — 「사람 결정 필요」 후보로만 사용):

- `docs/order-policy.md`: 「조건부 정보는 `failure` 객체 하나로 묶어 …」, 「데이터 불일치의 판정과 응답 (2026-10-16 확정): … 정확히 하나가 아니면 … `500` …」, 표의 「`failure.reason` … 현재 `card_declined`」, 「(2026-10-16 구현)」 표기 행 전부.
- `docs/payment-policy.md`: 「확정된 응답 (2026-10-16)」 표 전부(`402` 본문 형식, `failureReason`, `card_declined`, 재결제 `400`).
- `notes/pending-decisions.md`: 「2026-10-16 구현 시 확정」 이하 전부.

정책 충돌 1건 (요청이 해소 방향을 지정함): P4는 관리자 `status`를 저장 상태 기준으로 표시하라고 하지만, `deriveDisplayStatus()`는 실패 이력 존재로 `'결제실패'`를 파생한다. 요청이 이 함수를 수정하지 말라고 했으므로 **표시 `status` 문자열은 그대로 두고, `failure` 첨부 조건만 P4대로 저장 상태를 쓴다**. 결과로 보존된 실패 주문의 표시 `status`는 `'결제실패'`, 저장 상태는 `payment_failed`가 된다. 이 불일치는 Lab 18의 출발점으로 남긴다(「사람 결정 필요 4」에서 인지 승인).

---

## 변경 범위

구현 브랜치는 `e8c7010`에서 분기한다고 가정한다. 「조건」 열이 비어 있으면 결정과 무관하게 바꾼다/건드리지 않는다.

| 파일 | 바꾼다 | 건드리지 않는다 | 조건 |
| --- | --- | --- | --- |
| `src/store.ts` | ① `PaymentAttempt`에 실패 사유 필드 추가. 값 타입은 **문자열 리터럴 유니온**(예: `type PaymentFailureReason = '<결정 2의 코드>'`)으로 정의해 토큰 파생 자유 문자열이 타입 수준에서 들어오지 못하게 한다. 성공 시도에는 값이 없다 | `Product`·`Order`·`OrderItem` 구조, `seedProducts`, `resetStore()`, 저장 기술(Map·배열). `refunded` 상태 추가 안 함(기존 결정: 이번엔 `payment_failed`만). 카드 토큰을 저장하는 필드를 **추가하지 않는다** | ① 무조건 |
| | ② `OrderStatus`에 `'payment_failed'` 추가 | | ② 결정 1 = A |
| `src/payments.ts` | ③ 실패 분기에서 `recordAttempt`에 사유 코드를 함께 기록 (`createAttempt` 시그니처에 사유 인자 추가, 성공 호출은 사유 없음) | `parseCardToken()`, `isPayable()`, 성공 분기(`completePayment`), `catch` fallback, 재고 처리(이 파일엔 없음), 라우트 경로. 재결제 거부 로직을 **새로 쓰지 않는다** — `isPayable()`이 `pending`만 허용하므로 보존된 `payment_failed` 주문은 기존 `400 Order is not payable`로 자동 거부된다(기계적 귀결, 새 정책 아님) | ③ 무조건 |
| | ④ `orders.delete(orderId)` 제거, 같은 분기에서 `order.status = 'payment_failed'` 설정 | ⑤ 실패 응답 `200 { ok: false }`는 **결정 1-A-ii에서 달리 정하지 않는 한 그대로** 둔다 | ④ 결정 1 = A |
| `src/admin.ts` | ⑥ `AdminOrder`에 선택적 `failure?: { reason, amountKrw, at }` 추가. ⑦ `toAdminOrder()`에서 **`order.status === 'payment_failed'`일 때만** 해당 주문의 실패 이력(`orderId` 일치 **그리고** `ok === false`)에서 `reason`·`amountKrw`·`at`을 구성해 첨부(P3·P4·P5). 다른 상태의 주문에는 `failure` 키 자체를 넣지 않는다(`undefined` 값도 넣지 않음). 실패 이력이 정확히 하나가 아닐 때의 동작은 **결정 3 확정 전까지 구현하지 않는다** | **`deriveDisplayStatus()` 본문(기준 코드 14–20행) 한 글자도 바꾸지 않는다.** `DisplayStatus` 타입 선언, `status: deriveDisplayStatus(order)` 호출, 기존 4개 필드, 라우트 경로, `orders.values()` 순회 기준, `catch { res.json([]) }` fallback(요청 밖·Lab 12 보존 경계). 카드 토큰·내부 오류·예외 메시지를 응답에 넣는 코드를 추가하지 않는다 | ⑥⑦ 무조건 (단 ⑦의 `'payment_failed'` 비교는 ②가 있어야 컴파일된다 → 결정 1에서 C를 고르면 이 계획은 성립하지 않는다) |
| `src/orders.ts` | — | 전부. 재고 차감 시점(생성 시 차감), 재고 검사 부재, 생성·단건 조회 응답 | |
| `src/server.ts` | — | 전부 | |
| `tests/orders.test.ts` | ⑧ 아래 「검증 계약」 시나리오 S1–S5 추가. 기존 4개 테스트는 유지 | 기존 테스트의 기대값을 낮추지 않는다 | S4·S5는 결정 1 = A |
| `docs/*.md`, `notes/pending-decisions.md` | — | 이 계획은 정책 문서를 고치지 않는다. 구현 후 `docs/order-policy.md` 표의 「현재 제공 여부」 열이 낡아지므로 갱신은 승인자가 별도로 지시한다 | |
| `labs/**` | — | 실습 중 수정 금지(`labs/CONVENTIONS.md`) | |

응답 형태 제안 (planner 설계안 — 정책이 비워 둔 부분이며 승인 시 바꿀 수 있음, 결정 2와 함께 확인):

```jsonc
// GET /admin/orders — payment_failed 주문 행
{ "id": "...", "totalKrw": 310000, "status": "결제실패", "createdAt": "...",
  "failure": { "reason": "<결정 2>", "amountKrw": 310000, "at": "..." } }
// 그 외 상태 주문 행 — failure 키 없음
{ "id": "...", "totalKrw": 49000, "status": "pending", "createdAt": "..." }
```

- 금액·시각·사유를 `failure` 하나로 묶은 이유: 조건부 정보 세 개를 각각 선택 필드로 흩뿌리면 「일부만 있는」 행이 타입상 가능해져 P3(「모두 있어야 한다」)을 코드가 보장하지 못한다. 묶으면 「있거나 없거나」 둘뿐이다.
- `status`가 `'결제실패'`인 것은 `deriveDisplayStatus()` 미수정의 결과다(정책 근거 절의 충돌 1건 참조).

요청에 없어 **넣지 않는** 개선: `402` 응답 전환(결정 1-A-ii로만 열림), 재고 차감 시점 변경, 재고 부족 차단, 환불·취소 흐름, 관리자 응답의 `payment_failed` 표시 상태 교정, `catch → []` fallback 제거, 고아 이력 처리 로직.

---

## 검증 계약

### 시나리오

공통 준비: `beforeEach(resetStore)`; 실패 토큰은 테스트마다 **고유하고 식별 가능한 문자열**(예: `FAIL-SECRET-TOKEN-7f3a`)을 써서 비노출을 문자열 검색으로 판정할 수 있게 한다.

| ID | 시나리오 | 준비 조건 | 행동 | 기대 결과 | 연결 | 조건 |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | 실패 주문의 실패 정보 노출 | 주문 생성(예: monitor×1) 후 `FAIL-…` 토큰으로 결제 | `GET /admin/orders` | 200, 배열에 해당 `id` 행이 있고 `failure.reason === <결정 2 코드>`, `failure.amountKrw === totalKrw`, `failure.at`이 ISO 8601 문자열. 같은 주문의 `GET /orders/:id`는 200이고 `status === 'payment_failed'` | P1·P2·P5·⑥⑦ | 결정 1 = A |
| S2 | 카드 토큰 비노출 | S1과 동일 | `GET /admin/orders`, `GET /orders/:id` | 두 응답 모두 `JSON.stringify(body)`에 토큰 문자열이 포함되지 않고, `cardToken`이라는 키가 어느 깊이에도 없음. `failure.reason`은 토큰의 부분 문자열이 아님 | P6 | — |
| S3 | 일반 주문에 `failure` 없음 | `pending` 주문 1건, `CARD-…` 토큰으로 결제 성공한 `paid` 주문 1건 | `GET /admin/orders` | 두 행 모두 `not.toHaveProperty('failure')`. `paid` 행 `status === 'paid'`, `pending` 행 `status === 'pending'` | P3·P4 | — |
| S4 | 실패 주문 보존 | 주문 생성 후 `FAIL-…` 결제 | `GET /orders/:id`, `GET /admin/orders` | 단건 404가 아니라 200. 관리자 목록 행 수가 생성한 주문 수와 같음 | P7·④ | 결정 1 = A |
| S5 | 보존된 실패 주문의 재결제가 상태·이력을 바꾸지 않음 (「실패 이력 정확히 하나」 가정의 가드) | S4 이후 | 같은 주문에 `CARD-…`로 다시 결제 | `400 { message: 'Order is not payable' }`(기존 `isPayable` 동작). `GET /orders/:id`는 여전히 `payment_failed`. `paymentAttempts` 중 해당 `orderId`·`ok === false` 레코드는 정확히 1개 | ③④·결정 3 전제 | 결정 1 = A |
| S6 | `deriveDisplayStatus()` 무변경 | 구현 완료 | 아래 명령 | 함수 본문 diff 없음. 보존된 실패 주문의 관리자 `status`가 `'결제실패'`(기존 파생 동작 유지의 관찰 가능한 증거 — S1에서 함께 단언) | 요청 3문장째 | — |
| S7 | 데이터 불일치(실패 이력 0개 또는 2개 이상) | 스토어 직접 조작 | `GET /admin/orders` | **결정 3 확정 후 추가.** 확정 전에는 테스트도 구현도 쓰지 않는다 | P3·결정 3 | 결정 3 |

### 실행 명령과 통과 기준

| 순서 | 명령 | 통과 기준 | 실패 시 |
| --- | --- | --- | --- |
| 1 | `npm test` | 기존 4개 + S1–S5(조건 충족분) 전부 통과 | 완료 판정 중단, 원인 해결 후 1부터 |
| 2 | `npm run typecheck` | `tsc --noEmit` 오류 0 | 동일 |
| 3 | `npm run lint` | `eslint src tests` 오류 0 | 동일 |
| 4 | 변경 파일 집합 확인 (아래 `(4)`) | 변경 파일이 위 표의 「바꾼다」 행과 정확히 일치(`src/store.ts`, `src/payments.ts`, `src/admin.ts`, `tests/orders.test.ts` 이외 없음) | 범위 이탈 → reviewer 보고 |
| 5 | `deriveDisplayStatus()` 본문 대조 (아래 `(5)`) | 출력 없음(함수 본문 동일) | 요청 위반 → 되돌림 |
| 6 | 토큰 유입 경로 검색 (아래 `(6)`) | `src/admin.ts`·`src/store.ts` 변경분과 `PaymentAttempt` 생성 경로에 토큰 값이 흘러드는 줄이 없음(기존 `parseCardToken`/`req.body.cardToken` 줄만 매치) | P6 위반 → 되돌림 |

4–6번 명령 (복사해 그대로 실행; zsh·bash 공통):

```bash
# (4) 변경 파일 집합
git diff e8c7010 --stat

# (5) deriveDisplayStatus 본문이 기준 코드와 동일한지 — 출력이 없어야 통과
diff <(git show e8c7010:src/admin.ts | sed -n '/^function deriveDisplayStatus/,/^}/p') \
     <(sed -n '/^function deriveDisplayStatus/,/^}/p' src/admin.ts)

# (6) 추가된 줄(+)에 카드 토큰 값이 흘러드는 코드가 없는지 — 매치가 없어야 통과
git diff e8c7010 -- src tests | grep -nE '^\+' | grep -nE -e 'cardToken' -e 'card\.value'
```

최종 보고에는 각 명령의 실제 출력 결과(성공·실패)를 남기고, 실행하지 못한 항목은 통과로 적지 않는다(`AGENTS.md` Before Final Response).

---

## 사람 결정 필요

선택지는 적되 선택하지 않는다. 「권장」은 planner의 의견일 뿐 확정이 아니다. 네 항목 모두에 답이 적혀야 implementer로 넘긴다.

### 결정 1. 실패 주문 보존(삭제 중단 + `payment_failed` 상태)을 이번 변경에 포함하는가?

배경: e8c7010은 실패 시 주문을 삭제한다. 보존 없이는 관리자 목록에 실패 주문 행이 없어 요청(실패 사유 노출)을 관찰·검증할 수 없고, `src/admin.ts`의 `order.status === 'payment_failed'` 비교도 컴파일되지 않는다. 한편 보존은 요청 문장에 직접 적혀 있지 않고, 이미 승인된 `notes/order-status-plan.md`(재고 시점 변경·402·재결제 거부까지 포함)의 일부다.

- **A. 최소 보존을 이번 변경에 포함** — `OrderStatus`에 `payment_failed` 추가, 실패 분기에서 삭제 대신 상태 전환. 재고·재고 부족 차단은 손대지 않음. (권장: 요청을 검증 가능하게 만드는 최소 집합이며 모두 기준 시점 정책 P7에 근거가 있음)
  - A-i. 결제 실패 응답은 기존 `200 { ok: false }` 유지 (요청 밖 변경 없음. 단 `payment-policy.md` 「HTTP 402」 원칙과는 계속 어긋난 채 남음)
  - A-ii. 이 기회에 `402`로 전환 (정책 정합성은 높아지나 응답 본문 형식이 기준 시점 정책에 없어 추가 결정 필요: 본문에 무엇을 넣는가)
- **B. 선행 작업으로 분리** — `notes/order-status-plan.md`를 먼저 구현·머지한 뒤 이 계획을 그 위에서 실행. 이 계획의 ②④와 S4·S5는 선행 작업으로 이동.
- **C. 보존 없이 admin만** — 성립하지 않음(관찰 불가·컴파일 불가). 선택지로만 기록.

답: ☐ A-i ☐ A-ii ☐ B — 승인자: ____ / 시각: ____

### 결정 2. 노출할 실패 사유 코드의 값과 어휘

배경: 기준 시점 정책은 「안전한 사유 코드나 정제된 설명」만 정하고 값은 비워 두었다. 현재 실패 조건은 토큰 접두사 `FAIL` 모사 하나뿐이다. 값은 토큰 내용에서 파생하면 안 된다(P6).

- **a.** 단일 코드 `card_declined` (후보 출처: 요청 이후 확정된 정책 문장 — 근거가 아니라 후보)
- **b.** 다른 이름(예: `payment_declined`, `mock_failure`) — 승인자가 지정
- 함께 확인: 저장 필드명 `PaymentAttempt.failureReason`, 응답 필드명 `failure.reason`, `failure` 객체 묶음 형태(변경 범위의 제안) — 이 셋은 정책 보류 항목이 아닌 설계안이므로 이의 없으면 그대로 간다.

답: ☐ a ☐ b(값: ______) / 필드명·묶음 형태 이의: ☐ 없음 ☐ 있음(내용: ______) — 승인자: ____ / 시각: ____

### 결정 3. `payment_failed` 주문의 실패 이력이 정확히 하나가 아닐 때(0개 또는 2개 이상) 관리자 응답

배경: 기준 시점 정책 원문은 「같은 주문에 실패 이력이 여러 개일 때 표시할 이력의 선택 기준은 사람의 결정이 필요하다」, 「주문 상태와 실패 이력이 일치하지 않으면 … 데이터 불일치로 판정한다」까지만 정하고 **응답은 비워 두었다**. 결정 1-A를 고르면 API 경로로는 이 상태가 생기지 않지만(첫 실패 후 `isPayable` 거부, S5), 데이터 구조상 가능하므로 implementer가 임의 규칙을 만들지 않도록 답이 필요하다. 참고: `src/admin.ts`의 기존 `catch { res.json([]) }`는 이 계획이 건드리지 않으므로, 핸들러 안에서 예외를 던지는 방식은 목록 전체가 `[]`로 삼켜진다.

- **a.** 목록 요청 전체를 `500`과 안전한 메시지(내부 예외 미노출)로 거부 (후보 출처: 요청 이후 확정 문장 — 근거 아님). 기존 `catch → []`와의 관계를 어떻게 할지 함께 정해야 함.
- **b.** 해당 행만 `failure` 없이 내보내고 정상 행은 유지 — 단 P3(「모두 있어야 한다」)와 충돌.
- **c.** 가장 이른/늦은 이력을 선택 — 정책 원문이 명시적으로 사람 결정으로 보류한 바로 그 규칙.
- **d.** 이번 변경에서는 S5로 「정확히 하나」만 보장하고 불일치 처리는 보류 항목으로 `notes/pending-decisions.md`에 적어 넘김.

답: ☐ a ☐ b ☐ c ☐ d — 승인자: ____ / 시각: ____

### 결정 4. 표시 `status` 불일치를 알고 진행하는가 (인지 승인)

배경: `deriveDisplayStatus()`를 수정하지 않으므로 보존된 실패 주문의 관리자 `status`는 `'결제실패'`로 표시되고 저장 상태는 `payment_failed`가 된다. 이는 정책 P4(「`payment_failed`로 표시」)와 어긋나지만 요청이 이 함수의 미수정을 명시했고 Lab 17 E4·Lab 18은 이 위험이 남아 있는 것을 전제로 한다. 결정이라기보다 「알고 간다」는 서명이다.

- **a.** 알고 진행한다. 이 불일치는 `notes/role-split-run-l17.md`의 남은 위험에 기록한다.
- **b.** 진행하지 않는다 — 요청 자체를 다시 쓴다.

답: ☐ a ☐ b — 승인자: ____ / 시각: ____

---

## Handoff 조건 (planner.md)

- 위 4건에 답이 적히기 전에는 implementer로 넘기지 않는다.
- 넘길 때 전달: 이 파일 경로, 승인자와 승인 시각, 승인되지 않은 항목 목록(있다면), 결정 1의 선택에 따라 활성화된 변경 범위 행(②④)과 시나리오(S4·S5) 목록.

---

## 승인 기록 (사람 승인 지점 1 — 계획 승인)

승인자: 저장소 소유자(seotaioh) / 시각: 2026-10-16 18:10 KST / 경로: Claude Code 대화에서 네 항목을 제시받고 「승인」으로 답함.
제시된 답은 같은 소유자가 2026-10-16 PR #1에서 확정한 결정(`notes/pending-decisions.md` 「2026-10-16 구현 시 확정」)과 같다.

| 결정 | 답 | 근거 |
| --- | --- | --- |
| 1. 실패 주문 보존 포함 여부 | **A-ii** — 최소 보존 포함, 실패 응답 `402`. 본문 `{ ok:false, orderId, status:'payment_failed', failure:{ reason, amountKrw, at } }` | pending-decisions 「결제 실패 API의 응답」 |
| 2. 실패 사유 코드 | **a** — `card_declined`. 필드명 `PaymentAttempt.failureReason` / 응답 `failure.reason`, `failure` 묶음 형태 이의 없음 | payment-policy 「확정된 응답」 |
| 3. 실패 이력이 하나가 아닐 때 | **a** — 목록 요청 전체를 `500 { message, orderId }`로 거부. 기존 `catch → []`는 silent fallback이라 제거 | order-policy 「데이터 불일치의 판정과 응답」, AGENTS.md Rules |
| 4. 표시 `status` 불일치 | **b** — 알고 두지 않는다. `deriveDisplayStatus()`를 정책대로(저장 상태 그대로 표시) 교체하는 범위를 승인. 이 계획의 「`deriveDisplayStatus()`를 건드리지 않는다」 행은 **소유자 결정으로 해제** | pending-decisions 「관리자 목록에 실패 정보를 어느 범위까지」 |

Lab 17 README는 `deriveDisplayStatus()` 미수정을 전제하지만 소유자는 정책 정합성을 택했다. reviewer는 이 차이를 「계획 이탈」이 아니라 「Lab 전제와의 차이(소유자 승인)」로 구분해 기록한다.

활성화된 변경 범위 행: ②④ 포함 전부. 활성화된 시나리오: S1~S7 전부(S7은 결정 3-a 기준).
