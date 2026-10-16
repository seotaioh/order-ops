# Automation 후보 첫 수동 실행 기록 (Lab 19 E3)

예약하기 전에 일반 세션에서 같은 프롬프트로 한 번 돌린 결과다. 코드는 수정하지 않았다. 기준: main `f9ecab9`, 브랜치 `lab19/automation`.

## 후보 A — 검증 묶음

| 명령 | 결과 |
| --- | --- |
| `npm test` | `Tests 36 passed (36)` |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `node labs/tools/check.mjs 18` | `failure=16, warning=3` — 실패는 모두 Lab 8~16 산출물 부재(기지 사항), Lab 18 항목과 앱 검사는 PASS |

판정: 통과. 입력(커밋·lab 번호)과 출력(종료 코드·요약 줄)이 고정되어 예약 후보로 적합하다. 단 self-check의 `failure` 수는 이 fork의 Lab 8~16 공백 때문에 0이 될 수 없으므로, 알림 기준은 「failure 수가 직전 실행보다 늘었는가」로 잡아야 한다.

## 후보 B — PR 사전 점검 (PR #7 범위 `10bc0a1..f9ecab9`)

| 점검 | 결과 |
| --- | --- |
| ① 변경 파일 집합 | `docs/prompts/issue-kickoff.md`, `notes/issue-draft-l18.md`, `notes/issue-exploration-l18.md`, `notes/issue-triage-l18.md` — Lab 18 허용 범위(문서만) 안. `src`·`tests` 변경 없음 |
| ② `+` 줄 민감정보 패턴 (`sk-…`, `eyJ…`, `postgresql://`, 토큰 값 유입) | 매치 0건 |
| ③ silent fallback 패턴 (`catch {`, `catch (e) { console…/res.json`) in `src/` | 0건 |
| ④ 정책 「확정」 응답 문자열 ↔ 테스트 단언 | `Order is not payable` 1 / `Inconsistent payment failure record` 1 / `card_declined` 5 — 단언 있음. **`Insufficient stock` 0, `Order is not refundable` 0, `Order is not cancellable` 0** — 정책에 확정값으로 적혀 있으나 테스트는 `not.toBe(200)`·`>= 400`만 단언 |

판정: 점검 자체는 통과(차단 없음). ④에서 **실제 표류 3건**을 찾았다. 이는 `notes/reviewer-findings-l17.md`의 권고(409 본문 미단언)와 같은 계열이며, `notes/pending-decisions.md` 「Lab 17 reviewer 보류 — 테스트 보강 후보」에 이미 올라가 있다. 이번 lab에서는 고치지 않는다(앱 코드·테스트 미수정 원칙). 후보 B가 사람 판단 없이도 **유용한 신호**를 내는 것을 확인했다.

## 후보 C·D

미실행. C는 Lab 18 E3에서 같은 절차를 사람이 수행한 기록(`notes/issue-exploration-l18.md`)이 있으나 자동 실행 프롬프트로는 아직 돌리지 않았다. D는 ④가 그 일부다. 둘 다 예약 전에 수동 실행이 필요하다.

## 중단 조건 점검

이번 두 실행에서 `docs/automation/stop-conditions.md`의 다섯 조건 중 어느 것도 발동하지 않았다. 외부 변경(커밋·코멘트)은 만들지 않았다.
