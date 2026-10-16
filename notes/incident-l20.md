# Incident note — 재시도 결제 뒤 관리자 표시 상태 불일치 (Lab 20)

## 시나리오와 입력

| 항목 | 값 |
| --- | --- |
| 시나리오 | 결제에 한 번 이상 실패한 뒤 다시 결제해 성공한 주문이, 주문 상세에서는 `paid`인데 관리자 목록에서는 `결제실패`로 표시됨 |
| VOC | `labs/fixtures/l18-voc-report.md` (2026-08-02 10:15 KST 접수) → GitHub Issue #6 https://github.com/seotaioh/order-ops/issues/6 |
| 로그 1 | `labs/fixtures/logs/l20-payment-failure-rate.log` — 5분 간격 결제 시도 지표 5줄 |
| 로그 2 | `labs/fixtures/logs/l20-admin-search.log` — 관리자 조회 4줄 (`ord-retry-017`, `ord-retry-021`) |
| 시간 범위 | 2026-08-02 01:00~01:20 UTC (10:00~10:20 KST). VOC 접수 10:15 KST는 이 창 안 |
| 코드 기준 | 이 fork main `e46991e` (2026-10-16). 코드는 수정하지 않았다 |

## 증상 (로그에서 직접 읽은 것)

- 01:00~01:05: 실패율 7.5%→8.5%. 01:10부터 **19.0%·21.5%·20.2%**로 급등, `alert=threshold_exceeded` 3회 연속.
- 01:12:10 `/admin/orders` `ord-retry-017`: `payment_attempts=2 failed_attempts=1 order_status=paid display_status=결제실패`.
- 01:13:42 `ord-retry-021`: `payment_attempts=3 failed_attempts=2 order_status=paid display_status=결제실패`.
- 01:15:09 `/orders/ord-retry-017`: `order_status=paid http_status=200`. 01:15:12 같은 주문 관리자 조회 `mismatch=true`.

## 영향

| 구분 | 내용 | 근거 |
| --- | --- | --- |
| 고객 영향 | 결제가 끝난 고객이 「주문을 다시 처리해야 하느냐」고 문의. 실제 금액·주문 상태는 정상(`paid`)이므로 금전 피해 없음. 혼란과 중복 결제 시도 가능성 | VOC 본문, 로그 2의 `order_status=paid` |
| 운영 영향 | 관리자 목록만 보면 정상 결제 주문을 실패로 오인해 재처리·환불 같은 잘못된 조치를 할 수 있음. 실패율 급등 구간에 재시도가 몰려 오인 대상이 늘어남 | 로그 2 `mismatch=true`, 로그 1 실패율 |
| 먼저 확인할 것 | **운영 영향**. 고객 쪽은 상태가 정상이라 안내로 해결되지만, 운영자가 `paid` 주문을 실패로 보고 조치하면 되돌리기 어렵다 | — |

## 확인된 사실

| # | 사실 | 근거 |
| --- | --- | --- |
| F1 | 로그 2의 환경에서는 **같은 주문에 결제 시도가 여러 번** 쌓인다(2회, 3회) | 로그 2 `payment_attempts=2/3` |
| F2 | 그 환경의 표시 상태는 저장 상태(`paid`)가 아니라 **실패 이력 존재**로 계산된다 | 로그 2: `failed_attempts≥1`이면 `order_status`와 무관하게 `결제실패` |
| F3 | 이 fork의 현재 코드는 같은 주문의 재결제를 **거부**한다(`400 Order is not payable`). 따라서 F1 상태가 API로는 생기지 않는다 | `src/payments.ts` `isPayable()`, `docs/payment-policy.md` 「동일 주문 재결제 정책의 승격」, `notes/issue-exploration-l18.md` 재현 |
| F4 | 이 fork의 관리자 목록은 **저장 상태를 그대로** 표시한다. 저장소에 `paid` 주문 + 실패 이력 1건을 직접 만들어 조회하면 `status: "paid"`, `failure` 없음, 단건 조회와 **불일치 없음** | 2026-10-16 프로브(스크래치, `NODE_ENV=test`): `attempts [fail, ok]`, `GET /orders/:id → paid`, admin row `status: paid`, `mismatch: false` |
| F5 | F2의 계산 방식은 v0 `src/admin.ts` `deriveDisplayStatus()`(실패 이력이 하나라도 있으면 `'결제실패'`)와 정확히 같다. 이 함수는 PR #1(`e8c7010..9cb009c`)에서 제거됐다 | `git show e8c7010:src/admin.ts`, `notes/role-split-run-l17.md` |
| F6 | 이 fork의 테스트는 「`'결제실패'`가 관리자 목록에 없다」(`tests/orders.test.ts` admin order list)와 「실패 이력이 둘이면 500」은 보호하지만, **「`paid` 주문에 실패 이력이 있어도 `paid`로 표시된다」는 시나리오는 직접 단언하지 않는다** | `grep -n "결제실패\|two failure records" tests/orders.test.ts` |
| F7 | 로그 1의 실패율 급등(7%→20%)은 결제 수단 거절이 늘었다는 뜻이며, 이 fork에는 그 지표를 내는 코드가 없다 | `grep -rn "failure_rate\|metric" src/` 없음 |

## 미확인 항목

- 로그 2가 나온 환경의 코드 버전. F1·F2로 보아 「재결제 허용 + 실패 이력 기반 표시」 환경이며, 강의 원본이 Lab 17 뒤에 두는 중간 상태(`notes/role-split-run-l17.md` 「남은 위험」)와 일치하지만 이 fork 이력에는 없다.
- 실패율 급등의 원인(결제 제공자 장애인지, 특정 카드 BIN인지). 로그에 분해 축이 없다.
- `ord-retry-021`의 두 번 실패가 같은 사유인지.

