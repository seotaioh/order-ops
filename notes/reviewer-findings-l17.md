# Reviewer 발견 사항 — 관리자 주문 목록 결제 실패 사유 노출 (Lab 17 E2)

역할: reviewer (`docs/prompts/reviewer.md`). 코드는 고치지 않았다. 아래 모든 판정은 이 세션에서 직접 읽은 파일·실행한 명령 출력에 근거하며, 확인하지 못한 것은 「미확인」으로 표기했다.

## 검토 범위

| 항목 | 값 |
| --- | --- |
| 요청 | 「관리자 주문 목록에 결제 실패 주문의 실패 사유를 정책대로 노출한다. 민감한 결제 토큰은 노출하지 않는다.」 (`labs/lecture17/README.md` E2) |
| 승인된 계획 | `notes/plans/l17-admin-failure-reason.md` — 「승인 기록」 결정 1 = A-ii(보존 + 402), 결정 2 = a(`card_declined`), 결정 3 = a(불일치 시 목록 전체 500, `catch → []` 제거), 결정 4 = b(`deriveDisplayStatus()` 교체를 소유자가 승인) |
| 검토 diff | `git -C /Users/stosgh/Code/order-ops diff e8c7010 9cb009c -- src tests` (PR #1, 이미 `main`에 머지됨 — `git log`의 `9cb009c Merge pull request #1`) |
| 구현 기록 | `notes/order-status-implementation.md` |
| 정책 | `docs/order-policy.md`, `docs/payment-policy.md`, `docs/inventory-policy.md`, `AGENTS.md` |
| 테스트 기준 | `tests/orders.test.ts` HEAD(29개). `git status --short src tests` 출력 없음 → 작업 트리 = HEAD |
| 추가로 읽은 것 | `notes/order-status-plan.md`(PR #1이 실제로 따른 선행 계획), `notes/pending-decisions.md`, `labs/CONVENTIONS.md`, `labs/tools/rules/l17.json`, `node_modules/finalhandler/index.js`(Express 4 기본 에러 핸들러) |

분류 기준: 계획 「승인 기록」에 따라 `deriveDisplayStatus()` 삭제는 「계획 이탈」이 아니라 「Lab 전제와의 차이(소유자 승인)」로 둔다.

---

## 계획 이탈

계획의 「변경 범위」 표(`src/store.ts` ①②, `src/payments.ts` ③④⑤, `src/admin.ts` ⑥⑦, `tests/orders.test.ts` ⑧, 나머지 「건드리지 않는다」)와 실제 변경 파일 집합을 대조했다. 계획 명령 (4) `git diff e8c7010 9cb009c --stat` 결과: `src/admin.ts`, `src/inventory.ts`(신규), `src/orders.ts`, `src/payments.ts`, `src/store.ts`, `tests/orders.test.ts` + `docs/inventory-policy.md`, `docs/order-policy.md`, `docs/payment-policy.md`, `notes/order-status-implementation.md`, `notes/pending-decisions.md`. 계획이 허용한 4개 파일 외에 7개가 더 바뀌었다.

| # | 파일 | 근거 (diff) | 내용 | 심각도 |
| --- | --- | --- | --- | --- |
| PD-1 | `src/inventory.ts` (신규 45줄) | `diff --git a/src/inventory.ts` 전체 (`aggregateQuantities`, `findInsufficientProduct`, `deductStock`) | 계획 표에 행 자체가 없다. 재고 합산 검사·차감 로직 신설 | **차단** (사람 결정 필요 — 아래 Q1) |
| PD-2 | `src/orders.ts` | 삭제: `for (const item of items) { ... product.stock -= item.quantity; }` / 추가: `findInsufficientProduct(items)` → `409 { message: 'Insufficient stock', productId }` | 계획 표: 「`src/orders.ts` — 건드리지 않는다: **전부**. 재고 차감 시점(생성 시 차감), 재고 검사 부재」. 계획 「요청에 없어 넣지 않는 개선」에 「재고 차감 시점 변경, 재고 부족 차단」이 명시돼 있다 | **차단** (PD-1과 같은 원인) |
| PD-3 | `src/payments.ts` 성공 분기 | 추가: `const insufficient = findInsufficientProduct(order.items); if (insufficient !== null) { res.status(409)... }`, `deductStock(order.items);` | 계획 표: 「`src/payments.ts` — 건드리지 않는다: … 성공 분기(`completePayment`) … 재고 처리(이 파일엔 없음)」. 결제 시점 재고 재검사·차감은 계획 밖 | **차단** (PD-1과 같은 원인) |
| PD-4 | `src/payments.ts` 구조 변경 | 삭제: `try { … } catch (e) { console.log(e); res.json({ ok: false }); }`, `ParsedCardToken.value`, `createAttempt`/`recordAttempt`/`completePayment`/`rejectInvalidRequest` / 추가: `recordSuccess`/`recordFailure`/`toFailureInfo`, `PaymentFailureInfo` | 계획 표는 「`parseCardToken()`, `catch` fallback … 건드리지 않는다」고 적었으나 전부 바뀌었다. 다만 방향은 `AGENTS.md` 「silent fallback 금지」와 P6(토큰 보유 최소화)에 부합하고, `console.log(e)` 제거는 민감정보 측면에서 개선이다 | 권고 (기록으로 남기고 수용 여부 결정) |
| PD-5 | `tests/orders.test.ts` | 추가된 `describe('inventory policy — order creation')` 4개, `describe('payment success')` 3개 | 계획 ⑧은 S1–S7만 허용. 7개는 PD-1~3의 검증이며 이 계획 밖 | 권고 (PD-1~3의 처리에 따름) |
| PD-6 | `docs/order-policy.md`, `docs/payment-policy.md`, `docs/inventory-policy.md`, `notes/pending-decisions.md` | `git diff e8c7010 9cb009c -- docs notes/pending-decisions.md` — 「(2026-10-16 확정)」 절 추가, 「현재 제공 여부」 열 갱신, 보류 항목 삭제 | 계획 표: 「`docs/*.md`, `notes/pending-decisions.md` — 이 계획은 정책 문서를 고치지 않는다. … 갱신은 승인자가 별도로 지시한다」. `-- src tests` 범위 밖이지만 같은 PR에 포함 | 권고 (Q5 — 승인 기록이 「같은 소유자가 PR #1에서 확정」이라 적었으므로 사후 지시로 볼 수 있는지 확인) |
| PD-7 | 계획 명령 (4) 통과 기준 | 「변경 파일이 … 4개 이외 없음」 → 실제 11개 | 계획이 정한 범위 이탈 판정 조건이 그대로 성립 | (PD-1~6의 요약) |

### Lab 전제와의 차이 (소유자 승인 — 계획 이탈 아님)

| 파일 | 근거 | 내용 |
| --- | --- | --- |
| `src/admin.ts` | 삭제: `type DisplayStatus = Order['status'] \| '결제실패';`, `function deriveDisplayStatus(order) {…}` / 추가: `status: order.status`, `status: OrderStatus` | 계획 명령 (5) 실행 결과: `1,7d0 < function deriveDisplayStatus…` (함수 본문이 없어 diff 출력 있음, exit 1). Lab 17 E2 체크박스 「`deriveDisplayStatus()` diff가 없다」와 E4 「표시 상태의 기존 위험은 남아 있습니다」, Lab 18 출발점(잘못된 표시 상태 관찰)은 더 이상 성립하지 않는다. `DisplayStatus` 타입 삭제는 함수 교체의 귀결이라 같은 항목으로 둔다 (Q2) |
| `src/admin.ts` | 삭제: `catch { res.json([]); }` / 추가: `catch (error) { if (error instanceof InconsistentFailureRecordError) { res.status(500).json({ message: 'Inconsistent payment failure record', orderId: error.orderId }); return; } throw error; }` | 결정 3-a 승인 범위. 단 `throw error` 재던짐의 결과(Express 기본 핸들러)는 아래 PI-1 참조 |
| `tests/orders.test.ts` | `expect(rows.some((o) => o.status === '결제실패')).toBe(false);` | 계획 S6의 관찰 증거(`'결제실패'` 유지)와 정반대를 단언한다. 결정 4-b에 맞춘 것이며 일관됨 |

---

## 정책 이탈

정책 문장별로 diff 동작을 대조했다. 아래는 대조한 문장과 결과이며, **검토 범위 안에서 정책 문장과 어긋나는 동작은 발견하지 못했다.** (부재 증명이 아니라 「대조한 문장에서 발견 안 됨」이다. 대조 목록은 「확인한 범위」에 있다.)

주의가 필요한 경계 2건 (이탈은 아니나 기록):

| # | 정책 문장 | 관찰 | 판정 |
| --- | --- | --- | --- |
| PO-1 | `docs/order-policy.md` 「노출 제외 정보: 내부 예외 객체, 예외 메시지, 스택 트레이스와 서버 구현 세부 정보는 포함하지 않음」; `docs/payment-policy.md` 「외부에 제공하는 실패 정보에는 … 예외 메시지와 스택 트레이스를 포함하지 않는다」 | 알려진 입력으로는 지켜진다(프로브 결과 PI 절). 그러나 처리되지 않은 예외가 Express 기본 핸들러로 가면 비프로덕션에서 스택이 본문에 실린다(PI-1). 정책 위반이 **현실화되는 입력은 찾지 못했다**(미확인: 전수 증명 아님) | 이탈 아님 / 권고(PI-1) |
| PO-2 | `labs/lecture17/README.md` 「`deriveDisplayStatus()`의 기존 동작은 이번 lab에서 수정하지 않습니다」 | 삭제됨. 정책 문서가 아니라 Lab 전제이며 소유자 승인(결정 4-b)으로 해제됨 | 「Lab 전제와의 차이」로 분류 (위 절) |

---

## 테스트 누락

HEAD `tests/orders.test.ts`(29개)를 기준으로, 지시받은 4개 경로와 계획 S1–S7을 대조했다. 각 항목은 「어떤 테스트가 있는지 → 무엇이 빠졌는지 → 실제 동작(프로브)」 순이다. 프로브는 `src` 미수정, 스크래치 스크립트로 supertest 호출.

### (a) 관리자 목록의 데이터 불일치 500 경로 — **차단**

- 현재 테스트: `grep -n "500\|Inconsistent" tests/orders.test.ts` → 매치 없음. 500 응답을 단언하는 테스트가 **없다**.
- 빠진 것: 계획 S7(「결정 3 확정 후 추가」 — 승인 기록에 「활성화된 시나리오: S1~S7 전부」로 활성화됨), `docs/order-policy.md` 「데이터 불일치의 판정과 응답 (2026-10-16 확정)」의 `500 { message: 'Inconsistent payment failure record', orderId }`, 그리고 「내부 예외 메시지는 노출하지 않는다」가 전부 미검증. 누군가 `catch → []`를 복구하거나 메시지에 `error.message`를 넣어도 테스트는 통과한다.
- 실제 동작(프로브): 실패 이력 2개 → `500 {"message":"Inconsistent payment failure record","orderId":"…"}`, 0개 → 동일, 1개지만 `failureReason` 없음 → 동일. 본문에 `Error`/스택 문자열 없음, `content-type: application/json`. 동작은 정책대로이나 **테스트가 보호하지 않는다**.
- 근거: `AGENTS.md` Rules 「해당 동작을 검증하는 테스트 없이 상태를 변경하지 않는다」, 계획 S7. 테스트는 이미 `paymentAttempts`를 import하므로 스토어 직접 조작이 가능하다.

### (b) 실패 사유 값이 허용 코드 집합 안인지 — **차단**

- 현재 테스트: `tests/orders.test.ts:181` `reason: expect.any(String)`, `:227` `reason: expect.any(String)`, `:192` `failed[0].failureReason).toBeDefined()`. `card_declined` 문자열은 테스트 파일에 **한 번도 나오지 않는다** (`grep -n card_declined tests/orders.test.ts` → 없음).
- 빠진 것: 계획 S1 「`failure.reason === <결정 2 코드>`」(= `card_declined`), `docs/payment-policy.md` 「확정된 응답」 「`reason`은 안전한 사유 코드(현재 `card_declined`)만 사용」. 타입 `PaymentFailureReason = 'card_declined'`가 컴파일 시점에는 막지만, 이 타입을 `string`으로 넓히는 변경(예: 제공자 메시지를 그대로 담는 회귀 — 정책이 금지하는 바로 그 표류)은 어떤 테스트도 깨뜨리지 않는다.
- 실제 동작(프로브): 402 본문 `reason = card_declined`.
- 보강은 두 줄(`reason: 'card_declined'`)이면 된다.

### (c) 카드 토큰 문자열이 어떤 응답에도 나가지 않는지 — 권고

| 응답 | 테스트 유무 | 근거 줄 |
| --- | --- | --- |
| 결제 실패 402 본문 | 있음 | `:183` `JSON.stringify(response.body)).not.toContain('FAIL-123')` |
| 관리자 목록의 실패 주문 행 | 있음(행 단위) | `:229` `JSON.stringify(row)).not.toContain('FAIL-1')` — 전체 본문이 아니라 해당 행만 검사 |
| 결제 성공 200 본문 (`{ ok, order }` — 원본 `Order` 객체 그대로) | **없음** | 성공 토큰(`CARD-…`)에 대한 `not.toContain` 없음 |
| `GET /orders/:id` (성공·실패 주문) | **없음** | `:185-187`은 `status`만 확인 |
| 관리자 목록의 `paid`/`pending` 행 | **없음** | `:232-247`에 토큰 검사 없음 |
| `cardToken` 키가 어느 깊이에도 없음 (계획 S2) | **없음** | — |
| `failure.reason`이 토큰의 부분 문자열이 아님 (계획 S2) | **없음** | — |

- 계획 S2가 요구한 「테스트마다 고유하고 식별 가능한 문자열(예: `FAIL-SECRET-TOKEN-7f3a`)」 대신 `FAIL-1`, `CARD-1` 같은 짧은 값을 쓴다. 오탐 가능성은 낮지만 검색 가능성은 떨어진다.
- 실제 동작(프로브, 토큰 `CARD-SECRET-OK-9f1c` / `FAIL-SECRET-TOKEN-7f3a`): 성공 200·실패 402·관리자 목록·단건 조회 모두 토큰 문자열 없음, `cardToken` 키 없음. 저장소(`src/store.ts`)에 토큰 필드가 없고 `ParsedCardToken.value`도 삭제돼 유입 경로가 없다 — 그래서 차단이 아니라 권고.

### (d) 같은 주문에 실패 이력이 둘 생길 수 있는 경로가 막혀 있는지 — 권고

- 현재 테스트: `:195-208` 「rejects re-payment of a payment_failed order」 — `CARD-999`로 재결제 → `status !== 200`, `paymentAttempts.length` 불변, 상태 `payment_failed`, 재고 불변. `:171-193`은 첫 실패 후 `ok === false` 레코드가 정확히 1개임을 단언.
- 빠진 것: (1) **FAIL 토큰으로 재시도**하는 경우(실패 이력이 둘 생기는 가장 직접적인 시도)가 없다. 게이트가 같은 `isPayable()`이라 논리적으로는 동일 경로지만 테스트가 그 사실을 고정하지 않는다. (2) 계획 S5의 「`400 { message: 'Order is not payable' }`」 본문과 「`orderId`·`ok === false` 레코드 정확히 1개」 대신 `not.toBe(200)`과 전역 `length`만 본다. (3) 재시도 후 관리자 목록이 여전히 200이고 `failure`가 하나인지 확인하지 않는다.
- 실제 동작(프로브): `FAIL-AGAIN` 재시도 → `400 {"message":"Order is not payable"}`, 해당 주문의 실패 이력 1 → 1.

### 그 밖의 계획 시나리오 대조

| 계획 | 상태 | 비고 |
| --- | --- | --- |
| S1 | 부분 | `failure.at`은 `typeof === 'string'`만 확인(ISO 8601 미검증, 권고). `reason` 값은 (b) |
| S3 | 있음 | `:232-247` |
| S4 | 부분 | 단건 200·보존은 `:185-187`에 있음. 「관리자 목록 행 수 = 생성 주문 수」는 없음(권고) |
| S6 | 역전 | 결정 4-b로 의미가 바뀌어 `'결제실패'` 부재를 단언 — 일관됨 |
| S7 | 없음 | (a) |
| 계획 밖 | 부분 | PD-2·3의 409 응답은 `not.toBe(201)` / `>= 400` / `not.toBe(200)`만 확인하고 `409`·`productId`는 미검증(`docs/inventory-policy.md` 「재고 부족 응답 (2026-10-16 확정)」). 이 계획 범위 밖이므로 권고·범위 밖 후보 |

---

## 개인정보·민감정보

| # | 경로 | 근거 | 판정 | 심각도 |
| --- | --- | --- | --- | --- |
| PI-1 | 처리되지 않은 예외 → Express 4 기본 에러 핸들러 → **비프로덕션에서 스택 트레이스가 HTML 500 본문으로 노출** | `src/server.ts`에 에러 미들웨어 없음(`grep -n "app.use\|err" src/server.ts`: 라우터 등록만). 던지는 지점: `src/admin.ts` HEAD 114행 `throw error;`(PR diff 추가 줄 동일), `src/payments.ts` HEAD 70행 `throw new Error('Not a failed payment attempt')`, `src/inventory.ts` 36·41행 `throw new Error('Cannot deduct stock: …')`. `node_modules/finalhandler/index.js`(1.3.2) 176–178행: `if (env !== 'production') { msg = err.stack }`. `package.json` `start: tsx src/server.ts`는 `NODE_ENV`를 설정하지 않음 | 정책(`order-policy.md` 노출 제외 「스택 트레이스 … 포함하지 않음」, `payment-policy.md` 「스택 트레이스를 포함하지 않는다」)의 보호가 코드가 아니라 「도달 불가」 가정에 기대고 있다. 도달성: `toAdminOrder`가 던지는 예외는 9cb009c 기준 `InconsistentFailureRecordError`뿐, `toFailureInfo`는 `recordFailure` 직후 호출, `deductStock`은 같은 동기 틱에서 `findInsufficientProduct === null` 확인 뒤 호출 — **현재 입력으로 도달하는 경로는 찾지 못했다(미확인: 전수 증명 아님)** | 권고 (JSON 500 에러 미들웨어 추가 또는 운영 `NODE_ENV=production` 명문화를 사람이 결정, Q4) |
| PI-2 | `InconsistentFailureRecordError.message`에 `orderId`와 `detail`(`"2 failed attempts"`, `"missing failure reason"`) 포함 | `src/admin.ts` 추가 줄 `super(\`Inconsistent payment failure record for order ${orderId}: ${detail}\`)` | 응답에는 고정 문자열 + `orderId`만 나간다(프로브로 확인). 내부 메시지는 응답에 쓰이지 않음. `orderId`는 정책이 명시한 필드 | 문제 없음 |
| PI-3 | 로그 출력 | PR diff 삭제 줄 `-      console.log(e);`(`src/payments.ts`). HEAD `grep -rn "console\." src/` → `src/server.ts:20` 리슨 로그 1건뿐 | 예외 객체를 통째로 로그에 찍던 경로가 제거됨 — 개선 | 문제 없음 |
| PI-4 | 카드 토큰 보유·전파 | `ParsedCardToken.value` 삭제, `src/store.ts`에 토큰 필드 없음, 계획 명령 (6) 결과: `+` 줄 중 `cardToken` 매치는 `parseCardToken` 내부 1줄, `req.body.cardToken` 1줄, 테스트 헬퍼 2줄뿐 — 통과 기준 충족 | 토큰이 파싱 함수 밖으로 나가지 않는다. 프로브에서 어떤 응답에도 토큰·`cardToken` 키 없음 | 문제 없음 |
| PI-5 | 문서 | `notes/order-status-implementation.md`, 계획, 이 파일 — 모사 토큰(`FAIL-123` 등)만 등장, 실키·접속문자열 없음(검토한 문서 범위에 한함) | — | 문제 없음 |
| PI-6 | 성공 응답과 `GET /orders/:id`가 원본 `Order` 객체를 그대로 직렬화 | `src/payments.ts` `res.json({ ok: true, order })`, `src/orders.ts` `res.json(order)` | 지금은 `Order`에 민감 필드가 없어 안전. 장래 `Order`에 필드가 추가되면 두 경로가 동시에 노출된다. (c)의 테스트 보강이 이 위험의 회귀 감지 수단 | 권고(설계 메모) |

---

## 질문 (사람의 결정이 필요한 지점)

| # | 질문 | 배경과 선택지 |
| --- | --- | --- |
| Q1 | **검토 대상 diff를 지배하는 계획은 무엇인가?** PD-1~3(재고 묶음)을 「수정(되돌림)」할지 「범위 밖으로 기록」할지 | 타임라인: `notes/order-status-implementation.md`(17:31, 브랜치 `feat/order-status-payment-failed`, 입력 = `notes/order-status-plan.md`) → PR #1 머지 → l17 계획 작성(18:04) → 승인(18:10). 즉 PR #1은 l17 계획이 아니라 선행 계획에서 나왔고, 선행 계획의 「수정 범위」에는 재고 차감 시점·재고 부족 차단이 들어 있다. reviewer 판단: 「범위 밖으로 기록」이 타당하나(선행 승인 존재), 이 계획의 표 기준으로는 이탈이므로 사람이 명시적으로 정해야 한다 |
| Q2 | Lab 17/18 전제가 깨진 것을 `notes/role-split-run-l17.md`에 어떻게 기록할지 | 결정 4-b로 E2 「`deriveDisplayStatus()` diff가 없다」, E4 「표시 상태의 기존 위험은 남아 있습니다」, Lab 18 출발점이 모두 성립하지 않음. `labs/tools/rules/l17.json`은 파일 존재(`docs/prompts/*.md`, `notes/role-split-run-l17.md`)와 앱 검사만 요구하므로 자체 점검은 통과할 가능성이 높다(미실행). 선택지: 「소유자 결정으로 전제 변경」을 남은 위험 절에 명기 / Lab 18용으로 다른 표시 상태 결함을 지정 |
| Q3 | (a) S7 테스트와 (b) `card_declined` 단언 추가를 승인하는가 | Lab 17 E3: 「필요한 테스트 보강은 별도 승인 뒤 수행합니다」. 둘 다 `tests/orders.test.ts`만 수정 |
| Q4 | 처리되지 않은 예외의 500 응답 형식 | PI-1. 선택지: JSON 에러 미들웨어(`500 { message: 'Internal error' }`, 스택 미포함) 추가 / 운영 `NODE_ENV=production`을 README·배포 규칙에 명문화 / 현행 유지(도달 불가 가정 수용). 정책에 일반 500 본문 형식이 없어 사람 결정 사항 |
| Q5 | PR #1의 정책 문서 갱신(PD-6)을 「승인자의 별도 지시」로 인정하는가 | 승인 기록은 「같은 소유자가 PR #1에서 확정」이라 적어 사실상 인정하는 취지로 읽힌다. 명시적으로 확정해 두면 다음 reviewer가 같은 질문을 반복하지 않는다 |
| Q6 | (c)·(d)의 테스트 보강(성공 응답·단건 조회 토큰 검사, `cardToken` 키 부재, FAIL 토큰 재시도, 409 본문)을 이번에 넣을지 보류 항목으로 넘길지 | 모두 권고 등급. 현재 동작은 프로브로 정상 확인 |

---

## 확인한 범위

실행한 명령과 결과 (모두 이 세션, 작업 트리 = HEAD):

| 명령 | 결과 |
| --- | --- |
| `npm test` | 1 파일 29 테스트 통과 |
| `npm run typecheck` | 오류 없음 |
| `npm run lint` | 오류 없음 |
| 계획 (4) `git diff e8c7010 9cb009c --stat` | 11 파일 변경 (계획 허용 4개 초과 — PD-7) |
| 계획 (5) `deriveDisplayStatus` 본문 diff | 출력 있음(`1,7d0`, 함수 삭제) — Lab 전제와의 차이로 분류 |
| 계획 (6) `+` 줄 `cardToken`/`card\.value` grep | 4줄 매치: `parseCardToken` 내부, `req.body.cardToken`, 테스트 헬퍼 2줄 → 통과 기준 충족 |
| `grep -rn "console\." src/` | `src/server.ts:20` 리슨 로그만 |
| `git diff 9cb009c HEAD --stat -- src tests` | HEAD에는 PR #2(환불)·#3(취소)이 더 얹혀 있음. 이 검토의 동작 판정은 PR #1 diff, 테스트 유무 판정은 HEAD 테스트 기준 |
| 프로브(스크래치, `src` 미수정) | 토큰 비노출(성공·실패·관리자·단건), `cardToken` 키 부재, FAIL 재시도 400·이력 1건 유지, 불일치 0/2/사유누락 → `500 { message, orderId }` JSON, 스택 없음 |
| `node_modules/finalhandler/index.js` 176–178행 | 비프로덕션에서 `err.stack`을 본문으로 사용 (PI-1 근거) |

대조한 정책 문장 (어긋남 없음으로 판정한 것):

- `order-policy.md` 「관리자 조회 기준」: 저장 상태 그대로 표시 / `failure` 객체 하나로 `payment_failed`에만 / 자기 주문의 `ok === false` 이력만 사용 / 금액·시각·사유 모두 필수 / 불일치 → `500 { message: 'Inconsistent payment failure record', orderId }` / 고아 이력으로 행 생성 안 함 — `src/admin.ts` `findFailure`·`toAdminOrder`·catch 분기와 일치, 프로브로 확인.
- `order-policy.md` 「상태 전환 조건」 `pending → payment_failed` 허용, `payment_failed → paid` 금지, 「금지 … 요청은 기존 주문 상태와 보존된 이력을 변경하지 않아야 한다」 — `isPayable()` 게이트, 프로브 (d).
- `payment-policy.md` 「결제 원칙」 402 + 실패 정보, 삭제 금지, 재결제 금지, 카드 정보·내부 오류·스택 미포함; 「확정된 응답」 표 3행 — `src/payments.ts` 실패 분기·409 분기와 일치.
- `inventory-policy.md` 「재고 원칙」·「재고 부족 응답」 — `src/inventory.ts`·`src/orders.ts`·`src/payments.ts` 성공 분기와 일치(이 계획 범위 밖이지만 diff에 포함돼 대조).
- `AGENTS.md` 「silent fallback 금지」 — `catch → []`·`catch → console.log + 200` 모두 제거됨. 「테스트 없이 상태 변경 금지」 — 상태 전환 자체는 테스트 있음, 500 응답은 (a).

건드리지 않았음을 확인한 것: `src/server.ts`(PR #1에서 변경 없음), `labs/**`(변경 없음).

확인하지 못한 것 (미확인):

- `NODE_ENV=production`에서의 기본 에러 핸들러 응답은 실행하지 않았다(소스 읽기로만 판단).
- PI-1의 「도달 불가」는 코드 읽기 기반이며 전수 증명이 아니다.
- `src/refunds.ts`, `src/cancellations.ts`(PR #2·#3)는 이 검토 범위 밖이라 `console` grep 외에는 보지 않았다.
- `node labs/tools/check.mjs 17`은 실행하지 않았다(`notes/role-split-run-l17.md`가 아직 없어 실패가 예상됨).
- `npm start` 후 수동 curl은 하지 않았다(프로브가 같은 앱 인스턴스를 supertest로 호출).

---

## Handoff

- **차단 5건**: PD-1, PD-2, PD-3 (같은 원인 — 선행 계획 범위의 재고 묶음, 결정 1회로 일괄 처리 가능), 테스트 누락 (a), 테스트 누락 (b).
- **권고 9건**: PD-4, PD-5, PD-6, 테스트 누락 (c), (d), S1/S4 부분, 409 본문 미검증, PI-1, PI-6.
- **머지 가능 여부**: `reviewer.md` 기준 차단 0건이 아니므로 **머지 가능으로 넘기지 않는다**. 단 PR #1은 이미 `main`에 머지돼 있어 실질적으로는 **사후 승인·후속 수정 결정**이 필요하다.
- 사람이 항목마다 「수정 / 범위 밖으로 기록 / 무시」를 정해야 하는 목록:

| 항목 | reviewer 권장 | 결정 (수정 / 범위 밖으로 기록 / 무시) |
| --- | --- | --- |
| PD-1~3 재고 묶음 (`src/inventory.ts`, `src/orders.ts`, `src/payments.ts` 성공 분기) | 범위 밖으로 기록 (`notes/order-status-plan.md` 승인 범위 참조, Q1) | ☐ |
| PD-4 `payments.ts` 구조 변경·try/catch 제거 | 범위 밖으로 기록 (개선 방향) | ☐ |
| PD-5 계획 밖 테스트 7개 | PD-1~3과 동일 처리 | ☐ |
| PD-6 정책 문서 갱신 | 무시(승인자 사후 지시로 인정, Q5) 또는 기록 | ☐ |
| (a) 불일치 500 테스트 없음 | 수정 (S7 테스트 추가, Q3) | ☐ |
| (b) `reason === 'card_declined'` 미단언 | 수정 (두 줄, Q3) | ☐ |
| (c) 토큰 비노출 테스트 범위 | 수정 또는 보류 항목 기록 (Q6) | ☐ |
| (d) FAIL 토큰 재시도·S5 본문 | 수정 또는 보류 항목 기록 (Q6) | ☐ |
| S1 ISO 8601 / S4 행 수 / 409 본문 | 보류 항목 기록 | ☐ |
| PI-1 기본 에러 핸들러 스택 노출 | 결정 필요 (Q4) | ☐ |
| PI-6 원본 `Order` 직렬화 | 기록(설계 메모) | ☐ |
| Lab 전제와의 차이 (`deriveDisplayStatus()` 삭제) | `notes/role-split-run-l17.md` 남은 위험에 기록 (Q2) | ☐ |

implementer는 위 표가 채워진 뒤에만 움직인다.
