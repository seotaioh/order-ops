# Session handoff (Lab 11 P2 — 2026-10-17 작성)

이 문서는 다음 세션의 첫 행동과 현재 상태를 전달하는 checkpoint다. 2026-10-16 두 세션(정책 구현, Lab 17~20)의 상세 기록은 `notes/handoff-2026-10-16.md`에 있으며 여기에 복제하지 않는다. 이 문서는 그 뒤 달라진 것과 지금 남은 판단만 적는다.

Lab 전제와 이 fork의 차이: Lab 11 README는 `src/`·`tests/`가 v0인 상태를 전제하지만, 이 fork는 Lab 12~16 대신 2026-10-16 PR #1~#3으로 같은 목적지(결제 실패 보존·재고 차감 시점·관리자 실패 정보·환불·취소)에 이미 도달했고 Lab 17~20도 끝났다. 따라서 아래 「완료」는 v0 기준이 아니라 현재 저장소 기준이다.

## 다음 세션의 첫 행동

`git log --oneline -1 main`과 `git status --short`로 아래 「현재 브랜치 상태」가 그대로인지 확인한 뒤, `node labs/tools/check.mjs 20`을 실행해 Lab 08~16 산출물 공백(`notes/backlog-l20.md` P2) 중 아직 FAIL인 항목만 골라 작업한다.

## 완료

- 주문 상태 정책의 다섯 상태와 허용 전환, 결제 실패 보존(402·실패 정보·재결제 거부), 재고 차감 시점(생성 시 미차감·결제 성공 시 1회), 관리자 실패·환불·취소 정보 — PR #1~#3 (`notes/handoff-2026-10-16.md` 「엔드포인트」 표)
- Lab 17~20 산출물과 역할 분리 실행(planner → 승인 → implementer → reviewer) — PR #5, #7, #8, #9 (`notes/handoff-2026-10-16.md` 「Lab별 산출물 위치」)
- Issue #6 결제 거부 응답에 사유·다음 행동 안내 — PR #11, Issue 종결 (`notes/plans/issue-6-repayment-rejection-guidance.md`)
- 정책 확정 응답의 정확값 단언 보강(backlog P1) — PR #12 (`notes/plans/p1-exact-assertions.md`)
- Lab 08~11 산출물(이 세션): `notes/issue-draft-l08.md`, `docs/templates/implementation-plan.md`, `docs/prompts/test-generation.md`·`pr-description.md`·`self-review.md`, 이 문서. 작성만 했고 커밋하지 않았다.
- Lab 11 E1 정적 검사: `node labs/tools/check.mjs --audit-docs 11`은 이 세션에서 실행하지 않았다(아래 「검증 결과」). E2·E3(새 세션 읽기 순서 검증, `codex exec` blind 검증)도 실행하지 않았다.

## 미완료

- Lab 12~16 산출물: `notes/diff-review-l12.md`, `notes/error-log-l13.md`, `docs/checklists/hallucination-guard.md`, `notes/assertion-review-l14.md`, `tests/payments.test.ts`·`tests/admin.test.ts`(기존 `tests/orders.test.ts`를 영역별로 나누는 작업), `docs/retry-stop-matrix.md`, `docs/checklists/pr-preflight.md`, `.github/pull_request_template.md`, `notes/pr-draft-l16.md` — 다른 에이전트 담당으로 병행 중. 완료 여부는 `node labs/tools/check.mjs 16`으로 확인한다.
- `AGENTS.md`에 Lab 10 세 prompt(`docs/prompts/test-generation.md`·`pr-description.md`·`self-review.md`)의 경로와 수동 사용 시점 연결(Lab 10 E4). `AGENTS.md`는 기존 파일이라 이 세션에서 수정하지 않았다. 사람이 승인하면 한 절만 추가한다.
- Lab 11 E1~E3 실행(문서 관계 audit 의미 검토, 새 세션 읽기 순서 검증, blind plan-first 검증).
- `notes/backlog-l20.md` P2·P3: PI-1 500 응답 형식, 결제 실패율 지표, 「여러 상품 부족 시 첫 상품만」 테스트, DTO 분리, 보류 전환 결정, upstream 원격 추가.

## 현재 브랜치 상태

