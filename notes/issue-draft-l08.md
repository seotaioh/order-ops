# Issue 초안 — 결제 실패 주문의 상태 보존과 관리자 조회 (Lab 08 E4)

> 이 초안은 Lab 08 시점(v0 코드) 기준이며, 여기 적힌 변경은 2026-10-16 PR #1~#3으로 이미 구현됐다. 입력 `labs/lecture08/inputs/bad-issue-sample.md`를 `.github/ISSUE_TEMPLATE/workflow-task.md`의 아홉 필드로 다시 쓴 것이고, 문장 분류와 사람 결정 항목은 `notes/issue-diagnosis-l08.md`를 따른다. 2026-10-16에 내려진 실제 결정은 `notes/pending-decisions.md`에 있으며 이 초안에서 미정으로 남긴 항목을 소급해 채우지 않았다.

## Summary

결제에 실패한 주문이 삭제되어 단건 조회와 관리자 주문 목록에서 사라지는 문제를 고친다. 실패 주문을 보존하는 상태 `payment_failed`를 추가하고, 관리자 주문 목록에서 실패 주문이 실패 정보와 함께 조회되게 한다. 요청에 함께 언급된 「재고 문제」는 포함 범위와 시나리오가 사람 결정으로 확정된 뒤에만 이 Issue의 범위에 들어간다.

## Context

- 요청 원문(`labs/lecture08/inputs/bad-issue-sample.md`): 「결제가 실패한 주문 처리가 이상합니다. 상태를 하나 추가하고 관리자 화면에도 보이게 고쳐 주세요. 재고 문제도 같이 해결하면 좋겠습니다. 최대한 빨리 반영해 주세요.」
- 원문에는 재현 절차, 실제 응답, 기대 결과, 완료 조건이 없다. `notes/issue-diagnosis-l08.md`에서 각 문장을 `확인된 요청`·`코드로 확인할 사실`·`사람 결정`·`근거 없는 추정`으로 분류했고, 이 초안은 그 분류를 그대로 쓴다.
- 목표 동작은 Lab 07에서 확정한 세 정책(`docs/order-policy.md`, `docs/payment-policy.md`, `docs/inventory-policy.md`)이 이미 정의하고 있다. 같은 주제의 선행 조사와 계획은 `notes/order-status-request.md`, `notes/order-status-plan.md`에 있고, 사람 결정 이력은 `notes/pending-decisions.md`에 있다.
- 「관리자 화면」이라는 표현은 현재 저장소의 API 구조(`GET /admin/orders`)와 일치하지 않으므로 해석을 확정하지 않고 사람 결정으로 넘긴다.

## Current Behavior

v0 코드에서 관찰되는 동작이다. 근거는 `notes/order-status-plan.md` 「현재 동작」 표와 `notes/issue-diagnosis-l08.md` 「코드로 확인할 사실」이다.

| 준비 조건 | 행동 | 관찰 결과 | 코드 근거 |
| --- | --- | --- | --- |
| `pending` 주문이 저장돼 있음 | `FAIL`로 시작하는 카드 토큰으로 `POST /orders/:id/pay` | 실패 시도 이력을 기록한 뒤 `orders.delete(orderId)`로 주문을 삭제하고 HTTP 200과 `{ ok: false }`를 반환함. 실패 사유 필드 없음 | `src/payments.ts` |
| 위 실패 직후 | `GET /orders/:id` | HTTP 404 `{ message: "Order not found" }` | `src/orders.ts` |
| 위 실패 직후 | `GET /admin/orders` | 목록은 `orders` Map을 순회하므로 삭제된 실패 주문이 포함되지 않음 | `src/admin.ts` |
| — | `OrderStatus` 타입 확인 | `pending`, `paid`, `cancelled` 세 값뿐이며 `payment_failed`가 없음 | `src/store.ts` |
| 상품 재고 `S`, 주문 수량 `Q` | `POST /orders` | 재고 부족 검사와 동일 상품 수량 합산 없이 HTTP 201. 생성 시점에 재고가 `S - Q`로 즉시 차감되며 `Q > S`이면 음수가 됨 | `src/orders.ts`, `src/store.ts` |
| — | `npm test` | 주문 생성·조회의 HTTP 상태, 결제 응답의 `ok` 필드, 관리자 응답의 배열 여부만 확인함. 실패 주문 보존·재고 시점·관리자 실패 정보는 검증하지 않음 | `tests/orders.test.ts` |

