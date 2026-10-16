## Project Overview

이 저장소는 주문 생성·결제·재고·관리자 조회가 연결된 작은 TypeScript API를 바탕으로 개발 워크플로를 연습하는 실습용 코드베이스다.
애플리케이션은 Express와 TypeScript로 구성되며, 개발 실행에는 tsx를 사용하고 Vitest·Supertest·ESLint·TypeScript로 검증을 지원한다.
상품과 주문은 프로세스 내 Map에, 결제 시도 기록은 배열에 저장되므로 서버를 다시 시작하면 해당 데이터는 사라진다.

## Before Editing

- `labs/CONVENTIONS.md`를 읽어 작업 산출물의 위치 규칙을 확인한다.
- `README.md`와 `src/server.ts`를 확인한 뒤, 요청과 연결된 기능 모듈·`src/store.ts`·관련 테스트를 따라 현재 동작과 검증 범위를 확인한다.
- 관련 자료와 현재 동작을 확인한 뒤, 코드 수정 전에 변경 범위·검증·미결정 사항을 담은 계획을 작성한다.

### Policy Routing

| 변경 유형 | 편집 전에 읽을 정책 |
| --- | --- |
| 주문 상태의 의미·전환, 취소·환불 상태 변경 | `docs/order-policy.md` |
| 결제 성공·실패 판정, 결제 응답·이력·재시도 | `docs/payment-policy.md`; 주문 상태도 바뀌면 `docs/order-policy.md`도 함께 읽음 |
| 재고 검사·차감·복원·부족 차단 | `docs/inventory-policy.md`; 결제 흐름에서 발생하면 `docs/payment-policy.md`와 `docs/order-policy.md`도 함께 읽음 |
| 관리자 주문 목록의 필드·표시 조건·노출 제외 정보 | `docs/order-policy.md`의 관리자 조회 기준; 결제 실패 정보의 생성·범위가 바뀌면 `docs/payment-policy.md`도 함께 읽음 |

필요한 정책 문서나 적용 기준이 없거나, 관련 정책끼리 같은 사건에 다른 상태·결제 결과·재고 결과·관리자 표시를 요구하거나, 요청한 동작이 정책에서 보류되어 있으면 편집 전에 멈춘다. 누락·충돌·보류 지점과 필요한 결정을 밝히고 사람의 확인을 받은 뒤에만 편집한다.

### Prompts and Templates

| 상황 | 쓰는 문서 |
| --- | --- |
| 계획 작성 | `docs/templates/implementation-plan.md` 골격, 역할은 `docs/prompts/planner.md` |
| 테스트 추가·보강 | `docs/prompts/test-generation.md` |
| 구현·리뷰 역할 분리 | `docs/prompts/implementer.md`, `docs/prompts/reviewer.md` |
| 자기 검토(PR 전) | `docs/prompts/self-review.md`, 체크리스트 `docs/checklists/pr-preflight.md`, 환각 점검 `docs/checklists/hallucination-guard.md` |
| PR 설명 | `docs/prompts/pr-description.md`, 템플릿 `.github/pull_request_template.md` |
| Issue에서 시작 | `docs/prompts/issue-kickoff.md`, 템플릿 `.github/ISSUE_TEMPLATE/workflow-task.md` |

## Commands

- `npm run dev` — 개발 서버를 실행한다.
- `npm start` — 애플리케이션을 실행한다.
- `npm test` — 테스트를 실행한다.
- `npm run lint` — 정적 검사를 실행한다.
- `npm run typecheck` — 타입 검사를 실행한다.

## Rules

- 확인되지 않았거나 사람의 승인이 필요한 정책을 임의로 확정하지 않는다. 확인되지 않은 가정이 제품 동작과 작업 범위를 바꿀 수 있기 때문이다.
- 오류·누락된 입력·미결정 사항을 숨기는 silent fallback을 추가하지 않는다. 실패 원인과 필요한 결정을 추적할 수 없게 되기 때문이다.
- 해당 동작을 검증하는 테스트 없이 상태를 변경하지 않는다. 주문·재고·결제 기록의 회귀를 발견하지 못할 수 있기 때문이다.
- 실제 결제 제공자나 실거래 결제 연동을 추가하거나 호출하지 않는다. 이 저장소는 교육용 API이며 의도치 않은 금전적 부작용을 낳을 수 있기 때문이다.

## Before Final Response

- 변경 내용과 완료 조건에 맞는 검증을 실행하고, 최종 보고에 실행한 명령과 각 명령의 성공·실패 결과를 남긴다.
- 실행하지 못한 검증은 통과했다고 말하지 않고, 미실행 사유와 필요한 후속 검증을 최종 보고에 명시한다.
- 검증 후에도 남은 위험, 확인하지 못한 범위, 사람의 결정이 필요한 미결 사항을 최종 보고에 명시한다.
