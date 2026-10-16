# 계획 — Issue #6 결제 거부 응답에 사유·다음 행동 안내 추가

역할: planner(`docs/prompts/planner.md`). 요청 원문은 [Issue #6](https://github.com/seotaioh/order-ops/issues/6)뿐이다.

## 요청 요약

결제에 실패한 주문을 다시 결제하려는 요청이 `400 Order is not payable`로 거부되는데, 고객과 운영자 어느 쪽에도 왜 안 되는지·다음에 무엇을 해야 하는지가 전달되지 않는다. 완료 조건(Issue AC): 거부 뒤 상태·이력 불변 / 응답이 결정에 맞는 값 / 재고·이력·상태 미변경 / 세 가지를 판정하는 테스트가 `npm test`를 통과.

## 사람 결정 (2026-10-16 저장소 소유자)

| # | 질문 | 결정 |
| --- | --- | --- |
| 1 | 재결제 금지 정책 유지(A) / 변경(B) | **A 유지** |
| 2 | A일 때 상태 코드 | **400 유지** — 환불·취소 거부와 일관, 409는 재고 부족에 이미 사용 |
| 3 | 안내 형식 | 본문을 `{ message, status, reason, nextAction }`로 확장. `message`는 `Order is not payable` 그대로. 상태별 `reason`/`nextAction`: `payment_failed → repayment_not_allowed / create_new_order`, `paid → already_paid / none`, `cancelled → order_cancelled / create_new_order`, `refunded → order_refunded / create_new_order`, 그 밖(결제 불가 `pending`) → `not_payable / none` |
| 4 | VOC 환경 확인 | **현재 코드 기준으로 닫음** |

Out of Scope 확정: 거부된 재결제를 이력으로 남기는 것(관리자 「실패 이력 정확히 1건」 불변식과 충돌), `payment_failed → paid` 전환 허용, 고객용 UI.

## 정책 근거

- `docs/payment-policy.md` 「결제 원칙」: 재결제 거부는 상태·이력을 바꾸지 않는다 → 응답 본문만 바뀐다.
- `docs/payment-policy.md` 「확정된 응답」: 현재 `400 { message }`로 확정돼 있으므로 이 계획이 그 표를 갱신한다(결정 2·3).
- `docs/payment-policy.md` 「결제 원칙」 실패 정보에 카드 정보·내부 오류·스택 미포함 → `reason`은 고정 코드 집합만.
- `docs/order-policy.md` 「상태 전환 조건」: 거부 응답은 전환이 아니다 → 전환표 불변.
- 선례: `src/refunds.ts`·`src/cancellations.ts`의 거부 본문 `{ message, status }`.

## 변경 범위

| 파일 | 바꾼다 | 건드리지 않는다 |
| --- | --- | --- |
| `src/payments.ts` | 거부 분기(현재 87행)에서 `status`·`reason`·`nextAction`을 함께 반환. 상태 → 사유 매핑 함수 1개 추가 | `isPayable()`의 허용 조건, 실패 402 분기, 성공 분기, 재고 처리, 라우트 경로 |
| `tests/orders.test.ts` | `rejects re-payment of a payment_failed order…`(195행)와 `(d)`(572행)의 응답 단언을 새 본문 정확값으로. `paid a second time`(137행)·`paying a refunded order`(372행)·`paying … a cancelled order`(481행)에 거부 본문 정확값 단언 추가 | 그 밖의 테스트, 헬퍼, import |
| `docs/payment-policy.md` | 「확정된 응답」 표의 재결제 거부 행과 50~51행 문장을 새 본문으로 갱신, 사유 코드 집합 명시 | 다른 절 |
| `notes/pending-decisions.md` | 「Issue #6 결정 (2026-10-16)」 절 추가 | 기존 절 |
| `src/admin.ts`, `src/store.ts`, 그 외 `src/` | — | 전부 |

## 검증 계약

| 시나리오 | 준비 | 행동 | 기대 |
| --- | --- | --- | --- |
| S1 실패 주문 재결제(정상 토큰) | 주문 → `FAIL-…` 결제 | `CARD-…` 재결제 | `400 { message:'Order is not payable', status:'payment_failed', reason:'repayment_not_allowed', nextAction:'create_new_order' }`, 상태·이력(1건)·재고 불변 |
| S2 실패 주문 재시도(FAIL 토큰) | 같음 | `FAIL-…` 재시도 | 같은 본문, 이력 1건 유지 (`(d)` 갱신) |
| S3 결제 완료 주문 재결제 | 결제 성공 | 재결제 | `400`, `status:'paid'`, `reason:'already_paid'`, `nextAction:'none'`, 재고 추가 차감 없음 |
| S4 환불 주문 결제 | 결제 → 환불 | 결제 | `400`, `status:'refunded'`, `reason:'order_refunded'`, `nextAction:'create_new_order'` |
| S5 취소 주문 결제 | 취소 | 결제 | `400`, `status:'cancelled'`, `reason:'order_cancelled'`, `nextAction:'create_new_order'` |
| S6 민감정보 | 위 응답들 | — | 본문에 토큰·내부 오류 없음(기존 `(c)` 테스트 + 고정 코드 집합) |

명령: `npm test` → `npm run typecheck` → `npm run lint` 순. 하나라도 실패하면 기대값을 고치지 않고 멈춘다. `git diff --name-only`가 위 4개 파일(+ 이 계획, reviewer 기록)만 포함해야 한다.

## 사람 결정 필요

없음(결정 1~4 확정). 승인: 저장소 소유자, 2026-10-16 Claude Code 대화에서 「승인」.

## Reviewer 결과와 처리 (`notes/reviewer-findings-issue-6.md`)

차단 0 / 권고 5 / 질문 4. 처리(소유자가 구현 위임, 2026-10-16):

| 항목 | 처리 |
| --- | --- |
| R1 정책 50~51행 「같은 응답」 참조 모호 | 수정 — 결제 거부 응답과 사유 코드를 직접 명시 |
| R2 사유 코드 절이 환불 절 하위에 위치 | 수정 — 「확정된 응답」 표 아래 `##` 절로 이동 |
| T2 `(c)` 민감정보 테스트에 400 거부 응답 없음 | 수정 — 검사 대상에 거부 응답 추가(계획의 「그 밖의 테스트 불변」 조항을 이 한 곳에 한해 완화) |
| R3 `pending-decisions.md` 기존 확정 항목에 대체 표시 없음 | 수정 — 두 항목에 Issue #6 결정 참조 한 줄 추가 |
| R5 `.claude/launch.json` | 커밋 제외(기존 방침) |
| T1 `not_payable` 분기 | 도달 불가 판정 수용, 테스트 추가 없음 |
| Q4 보류 전환과 `nextAction` 값의 연결 | 결정 기록에 「연결된 보류 항목」 추가 |
