# 환불 흐름 구현 기록 (2026-10-16)

입력: `docs/order-policy.md`(상태 전환표의 `paid → refunded` 허용, 보류·금지 전환), `docs/payment-policy.md`·`docs/inventory-policy.md`의 환불 관련 보류 사항, [결정 추적](pending-decisions.md) 「2026-10-16 환불 흐름 확정」.
브랜치: `feat/refund-flow`.

## 변경 내용

| 파일 | 변경 |
| --- | --- |
| `src/store.ts` | `OrderStatus`에 `refunded` 추가, `Refund` 타입과 `refunds` 배열 추가(초기화 포함) |
| `src/inventory.ts` | `restoreStock(items)`: 주문 전체 기준 1회 복원, 알 수 없는 상품이 있으면 아무것도 바꾸지 않고 예외 |
| `src/refunds.ts` (신규) | `POST /orders/:id/refund`: 404 / 비환불 상태 400(불변) / `paid`면 재고 복원 → `refunded` → 이력 기록 → 200 |
| `src/server.ts` | `refundsRouter`를 `/orders`에 연결 |
| `src/admin.ts` | `refunded` 주문에만 `refund { amountKrw, at }` 첨부. 불일치 예외를 결제 실패·환불 공용(`InconsistentRecordError`)으로 정리 |
| `tests/orders.test.ts` | 환불 시나리오 7개 추가(성공·pending 거부·payment_failed 거부·중복 환불 방지·환불 후 재결제 거부·404·관리자 표시). 총 22개 |

## 상태 전환표 대조

| 전환 | 정책 판정 | 구현 |
| --- | --- | --- |
| `paid → refunded` | 허용 | 환불 API 성공 경로 |
| `pending → refunded` | 금지 | 400 거부, 불변 |
| `payment_failed → refunded` | 표에 없음 → 보류 | 400 거부, 불변 |
| `refunded → refunded` | 표에 없음 → 보류 | 400 거부, 중복 복원 없음 |
| `refunded → paid` | 보류 | 기존 `Order is not payable` 400 |
| `refunded → cancelled` | 금지 | 취소 API 없음 |
| `paid → cancelled` | 금지 | 취소 API 없음 |

## 검증 실행 결과

| 명령 | 결과 |
| --- | --- |
| `npm test` | 통과 — 22 테스트 |
| `npm run typecheck` | 통과 |
| `npm run lint` | 통과 |
| `npm start` + curl | 결제 → 환불 200·재고 복원 / 중복 환불 400 / 환불 주문 재결제 400 / 관리자 목록 `refund` 표시 확인 |

## 남은 위험과 미결

- 부분 환불과 외부 결제 제공자 연동 시 비동기 환불은 보류다. 현재 구현은 즉시 완료 모사라 실제 결제사 연동 시 상태 모델을 다시 봐야 한다.
- `cancelled` 흐름(엔드포인트)은 여전히 없다. 정책 전환표에는 `pending → cancelled` 허용이 있으므로 다음 후보다.
- README의 엔드포인트·상태 표는 강의 원본(v0 기준)이라 손대지 않았다. 원본 저장소 업데이트를 받을 때 충돌을 피하기 위해서다.
