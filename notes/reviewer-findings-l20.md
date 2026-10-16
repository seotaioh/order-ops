# Reviewer 발견 사항 — Lab 20 회귀 테스트 (`paid` + 실패 이력 → 관리자 표시 `paid`)

| 항목 | 값 |
| --- | --- |
| 역할 | reviewer (`docs/prompts/reviewer.md`) — 원래 작업 트리의 `src/`·`tests/`·`docs/` 수정 없음 |
| 검토 일시 | 2026-10-16 18:56~19:0x KST (기계 시각 기준) |
| 브랜치 / 기준 | `lab20/incident` HEAD `8f109a4` (docs 전용 커밋, main `e46991e` + 4 문서), 작업 트리에 `tests/orders.test.ts` 미커밋 변경 |
| 결론 | **차단 0건 / 권고 4건 / 질문 3건 → 머지 가능.** 단 E3 체크박스 5번(PR 기록)은 `notes/pr-final-l20.md` 초안의 빈칸 2개를 채워야 충족 |

## 검토 범위

| 입력 | 읽은 것 |
| --- | --- |
| 요청 원문 | Issue #6 본문·코멘트 1건(`gh issue view 6 --repo seotaioh/order-ops --comments`), `notes/incident-l20.md` 전문(승인 기록 73행 포함) |
| 승인된 계획 | `notes/plans/l20-display-status-regression.md` 전문(테스트 명세 79~133행, 검증 계약 137~183행) |
| 구현 기록 | `notes/implementer-check-l20.md` 전문 |
| diff | `git diff main -- tests/orders.test.ts` (+48/−0, 새 `it` 249~295행), `git diff main --name-only`(5파일 — 아래 「계획 이탈」 참고), `git status --short` |
| 정책 | `docs/order-policy.md` 전문(관리자 조회 기준 53~98행), `docs/payment-policy.md` 전문, `docs/inventory-policy.md` 전문, `AGENTS.md` 전문, `labs/CONVENTIONS.md` |
| 코드 | `src/admin.ts`, `src/store.ts`, `src/payments.ts` 전문; v0 `git show e8c7010:src/admin.ts`; `tests/orders.test.ts` 1~60행(헬퍼·import)·205~300행(`admin order list`) |
| Lab 기준 | `labs/lecture20/README.md` §3 E3(62~79행), `notes/pr-final-l20.md` 초안, `notes/pending-decisions.md` 140~142행(테스트 보강 후보) |
| 직접 실행 | 원래 트리: `npm test`(37 passed) · `npm run typecheck`(출력 없음) · `npm run lint`(출력 없음) · `git diff --numstat -- tests/orders.test.ts`(`48 0`) · 삭제줄 grep(`0`) · `grep -c "^\s*it("`(`37`) · `node labs/tools/check.mjs 20`(읽기 전용임을 소스로 확인한 뒤 실행). 별도 worktree: 아래 「테스트 유효성」 |

## 계획 이탈

**차단 등급: 없음.** 계획 명세와 diff를 항목별로 대조한 결과다.

| 계획 항목 | 계획(파일·행) | diff(작업 트리 `tests/orders.test.ts`) | 판정 |
| --- | --- | --- | --- |
| 테스트 이름 | plan 84행 | 249행 — 문자열 동일 | 일치 |
| 위치 | plan 71·87행: `admin order list` describe 안, 232~247행 테스트 바로 뒤 | 249행(247행 `});` 다음 블록), 296행에서 describe 닫힘 | 일치 |
| 준비 1~3 | plan 91~93행 | 250~254행: `before = stockOf('keyboard')` → keyboard×1 생성 → `pay(orderId,'CARD-1')` → `status 200` 단언 | 일치 |
| 준비 4 (직접 삽입) | plan 94~105행: `unshift`, 필드 5개, `amountKrw 49_000`, `at` = now−60s | 261~267행 — 필드·값 동일. `49_000`은 `src/store.ts:49` keyboard 단가×1과 일치 | 일치 |
| 준비 5 (필수 주석) | plan 106~107행 취지 4가지(재결제 거부 근거·정책 절·로그 2 환경·고정 의도) | 256~260행 — 네 요소 모두 포함 | 일치 |
| 행동 | plan 111~112행 | 269~270행 | 일치 |
| 단언 A1~A7 | plan 116~124행 | A1 273 / A2 275~277 / A3 279 / A4 281~282 / A5 286~289 / A6 291~292 / A7 294 | 전부 포함, 코드 형태 동일 |
| 보조 단언(선택) | plan 126행 | 284행 | 포함(범위 안) |
| 넣지 않을 것 | plan 128~133행 | 반대 조합·ISO 형식·행 수·`nextAction`·리팩터링 없음 | 준수 |
| import·헬퍼 | plan 71행 「새 import 불필요」 | 1~28행 변경 없음(diff hunk는 245행부터 하나뿐) | 준수 |
| 기존 테스트 불변 | plan S5 | 삭제 줄 0, `it` 37개 | 준수 |
| `src/` 불변 | plan S6, 명령 5 | `git diff --name-only -- src` 빈 출력(내가 재실행) | 준수 |

