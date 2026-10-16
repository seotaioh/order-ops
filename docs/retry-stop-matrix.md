# 결제 실패 처리 매트릭스

결제 실패와 그 주변 사건에서 **무엇을 외부에 돌려주고, 무엇을 서버에 남기며, 무엇을 반복하지 않는지**를 한 장으로 보는 참조 문서다. 확정된 정책과 아직 사람 결정이 필요한 항목을 같은 표 안에서 구분해 두어, 다음 결제 변경 전에 「변경 전 확인」만 훑어도 빠뜨린 축이 없게 하는 것이 목적이다.

## 목적과 위치

이 문서는 결제 실패와 그 주변 사건(거부, 재고 부족, 관리자 조회의 데이터 불일치, 예기치 못한 예외)에 대해 **외부 응답·주문 상태·이력·재고·재시도 또는 중단 판단**을 한 표로 묶은 보조 참조다. 정책을 새로 정하지 않는다.

- 정본: 결제 판정·응답·이력은 `docs/payment-policy.md`, 상태 의미와 전환은 `docs/order-policy.md`, 재고 검사·차감·복원은 `docs/inventory-policy.md`. 이 문서와 정본이 다르면 정본이 맞고 이 문서를 고친다.
- 확정 값의 기준: 2026-10-17 현재 `main`(`f66fc2c`)의 정책 문서·`src/`·`tests/orders.test.ts`. 「확정」은 정책 문서의 「(2026-10-16 확정)」 절에 있는 값이고, 「보류」는 정책 「보류 사항」 절에 있는 값이다. 정책이 정하지 않았고 코드만 그렇게 동작하는 것은 「미명시(현재 코드 동작)」로 적어 확정과 섞지 않는다.
- 작성 경위: Lab 15 산출물을 사후에 작성했다. 이 fork는 Lab 15가 요구하는 코드 변경(결제 `catch → 200 {ok:false}`·관리자 `catch → []` 제거)을 2026-10-16 PR #1(커밋 `1501eb7`, 머지 `9cb009c`)에서 이미 수행했다.

## Lab 15 전제와 이 fork의 차이

| Lab 15 전제 | 이 fork의 실제 | 근거 |
| --- | --- | --- |
| 결제 예외 경로가 로그만 남기고 `{ ok: false }` 200으로, 관리자 예외 경로가 빈 배열로 바뀐다 | 둘 다 PR #1에서 제거됨. 결제 핸들러에는 `try/catch`가 없고, 관리자 핸들러의 `catch`는 `InconsistentRecordError`만 `500` JSON으로 바꾸고 나머지는 다시 던진다 | `git diff e8c7010 9cb009c -- src/payments.ts src/admin.ts`, `src/admin.ts` 105–116행 |
| 이전 Lab의 관리자 상태 `it.fails()` assertion이 남아 있다 | 없다(`grep -c "it.fails" tests/orders.test.ts` → 0). 표시 상태 파생(`deriveDisplayStatus()`)이 PR #1에서 저장 상태 그대로 표시로 교체됐기 때문 | `notes/role-split-run-l17.md` 「Lab 전제와의 차이」 |
| E2에서 한 번의 세션 승인으로 예기치 못한 예외의 외부 응답·보존 방식을 정한다 | 데이터 불일치 예외의 경계는 소유자 결정으로 확정됐고(아래 「승인된 오류 처리 경계」), 그 밖의 처리되지 않은 예외의 외부 응답은 **아직 보류**다(PI-1) | `notes/pending-decisions.md` 「2026-10-16 구현 시 확정」, 「Lab 17 reviewer 보류」 |

## 사건별 매트릭스

재시도/중단 열의 뜻: **stop**은 같은 입력을 반복하지 않고 정해진 다음 행동으로 넘어가는 것, **사람 승인 전 후보**는 정책이 보류해 둔 재시도라 구현·허용하지 않는 것이다. 어떤 행도 자동 재시도를 구현하지 않는다.

