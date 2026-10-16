# PR draft — PR #1 「주문 상태 정책 구현」 (Lab 16 사후 작성)

작성일 2026-10-17. 대상은 2026-10-16 17:31 KST에 머지된 **PR #1** `feat: 주문 상태 정책 구현 — 결제 실패 보존·재고 차감 시점·관리자 실패 정보` (브랜치 `feat/order-status-payment-failed` → `main`, 커밋 `1501eb7`·`477e7ca`, 머지 커밋 `9cb009c`)다. 이 fork는 Lab 12~16의 코드 변경을 이 PR에서 한 번에 수행했으므로, Lab 16 절차(범위 대조 → preflight → draft → review-ready 판정)를 머지된 PR에 **사후 적용**해 적는다. 당시 실제 PR 본문(`gh pr view 1 --json body`)은 「요약 / 보류 정책에 대해 고른 값 / 검증 / 범위 밖」 네 절이었고 아래 여섯 고정 헤딩을 쓰지 않았다.

- 기준선: base `e8c7010`(PR #1 직전 `main`), head `477e7ca`, diff 범위 `e8c7010..9cb009c`. Lab 16이 기준선 출처로 적은 `notes/session-handoff.md`는 HEAD `f66fc2c` 추적본에 없었고, 2026-10-17 병행 세션이 Lab 11 산출물로 새로 쓰고 있다(미추적). 그 문서도 「Lab 12 시작 HEAD」를 적지 않으며(이 fork는 Lab 12~16 코드 변경을 PR #1에서 수행), 승인 계획은 `notes/order-status-request.md`(요청)·`notes/order-status-plan.md`(계획)다. 같은 날 생긴 `docs/prompts/pr-description.md`의 금지 사항(미실행 검증을 통과로 쓰지 않음, 범위 밖 변경 분리, 머지 가능 여부 단정 금지)을 이 draft에도 적용했다.
- 「당시」는 2026-10-16 PR #1 시점의 사실, 「현재」는 2026-10-17 `main f66fc2c`에서 다시 확인한 사실이다. 둘을 섞지 않는다.

## Summary

주문 상태 정책(`docs/order-policy.md`)·결제 정책(`docs/payment-policy.md`)·재고 정책(`docs/inventory-policy.md`)과 승인 계획 `notes/order-status-plan.md` 「수정 범위」의 다섯 행을 코드로 옮겼다.

- 결제 실패 시 주문을 삭제하던 동작을 `payment_failed` 보존 + `402` + 실패 이력(안전한 사유 코드 `card_declined`)으로 바꿨다 (`payment-policy` 「결제 원칙」, `order-policy` 전환표 `pending → payment_failed`).
- 주문 생성 시 즉시 차감하던 재고를 결제 성공 직전 재검사 후 1회 차감으로 옮기고, 생성·결제 시점의 재고 부족을 `409`로 차단했다 (`inventory-policy` 「재고 원칙」).
- `payment_failed` 주문의 재결제를 거부한다 (`payment-policy` 「동일 주문 재결제 정책의 승격」).
- 관리자 목록은 저장 상태를 그대로 쓰고 `payment_failed` 주문에만 `failure { amountKrw, at, reason }`를 붙인다. 실패 이력이 정확히 1건이 아니면 `500`으로 드러낸다 (`order-policy` 「관리자 조회 기준」).
- 오류를 삼키던 fallback 두 곳 — 결제 `catch → console.log + 200 { ok: false }`, 관리자 `catch → []` — 을 제거했다 (`AGENTS.md` Rules 「silent fallback 금지」).

정책이 비워 두었던 네 지점(주문 생성 시 재고 부족 응답, 재결제 거부 응답, 결제 시점 재고 부족, 관리자 불일치 응답)은 저장소 소유자가 같은 PR의 두 번째 커밋 `477e7ca`에서 확정해 정책 문서 「(2026-10-16 확정)」 절로 승격했다 (`notes/pending-decisions.md` 「2026-10-16 구현 시 확정」).

## Changed Files

`git diff --stat e8c7010 9cb009c`: 11 파일, +475 / −90.

| 파일 | 분류 | 변경 (`+`/`−`) | 근거 | 리뷰어가 다음에 읽을 것 |
| --- | --- | --- | --- | --- |
| `src/store.ts` | 코드 | +6/−1. `OrderStatus`에 `payment_failed`, `PaymentAttempt.failureReason` 추가 | 계획 「수정 범위 — 결제 실패」 | `docs/order-policy.md` 「상태 정의」 |
| `src/payments.ts` | 코드 | +72/−49. `try/catch` 제거, 실패 분기 `402`+보존+이력, 성공 직전 재고 재검사·1회 차감, `ParsedCardToken.value` 삭제 | 계획 「결제 성공」「결제 실패」「실패 주문 재결제」 | `docs/payment-policy.md` 「확정된 응답」, 테스트 `payment failure` |
| `src/admin.ts` | 코드 | +50/−12. `deriveDisplayStatus()`·`'결제실패'` 제거, `failure` 조건부 첨부, 불일치 `500`, `catch → []` 제거 | 계획 「관리자가 실패 주문 조회」 | `docs/order-policy.md` 「관리자 조회 기준」 |
| `src/orders.ts` | 코드 | +7/−5. 생성 시 재고 차감 제거, 저장 전 합산 재고 검사·부족 `409` | 계획 「주문 생성과 재고 부족 주문 차단」 | `docs/inventory-policy.md` 「재고 원칙」 |
| `src/inventory.ts` | 코드 — **계획 파일 목록 밖(신규)** | +45. 합산·부족 탐색·1회 차감 공용 함수 | 계획 「관련 파일 후보」에는 없으나 「수정 범위」의 재고 검사·차감 책임을 `orders.ts`·`payments.ts`가 중복 구현하지 않도록 분리한 것. 범위 밖 **후보**로 표시하되 목적은 계획 안 | `docs/inventory-policy.md`, 호출처 두 곳 |
| `tests/orders.test.ts` | 테스트 | +209/−13. 기존 4개 유지 + 11개 추가 = 15개 | 계획 「검증 시나리오」 6건과 「테스트 범위」 결정 | 아래 Verification |
| `docs/order-policy.md` | 정책 | +7/−8. 관리자 조회 「현재 제공 여부」 갱신, 불일치 응답 확정 | 소유자 확정 (`477e7ca`) | `notes/pending-decisions.md` |
| `docs/payment-policy.md` | 정책 | +9/−1. 「확정된 응답」 절 신설 | 소유자 확정 | 같음 |
| `docs/inventory-policy.md` | 정책 | +10/−1. 「재고 부족 응답」 절 신설 | 소유자 확정 | 같음 |
| `notes/pending-decisions.md` | 검증 기록 | +20. 「2026-10-16 구현 시 확정」 절 | 보류값 4건의 결정 추적 | — |
| `notes/order-status-implementation.md` | 검증 기록 | +40 (신규). 변경 내용·고른 값·검증 결과·남은 위험 | 구현 기록 | 아래 Verification |

범위 대조: 승인 계획 `notes/order-status-plan.md` 「관련 파일 후보」는 `src/store.ts`·`orders.ts`·`payments.ts`·`admin.ts`·`tests/orders.test.ts`(+탐색용 `server.ts`, `package.json`)다. 이 PR은 그 밖에 `src/inventory.ts`(신규)와 정책 문서 3개·기록 2개를 더 바꿨다. 정책 문서 변경은 계획이 「보류」로 둔 값을 소유자가 확정한 결과라 사후 승인이 있는 범위 밖 변경이고, `inventory.ts`는 계획 목적 안의 구조 분리다. Lab 17 reviewer는 뒤에 이를 PD-1~PD-6으로 기록했고 소유자가 「범위 밖으로 기록」으로 닫았다 (`notes/reviewer-findings-l17.md`, `notes/role-split-run-l17.md` 결정 표).

## Verification

### 당시 실행 (2026-10-16, head `477e7ca` 기준) — 출처 `notes/order-status-implementation.md` 「검증 실행 결과」, PR #1 본문 「검증」

| 명령 | 결과 |
| --- | --- |
| `npm test` | 통과 — 1 파일 **15 테스트** |
| `npm run typecheck` | 통과 — 오류 없음 |
| `npm run lint` | 통과 — 오류 없음 |
| `npm start` 후 curl 시나리오 7개 | 재고 부족 차단 409 / 생성 시 재고 불변 / `FAIL` 결제 402·주문 보존·조회 200 / 재결제 400 거부 / 정상 결제 `paid`·재고 차감 / 관리자 목록에 실패 금액·시각·사유 표시 |

당시 15개 테스트의 구성(`git show 9cb009c:tests/orders.test.ts`): `order operations` 4, `inventory policy — order creation` 4, `payment success` 3, `payment failure` 2, `admin order list` 2. `it.fails()`는 0건이었다.

### 당시 미실행

- `node labs/tools/check.mjs 15`·`16` — 실행 기록 없음(미실행). Lab 15·16 산출물 자체가 없었으므로 돌렸어도 FAIL이었을 것이다.
- 이 checklist(`docs/checklists/pr-preflight.md`)의 Scope·Diff·Failure handling 항목을 형식대로 기록한 preflight — 없음. 다만 `docs/automation/candidates.md`에 「PR #1~#3 머지 전 secret-scan grep 5회」 수행 사실이 적혀 있다(결과 원문은 남아 있지 않음 — **미확인**).

### 현재 재실행 (2026-10-17, `main f66fc2c`) — `notes/preflight-run-l16.md`

`npm test` 37 통과, `npm run lint`·`npm run typecheck` 통과, 민감정보 패턴 0건, silent fallback 패턴은 `src/admin.ts`의 승인된 `500` 분기 1건뿐. 정책 확정 문자열 중 `Inconsistent refund record`·`Inconsistent cancellation record`의 테스트 단언이 0건임을 새로 발견했다(보류로 기록).

### 증거의 유효 범위

당시 결과는 head `477e7ca`의 15개 테스트에 대한 것이다. 그 뒤 PR #2(환불)·#3(취소)·#5(Lab 17 테스트 7개)·#9(Lab 20 회귀 1개)·#11(Issue #6 거부 본문)·#12(정확값 단언)가 `src`·`tests`를 바꿨으므로, 당시 결과를 현재 상태의 증거로 쓰지 않고 현재 재실행 결과를 따로 둔다.

## Risk

| 위험 | 근거 | 당시 상태 | 현재 상태 |
| --- | --- | --- | --- |
| 데이터 불일치 `500` 경로를 보호하는 테스트가 없었다. `catch → []`를 되돌리거나 응답에 `error.message`를 넣어도 통과했을 것 | `notes/reviewer-findings-l17.md` 테스트 누락 (a) — 당시 `grep -n "500\|Inconsistent" tests/orders.test.ts` 매치 없음 | 미보호 | PR #5(`d1a76b2`)에서 `(a)` 4개 추가 → 보호됨 |
| `failure.reason`이 `card_declined`라는 확정값을 단언하지 않았다(`expect.any(String)`). 제공자 메시지를 그대로 담는 회귀를 막지 못함 | 같은 문서 (b) | 미단언 | PR #5에서 `(b)` 추가 → 단언됨 |
| 카드 토큰 비노출 검사가 402 본문과 관리자 실패 행에만 있었다. 성공 200·단건 조회·`cardToken` 키 부재는 미검사 | 같은 문서 (c) | 부분 | PR #5에서 `(c)` 추가 → 전 응답 검사 |
| 처리되지 않은 예외가 Express 4 기본 핸들러로 가면 `NODE_ENV !== 'production'`에서 스택이 HTML 500 본문에 실린다. `src/server.ts`에 에러 미들웨어 없음 | 같은 문서 PI-1. 현재 입력으로 도달하는 경로는 찾지 못함(전수 증명 아님) | 보류 | **여전히 보류** (`notes/backlog-l20.md` P2). 사람 결정 전까지 형식을 정하지 않는다 |
| 보류 정책 4건을 구현 중에 고르고 같은 PR에서 정책 문서에 승격했다. 계획은 「정책 문서를 고치지 않는다」였다 | `477e7ca`, Lab 17 reviewer PD-6·Q5 | 사후 승인(소유자가 직접 확정) | 닫힘 — `notes/role-split-run-l17.md` 결정 표에서 「범위 밖으로 기록」 |
| 승인 계획과 Lab 17 계획이 같은 변경을 다른 범위로 적어 두 문서가 공존한다 | `notes/order-status-plan.md` vs `notes/plans/l17-admin-failure-reason.md` | — | 다음 작업은 하나의 승인 계획만 입력으로 삼는다(`notes/role-split-run-l17.md` 「남은 위험」) |
| Lab 15·16 전제(`it.fails()` 잔존, `deriveDisplayStatus()` 유지)가 이 fork에 없다. Lab 체크박스 일부가 성립하지 않음 | `notes/handoff-2026-10-16.md` 「다음 사람이 알아야 할 것」 | — | 각 lab 기록에 「Lab 전제와의 차이」로 명시 |
| 메모리 저장소라 재시작 시 주문·이력이 사라진다 | `AGENTS.md` Project Overview, 계획 「제외 범위 — 저장 기술」 | 계획상 제외 | 변동 없음 |
| 네트워크·인프라 재시도의 조건·식별·횟수 | `docs/payment-policy.md` 「보류 사항」 | 보류 | 보류 유지. `docs/retry-stop-matrix.md` 11번 행 |

## Rollback Note

- 되돌릴 단위는 머지 커밋 `9cb009c`다(`git revert -m 1 9cb009c`). 다만 **지금은 깨끗하게 되돌아가지 않는다**: PR #2(`fb5a3c2`)의 `src/refunds.ts`가 이 PR이 만든 `src/inventory.ts`의 `restoreStock`을 import하고(`grep -n "from './inventory.js'" src/refunds.ts`), `src/inventory.ts`는 PR #2에서 다시 수정됐다(`git log --oneline -- src/inventory.ts`: `fb5a3c2`, `1501eb7`). 이후 커밋 `1a6ef15`·`d1a76b2`·`badbefb`·`37f5070`·`faa1da9`도 `src`·`tests`를 덮어쓴다. 따라서 PR #1만 되돌리면 충돌과 컴파일 실패가 예상된다 — 실제 revert는 실행하지 않았으므로 충돌 범위는 **미확인**.
- 현실적인 되돌림은 (1) 특정 동작만 정책 결정과 함께 고치는 forward fix, 또는 (2) `9cb009c` 이전으로 돌아가되 PR #2·#3·#11·#12를 함께 되돌리는 것이다. (2)는 환불·취소 엔드포인트와 Issue #6 응답도 사라지므로 사람 결정 없이 하지 않는다.
- 되돌릴 때 함께 봐야 할 정책: `477e7ca`가 승격한 「(2026-10-16 확정)」 절 세 곳과 `notes/pending-decisions.md`. 코드만 되돌리고 정책 문서를 두면 정책과 구현이 어긋난다.
- 실패 이력을 삭제하거나 `catch → []`·`200 { ok: false }`를 복구해 증상을 없애는 것은 rollback 수단이 아니라 정책 위반이다(`AGENTS.md` Rules).

## Reviewer Notes

읽기 순서: 정책 → 승인 계획 → 코드 diff → 테스트 → 검증 기록.

1. `docs/order-policy.md` 「상태 전환 조건」·「관리자 조회 기준」, `docs/payment-policy.md` 「결제 원칙」·「확정된 응답」, `docs/inventory-policy.md` 「재고 원칙」·「재고 부족 응답」 — 이 PR이 맞춰야 했던 문장.
2. `notes/order-status-plan.md` 「수정 범위」·「검증 시나리오」 — 승인된 다섯 행과 여섯 시나리오. 「제외 범위」로 환불·취소가 빠져 있음을 확인.
3. `git diff e8c7010 9cb009c -- src` — 먼저 `src/payments.ts` 실패 분기(삭제 줄 `orders.delete`, `catch (e) { console.log(e); res.json({ ok: false }); }`)와 `src/admin.ts` `catch` 분기(삭제 줄 `res.json([])`)를 본다. 그 다음 `src/inventory.ts`가 계획 파일 목록 밖임을 확인.
4. `git show 9cb009c:tests/orders.test.ts` — 15개. 각 시나리오가 상태·응답·저장 결과를 직접 묻는지. 당시 느슨했던 단언(`expect.any(String)`, `not.toBe(200)`)은 위 Risk 표 참고.
5. `notes/order-status-implementation.md`, `notes/pending-decisions.md` 「2026-10-16 구현 시 확정」 — 무엇을 확인했고 무엇을 소유자가 정했는지.

사람이 정해야 할 것(당시 기준): 보류값 4건(소유자가 `477e7ca`에서 확정), `src/inventory.ts`·정책 문서 변경의 범위 밖 처리(뒤에 Lab 17에서 「범위 밖으로 기록」). 현재 남은 것: PI-1 500 형식.

Lab 17 reviewer(`notes/reviewer-findings-l17.md`)는 이 PR을 사후 검토해 차단 5건(PD-1~3 재고 묶음, 테스트 누락 (a)·(b))·권고 9건을 냈고, 소유자 결정으로 테스트 7개(`(a)` 4·`(b)`·`(c)`·`(d)`)가 PR #5에서 보강됐다.

## Review-ready 판정

**판정: conditional ready (사후 판정, 2026-10-16 PR #1 시점 기준).** 검증 명령은 모두 통과했지만, 사람 판단이 남은 항목(보류값 확정, 범위 밖 파일)과 뒤에 드러난 테스트 공백이 있었으므로 `ready`가 아니다. `not ready`도 아니다 — 변경은 정책과 승인 계획에서 출발했고 fallback 제거·정상 경로 검증은 갖춰져 있었다.

### preflight 항목별 결과 (`docs/checklists/pr-preflight.md`를 당시 diff에 적용)

| # | 항목 | 당시 관찰 | 판정 | 당시 놓친 것 |
| --- | --- | --- | --- | --- |
| 1 | Scope | 변경 11 파일. 계획 파일 후보 5개 + `src/inventory.ts`(신규) + 정책 3 + 기록 2. `labs/` 변경 없음 | 보류 | 범위 밖 후보를 PR 본문에 「범위 밖」으로 분리해 적지 않았다(본문은 「보류 정책에 대해 고른 값」으로만 설명). Lab 17 reviewer PD-1~PD-6 |
| 2 | Policy | 보류 4건을 소유자가 확정해 `477e7ca`로 승격. 금지·보류 전환은 거부로 구현 | 통과(사람 확정 있음) | 확정 경위가 PR 본문에 「테스트는 이 값에 의존하지 않습니다」로만 적혀, 확정이 아니라 임시 선택처럼 읽혔다 |
| 3 | Tests | `npm test` 15 통과. `it.fails()` 없음 | 통과(실행) / 보류(단언) | `500`·`card_declined`·`409` 본문·거부 `400` 본문이 미단언 → Lab 17 reviewer (a)(b)(d), Lab 19 후보 B ④. PR #5에서 7개, PR #12에서 정확값 보강 |
| 4 | Lint | `npm run lint` 통과 | 통과 | — |
| 5 | Typecheck | `npm run typecheck` 통과 | 통과 | — |
| 6 | Diff | `+` 줄의 `cardToken` 매치 4건은 파싱 내부 1·요청 읽기 1·테스트 헬퍼 2뿐. `console.` 추가 없음(삭제 1). `ParsedCardToken.value` 삭제로 토큰 보유 경로 축소 | 통과 | grep 결과 원문을 기록으로 남기지 않았다(「secret-scan grep 5회」 사실만 `candidates.md`에 있음) |
| 7 | Failure handling | fallback 2곳 제거. 불일치 `500` 분기 존재. 예외 경로를 **의도적으로 일으키는 테스트는 없음** | 보류 | Lab 15 E2 검증 「두 예외 경로를 의도적으로 일으키는 테스트」 미충족 → PR #5 `(a)` 4개로 충족. PI-1(기본 핸들러 스택)은 당시 인지하지 못함 |
| 8 | Commit hygiene | 커밋 2개, 파일 집합은 PR 범위와 일치 | 미확인 | `git add` 방식·스테이징 대조 기록 없음 |
| 9 | PR body | 고정 헤딩 미사용(템플릿이 없었음). Verification에 실행 명령·결과 있음. Risk·Rollback 절 없음 | 보류 | Risk·Rollback 부재. 이 draft가 그 공백을 채운다 |
| 10 | Baseline | base `e8c7010` = 승인 계획 작성 시점의 `main`, head `477e7ca` | 통과 | — |

### 남은 blocker와 사람 결정 항목

- blocker(당시 리뷰를 막는 것): 없었다. 위 보류 항목은 리뷰어가 알아야 할 조건이지 리뷰 불가 사유는 아니다.
- 사람이 정할 것(당시): 범위 밖 파일 처리, 보류값 확정의 공식화 — 둘 다 2026-10-16 중에 소유자가 닫았다.
- 사람이 정할 것(현재): PI-1 500 응답 형식(P2). 2026-10-17 preflight에서 새로 발견한 `Inconsistent refund record`·`Inconsistent cancellation record` 테스트 미단언(backlog 후보, 이번 Lab에서는 `tests/` 미수정 원칙으로 보강하지 않음).

### 리뷰 순서 (위험 순)

1. `src/admin.ts` `catch` 분기 — fallback 제거가 승인된 `500` 경계로 바뀌었는지, `throw error` 재던짐의 결과(PI-1).
2. `src/payments.ts` 실패 분기 — `402` 본문에 토큰·내부 오류가 없는지, 이력 1건·재고 불변.
3. `src/inventory.ts`·`src/orders.ts` — 계획 파일 목록 밖이지만 재고 정책을 한 곳에서 구현하는지.
4. `tests/orders.test.ts` — 단언이 정책 확정값을 고정하는지(당시에는 아니었다).
5. 정책 문서 diff(`477e7ca`) — 확정 절이 코드와 1:1인지.

### rollback·reviewer notes의 근거

Rollback Note의 의존 관계는 `src/refunds.ts` 3행 import와 `git log --oneline -- src/inventory.ts`, `git log --oneline 9cb009c..HEAD -- src tests`(6 커밋)에서 확인했다. Reviewer Notes의 삭제 줄 인용은 `git diff e8c7010 9cb009c -- src/payments.ts src/admin.ts` 출력이다. 실제 revert는 실행하지 않았다.