계획에 없지만 이탈이 아닌 것:

- 단언 옆 `// A1:` 류 한 줄 주석(272·274·278·280·283·285·290·293행). 동작·기대값 변화 없음. implementer 기록 37행에 밝혀져 있다.
- `git diff main --name-only`에 `docs/agentic-workflow-starter-kit.md`, `notes/backlog-l20.md`, `notes/incident-l20.md`, `notes/plans/l20-display-status-regression.md`가 함께 나온다. 이 4개는 커밋 `8f109a4`(2026-10-16 18:55:36 +0900, "docs: Lab 20 incident note·계획·starter kit·backlog")에 들어간 E1·E2·E4 문서이며 `src/`·`tests/`가 아니다. 계획의 명령 4(`git diff --name-only`, HEAD 기준)는 `tests/orders.test.ts` 한 줄로 나온다(내가 재확인).

**권고 1 (기록 정확성)** — `notes/implementer-check-l20.md` 7행 「HEAD `e46991e` (= `main` `e46991e`)」. 현재 HEAD는 `8f109a4`다. implementer 실행 시점에는 맞았을 수 있으나(커밋 시각 18:55:36), 지금 기록대로 읽으면 기준이 틀리다. 커밋 전 한 줄 갱신을 권고한다. `src/`·`tests/`에는 영향 없음(해당 커밋은 docs·notes만).

## 정책 이탈

**없음.** 새 테스트의 기대값 7개를 정책 문장과 대조했다.

| 단언 | 기대값 | 정책 문장(파일:행) | 판정 |
| --- | --- | --- | --- |
| A2 | 관리자 행 `status === 'paid'` | `docs/order-policy.md:74` 「`order.status === "payment_failed"`일 때만 … 실패 시도가 존재한다는 이유만으로 `pending`, `paid`, … 상태를 실패 상태로 덮어쓰지 않는다」; `:62` 「저장된 `Order.status`를 그대로 제공함 … 실패 이력 존재만으로 상태를 파생하지 않음」 | 일치 |
| A3 | `failure` 키 없음 | `docs/order-policy.md:69` 「`failure` 객체 … `payment_failed` 주문에만 붙이며, 일반 주문에 빈 값이나 추정값으로 붙이지 않는다」; `:65~67` 표시 조건 `status === "payment_failed"` | 일치 |
| A5 | 실패 1 + 성공 1 보존(테스트가 지우지 않음) | `docs/payment-policy.md:10` 「성공 또는 실패가 판정된 시도는 … 이력으로 보존한다」; `docs/order-policy.md:19` 보존; incident C2 「이력 삭제는 … 위반」 | 일치 |
| A4 | `GET /orders/:id` → `paid` | `docs/order-policy.md:44` 「상태를 바꾸지 않는 조회 … 전환으로 간주하지 않는다」 | 일치(`src/orders.ts` 원문은 이번에 직접 읽지 않았고, 현재 코드에서 A4가 통과하는 것으로 동작만 확인) |
| A6 | 응답에 `'결제실패'` 없음 | A2와 동일 근거 + v0 `deriveDisplayStatus()` 문자열(`git show e8c7010:src/admin.ts:17`) | 일치 |
| A7 | 재고 `before − 1` | `docs/inventory-policy.md:13` 「결제 성공 … 한 번만 차감」, `:14` 「실패하거나 … 거부되면 재고를 차감하거나 복원하지 않는다」 | 일치 |
| A1 | 관리자 목록 200 | `src/admin.ts:91~93` `paid`는 `findFailure()`를 타지 않음. 정책 `:77`의 불일치 판정은 **`payment_failed` 주문**의 실패 이력 개수에 한정 | 코드와 일치. 정책은 `paid` + 실패 이력의 불일치 여부를 명시하지 않으나 `:74`가 그 상태를 「덮어쓰지 않는다」로 다루므로 정상 표시 대상으로 읽힌다 → 「질문」 Q1 |

