## 결정이 필요한 질문

이 문서는 사람이 확정할 정책을 모아 둔 곳입니다. 아래 항목은 다음 작업 목록이 아니며, 조사·정리 단계에서는 선택하거나 구현하지 않습니다.

### 실패 결제 상태의 범위는 어떻게 정할까요?

- `payment_failed`와 `refunded`를 함께 추가한다
- 이번 변경에서는 `payment_failed`만 추가한다

처리 상태: 확정

실제 선택 결과: 이번 변경에서는 `payment_failed`만 추가한다. `refunded` 상태와 흐름은 이번 범위에서 제외한다.

plan 적용 위치: [수정 범위 — 결제 실패](order-status-plan.md#수정-범위), [제외 범위 — 주문 환불](order-status-plan.md#제외-범위)

### 결제 실패 API의 응답은 무엇으로 정할까요?

- `402 Payment Required`와 실패 정보를 반환한다
- `200 OK`와 `{ ok: false }`를 반환한다

처리 상태: 확정

실제 선택 결과: `402 Payment Required`와 실패 정보를 반환한다.

plan 적용 위치: [수정 범위 — 결제 실패](order-status-plan.md#수정-범위), [검증 시나리오 — 결제 실패 주문 보존](order-status-plan.md#검증-시나리오)

### `payment_failed` 주문의 재결제를 허용할까요?

- 새 카드 토큰으로 재결제를 허용한다
- 실패 주문은 재결제를 허용하지 않는다

처리 상태: 확정

실제 선택 결과: 실패 주문은 재결제를 허용하지 않는다.

plan 적용 위치: [수정 범위 — 실패 주문 재결제](order-status-plan.md#수정-범위), [제외 범위 — 재결제 이후 상태 처리](order-status-plan.md#제외-범위), [검증 시나리오 — 실패 주문 재결제 거부](order-status-plan.md#검증-시나리오)

### 관리자 목록에 실패 정보를 어느 범위까지 표시할까요?

- 실패 상태, 금액, 시각을 모두 표시한다
- 실패 상태만 표시한다

처리 상태: 확정

실제 선택 결과: 실패 상태, 금액, 시각과 결제 실패 사유를 모두 표시한다.

plan 적용 위치: [수정 범위 — 관리자가 실패 주문 조회](order-status-plan.md#수정-범위), [검증 시나리오 — 관리자 실패 주문 조회](order-status-plan.md#검증-시나리오)

### 테스트 범위는 어떻게 정할까요?

- 완료 조건의 네 흐름만 검증한다
- 실패 주문 조회, 재고 유지, 관리자 실패 사유 조회, 재결제, 중복 차감 방지를 모두 검증한다

처리 상태: 확정

실제 선택 결과: 실패 주문 조회, 재고 유지, 관리자 실패 사유 조회, 재결제, 중복 차감 방지를 모두 검증한다.

plan 적용 위치: [테스트·검증 계획](order-status-plan.md#테스트검증-계획)

## E3 추가 결정 (기존 선택지 밖)

아래 결정은 위 질문의 선택지에 없었으므로, 선택 결과에 섞지 않고 별도로 추적한다.

### 주문 생성 시 재고 부족 주문 차단

처리 상태: 확정

실제 선택 결과: 주문 수량이 현재 재고보다 많으면 주문을 저장하거나 재고를 변경하기 전에 차단한다.

plan 적용 위치: [수정 범위 — 주문 생성과 재고 부족 주문 차단](order-status-plan.md#수정-범위), [검증 시나리오 — 재고 부족 주문 차단](order-status-plan.md#검증-시나리오)

## 2026-10-16 구현 시 확정 (보류 항목)

구현 단계에서 정책 문서가 비워 둔 지점을 저장소 소유자가 확정했다. 적용 위치는 각 정책 문서의 「확정」 절과 [구현 기록](order-status-implementation.md).

### 주문 생성 시 재고 부족 응답

처리 상태: 확정 — `409 Conflict`, `{ message: 'Insufficient stock', productId }`. 주문 미저장, 재고 불변. 적용: `docs/inventory-policy.md` 「재고 부족 응답」

### `payment_failed` 주문 재결제 거부 응답

처리 상태: 확정 — 기존 `400 { message: 'Order is not payable' }` 유지, 새 정책을 만들지 않음. 적용: `docs/payment-policy.md` 「확정된 응답」

### 결제 시점 재고 부족

처리 상태: 확정 — `409`, 주문 `pending` 유지, 결제 시도 이력 미기록, 재고 불변. 적용: `docs/inventory-policy.md`, `docs/payment-policy.md`

### 관리자 목록에서 `payment_failed` 주문의 실패 이력이 하나가 아닐 때

처리 상태: 확정 — 데이터 불일치로 보고 `500 { message: 'Inconsistent payment failure record', orderId }`. 여러 이력 중 선택 규칙은 만들지 않음. 적용: `docs/order-policy.md` 「`payment_failed` 주문 표시 조건」

## 2026-10-16 환불 흐름 확정

저장소 소유자가 「환불 흐름도 결정해서 구현해 달라」고 위임해, 아래를 확정하고 구현했다. 적용 위치: `docs/order-policy.md` 「환불 전환의 구현」, `docs/payment-policy.md` 「환불」, `docs/inventory-policy.md` 「환불 시 재고 복원」, [구현 기록](refund-implementation.md).

### 환불 API와 금액 반환 방식

처리 상태: 확정 — `POST /orders/:id/refund`, 본문 없음, 전액 환불만. 실결제 연동이 없으므로 금액 반환은 즉시 완료로 모사하고 환불 이력을 보존.

### 환불 가능 상태와 거부 응답

처리 상태: 확정 — `paid`만 허용. 그 밖의 상태는 `400 { message: 'Order is not refundable', status }`, 상태·이력·재고 불변. `refunded` 주문의 재결제는 기존 `400 Order is not payable`.

### 환불 시 재고 복원

처리 상태: 확정 — 환불 완료 시점에 결제 성공 때 차감한 수량을 주문 전체 기준으로 한 번 복원.

### 관리자 목록의 환불 정보

처리 상태: 확정 — `refunded` 주문에만 `refund { amountKrw, at }` 첨부. 환불 이력이 하나가 아니면 데이터 불일치로 `500`.

### 여전히 보류

- 부분 환불, 외부 결제 제공자 연동 시 비동기 환불, `cancelled` 엔드포인트(`pending → cancelled`), `cancelled → pending` 재개, 네트워크 재시도.
