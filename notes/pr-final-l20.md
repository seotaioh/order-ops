# PR 기록 — Lab 20 incident 대응 (표시 상태 회귀 테스트)

브랜치 `lab20/incident` → `main`. 입력: `notes/incident-l20.md`(E1·E2, 소유자 승인), `notes/plans/l20-display-status-regression.md`(planner), `notes/implementer-check-l20.md`(implementer), `notes/reviewer-findings-l20.md`(reviewer).

## 변경 요약

| 파일 | 변경 | 근거 |
| --- | --- | --- |
| `tests/orders.test.ts` | `admin order list`에 회귀 테스트 1건 추가: `paid` 주문에 실패 이력이 함께 있어도 관리자 표시는 `paid`, `failure` 키 없음, 단건 조회도 `paid`, 실패·성공 이력 둘 다 보존, 응답에 `'결제실패'` 없음, 재고는 결제 때 차감된 값 유지 (+48/−0) | incident C1(표시 층 파생 오류)의 재발 방지. 이 시나리오는 재결제 금지 정책 때문에 API로 만들 수 없어 저장소를 직접 조작한다(테스트 주석에 명시) |
| `src/**` | 변경 없음 | 결함(`deriveDisplayStatus()`)은 PR #1에서 이미 제거됨. incident note F4·F5 |
| `notes/incident-l20.md`, `notes/plans/l20-display-status-regression.md`, `notes/implementer-check-l20.md`, `notes/reviewer-findings-l20.md` | 신규 | incident → plan → 구현 → 리뷰 기록 |
| `docs/agentic-workflow-starter-kit.md`, `notes/backlog-l20.md` | 신규 | E4 |

## 역할 분리 실행

| 역할 | 수행 | 산출물 | 코드 수정 |
| --- | --- | --- | --- |
| 사람(소유자) | E2 대응 결정 승인(2026-10-16 18:50 KST경), 계획 검토(사람 결정 0건이라 추가 승인 불필요), reviewer 권고 처리, 머지 결정 | `notes/incident-l20.md` 승인 기록 | — |
| planner (에이전트) | 요청·정책·현재 코드에서 계획 작성. 테스트 명세·단언 7개·검증 계약 | `notes/plans/l20-display-status-regression.md` | 없음 |
| implementer (에이전트) | 계획대로 테스트 1건 추가, 명령 7개 실행 | `notes/implementer-check-l20.md`, `tests/orders.test.ts` | `tests/`만 |
| reviewer (에이전트) | Issue·정책·계획·diff·테스트 대조, 별도 worktree에서 회귀 재현 실험 | `notes/reviewer-findings-l20.md` | 없음(원래 트리) |
| 조정(Claude Code 세션) | 에이전트 호출 순서·handoff, 승인 요청, E1·E4 문서 작성 | 이 기록 | 없음 |

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `npm test` | 37 통과 (기존 36 + 신규 1) — implementer와 조정 세션이 각각 실행 |
| `npm run typecheck` | 통과 |
| `npm run lint` | 통과 |
| `git diff main --name-only -- src` | 비어 있음 (`src/` 변경 없음) |
| 회귀 재현 실험 (reviewer, 별도 worktree) | 변형 1 v0 `deriveDisplayStatus()` 복원 → 2 실패(기존 `payment_failed` 행 테스트 + 새 테스트 A2) / 변형 1b `paid`에만 파생 → **새 테스트만 실패**(A2 `expected '결제실패' to be 'paid'`) / 변형 2 `paid` 행에 `failure` 첨부 → **새 테스트만 실패**(A3). 실험 후 worktree 제거, 원래 트리 `src` 변경 없음 |
| `node labs/tools/check.mjs 20` | Lab 20 필수 파일 4개 PASS, test·lint·typecheck PASS. failure 16건은 모두 Lab 8~16 산출물 부재(backlog P2) |

## Lab 20 E3 검증 항목 대조

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 재시도 성공 뒤 관리자 표시 상태가 현재 주문 상태와 일치 | 충족 — 단, 이 fork는 재시도 자체를 거부하므로 「실패 이력 + `paid`」 상태를 저장소에 직접 만들어 확인 | 새 테스트 A2·A4, incident F4 프로브 |
| 실패 이력과 결제 시도 기록 보존 | 충족 | 새 테스트 A5 (실패 1 + 성공 1 = 2건 보존) |
| 회귀 테스트 추가 | 충족 | `tests/orders.test.ts` +48 |
| 전체 test·lint·typecheck 통과 | 충족 | 위 표 |
| PR 기록에 Risk와 Rollback | 충족 | 아래 두 절 |

## v0의 네 결함 해소 대조 (E4 검증 항목)

