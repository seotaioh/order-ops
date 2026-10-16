# Automation 후보 정의서 (Lab 19)

## 선정 기준과 반복 근거

이 저장소에서 2026-10-16 하루 동안 같은 입력·같은 검증으로 두 번 이상 반복한 일을 돌아봤다. 기준은 **빈도**, **입력 안정성**(매 실행의 입력이 고정되는가), **실패 영향**, **사람 판단 필요도**다.

| 반복한 일 | 횟수(근거) | 입력 안정성 | 실패 영향 | 사람 판단 | 판정 |
| --- | --- | --- | --- | --- | --- |
| `npm test` → `npm run typecheck` → `npm run lint` → `node labs/tools/check.mjs NN` | PR #1·#2·#3·#5·#7마다 구현 직후와 머지 직후, 10회 이상 (`notes/*-implementation.md`, `notes/role-split-run-l17.md` 검증 절) | 고정 (명령·종료 코드) | 낮음 (읽기 전용) | 없음 | **후보 A** |
| 변경 범위·민감정보·금지 패턴 사전 점검 (diff 파일 집합, 토큰 문자열 grep, silent fallback 패턴, 정책 「확정」 응답 값과 테스트 단언 대조) | Lab 17 implementer·reviewer가 수동으로 수행, PR #1~#3 머지 전 제가 secret-scan grep 5회 | 고정 (grep 패턴·diff 범위) | 중간 (놓치면 머지됨) | 결과 해석만 | **후보 B** |
| Issue 기반 탐색 (재현 → 정책·코드·테스트 근거 → 사실/가설 분리 → 코멘트 초안) | Lab 18 E3 1회 + Lab 17 reviewer의 같은 절차 1회, `docs/prompts/issue-kickoff.md` 1단계로 고정됨 | 중간 (Issue 본문이 템플릿을 따를 때만) | 중간 (잘못된 코멘트가 공개됨) | 게시 전 확인 필요 | **후보 C** (초안까지만 자동) |
| 정책 문서 ↔ 결정 기록 ↔ 코드 정합 점검 (`docs/*-policy.md` 「확정」 절의 응답 값이 `tests/`에 단언돼 있는가, `notes/pending-decisions.md` 확정 항목이 docs에 승격됐는가) | PR #1 뒤 보류값 승격 1회, Lab 17 reviewer가 「확정 응답 vs 테스트」 대조 1회, Lab 18 탐색이 다시 1회 | 고정 (문자열 대조) | 중간 (문서 표류) | 결과 해석만 | **후보 D** |
| 정책 보류 항목 확정, PR 머지, Issue 사람 결정 답변, 재고·환불 정책 변경 | 매번 | — | 높음 (제품 동작 변경) | **매번 필요** | 자동 실행 **제외** (사람 승인 지점으로만 등장) |

고위험·사람 판단 작업은 후보가 아니라 각 후보의 Human Approval 필드에 「멈추고 사람에게 넘기는 지점」으로만 들어간다.

## Surface map

| 작업 | Surface | 이유 | 결과 검토 위치 |
| --- | --- | --- | --- |
| 계획 작성, 리뷰 발견 사항 판단, 결정 기록 | Desktop App | 문서를 읽고 쓰는 대화형 판단 | `notes/plans/*`, `notes/*-review*.md` |
| 후보 A·B·D의 명령 실행과 종료 코드 판정 | CLI | 파일과 명령만으로 참·거짓이 정해짐 | 명령 출력 원문을 `notes/`에 기록 |
| GitHub Issue·PR 화면 확인, 로컬 `http://localhost:3000/admin/orders` JSON 확인 | Browser | 렌더링된 웹 화면에서만 볼 수 있는 상태(Issue 라벨·코멘트 순서, 서버 응답) | Issue·PR 페이지, 브라우저 패널 |
| 전용 연동이 없는 데스크톱 GUI 조작 | Computer Use | 이 저장소에는 해당 작업이 **없다**. GitHub는 `gh` CLI, 로컬 서버는 curl·Browser로 충분하다. 쓰는 조건: CLI·Browser·MCP 어느 것도 닿지 않는 GUI가 있을 때뿐이며, 그때도 앱 접근과 민감 행동은 사람이 승인한다 | — |
| 검증된 반복 작업의 예약 실행 | Automation | 후보 A·B·D처럼 입력이 고정되고 첫 수동 실행이 검증된 것만 | 실행 보고서(`notes/automation/runs/<날짜>.md` 또는 PR 코멘트)를 사람이 Desktop App·Browser에서 검토 |

Browser와 Computer Use의 구분: Browser는 웹 페이지(GitHub, localhost)이고, Computer Use는 웹이 아닌 네이티브 창이다. 전용 CLI·MCP가 있으면 둘 다 쓰지 않는다. Scheduled 작업의 관리·생성 화면은 CLI에 없으므로 CLI에서 찾지 않는다.

## 후보 정의

### 후보 A — 검증 묶음 실행 (test · typecheck · lint · self-check)

| 필드 | 값 |
| --- | --- |
| Input | 저장소의 특정 커밋(브랜치 HEAD 또는 PR head SHA), lab 번호 `NN`(없으면 가장 최근 lab) |
| Output | 네 명령의 종료 코드와 요약 줄(`Tests N passed`, 린트·타입 오류 수, self-check `failure=/warning=`), 실패 시 실패 원문. 보고서 한 파일 또는 PR 코멘트 한 건 |
| Run Condition | PR이 열리거나 head가 갱신될 때, 그리고 main에 머지된 직후. 수동 실행도 같은 프롬프트로 가능 |
| Stop Condition | `npm install`이 필요한데 `node_modules`가 없을 때(의존성 설치는 사람 승인), 같은 커밋에서 같은 실패가 2회 반복될 때, 작업 트리가 더럽거나 `src`·`tests` 외 파일이 바뀌어 있을 때(검증 대상이 불명확) |
| Human Approval | 없음(읽기 전용). 단 **결과를 근거로 머지·수정하는 것은 항상 사람** |
| Failure Alert | 수신자: PR 작성자(=저장소 소유자). 포함: 커밋 SHA, 실패한 명령, 실패 원문 첫 30줄, 마지막 통과 커밋. 통과 시에는 조용히 보고서만 남긴다 |

