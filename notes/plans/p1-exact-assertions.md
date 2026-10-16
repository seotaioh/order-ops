# 계획 — 정책 확정 응답의 정확값 단언 보강 (backlog P1)

역할: planner(`docs/prompts/planner.md`). 요청: `notes/backlog-l20.md` P1 두 번째 항목(Lab 17 reviewer 권고, Lab 19 후보 B 시험에서 확인된 표류 3건 + ISO 8601·행 수).

## 요청 요약

정책 문서가 확정값으로 적은 응답(상태 코드·본문)을 테스트가 「200이 아님」 수준으로만 검사하는 곳을 정확값 단언으로 바꾼다. 완료 조건: 아래 대상이 모두 정확값으로 고정되고 `npm test`·`typecheck`·`lint` 통과, `src/` 변경 없음, Lab 19 후보 B 점검 ④(정책 문자열 ↔ 테스트) 0건.

## 정책 근거

| 대상 | 정책 문장 |
| --- | --- |
| 주문 생성 시 재고 부족 | `docs/inventory-policy.md` 「재고 부족 응답」: `409 Conflict`, `{ "message": "Insufficient stock", "productId": "<부족한 상품>" }`, `productId`는 부족이 발견된 첫 상품 |
| 결제 시점 재고 부족 | `docs/payment-policy.md` 「확정된 응답」: `409`, 같은 본문, 이력 미기록, `pending` 유지 |
| 환불 거부 | `docs/payment-policy.md` 「환불」: `400 { "message": "Order is not refundable", "status" }` |
| 취소 거부 | `docs/order-policy.md` 「취소 전환의 구현」: `400 { "message": "Order is not cancellable", "status" }` |
| 시각 필드 | `failure.at`·`refund.at`·`cancellation.at`은 ISO 8601 (`new Date().toISOString()`) — `src/*.ts` 구현과 Lab 17 계획 S1 |
| 관리자 행 수 | `docs/order-policy.md` 「관리자 조회 기준」: 저장된 주문 전부가 기준 → 행 수 = 저장 주문 수 (Lab 17 계획 S4) |

## 변경 범위

| 파일 | 바꾼다 | 건드리지 않는다 |
| --- | --- | --- |
| `tests/orders.test.ts` | 느슨한 단언 13곳을 정확값으로 교체(409 본문 4, 환불 거부 400 본문 4, 취소 거부 400 본문 4, 결제 시점 재고 부족 1), ISO 8601 헬퍼 1개 + 적용 6곳, 관리자 행 수 단언 1곳 | 테스트 이름·구조, 헬퍼 시그니처, 다른 단언 |
| `src/**`, `docs/**` | — | 전부 (정책 값은 이미 확정돼 있음) |

## 검증 계약

`npm test` → `npm run typecheck` → `npm run lint`. 추가: Lab 19 후보 B 점검 ④ 재실행 — `Insufficient stock`·`Order is not refundable`·`Order is not cancellable`이 테스트에 1건 이상 등장. 실패 시 기대값을 고치지 않고 멈춘다(정책 값과 코드가 다르면 그것이 발견이다).

## 사람 결정 필요

없음 — 모든 값이 정책 「확정」 절에 있다. 소유자가 2026-10-16 「P1 정확값 단언 보강 진행」으로 착수 지시.

## Reviewer 결과와 처리 (`notes/reviewer-findings-p1-assertions.md`)

차단 0 / 권고 4 / 질문 4. 새 정확값 단언 18개 모두 정책 문장과 글자 단위 일치 판정.

| 항목 | 처리 |
| --- | --- |
| 권고 1 `notes/backlog-l20.md`·`pending-decisions.md`의 완료 표기가 계획 범위 밖 + 머지 전 선행 기록 | 같은 PR에 포함(머지 시점에 사실이 됨). 다음 계획부터 기록 파일도 변경 범위 표에 적는다 |
| 권고 2 시각 형식(ISO 8601)이 정책 문서에 없어 테스트만이 고정점 | `docs/payment-policy.md`·`docs/order-policy.md`에 한 문장씩 추가(확정) |
| 권고 3 `refund` `toMatchObject`가 추가 필드 허용 | `toEqual({ amountKrw, at })`로 정리. `reason: expect.any(String)` 2곳은 같은 값이 테스트 (b)에서 정확 고정돼 있어 그대로 둠 |
| 권고 4 「여러 상품 부족 시 첫 상품만」 테스트 부재 | backlog P3 등록 |
| 질문 4 Lab 19 후보 B 점검 ④ 재실행 | 실행함: `Insufficient stock` 4 / `Order is not refundable` 4 / `Order is not cancellable` 4 (각 테스트 파일 내 등장 횟수) |
