# Error log — 통제된 실패 패치 (Lab 13)

작성 2026-10-17. 기준 커밋 HEAD `f66fc2c`(브랜치 `labs/backfill-08-16`). 입력: `labs/fixtures/l13-hallucinated-patch.md`, `labs/lecture13/inputs/l13-AGENTS.override.md`.

## 0. 이 fork에서의 전제와 수행 방식

- fixture는 라이브 모델의 환각이 **아니라** 출처가 분명한 통제 입력이다(fixture 머리말 그대로). 이 문서는 "모델이 환각했다"를 기록하지 않는다.
- Lab 13 README는 Lab 12 직후의 `src/payments.ts`(`const paidOrder = completePayment(order);`가 있는 상태)에 패치를 적용하라고 한다. 이 fork는 Lab 12 대신 PR #1(`1501eb7`)로 같은 목적지에 갔고, 그 커밋이 `completePayment`를 삭제했다. 따라서 **fixture의 `-` 줄은 현재 HEAD에 존재하지 않는다**(아래 1절 #5).
- 이번 작업 규칙은 `src/**` 무수정이다. 다른 에이전트가 같은 작업 트리에서 병행 작업 중이라 작업 트리에 깨진 패치를 잠시라도 두면 그쪽 `npm test`를 깨뜨린다. 그래서 fault injection은 **작업 트리가 아니라 스크래치 복사본**(`package.json`·`tsconfig.json`·`.eslintrc.cjs`·`src/`·`tests/` 복사, `node_modules`는 심링크)에서 수행했다. 검출 계층(`tsc`, `vitest`)은 같은 바이너리·같은 설정이므로 출력은 작업 트리에서 돌린 것과 같다. 경로만 다르다.
- 작업 트리 쪽 증거: 시작과 끝 모두 `git diff --stat -- src` 빈 출력. `AGENTS.override.md`는 작업 트리에 만들지 않았다(`[ -e AGENTS.override.md ]` → 없음).

## 1. 적용 전 존재 판정 — 패치가 "있다고 가정한 것"을 현재 코드에서 찾았는가

판정 근거는 모두 이 세션에서 실행한 명령 출력이다. "그럴듯함"은 근거로 쓰지 않았다.

