import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/server.js';
import { orders, paymentAttempts, resetStore } from '../src/store.js';
import { FAIL_TOKEN, OK_TOKEN, containsToken, createOrder, expectIso, pay, stockOf } from './helpers.js';

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

    expect(second.status).toBe(400);
    expect(second.body).toEqual({
      message: 'Order is not payable',
      status: 'paid',
      reason: 'already_paid',
      nextAction: 'none',
    });
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

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'Insufficient stock', productId: 'monitor' });
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
    expectIso(response.body.failure.at);
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

    expect(retry.status).toBe(400);
    expect(retry.body).toEqual({
      message: 'Order is not payable',
      status: 'payment_failed',
      reason: 'repayment_not_allowed',
      nextAction: 'create_new_order',
    });
    expect(orders.get(orderId)?.status).toBe('payment_failed');
    expect(paymentAttempts.length).toBe(attemptsBefore);
    expect(stockOf('keyboard')).toBe(before);
  });
});

describe('review follow-ups (Lab 17 reviewer findings)', () => {
  beforeEach(() => {
    resetStore();
  });

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
    const payRejected = await pay(failedId, OK_TOKEN); // 400 거부 응답(Issue #6)도 검사 대상
    const getPaid = await request(app).get(`/orders/${paidId}`);
    const getFailed = await request(app).get(`/orders/${failedId}`);
    const getPending = await request(app).get(`/orders/${pendingOrder.body.id as string}`);
    const admin = await request(app).get('/admin/orders');

    expect(paySuccess.status).toBe(200);
    expect(payFailure.status).toBe(402);
    expect(payRejected.status).toBe(400);
    for (const response of [paySuccess, payFailure, payRejected, getPaid, getFailed, getPending, admin]) {
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
    expect(retry.body).toEqual({
      message: 'Order is not payable',
      status: 'payment_failed',
      reason: 'repayment_not_allowed',
      nextAction: 'create_new_order',
    });
    expect(orders.get(orderId)?.status).toBe('payment_failed');
    expect(paymentAttempts.filter((a) => a.orderId === orderId && !a.ok)).toHaveLength(1);
    expect(stockOf('keyboard')).toBe(before);
    expect(admin.status).toBe(200);
    expect(row?.failure).toMatchObject({ reason: 'card_declined' });
  });
});
