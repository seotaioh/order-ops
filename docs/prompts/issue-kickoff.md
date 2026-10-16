# Issue kickoff 프롬프트

GitHub Issue 한 건을 **유일한 요청 원문**으로 삼아 탐색 → 계획 → 사람 승인 → 구현 → PR draft까지 넘기는 골격이다. 빈칸을 채워 Codex에 준다. Issue 본문 밖의 요청(대화, 메모)은 입력으로 쓰지 않는다.

## 입력

| 항목 | 값 |
| --- | --- |
| Issue URL | `______` (예: https://github.com/<owner>/order-ops/issues/<n>) |
| 읽을 기준 | `AGENTS.md` → Policy Routing이 가리키는 정책: `______` (예: `docs/payment-policy.md`, `docs/order-policy.md`) |
| 탐색 결과 기록 위치 | Issue 코멘트 + `notes/issue-exploration-l<NN>.md` |
| plan 경로 | `notes/plans/issue-<n>-<slug>.md` |
| PR draft 경로 | `notes/pr-draft-issue-<n>.md` (Lab 16 양식이 있으면 그것을 따른다) |
| 승인자 | `______` |

## 단계

### 1. 탐색 (코드 수정 없음)

- Issue의 Current Behavior를 **직접 재현**한다(`npm test` 또는 `npm start` + curl). 재현되지 않으면 그 사실을 먼저 적는다.
- 관련 정책 문장, 코드 위치(파일·함수), 기존 테스트(테스트 이름)를 찾아 **근거 경로**와 함께 적는다.
- 「확인한 사실」과 「원인 가설」을 분리한다. 가설에는 검증 방법을 붙인다.
- 결과를 Issue 코멘트로 남긴다. 구현은 하지 않는다.

### 2. 계획

- `docs/prompts/planner.md`의 역할로 plan을 쓴다. Issue의 Acceptance Criteria가 검증 계약의 시나리오가 된다.
- Issue의 Human Decision Needed와 탐색에서 새로 생긴 질문을 「사람 결정 필요」에 모은다. 선택하지 않는다.

### 3. 사람 승인 (stop)

- 「사람 결정 필요」가 모두 답을 받고 plan이 승인되기 전에는 `src/`·`tests/`를 바꾸지 않는다.
- 승인자·시각·답을 plan 파일에 기록한다.

### 4. 구현과 검증

- `docs/prompts/implementer.md`의 역할로 승인된 범위만 구현한다.
- `npm test`, `npm run typecheck`, `npm run lint`를 실행하고 결과 원문을 기록한다.

### 5. 리뷰와 PR draft

- `docs/prompts/reviewer.md`의 역할로 계획 이탈·테스트 누락·민감정보를 검토한다. 차단 항목은 사람에게 넘긴다.
- PR draft에 Issue 번호(`Closes #<n>`), 변경 요약, Acceptance Criteria별 증거(테스트 이름·명령 출력), 남은 위험을 적는다. 머지는 사람이 한다.

## Stop condition (멈추고 사람에게 묻는다)

- Issue의 Current Behavior가 **재현되지 않을 때** (Issue가 다른 코드 상태를 전제했을 가능성)
- Expected Behavior가 정책 문서와 **충돌**하거나, 정책이 그 전환을 **금지·보류**로 적어 두었을 때
- 재현 절차·완료 기준이 없어 Acceptance Criteria를 쓸 수 없을 때
- 변경이 Issue의 Scope를 벗어나야만 완료 조건을 만족할 때
- 응답·로그·문서에 카드 토큰, 고객 식별 정보, 내부 예외가 나갈 가능성을 발견했을 때
- 테스트가 실패하고 그 원인이 「기대값이 정책과 다름」일 때 — 기대값을 고치지 않고 멈춘다

## Handoff 산출물

| 단계 | 산출물 | 받는 사람 |
| --- | --- | --- |
| 탐색 | Issue 코멘트(근거 경로, 사실/가설 분리, 미확인) | 승인자 |
| 계획 | plan 파일 + 사람 결정 필요 목록 | 승인자 |
| 구현 | diff + 검증 결과 원문 | reviewer |
| 리뷰 | 발견 사항(종류별·심각도) | 승인자 |
| PR draft | `notes/pr-draft-issue-<n>.md` | 승인자(머지 결정) |
