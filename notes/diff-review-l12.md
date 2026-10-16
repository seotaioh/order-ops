# Diff review — 재고 차감을 결제 성공 시점으로 (Lab 12 E3/E4, 회고)

> **이 검토는 Lab 12 시점이 아니라 PR #1에서 수행된 변경을 대상으로 2026-10-17에 회고로 작성했다.**
> 대상 diff: `git diff e8c7010 9cb009c -- src tests` (PR #1 `feat/order-status-payment-failed`, 커밋 `1501eb7` 2026-10-16 17:12 구현 + `477e7ca` 17:31 정책 승격, 머지 `9cb009c`).
> 대조 기준 계획: 당시 승인 계획 `notes/order-status-plan.md`와, 그것을 Lab 12 형식으로 옮긴 `notes/plans/l12-inventory-after-payment.md`.
> 작성 시점 작업 트리 HEAD `f66fc2c`. 이 문서를 쓰면서 `src/**`는 건드리지 않았다(`git diff --stat -- src` 빈 출력).
> Lab 12 README가 전제하는 Codex review pane·Stage all은 이 fork에서 쓰지 않았고, `docs/prompts/self-review.md`는 PR #1 시점(2026-10-16)에 없었다(2026-10-17 Lab 08~11 백필 작업에서 별도 생성됨). 그 자리를 아래에서는 `git diff` 명령 출력과 Lab 17 역할 분리 기록(`notes/implementer-check-l17.md`, `notes/reviewer-findings-l17.md`)이 대신한다.

## 변경 파일 대조

`git diff --stat e8c7010 9cb009c -- src tests`:

```
 src/admin.ts         |  62 +++++++++++---
 src/inventory.ts     |  45 +++++++++++
 src/orders.ts        |  12 +--
 src/payments.ts      | 121 ++++++++++++++++------------
 src/store.ts         |   7 +-
 tests/orders.test.ts | 222 ++++++++++++++++++++++++++++++++++++++++++++++++---
 6 files changed, 389 insertions(+), 80 deletions(-)
```

| 파일 | 승인 계획(`order-status-plan.md` 「관련 파일 후보」) | 실제 diff | 판정 |
| --- | --- | --- | --- |
| `src/store.ts` | 기능 수정 후보 | +7/−1: `OrderStatus`에 `payment_failed`, `PaymentFailureReason` 타입, `PaymentAttempt.failureReason?` | 계획 안 |
| `src/orders.ts` | 기능 수정 후보 | +12/−6: 생성 시 차감 루프 삭제, `findInsufficientProduct` 검사 → `409` | 계획 안 |
| `src/payments.ts` | 기능 수정 후보 | +121/−80: 실패 분기 보존·402, 성공 분기 재검사·차감, `try/catch` 제거, 헬퍼 재구성 | 계획 안(파일) / 동작 일부 계획 밖 → Steps 대조 |
| `src/admin.ts` | 기능 수정 후보 | +62/−15: `deriveDisplayStatus()`·`DisplayStatus` 삭제, `failure` 조건부 첨부, `InconsistentFailureRecordError`·500, `catch → []` 삭제 | 계획 안(파일) / Lab 12 README 「수정하지 않음」과 충돌 → Scope guard |
| `tests/orders.test.ts` | 기능 수정 동반·검증 변경 후보 | +222/−16: 헬퍼 3개, 테스트 11개 추가, 기존 4개는 헬퍼 호출로만 정리(assertion 불변) | 계획 안 |
| `src/inventory.ts` | **없음** (신규 파일, 후보 표에 행 없음) | +45: `aggregateQuantities`·`findInsufficientProduct`·`deductStock` | **계획 밖 파일** → Scope guard |
| `src/server.ts` | 탐색 전용 | 변경 없음 (`git diff --stat e8c7010 9cb009c -- src/server.ts` 빈 출력) | 계획대로 미변경 |
| `package.json`, `package-lock.json` | 검사 범위 근거 | 변경 없음 (같은 명령, 빈 출력) | 의존성 추가 없음 |

`-- src tests` 범위 밖이지만 같은 PR에 들어간 파일: `docs/inventory-policy.md`(+11), `docs/order-policy.md`(+15), `docs/payment-policy.md`(+10), `notes/order-status-implementation.md`(+40), `notes/pending-decisions.md`(+20). 정책 문서 3개는 보류값 4건의 승격(`477e7ca`)이며, 계획에는 「정책 문서를 고친다」는 항목이 없었다 → Scope guard.

새 파일 누락 없음, 필요한 후보 중 미변경 없음.

## Steps 대조

`notes/plans/l12-inventory-after-payment.md`의 Step 1~6과 diff hunk, 머지 시점 테스트(`git show 9cb009c:tests/orders.test.ts`, 15개)를 대조했다. 파일 이름이 아니라 **분기·호출·저장 순서**를 본다.

| Step | 계획한 상태 변화 | diff에서 확인한 것 | 거부·실패 시 불변 확인 | 테스트 | 판정 |
| --- | --- | --- | --- | --- | --- |
| 1 저장 상태 확장 | `payment_failed`, `failureReason?` | `store.ts` `-export type OrderStatus = 'pending' \| 'paid' \| 'cancelled';` → `+… \| 'payment_failed' \| 'cancelled'`, `+failureReason?: PaymentFailureReason` | 해당 없음 | typecheck | 일치 |
| 2 생성: 미차감 + 부족 차단 | 저장 전 합산 검사, 부족 시 미저장·미차감 | `orders.ts` `-product.stock -= item.quantity` 루프 삭제, `+const insufficient = findInsufficientProduct(items); if (…) { res.status(409)…; return; }`가 `orders.set` **앞**에 위치 | 거절 분기에 `orders.set` 없음, 재고 쓰기 없음 | `stores a pending order…`, `blocks an order…`, `aggregates quantities…`, `does not change any stock…` 4개 — `orders.size === 0`, `stockOf() === before` | 일치 |
| 3 실패: 삭제 → 보존 | `payment_failed` + 실패 이력 + 402, 재고 불변 | `payments.ts` `-orders.delete(orderId)`, `-res.json({ ok: false })` → `+recordFailure(order, 'card_declined')`, `+order.status = 'payment_failed'`, `+res.status(402).json({ ok:false, orderId, status, failure: toFailureInfo(attempt) })`. 실패 분기에 재고 호출 없음 | 재고 쓰기 없음, 주문 삭제 없음 | `returns 402 with failure info…` — `402`, 단건 `200`, 재고 동일, 실패 이력 1건 | 일치 |
| 4 성공: 재검사 → 1회 차감 → paid | 확정 직전 재검사, `deductStock` 1회, 성공 이력 | `+const insufficient = findInsufficientProduct(order.items); if (…) { res.status(409)…; return; }` → `+deductStock(order.items);` → `+order.status = 'paid';` → `+recordSuccess(order);` 순서 | 재검사 거절 분기는 상태·이력·재고 모두 쓰지 않음 | `deducts stock exactly once…`, `does not deduct stock again…`, `refuses to confirm payment when stock became insufficient…` | 일치. 단, 결제 시점 부족의 `409`는 계획 시점 **미결**이었고 구현 중 확정됨 → Scope guard |
| 5 재결제 거부 불변 | `isPayable()` 유지 | `isPayable`은 `order.status === 'pending' && order.totalKrw > 0` 그대로. `payment_failed`는 여기서 걸러짐 | `400` 분기에 상태·이력·재고 쓰기 없음 | `rejects re-payment of a payment_failed order…` — `paymentAttempts.length` 불변 | 일치 |
| 6 관리자: 실패 정보 표시 | `failure` 조건부 첨부 | `admin.ts` `+if (order.status === 'payment_failed') { base.failure = findFailure(order); }`, `findFailure`는 자기 주문의 `!ok` 이력이 정확히 1건일 때만 값 반환 | — | `shows a payment_failed order with failure amount, time, and reason`, `uses the stored status for other orders…` | 일치 |
| 6 (계획 밖 동작) | — | `-function deriveDisplayStatus(order)`, `-type DisplayStatus = … \| '결제실패'`, `-catch { res.json([]); }` → `+catch (error) { if (error instanceof InconsistentFailureRecordError) { res.status(500)…; return; } throw error; }` | — | `'결제실패'` 부재 단언 1줄. 500 경로 테스트는 **머지 시점 0건**(Lab 17 reviewer (a)에서 발견, 이후 4개 추가) | **계획 밖** → Scope guard |
| 3·4 (계획 밖 동작) | — | `payments.ts` `-try { … } catch (e) { console.log(e); res.json({ ok: false }); }` 전체 제거, `-value: string`(`ParsedCardToken`) 제거, `createAttempt`/`recordAttempt`/`completePayment`/`rejectInvalidRequest` → `recordSuccess`/`recordFailure`/`toFailureInfo` 재구성 | — | 토큰 비노출은 `not.toContain('FAIL-123')` 1줄(실패 응답만) | **계획 밖** → Scope guard |

Step별 파일 수·규모: 계획은 Step당 1~2파일, 10~40줄을 예상했다. 실제로는 한 커밋(`1501eb7`)에 6파일 389/80줄이 한 번에 들어갔다. **Step 사이의 멈춤은 없었다.** Lab 12 README 기준으로는 예상 밖 규모 확대(payments 121줄, inventory 신설)에서 다음 Step 전에 멈췄어야 한다.

## Self-review 결과

Lab 12 README의 self-review 입력 네 가지(Issue·승인 plan·전체 diff·실제 검증 결과)를 한 번에 넣은 읽기 전용 검토는 PR #1 당시 수행되지 않았다. `docs/prompts/self-review.md`도 그때는 없었다. 그 역할을 사후에 한 것은 2026-10-16 저녁 Lab 17 역할 분리 실행이다 — implementer(검증 전용)가 PR #1 diff를 계획과 25항목 대조했고, reviewer가 차단 5·권고 9를 냈다. 아래는 그 결과를 Lab 12가 요구하는 네 축으로 나눈 것이다.

| 축 | 내용 | 출처 |
| --- | --- | --- |
| 요약 | PR #1은 Issue의 AC 다섯 개를 모두 충족한다. 재고 묶음(생성 미차감·부족 차단·성공 시 재검사·1회 차감), 실패 보존·402, 관리자 실패 정보가 정책 3문서의 문장과 대조해 어긋나는 동작은 발견되지 않았다(대조 목록은 reviewer 보고서 「확인한 범위」; 부재 증명 아님) | `notes/reviewer-findings-l17.md` 「정책 이탈」 |
| 범위 이탈 | (1) `src/inventory.ts` 신설과 orders/payments의 재고 묶음 — Lab 17 계획 기준 이탈, 선행 계획 `order-status-plan.md` 기준 범위 안. (2) `deriveDisplayStatus()` 삭제 — Issue Out of Scope 「관리자 표시 상태 계산 교정」과 Lab 12 README 「수정하지 않음」에 걸림. (3) payments `try/catch → 200`·admin `catch → []` 제거 — Lab 15 영역. (4) 정책 문서 3개 갱신 — 계획에 없음 | implementer 「범위 밖 9」, reviewer PD-1~6 |
| 누락 테스트 | (a) 관리자 불일치 500 경로 0건 — `catch → []`를 되살려도 통과. (b) `reason`이 `expect.any(String)` — `card_declined` 정확값 미단언. (c) 토큰 비노출이 실패 응답·실패 행만 검사, 성공 응답·단건 조회·`cardToken` 키 미검사. (d) FAIL 토큰 재시도 미검사. 409·400 본문과 ISO 8601·행 수 미단언 | reviewer 「테스트 누락」 |
| 입력 한계 | reviewer는 PR #1 diff를 **머지 뒤** 사후 검토했다. 당시 작업 트리는 HEAD와 같아 "unstaged diff"는 없었고, 승인 전 무변경 증거(`git status`)도 기록에 없다. 정책 문서는 PR #1이 갱신한 뒤의 판을 읽었으므로 「계획 시점 정책」과 「구현 뒤 정책」을 구분할 때 `git show e8c7010:docs/*.md`가 필요했다 | reviewer 「검토 범위」 |

누락 테스트 (a)~(d)는 소유자 승인 뒤 같은 날 7개 테스트로 보강됐고(`d1a76b2`, 36개), 409·400 본문·ISO·행 수는 P1(`faa1da9`, 37개)에서 정확값으로 보강됐다. 현재 HEAD 기준으로 위 「누락 테스트」 행은 모두 해소됐다.

## Scope guard 판단

Lab 12 E4의 판단 기준(완료 기준 필요성 · 정책 근거 · 제외 범위 · 검토 가능한 규모)으로 계획 밖 변경을 하나씩 판단한다. 「후보」는 README 표의 네 가지(계획 재승인 / 작업 분리 / 되돌리기 / 보류)이고, 「실제 결정」은 PR #1 당시와 Lab 17 사후 결정이다.

| # | 계획 밖 변경 | 완료 기준에 필요한가 | 정책 근거 | 제외 범위 저촉 | 규모 | 후보 | 실제 결정과 근거 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/inventory.ts` 신설 (+45) | 예 — AC 1·2·3이 같은 합산 검사를 두 경로에서 요구. 복제하면 정책 복제 금지 위반 | inventory-policy 「합산」「전체 기준」「한 번만」 | 아니오 | 작은 모듈, 함수 3개 | **계획 재승인** (Files to Change에 추가) | 구현 뒤 결과 표로 소유자 승인(2026-10-16 오전). Lab 17 결정 1 「범위 밖으로 기록 — 선행 승인 계획 근거」 |
| 2 | 결제 시점 재고 부족 `409`, 생성 시 부족 `409` 본문 | 상태 코드 자체는 AC에 없음. 미결 값 | 계획 시점 정책에 값 없음 → **정책 미결** | 아니오 | 2줄 | **보류·사람 결정 요청** | 구현 중 소유자가 확정 → `477e7ca`에서 정책 승격. 순서가 "구현 → 확정 → 정책"이었다는 점이 Lab 12 기준과 다름(계획 수정만으로 정책 확정 금지) |
| 3 | `deriveDisplayStatus()`·`DisplayStatus` 삭제, 상태를 저장값 그대로 표시 | AC 4 「실패 주문 보존」만으로는 불필요. 보존하면서 파생을 두면 `paid` 주문에 실패 이력이 있을 때 `'결제실패'`로 뒤집히는 Lab 18 기준선이 된다 | order-policy 「실패 시도가 존재한다는 이유만으로 … 덮어쓰지 않는다」 | **예** — Issue Out of Scope 「관리자 표시 상태 계산 교정」, Lab 12 README 「수정하지 않음」 | admin 62줄 | **되돌리기 또는 재승인 중 사람 결정** | 소유자가 정책 정합을 택해 승인(Lab 17 결정 4-b). 결과: Lab 17·18·20의 「`deriveDisplayStatus()` 유지」 전제가 이 fork에서 성립하지 않음 — 각 기록에 「Lab 전제와의 차이」로 명시 |
| 4 | payments `try/catch → console.log + 200` 제거, admin `catch → []` → `500 { message, orderId }` | AC에 직접 없음 | `AGENTS.md` Rules 「silent fallback을 추가하지 않는다」 — 기존 fallback 제거는 규칙 방향 | Lab 15 영역(README 「예외 fallback은 변경하지 않음」) | payments 구조 재작성 포함 | **작업 분리** (Lab 15로) | Lab 17 결정 2 「범위 밖으로 기록, 다음 계획부터 '정리'도 변경 범위에 적는다」. 500 경로 테스트 0건은 reviewer (a)로 차단 → 보강 |
| 5 | `ParsedCardToken.value` 제거, 헬퍼 재구성 | AC 4의 "토큰 미노출"을 구조로 보장 | payment-policy 노출 제외 | 아니오 | 함수 4개 교체 | 계획 재승인(변경 범위에 「정리」 명시) | 결정 2와 동일 |
| 6 | 정책 문서 3개 + `pending-decisions.md` 갱신 (`477e7ca`) | 보류값 확정의 기록으로 필요 | — | 계획 「정책 문서를 고치지 않는다」 | 문서 56줄 | 별도 커밋으로 **작업 분리** (이미 분리돼 있음) | Lab 17 결정 3 「무시(소유자 지시 있음)」 |
| 7 | 테스트 7개(재고 묶음) | #1의 검증 | — | 아니오 | — | #1과 동일 처리 | 결정 1과 동일 |

파일 수·규모: 계획 후보 5파일 → 실제 6파일(+`inventory.ts`), `payments.ts`가 +121/−80으로 사실상 재작성. Lab 12 Stop Conditions였다면 Step 3 이후 한 번 멈췄어야 한다. 차이가 "없음"인 항목: `src/server.ts`, 의존성, `labs/**`.

계획을 실제 변경에 맞춰 **사후 승인한 것은 아닌지**: #1·#4·#5는 선행 계획이나 `AGENTS.md`에 근거가 있어 사후 승인이 아니라 「문서가 둘로 나뉜 것」이 문제였다(`notes/role-split-run-l17.md` 「계획 문서 이중화」). #3은 Issue 제외 범위를 명시적으로 해제한 사람 결정이므로 기록으로 남긴다. #2는 "정책을 테스트·구현에 맞춰 확정"한 것이 아니라 소유자가 값을 골라 정책에 올린 것이지만, Lab 12 순서(결정 → 계획 → 구현)와는 반대였다.

## 검증 결과

실행·실패·미실행을 구분한다.

### PR #1 시점 (2026-10-16, `notes/order-status-implementation.md` 기록)

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `npm test` | 통과 — 1파일 15테스트 | 기존 4 + 추가 11 |
| `npm run typecheck` | 통과 | |
| `npm run lint` | 통과 | |
| `npm start` 후 curl 7 시나리오 | 수동 확인 | 409 차단 / 생성 시 재고 불변 / FAIL 402·보존·조회 200 / 재결제 400 / 정상 결제 paid·차감 / 관리자 실패 정보 |
| `git diff --cached` 확인, staged 범위 검토 | **기록 없음** | Lab 12 E4가 요구하는 staged diff 확인 증거가 남아 있지 않다 |

### 이 문서 작성 시점 (2026-10-17, HEAD `f66fc2c`, 이 세션에서 직접 실행)

| 명령 | 결과 | 종료 코드 |
| --- | --- | --- |
| `npm test` (Lab 14 분리 전) | `tests/orders.test.ts (37 tests)` — 37 passed, 1 file | 0 |
| `npm test` (Lab 14 분리 후) | `admin.test.ts 7` + `payments.test.ts 8` + `orders.test.ts 22` — 37 passed, 3 files | 0 |
| `npm run typecheck` | 출력 없음 | 0 |
| `npm run lint` | 출력 없음 | 0 |
| `git diff --stat -- src` | 빈 출력 — 이 검토는 앱 코드를 수정하지 않았다 | 0 |
| `git diff --stat e8c7010 9cb009c -- src/server.ts package.json package-lock.json` | 빈 출력 | 0 |

HEAD의 37개에는 PR #2(환불 7)·#3(취소 7)·Lab 17 후속 7·Lab 20 회귀 1이 포함돼 있어 PR #1만의 검증이 아니다. PR #1 자체의 테스트 집합(15개)은 `git show 9cb009c:tests/orders.test.ts`로 확인했고, 그 15개의 이름은 모두 현재 suite에 남아 있다.

### 남은 위험·보류

- `deriveDisplayStatus()`는 이 fork에 없다. Lab 12 README가 「관찰 위험」으로 남기라던 "실패 이력 기반 표시" 위험은 제거됐고, 대신 저장 상태 그대로 표시함을 `keeps a paid order displayed as paid when a failure record also exists for it (Lab 20 regression)`이 고정한다.
- PI-1: 처리되지 않은 예외가 Express 기본 핸들러로 가면 비프로덕션에서 스택이 본문에 실릴 수 있다. 현재 입력으로 도달 경로는 찾지 못했다(전수 증명 아님). `notes/pending-decisions.md` 보류.
- 이 diff review의 「변경 파일 대조」「Steps 대조」는 PR #1 diff 원문을 직접 읽어 작성했고, 「Self-review 결과」는 Lab 17 기록의 2차 인용이다.
