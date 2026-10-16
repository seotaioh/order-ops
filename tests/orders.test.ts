import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/server.js';
import { orders, paymentAttempts, products, resetStore } from '../src/store.js';

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