준비 조건이 정책상 API로 만들 수 없는 상태(`docs/order-policy.md:33` `payment_failed → paid` 금지, `:38` `paid → payment_failed` 금지, `docs/payment-policy.md:14·17~23`)를 저장소에 직접 만든다는 점은 계획 P7(plan 60행), 승인 기록(incident 68·73행), 테스트 주석(256~260행)에 모두 밝혀져 있다. 동작을 바꾸지 않고 표시 층만 고정하므로 정책 이탈로 보지 않는다. 새 정책을 선점하는 단언(반대 조합·ISO 형식 등)은 없다.

## 테스트 유효성(회귀 재현 실험)

**방법** — 원래 트리를 건드리지 않기 위해 별도 worktree를 썼다.

```
git -C /Users/stosgh/Code/order-ops worktree add <scratchpad>/l20-review-wt HEAD   # detached 8f109a4
git -C /Users/stosgh/Code/order-ops diff main -- tests/orders.test.ts | git -C <wt> apply   # 48 0
ln -s /Users/stosgh/Code/order-ops/node_modules <wt>/node_modules
(cd <wt> && npm test)   # baseline: 37 passed
# 변형마다: git -C <wt> checkout -- src/admin.ts → python3 -I <스크립트> <wt>/src/admin.ts → npm test
git -C /Users/stosgh/Code/order-ops worktree remove --force <wt> && git worktree prune
```

worktree의 `src/admin.ts`에만 넣은 변형과 결과:

| 변형 | 주입한 코드(worktree `src/admin.ts`) | `npm test` 결과 | 실패한 단언과 메시지 |
| --- | --- | --- | --- |
| 1. v0 `deriveDisplayStatus()` 정확 복원 | `paymentAttempts.filter(orderId 일치).some(!ok)`면 `'결제실패'`, 아니면 `order.status`; `toAdminOrder`의 `status:`를 이 함수로 교체 | **2 failed / 35 passed** | (a) 기존 `shows a payment_failed order with failure amount, time, and reason` — `tests/orders.test.ts:226:25` `expected '결제실패' to be 'payment_failed'` (b) **새 테스트** — `:277:25` (A2) `expected '결제실패' to be 'paid'` |
| 1b. `paid` 주문에만 실패 이력 → `'결제실패'` 파생 (F6 공백 정확 재현) | `order.status === 'paid' && some(!ok)`일 때만 `'결제실패'` | **1 failed / 36 passed** | **새 테스트만** — `:277:25` (A2) `expected '결제실패' to be 'paid'` |
| 2. 실패 이력 있는 `paid` 행에 `failure` 첨부 | `if (status === 'payment_failed' \|\| some(!ok)) base.failure = findFailure(order)` | **1 failed / 36 passed** | **새 테스트만** — `:279:21` (A3) `expected { …(5) } to not have property "failure"` |

정리 후 확인: `git worktree list`에 원래 트리만 남음, `git status --short`는 실험 전과 동일(` M tests/orders.test.ts` + 미추적 3개), `git diff --name-only -- src` 빈 출력.

**판정**

- 새 테스트는 세 변형 모두에서 실패한다. 특히 1b·2에서는 **새 테스트가 유일하게 실패**한다 → incident F6이 말한 공백(「`paid` + 실패 이력」을 어느 테스트도 만들지 않음)을 이 테스트가 메운다는 주장은 실험으로 뒷받침된다.
- **권고 2 (문구 정정)** — incident note 68행·계획 3·19행의 「이 테스트가 없으면 누군가 파생 로직을 다시 넣어도 36개 테스트가 통과한다」는 **v0 로직을 그대로 복원하는 경우에는 과장**이다. 변형 1에서 기존 216~230행 테스트(`payment_failed` 행의 `status`를 `'payment_failed'`로 단언)가 먼저 잡는다. 「`paid` 주문에만 파생하는 변형(1b)은 기존 36개를 전부 통과한다」가 정확한 표현이다. 승인된 결정 자체(테스트 1건 추가)는 바뀌지 않는다 — 1b·2가 그 필요성을 그대로 보여 준다.
- 한계(미실험): 변형 1·1b에서 A2가 먼저 실패해 테스트가 멈추므로 A6(`'결제실패'` 문자열 부재)은 독립적으로 검증되지 않았다. A6은 「`status`는 `paid`로 두되 다른 필드에 `'결제실패'`를 싣는」 변형에 대한 보조 방어인데, 그 변형은 돌려보지 않았다.
- 테스트가 `paymentAttempts`를 직접 조작하는 방식은 `src/store.ts:56` export 배열을 `src/admin.ts:6`이 같은 참조로 import하고 `resetStore()`가 `length = 0`으로 비워 참조를 유지하므로(`:63`) 성립한다. 저장 구조가 바뀌면 테스트도 손봐야 한다는 점은 `notes/pr-final-l20.md` 61행 Risk에 이미 적혀 있다.

