# Hallucination guard — 존재 주장과 검증 증거 점검표

패치·계획·보고서가 "있다"고 말하는 것(함수·옵션·필드·패키지·정책 문장·테스트 통과)을 이 저장소에서 **확인할 수 있는 명령**으로 바꾼 점검표다. `AGENTS.md`는 무엇을 먼저 읽고 언제 멈출지를 정하고, 이 문서는 변경에 들어가기 직전 **각 주장의 근거 위치를 적는** 일을 맡는다. `AGENTS.md`의 읽기 순서·정책 라우팅은 여기 복제하지 않는다.

사용법: 항목마다 「확인한 위치」에 파일 경로:줄 번호 또는 실행한 명령과 출력 요지를 적는다. **비어 있으면 그 항목은 `확인 필요`이고, `확인 필요`가 하나라도 남은 패치는 `src/`·`tests/`에 넣지 않는다.** 모델의 설명문, 그럴듯한 이름, 다른 저장소에서 본 기억은 근거가 아니다. 출처: `notes/error-log-l13.md`(2026-10-17 통제된 실패 패치 기록).

## 점검 항목

| # | 점검 | 확인 방법 (이 저장소 기준) | 확인한 위치 (비어 있으면 `확인 필요`) | 판정 |
| --- | --- | --- | --- | --- |
| 1 | **내부 helper·메서드의 존재** — 호출하려는 이름이 선언·export돼 있는가 | `grep -rn "<이름>" src/` 로 선언 줄을 찾는다. 선언 없이 호출만 있으면 존재하지 않는 것이다. 저장소 객체의 실제 타입은 `src/store.ts`의 `export const …` 줄을 본다(예: `orders`는 `Map<string, Order>` — `Map`에 없는 메서드는 없다) | | |
| 2 | **타입·signature** — 인자 개수·순서·반환 타입이 선언과 맞는가 | `npm run typecheck`(`tsc --noEmit`) 종료 코드 0. 에러가 나면 `TS2339`(속성 없음)·`TS2552`(이름 없음)·`TS1308`(await 위치) 같은 코드와 `파일(줄,열)`을 그대로 적는다 | | |
| 3 | **옵션·필드의 존재** — `{ validateInventory: true }` 같은 옵션 객체의 키가 어떤 인터페이스에 정의돼 있는가 | 인터페이스 선언(`src/store.ts`의 `interface …`, 각 라우터의 `interface …Body`)에서 키를 찾는다. `grep -rn "<키 이름>" src/`가 0건이면 없는 것이다. 호출부가 받아 주는 것처럼 보여도 선언이 없으면 `확인 필요` | | |
| 4 | **동기/비동기 계약** — `await`를 붙여야 하는가 | `grep -n "async\|await" src/*.ts`. 현재 `src/`는 전부 동기(0건)다. Express 4 핸들러를 async로 바꾸면 rejection이 응답 없이 사라지므로(`notes/error-log-l13.md` 3-2), 비동기 도입은 그 자체로 계획 항목이다 | | |
| 5 | **외부 패키지의 존재와 설치 여부** — import하려는 모듈이 의존성에 있는가 | `package.json`의 `dependencies`/`devDependencies`와 `package-lock.json`에서 이름을 찾고, `node -e "require.resolve('<모듈>')"`로 실제 해석되는지 본다. 설치가 필요하면 그것은 lockfile 변경이므로 사람 승인 전에는 하지 않는다 | | |
| 6 | **정책 근거 인용** — "정책상 그렇다"는 주장에 문장 원문이 있는가 | `docs/order-policy.md`·`docs/payment-policy.md`·`docs/inventory-policy.md`에서 **절 제목과 문장을 그대로 인용**한다. `grep -n "<핵심어>" docs/*-policy.md`가 0건이면(예: `audit`, `감사 이벤트`) 정책 근거가 없는 것이며 임의 확정 금지 — `notes/pending-decisions.md`에 미결로 올린다 | | |
| 7 | **기준 커밋과 패치 문맥의 일치** — 패치의 `-` 줄(문맥)이 지금 코드에 있는가 | `git rev-parse --short HEAD`를 적고, `grep -nF "<- 줄 원문>" <파일>`로 문맥을 찾는다. 없으면 `git log -S "<원문>" -- <파일>`로 언제 사라졌는지 확인한다. 문맥이 다른 패치는 "다른 코드에 대한 패치"이므로 그대로 적용하지 않는다 | | |
| 8 | **"검증했다"는 주장** — 어떤 테스트가, 어떤 결과로 | 테스트 **이름**과 명령을 적는다: `npx vitest run -t "<테스트 이름>"` 또는 `npm test`의 요약 줄(`Tests N passed (N)`)과 종료 코드. "통과했다"만 있고 이름·개수·종료 코드가 없으면 `확인 필요`. 부분 통과(예: 37 중 24)는 통과가 아니다 | | |
| 9 | **에러 원문 보존** — 실패를 요약으로 바꾸지 않았는가 | 명령 / 종료 코드 / 첫 관련 에러 원문 / `파일:줄:열`을 그대로 둔다. 요약문("타입 오류가 있었음")만 남은 기록은 재확인 불가이므로 `확인 필요` | | |
| 10 | **`확인 필요` 표시 규칙** — 확인 못 한 것을 확인한 것처럼 쓰지 않았는가 | 위 1~9 중 「확인한 위치」가 빈 항목을 모두 `확인 필요`로 표시하고, 하나라도 남으면 변경을 멈추고 사람에게 목록을 보여 준다. 변경 뒤 "안전하다"는 결론 대신 "검사한 표면 N개에서 발견 안 됨"으로 쓴다 | | |

