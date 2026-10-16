# Reviewer 발견 사항 — P1 정책 확정 응답의 정확값 단언 보강

검토일: 2026-10-16. 역할: reviewer(`docs/prompts/reviewer.md`). 코드·테스트·정책은 수정하지 않았다.

## 검토 범위

| 항목 | 내용 |
| --- | --- |
| 계획 | `notes/plans/p1-exact-assertions.md` (미추적 신규 파일) |
| diff | 브랜치 `tests/exact-assertions`, 미커밋. `git diff main --stat`: `tests/orders.test.ts` +42/−22, `notes/backlog-l20.md` 4줄, `notes/pending-decisions.md` 2줄 |
| 정책 | `docs/inventory-policy.md` 「재고 부족 응답」(L31–38), `docs/payment-policy.md` 「확정된 응답」(L36–42)·「환불」(L56–63), `docs/order-policy.md` 「관리자 조회 기준」(L53–98)·「취소 전환의 구현」(L100–107) |
| 코드(읽기 전용) | `src/inventory.ts`, `src/orders.ts`, `src/payments.ts`, `src/refunds.ts`, `src/cancellations.ts`, `src/admin.ts`, `src/store.ts` |
| 실행 | `npm test` 37/37 통과, `npm run typecheck` 종료 0, `npm run lint` 종료 0 (이 세션에서 직접 실행) |

아래 줄 번호는 별도 표기가 없으면 **작업 트리의 `tests/orders.test.ts`** 기준이다. `main` 기준 줄은 `main:L…`로 적는다.

## 계획 이탈

### 이탈 1 — 계획 「변경 범위」 밖의 파일 2개가 diff에 포함됨 (권고)

- 파일: `notes/backlog-l20.md`, `notes/pending-decisions.md`
- 근거: `git diff main --name-only` 출력에 두 파일이 있다. 계획의 「변경 범위」 표는 `tests/orders.test.ts`만 「바꾼다」에 두고 `src/**`·`docs/**`는 「건드리지 않는다」로 적었으며, `notes/**`는 언급이 없다. 검토 의뢰문은 「`tests/orders.test.ts` 외 변경이 없는지 확인」을 요구했다.
- 내용: 두 파일 모두 이 항목을 **「완료(2026-10-16)」**로 표기한다(`backlog-l20.md` L10 `~~P1~~ 완료 2026-10-16`, `pending-decisions.md` L142 `처리 상태: **완료(2026-10-16)**`). 검토·머지 전에 완료로 기록된 상태다.
- 심각도: 권고. 테스트·코드 정합성에는 영향이 없다. 다만 (a) 계획에 없는 파일 변경이고 (b) 머지 전 「완료」 표기는 선행 기록이다. 사람 결정 → 「질문 1」.

### 이탈 아님 — 확인한 항목

| 계획 항목 | 확인 결과 | 근거 |
| --- | --- | --- |
| 느슨한 단언 13곳 교체 | 일치 | `main:tests/orders.test.ts`의 느슨한 상태 코드 줄은 13줄(`not.toBe(201)`·`toBeGreaterThanOrEqual` L83·84·97·111, `not.toBe(200)` L165·351·365·378·466·482·483·495·514). 계획의 「409 본문 4」는 L83·84·97·111의 **줄 수**(테스트는 3개), 「결제 시점 재고 부족 1」은 L165로 읽으면 4+4+4+1=13이 diff와 맞는다. 작업 트리에는 해당 패턴이 0건 (grep) |
| ISO 헬퍼 1개 + 적용 6곳 | 일치 | `expectIso` 1개(L15–20). `main:L188·240·334·423·449·539`의 `typeof … .at` 6줄이 모두 `expectIso(...)`로 교체됨(L199·251·346·438·464·559) |
| 관리자 행 수 1곳 | 일치 | L265 `expect(rows).toHaveLength(orders.size)` 1줄 추가 |
| 테스트 이름·구조 불변 | 일치 | `describe/it` 줄을 `main`과 비교(줄 번호 무시) → 차이 없음. 테스트 수 37개 동일 |
| 헬퍼 시그니처 불변 | 일치 | `createOrder`·`pay`·`refund`·`cancel` 시그니처 동일. 추가된 것은 `expectIso(value: unknown): void` 하나뿐 |
| `src/**`·`docs/**` 무변경 | 일치 | `git diff main --name-only`에 `src/`·`docs/` 없음 |

## 정책 대조

`toEqual`은 필드 집합까지 고정하므로 정책 본문의 `{ … }`와 글자 단위로 대조했다. 상태값은 테스트가 만든 주문 상태와 대조했다.

