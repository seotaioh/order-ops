# 주문 상태 처리 개선 — 구현 기록 (2026-10-16)

입력: [승인된 계획](order-status-plan.md), [결정 추적](pending-decisions.md), `docs/order-policy.md`, `docs/payment-policy.md`, `docs/inventory-policy.md`.
브랜치: `feat/order-status-payment-failed`.

## 변경 내용

| 파일 | 변경 | 근거 |
| --- | --- | --- |
| `src/store.ts` | `OrderStatus`에 `payment_failed` 추가. `PaymentAttempt.failureReason`(안전한 사유 코드, 실패 시도에만) 추가 | 결정 추적 「`payment_failed`만 추가」, 주문 정책 관리자 조회 기준(실패 사유 필요) |
| `src/inventory.ts` (신규) | 같은 상품 수량 합산, 부족 상품 탐색, 전체 기준 1회 차감 | 재고 정책 원칙. 주문 생성과 결제가 같은 검사 함수를 쓰게 해 규칙 복제를 피함 |
| `src/orders.ts` | 생성 시 재고 차감 제거. 저장 전 합산 재고 검사, 부족 시 저장·차감 없이 차단 | 재고 정책, E3 추가 결정 |
| `src/payments.ts` | 실패 시 주문 삭제 → `payment_failed` 보존 + 실패 이력 + HTTP 402. 성공 직전 재고 재검사 후 1회 차감. 오류를 200으로 삼키던 try/catch 제거. 응답에 카드 토큰 미포함 | 결제 정책, 주문 정책, 재고 정책, AGENTS.md(silent fallback 금지) |
| `src/admin.ts` | 저장 상태 그대로 표시(`'결제실패'` 파생 제거). `payment_failed` 주문에만 `failure{amountKrw, at, reason}` 첨부. 상태·이력 불일치는 500으로 드러냄. 빈 배열로 삼키던 catch 제거 | 주문 정책 관리자 조회 기준·노출 제외 정보 |
| `tests/orders.test.ts` | 기존 4개 유지 + 승인된 6개 시나리오를 11개 테스트로 추가 | 계획의 검증 시나리오·테스트 범위 결정 |

## 보류 정책에 대해 이번에 고른 값 (2026-10-16 저장소 소유자가 확정, 정책 문서에 반영 완료)

문서가 비워 두었던 지점이다. 확정 뒤 `docs/inventory-policy.md`·`docs/payment-policy.md`·`docs/order-policy.md`와 `notes/pending-decisions.md`에 올렸다. 테스트는 이 값에 의존하지 않도록 상태 코드 대신 「201 아님 / 저장 안 됨 / 재고 불변」으로 판정한다.

| 지점 | 고른 값 | 비고 |
| --- | --- | --- |
| 주문 생성 시 재고 부족 응답 | `409 Conflict` `{ message: 'Insufficient stock', productId }` | `docs/inventory-policy.md` 「재고 부족 응답」 |
| `payment_failed` 주문 재결제 거부 응답 | 기존 분기 유지: `400 { message: 'Order is not payable' }` | 새 정책을 만들지 않음 |
| 결제 시점 재고 부족 | `409`, 주문 `pending` 유지, 결제 시도 이력 미기록, 재고 불변 | 카드 처리 단계에 진입하지 않았으므로 이력을 남기지 않음 |
| 관리자: `payment_failed` 주문의 실패 이력이 0개 또는 2개 이상 | 데이터 불일치로 보고 `500 { message, orderId }` | 여러 이력 중 선택 기준은 정책상 사람 결정 필요. 현재 흐름(재결제 금지)에서는 발생하지 않음 |

## 검증 실행 결과

| 명령 | 결과 |
| --- | --- |
| `npm test` | 통과 — 1 파일 15 테스트 |
| `npm run typecheck` | 통과 — 오류 없음 |
| `npm run lint` | 통과 — 오류 없음 |
| 수동(`npm start` 후 curl) | 재고 부족 차단 409 / 생성 시 재고 불변 / FAIL 결제 402·주문 보존·조회 200 / 재결제 400 거부 / 정상 결제 paid·재고 차감 / 관리자 목록에 실패 금액·시각·사유 표시 확인 |

## 남은 위험과 미결

- `cancelled`, `refunded` 흐름과 환불 API는 계획대로 제외했다. `OrderStatus`에 `refunded`는 추가하지 않았다.
- 저장소는 여전히 메모리 기반이라 서버 재시작 시 데이터가 사라진다(계획의 제외 범위).