## 원인 후보 (E2)

| # | 후보 | 층 | 확인 방법 (반증 가능) | 이 fork에서의 판정 |
| --- | --- | --- | --- | --- |
| C1 | **표시 상태를 실패 이력 존재로 파생**한다 (`deriveDisplayStatus()` 류). 저장 상태가 `paid`여도 과거 실패 1건이면 `결제실패` | 표시 층 | `paid` 주문에 실패 이력을 1건 두고 `/admin/orders` 조회 → `status`가 `paid`면 반증, `결제실패`면 지지 | 로그 환경에서는 **지지**(F2). 이 fork에서는 **반증**(F4: `paid` 표시). 즉 이 fork는 이미 고쳐진 상태 |
| C2 | **재결제 허용 정책 아래 성공 시도가 실패 이력을 정리하지 않는다**. 결제 층은 정상(`paid`)이지만 이력 테이블에 실패가 남아 C1을 자극 | 결제·이력 층 | 재결제 성공 뒤 `paymentAttempts`에 실패 기록이 남는지 확인. 남으면 지지. 단 **이력 보존은 정책이 요구하는 것**이므로 「정리」는 해법이 아니다 | 로그 환경에서 지지(`failed_attempts` 유지). 이 fork는 재결제 자체를 금지(F3)해 발생 불가. 이력 삭제는 `docs/order-policy.md` 「`payment_failed` 주문은 … 삭제하지 않고 보존」 위반이라 선택지에서 제외 |
| C3 | **결제 제공자 거절 급증**(로그 1)이 재시도를 늘려 C1 노출 건수를 키웠다. 불일치의 원인이 아니라 **증폭 요인** | 외부·결제 층 | 실패율 급등 구간과 `mismatch` 로그의 시각이 겹치는지(01:10~01:20, 겹침), 급등 전에도 mismatch가 있었는지(로그 없음 → 미확인) | 부분 지지. 이 fork에는 실패율 지표 자체가 없어(F7) 감지 수단이 없다 |

### 현재 동작 vs 기대 동작

| 층 | 로그 환경의 현재 동작 | 이 fork의 현재 동작 | 기대 동작 (정책) |
| --- | --- | --- | --- |
| 결제 결과 | 재시도 성공 → `paid` | 재시도 거부(400), 첫 실패 주문은 `payment_failed` 유지 | 결제 정책: 실패 주문 재결제 금지(이 fork와 일치) |
| 주문 상태 | `paid` (정상) | `payment_failed` 또는 `paid` (전환표대로) | 주문 상태 정책 전환표 |
| 표시 상태 | 실패 이력 존재 → `결제실패` (**불일치**) | 저장 상태 그대로 (**일치**, F4) | 「`order.status === "payment_failed"`일 때만 `payment_failed`로 표시. 실패 시도가 존재한다는 이유만으로 … 덮어쓰지 않는다」(`docs/order-policy.md` 관리자 조회 기준) |

### 선택한 후보와 대응 결정 (사람 승인 대상)

- **선택한 원인**: C1(표시 층 파생 오류)이 불일치의 직접 원인이고, C3은 증폭 요인이다. C2는 정책상 수정 대상이 아니다.
- **수정 / rollback / 추가 조사 판단**:
  - **rollback 아님** — 이 fork의 현재 코드는 C1이 이미 제거된 상태(F4·F5)라 되돌릴 변경이 없다. 되돌리면 오히려 결함이 돌아온다.
  - **수정(최소)** — 코드가 아니라 **테스트**: F6의 공백을 메우는 회귀 테스트 1건을 추가한다. 「`paid` 주문에 실패 이력이 있어도 관리자 표시는 `paid`이고 `failure` 필드가 없으며, 실패 이력과 성공 이력은 둘 다 보존된다」를 저장소 직접 조작으로 고정한다. v0 파생 로직을 그대로 복원하면 기존 테스트(`payment_failed` 행의 상태 단언)가 먼저 잡지만, 「`paid` 주문에만 실패 이력으로 파생하는」 변형은 기존 36개를 전부 통과한다 — reviewer의 worktree 실험(`notes/reviewer-findings-l20.md` 변형 1b)으로 확인. 이 테스트는 그 공백을 메운다.
  - **추가 조사(backlog)** — 로그 1의 실패율 지표와 임계 알림은 이 fork에 없다. 운영 감지 수단으로 `notes/backlog-l20.md`에 올린다. VOC 환경 확인(Issue #6 결정 4)도 backlog.
  - **Issue #6 사람 결정 1~3**(재결제 정책 유지 여부, 거부 응답 형식)은 이 incident의 원인이 아니라 **안내 부재** 문제이므로 별도 결정으로 유지한다. 이 lab에서 선점하지 않는다.
- **앱 코드(`src/`) diff**: 없음. 이 결정이 승인되면 E3에서 planner → implementer(테스트만) → reviewer로 진행한다.

승인 기록: 저장소 소유자(seotaioh)가 2026-10-16 18:50 KST경(커밋 `8f109a4` 18:55 이전) Claude Code 대화에서 위 대응(rollback 아님 / 회귀 테스트 1건 추가 / 실패율 지표·VOC 환경 확인은 backlog / Issue #6 결정은 별도 유지)을 「승인」. 이 시점까지 `src/`·`tests/` diff 없음.