## Expected Behavior

승인된 정책 문서가 정한 목표 동작만 적는다. 정책에 없는 값은 적지 않고 Human Decision Needed로 보낸다.

- `pending` 주문의 결제가 실패하면 주문을 삭제하지 않고 `pending → payment_failed`로 전환하며, 실패 시도 이력을 함께 보존한다. (`docs/order-policy.md` 「상태 전환 조건」, `docs/payment-policy.md` 「결제 원칙」)
- 결제 실패 응답은 HTTP 402와 실패 정보다. 실패 정보에는 카드 정보, 내부 오류, 예외 메시지, 스택 트레이스를 포함하지 않는다. (`docs/payment-policy.md` 「결제 원칙」)
- 실패 직후 `GET /orders/:id`는 HTTP 200과 `status: "payment_failed"`를 반환한다. (`notes/order-status-request.md` 완료 조건)
- `payment_failed` 주문에 같은 주문 ID로 다시 결제를 요청하면 거부하며, 거부는 주문 상태·결제 이력·재고를 바꾸지 않는다. 거부 응답의 HTTP 상태와 메시지는 미정이다. (`docs/payment-policy.md` 「동일 주문 재결제 정책의 승격」)
- `GET /admin/orders`는 보존된 `payment_failed` 주문을 포함하고, 그 주문에만 실패 금액·실패 시각·안전한 실패 사유를 조건부로 붙인다. 카드 정보·내부 오류·원시 오류 응답은 노출하지 않는다. 필드명과 사유 값 형식은 미정이다. (`docs/order-policy.md` 「관리자 조회 기준」)
- 재고에 관한 목표 정책은 다음과 같으나, 이 Issue에 포함할지는 미정이다: 주문 생성 전에 동일 상품 수량을 합산해 재고를 검사하고 부족하면 저장·차감 전에 차단한다, 생성만으로 재고를 차감하지 않는다, 결제 성공 시 한 번만 차감한다, 결제 실패와 재결제 거부에서는 차감·복원하지 않는다. (`docs/inventory-policy.md` 「재고 원칙」)

## Scope

- `OrderStatus`에 `payment_failed` 추가 (`src/store.ts`)
- 결제 실패 처리: 주문 삭제 제거, `payment_failed` 전환, HTTP 402와 안전한 실패 정보 응답, 실패 시도 이력 보존 (`src/payments.ts`)
- `payment_failed` 주문의 재결제 거부와 거부 시 상태·이력·재고 불변 (`src/payments.ts`)
- 관리자 주문 목록에 `payment_failed` 주문 포함과 조건부 실패 정보 첨부 (`src/admin.ts`)
- 위 결과를 각각 판정하는 테스트 추가 (`tests/orders.test.ts`)
- 조건부: Human Decision Needed 2·3이 「포함」으로 답해지면 재고 차감 시점 변경(생성 시 미차감, 결제 성공 시 차감)과 재고 부족 주문 차단을 이 Issue에 추가한다. 답하기 전에는 범위가 아니다.

## Out of Scope

- `refunded` 상태와 환불 흐름 — `notes/pending-decisions.md`에서 「이번 변경에서는 `payment_failed`만 추가한다」로 확정됨
- `cancelled` 상태의 의미·전환 변경 — 요청과 정책에 변경 사항이 없음
- 새 관리자 UI 화면 — Human Decision Needed 1이 「별도 UI」로 답해지면 별도 Issue로 분리함
- 라우팅 구조와 저장 기술(인메모리 `Map`·배열) 변경
- 네트워크·인프라 수준의 기술적 재시도 — `docs/payment-policy.md` 보류 사항
- 같은 주문에 실패 이력이 여러 개일 때의 관리자 표시 규칙 — Human Decision Needed 7
- 실제 결제 제공자 연동 — `AGENTS.md` Rules에서 금지

## Acceptance Criteria

각 항목은 실행 후 관찰로 참·거짓을 판정한다. 미정 값은 기준에 넣지 않았다.

