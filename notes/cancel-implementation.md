# 취소 흐름 구현 기록 (2026-10-16)

입력: `docs/order-policy.md` 상태 전환표(`pending → cancelled` 허용, `paid`·`refunded → cancelled` 금지, `cancelled → paid` 금지, `cancelled → pending` 보류), [결정 추적](pending-decisions.md) 「2026-10-16 취소 흐름 확정」.
브랜치: `feat/cancel-flow`.

## 변경 내용

| 파일 | 변경 |
| --- | --- |
| `src/store.ts` | `Cancellation` 타입과 `cancellations` 배열 추가(초기화 포함). `OrderStatus`의 `cancelled`는 이미 있었음 |
| `src/cancellations.ts` (신규) | `POST /orders/:id/cancel`: 404 / 비취소 상태 400(불변) / `pending`이면 `cancelled` → 이력 기록 → 200 |
| `src/server.ts` | `cancellationsRouter`를 `/orders`에 연결 |
| `src/admin.ts` | `cancelled` 주문에만 `cancellation { at }` 첨부, 불일치 예외 종류에 `cancellation` 추가 |
| `tests/orders.test.ts` | 취소 시나리오 7개 추가(성공·paid 거부·payment_failed/refunded 거부·중복 취소 방지·취소 후 결제/환불 거부·404·관리자 표시). 총 29개 |

## 상태 전환표 대조

| 전환 | 정책 판정 | 구현 |
| --- | --- | --- |
| `pending → cancelled` | 허용 | 취소 API 성공 경로, 재고 불변 |
| `paid → cancelled` | 금지 | 400 거부 |
| `refunded → cancelled` | 금지 | 400 거부 |
| `payment_failed → cancelled` | 표에 없음 → 보류 | 400 거부 |
| `cancelled → cancelled` | 표에 없음 → 보류 | 400 거부, 이력 중복 없음 |
| `cancelled → paid` | 금지 | 기존 `Order is not payable` |
| `cancelled → refunded` | 표에 없음 → 보류 | 기존 `Order is not refundable` |
| `cancelled → pending` | 보류 | 엔드포인트 없음 |

## 검증 실행 결과

| 명령 | 결과 |
| --- | --- |
| `npm test` | 통과 — 29 테스트 |
| `npm run typecheck` | 통과 |
| `npm run lint` | 통과 |
| `npm start` + curl | pending 취소 200·재고 불변 / 재취소 400 / 취소 주문 결제·환불 400 / paid 주문 취소 400 / 관리자 `cancellation` 표시 |

## 남은 위험과 미결

- 이로써 정책 전환표의 허용 전환은 모두 구현됐다. 남은 것은 보류 전환(`cancelled → pending`, `refunded → paid`)과 부분 환불, 외부 결제사 비동기 처리다.
- README의 엔드포인트·상태 표는 강의 원본(v0 기준)이라 그대로 두었다.