| # | 테스트 줄 | 단언 값 | 정책 문장 위치 | 일치 |
| --- | --- | --- | --- | --- |
| 1 | L91–92 | `409`, `{ message: 'Insufficient stock', productId: 'monitor' }` (단일 품목 monitor 3 > 재고 2) | `inventory-policy.md` L35 | 일치 |
| 2 | L105–106 | `409`, `productId: 'mouse'` (mouse 6+5=11 > 10, 합산 검사) | `inventory-policy.md` L35, L9(합산) | 일치 |
| 3 | L119–120 | `409`, `productId: 'monitor'` (keyboard 1 ≤ 5 충분, monitor 3 > 2 부족) | `inventory-policy.md` L35, L38 「부족이 발견된 첫 상품」 | 일치 — `src/inventory.ts` L18–26 `findInsufficientProduct`는 `aggregateQuantities`의 `Map` 삽입 순서(= 요청 items 순서: keyboard → monitor)로 순회하며, keyboard는 통과하고 monitor에서 반환한다. 이 테스트에서 부족 상품은 monitor 하나뿐이므로 어느 해석으로도 `monitor`가 맞다 |
| 4 | L175–176 | `409`, `{ message: 'Insufficient stock', productId: 'monitor' }` (결제 시점) | `payment-policy.md` L42, `inventory-policy.md` L36 | 일치. `pending` 유지(L177)·이력 미기록(L179)은 기존 단언이 이미 고정 |
| 5 | L199 | `expectIso(response.body.failure.at)` | `payment-policy.md` L40 `failure: { reason, amountKrw, at }` — **형식(ISO 8601)은 정책 문장에 없음**. 계획은 근거를 「`src/*.ts` 구현과 Lab 17 계획 S1」로 적음. `src/payments.ts` L95 `new Date().toISOString()` | 필드 존재는 일치. 형식은 정책 미기재 → 「과잉 고정 1」 |
| 6 | L251 | `expectIso(row.failure.at)` (관리자) | `order-policy.md` L66 `failure.at` | 위와 같음 |
| 7 | L265 | `rows.toHaveLength(orders.size)` (이 시점 2건) | `order-policy.md` L55 「저장된 주문을 기준으로」, L73 「관리자 목록의 기준은 `orders`에 보존된 주문」 | 일치. `src/admin.ts` L107 `Array.from(orders.values(), …)` |
| 8 | L346 | `expectIso(response.body.refund.at)` | `payment-policy.md` L60 `refund: { amountKrw, at }` | 필드 존재 일치. 형식은 정책 미기재(과잉 고정 1) |
| 9 | L363–364 | `400`, `{ message: 'Order is not refundable', status: 'pending' }` | `payment-policy.md` L61 | 일치 |
| 10 | L378–379 | 같은 본문, `status: 'payment_failed'` | `payment-policy.md` L61 | 일치 |
| 11 | L392–393 | 같은 본문, `status: 'refunded'` (2차 환불) | `payment-policy.md` L61 | 일치 |
| 12 | L438 | `expectIso(refundedRow.refund.at)` (관리자) | `order-policy.md` L92 `refund { amountKrw, at }` | 필드 존재 일치. 형식은 정책 미기재(과잉 고정 1) |
| 13 | L464 | `expectIso(response.body.cancellation.at)` | `order-policy.md` L105 `cancellation: { at }` | 필드 존재 일치. 형식은 정책 미기재(과잉 고정 1) |
| 14 | L481–482 | `400`, `{ message: 'Order is not cancellable', status: 'paid' }` | `order-policy.md` L104 | 일치 |
| 15 | L498–501 | 같은 본문, `status: 'payment_failed'` / `'refunded'` | `order-policy.md` L104 | 일치 |
| 16 | L513–514 | 같은 본문, `status: 'cancelled'` (2차 취소) | `order-policy.md` L104 | 일치 |
| 17 | L533–534 | `400`, `{ message: 'Order is not refundable', status: 'cancelled' }` | `payment-policy.md` L61(`cancelled` 포함), `order-policy.md` L107 | 일치 |
| 18 | L559 | `expectIso(cancelledRow.cancellation.at)` (관리자) | `order-policy.md` L97 `cancellation { at }` | 필드 존재 일치. 형식은 정책 미기재(과잉 고정 1) |

메시지 문자열은 `src/orders.ts` L64, `src/payments.ts` L148, `src/refunds.ts` L32, `src/cancellations.ts` L30과도 글자 단위로 같다. Lab 19 후보 B 점검 ④ 기준 문자열 등장 횟수(grep): `Insufficient stock` 4, `Order is not refundable` 4, `Order is not cancellable` 4.