## 개인정보·민감정보

**발견 없음.** 확인한 것:

- 새 테스트의 카드 토큰은 모사 접두사 `'CARD-1'`(253행) 하나뿐이며, 토큰 값을 응답에서 찾는 단언이나 출력하는 코드가 없다.
- 단언 실패 시 vitest가 `JSON.stringify(admin.body)`(291행) 내용을 메시지에 실을 수 있으나, 관리자 응답에는 토큰·내부 예외가 들어가지 않는다(`src/admin.ts:28~39` `AdminOrder` 필드, 기존 229행 단언과 `(c) never exposes card tokens …` 549행이 보호).
- 테스트 주석(256~260행)은 저장소 내부 문서 경로와 로그 필드명만 인용한다. API 키·접속 문자열·개인 식별 정보 없음. 이 리뷰 문서에도 시크릿을 적지 않았다.
- `src/admin.ts:109~113`의 500 응답은 내부 예외 메시지를 노출하지 않는다 — 이번 변경과 무관하게 현행 유지.

## Lab 20 E3 체크박스 판정

`labs/lecture20/README.md` 73~79행 기준.

| # | 항목 | 판정 | 근거 |
| --- | --- | --- | --- |
| 1 | 재시도 성공 뒤 관리자 표시 상태가 현재 주문 상태와 일치 | **충족(데이터 수준)** | 새 테스트 A2·A4 통과(원래 트리 `npm test` 37 passed); 변형 1b 실험에서 파생 재도입 시 A2가 잡음. 단 이 fork는 재시도 자체를 거부하므로(`src/payments.ts:41~43`, `docs/payment-policy.md:14`) 「재시도 성공」은 API가 아니라 `paymentAttempts` 직접 삽입으로 만든다 — README 71행 「implementer가 `deriveDisplayStatus()`와 관련 테스트만 수정」의 문자 그대로와는 다르다(함수는 PR #1에서 이미 제거됨). 이 차이는 `notes/pr-final-l20.md` 10·39행에 기재돼 있다 → Q3 |
| 2 | 실패 이력과 결제 시도 기록 보존 | **충족** | A5(286~289행): 해당 주문 이력 2건 = 실패 1 + 성공 1. 테스트는 이력을 지우거나 고치지 않는다 |
| 3 | 회귀 테스트 추가 | **충족** | `tests/orders.test.ts` +48/−0, `it` 36 → 37. 회귀 실험 1b·2에서 새 테스트만 실패 |
| 4 | 전체 test·lint·typecheck 통과 | **충족** | 내가 원래 트리에서 직접 실행: `npm test` 37 passed / `tsc --noEmit` 출력 없음 / `eslint src tests` 출력 없음. `node labs/tools/check.mjs 20`도 세 명령 PASS (failure 16건은 전부 Lab 8~16 산출물 파일 부재이며 Lab 20 파일 4개는 PASS — `notes/pr-final-l20.md` 60행 Risk와 일치) |
| 5 | PR 기록에 Risk와 Rollback | **미완(작성 예정)** | `notes/pr-final-l20.md`는 존재하고 54~67행에 Risk·Rollback 절이 있으나 **초안**이다: 32행 「회귀 재현 실험 — reviewer 결과 반영 예정」, 33행 「check.mjs 20 — 반영 예정」이 비어 있고, 3·11·21행이 참조하는 이 문서(`notes/reviewer-findings-l20.md`)는 이제 막 생겼다. 위 「테스트 유효성」 표와 self-check 결과(failure=16, warning=2, Lab 20 파일 PASS, test/lint/typecheck PASS)를 옮겨 적으면 충족된다 → 권고 4 |

## 질문

사람 결정이 필요하거나 확인을 받고 싶은 지점. 모두 차단 아님.

| # | 질문 | 배경 | 심각도 |
| --- | --- | --- | --- |
| Q1 | A1(관리자 목록 **200**)은 「`paid` 주문 + 실패 이력 1건」을 데이터 불일치가 아닌 정상 표시 대상으로 **고정**한다. 이 고정이 의도인가? | `docs/order-policy.md:77`의 불일치 판정(500)은 `payment_failed` 주문의 실패 이력 개수에만 걸려 있고, `paid` + 실패 이력은 명시 판정이 없다. 다만 `:74`가 그 상태를 「덮어쓰지 않는다」로 다루고, 승인 기록(incident 68행 「관리자 표시는 `paid`」)이 200을 전제하므로 **승인 범위 안으로 판단**했다. 반대로 「`paid`에 실패 이력이 붙으면 불일치」로 가려면 정책 `:77` 개정이 먼저다(계획 130행이 반대 조합을 보류한 것과 같은 이유) | 낮음 — 명시 확인만 |
| Q2 | 승인 시각 기록 「2026-10-16 **19:00** KST」(incident 73행, pr-final 18행)가 맞는가? | 이 리뷰를 실행한 기계 시각이 18:56~18:58 KST였고, 그 승인 기록을 담은 커밋 `8f109a4`의 시각이 18:55:36 +0900이다. 즉 기록된 승인 시각이 기록 자체보다 뒤다. 승인 대화 원문은 내가 보지 못했으므로 **승인 여부가 아니라 시각 표기**만 묻는다. 실제 시각으로 정정 권고(**권고 3**) | 낮음 — 기록 정확성 |
| Q3 | README E3 71행(「`deriveDisplayStatus()`와 관련 테스트만 수정」)과 이 fork의 실제(함수 부재, 테스트만 추가)의 차이를 `notes/pr-final-l20.md` 10·39행 기재로 닫는 것으로 충분한가? | 승인 기록(incident 67·71행)이 「rollback 아님 / `src/` diff 없음」을 명시하므로 대응 자체는 승인대로다. `labs/`는 수정 금지(`labs/CONVENTIONS.md:38`)라 README 쪽을 고칠 수는 없다 | 낮음 |

연결 권고: **권고 2**(incident 68행·계획 3·19행 「36개 테스트가 통과」 문구 정정 여부 — 승인된 문서를 고칠지는 소유자 결정), **권고 4**(pr-final 32·33행 빈칸 채우기).

## 확인한 범위

확인한 것(재현 가능한 근거가 있는 것):

- 위 「검토 범위」 표의 파일을 전문 또는 표기한 행 범위로 읽었다.
- 원래 트리에서 계획 「검증 계약」 명령 1~7을 직접 재실행해 implementer 기록 45~51행과 같은 출력을 얻었다(37 passed / tsc 0 / eslint 0 / `48 0` / 삭제줄 0 / `it` 37 / `src` diff 없음).
- 별도 worktree에서 변형 3종을 주입해 새 테스트가 실패하는 단언·행·메시지를 기록했고, worktree를 제거한 뒤 원래 트리 상태가 변하지 않았음을 `git status --short`·`git worktree list`로 확인했다.
- `node labs/tools/check.mjs 20`을 실행하기 전에 스크립트가 `git show`·`git diff`·`npm test/lint/typecheck`만 spawn하는 읽기 전용임을 소스(51~57·82·234·394~400·578행)로 확인했다.

확인하지 못한 것(「미확인」):

- 소유자 승인 대화 원문. 승인 사실은 incident 73행·계획 10행·pr-final 18행의 기록에 의존한다(Q2는 그 기록의 시각 표기 문제).
- `labs/fixtures/logs/l20-*.log` 원문. 로그 값은 incident note 14~19행 인용에 의존했다(원문 미대조).
- `src/orders.ts` 원문. A4 통과로 동작만 확인했다.
- A6 단독 유효성(「status는 `paid`, 다른 필드에 `'결제실패'`」 변형) — 미실험.
- Issue #6 사람 결정 1~4, backlog 항목, VOC 환경 — 이 계획의 범위 밖이라 판정하지 않았다.
- 미추적 `.claude/` 디렉터리 내용 — 검토 대상이 아니라 열지 않았다.

## Handoff

- **차단: 0건. 권고: 4건.** (1) implementer 기록 HEAD 표기 갱신 (2) 「36개 테스트가 통과」 문구를 「`paid`만 파생하는 변형은 통과」로 정정할지 결정 (3) 승인 시각 19:00 KST 표기 확인·정정 (4) `notes/pr-final-l20.md` 32·33행 빈칸을 이 문서의 회귀 실험 표·self-check 결과로 채움. **질문: 3건**(Q1~Q3, 모두 낮음).
- **머지 가능 여부**: `docs/prompts/reviewer.md` Handoff 조건(차단 0건) 충족 → **머지 가능.** 단 Lab 20 E3 체크박스 5번은 권고 4가 끝나야 「충족」으로 바뀐다. 권고 1~3은 머지를 막지 않는다.
- 다음 사람에게: 권고 2·3은 이미 승인된 문서(incident note)의 문구를 바꾸는 일이므로 소유자가 「수정 / 범위 밖으로 기록 / 무시」를 정한다. 커밋 시 `git add tests/orders.test.ts notes/implementer-check-l20.md notes/reviewer-findings-l20.md notes/pr-final-l20.md`처럼 파일을 명시한다(`git add .`·`-A` 금지).