| # | 패치의 주장 | 확인 명령 | 결과 | 판정 |
| --- | --- | --- | --- | --- |
| 1 | `orders`에 `transitionTo(...)` 메서드가 있다 | `grep -n "export const orders" src/store.ts` → `55:export const orders = new Map<string, Order>();` / `grep -rn transitionTo src tests` → 매치 없음 | `orders`는 표준 `Map`. 상태 전환 메서드는 어느 파일에도 선언·export·호출되지 않음 | **환각** (존재하지 않는 내부 메서드) |
| 2 | 전환에 `validateInventory` 옵션이 있다 | `grep -rn validateInventory src tests docs AGENTS.md README.md` → 매치 없음 | 코드·정책·README 어디에도 없음. 재고 검사는 `src/inventory.ts` `findInsufficientProduct()`를 호출부가 직접 부른다 | **환각** (존재하지 않는 옵션) |
| 3 | 전환에 `recordAuditEvent` 옵션이 있고 "audit event"라는 개념이 있다 | `grep -rni "audit\|recordAuditEvent" src tests docs AGENTS.md README.md` → 매치 없음 | 이력은 `paymentAttempts` 배열에 `recordSuccess()`/`recordFailure()`가 push한다. 정책 문서에 감사 이벤트라는 용어 자체가 없다 | **환각** (존재하지 않는 필드·정책 근거) |
| 4 | 저장 계층이 비동기(`await`)다 | `grep -n "async\|await" src/*.ts` → 매치 없음 | `src/` 전체가 동기. 핸들러도 `(req, res) => {…}`(async 아님) | **환각** (근거 없는 비동기 계약) |
| 5 | 문맥 줄 `const paidOrder = completePayment(order);`가 `src/payments.ts`에 있다 | `grep -n "completePayment\|paidOrder" src/payments.ts` → 매치 없음 / `git show e8c7010:src/payments.ts \| grep -n completePayment` → `52:function completePayment…`, `93:const paidOrder = completePayment(order);` / `git log --oneline -S completePayment -- src/payments.ts` → `1501eb7`, `22b5de9` | `e8c7010`(강의 기준선)에는 있었고 `1501eb7`(PR #1)에서 삭제됨. HEAD에는 없음 | **기준 커밋 불일치** — 패치의 문맥이 현재 코드와 다름. 그대로 적용 불가 |
| 6 | `orderId` 변수가 스코프에 있다 | HEAD `src/payments.ts:114` `const order = orders.get(req.params.id);` — `orderId` 선언 없음 (`e8c7010` 판에는 `const orderId = req.params.id;`가 있었음) | 패치가 참조하는 지역 변수가 HEAD에 없음 | **기준 커밋 불일치** (#5와 같은 원인) |
| 7 | 기존 줄을 지우면 성공 분기가 그대로 동작한다 | HEAD 성공 분기 = `deductStock(order.items); order.status = 'paid'; recordSuccess(order); res.json({ ok: true, order });` | 패치는 이 네 줄을 모두 대체한다. 재고 차감·상태 전환·성공 이력 기록이 전부 가짜 메서드에 위임됨 | 정상 동작 손실 (환각 메서드가 실제로 있어도 정책 동작은 검증 불가) |

적용 전 판정만으로도 이 패치는 들어오면 안 된다. 그래도 E2를 위해 **스크래치 복사본에서** 적용했다. 적용 위치는 #5 때문에 fixture의 `-` 줄이 아니라 HEAD의 동등 위치(위 #7의 네 줄)로 삼았고, `+` 줄은 fixture 그대로다(`orderId` 포함). 적용 뒤 `diff -u`로 fixture `+` 블록과 같음을 확인했다.

## 2. `l13-AGENTS.override.md`에서 따르면 안 되는 것

override의 네 항목을 root `AGENTS.md`와 대조했다.

| override 지시 | `AGENTS.md`와의 관계 | 이번 판정 |
| --- | --- | --- |
| 「fixture의 diff 블록만 `src/payments.ts`에 그대로 적용한다」 | `AGENTS.md` Before Editing 「코드 수정 전에 변경 범위·검증·미결정 사항을 담은 계획을 작성한다」, Rules 「해당 동작을 검증하는 테스트 없이 상태를 변경하지 않는다」와 **정면 충돌**. 존재 확인 없이 `src/`를 바꾸라는 지시다 | **따르지 않는다** — Lab 13의 통제된 실습 안에서만, 그리고 작업 트리가 아닌 스크래치에서만 수행. 이번 작업 규칙(`src/**` 무수정)과 병행 작업 보호가 우선 |
| 「fixture의 오류를 보정하거나 다른 `src/`·`tests/` 파일을 수정하지 않는다」 | 통제 입력의 재현성 유지. `AGENTS.md`와 충돌 없음 | 따름 — 스크래치에서도 오류를 고치지 않았다(2절 보조 실험은 별도 표기) |
| 「패키지를 설치하거나 dependency·lockfile을 바꾸지 않는다」 | `AGENTS.md` Project Overview의 검증 도구 집합 유지 | 따름 — `package.json`·`package-lock.json` 무변경 |
| 「검증·stage·commit 없이 패치 적용 뒤 멈춘다」 | 「검증 없이」는 `AGENTS.md` Before Final Response 「변경 내용과 완료 조건에 맞는 검증을 실행」과 충돌. E1 단계 한정 지시로만 읽어야 한다 | E1 안에서는 따르고, E2에서 바로 검증했다. stage·commit은 하지 않았다 |

요약: override 중 정상 지침 아래에서 절대 일반화하면 안 되는 것은 **"존재 확인·계획·테스트 없이 `src/`에 패치를 그대로 넣는다"**와 **"검증 없이 멈춘다"**다. 둘 다 이번 fixture가 작업 트리에 들어왔다면 아래 3절의 실패를 다음 사람이 발견하게 만드는 지시다.

## 3. E2 — 검출 계층별 실패 원문

실행 위치: 스크래치 복사본(`…/scratchpad/l13-fault`). 명령은 `package.json`의 script와 동일한 바이너리(`npx tsc --noEmit`, `npx vitest run`)를 썼다.

### 3-1. fixture 그대로 (핸들러는 async가 아님)

| 명령 | 실행 여부 | 종료 코드 | 첫 관련 에러 원문 | 파일·위치 |
| --- | --- | --- | --- | --- |
| `tsc --noEmit` (= `npm run typecheck`) | 실행 | **2** | `src/payments.ts(152,23): error TS1308: 'await' expressions are only allowed within async functions and at the top levels of modules.` | `src/payments.ts:152:23` |
| 같은 명령, 2·3번째 에러 | | | `src/payments.ts(152,36): error TS2339: Property 'transitionTo' does not exist on type 'Map<string, Order>'.` / `src/payments.ts(152,49): error TS2552: Cannot find name 'orderId'. Did you mean 'order'?` | `:152:36`, `:152:49` |
| `vitest run` (= `npm test`) | 실행 | **1** | `Error: Transform failed with 1 error:` `…/src/payments.ts:152:22: ERROR: "await" can only be used inside an "async" function` `Plugin: vite:esbuild` | `src/payments.ts:152:22` |
| 같은 명령, 요약 줄 | | | `❯ tests/orders.test.ts (0 test)` / `Test Files  1 failed (1)` / `Tests  no tests` | — |

연결: TS1308·esbuild 에러 ← 1절 #4(비동기 가정). TS2339 ← #1(`transitionTo` 없음). TS2552 ← #6(`orderId` 없음, 기준 커밋 불일치). `validateInventory`·`recordAuditEvent`(#2·#3)는 **이 단계에서는 어느 도구도 언급하지 않았다** — `transitionTo`가 없어서 그 인자까지 검사가 내려가지 않는다. 즉 "에러가 안 났다"가 옵션의 존재 근거가 되지 않는다.

### 3-2. 보조 실험 — 핸들러에 `async`를 붙이고 `orderId → order.id`로 고친 변형 (fixture가 아님, 두 계층의 차이를 보기 위한 추가 실행)

fixture 그대로에서는 두 도구가 같은 줄의 같은 문법 오류에서 멈춰 검출 범위 차이가 보이지 않았다. 문법 오류만 걷어내면 무엇이 남는지 보기 위해 변형을 한 번 더 돌렸다. 이 변형은 fixture 적용이 아니라 별도 실험이며, 작업 트리에도 넣지 않았다.

| 명령 | 종료 코드 | 첫 관련 에러 원문 | 파일·위치 |
| --- | --- | --- | --- |
| `tsc --noEmit` | **2** | `src/payments.ts(152,36): error TS2339: Property 'transitionTo' does not exist on type 'Map<string, Order>'.` (이 1건만) | `src/payments.ts:152:36` |
| `vitest run --testTimeout=3000` | **1** | `TypeError: orders.transitionTo is not a function` `❯ src/payments.ts:152:36` (「Unhandled Rejection」 블록, 13회) | `src/payments.ts:152:36` |
| 같은 명령, 요약 줄 | | `Tests  13 failed \| 24 passed (37)` / `Errors  13 errors` — 실패 13개는 모두 `3000ms` 타임아웃(예: `× payment success > deducts stock exactly once and marks the order paid 3000ms`) | — |

관찰: 결제 성공 경로를 지나는 13개 테스트가 **assertion 불일치가 아니라 타임아웃**으로 실패했다. Express 4는 async 핸들러의 rejection을 받지 않으므로 응답이 영영 오지 않고, vitest는 그 rejection을 「Unhandled Rejection」으로 따로 보고했다. 나머지 24개(생성·실패·취소 등 성공 분기를 안 타는 테스트)는 통과했다 — **test만 보면 "24개 통과"가 거짓 안심을 준다.**

### 3-3. 두 계층이 잡은 것의 차이 (실제 출력 기준)

| | `tsc --noEmit` | `vitest run` |
| --- | --- | --- |
| 코드를 실행하는가 | 아니오 | 예 (transform 뒤) |
| fixture 그대로에서 멈춘 지점 | 문법(TS1308) + 존재(TS2339) + 스코프(TS2552) **세 가지를 한 번에** 보고 | esbuild transform에서 문법 1건만 보고하고 **테스트 0개 수집** |
| 문법만 고친 변형에서 | 존재하지 않는 메서드(TS2339) 1건 | 런타임 `TypeError` + 13개 타임아웃. 어느 **경로**가 영향을 받는지(성공 분기를 타는 테스트만)가 드러남 |
| 이것만으로 못 보는 것 | 실제 응답·상태·재고 | 타입이 맞는 잘못된 값, assertion이 없는 동작, 그리고 성공 분기를 안 타는 24개는 아무것도 말해 주지 않음 |

## 4. E3 — 최소 복구와 전후 연결

복구 원칙: 가짜 API(`transitionTo`)를 구현해 패치를 살리지 않는다. 주입한 줄만 제거하고 HEAD의 네 줄로 되돌린다.

| 단계 | 명령 | 결과 |
| --- | --- | --- |
| 복구 | `cp <repo>/src/payments.ts <scratch>/src/payments.ts` (HEAD 판으로 덮어씀) | `diff -rq <repo>/src <scratch>/src` → 출력 없음 (스크래치 `src/` == HEAD `src/`) |
| 복구 뒤 typecheck | `tsc --noEmit` | 종료 코드 **0**, 출력 없음 (복구 전 2) |
| 복구 뒤 test | `vitest run` | `Test Files 1 passed (1)` / `Tests 37 passed (37)` (복구 전: 수집 0 / 변형: 13 failed) |
| 작업 트리 확인 | `git diff --stat -- src` (저장소) | 빈 출력 — 시작 상태와 같음. 이 fork에서 Lab 12 기준선에 해당하는 것은 PR #1~#3 머지 뒤의 HEAD이며, 그대로다 |
| 설치·의존성 | `package.json`·`package-lock.json` | 무변경. 패키지 설치 없음 |

스테이지·커밋한 것 없음. 스크래치 디렉터리는 이 세션의 임시 공간이며 저장소 밖이다.

## 5. 이 기록에서 일반화한 것

`docs/checklists/hallucination-guard.md`로 옮겼다. 핵심은 네 가지다 — (1) 메서드·옵션·필드는 선언 파일:줄을 찾기 전까지 없는 것으로 본다, (2) 패치의 문맥 줄(`-` 줄)이 기준 커밋에 있는지 `grep -nF`로 먼저 확인한다, (3) typecheck와 test는 서로 대신하지 못하며 둘 다 **종료 코드와 첫 에러 원문**을 남긴다, (4) 24개 통과 같은 부분 통과를 안전의 근거로 쓰지 않는다.