### ISO 헬퍼 검증 (의뢰 항목 5)

- 정규식 `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`은 `Date.prototype.toISOString`의 출력 형식(연도 0000–9999, 밀리초 3자리, `Z`)과 맞다. 이 세션에서 `node -e`로 확인: 현재 시각 출력에 정규식 통과·왕복 일치, `2026-10-16T12:00:00Z`(밀리초 없음)·`…+09:00`(오프셋)은 정규식 불통과.
- 왕복 검사 `new Date(text).toISOString() === text`는 정규식을 통과하는 비정상 날짜도 거른다: `2026-02-30T…`는 `false`(불일치), `2026-13-45T…`는 `RangeError`를 던진다. 후자는 `expect` 불일치가 아니라 예외로 테스트가 실패하지만, 거부 자체는 올바르다. 정보 사항이며 조치 불필요.
- 연도가 음수이거나 10000 이상인 확장 연도(`+010000-…`)는 정규식이 거부한다. 이 저장소의 시각은 `new Date()`의 현재 시각이므로 해당 없음.

## 느슨한 단언 잔존

의뢰 패턴(`not.toBe(200)`·`not.toBe(201)`·`toBeGreaterThanOrEqual`·`typeof … .at`)은 작업 트리에 **0건**이다(grep). 그 밖에 남아 있는 느슨한 검사와 판정:

| 줄 | 단언 | 정책 확정값 | 판정 |
| --- | --- | --- | --- |
| L198, L250 | `failure` `toMatchObject({ amountKrw, reason: expect.any(String) })` | `payment-policy.md` L40 「`reason`은 안전한 사유 코드(현재 `card_declined`)만 사용」 — 확정값 있음 | **비차단.** 같은 값이 L579–591 테스트 `(b)`에서 응답·관리자 행·이력 모두 `toBe('card_declined')`로 정확 고정돼 있다. 이 두 줄은 중복 느슨 검사일 뿐이며 계획 범위(「다른 단언 건드리지 않음」) 밖. 권고 3에 선택 정리로 기록 |
| L209 | `failed[0].failureReason).toBeDefined()` | 위와 같음 | 비차단, 동일 사유 |
| L345, L437 | `refund` `toMatchObject({ amountKrw })` | `payment-policy.md` L60 `refund: { amountKrw, at }`, `order-policy.md` L92 — 필드 집합 확정 | 비차단. `at`은 `expectIso`가 별도 검사하므로 두 필드 모두 검사되지만, `toMatchObject`는 **추가 필드를 허용**한다. L425 테스트 이름이 「refund amount and time only」인데 「only」는 고정되지 않음. 계획 범위 밖, 권고 3 |
| L421, L543 | 404에서 상태 코드만 검사 | `payment-policy.md` L61·`order-policy.md` L104 「존재하지 않는 주문은 `404`」 — 본문 미확정 | 문제 아님. 정책에 본문 확정값이 없으므로 느슨한 상태가 맞다 |
| L639 | `row?.failure` `toMatchObject({ reason: 'card_declined' })` | 확정값 있음 | 문제 아님. 값은 정확하고, 이 테스트의 목적(실패 이력 1건 유지)에 필요한 범위만 검사 |

## 과잉 고정

### 과잉 고정 1 — 시각 필드의 ISO 8601(UTC·밀리초·`Z`) 형식은 정책 문서에 없다 (권고)

- 대상: `expectIso` 적용 6곳(L199·251·346·438·464·559).
- 근거: `docs/payment-policy.md` L40·L60, `docs/order-policy.md` L66·L92·L97·L105는 모두 `at` 필드의 **존재**만 적고 형식은 적지 않는다. 계획 「정책 근거」 표도 이 행만 정책 문서가 아니라 「`src/*.ts` 구현과 Lab 17 계획 S1」을 근거로 든다.
- 판단: 계획이 이 근거를 명시했고 소유자가 계획을 승인했으므로 이탈은 아니다. 그러나 테스트가 형식을 고정하는 유일한 장소가 되었다. 구현이 예컨대 초 단위 ISO(`…:00Z`)나 오프셋 표기로 바뀌면 정책 위반이 아닌데 테스트만 깨진다. 정책 문서에 한 문장(「시각 필드는 `Date#toISOString()` 형식의 ISO 8601 UTC」) 추가를 권고 — `docs/**` 변경이므로 이 PR 범위 밖, 사람 결정 → 「질문 2」.
- 심각도: 권고.

### 과잉 고정 아님 — 확인한 항목

