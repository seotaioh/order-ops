import { products, type OrderItem } from './store.js';

/**
 * 재고 정책(docs/inventory-policy.md)의 공통 구현.
 * - 같은 productId의 수량을 합산해 검사한다.
 * - 검사·차감·복원은 주문 전체 기준이며, 일부 품목만 바꾸지 않는다.
 */

export function aggregateQuantities(items: OrderItem[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
  }
  return totals;
}

/** 재고가 부족한 첫 상품 ID를 돌려준다. 모두 충분하면 null. 알 수 없는 상품은 부족으로 본다. */
export function findInsufficientProduct(items: OrderItem[]): string | null {
  for (const [productId, quantity] of aggregateQuantities(items)) {
    const product = products.get(productId);
    if (!product || product.stock < quantity) {
      return productId;
    }
  }
  return null;
}

/**
 * 주문 수량만큼 재고를 한 번 차감한다.
 * 호출 직전에 findInsufficientProduct()가 null임을 확인해야 하며,
 * 그 전제가 깨지면 일부만 차감하지 않도록 아무것도 바꾸지 않고 예외를 던진다.
 */
export function deductStock(items: OrderItem[]): void {
  const insufficient = findInsufficientProduct(items);
  if (insufficient !== null) {
    throw new Error(`Cannot deduct stock: insufficient product ${insufficient}`);
  }
  for (const [productId, quantity] of aggregateQuantities(items)) {
    const product = products.get(productId);
    if (!product) {
      throw new Error(`Cannot deduct stock: unknown product ${productId}`);
    }
    product.stock -= quantity;
  }
}

/**
 * 환불 완료 시 결제 성공 때 차감한 수량을 한 번 복원한다.
 * 모든 상품이 존재할 때만 실행하며, 하나라도 없으면 아무것도 바꾸지 않고 예외를 던진다.
 */
export function restoreStock(items: OrderItem[]): void {
  const totals = aggregateQuantities(items);
  for (const productId of totals.keys()) {
    if (!products.has(productId)) {
      throw new Error(`Cannot restore stock: unknown product ${productId}`);
    }
  }
  for (const [productId, quantity] of totals) {
    const product = products.get(productId);
    if (product) {
      product.stock += quantity;
    }
  }
}
