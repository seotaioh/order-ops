# 계획 — `paid` 주문에 실패 이력이 있어도 관리자 표시는 `paid` (Lab 20 회귀 테스트)

> **North Star**: 누군가 관리자 목록에 「실패 이력이 있으면 `결제실패`」 파생 로직을 다시 넣으면, `npm test`가 빨간불로 막는다.

| 항목 | 값 |
| --- | --- |
| 역할 | planner (`docs/prompts/planner.md`) — 코드 수정 없음 |
| 기준 코드 | 브랜치 `lab20/incident`, main `e46991e` (2026-10-16). 이 계획 작성 시점까지 `src/`·`tests/` diff 없음 (`git status --short`: 미추적 `notes/incident-l20.md`, `.claude/`뿐) |
| 요청 출처 | `notes/incident-l20.md` 「선택한 후보와 대응 결정」·「승인 기록」 |
| 승인 범위 | **`tests/orders.test.ts`에 회귀 테스트 1건 추가**만. `src/` 변경 없음. 소유자(seotaioh) 2026-10-16 19:00 KST 승인 |
| 배경 참고 | Issue #6 (`gh issue view 6 --repo seotaioh/order-ops`). Issue의 사람 결정 1~4는 이 계획에서 다루지 않는다 |

---

## 요청 요약

승인된 대응 (출처: `notes/incident-l20.md` 「선택한 후보와 대응 결정」, 원문 보존):

> **수정(최소)** — 코드가 아니라 **테스트**: F6의 공백을 메우는 회귀 테스트 1건을 추가한다. 「`paid` 주문에 실패 이력이 있어도 관리자 표시는 `paid`이고 `failure` 필드가 없으며, 실패 이력과 성공 이력은 둘 다 보존된다」를 저장소 직접 조작으로 고정한다. 이 테스트가 없으면 누군가 파생 로직을 다시 넣어도 36개 테스트가 통과한다.

같은 문서가 함께 결정한 것 (이 계획의 범위 **밖**이지만 경계를 분명히 하기 위해 적는다):