- L119–120 `productId: 'monitor'`: 부족 상품이 하나뿐이라 「첫 상품」의 순서 해석(요청 순서 vs 합산 순서)을 선점하지 않는다.
- L265 `orders.size`: 리터럴 `2`가 아니라 저장소 크기에 묶었으므로 정책 문장(「저장된 주문 전부」)과 같은 수준의 고정이다.
- 400/409 본문의 `status` 값: 정책이 `"status"`를 「주문 상태」로 명시하므로 테스트가 만든 상태값을 넣는 것은 선점이 아니다.

## 질문

1. **notes 2개 파일의 「완료」 표기 처리.** `notes/backlog-l20.md`·`notes/pending-decisions.md`를 (a) 이 PR에 그대로 포함, (b) 머지 뒤 별도 커밋으로 분리, (c) 문구를 「검토 중」으로 바꾼 뒤 포함 — 중 하나를 결정해 주십시오. 계획 「변경 범위」에 없는 파일이고, 검토 전에 완료로 적힌 상태입니다.
2. **ISO 8601 형식의 정책 기재 여부.** 과잉 고정 1에 따라 `docs/payment-policy.md` 「확정된 응답」·「환불」, `docs/order-policy.md` 「취소 전환의 구현」·「관리자 조회 기준」에 시각 형식 한 문장을 추가할지, 아니면 테스트 고정만으로 충분하다고 볼지 결정이 필요합니다(별도 docs 작업).
3. **「여러 상품이 부족해도 한 상품만 알리며」(`inventory-policy.md` L38 두 번째 문장)의 테스트 부재.** 현재 다품목 테스트(L111–126)는 부족 상품이 하나뿐이어서, 두 상품이 모두 부족할 때 **첫 상품만** 돌려주는 규칙은 어떤 테스트도 고정하지 않습니다. 계획 범위 밖이므로 이 PR의 문제는 아니며, 백로그 등록 여부만 결정해 주십시오.
4. **Lab 19 후보 B 점검 ④ 재실행 기록.** 계획 「검증 계약」은 점검 ④ 재실행을 요구합니다. 문자열 등장 횟수는 제가 grep으로 4/4/4를 확인했지만, implementer가 점검 도구 자체를 돌린 기록은 제 검토 범위에서 찾지 못했습니다(미확인). 기록이 있으면 위치를 알려 주시고, 없으면 머지 전 한 번 돌려 주십시오.

## 확인한 범위

- 읽은 것: 계획 전문, `git diff main`(3개 파일 전체), `tests/orders.test.ts` 작업 트리 전문(L1–692)과 `main` 판의 `describe/it`·`function`·느슨 단언 줄, 정책 3문서 전문, `src/` 7개 파일 전문(`server.ts` 제외).
- 실행한 것: `npm test`(37 통과), `npm run typecheck`(0), `npm run lint`(0), ISO 정규식·왕복 검사 `node -e` 스팟 체크, grep 4종(느슨 단언 패턴·정책 문자열 횟수).
- 확인하지 않은 것: `src/server.ts`(라우터 마운트만 있을 것으로 보이나 읽지 않음), Lab 19 점검 ④ 도구의 실제 실행, Lab 17 계획 S1·S4 원문(계획이 인용한 근거를 재대조하지 않음), `main` 외 다른 브랜치와의 차이.
- 부수 관찰(비발견): 미추적 `.claude/launch.json`이 `.gitignore`에 없다. 이 PR과 무관하므로 커밋에 넣지 않도록만 주의.

## Handoff

- **차단 0건 / 권고 4건**
  - 권고 1: 계획 범위 밖 `notes/` 2개 파일 변경 + 머지 전 「완료」 표기 (계획 이탈 1 → 질문 1)
  - 권고 2: 시각 필드 ISO 8601 형식이 정책 문서에 미기재, 테스트만이 고정점 (과잉 고정 1 → 질문 2)
  - 권고 3: 범위 밖 느슨 단언 잔존 — `reason: expect.any(String)` 2곳·`toBeDefined` 1곳(다른 테스트가 정확 고정, 중복), `refund` `toMatchObject` 2곳(추가 필드 허용, 테스트 이름의 「only」 미고정). 선택 정리
  - 권고 4: 정책 L38 「여러 상품 부족 시 첫 상품만」 시나리오 테스트 부재 (범위 밖, 백로그 후보 → 질문 3)
- **머지 가능 여부: 가능.** `tests/orders.test.ts` 변경은 계획 「변경 범위」와 일치하고, 새 정확값 단언 18개 모두 정책 문장·구현 문자열과 글자 단위로 일치하며, 검증 계약 3종이 통과했다. 단, 질문 1(notes 파일 포함 여부)은 커밋 구성에 영향을 주므로 커밋 전에 답이 필요하다.