## 기입 예 (2026-10-17, `labs/fixtures/l13-hallucinated-patch.md` 대상, HEAD `f66fc2c`)

| # | 확인한 위치 | 판정 |
| --- | --- | --- |
| 1 | `src/store.ts:55 export const orders = new Map<string, Order>();` / `grep -rn transitionTo src tests` → 0건 | 없음 — 환각 |
| 2 | `tsc --noEmit` 종료 2: `src/payments.ts(152,36): error TS2339: Property 'transitionTo' does not exist on type 'Map<string, Order>'.` | 불일치 |
| 3 | `grep -rn "validateInventory\|recordAuditEvent" src tests docs` → 0건 | 없음 — 환각 |
| 4 | `grep -n "async\|await" src/*.ts` → 0건 | 비동기 계약 없음 |
| 5 | 패치에 외부 import 없음. `package.json` 무변경 | 해당 없음 |
| 6 | `grep -rni audit docs AGENTS.md README.md` → 0건 | 정책 근거 없음 |
| 7 | `grep -nF "completePayment(order)" src/payments.ts` → 0건; `git log -S completePayment -- src/payments.ts` → `1501eb7`에서 삭제 | 기준 커밋 불일치 |
| 8 | 적용 뒤 `vitest run` 종료 1, `Tests no tests`(수집 0) | 검증 불가 |
| 9 | `notes/error-log-l13.md` 3절에 원문 보존 | 보존됨 |
| 10 | 1·3·6·7이 `없음`이므로 작업 트리에 넣지 않음(스크래치에서만 재현) | 멈춤 |

## 책임 경계

| 문서 | 맡는 것 |
| --- | --- |
| `AGENTS.md` | 편집 전에 무엇을 읽을지, 어떤 정책 문서로 라우팅할지, 어떤 경우 멈출지 |
| 이 체크리스트 | 특정 패치·주장 하나를 놓고 "그게 실제로 있는가 / 돌려 봤는가"를 위치와 함께 적는 절차 |
| `docs/prompts/reviewer.md` | 변경 뒤 계획 이탈·정책 이탈·테스트 누락을 사람에게 보고하는 역할 |
