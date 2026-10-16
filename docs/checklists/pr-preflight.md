# PR preflight checklist

PR을 열거나 머지하기 전에 변경을 사람이 검토할 수 있는 상태인지 확인하는 **재사용 checklist**다. 여기에는 확인 **방법**만 둔다. 어떤 PR에 적용한 **결과**는 `notes/preflight-run-<lab 또는 날짜>.md`에 「항목 · 명령 또는 관찰 · 결과 · 판정」 표로 따로 남기고, 이 문서에는 적지 않는다. 그래야 다음 PR이 과거 결과를 사실처럼 재사용하지 않는다.

- 적용 순서: 아래 표의 위에서 아래로. 자동 항목(Tests·Lint·Typecheck·Diff의 grep)은 명령 종료 코드로, 사람 항목(Scope·Policy·Diff의 맥락·Failure handling)은 근거를 읽고 판정한다.
- 판정 어휘: **통과** / **실패** / **보류**(사람 결정 필요) / **미실행**(실행하지 않음, 사유 기록) / **기대 실패**(`it.fails()`처럼 의도된 실패). 미실행·기대 실패·보류를 통과로 바꿔 쓰지 않는다.
- 관계: `docs/automation/candidates.md` 후보 B(PR 사전 점검)의 ①~④와 같은 점검이다. 후보 B가 자동으로 돌리면 그 보고서를 Scope·Diff·Tests·Failure handling의 근거로 쓰되, 판정은 사람이 한다.
- 기준선: 비교 기준(base)은 승인 계획 또는 handoff가 적은 커밋이다. 편리한 최근 커밋을 임의 기준선으로 고르지 않는다.

## 항목

