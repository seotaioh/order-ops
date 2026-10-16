# PR preflight 실행 기록 — 현재 main (Lab 16 E2)

`docs/checklists/pr-preflight.md`를 **현재 `main`**에 적용한 기록이다. 실행 일시 2026-10-17 06:28 KST경, HEAD `f66fc2c`(PR #12 머지 커밋). 명령 실행 시점의 작업 트리에는 미추적 `.claude/`만 있었고 `src`·`tests`·`labs` 변경은 없었다(`git status --short` → `?? .claude/`). 모든 명령은 읽기 전용이며 앱 파일은 수정하지 않았다.

주의 — 병행 작업: 같은 시각 다른 세션들이 Lab 08~14 산출물을 만들고 있어, 06:37 KST에 다시 본 `git status --short`에는 `tests/orders.test.ts` 수정(`-358/+2`, 영역별 분리)과 미추적 `tests/payments.test.ts`·`tests/admin.test.ts`·`tests/helpers.ts`, `docs/prompts/pr-description.md`·`self-review.md`·`test-generation.md`, `docs/templates/implementation-plan.md`, `notes/issue-draft-l08.md`·`session-handoff.md`가 더 있었다. 아래 표의 Tests·Lint·Typecheck 결과는 06:28 시점(분리 전, 1 파일 37개)이고, 「self-check」 절의 결과는 분리 뒤(3 파일 37개)다. 두 시점 모두 `src/`는 HEAD와 같다.

PR 후보로 삼은 범위: 이 세션의 신규 문서 5개(`docs/retry-stop-matrix.md`, `docs/checklists/pr-preflight.md`, `.github/pull_request_template.md`, `notes/pr-draft-l16.md`, 이 파일). 코드 변경이 없으므로 Tests·Lint·Typecheck는 「현재 `main`이 검증 가능한 상태인가」의 기준선 확인이다. PR #1에 사후 적용한 결과는 `notes/pr-draft-l16.md` 「Review-ready 판정」에 있다.

## 결과

| 항목 | 명령 또는 관찰 | 결과 | 판정 |
| --- | --- | --- | --- |
| 10 Baseline | `git rev-parse --short HEAD`, `git status --short`, `git log --oneline -40` | HEAD `f66fc2c`. 미추적 `?? .claude/`뿐. PR #1 머지 `9cb009c`부터 #12까지 이력이 이어짐 | 통과 |
| 1 Scope | `git status --short`로 신규 파일 집합 확인. 허용 집합 = 이번 지시의 5개 파일. `git status --short labs/`, `git diff --stat HEAD -- labs/` | 신규 5개 외 변경 없음. `labs/` 0건 | 통과 |
| 2 Policy | 5개 문서가 정책 정본(`docs/*-policy.md`)을 대체하거나 보류(네트워크 재시도, PI-1 500 형식, 부분 환불, 보류 전환)를 확정하는 문장을 담는지 읽음 | 매트릭스는 보류 행(10·11·12)을 「미확정 / 사람 승인 전 후보」로 둠. 확정값은 정책 「(2026-10-16 확정)」 절과 대조해 옮김 | 통과 (사람 판단 — 소유자 재확인 권장) |
| 3 Tests | `npm test` | `✓ tests/orders.test.ts (37 tests)`, `Tests 37 passed (37)`. `it.fails`·`skip` 0건 | 통과 |
| 3 Tests — 확정 문자열 단언 (후보 B ④) | `grep -c "<문자열>" tests/orders.test.ts` | `Order is not payable` 5 / `Inconsistent payment failure record` 1 / `card_declined` 6 / `Insufficient stock` 4 / `Order is not refundable` 4 / `Order is not cancellable` 4 / `repayment_not_allowed` 2 / `already_paid` 1 / `order_cancelled` 1 / `order_refunded` 1 / `toBe(402)` 4 / `toBe(409)` 4 / `toBe(500)` 1. **0건**: `Inconsistent refund record`, `Inconsistent cancellation record`(정책 확정 응답, `src/admin.ts`에서 템플릿 문자열로 생성되어 `src` grep도 0), `not_payable`(기본 분기 — API로 도달하는 입력을 찾지 못함, 미확인), `Invalid card token`, 결제 `404` | **보류** — 환불·취소 불일치 `500` 두 경로가 테스트로 보호되지 않음. 이번 Lab은 `tests/` 미수정이므로 backlog 후보로 기록 |
| 4 Lint | `npm run lint` | `eslint src tests` 오류 출력 없음 | 통과 |
| 5 Typecheck | `npm run typecheck` | `tsc --noEmit` 오류 출력 없음 | 통과 |
| 6 Diff — 민감정보 | `git grep -nIE "sk-[A-Za-z0-9]{16,}\|eyJ…\.…\|postgres(ql)?://…:…@\|AKIA…\|re_…\|ghp_…\|-----BEGIN … PRIVATE KEY-----" HEAD -- . ':!labs' \| wc -l` (추적 파일 HEAD 기준, `labs/` 제외) | 0건 | 통과 (검사 표면: HEAD 추적본. git 히스토리·`labs/`·미추적 `.claude/`는 보지 않음) |
| 6 Diff — 신규 문서 | 5개 문서에 키·토큰·접속문자열·실카드 값이 없는지 작성자가 읽음 | 모사 토큰 이름(`FAIL-…`, `CARD-…`)과 정책 문자열만 등장 | 통과 |
| 7 Failure handling — fallback 패턴 (후보 B ③) | `grep -rnE "catch *\{\|catch *\([A-Za-z_]+\) *\{ *$\|console\.(log\|error\|warn)\(" src/` | `src/admin.ts:108 catch (error)` 1건 — `InconsistentRecordError`만 `500 { message, orderId }`로 바꾸고 나머지는 `throw error`. `src/server.ts:20` 리슨 로그 1건. 빈 배열·기본 성공 응답 반환 없음 | 통과 |
| 7 Failure handling — 예외 경로 테스트 | `grep -nE "^\s*(describe\|it)\(" tests/orders.test.ts` | 결제 실패 402(188), 재결제 거부 400(212·618), 결제 시점 409(167), 관리자 불일치 500(661·668·676·687), 토큰 비노출(593) 존재 | 통과 (환불·취소 불일치는 위 보류 참조) |
| 7 Failure handling — 매트릭스 「변경 전 확인」 | `docs/retry-stop-matrix.md` 10항목을 이 PR 후보(문서만)에 적용 | 코드 변경이 없어 오류 보존·외부 응답·로그·fallback·전환표·불변식 항목은 현재 `main` 상태 확인으로 대체(위 행들). retry 항목: 문서에 재시도 횟수·식별 방식을 적지 않음. 정본 미대체: 확인 | 통과 |
| 8 Commit hygiene | 해당 없음 — 이 세션은 커밋하지 않는다(지시). 커밋 시 `git add` 5개 파일 명시, `.claude/` 제외 필요 | — | 미실행 (커밋 단계 아님) |
| 9 PR body | `.github/pull_request_template.md` 여섯 H2 순서, `notes/pr-draft-l16.md` 일곱 H2 순서를 눈으로 확인. 검사기 `node labs/tools/check.mjs 16` 실행 | 검사기 결과는 아래 「self-check」 | 아래 참조 |

## self-check (`node labs/tools/check.mjs 16`)

누적 검사라 Lab 01~16의 required 파일을 모두 본다. Lab 08~14 산출물은 병행 세션이 만드는 중이라(`notes/backlog-l20.md` P2) 실행 시점에 아직 없는 항목은 FAIL로 남는다. 두 번 실행했고(06:3x KST), 아래는 Lab 15~16 항목과 앱 검사 결과다. 원문은 실행 시점의 터미널 출력이다.

| 대상 | 1차 실행 | 2차 실행 (H1 본문 보강 뒤) |
| --- | --- | --- |
| `docs/retry-stop-matrix.md` (Lab 15 required) | 파일 PASS, **FAIL** `# 결제 실패 처리 매트릭스 본문이 20자보다 짧습니다`(H1 바로 아래에 본문 없이 `##`이 이어짐) | PASS (FAIL 없음) |
| `docs/checklists/pr-preflight.md`, `.github/pull_request_template.md`, `notes/pr-draft-l16.md` (Lab 16 required) | 3개 모두 PASS (고정 헤딩·순서·항목 수 FAIL 없음) | PASS |
| `notes/preflight-run-l16.md` (Lab 16 optional) | PASS | PASS |
| `npm test` / `npm run lint` / `npm run typecheck` (앱 검사) | `Test Files 3 passed (3)`, `Tests 37 passed (37)` — 병행 세션의 분리 뒤 상태. 세 명령 모두 PASS | 동일, 세 명령 PASS |
| 전체 집계 | `failure=5, warning=1` (이 세션 파일 1 + Lab 12~14 부재 4) | `failure=4, warning=1` — 남은 4건은 `notes/diff-review-l12.md`, `notes/error-log-l13.md`, `docs/checklists/hallucination-guard.md`, `notes/assertion-review-l14.md` 부재(다른 세션 담당). WARN 1건은 `notes/plans/l12-inventory-after-payment.md` 보조 산출물 부재 |

## 발견과 다음 판단

- **발견 1 (보류)**: `order-policy` 「`refunded` 주문 표시 조건」·「`cancelled` 주문 표시 조건」이 확정한 `500 { message: "Inconsistent refund record" | "Inconsistent cancellation record", orderId }`를 단언하는 테스트가 없다. 구현(`src/admin.ts` `findRefund`·`findCancellation`)은 있다. 이번 PR 후보(문서)의 판단을 막지는 않으며, `tests/` 보강은 별도 계획·승인 뒤에 한다 — backlog 후보로 `docs/retry-stop-matrix.md` 9번 행에 적어 두었다.
- **발견 2 (전제 차이)**: Lab 16 「시작 전 상태 확인」이 요구하는 `docs/prompts/pr-description.md`·`docs/prompts/self-review.md`·`notes/session-handoff.md`는 HEAD `f66fc2c` 추적본에 없었고(Lab 09~11 산출물 공백), 이 기록을 쓰는 동안 병행 세션이 미추적 파일로 만들었다. PR template·draft는 Lab 16 README의 여섯 헤딩 계약과 `.github/ISSUE_TEMPLATE/workflow-task.md` 문체를 따랐고, 작성 뒤 읽은 `docs/prompts/pr-description.md`의 금지 사항과 어긋나는 부분은 없었다(미실행 검증은 「미실행」, 범위 밖은 분리, 머지 여부 단정 없음).
- **발견 3 (전제 차이)**: Lab 14의 `it.fails()` 기대 실패가 없다. suite에 기대 실패가 없으므로 「기대 실패를 일반 통과와 구분」할 대상도 없다.
- 다음 판단: E3·E4(draft와 판정)는 작성했다. 커밋은 지시에 따라 하지 않으며, 커밋 시 `docs/`·`notes/`·`.github/`의 5개 파일만 `git add`로 명시한다.
