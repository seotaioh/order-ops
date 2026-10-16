export type OrderStatus = 'pending' | 'paid' | 'payment_failed' | 'cancelled' | 'refunded';

/** 관리자에게 제공해도 안전한 결제 실패 사유 코드. 카드 정보·내부 오류를 담지 않는다. */
export type PaymentFailureReason = 'card_declined';

export interface Product {
  id: string;
  name: string;
  priceKrw: number;
  stock: number;
}

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  totalKrw: number;
  status: OrderStatus;
  createdAt: string;
}

export interface PaymentAttempt {
  orderId: string;
  ok: boolean;
  amountKrw: number;
  at: string;
  /** 실패 시도에만 존재한다. 성공 시도에는 붙이지 않는다. */
  failureReason?: PaymentFailureReason;
}

/** 환불 완료 이력. 전액 환불만 지원하므로 금액은 주문 총액과 같다. */
export interface Refund {
  orderId: string;
  amountKrw: number;
  at: string;
}

const seedProducts: Product[] = [
  { id: 'keyboard', name: '키보드', priceKrw: 49_000, stock: 5 },
  { id: 'mouse', name: '마우스', priceKrw: 23_000, stock: 10 },
  { id: 'monitor', name: '모니터', priceKrw: 310_000, stock: 2 },
];

export const products = new Map<string, Product>();
export const orders = new Map<string, Order>();
export const paymentAttempts: PaymentAttempt[] = [];
export const refunds: Refund[] = [];

export function resetStore(): void {
  products.clear();
  orders.clear();
  paymentAttempts.length = 0;
  refunds.length = 0;

  for (const product of seedProducts) {
    products.set(product.id, { ...product });
  }
}

resetStore();
