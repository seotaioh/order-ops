<!-- Lab 18 E2 — seotaioh/order-ops 에 등록할 Issue 초안. 템플릿: .github/ISSUE_TEMPLATE/workflow-task.md -->

# 제목: 결제 실패 주문을 다시 결제하려는 고객 요청이 400으로 거부됨 — 안내 부재와 정책 충돌 확인

## Summary

결제에 한 번 실패한 주문에 대해 고객이 다시 결제를 시도하면 `400 { "message": "Order is not payable" }`로 거부된다. 거부 자체는 정책(실패 주문 재결제 금지)대로지만, 고객과 관리자 어느 쪽에도 「왜 안 되는지」「다음에 무엇을 해야 하는지」가 전달되지 않아 VOC가 접수됐다.

## Context

VOC 접수 2026-08-02 10:15 KST (`labs/fixtures/l18-voc-report.md`). 고객 식별 정보와 실제 카드 정보는 제거된 상태로 접수됐다. VOC 원문은 「두 번째 결제가 성공했고 주문 상세는 결제 완료인데 관리자 목록만 결제실패」라고 하지만, 현재 코드(main `10bc0a1`)에서 재현하면 두 번째 결제는 성공하지 않고 거부된다. VOC가 관찰한 환경은 미정이다.

## Current Behavior

재현 절차 (로컬, `npm start` 후):

1. `POST /orders` `{"items":[{"productId":"keyboard","quantity":1}]}` → `201`, `status: "pending"`
2. `POST /orders/:id/pay` `{"cardToken":"FAIL-…"}` → `402`, `status: "payment_failed"`, `failure: { reason: "card_declined", amountKrw, at }`
3. `POST /orders/:id/pay` `{"cardToken":"CARD-…"}` → **`400 { "message": "Order is not payable" }`**
4. `GET /orders/:id` → `status: "payment_failed"`
5. `GET /admin/orders` → 해당 행 `status: "payment_failed"`, `failure` 포함

관찰: 3의 응답은 결제 가능 상태가 아닌 모든 경우(`paid`·`cancelled`·`refunded`·`payment_failed`)에 같은 문구를 쓴다. 고객이 실패 주문을 어떻게 해야 하는지(새 주문 생성)는 어디에도 나오지 않는다.

## Expected Behavior

미정 — 아래 Human Decision Needed 1의 답에 따라 둘 중 하나다.

- (A) 정책 유지: 재결제는 계속 거부하되, 거부 응답이 사유와 다음 행동을 구분해 알려 준다.
- (B) 정책 변경: `payment_failed` 주문의 재결제를 허용한다. 이 경우 주문 상태 정책의 금지 전환(`payment_failed → paid`)을 다시 열어야 하며 이 Issue 범위를 넘는다.

## Scope

- 결제 거부 응답의 내용(상태 코드·본문)과 그 테스트
- 관리자 목록에서 실패 주문의 후속 처리 상태를 운영자가 알 수 있는지 확인

## Out of Scope

- `payment_failed → paid` 전환 허용 여부 자체의 변경 (정책 결정이 먼저)
- 환불·취소 흐름, 재고 정책
- 고객용 UI (이 저장소에는 화면이 없음)

## Acceptance Criteria

- [ ] 상태: `payment_failed` 주문에 결제를 요청한 후에도 주문 상태가 `payment_failed`이고 실패 이력이 1건임을 확인한다.
- [ ] 응답: 그 요청에 대해 HTTP 상태와 본문이 (A) 또는 (B) 결정에 맞는 값임을 확인한다. (A)면 거부 사유와 다음 행동을 구분하는 필드가 있다. 값은 결정 뒤 확정.
- [ ] 저장 결과: 거부된 요청이 재고·결제 이력·주문 상태를 바꾸지 않음을 확인한다.
- [ ] 테스트 증거: `tests/orders.test.ts`에 위 세 가지를 판정하는 테스트가 포함되어 `npm test`가 통과한다.

## Human Decision Needed

1. 실패 주문 재결제 금지 정책을 유지하는가(A), 변경하는가(B)? 정책 근거: `docs/payment-policy.md` 「동일 주문 재결제 정책의 승격」, `docs/order-policy.md` 전환표 `payment_failed → paid` 금지.
2. (A)일 때 거부 응답의 HTTP 상태를 `400`으로 두는가, 상태 충돌을 뜻하는 `409`로 바꾸는가? 바꾸면 기존 테스트와 `docs/payment-policy.md` 「확정된 응답」을 함께 고쳐야 한다.
3. 거부 본문에 넣을 다음 행동 안내의 형식(예: `nextAction: "create_new_order"`)은 무엇인가?
4. VOC가 관찰한 환경이 현재 코드와 다른 버전인지 확인할 방법이 있는가? 없다면 「현재 코드 기준」으로 닫는다.

## References

- 정책: `docs/payment-policy.md`(재결제 금지, 확정된 응답), `docs/order-policy.md`(상태 전환표, 관리자 조회 기준)
- 코드: `src/payments.ts` `isPayable()`과 `Order is not payable` 분기, `src/admin.ts` `failure` 첨부
- 테스트: `tests/orders.test.ts` 「rejects re-payment of a payment_failed order…」, 「(d) rejects a second FAIL attempt…」
- 조사: `notes/issue-triage-l18.md`, VOC 원문 `labs/fixtures/l18-voc-report.md`