| v0 결함 | 해소 | 근거 |
| --- | --- | --- |
| 결제 실패 시 주문 삭제 | `payment_failed`로 보존, 402 + 실패 이력 | PR #1, 테스트 `payment failure` 2건 + `(a)(b)(d)` |
| 주문 생성 시 재고 즉시 차감, 부족 검사 없음 | 생성 시 미차감·합산 검사·부족 409, 결제 성공 시 1회 차감 | PR #1, 테스트 `inventory policy` 4건 + `payment success` 3건 |
| 관리자 표시 상태를 실패 이력 존재로 파생(`'결제실패'`) | 저장 상태 그대로 표시, `payment_failed`에만 `failure` 첨부 | PR #1, 테스트 `admin order list` 3건(이번 회귀 테스트 포함) |
| 오류를 삼키는 fallback(결제 `catch → 200 {ok:false}`, 관리자 `catch → []`) | 제거. 불일치는 500으로 드러냄 | PR #1, 테스트 `(a)` 4건 |

## Reviewer 결과와 처리

차단 0건, 권고 4건, 질문 3건(모두 낮음). 상세: `notes/reviewer-findings-l20.md`.

| 항목 | 처리 |
| --- | --- |
| 권고 1 implementer 기록의 HEAD 표기(`e46991e`)가 커밋 1 이후와 다름 | 기록 시점의 사실이므로 그대로 둠. 이 PR 기록에 커밋 순서를 적어 둠 |
| 권고 2 「36개 테스트가 통과」 문구가 v0 로직 복원 경우에는 과장 | incident note·계획 문구를 「`paid`에만 파생하는 변형은 통과」로 정정 |
| 권고 3 승인 시각 19:00 표기가 커밋 시각(18:55)보다 뒤 | 18:50경으로 정정 |
| 권고 4 이 기록의 빈칸 | 회귀 실험·self-check 결과로 채움 |
| Q1 `paid` + 실패 이력을 정상 표시(200)로 고정하는 것이 의도인가 | 의도. 정책 「실패 시도 존재만으로 덮어쓰지 않는다」에 따름. 반대 판정이 필요하면 정책 개정이 먼저 |
| Q2 승인 시각 | 권고 3과 동일 |
| Q3 README E3 문구(`deriveDisplayStatus()` 수정)와 이 fork의 차이 | 이 기록과 incident note에 기재로 닫음. `labs/`는 수정 금지 |

## Risk

| 위험 | 영향 | 완화 |
| --- | --- | --- |
| 이 fork와 로그 환경의 정책 차이(재결제 금지 vs 허용). 로그가 가리키는 결함은 이 fork에 없고, 회귀 테스트는 데이터 수준에서만 재현한다 | 재결제를 허용하는 쪽으로 정책이 바뀌면(Issue #6 결정 1-B) 관리자 불변식(「실패 이력 정확히 1건」)과 이 테스트의 전제가 함께 바뀌어야 한다 | Issue #6 결정은 별도 트랙. 결정 시 `docs/order-policy.md` 전환표·관리자 조회 기준·`src/admin.ts` `findFailure`·테스트 `(a)`를 같은 PR에서 다룬다(backlog P1) |
| 결제 실패율 급등(로그 1)을 감지할 지표가 없다 | 같은 장애가 와도 알림이 없고 VOC로만 안다 | backlog P2(실패율 지표·임계 알림) |
| 셀프체크 failure 16건(Lab 8~16 산출물 부재) | 형식 미비. 동작 결함 아님 | backlog P2 |
| 테스트가 저장소 내부(`paymentAttempts`)를 직접 조작한다 | 저장 구조가 바뀌면 테스트도 손봐야 한다 | 주석에 이유를 적어 두었고, 저장 구조 변경은 정책 변경과 함께만 일어난다 |

## Rollback

- 이 PR은 테스트와 문서만 추가한다. 되돌리려면 머지 커밋을 `git revert -m 1 <merge-sha>` 하면 되고, 앱 동작은 변하지 않는다.
- 새 테스트가 미래 변경에서 실패하면 그것은 회귀 신호다. 테스트를 지우거나 기대값을 낮추지 말고, `src/admin.ts`가 저장 상태 대신 이력으로 상태를 파생하기 시작했는지 먼저 본다.
- 실패 이력을 삭제해 표시 문제를 「해결」하는 변경은 정책 위반이므로 rollback 수단으로 쓰지 않는다.

## 사람 판단과 에이전트 작업의 구분

- **사람이 판단한 것**: incident 대응 방향(rollback 아님·테스트만·backlog), 계획 승인(결정 0건 확인), reviewer 발견 사항 처리, 머지.
- **에이전트가 한 것**: 재현 프로브, incident note 초안, 계획 작성, 테스트 작성과 검증 실행, 리뷰와 회귀 실험, starter kit·backlog 초안, 이 기록.

## 커밋

이 lab의 커밋은 2개다. (1) incident note·계획·starter kit·backlog, (2) 회귀 테스트·implementer/reviewer 기록·이 PR 기록.
