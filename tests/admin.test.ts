import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/server.js';
import { orders, paymentAttempts, resetStore } from '../src/store.js';
import { FAIL_TOKEN, createOrder, expectIso, pay, stockOf } from './helpers.js';

describe('admin order list', () => {
  beforeEach(() => {
    resetStore();
  });

  it('shows a payment_failed order with failure amount, time, and reason', async () => {
    const created = await createOrder([{ productId: 'mouse', quantity: 2 }]);
    const orderId = created.body.id as string;
    await pay(orderId, 'FAIL-1');

    const response = await request(app).get('/admin/orders');

    expect(response.status).toBe(200);
    const row = (response.body as Array<Record<string, unknown>>).find((o) => o.id === orderId);
    expect(row).toBeDefined();
    expect(row?.status).toBe('payment_failed');
    expect(row?.failure).toMatchObject({ amountKrw: 46_000, reason: expect.any(String) });
    expectIso((row?.failure as Record<string, unknown>).at);
    expect(JSON.stringify(row)).not.toContain('FAIL-1');
  });

  it('uses the stored status for other orders and attaches no failure info to them', async () => {
    const pendingOrder = await createOrder([{ productId: 'mouse', quantity: 1 }]);
    const paidOrder = await createOrder([{ productId: 'keyboard', quantity: 1 }]);
    await pay(paidOrder.body.id as string, 'CARD-1');

    const response = await request(app).get('/admin/orders');
    const rows = response.body as Array<Record<string, unknown>>;
    const pendingRow = rows.find((o) => o.id === pendingOrder.body.id);
    const paidRow = rows.find((o) => o.id === paidOrder.body.id);

    expect(rows).toHaveLength(orders.size); // 저장된 주문 전부가 관리자 목록의 기준
    expect(pendingRow?.status).toBe('pending');
    expect(paidRow?.status).toBe('paid');
    expect(pendingRow).not.toHaveProperty('failure');
    expect(paidRow).not.toHaveProperty('failure');
    expect(rows.some((o) => o.status === '결제실패')).toBe(false);
  });

  it('keeps a paid order displayed as paid when a failure record also exists for it (Lab 20 regression)', async () => {
    const before = stockOf('keyboard');
    const created = await createOrder([{ productId: 'keyboard', quantity: 1 }]);
    const orderId = created.body.id as string;
    const paid = await pay(orderId, 'CARD-1');
    expect(paid.status).toBe(200);

    // 이 fork는 같은 주문의 재결제를 거부하므로(`isPayable`: pending만 허용,
    // `docs/payment-policy.md` 「동일 주문 재결제 정책의 승격」) 「실패 뒤 성공」 이력은 API로 만들 수 없다.
    // `notes/incident-l20.md` 로그 2 환경(`payment_attempts=2 failed_attempts=1 order_status=paid`)을
    // 재현하기 위해 저장소에 직접 넣는다. 이 테스트는 관리자 표시가 저장 상태(`paid`)를 그대로 쓰고
    // 실패 이력 존재로 파생하지 않음을 고정한다.
    paymentAttempts.unshift({
      orderId,
      ok: false,
      amountKrw: 49_000,
      at: new Date(Date.now() - 60_000).toISOString(), // 성공보다 앞선 시각
      failureReason: 'card_declined',
    });

    const admin = await request(app).get('/admin/orders');
    const fetched = await request(app).get(`/orders/${orderId}`);

    // A1: 불일치 500이 아니어야 한다 — paid 주문은 findFailure()를 타지 않는다.
    expect(admin.status).toBe(200);
    // A2: 관리자 행 status는 저장 상태 paid 그대로
    const row = (admin.body as Array<Record<string, unknown>>).find((o) => o.id === orderId);
    expect(row).toBeDefined();
    expect(row?.status).toBe('paid');
    // A3: paid 행에는 failure 키가 없다
    expect(row).not.toHaveProperty('failure');
    // A4: 단건 조회도 paid
    expect(fetched.status).toBe(200);
    expect(fetched.body.status).toBe('paid');
    // 보조: 저장 상태 자체가 paid
    expect(orders.get(orderId)?.status).toBe('paid');
    // A5: 실패·성공 이력 둘 다 보존
    const own = paymentAttempts.filter((a) => a.orderId === orderId);
    expect(own).toHaveLength(2);
    expect(own.filter((a) => !a.ok)).toHaveLength(1);
    expect(own.filter((a) => a.ok)).toHaveLength(1);
    // A6: 응답 어디에도 '결제실패' 없음
    expect(JSON.stringify(admin.body)).not.toContain('결제실패');
    expect(JSON.stringify(fetched.body)).not.toContain('결제실패');
    // A7: 재고는 결제 때 차감된 값 유지
    expect(stockOf('keyboard')).toBe(before - 1);
  });
});

describe('review follow-ups (Lab 17 reviewer findings)', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('(a) admin list reports inconsistent failure records with 500 and no internals', () => {
    async function failedOrder(): Promise<string> {
      const created = await createOrder([{ productId: 'keyboard', quantity: 1 }]);
      const orderId = created.body.id as string;
      const response = await pay(orderId, FAIL_TOKEN);
      expect(response.status).toBe(402);
      return orderId;
    }

    function expectInconsistent(response: request.Response, orderId: string): void {
      expect(response.status).toBe(500);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toEqual({ message: 'Inconsistent payment failure record', orderId });
      const text = JSON.stringify(response.body);
      expect(text).not.toContain('Error');
      expect(text).not.toContain('at ');
      expect(text).not.toContain('failed attempts');
    }

    it('when a payment_failed order has no failure record', async () => {
      const orderId = await failedOrder();
      paymentAttempts.splice(0, paymentAttempts.length);

      expectInconsistent(await request(app).get('/admin/orders'), orderId);
    });

    it('when a payment_failed order has two failure records', async () => {
      const orderId = await failedOrder();
      const [first] = paymentAttempts.filter((a) => a.orderId === orderId);
      paymentAttempts.push({ ...first, at: new Date().toISOString() });

      expectInconsistent(await request(app).get('/admin/orders'), orderId);
    });

    it('when the failure record has no reason', async () => {
      const orderId = await failedOrder();
      const attempt = paymentAttempts.find((a) => a.orderId === orderId);
      if (!attempt) {
        throw new Error('expected a failure record');
      }
      delete attempt.failureReason;

      expectInconsistent(await request(app).get('/admin/orders'), orderId);
    });

    it('does not report 500 when records are consistent', async () => {
      await failedOrder();

      const response = await request(app).get('/admin/orders');

      expect(response.status).toBe(200);
    });
  });
});
