import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/server.js';
import { cancellations, orders, paymentAttempts, products, refunds, resetStore } from '../src/store.js';

function stockOf(productId: string): number {
  const product = products.get(productId);
  if (!product) {
    throw new Error(`unknown product ${productId}`);
  }
  return product.stock;
}

async function createOrder(items: Array<{ productId: string; quantity: number }>) {
  return request(app).post('/orders').send({ items });
}

async function pay(orderId: string, cardToken: string) {
  return request(app).post(`/orders/${orderId}/pay`).send({ cardToken });
}

async function refund(orderId: string) {
  return request(app).post(`/orders/${orderId}/refund`).send({});
}

async function cancel(orderId: string) {
  return request(app).post(`/orders/${orderId}/cancel`).send({});
}

describe('order operations', () => {
  beforeEach(() => {
    resetStore();
  });

  it('creates an order', async () => {
    const response = await createOrder([{ productId: 'keyboard', quantity: 1 }]);

    expect(response.status).toBe(201);
  });

  it('gets an order', async () => {
    const created = await createOrder([{ productId: 'mouse', quantity: 1 }]);
    const response = await request(app).get(`/orders/${created.body.id as string}`);

    expect(response.status).toBe(200);
  });

  it('returns a payment result', async () => {
    const created = await createOrder([{ productId: 'monitor', quantity: 1 }]);
    const response = await pay(created.body.id as string, 'CARD-123');

    expect(response.body).toHaveProperty('ok');
  });

  it('lists admin orders', async () => {
    const response = await request(app).get('/admin/orders');

    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('inventory policy — order creation', () => {
  beforeEach(() => {
    resetStore();
  });

  it('stores a pending order without changing stock when stock is sufficient', async () => {
    const before = stockOf('keyboard');

    const response = await createOrder([{ productId: 'keyboard', quantity: 2 }]);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending');
    expect(orders.has(response.body.id as string)).toBe(true);
    expect(stockOf('keyboard')).toBe(before);
  });

  it('blocks an order whose quantity exceeds stock without storing it or changing stock', async () => {
    const before = stockOf('monitor');

    const response = await createOrder([{ productId: 'monitor', quantity: before + 1 }]);

    expect(response.status).not.toBe(201);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(orders.size).toBe(0);
    expect(stockOf('monitor')).toBe(before);
  });

  it('aggregates quantities of the same product before checking stock', async () => {
    const before = stockOf('mouse'); // 10

    const response = await createOrder([
      { productId: 'mouse', quantity: 6 },
      { productId: 'mouse', quantity: 5 },
    ]);

    expect(response.status).not.toBe(201);
    expect(orders.size).toBe(0);
    expect(stockOf('mouse')).toBe(before);
  });

  it('does not change any stock when one product of a multi-item order is short', async () => {
    const keyboardBefore = stockOf('keyboard');
    const monitorBefore = stockOf('monitor');

    const response = await createOrder([
      { productId: 'keyboard', quantity: 1 },
      { productId: 'monitor', quantity: monitorBefore + 1 },
    ]);

    expect(response.status).not.toBe(201);
    expect(orders.size).toBe(0);
    expect(stockOf('keyboard')).toBe(keyboardBefore);
    expect(stockOf('monitor')).toBe(monitorBefore);
  });
});

describe('payment success', () => {
  beforeEach(() => {
    resetStore();
  });

  it('deducts stock exactly once and marks the order paid', async () => {
    const before = stockOf('keyboard');
    const created = await createOrder([{ productId: 'keyboard', quantity: 2 }]);
    const orderId = created.body.id as string;

    const response = await pay(orderId, 'CARD-123');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(orders.get(orderId)?.status).toBe('paid');
    expect(stockOf('keyboard')).toBe(before - 2);
    expect(paymentAttempts.filter((a) => a.orderId === orderId && a.ok)).toHaveLength(1);
  });

  it('does not deduct stock again when a paid order is paid a second time', async () => {
    const before = stockOf('keyboard');
    const created = await createOrder([{ productId: 'keyboard', quantity: 2 }]);
    const orderId = created.body.id as string;
    await pay(orderId, 'CARD-123');

    const second = await pay(orderId, 'CARD-456');

    expect(second.status).not.toBe(200);
    expect(orders.get(orderId)?.status).toBe('paid');
    expect(stockOf('keyboard')).toBe(before - 2);
    expect(paymentAttempts.filter((a) => a.orderId === orderId)).toHaveLength(1);
  });

  it('refuses to confirm payment when stock became insufficient after order creation', async () => {
    const created = await createOrder([{ productId: 'monitor', quantity: 2 }]);
    const orderId = created.body.id as string;
    const competitor = await createOrder([{ productId: 'monitor', quantity: 1 }]);
    await pay(competitor.body.id as string, 'CARD-1'); // stock 2 -> 1

    const response = await pay(orderId, 'CARD-2');

    expect(response.status).not.toBe(200);
    expect(orders.get(orderId)?.status).toBe('pending');
    expect(stockOf('monitor')).toBe(1);
    expect(paymentAttempts.filter((a) => a.orderId === orderId)).toHaveLength(0);
  });
});

describe('payment failure', () => {
  beforeEach(() => {
    resetStore();
  });

  it('returns 402 with failure info, preserves the order as payment_failed, and keeps stock', async () => {
    const before = stockOf('keyboard');
    const created = await createOrder([{ productId: 'keyboard', quantity: 1 }]);
    const orderId = created.body.id as string;

    const response = await pay(orderId, 'FAIL-123');

    expect(response.status).toBe(402);
    expect(response.body.ok).toBe(false);
    expect(response.body.status).toBe('payment_failed');
    expect(response.body.failure).toMatchObject({ amountKrw: 49_000, reason: expect.any(String) });
    expect(typeof response.body.failure.at).toBe('string');
    expect(JSON.stringify(response.body)).not.toContain('FAIL-123');

    const fetched = await request(app).get(`/orders/${orderId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.status).toBe('payment_failed');
    expect(stockOf('keyboard')).toBe(before);

    const failed = paymentAttempts.filter((a) => a.orderId === orderId && !a.ok);
    expect(failed).toHaveLength(1);
    expect(failed[0].failureReason).toBeDefined();
  });

  it('rejects re-payment of a payment_failed order without changing status, history, or stock', async () => {
    const before = stockOf('keyboard');
    const created = await createOrder([{ productId: 'keyboard', quantity: 1 }]);
    const orderId = created.body.id as string;
    await pay(orderId, 'FAIL-123');
    const attemptsBefore = paymentAttempts.length;

    const retry = await pay(orderId, 'CARD-999');

    expect(retry.status).not.toBe(200);
    expect(orders.get(orderId)?.status).toBe('payment_failed');
    expect(paymentAttempts.length).toBe(attemptsBefore);
    expect(stockOf('keyboard')).toBe(before);
  });
});

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
    expect(typeof (row?.failure as Record<string, unknown>).at).toBe('string');
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

    expect(pendingRow?.status).toBe('pending');
    expect(paidRow?.status).toBe('paid');
    expect(pendingRow).not.toHaveProperty('failure');
    expect(paidRow).not.toHaveProperty('failure');
    expect(rows.some((o) => o.status === '결제실패')).toBe(false);
  });
});

describe('refund flow', () => {
  beforeEach(() => {
    resetStore();
  });

  async function paidOrder(productId: string, quantity: number): Promise<string> {
    const created = await createOrder([{ productId, quantity }]);
    const orderId = created.body.id as string;
    const paid = await pay(orderId, 'CARD-1');
    expect(paid.status).toBe(200);
    return orderId;
  }

  it('refunds a paid order: status refunded, stock restored once, refund recorded', async () => {
    const before = stockOf('keyboard'); // 5
    const orderId = await paidOrder('keyboard', 2);
    expect(stockOf('keyboard')).toBe(before - 2);

    const response = await refund(orderId);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.order.status).toBe('refunded');
    expect(response.body.refund).toMatchObject({ amountKrw: 98_000 });
    expect(typeof response.body.refund.at).toBe('string');
    expect(orders.get(orderId)?.status).toBe('refunded');
    expect(stockOf('keyboard')).toBe(before);
    expect(refunds.filter((r) => r.orderId === orderId)).toHaveLength(1);

    const fetched = await request(app).get(`/orders/${orderId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.status).toBe('refunded');
  });

  it('rejects refund of a pending order without changing anything', async () => {
    const created = await createOrder([{ productId: 'mouse', quantity: 1 }]);
    const orderId = created.body.id as string;
    const before = stockOf('mouse');

    const response = await refund(orderId);

    expect(response.status).not.toBe(200);
    expect(orders.get(orderId)?.status).toBe('pending');
    expect(stockOf('mouse')).toBe(before);
    expect(refunds).toHaveLength(0);
  });

  it('rejects refund of a payment_failed order without changing anything', async () => {
    const created = await createOrder([{ productId: 'mouse', quantity: 1 }]);
    const orderId = created.body.id as string;
    await pay(orderId, 'FAIL-1');
    const before = stockOf('mouse');

    const response = await refund(orderId);

    expect(response.status).not.toBe(200);
    expect(orders.get(orderId)?.status).toBe('payment_failed');
    expect(stockOf('mouse')).toBe(before);
    expect(refunds).toHaveLength(0);
  });

  it('does not refund or restore stock twice for the same order', async () => {
    const before = stockOf('monitor'); // 2
    const orderId = await paidOrder('monitor', 1);
    await refund(orderId);

    const second = await refund(orderId);

    expect(second.status).not.toBe(200);
    expect(orders.get(orderId)?.status).toBe('refunded');
    expect(stockOf('monitor')).toBe(before);
    expect(refunds.filter((r) => r.orderId === orderId)).toHaveLength(1);
  });

  it('does not allow paying a refunded order again', async () => {
    const orderId = await paidOrder('keyboard', 1);
    await refund(orderId);
    const before = stockOf('keyboard');
    const attemptsBefore = paymentAttempts.length;

    const response = await pay(orderId, 'CARD-2');

    expect(response.status).not.toBe(200);
    expect(orders.get(orderId)?.status).toBe('refunded');
    expect(stockOf('keyboard')).toBe(before);
    expect(paymentAttempts.length).toBe(attemptsBefore);
  });

  it('returns 404 when refunding an unknown order', async () => {
    const response = await refund('no-such-order');

    expect(response.status).toBe(404);
  });

  it('shows refunded orders in the admin list with refund amount and time only', async () => {
    const refundedId = await paidOrder('keyboard', 1);
    await refund(refundedId);
    const paidId = await paidOrder('mouse', 1);

    const response = await request(app).get('/admin/orders');
    const rows = response.body as Array<Record<string, unknown>>;
    const refundedRow = rows.find((o) => o.id === refundedId);
    const paidRow = rows.find((o) => o.id === paidId);

    expect(response.status).toBe(200);
    expect(refundedRow?.status).toBe('refunded');
    expect(refundedRow?.refund).toMatchObject({ amountKrw: 49_000 });
    expect(typeof (refundedRow?.refund as Record<string, unknown>).at).toBe('string');
    expect(refundedRow).not.toHaveProperty('failure');
    expect(paidRow).not.toHaveProperty('refund');
  });
});

describe('cancel flow', () => {
  beforeEach(() => {
    resetStore();
  });

  async function pendingOrder(productId: string, quantity: number): Promise<string> {
    const created = await createOrder([{ productId, quantity }]);
    expect(created.status).toBe(201);
    return created.body.id as string;
  }

  it('cancels a pending order without touching stock and records the cancellation', async () => {
    const before = stockOf('keyboard');
    const orderId = await pendingOrder('keyboard', 2);

    const response = await cancel(orderId);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.order.status).toBe('cancelled');
    expect(typeof response.body.cancellation.at).toBe('string');
    expect(orders.get(orderId)?.status).toBe('cancelled');
    expect(stockOf('keyboard')).toBe(before);
    expect(cancellations.filter((c) => c.orderId === orderId)).toHaveLength(1);

    const fetched = await request(app).get(`/orders/${orderId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.status).toBe('cancelled');
  });

  it('rejects cancelling a paid order (policy forbids paid → cancelled)', async () => {
    const orderId = await pendingOrder('keyboard', 1);
    await pay(orderId, 'CARD-1');
    const before = stockOf('keyboard');

    const response = await cancel(orderId);

    expect(response.status).not.toBe(200);
    expect(orders.get(orderId)?.status).toBe('paid');
    expect(stockOf('keyboard')).toBe(before);
    expect(cancellations).toHaveLength(0);
  });

  it('rejects cancelling payment_failed and refunded orders', async () => {
    const failedId = await pendingOrder('mouse', 1);
    await pay(failedId, 'FAIL-1');
    const refundedId = await pendingOrder('mouse', 1);
    await pay(refundedId, 'CARD-1');
    await refund(refundedId);

    const failedResponse = await cancel(failedId);
    const refundedResponse = await cancel(refundedId);

    expect(failedResponse.status).not.toBe(200);
    expect(refundedResponse.status).not.toBe(200);
    expect(orders.get(failedId)?.status).toBe('payment_failed');
    expect(orders.get(refundedId)?.status).toBe('refunded');
    expect(cancellations).toHaveLength(0);
  });

  it('does not cancel the same order twice', async () => {
    const orderId = await pendingOrder('mouse', 1);
    await cancel(orderId);

    const second = await cancel(orderId);

    expect(second.status).not.toBe(200);
    expect(cancellations.filter((c) => c.orderId === orderId)).toHaveLength(1);
  });

  it('does not allow paying or refunding a cancelled order', async () => {
    const orderId = await pendingOrder('monitor', 1);
    await cancel(orderId);
    const before = stockOf('monitor');

    const payResponse = await pay(orderId, 'CARD-1');
    const refundResponse = await refund(orderId);

    expect(payResponse.status).not.toBe(200);
    expect(refundResponse.status).not.toBe(200);
    expect(orders.get(orderId)?.status).toBe('cancelled');
    expect(stockOf('monitor')).toBe(before);
    expect(paymentAttempts).toHaveLength(0);
    expect(refunds).toHaveLength(0);
  });

  it('returns 404 when cancelling an unknown order', async () => {
    const response = await cancel('no-such-order');

    expect(response.status).toBe(404);
  });

  it('shows cancelled orders in the admin list with the cancellation time only', async () => {
    const cancelledId = await pendingOrder('keyboard', 1);
    await cancel(cancelledId);
    const pendingId = await pendingOrder('mouse', 1);

    const response = await request(app).get('/admin/orders');
    const rows = response.body as Array<Record<string, unknown>>;
    const cancelledRow = rows.find((o) => o.id === cancelledId);
    const pendingRow = rows.find((o) => o.id === pendingId);

    expect(response.status).toBe(200);
    expect(cancelledRow?.status).toBe('cancelled');
    expect(typeof (cancelledRow?.cancellation as Record<string, unknown>).at).toBe('string');
    expect(cancelledRow).not.toHaveProperty('failure');
    expect(cancelledRow).not.toHaveProperty('refund');
    expect(pendingRow).not.toHaveProperty('cancellation');
  });
});

describe('review follow-ups (Lab 17 reviewer findings)', () => {
  beforeEach(() => {
    resetStore();
  });

  const OK_TOKEN = 'CARD-SECRET-OK-9f1c';
  const FAIL_TOKEN = 'FAIL-SECRET-TOKEN-7f3a';

  function containsToken(value: unknown): boolean {
    const text = JSON.stringify(value);
    return text.includes(OK_TOKEN) || text.includes(FAIL_TOKEN) || text.includes('"cardToken"');
  }

  it('(b) reports the failure reason as the approved safe code card_declined', async () => {
    const created = await createOrder([{ productId: 'keyboard', quantity: 1 }]);
    const orderId = created.body.id as string;

    const response = await pay(orderId, FAIL_TOKEN);
    const admin = await request(app).get('/admin/orders');
    const row = (admin.body as Array<Record<string, unknown>>).find((o) => o.id === orderId);

    expect(response.status).toBe(402);
    expect(response.body.failure.reason).toBe('card_declined');
    expect((row?.failure as Record<string, unknown>).reason).toBe('card_declined');
    expect(paymentAttempts.find((a) => a.orderId === orderId)?.failureReason).toBe('card_declined');
  });

  it('(c) never exposes card tokens or a cardToken key in any response', async () => {
    const paidOrder = await createOrder([{ productId: 'mouse', quantity: 1 }]);
    const paidId = paidOrder.body.id as string;
    const failedOrder = await createOrder([{ productId: 'keyboard', quantity: 1 }]);
    const failedId = failedOrder.body.id as string;
    const pendingOrder = await createOrder([{ productId: 'monitor', quantity: 1 }]);

    const paySuccess = await pay(paidId, OK_TOKEN);
    const payFailure = await pay(failedId, FAIL_TOKEN);
    const getPaid = await request(app).get(`/orders/${paidId}`);
    const getFailed = await request(app).get(`/orders/${failedId}`);
    const getPending = await request(app).get(`/orders/${pendingOrder.body.id as string}`);
    const admin = await request(app).get('/admin/orders');

    expect(paySuccess.status).toBe(200);
    expect(payFailure.status).toBe(402);
    for (const response of [paySuccess, payFailure, getPaid, getFailed, getPending, admin]) {
      expect(containsToken(response.body)).toBe(false);
    }
    expect(containsToken(Array.from(orders.values()))).toBe(false);
    expect(containsToken(paymentAttempts)).toBe(false);
  });

  it('(d) rejects a second FAIL attempt on a payment_failed order and keeps exactly one failure record', async () => {
    const created = await createOrder([{ productId: 'keyboard', quantity: 1 }]);
    const orderId = created.body.id as string;
    await pay(orderId, FAIL_TOKEN);
    const before = stockOf('keyboard');

    const retry = await pay(orderId, 'FAIL-AGAIN-2b8d');
    const admin = await request(app).get('/admin/orders');
    const row = (admin.body as Array<Record<string, unknown>>).find((o) => o.id === orderId);

    expect(retry.status).toBe(400);
    expect(retry.body).toEqual({ message: 'Order is not payable' });
    expect(orders.get(orderId)?.status).toBe('payment_failed');
    expect(paymentAttempts.filter((a) => a.orderId === orderId && !a.ok)).toHaveLength(1);
    expect(stockOf('keyboard')).toBe(before);
    expect(admin.status).toBe(200);
    expect(row?.failure).toMatchObject({ reason: 'card_declined' });
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