- **rollback 아님** — 이 fork는 C1(표시 층 파생 오류)이 이미 제거된 상태(F4·F5). 되돌릴 변경이 없다.
- **`src/` diff 없음** — 앱 코드는 바꾸지 않는다.
- **backlog** — 실패율 지표·임계 알림, VOC 환경 확인(Issue #6 결정 4)은 `notes/backlog-l20.md`. 이 계획이 만들지 않는다.
- **Issue #6 사람 결정 1~3** (재결제 정책 유지 여부, 거부 응답 형식·안내)은 별도 결정으로 유지. 이 계획에서 선점하지 않는다.

완료 조건 (요청자의 말로):

- [ ] `tests/orders.test.ts`에 「`paid` 주문 + 실패 이력 1건」 시나리오를 직접 단언하는 테스트 1건이 추가된다.
- [ ] 관리자 행 `status === 'paid'`, `failure` 키 없음, 실패·성공 이력 둘 다 보존을 단언한다.
- [ ] `src/`는 변경되지 않는다. 기존 36개 테스트는 수정하지 않는다.
- [ ] `npm test`·`npm run typecheck`·`npm run lint`가 통과한다.

### 기준 코드의 사실 (이 계획이 의존하는 것)

| 파일 | 사실 | 계획과의 관계 |
| --- | --- | --- |
| `src/admin.ts` | `toAdminOrder()`는 `status: order.status`(저장 상태 그대로). `failure`는 `order.status === 'payment_failed'`일 때만 `findFailure()`로 첨부. 다른 상태에서는 `paymentAttempts`를 읽지 않는다 | 테스트가 고정하려는 현재 동작. `paid` 주문의 실패 이력은 관리자 응답에 아무 영향이 없어야 한다 |
| `src/payments.ts` | `isPayable()`은 `status === 'pending' && totalKrw > 0`. `paid`·`payment_failed` 주문의 재결제는 `400 Order is not payable`로 거부되고 이력을 남기지 않는다 | 「`paid` 주문 + 실패 이력」은 **API로 만들 수 없다** → 테스트는 `paymentAttempts`에 직접 넣어야 한다 |
| `src/orders.ts` | `GET /orders/:id`는 저장된 `Order`를 그대로 `res.json(order)` | 단건 조회 `status === 'paid'` 단언의 근거 |
| `src/store.ts` | `paymentAttempts: PaymentAttempt[]` export. `PaymentAttempt { orderId, ok, amountKrw, at, failureReason? }`, `failureReason`은 `'card_declined'` 리터럴 타입 | 직접 삽입할 레코드의 형태 |
| `tests/orders.test.ts` | 모듈 상단 헬퍼 `stockOf`, `createOrder`, `pay`, `refund`, `cancel`. import: `cancellations, orders, paymentAttempts, products, refunds, resetStore`. `describe('admin order list')`(211~248행)에 관리자 표시 테스트 2건, `beforeEach(resetStore)`. 현재 `it(` 36개 | **새 import·헬퍼 불필요.** 새 테스트는 `admin order list` describe에 들어간다 |
| 기존 보호 범위 (F6) | 246행 `rows.some((o) => o.status === '결제실패')`는 **실패 이력이 없는** `paid`·`pending` 주문만 검사. 569행 「two failure records」는 `payment_failed` 주문의 500 판정 | 「`paid` + 실패 이력 1건」 조합은 어느 테스트도 만들지 않는다 → 이 공백이 요청의 이유 |

---

## 정책 근거

바꾸는 동작은 없다(테스트 추가뿐). 아래는 **테스트가 단언할 각 기대값의 근거**다.

| # | 단언할 동작 | 근거 문서·절 | 근거 문장 (요지) |
| --- | --- | --- | --- |
| P1 | 관리자 행 `status`는 저장 상태 `paid` | `docs/order-policy.md` 「`payment_failed` 주문 표시 조건」 | 「`order.status === "payment_failed"`일 때만 관리자 상태를 `payment_failed`로 표시한다. 실패 시도가 존재한다는 이유만으로 `pending`, `paid`, `cancelled` 또는 `refunded` 상태를 실패 상태로 덮어쓰지 않는다」 |
| P2 | 관리자 행에 `failure` 키 없음 | `docs/order-policy.md` 「관리자 조회 기준」 | 「조건부 정보는 `failure` 객체 하나로 묶어 `payment_failed` 주문에만 붙이며, 일반 주문에 빈 값이나 추정값으로 붙이지 않는다」; 필수·조건부 표 「결제 실패 금액/시각/사유 — 표시 조건 `status === "payment_failed"`」 |
| P3 | 실패 이력·성공 이력 둘 다 보존 (테스트가 이력을 지우거나 고치지 않음) | `docs/payment-policy.md` 「결제 원칙」; `docs/order-policy.md` 「상태 정의」 | 「결제 처리 단계에 진입해 성공 또는 실패가 판정된 시도는 … 이력으로 보존한다」, 「`payment_failed` 주문은 … 삭제하지 않고 보존한다」. incident C2 판정: 「이력 삭제는 … 위반이라 선택지에서 제외」 |
| P4 | `GET /orders/:id`도 `paid` | `docs/order-policy.md` 「상태 전환 조건」 | 「상태를 바꾸지 않는 조회 … 는 전환으로 간주하지 않는다」 — 조회가 상태를 바꾸지 않으므로 단건·목록이 같은 저장 상태를 보여야 한다 |
| P5 | 응답 어디에도 `'결제실패'` 없음 | P1과 동일; `notes/incident-l20.md` F2·F5 | 로그 환경의 결함 표식이 `display_status=결제실패`. v0 `deriveDisplayStatus()`가 내던 문자열. 재도입 감지용 단언 |
| P6 | 재고는 결제 때 차감된 값 유지 | `docs/inventory-policy.md`(AGENTS.md Policy Routing); 기존 테스트 「deducts stock exactly once」 | 결제 성공 시 1회 차감. 조회와 이력 삽입은 재고를 건드리지 않는다 |
| P7 | 준비 조건을 저장소 직접 조작으로 만들고 그 사실을 주석에 남김 | `docs/payment-policy.md` 「동일 주문 재결제 정책의 승격」·「확정된 응답」 | 「`payment_failed`가 된 동일 주문에는 새 결제를 시도하거나 성공 처리하지 않는다」, 재결제 요청 → `400`, 「상태·이력·재고 변경 없음」. 따라서 API 경로로는 실패 뒤 성공 이력을 쌓을 수 없다 |
| P8 | 테스트 없이 상태를 바꾸지 않는다 / 테스트만 추가 | `AGENTS.md` Rules | 「해당 동작을 검증하는 테스트 없이 상태를 변경하지 않는다」 — 역으로, 이번엔 상태를 바꾸지 않으므로 코드 변경 없이 테스트만 늘린다 |

정책 충돌·공백: **없음.** 단언할 값은 모두 2026-10-16 확정 문장에 있다. 새 정책을 만들지 않는다.

---

## 변경 범위

| 파일 | 바꾼다 | 건드리지 않는다 |
| --- | --- | --- |
| `tests/orders.test.ts` | `describe('admin order list', …)` 블록 안, 기존 두 번째 테스트(`'uses the stored status for other orders and attaches no failure info to them'`, 232~247행) **바로 뒤**에 `it(...)` 1건 추가 (아래 명세) | 기존 36개 `it`의 본문·이름·기대값, 모듈 상단 헬퍼와 import 줄(새 import 불필요 — `paymentAttempts`·`orders`·`products`는 이미 import됨), 다른 describe 블록, `beforeEach(resetStore)` |
| `src/admin.ts` | — | 전부. 파생 로직을 넣지도, 주석을 고치지도 않는다 |
| `src/payments.ts` | — | 전부. `isPayable()` 포함. 재결제 허용으로 바꿔 테스트를 「API만으로」 만들려 하지 않는다(정책 위반) |
| `src/store.ts`, `src/orders.ts`, `src/server.ts`, `src/inventory.ts`, `src/refunds.ts`, `src/cancellations.ts` | — | 전부 |
| `docs/*.md`, `notes/pending-decisions.md`, `AGENTS.md` | — | 정책·결정 문서 변경 없음 |
| `notes/incident-l20.md` | — | 이 계획은 incident 노트를 고치지 않는다(기록은 E3 완료 후 소유자 지시로) |
| `labs/**` | — | 실습 중 수정 금지(`labs/CONVENTIONS.md`) |

### 추가할 테스트 명세

**이름** (영문, 기존 테스트 명명 관행에 맞춤):

```
keeps a paid order displayed as paid when a failure record also exists for it (Lab 20 regression)
```

**describe 위치**: `admin order list` — 이유: (1) 검증 대상이 `GET /admin/orders` 표시 규칙, (2) 같은 블록의 246행 단언(`'결제실패'` 부재)을 「실패 이력 있는 `paid`」로 확장하는 성격, (3) `beforeEach(resetStore)`가 이미 있어 격리 보장. 새 describe를 만들지 않는다.

**준비 조건** (API → 저장소 직접 조작 순서):

1. `const before = stockOf('keyboard');` (seed 5)
2. `createOrder([{ productId: 'keyboard', quantity: 1 }])` → `orderId`
3. `pay(orderId, 'CARD-1')` → `status 200` 단언(준비 실패를 조기에 드러내기 위해). 이 시점에 `paymentAttempts`에는 성공 이력 1건, 재고는 `before - 1`.
4. `paymentAttempts`에 실패 이력 1건을 **직접** 삽입:
   ```ts
   paymentAttempts.unshift({
     orderId,
     ok: false,
     amountKrw: 49_000,
     at: new Date(Date.now() - 60_000).toISOString(), // 성공보다 앞선 시각
     failureReason: 'card_declined',
   });
   ```
   - `unshift`로 성공보다 **앞에** 두어 「실패 → 성공」 순서를 재현한다. 단, 단언은 배열 순서에 의존하지 않게 쓴다(`filter`로 센다).
   - 필드는 `src/store.ts`의 `PaymentAttempt`와 정확히 일치시킨다. 타입 import는 필요 없다(배열 push/unshift가 요소 타입을 강제해 `tsc`가 오타를 잡는다).
5. **테스트 주석(필수)** — 4번 바로 위에 다음 취지를 적는다:
   > 이 fork는 같은 주문의 재결제를 거부하므로(`isPayable`: pending만 허용, `docs/payment-policy.md` 「동일 주문 재결제 정책의 승격」) 「실패 뒤 성공」 이력은 API로 만들 수 없다. `notes/incident-l20.md` 로그 2 환경(`payment_attempts=2 failed_attempts=1 order_status=paid`)을 재현하기 위해 저장소에 직접 넣는다. 이 테스트는 관리자 표시가 저장 상태(`paid`)를 그대로 쓰고 실패 이력 존재로 파생하지 않음을 고정한다.

**행동**:

- `const admin = await request(app).get('/admin/orders');`
- `const fetched = await request(app).get(`/orders/${orderId}`);`

**단언 목록** (전부 포함, 순서 무관):

| # | 단언 | 코드 형태 (예시) | 근거 |
| --- | --- | --- | --- |
| A1 | 관리자 목록 200 | `expect(admin.status).toBe(200)` | 불일치 500이 **아니어야** 함 — `paid` 주문은 `findFailure()`를 타지 않는다 |
| A2 | 관리자 행 `status === 'paid'` | `const row = (admin.body as Array<Record<string, unknown>>).find((o) => o.id === orderId); expect(row).toBeDefined(); expect(row?.status).toBe('paid')` | P1 |
| A3 | 관리자 행에 `failure` 키 없음 | `expect(row).not.toHaveProperty('failure')` | P2 |
| A4 | 단건 조회도 `paid` | `expect(fetched.status).toBe(200); expect(fetched.body.status).toBe('paid')` | P4 |
| A5 | 두 이력(실패·성공) 모두 보존 | `const own = paymentAttempts.filter((a) => a.orderId === orderId); expect(own).toHaveLength(2); expect(own.filter((a) => !a.ok)).toHaveLength(1); expect(own.filter((a) => a.ok)).toHaveLength(1)` | P3 |
| A6 | 응답 어디에도 `'결제실패'` 없음 | `expect(JSON.stringify(admin.body)).not.toContain('결제실패'); expect(JSON.stringify(fetched.body)).not.toContain('결제실패')` | P5 |
| A7 | 재고는 결제 때 차감된 값 유지 | `expect(stockOf('keyboard')).toBe(before - 1)` | P6 |

보조 단언(선택, 넣어도 범위 안): `expect(orders.get(orderId)?.status).toBe('paid')` — 저장 상태 자체가 `paid`임을 명시해 A2·A4가 「저장 상태 그대로」임을 읽는 사람이 바로 알게 한다.

**넣지 않는 것** (요청 밖·정책 밖):

- `payment_failed` 주문에 성공 이력을 붙이는 반대 조합 — 정책이 「불일치」로 다루는지조차 미확정(전환표 `paid → payment_failed` 금지만 있음). 새 정책 선점이 된다.
- `at`의 ISO 8601 형식 단언, 행 수 단언 — `notes/pending-decisions.md` 「테스트 보강 후보」로 **보류**된 항목.
- Issue #6의 거부 응답 본문·`nextAction` 단언 — 별도 결정.
- 기존 테스트의 리팩터링(헬퍼 추출 등).

---

## 검증 계약

### 시나리오

| ID | 시나리오 | 준비 조건 | 행동 | 기대 결과 |
| --- | --- | --- | --- | --- |
| S1 | `paid` + 실패 이력 1건의 관리자 표시 | keyboard×1 주문 → `CARD-1` 결제 200 → `paymentAttempts`에 실패 이력 1건 직접 삽입 | `GET /admin/orders` | 200; 해당 행 `status 'paid'`; `failure` 키 없음; 본문에 `'결제실패'` 없음 (A1·A2·A3·A6) |
| S2 | 같은 주문의 단건 조회 | S1과 동일 | `GET /orders/:id` | 200; `status 'paid'`; 본문에 `'결제실패'` 없음 (A4·A6) |
| S3 | 이력 보존 | S1과 동일 | `paymentAttempts` 직접 확인 | 해당 `orderId` 이력 2건 = 실패 1 + 성공 1 (A5) |
| S4 | 재고 불변 | S1과 동일 | `stockOf('keyboard')` | `before - 1` (A7) |
| S5 | 기존 테스트 무변경 | 구현 완료 | `git diff -- tests/orders.test.ts` | 추가된 줄(`+`)만 있고 삭제된 줄(`-`)이 없다. 기존 36개 `it` 이름이 그대로 |
| S6 | 범위 이탈 없음 | 구현 완료 | 아래 (4) | 변경 파일이 `tests/orders.test.ts` 하나 |

S1~S4는 하나의 `it` 안에서 함께 단언한다(요청: 「회귀 테스트 1건」).

반증 가능성(미실행 추론, `src/` 수정 금지라 실행하지 않는다): v0 `deriveDisplayStatus()`(실패 이력 1건 이상 → `'결제실패'`, `git show e8c7010:src/admin.ts`)를 `toAdminOrder()`에 다시 넣으면 A2·A6이 실패한다. 반대로 `paid` 행에 `failure`를 붙이는 변경은 A3이 잡는다. reviewer가 확인하고 싶으면 **별도 git worktree**에서 해 보고, 저장소 작업 트리의 `src/`는 건드리지 않는다.

### 실행 명령과 통과 기준

저장소 루트(`/Users/stosgh/Code/order-ops`)에서 순서대로 실행한다.

| 순서 | 명령 | 통과 기준 | 정지 조건 (하나라도 걸리면 멈추고 보고, 고치려 들지 않는다) |
| --- | --- | --- | --- |
| 1 | `npm test` | **37 passed, 0 failed** (기존 36 + 신규 1). 파일 `tests/orders.test.ts` 1개 | 신규 테스트 실패 → `src/`를 고쳐서 통과시키지 않는다. 기존 테스트 실패 → 범위 이탈 의심 |
| 2 | `npm run typecheck` | `tsc --noEmit` 오류 0 | `PaymentAttempt` 필드 오타·타입 불일치는 테스트 쪽에서 고친다 |
| 3 | `npm run lint` | `eslint src tests` 오류 0 (경고도 0 유지) | — |
| 4 | `git diff --name-only` | 출력이 정확히 `tests/orders.test.ts` 한 줄 | 다른 파일이 보이면 즉시 정지 |
| 5 | `git diff --name-only -- src` | 출력 없음 | 한 줄이라도 있으면 정지·되돌림 |
| 6 | `git diff --numstat -- tests/orders.test.ts` | 삭제 줄 수(둘째 열) `0` | 기존 테스트를 지우거나 고친 것 → 정지 |
| 7 | `grep -c "^\s*it(" tests/orders.test.ts` | `37` | — |

복사해 그대로 실행 (zsh·bash 공통):

```bash
cd /Users/stosgh/Code/order-ops
npm test
npm run typecheck
npm run lint
git diff --name-only                       # 기대: tests/orders.test.ts
git diff --name-only -- src                # 기대: (빈 출력)
git diff --numstat -- tests/orders.test.ts # 기대: <추가수>  0  tests/orders.test.ts
grep -c "^\s*it(" tests/orders.test.ts     # 기대: 37
```

참고: 작업 트리에 미추적 `notes/incident-l20.md`·`.claude/`가 있다. `git diff`는 미추적 파일을 보여주지 않으므로 4·5번 판정에 영향 없다. 커밋할 때는 `git add tests/orders.test.ts`처럼 파일을 명시한다(`git add .`·`-A` 금지).

최종 보고에는 1~7의 실제 출력(성공·실패)을 남기고, 실행하지 못한 항목은 통과로 적지 않는다(`AGENTS.md` Before Final Response).

---

## 사람 결정 필요

**없음.**

- 단언할 값은 전부 확정 정책 문장(P1~P7)에 있고, 승인 범위(테스트 1건, `src/` 불변)는 `notes/incident-l20.md` 승인 기록으로 닫혀 있다.
- 테스트 이름·describe 위치·실패 이력 삽입 위치(`unshift`)는 정책이 아니라 테스트 작성 관행이므로 planner가 정했다. implementer가 이름을 다듬는 것은 범위 안이다.
- 이 계획이 **열지 않는** 결정(별도 트랙으로 유지): Issue #6 사람 결정 1~3(재결제 정책, 거부 응답 상태 코드·안내 형식), 결정 4(VOC 환경 확인), 실패율 지표·임계 알림(backlog), `payment_failed` + 성공 이력 조합의 판정, `notes/pending-decisions.md` 「테스트 보강 후보」.

---

## Handoff 조건 (planner.md)

- 「사람 결정 필요」가 비어 있으므로 바로 implementer로 넘길 수 있다.
- 넘길 때 전달: 이 파일 경로(`notes/plans/l20-display-status-regression.md`), 승인자·승인 시각(seotaioh, 2026-10-16 19:00 KST — `notes/incident-l20.md` 승인 기록), 승인되지 않은 항목: 없음.
- implementer 지시 요약: `tests/orders.test.ts`의 `admin order list` describe에 위 명세대로 `it` 1건 추가 → 명령 1~7 실행 → 출력을 그대로 보고. `src/`는 열어 읽기만 한다.