- [ ] 상태: `pending` 주문에 실패 카드 토큰으로 `POST /orders/:id/pay`를 요청한 뒤, 저장된 주문의 `status`가 `payment_failed`이고 주문이 `orders`에서 삭제되지 않았다.
- [ ] 응답: 위 요청의 HTTP 상태가 402이고, 응답 본문에 카드 토큰·내부 예외 메시지·스택 트레이스가 없다.
- [ ] 응답: 위 실패 직후 `GET /orders/:id`가 HTTP 200과 `status: "payment_failed"`를 반환한다.
- [ ] 저장 결과: 위 실패 요청 전후로 주문 품목 상품의 재고 값이 변하지 않는다.
- [ ] 저장 결과: `payment_failed` 주문에 다시 `POST /orders/:id/pay`를 요청한 뒤, `status`가 `paid`로 바뀌지 않고 결제 시도 이력 수가 늘지 않으며 재고가 변하지 않는다. (HTTP 상태·메시지는 Human Decision Needed 5가 답해진 뒤 별도 기준으로 추가)
- [ ] 응답: `GET /admin/orders` 결과에 해당 주문이 포함되고 `status`가 `payment_failed`이며, 실패 금액·실패 시각·실패 사유에 해당하는 필드가 있고 카드 정보 필드가 없다. (필드명은 Human Decision Needed 4가 답해진 뒤 고정)
- [ ] 테스트 증거: `npm test`가 위 결과를 각각 검증하는 테스트를 포함해 통과하고, `npm run typecheck`가 통과한다.
- 조건부 (Human Decision Needed 2가 「재고 차감 시점까지 포함」일 때만 추가):
  - [ ] 저장 결과: 재고 `S ≥ Q`인 상품에 수량 `Q`의 주문을 생성한 뒤 재고가 `S`로 유지된다.
  - [ ] 저장 결과: 위 주문의 결제 성공 후 재고가 `S - Q`가 되고, 같은 주문의 후속 결제 요청으로 추가 차감되지 않는다.
  - [ ] 저장 결과: 수량 `Q > S`인 주문 생성 요청 뒤 주문이 저장되지 않고 재고가 `S`로 유지된다. (응답 HTTP 상태·본문은 Human Decision Needed 6)

## Human Decision Needed

`notes/issue-diagnosis-l08.md` 「사람이 답할 질문」을 그대로 가져왔다. 선택 결과를 미리 적지 않는다.

1. 「관리자 화면」은 기존 `GET /admin/orders` API 변경을 뜻하는가, 별도 UI까지 뜻하는가?
2. 이번 Issue는 결제 실패 흐름만 다루는가, 주문 생성과 결제 성공의 재고 차감 시점까지 포함하는가?
3. 「재고 문제」는 생성 시 부족, 결제 시점 부족, 동일 상품 중복 항목, 중복 차감 중 어느 시나리오를 포함하는가?
4. 결제 실패 응답과 관리자 목록에 포함할 안전한 실패 사유의 필드명과 허용 값은 무엇인가?
5. `payment_failed` 주문의 재결제 거부 시 HTTP 상태와 응답 메시지는 무엇인가?
6. 결제 시점에 재고가 부족하면 주문 상태와 결제 응답을 어떻게 유지할 것인가?
7. 같은 주문에 실패 이력이 여러 개라면 관리자 목록에는 어느 이력을 표시할 것인가?
8. 「최대한 빨리」의 기한, 배포 대상과 완료로 판정할 필수 테스트는 무엇인가?

(사후 기록) 1~7은 2026-10-16에 저장소 소유자가 확정했고 결과는 `notes/pending-decisions.md` 「2026-10-16 구현 시 확정」 이하 절과 각 정책 문서의 「확정」 절에 있다. 8의 기한은 별도로 정하지 않았다.

## References

- 입력: `labs/lecture08/inputs/bad-issue-sample.md`
- 진단: `notes/issue-diagnosis-l08.md` (Lab 08 E1)
- 정책: `docs/order-policy.md`, `docs/payment-policy.md`, `docs/inventory-policy.md`
- 선행 요청·계획·결정: `notes/order-status-request.md`, `notes/order-status-plan.md`, `notes/pending-decisions.md`
- 현재 동작 근거(v0): `src/store.ts`, `src/orders.ts`, `src/payments.ts`, `src/admin.ts`, `tests/orders.test.ts`
- Issue template: `.github/ISSUE_TEMPLATE/workflow-task.md`
- 이후 구현(참고): PR #1(결제 실패 보존·재고 차감 시점·관리자 실패 정보), PR #2(환불), PR #3(취소) — `notes/order-status-implementation.md`, `notes/handoff-2026-10-16.md`