- main: `f66fc2c` (Merge pull request #12 from seotaioh/tests/exact-assertions). 원격은 `origin`(`seotaioh/order-ops`)뿐이며 `upstream`은 아직 없다.
- 작업 브랜치: `labs/backfill-08-16` — HEAD `f66fc2c`로 main과 같다(`git log --oneline main..HEAD` 비어 있음).
- 미추적: `.claude/`(로컬 실행 설정, 커밋 금지), 이 세션이 만든 위 6개 파일, 그리고 병행 에이전트가 만드는 Lab 12~16 파일(이 문서 작성 시점에 `docs/retry-stop-matrix.md`, `tests/admin.test.ts`, `tests/payments.test.ts`, `tests/helpers.ts`가 미추적으로 보임).
- `src/`에는 커밋되지 않은 변경이 없다. `tests/orders.test.ts`는 병행 에이전트의 Lab 14 분리 작업으로 수정 중(`git diff --name-only -- src tests` 결과 `tests/orders.test.ts` 1건). 이 세션은 `src/`·`tests/`를 건드리지 않았다.
- 커밋 수: 이 세션 0개. 커밋은 사람이 파일을 확인한 뒤 명시적으로 추가한다(`git add .` 금지).

## 다음 입력

- Issue 구조: `.github/ISSUE_TEMPLATE/workflow-task.md` (실제 적용 예: `notes/issue-draft-l08.md`, `notes/issue-draft-l18.md`)
- 계획 구조: `docs/templates/implementation-plan.md` (planner 다섯 절 형식과의 대응표 포함. 기존 계획: `notes/plans/*.md`)
- 반복 작업 prompt: `docs/prompts/test-generation.md`, `docs/prompts/pr-description.md`, `docs/prompts/self-review.md`; 역할 prompt: `docs/prompts/planner.md`·`implementer.md`·`reviewer.md`·`issue-kickoff.md`
- 정책: `docs/order-policy.md`, `docs/payment-policy.md`, `docs/inventory-policy.md` (「확정」 절이 현재 구현과 대응)
- 결정 이력과 backlog: `notes/pending-decisions.md`, `notes/backlog-l20.md`
- 읽는 순서는 `AGENTS.md`(Before Editing → Policy Routing → Commands → Rules → Before Final Response)를 따른다.

## 사람이 결정해야 할 항목

- 이 세션의 6개 파일을 검토하고 커밋·PR 여부를 정한다(브랜치 `labs/backfill-08-16`).
- `AGENTS.md`에 Lab 10 prompt 세 경로와 사용 시점을 연결할지(Lab 10 E4), 연결한다면 어느 절에 둘지.
- `notes/issue-draft-l08.md`의 Human Decision Needed 8(「최대한 빨리」의 기한)은 여전히 답이 없다. 1~7은 2026-10-16에 확정됨(`notes/pending-decisions.md`).
- 보류 정책(사람 결정 전 구현 금지): `cancelled → pending` 재개, `refunded → paid` 재결제, 부분 환불, 외부 결제사 비동기 환불, 네트워크 재시도, PI-1 500 응답 형식 — `notes/pending-decisions.md`, `notes/backlog-l20.md`.
- Lab 11 E3 blind 검증을 이 fork에서 수행할지(앱 코드가 v0이 아니므로 README의 「v0 상태 유지」 체크는 성립하지 않고, 「승인 전 멈춤」만 검증 대상이 된다).

## 검증 결과

실행한 검증 (2026-10-17, 브랜치 `labs/backfill-08-16`, HEAD `f66fc2c`, 이 세션):

| 명령 | 결과 |
| --- | --- |
| `npm test` | 통과 — `tests/orders.test.ts` 37 tests, 1 file |
| `npm run typecheck` | 통과 (`tsc --noEmit` 오류 없음) |
| `npm run lint` | 통과 (`eslint src tests` 오류 없음) |
| `node labs/tools/check.mjs 11` (6개 파일 작성 전) | failure=6 — 전부 이 세션이 만들 파일의 부재 |
| `node labs/tools/check.mjs 11` (6개 파일 작성 후) | Lab 01~11 필수 산출물 전부 PASS(고정 헤딩·순서·본문 길이 포함). failure=1 — `src, tests에 커밋되지 않은 변경이 있습니다`. 원인은 병행 에이전트의 `tests/orders.test.ts` 수정이며 이 세션의 파일과 무관. 그 작업이 커밋되면 같은 명령으로 재확인한다 |

실행하지 않은 검증:

- `node labs/tools/check.mjs --audit-docs 11` (Lab 11 E1 문서 관계 audit)과 그 결과의 의미 검토
- Lab 11 E2 새 세션 읽기 순서 검증, E3 `codex exec --ephemeral` blind plan-first 검증(JSONL·최종 응답)
- `node labs/tools/check.mjs 20` 전체(Lab 12~16 파일은 병행 작업 중이라 결과가 바뀐다)
- GitHub 새 Issue 화면에서 template chooser 표시 확인(Lab 08 E4 Browser 확인)은 2026-10-16 Lab 18에서 Issue #6을 template으로 등록하며 간접 확인됐으나, 이 세션에서는 다시 보지 않았다
