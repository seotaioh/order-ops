import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/server.js';
import { cancellations, orders, paymentAttempts, refunds, resetStore } from '../src/store.js';
import { cancel, createOrder, expectIso, pay, refund, stockOf } from './helpers.js';

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

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'Insufficient stock', productId: 'monitor' });
    expect(orders.size).toBe(0);
    expect(stockOf('monitor')).toBe(before);
  });

  it('aggregates quantities of the same product before checking stock', async () => {
    const before = stockOf('mouse'); // 10

    const response = await createOrder([
      { productId: 'mouse', quantity: 6 },
      { productId: 'mouse', quantity: 5 },
    ]);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'Insufficient stock', productId: 'mouse' });
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

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'Insufficient stock', productId: 'monitor' });
    expect(orders.size).toBe(0);
    expect(stockOf('keyboard')).toBe(keyboardBefore);
    expect(stockOf('monitor')).toBe(monitorBefore);
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
    expect(response.body.refund).toEqual({ amountKrw: 98_000, at: expect.any(String) });
    expectIso(response.body.refund.at);
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

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Order is not refundable', status: 'pending' });
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

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Order is not refundable', status: 'payment_failed' });
    expect(orders.get(orderId)?.status).toBe('payment_failed');
    expect(stockOf('mouse')).toBe(before);
    expect(refunds).toHaveLength(0);
  });

  it('does not refund or restore stock twice for the same order', async () => {
    const before = stockOf('monitor'); // 2
    const orderId = await paidOrder('monitor', 1);
    await refund(orderId);

    const second = await refund(orderId);

    expect(second.status).toBe(400);
    expect(second.body).toEqual({ message: 'Order is not refundable', status: 'refunded' });
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

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: 'Order is not payable',
      status: 'refunded',
      reason: 'order_refunded',
      nextAction: 'create_new_order',
    });
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
    expect(refundedRow?.refund).toEqual({ amountKrw: 49_000, at: expect.any(String) });
    expectIso((refundedRow?.refund as Record<string, unknown>).at);
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
    expectIso(response.body.cancellation.at);
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

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Order is not cancellable', status: 'paid' });
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

    expect(failedResponse.status).toBe(400);
    expect(failedResponse.body).toEqual({ message: 'Order is not cancellable', status: 'payment_failed' });
    expect(refundedResponse.status).toBe(400);
    expect(refundedResponse.body).toEqual({ message: 'Order is not cancellable', status: 'refunded' });
    expect(orders.get(failedId)?.status).toBe('payment_failed');
    expect(orders.get(refundedId)?.status).toBe('refunded');
    expect(cancellations).toHaveLength(0);
  });

  it('does not cancel the same order twice', async () => {
    const orderId = await pendingOrder('mouse', 1);
    await cancel(orderId);

    const second = await cancel(orderId);

    expect(second.status).toBe(400);
    expect(second.body).toEqual({ message: 'Order is not cancellable', status: 'cancelled' });
    expect(cancellations.filter((c) => c.orderId === orderId)).toHaveLength(1);
  });

  it('does not allow paying or refunding a cancelled order', async () => {
    const orderId = await pendingOrder('monitor', 1);
    await cancel(orderId);
    const before = stockOf('monitor');

    const payResponse = await pay(orderId, 'CARD-1');
    const refundResponse = await refund(orderId);

    expect(payResponse.status).toBe(400);
    expect(payResponse.body).toEqual({
      message: 'Order is not payable',
      status: 'cancelled',
      reason: 'order_cancelled',
      nextAction: 'create_new_order',
    });
    expect(refundResponse.status).toBe(400);
    expect(refundResponse.body).toEqual({ message: 'Order is not refundable', status: 'cancelled' });
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
    expectIso((cancelledRow?.cancellation as Record<string, unknown>).at);
    expect(cancelledRow).not.toHaveProperty('failure');
    expect(cancelledRow).not.toHaveProperty('refund');
    expect(pendingRow).not.toHaveProperty('cancellation');
  });
});