| # | 항목 | 확인 방법 또는 관찰 대상 | 판단 주체 | 실패·보류 시 행동 |
| --- | --- | --- | --- | --- |
| 1 | **Scope** — 변경 파일 집합이 승인 계획과 맞는가 | `git diff --name-only <base>..<head>`로 변경 파일 집합을 만들고, 승인 계획(`notes/plans/*.md` 또는 해당 작업의 plan)의 「변경 범위」 표에서 허용 파일 집합을 뽑아 차이를 본다. `labs/**`가 비어 있는지 `git diff --stat <base>..<head> -- labs`로 확인한다 | 집합 산출은 자동, 허용 여부 해석은 사람 | 계획 밖 파일은 「범위 밖 후보」로 따로 표시하고 정상 변경처럼 넣지 않는다. 승인 계획 파일이 없으면 허용 집합을 추정하지 않고 멈춘다(후보 B Stop Condition). `labs/`가 바뀌었으면 되돌리기 전까지 진행하지 않는다 |
| 2 | **Policy** — 정책 정본과 어긋나거나 보류를 선점하지 않았는가 | `AGENTS.md` Policy Routing으로 읽을 정책을 고르고, 변경이 건드린 사건의 「확정」 절(응답 코드·본문 문자열·상태·이력·재고)과 코드를 문장 단위로 대조한다. 「보류 사항」에 있는 동작이 코드에 들어갔는지 본다. `docs/retry-stop-matrix.md`의 해당 행도 함께 읽는다 | 사람 | 보류 정책을 코드 동작으로 채웠으면 중단하고 `notes/pending-decisions.md`에 결정 요청을 적는다. 정책끼리 같은 사건에 다른 결과를 요구하면 구현 전에 사람 확인 |
| 3 | **Tests** — 테스트가 실제로 실행·통과했고 정책 확정값을 단언하는가 | `npm test`를 실행해 종료 코드와 `Tests N passed (N)` 줄을 기록한다. 정책 「확정」 절의 응답 문자열·사유 코드마다 `grep -c "<문자열>" tests/orders.test.ts`로 단언 존재를 센다(후보 B ④). `it.fails()`·`skip`이 있으면 목록으로 적는다 | 실행·집계는 자동, 미단언 항목의 의미는 사람 | 실패·미실행은 통과로 쓰지 않는다. 기대 실패는 일반 통과와 구분해 기록하고 PR 위험으로 남긴다. 확정 문자열이 0건이면 「미단언」으로 기록하고 이번 PR에서 보강할지 backlog로 보낼지 사람이 정한다 |
| 4 | **Lint** — 정적 검사가 통과하는가 | `npm run lint` 실행, 종료 코드 기록 | 자동 | 실패하면 원인을 고치기 전까지 진행하지 않는다. 규칙을 끄거나 `eslint-disable`로 덮지 않는다 |
| 5 | **Typecheck** — 타입 계약이 유지되는가 | `npm run typecheck` 실행, 종료 코드 기록 | 자동 | 실패하면 진행하지 않는다. `any`·단언 캐스팅으로 우회하지 않는다 |
| 6 | **Diff** — 민감정보·임시 코드가 섞이지 않았는가 | `git diff <base>..<head>`의 `+` 줄에서 카드 토큰 값 유입(`cardToken`이 저장·응답으로 흐르는지), 키·토큰·접속문자열 패턴(`sk-`, `eyJ…`, `postgres(ql)://…:…@`, `-----BEGIN … PRIVATE KEY-----`)을 grep한다(후보 B ②). 디버그 출력, fault injection override, 주석 처리된 코드, `.env`·`.claude/` 같은 로컬 파일이 들어갔는지 본다 | grep은 자동, 맥락 판단은 사람 | 민감정보 패턴이 1건이라도 매치되면 즉시 중단한다. 기록에는 파일·줄 번호만 적고 매치된 값은 쓰지 않는다. 임시 코드는 제거 전까지 머지하지 않는다 |
| 7 | **Failure handling** — 실패를 성공 모양·빈 값으로 숨기지 않았는가 | `grep -rnE "catch" src/`와 `grep -rnE "console\.(log\|error\|warn)\(" src/`로 silent fallback 패턴(`catch {`, `catch (e) { console… }`, `catch → res.json([])`·`200 { ok: false }`)을 찾는다(후보 B ③). 바꾼 예외 경로마다 그 경로를 의도적으로 일으키는 테스트가 있는지, `docs/retry-stop-matrix.md` 「변경 전 확인」 10항목을 적용한다 | 사람 | fallback이 있으면 제거 또는 승인된 오류 경계로 바꾸기 전까지 머지하지 않는다. 예기치 못한 예외의 응답을 정책 없이 새로 정했으면 보류로 적고 사람 결정을 받는다 |
| 8 | **Commit hygiene** — 스테이징과 커밋이 의도한 파일만 담는가 | `git add <파일>`로 파일을 명시한다(`git add .`·`-A` 금지). `git diff --cached --name-only`로 스테이징 집합을 1번 항목의 허용 집합과 대조하고, `git diff --cached`에서 `password\|secret\|token\|api_key\|DATABASE_URL`을 grep한다 | 사람 | 의도 밖 파일(`.claude/`, 로컬 설정, 다른 작업의 산출물)이 있으면 unstage한다. 민감 패턴이 있으면 6번과 같이 즉시 중단 |
| 9 | **PR body** — 본문이 고정 헤딩을 지키고 검증을 과장하지 않는가 | `.github/pull_request_template.md`의 여섯 H2(Summary, Changed Files, Verification, Risk, Rollback Note, Reviewer Notes)가 순서대로 있는지 본다. Verification이 이번 실행 기록(`notes/preflight-run-*.md`)을 가리키고, 실행하지 않은 명령을 「미실행」으로 적었는지, Risk·Rollback이 diff·커밋 근거를 가리키는지 확인한다 | 사람 | 미실행을 통과로 적었거나 근거 없는 위험·rollback 약속이 있으면 본문을 고친 뒤 다시 본다. 확인하지 못한 것은 「미확인」으로 남긴다 |
| 10 | **Baseline** — 비교 기준이 승인된 기준선인가 | base 커밋이 승인 계획·handoff·Issue에 적힌 기준선과 같은지 `git log --oneline <base>..<head>`로 확인한다. head가 머지 커밋이면 머지 대상 브랜치의 커밋 목록도 적는다 | 사람 | 기준선이 다르면 어느 기준으로 검토할지 사람에게 먼저 묻고, 그 전에는 1~9번 결과를 확정하지 않는다 |

## 기록 형식 (`notes/preflight-run-*.md`)

| 항목 | 명령 또는 관찰 | 결과 | 판정 |
| --- | --- | --- | --- |
| (위 표의 항목 이름) | (실행한 명령 원문 또는 읽은 파일·줄) | (출력 요약, 종료 코드, 발견 수) | 통과 / 실패 / 보류 / 미실행 / 기대 실패 |

기록에는 기준 커밋(base·head)과 실행 일시를 머리에 적는다. 기준이 바뀌면(새 커밋, 정책 갱신) 결과를 재사용하지 않고 다시 실행한다.
