# Reviewer 발견 사항 — Issue #6 결제 거부 응답에 사유·다음 행동 안내 추가

역할: reviewer(`docs/prompts/reviewer.md`). 코드는 수정하지 않았다. 심각도는 **차단 / 권고** 두 단계.

## 검토 범위

| 항목 | 값 |
| --- | --- |
| 요청 | [Issue #6](https://github.com/seotaioh/order-ops/issues/6) (`gh issue view 6 --json title,body`로 원문 확인) |
| 계획 | `notes/plans/issue-6-repayment-rejection-guidance.md` (사람 결정 1~4 확정, Out of Scope 확정) |
| diff | `git diff main` — 브랜치 `issue-6/repayment-rejection-guidance`, main(`f98bcd4`)과 같은 커밋이며 전부 미커밋 변경 |
| 변경 파일 (`git diff --name-only main`) | `docs/payment-policy.md`, `notes/pending-decisions.md`, `src/payments.ts`, `tests/orders.test.ts` — 계획의 4개와 **일치** |
| 미추적 파일 | `notes/plans/issue-6-repayment-rejection-guidance.md`(계획 허용), `.claude/launch.json`(계획에 없음 — 아래 권고 R5) |
| 정책 | `docs/payment-policy.md`, `docs/order-policy.md`, `AGENTS.md` 전문 |
| 실행 | `NODE_ENV=test npm test` → 37 passed / `npm run typecheck` → 통과 / `npm run lint` → 통과 (2026-10-16 19:40, 작업 트리 기준) |
| 프로브 | `.claude/probe/not-payable-probe.ts`를 `NODE_ENV=test npx tsx`로 1회 실행 후 디렉터리 삭제 (아래 「테스트 누락」 T1에 결과 인용) |

## 계획 이탈

발견 **0건 (차단 0 / 권고 0)**. 확인한 근거:

| 계획 「변경 범위」 항목 | diff 확인 결과 |
| --- | --- |
| `src/payments.ts` 거부 분기에서 `status`·`reason`·`nextAction` 반환, 매핑 함수 1개 추가 | `src/payments.ts:120-123` 거부 분기가 `describeRejection(order)`를 반환. 매핑 함수 `describeRejection` 1개(`:63-77`)와 그 반환 타입을 위한 `PaymentRejectionReason`·`NextAction`·`PaymentRejection` 타입 선언(`:46-60`) 추가. 타입 선언은 함수의 부속이며 동작을 추가하지 않는다 |
| `isPayable()` 허용 조건 불변 | `src/payments.ts:41-43` `return order.status === 'pending' && order.totalKrw > 0;` — diff에 해당 줄 변경 없음(hunk `@@ -42,6 +42,40 @@`는 그 아래 삽입만) |
| 실패 402 분기·성공 분기·재고 처리·라우트 경로 불변 | `:111-157` 중 변경 줄은 `:121` 한 줄뿐. `parseCardToken`·`recordFailure`·`findInsufficientProduct`·`deductStock` 호출 순서 동일 |
| `tests/orders.test.ts` — 5개 테스트만 단언 교체·추가, 그 밖의 테스트·헬퍼·import 불변 | diff hunk 5개가 계획이 지목한 main 기준 줄(137·195·372·481·572)의 테스트와 정확히 대응(`git show main:tests/orders.test.ts`로 대조). 새 테스트 추가 없음, import 줄 변경 없음 |
| `docs/payment-policy.md` — 「확정된 응답」 재결제 행과 50~51행, 사유 코드 집합 명시 | `:41` 행 갱신, `:50-51` 갱신, `:53-63` 「결제 거부 사유 코드」 절 신설. 다른 절 변경 없음 |
| `notes/pending-decisions.md` — 「Issue #6 결정」 절 추가, 기존 절 불변 | diff는 `:151` 이후 추가뿐 |
| `src/admin.ts`, `src/store.ts`, 그 외 `src/` 불변 | `git diff --name-only main`에 없음 |

## 정책 이탈

발견 **차단 0건 / 권고 2건** (문서 표현 문제이며 코드 동작은 정책과 일치).

### 동작 확인 (이탈 없음)

| 정책 문장 | 코드 근거 |
| --- | --- |
| `docs/payment-policy.md:14` 「거부된 재결제 요청은 기존 주문 상태와 결제 이력을 변경하지 않아야 한다」, `docs/order-policy.md:44` 「거부 응답은 전환으로 간주하지 않는다」 | `describeRejection`(`src/payments.ts:63-77`)은 `order.status`만 읽고 아무것도 쓰지 않는다. 거부 분기(`:120-123`)는 `recordFailure`·`deductStock`·`order.status =` 어느 것도 호출하지 않고 `return` |
| 계획 결정 3의 상태별 `reason`/`nextAction` ↔ `docs/payment-policy.md:55-61` 표 ↔ 코드 | 5행 모두 일치: `payment_failed→repayment_not_allowed/create_new_order`(`:66-67`), `paid→already_paid/none`(`:68-69`), `cancelled→order_cancelled/create_new_order`(`:70-71`), `refunded→order_refunded/create_new_order`(`:72-73`), 그 밖→`not_payable/none`(`:74-75`) |
| `docs/payment-policy.md:12` 실패 정보에 카드 정보·내부 오류·스택 미포함, `:63` 「`reason`과 `nextAction`은 위 고정 코드만 쓴다」 | `reason`은 문자열 리터럴 유니온 `PaymentRejectionReason`(`:46-51`), `nextAction`은 `NextAction`(`:53`), `message`는 리터럴 타입(`:56`). `describeRejection`은 `req`를 받지 않으므로 `cardToken`이 응답에 들어갈 경로가 없다. 응답 키 집합은 프로브 P4에서 `['message','status','reason','nextAction']` |
| 상태 코드 400 유지(결정 2), `docs/order-policy.md:107` 「`cancelled` 주문의 결제 요청은 `Order is not payable`로 거부」 | `res.status(400)`(`:121`), `message` 문구 불변 |
| 선례 `src/refunds.ts:32`·`src/cancellations.ts:30`의 `{ message, status }` | 새 본문이 같은 키 `status`(주문 상태)를 쓰고 `reason`·`nextAction`을 더한다. 키 의미 충돌 없음 |

### R1 (권고) `docs/payment-policy.md:50-51` 「같은 400 거부 응답」의 지시 대상이 모호해짐

- 근거: 변경 전 `:50`은 `` `refunded` 주문의 재결제는 `400 { "message": "Order is not payable" }`로 거부한다 ``로 응답을 명시했다. 변경 후 `` 같은 400 거부 응답으로 거부한다 ``가 됐는데, 바로 위 `:49`가 **환불 거부** `400 { "message": "Order is not refundable", "status" }`를 서술하므로 문맥상 「같은 응답」이 환불 거부 응답으로 읽힌다. `:51` 「같은 응답으로 거부한다」도 `:50`에 연쇄된다.
- 영향: 코드는 `order_refunded`/`order_cancelled`로 올바르게 응답하나(테스트 `:384`·`:499`), 정책 문서만 읽는 사람은 환불 거부 본문을 기대할 수 있다. 정책 ↔ 코드 불일치가 아니라 정책 문장의 참조 오류.
- 제안: `:50`을 「`refunded` 주문의 재결제는 「확정된 응답」의 결제 거부 응답(`Order is not payable`, `reason: order_refunded`)으로 거부한다」처럼 표를 직접 가리키게 고친다. `:51`도 `reason: order_cancelled`를 명시.

### R2 (권고) `docs/payment-policy.md:53` 「결제 거부 사유 코드」가 `## 환불` 절의 하위(`###`)로 들어감

- 근거: `:44 ## 환불 (2026-10-16 확정)` 아래에 `:53 ### 결제 거부 사유 코드`가 놓였다. 내용은 환불이 아니라 「확정된 응답」(`:36`)의 보충이다.
- 영향: 문서 구조상 재결제 거부 사유가 환불 정책의 일부로 분류된다. 동작 영향 없음.
- 제안: 「확정된 응답」 표 바로 아래로 옮기거나 `##`로 승격.

## 테스트 누락

발견 **차단 0건 / 권고 1건**. 계획 S1~S6 대조:

| 시나리오 | 판정 테스트 (`tests/orders.test.ts`) | 단언 확인 | 판정 |
| --- | --- | --- | --- |
| S1 실패 주문 재결제(정상 토큰) | `:201` `payment failure › rejects re-payment of a payment_failed order without changing status, history, or stock` | `:209` 400, `:210-215` 본문 `toEqual` 정확값, `:216` 상태 `payment_failed`, `:217` `paymentAttempts.length` 불변, `:218` 재고 불변 | 있음 |
| S2 실패 주문 재시도(FAIL 토큰) | `:596` `review follow-ups › (d) rejects a second FAIL attempt on a payment_failed order and keeps exactly one failure record` | `:605` 400, `:606-611` 본문 정확값, `:612` 상태, `:613` 해당 주문 `!ok` 이력 정확히 1건, `:614` 재고, `:615-616` 관리자 200 + `failure.reason` | 있음 |
| S3 결제 완료 주문 재결제 | `:137` `payment success › does not deduct stock again when a paid order is paid a second time` | `:144` 400, `:145-150` 본문 정확값(`already_paid`/`none`), `:151` 상태 `paid`, `:152` 재고 `before - 2`(추가 차감 없음), `:153` 이력 1건 | 있음 |
| S4 환불 주문 결제 | `:384` `refund flow › does not allow paying a refunded order again` | `:391` 400, `:392-397` 본문 정확값(`order_refunded`), `:398-400` 상태·재고·이력 불변 | 있음 |
| S5 취소 주문 결제 | `:499` `cancel flow › does not allow paying or refunding a cancelled order` | `:506` 400, `:507-512` 본문 정확값(`order_cancelled`), `:514-516` 상태·재고·`paymentAttempts` 0건 | 있음 |
| S6 민감정보 | `:573` `(c) never exposes card tokens or a cardToken key in any response` + S1~S5의 `toEqual` 정확값 | `(c)`의 검사 대상 응답 목록 `:588`은 성공 200·실패 402·GET·admin이며 **400 거부 응답은 포함하지 않는다**. 다만 S1~S5가 본문을 `toEqual`로 정확히 고정하므로 토큰 키·값이 섞이면 그 테스트들이 실패한다 | 있음(간접) — 아래 T2 |

### T1 `not_payable` 분기 — API 경로로 도달 불가, 테스트 불필요

- 코드 조건: `isPayable`(`src/payments.ts:42`)이 거짓인 `pending` 주문은 `totalKrw <= 0`뿐이다.
- 도달 가능성 근거:
  - `src/orders.ts:49` — `items` 비어 있으면 400 `Invalid items`; `:16-28` `isOrderItem`이 `quantity`를 정수 `> 0`으로 강제.
  - `src/orders.ts:30-42` — `totalKrw = Σ priceKrw × quantity`. 시드 가격 `src/store.ts:49-51` 49,000 / 23,000 / 310,000 모두 양수. 가격을 바꾸는 API 없음.
  - 프로브 P1(API): `quantity: 0` → `400 Invalid items`, `items: []` → `400 Invalid items`. 시드 가격 `every > 0` = `true`.
  - 프로브 P2(저장소 직접 주입 `totalKrw: 0, status: 'pending'`): `400 {"message":"Order is not payable","status":"pending","reason":"not_payable","nextAction":"none"}` — 분기 자체는 정책 표 「그 밖」 행대로 동작하고 토큰 누출 없음(`false`).
- 판정: **도달 불가 — 테스트 불필요**. `default` 분기는 `OrderStatus` 5개 중 `pending`만 남는 자리이며 방어적 코드다. 고정하고 싶다면 Lab 20 회귀 테스트(`:261`)처럼 `orders.set`으로 주입하는 방식이 가능하나 이번 범위에서 요구하지 않는다.

### T2 (권고) `(c)` 테스트의 검사 대상에 400 거부 응답이 없음

- 근거: `tests/orders.test.ts:588` `for (const response of [paySuccess, payFailure, getPaid, getFailed, getPending, admin])`. 새로 모양이 바뀐 응답(거부 400)은 이 민감정보 스캔을 거치지 않는다.
- 현재 보호 수준: S1~S5의 `toEqual` 정확값 단언이 키 추가를 막으므로 **실질 공백은 아니다**. 그러나 「모든 응답에 토큰 없음」을 한 곳에서 선언하는 `(c)`의 의도에 거부 응답이 빠져 있어, 이후 거부 본문에 필드를 추가하면서 `toEqual`을 `toMatchObject`로 완화하면 그때 공백이 생긴다.
- 제안: `(c)`에 `const rejected = await pay(failedId, OK_TOKEN);`를 추가하고 배열에 넣는다(기대 400). 테스트 1개 수정으로 끝나며 계획의 「그 밖의 테스트 불변」 조항과는 어긋나므로 사람 결정 필요(아래 Q2).

## 개인정보·민감정보

발견 **0건**. 확인한 경로:

| 경로 | 결과 |
| --- | --- |
| 거부 본문에 `cardToken`이 들어갈 수 있는가 | 불가. `describeRejection(order)`는 `req`·`req.body`를 받지 않는다(`src/payments.ts:63`). 거부 분기(`:120`)는 `parseCardToken`(`:125`)보다 앞서 실행되므로 토큰은 아직 파싱조차 되지 않은 상태 |
| 내부 오류·예외 메시지·스택 | 거부 분기에 `try/catch`·`Error` 생성 없음. `toFailureInfo`의 `throw`(`:104`)는 402 분기 전용 |
| 응답 값이 고정 코드 집합인가 | `message` 리터럴 타입, `reason`·`nextAction` 리터럴 유니온(`:46-60`). `status`는 `Order['status']`(=`OrderStatus` 5값). 자유 문자열 필드 없음 |
| 주문 객체 통째 직렬화 여부 | 거부 응답은 새 객체 4키뿐(프로브 P4). `Order`의 `items`·`id`도 포함하지 않는다 |
| 문서·노트에 토큰·시크릿 | `docs/payment-policy.md`·`notes/pending-decisions.md` diff에 코드 예시 외 값 없음 |

참고(변경 없음, 기존 상태): 성공 응답(`:155`)과 `GET /orders/:id`는 여전히 `Order` 원본을 직렬화한다 — `notes/pending-decisions.md` PI-6 보류 항목 그대로이며 이번 diff와 무관.

## Issue AC 대조

| Issue AC | 충족 | 근거 (`tests/orders.test.ts`) |
| --- | --- | --- |
| 1. 상태: 결제 요청 후에도 `payment_failed`이고 실패 이력 1건 | 충족 | `:216` 상태 / `:217` 이력 길이 불변(직전 실패 1건) — `rejects re-payment…`(`:201`); `:612` 상태 / `:613` `!ok` 이력 정확히 1건 — `(d)`(`:596`) |
| 2. 응답: HTTP 상태·본문이 (A) 결정값, 사유와 다음 행동을 구분하는 필드 | 충족 | `:209-215` `400` + `{ message, status:'payment_failed', reason:'repayment_not_allowed', nextAction:'create_new_order' }`; `:605-611` 동일(FAIL 토큰). 사유 필드 `reason`, 다음 행동 필드 `nextAction`으로 분리 |
| 3. 저장 결과: 재고·결제 이력·주문 상태 불변 | 충족 | `:216-218`(상태·이력·재고), `:612-614`(상태·이력·재고). 다른 상태도 `:151-153`(paid), `:398-400`(refunded), `:514-516`(cancelled) |
| 4. 테스트 증거: `tests/orders.test.ts`에 포함되고 `npm test` 통과 | 충족 | 위 테스트가 모두 `tests/orders.test.ts`에 있음. `NODE_ENV=test npm test` → `Tests 37 passed (37)` (이 세션 실행 결과) |

Issue Scope 두 번째 항목(「관리자 목록에서 실패 주문의 후속 처리 상태를 운영자가 알 수 있는지 확인」): `src/admin.ts` 불변. `(d)` `:615-617`이 거부 뒤에도 관리자 행이 200 + `failure.reason === 'card_declined'`임을 고정한다. 거부된 재결제 시도 자체는 관리자 목록에 나타나지 않으며, 이는 계획·`notes/pending-decisions.md` 「Out of Scope로 확정 — 거부된 재결제를 결제 시도 이력에 남기는 것」으로 명시적으로 제외됐다(아래 Q3).

## 질문

사람 결정이 필요한 지점. 모두 비차단.

- **Q1** R1·R2 문서 수정을 이번 PR에서 할지, 범위 밖으로 기록할지. 둘 다 `docs/payment-policy.md` 안이라 계획의 변경 파일 집합을 벗어나지 않는다.
- **Q2** T2(`(c)` 테스트에 거부 응답 추가)는 계획의 「그 밖의 테스트 불변」 조항과 충돌한다. 이번 PR에서 허용할지, 후속으로 넘길지.
- **Q3** `notes/pending-decisions.md:82` 「`payment_failed` 주문 재결제 거부 응답 … 기존 `400 { message: 'Order is not payable' }` 유지 … 확정」과 `:102` 「`refunded` 주문의 재결제는 기존 `400 Order is not payable`」이 이번 결정(`:166`)으로 대체됐으나 두 기존 항목에 대체 표시가 없다. 계획이 「기존 절 불변」을 지정했으므로 implementer는 계획대로 했다. 같은 파일 안에 「확정」이 두 번 서로 다르게 남는 것을 허용할지, 기존 항목 끝에 「→ 2026-10-16 Issue #6 결정으로 본문 확장, 아래 절 참조」 한 줄을 붙일지 결정이 필요하다. (권고 R3로도 집계)
- **Q4** `nextAction: 'create_new_order'`를 `refunded`·`cancelled`에 돌려주는 것은 `docs/order-policy.md:36`(`cancelled → pending` 보류)·`:39`(`refunded → paid` 보류)가 닫혀 있는 현재를 전제한다. 결정 3으로 확정된 값이므로 이탈은 아니지만, 보류 전환이 나중에 열리면 이 코드 값도 함께 재검토해야 한다는 점을 결정 기록에 남길지.

## 확인한 범위

- 읽은 것: Issue #6 본문 전체, 계획 전문, `git diff main` 전체(4파일 108+/8-), `src/payments.ts`·`src/orders.ts`·`src/store.ts`·`src/inventory.ts`·`src/refunds.ts`·`src/cancellations.ts`·`src/admin.ts`·`src/server.ts` 전문, `tests/orders.test.ts` 전문(676행), `docs/payment-policy.md`·`docs/order-policy.md`·`AGENTS.md`·`labs/CONVENTIONS.md` 전문, `notes/pending-decisions.md` 관련 절, `README.md` 결제 절, `.gitignore`, `.claude/launch.json`.
- 실행한 것: `NODE_ENV=test npm test`(37 passed), `npm run typecheck`(통과), `npm run lint`(통과), `git show main:tests/orders.test.ts`로 계획의 줄 번호 대조, 저장소 전체 `Order is not payable` grep, 프로브 1회(P1~P4, 실행 후 `.claude/probe/` 삭제 확인).
- 확인하지 않은 것 / 범위 밖:
  - `npm start`로 띄운 실제 서버에 대한 HTTP 재현은 하지 않았다(supertest 경유 프로브로 대체).
  - VOC 환경(결정 4로 「현재 코드 기준」 종결)은 검증 대상에서 제외.
  - `README.md:216-236`은 main 시점부터 현재 코드와 어긋나 있다(「주문을 저장소에서 삭제」「HTTP 200 `{ ok: false }`」「표시 상태 `결제실패` 계산」). 이번 diff가 만든 문제가 아니고 계획 범위 밖이므로 발견 사항으로 집계하지 않는다. 별도 정리 대상.
  - `.claude/launch.json`(미추적, 브라우저 미리보기 도구 설정)은 계획의 산출물이 아니다. 커밋 대상에서 제외하면 된다(권고 R5). `.gitignore` 수정은 범위 밖.
  - 코드 동작은 테스트·프로브로 확인했으나, `describeRejection`의 `default` 분기를 `case 'pending'`으로 명시하는 식의 가독성 개선은 선택 사항이며 발견 사항이 아니다.

## Handoff

| 등급 | 건수 | 항목 |
| --- | --- | --- |
| 차단 | **0** | — |
| 권고 | **5** | R1 정책 문서 `:50-51` 참조 모호 / R2 사유 코드 절 위치 / T2 `(c)` 테스트에 거부 응답 미포함 / R3(=Q3) `pending-decisions.md` 기존 「확정」 항목에 대체 표시 없음 / R5 `.claude/launch.json` 커밋 제외 |

**머지 가능.** 계획 이탈 없음, 정책 동작 이탈 없음, Issue AC 4개 모두 테스트 이름·줄 번호로 충족 확인, 검증 명령 3종 통과. 권고 5건은 사람이 항목별로 「수정 / 범위 밖으로 기록 / 무시」를 정한다. R1·R2·R3은 문서 1~3줄 수정, T2는 테스트 1곳 수정(계획 조항 완화 필요), R5는 스테이징 제외로 끝난다.