첫 수동 실행: `notes/automation-trial-l19.md` 참고(2026-10-16, 통과).

### 후보 B — PR 사전 점검 (범위·민감정보·금지 패턴)

| 필드 | 값 |
| --- | --- |
| Input | base·head 커밋, 승인된 계획 파일 경로(있으면), 허용 파일 집합(계획의 변경 범위 표에서 추출) |
| Output | 표 4개: ① 변경 파일 집합 vs 허용 집합 차이, ② `+` 줄에서 카드 토큰·키·접속문자열 패턴(`cardToken` 값 유입, `sk-`, `eyJ…`, `postgresql://`) 매치, ③ silent fallback 패턴(`catch {`·`catch (e) { … res.json`·`console.log(e)`), ④ 정책 「확정」 절의 응답 문자열이 `tests/`에 존재하는지. 각 행에 파일·줄 |
| Run Condition | PR head 갱신 시, 후보 A 통과 뒤 |
| Stop Condition | 승인된 계획 파일이 없을 때(허용 집합을 추정하지 않는다), diff가 200파일을 넘을 때(대량 변경은 사람이 먼저 본다), 패턴 ②에 매치가 1건이라도 있을 때(즉시 중단·알림) |
| Human Approval | 보고서 게시 자체는 승인 불필요(읽기 전용 분석). 보고서를 근거로 코드를 고치거나 PR을 닫는 것은 사람 |
| Failure Alert | 수신자: PR 작성자. 패턴 ② 매치는 **즉시** 알림(파일·줄 번호만, 매치된 값은 알림에 넣지 않는다). 나머지는 보고서에 포함 |

첫 수동 실행: `notes/automation-trial-l19.md`(PR #7 범위로 시험, 통과).

### 후보 C — Issue 기반 탐색 초안 (게시 전 멈춤)

| 필드 | 값 |
| --- | --- |
| Input | Issue URL 하나. Issue 본문이 `.github/ISSUE_TEMPLATE/workflow-task.md`의 절(Summary·Current Behavior·Acceptance Criteria·Human Decision Needed)을 갖춰야 한다 |
| Output | `docs/prompts/issue-kickoff.md` 1단계 형식의 탐색 초안 파일 `notes/issue-exploration-<n>.md`(재현 결과, 관련 정책·코드·테스트 경로, 사실/가설 분리, 미확인). **Issue 코멘트는 올리지 않는다** |
| Run Condition | 템플릿을 따른 Issue가 새로 열리거나 `needs-exploration` 라벨이 붙을 때 |
| Stop Condition | Current Behavior가 재현되지 않을 때(초안에 그 사실만 적고 멈춤), Expected Behavior가 정책의 금지·보류 전환과 충돌할 때, 재현에 외부 서비스·실제 결제 정보가 필요할 때, 본문에 템플릿 절이 없을 때 |
| Human Approval | **초안 게시 전 필수**. 사람이 초안을 읽고 Issue 코멘트로 올릴지 정한다(Lab 18 E3에서 실제로 이 순서로 했다) |
| Failure Alert | 수신자: Issue 작성자. 포함: Issue 번호, 멈춘 Stop Condition, 초안 경로. 재현 실패는 「실패」가 아니라 「멈춤」으로 분류해 알린다 |

### 후보 D — 정책·결정·코드 정합 점검

| 필드 | 값 |
| --- | --- |
| Input | `docs/*-policy.md`, `notes/pending-decisions.md`, `tests/orders.test.ts`, `src/` (main HEAD) |
| Output | 표 3개: ① 정책 「확정」 절에 적힌 응답 문자열·상태 코드 중 테스트에 단언되지 않은 것, ② `pending-decisions.md`에서 「확정」인데 어느 정책 문서에도 없는 결정, ③ 정책 「보류 사항」에 있는데 코드에 구현 흔적(라우트·필드)이 있는 것 |
| Run Condition | 주 1회, 그리고 `docs/` 또는 `notes/pending-decisions.md`가 바뀐 PR이 머지된 직후 |
| Stop Condition | 정책 문서의 절 제목 형식이 바뀌어 파싱이 실패할 때(추정으로 메우지 않음), 표 ③에 매치가 있을 때(보류 정책이 구현된 신호 → 즉시 사람에게) |
| Human Approval | 불일치를 **고치는 것**(문서 승격 또는 코드 수정)은 항상 사람. 점검은 보고만 |
| Failure Alert | 수신자: 저장소 소유자. 포함: 불일치 항목, 근거 줄, 마지막으로 정합했던 커밋 |

## 공통 규칙

- 자동 실행은 **읽기 전용**이다. 사람 승인 없이 커밋·푸시·Issue/PR 코멘트·라벨·머지 같은 외부 변경을 만들지 않는다. 후보 C의 초안도 저장소 밖(GitHub)에 쓰지 않는다.
- 첫 실행은 반드시 일반 세션에서 같은 프롬프트로 수동 수행하고 결과를 `notes/automation-trial-l19.md`에 남긴 뒤에만 예약 후보로 올린다(후보 A·B는 완료, C·D는 미실행).
- 중단 조건과 보존 상태는 `docs/automation/stop-conditions.md`를 따른다.
