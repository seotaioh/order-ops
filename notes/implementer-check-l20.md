# Implementer 기록 — Lab 20 회귀 테스트 (`paid` + 실패 이력 → 관리자 표시 `paid`)

| 항목 | 값 |
| --- | --- |
| 역할 | implementer (`docs/prompts/implementer.md`) |
| 계획 | `notes/plans/l20-display-status-regression.md` — 승인자 seotaioh, 2026-10-16 19:00 KST (`notes/incident-l20.md` 승인 기록) |
| 브랜치 / 기준 | `lab20/incident`, HEAD `e46991e` (= `main` `e46991e`) |
| 구현 일시 | 2026-10-16 |

## 변경 요약

- 변경 파일: **`tests/orders.test.ts` 1개** (+48 / −0)
- 위치: `describe('admin order list')` 블록 안, 기존 두 번째 테스트 `'uses the stored status for other orders and attaches no failure info to them'` 바로 뒤
- 추가한 테스트 이름: `keeps a paid order displayed as paid when a failure record also exists for it (Lab 20 regression)`
- 새 import·헬퍼 없음 (`stockOf`, `createOrder`, `pay`, `paymentAttempts`, `orders`, `request`, `app` 모두 기존 것)
- 준비 조건(계획 1~5 그대로): `before = stockOf('keyboard')` → keyboard×1 주문 생성 → `pay(orderId, 'CARD-1')` 200 단언 → `paymentAttempts.unshift({ orderId, ok: false, amountKrw: 49_000, at: now-60s ISO, failureReason: 'card_declined' })` → 계획이 요구한 필수 주석(재결제 거부 정책·로그 2 환경 재현·고정 의도)을 `unshift` 바로 위에 기재
- 행동: `GET /admin/orders`, `GET /orders/:id`
- 단언 목록:

| # | 단언 | 코드 |
| --- | --- | --- |
| A1 | 관리자 목록 200 | `expect(admin.status).toBe(200)` |
| A2 | 관리자 행 `status === 'paid'` | `row` find → `toBeDefined()`, `row?.status` `'paid'` |
| A3 | 관리자 행에 `failure` 키 없음 | `expect(row).not.toHaveProperty('failure')` |
| A4 | 단건 조회도 `paid` | `fetched.status` 200, `fetched.body.status` `'paid'` |
| 보조 | 저장 상태 자체가 `paid` | `expect(orders.get(orderId)?.status).toBe('paid')` (계획의 「보조 단언(선택)」) |
| A5 | 실패·성공 이력 둘 다 보존 | `own = paymentAttempts.filter(orderId)` 길이 2, `!ok` 1건, `ok` 1건 |
| A6 | 응답 어디에도 `'결제실패'` 없음 | `JSON.stringify(admin.body)`·`JSON.stringify(fetched.body)` 모두 `not.toContain('결제실패')` |
| A7 | 재고는 결제 때 차감된 값 유지 | `expect(stockOf('keyboard')).toBe(before - 1)` |

- 건드리지 않은 것: `src/**`, `docs/**`, `notes/**`(이 기록 파일 제외), 기존 36개 `it`의 본문·이름·기대값, import 줄, `beforeEach(resetStore)`, 다른 describe 블록, `labs/**`

## 계획 대비 차이

없음.

(테스트 이름·describe 위치·`unshift` 삽입 방식·주석 취지·단언 A1~A7 + 보조 단언 모두 계획 명세 그대로. 단언 옆의 `// A1:` 류 한 줄 주석은 명세 표의 번호를 코드에서 찾기 쉽게 한 것으로, 동작·기대값 차이가 아니다.)

## 실행한 명령과 결과

저장소 루트 `/Users/stosgh/Code/order-ops`에서 계획 「검증 계약」 순서대로 실행. 아래는 실제 출력 원문(요약 줄).

| 순서 | 명령 | 결과 원문 | 판정 |
| --- | --- | --- | --- |
| 1 | `npm test` | `✓ tests/orders.test.ts (37 tests) 58ms` / `Test Files  1 passed (1)` / `Tests  37 passed (37)` / exit 0 | 통과 (기존 36 + 신규 1) |
| 2 | `npm run typecheck` | `> tsc --noEmit` 출력 없음 / exit 0 | 통과 (오류 0) |
| 3 | `npm run lint` | `> eslint src tests` 출력 없음 / exit 0 | 통과 (오류 0, 경고 0) |
| 4 | `git diff --name-only` | `tests/orders.test.ts` (한 줄) | 통과 |
| 5 | `git diff --name-only -- src` | (빈 출력) | 통과 |
| 6 | `git diff --numstat -- tests/orders.test.ts` | `48	0	tests/orders.test.ts` | 통과 (삭제 줄 0) |
| 7 | `grep -c "^\s*it(" tests/orders.test.ts` | `37` | 통과 |

추가 확인:

- `git diff -- tests/orders.test.ts \| grep -c '^-[^-]'` → `0` (기존 줄 삭제·수정 없음, S5)
- `git diff main --numstat -- tests/orders.test.ts` → `48	0	tests/orders.test.ts`; `git diff origin/main --name-only -- src` → 빈 출력 (브랜치 전체에서도 `src/` 변경 없음)
- `git status --short` → ` M tests/orders.test.ts` 외에는 기존 미추적 파일(`.claude/`, `docs/agentic-workflow-starter-kit.md`, `notes/backlog-l20.md`, `notes/incident-l20.md`, `notes/plans/l20-display-status-regression.md`)뿐. 미추적 파일은 이 구현이 만든 것이 아니다(이 기록 파일 `notes/implementer-check-l20.md`만 새로 추가).

미실행: 계획 「반증 가능성」의 v0 `deriveDisplayStatus()` 재주입 실험은 `src/` 수정 금지 범위라 실행하지 않았다. reviewer가 원하면 별도 worktree에서 확인한다.

## Handoff

reviewer에게:

- 계획 경로: `notes/plans/l20-display-status-regression.md`
- 이 기록 경로: `notes/implementer-check-l20.md`
- diff 범위: `git diff main -- tests/orders.test.ts` (브랜치 `lab20/incident`, 작업 트리 미커밋 상태. `main` = `e46991e`)
- Handoff 조건 (`docs/prompts/implementer.md`): `npm test`·`npm run typecheck`·`npm run lint` 모두 통과·원문 기록 완료, 계획 대비 차이 0건
- 커밋 시 `git add tests/orders.test.ts notes/implementer-check-l20.md`처럼 파일을 명시한다 (`git add .`·`-A` 금지)
