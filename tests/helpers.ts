import request from 'supertest';
import { expect } from 'vitest';
import { app } from '../src/server.js';
import { products } from '../src/store.js';

/**
 * tests/orders.test.ts · tests/payments.test.ts · tests/admin.test.ts가 공유하는 헬퍼.
 * Lab 14 파일 분리(2026-10-17) 때 tests/orders.test.ts에서 그대로 옮겼다.
 * vitest는 *.test.ts만 실행하므로 이 파일은 테스트로 수집되지 않는다.
 */

export function stockOf(productId: string): number {
  const product = products.get(productId);
  if (!product) {
    throw new Error(`unknown product ${productId}`);
  }
  return product.stock;
}

/** 정책 확정 응답의 시각 필드는 ISO 8601(UTC, 밀리초)이어야 한다. */
export function expectIso(value: unknown): void {
  expect(typeof value).toBe('string');
  const text = value as string;
  expect(text).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(new Date(text).toISOString()).toBe(text);
}

export async function createOrder(items: Array<{ productId: string; quantity: number }>) {
  return request(app).post('/orders').send({ items });
}

export async function pay(orderId: string, cardToken: string) {
  return request(app).post(`/orders/${orderId}/pay`).send({ cardToken });
}

export async function refund(orderId: string) {
  return request(app).post(`/orders/${orderId}/refund`).send({});
}

export async function cancel(orderId: string) {
  return request(app).post(`/orders/${orderId}/cancel`).send({});
}

/** Lab 17 reviewer 후속 (b)(c)(d)·(a)가 쓰는 식별 가능한 토큰. 어떤 응답·저장소에도 나타나면 안 된다. */
export const OK_TOKEN = 'CARD-SECRET-OK-9f1c';
export const FAIL_TOKEN = 'FAIL-SECRET-TOKEN-7f3a';

export function containsToken(value: unknown): boolean {
  const text = JSON.stringify(value);
  return text.includes(OK_TOKEN) || text.includes(FAIL_TOKEN) || text.includes('"cardToken"');
}