| # | 사건 (실패 입력) | 감지 신호 | 외부 응답 | 주문 상태 | 이력 | 재고 | 재시도 / 중단 판단 | 정책 상태 | 테스트 (`tests/orders.test.ts`) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 결제 수단 거절 (`cardToken`이 `FAIL`로 시작) | `parseCardToken().shouldFail` | `402` `{ ok: false, orderId, status: "payment_failed", failure: { reason: "card_declined", amountKrw, at } }` | `pending → payment_failed`, 삭제하지 않음 | 실패 시도 1건, `failureReason: card_declined` | 불변 | **stop**. 같은 주문 재결제 금지. 다음 행동은 새 주문 생성(`nextAction: create_new_order`는 2번 행의 거부 응답으로 안내) | 확정 (`payment-policy` 「확정된 응답」, `order-policy` 전환표) | 188행 `returns 402 …`, 579행 `(b) … card_declined` |
| 2 | `payment_failed` 주문에 다시 결제 요청 (카드 토큰 종류 무관) | `isPayable()` 거짓 (`status !== 'pending'`) | `400` `{ message: "Order is not payable", status: "payment_failed", reason: "repayment_not_allowed", nextAction: "create_new_order" }` | 불변 | 기록하지 않음 (실패 이력 정확히 1건 불변식 유지) | 불변 | **stop**. 거부는 전환이 아니다 | 확정 (Issue #6, 2026-10-16) | 212행 `rejects re-payment …`, 618행 `(d) … second FAIL attempt` |
| 3 | `paid`·`cancelled`·`refunded` 주문에 결제 요청 | `isPayable()` 거짓 | `400` 같은 본문, `reason`은 각각 `already_paid` / `order_cancelled` / `order_refunded`, `nextAction`은 `none` / `create_new_order` / `create_new_order` | 불변 | 기록하지 않음 | 불변 (`paid` 2차 결제도 중복 차감 없음) | **stop** | 확정 (`payment-policy` 「결제 거부 사유 코드」) | 147행 (`paid` 2차), 399행 (`refunded`), 518행 (`cancelled`) |
| 4 | 결제 성공 확정 직전 재검사에서 재고 부족 | `findInsufficientProduct(order.items) !== null` | `409` `{ message: "Insufficient stock", productId }` | `pending` 유지 | 기록하지 않음 (결제 수단 처리에 진입하지 않음) | 불변 | **stop** (이번 요청). 주문이 `pending`으로 남으므로 코드상 같은 주문의 재요청을 막는 조건은 없으나, 재고 보충 뒤 재요청 허용을 정책이 문장으로 정하지는 않았다. 자동 재시도는 하지 않는다 | 응답·상태·이력은 확정 (`inventory-policy` 「재고 부족 응답」). 재요청 조건은 미명시 | 167행 `refuses to confirm payment when stock became insufficient …` |
| 5 | 주문 생성 시 합산 수량이 재고 초과 | `findInsufficientProduct(items) !== null` | `409` 같은 본문 (`productId`는 부족이 발견된 첫 상품) | 주문을 저장하지 않음 | 해당 없음 | 불변 | **stop**. 수량을 바꾼 요청은 새 주문이지 재시도가 아니다 | 확정 | 86·97·111행 (`inventory policy — order creation`) |
| 6 | 카드 토큰이 비어 있거나 문자열이 아님 | `parseCardToken()`이 `null` | `400` `{ message: "Invalid card token" }` | 불변 | 기록하지 않음 | 불변 | **stop** (입력 오류). 올바른 토큰으로 다시 보내는 것은 새 요청 | 미명시 (정책 문서에 이 응답 문장 없음, 현재 코드 동작) | 없음 (`grep -c "Invalid card token"` → 0) |
| 7 | 존재하지 않는 주문 ID로 결제 요청 | `orders.get()` 없음 | `404` `{ message: "Order not found" }` | 해당 없음 | 기록하지 않음 | 불변 | **stop** | 환불·취소는 정책이 `404`를 명시, 결제는 미명시 (현재 코드 동작) | 결제 경로 없음 (`toBe(404)`는 환불 419행·취소 541행만) |
| 8 | 관리자 목록: `payment_failed` 주문의 실패 이력이 정확히 1건이 아님 (0건, 2건 이상, 사유 누락) | `findFailure()`가 `InconsistentRecordError` 던짐 | `500` `{ message: "Inconsistent payment failure record", orderId }`. 내부 예외 메시지·스택 없음 | 조회이므로 불변 | 보존. 여러 이력 중 하나를 고르거나 삭제하지 않음 | 불변 | **stop**. 같은 데이터로 재조회해도 같은 `500`이므로 재시도가 아니라 운영자의 데이터 조사가 다음 행동. 이력 삭제로 「해결」하는 것은 정책 위반 | 확정 (`order-policy` 「데이터 불일치의 판정과 응답」) | 661·668·676행 `(a) …`, 687행 (정상 데이터는 `200`) |
| 9 | 관리자 목록: `refunded`·`cancelled` 주문의 환불·취소 이력이 정확히 1건이 아님 | `findRefund()`·`findCancellation()`이 같은 예외 던짐 | `500` `{ message: "Inconsistent refund record" \| "Inconsistent cancellation record", orderId }` | 불변 | 보존 | 불변 | **stop** (8번과 동일) | 확정 (`order-policy` `refunded`·`cancelled` 표시 조건) | **없음** — 두 문자열 모두 테스트에 0건 (2026-10-17 preflight 발견, `notes/preflight-run-l16.md`) |
| 10 | 처리되지 않은 예외 (8·9번 외: `admin.ts`의 `throw error` 재던짐, `payments.ts` `toFailureInfo()`·`inventory.ts` `deductStock()`의 `throw new Error`) | Express 4 기본 에러 핸들러 (`src/server.ts`에 에러 미들웨어 없음) | **미확정**. 기본 핸들러는 `NODE_ENV !== 'production'`이면 스택을 HTML 500 본문에 싣는다 | 불변 | 보존 | 불변 | 판단 보류. 현재 입력으로 도달하는 경로는 찾지 못했다(전수 증명 아님) | 보류 (PI-1, `notes/pending-decisions.md` 「처리되지 않은 예외의 500 응답 형식」, `notes/backlog-l20.md` P2) | 없음 |
| 11 | 네트워크·인프라 오류로 같은 결제 요청을 다시 전송 | 이 앱에는 외부 호출이 없어 발생 지점 없음 | 정하지 않음 | — | — | — | **사람 승인 전 후보**. 허용 조건·요청 식별 방식·최대 횟수 모두 미정. 횟수를 예시로도 적지 않는다 | 보류 (`payment-policy` 「보류 사항」) | 없음 |
| 12 | 외부 결제 제공자 연동 시 금액 반환(환불)의 비동기 처리 실패 | 연동 자체가 없음 (`AGENTS.md` 금지) | 정하지 않음 | — | — | — | **사람 승인 전 후보**. 실패 시 상태와 재시도 모두 미정 | 보류 (`payment-policy` 「보류 사항」) | 없음 |

## Retry와 stop의 분리

### 정책이 확정한 stop

| 실패 종류 | 감지 신호 | 중단 뒤 행동 | 정책 근거 |
| --- | --- | --- | --- |
| 결제 수단 거절 | `402` + `payment_failed` | 같은 주문을 다시 결제하지 않는다. 고객은 새 주문을 만든다 | `payment-policy` 「동일 주문 재결제 정책의 승격」 |
| 결제 불가 상태의 주문에 결제 요청 | `400` + `reason` 코드 | 상태·이력·재고를 바꾸지 않고 `nextAction`대로 안내 | `payment-policy` 「결제 거부 사유 코드」, `order-policy` 금지 전환 |
| 재고 부족 (생성·결제 시점) | `409` + `productId` | 주문 전체를 거부. 일부 품목만 처리하지 않는다 | `inventory-policy` 「재고 부족 응답」 |
| 관리자 조회의 이력 불일치 | `500` + `orderId` | 목록 전체를 실패로 알리고 운영자가 데이터를 조사한다. 이력을 고르거나 지우지 않는다 | `order-policy` 「데이터 불일치의 판정과 응답」 |

### 사람 승인 전 retry 후보

| 실패 종류 | 필요한 승인 | 승인 전까지 | 검증해야 할 것 (승인 뒤) |
| --- | --- | --- | --- |
| 네트워크·인프라 수준 기술적 재시도 | 허용 조건, 같은 요청을 식별하는 방식, 최대 횟수 | 구현하지 않고 횟수·식별자를 문서에도 적지 않는다 | 같은 요청의 재전송이 결제 시도 이력을 두 번 만들지 않는지, `payment_failed` 재결제 금지와 충돌하지 않는지 |
| 외부 결제 제공자의 비동기 환불 실패 | 실패 시 주문 상태, 재시도 여부와 책임 주체 | 연동 자체를 추가하지 않는다 | `paid → refunded` 전환과 재고 복원 1회 불변식 |
| 결제 시점 재고 부족 뒤 같은 `pending` 주문의 재요청 | 허용 여부를 정책 문장으로 명시할지 | 현재 코드는 막지 않지만 자동 재시도는 하지 않는다 | 재요청 성공 시 차감이 정확히 1회인지 (현재 133·147행이 보호) |

## 승인된 오류 처리 경계 (사후 기록)

Lab 15 E2는 「외부 상태 코드·외부 본문·서버 쪽 오류 보존 방식」을 한 번의 세션 승인으로 정하라고 한다. 이 fork에서는 Lab 15 세션 대신 아래 결정이 그 역할을 했다. 세션 승인문을 새로 지어내지 않고 기록된 결정만 옮긴다.

| 항목 | 결정 | 결정 주체·시점 | 출처 |
| --- | --- | --- | --- |
| 결제 예외 경로의 silent fallback (`catch (e) { console.log(e); res.json({ ok: false }); }`) | 제거. 결제 핸들러는 `try/catch` 없이 정책이 정한 `402`·`400`·`404`·`409`만 반환 | 저장소 소유자, 2026-10-16 PR #1 | `notes/order-status-implementation.md` 「변경 내용」 `src/payments.ts` 행, `AGENTS.md` Rules |
| 관리자 예외 경로의 silent fallback (`catch { res.json([]); }`) | 제거. 데이터 불일치는 `500 { message, orderId }`로 드러냄 | 저장소 소유자, 2026-10-16 PR #1 확정 → 같은 날 Lab 17 계획 승인 결정 3-a로 재확인 | `notes/pending-decisions.md` 「관리자 목록에서 … 하나가 아닐 때」, `notes/plans/l17-admin-failure-reason.md` 「승인 기록」 |
| 외부 본문에 넣지 않는 것 | 카드 정보, 내부 예외 메시지, 스택 트레이스, 원시 오류 본문 | 정책 (2026-10-16 확정) | `payment-policy` 「결제 원칙」, `order-policy` 「노출 제외 정보」. 테스트 593행 `(c)`, 661행 이하 `(a)`의 `not.toContain('Error' / 'at ' / 'failed attempts')` |
| 서버 쪽 오류 보존 | `InconsistentRecordError`가 `orderId`·`kind`·`detail`(예: `2 failed attempts`)을 예외 객체에 담는다. 원본 이력(`paymentAttempts`·`refunds`·`cancellations`)은 삭제·선택하지 않고 그대로 남는다. **별도 서버 로그 출력은 없다** (`grep -rn "console\." src/` → 리슨 로그 1건뿐) | 코드 사실. 구조화 로그·추적 ID 도입 여부는 결정된 바 없음 | `src/admin.ts` 41–45행, `notes/reviewer-findings-l17.md` PI-2·PI-3 |
| 그 밖의 처리되지 않은 예외의 외부 상태·본문 | **미확정**. 선택지는 JSON 에러 미들웨어 추가 / 운영 `NODE_ENV=production` 명문화 / 현행 수용 | 사람 결정 대기 | `notes/pending-decisions.md` 「처리되지 않은 예외의 500 응답 형식 (PI-1)」 |

## 변경 전 확인

결제·관리자 오류 처리나 상태 전환을 바꾸는 변경을 머지하기 전에 아래를 확인한다. 각 항목은 명령 또는 관찰 대상을 적었고, 결과는 그 변경의 실행 기록(`notes/`)에 남긴다.

- [ ] **오류 보존** — 실패 원인을 추적할 근거가 서버 쪽에 남는가. 실패 이력(`paymentAttempts`)·환불·취소 이력이 삭제되거나 덮어써지지 않고, 불일치 예외에 `orderId`와 원인이 담기는가. 이력을 지워 문제를 「해결」하는 변경은 반려한다.
- [ ] **외부 응답** — `402`·`400`·`409`·`500` 본문이 정책 「확정」 표의 모양과 같고, 카드 정보·내부 예외 메시지·스택·원시 오류가 없는가. 테스트 `(c)`(593행)와 `(a)`(661행 이하)의 비노출 단언이 그대로 통과하는가.
- [ ] **로그** — 예외를 `console.log(e)` 같은 단순 출력으로 소비하고 계속 진행하는 코드가 없는가. `grep -rnE "console\.(log|error|warn)\(" src/` 결과가 `src/server.ts`의 리슨 로그 1건뿐인가. 운영 로그를 새로 넣는다면 응답으로 나가지 않는 서버 쪽 근거여야 한다.
- [ ] **silent fallback 금지** — `catch` 뒤에 빈 배열·기본 성공 응답·`200 { ok: false }`를 반환하는 분기가 없는가. `grep -rnE "catch" src/` 결과가 `src/admin.ts`의 `InconsistentRecordError` 분기(나머지는 `throw error`) 1건뿐인가. 새 `catch`는 승인된 경계가 있을 때만 둔다.
- [ ] **retry** — 네트워크 재시도 횟수·식별 방식·자동 재시도를 코드나 문서에 사실처럼 넣지 않았는가. 정책 「보류 사항」에 있는 한 「사람 승인 전 후보」로만 남긴다.
- [ ] **stop** — 반복하지 말아야 할 실패에 다음 행동이 있는가. `reason`·`nextAction` 코드 집합이 `payment-policy` 「결제 거부 사유 코드」 표와 같고, 새 코드는 정책 표에 먼저 추가됐는가.
- [ ] **상태 전환표 대조** — 변경이 만드는 전환이 `order-policy` 「상태 전환 조건」의 허용 전환뿐인가. 금지·보류 전환 요청은 상태·이력·재고를 바꾸지 않는가. 표에 없는 전환은 보류로 두고 사람에게 묻는다.
- [ ] **이력 불변식** — `payment_failed` 주문의 실패 이력이 정확히 1건, `refunded`·`cancelled` 주문의 환불·취소 이력이 정확히 1건이라는 불변식이 유지되는가. 거부된 요청을 이력에 남기지 않는가.
- [ ] **테스트** — 정상 경로와 예외 경로가 각각 실제 테스트로 검증되는가. 바꾼 사건의 행(위 매트릭스)마다 테스트 열이 비어 있지 않은가. 새 확정 응답 문자열은 `not.toBe(200)` 같은 느슨한 단언이 아니라 정확값으로 단언하는가. `npm test`·`npm run lint`·`npm run typecheck`를 실행해 결과와 미실행을 구분해 기록했는가.
- [ ] **정본 미대체** — 이 매트릭스만 고쳐 정책을 바꾸지 않았는가. 결정은 `notes/pending-decisions.md` → 정책 문서 「확정」 절 → 이 문서 순서로 반영한다. 미확정 행(10·11·12번)을 임의로 채우지 않았는가.
