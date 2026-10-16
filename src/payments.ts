import { Router } from 'express';
import type { Request, Response } from 'express';
import { deductStock, findInsufficientProduct } from './inventory.js';
import {
  orders,
  paymentAttempts,
  type Order,
  type PaymentAttempt,
  type PaymentFailureReason,
} from './store.js';

interface PaymentBody {
  cardToken?: string;
}

interface ParsedCardToken {
  shouldFail: boolean;
}

/** 외부 응답에 그대로 내보내도 되는 실패 정보. 카드 토큰·내부 오류는 포함하지 않는다. */
interface PaymentFailureInfo {
  reason: PaymentFailureReason;
  amountKrw: number;
  at: string;
}

function parseCardToken(value: unknown): ParsedCardToken | null {
  if (typeof value !== 'string') {
    return null;
  }

  const cardToken = value.trim();
  if (cardToken.length === 0) {
    return null;
  }

  return { shouldFail: cardToken.startsWith('FAIL') };
}

/** 주문 상태 정책: 결제는 pending 주문에만 허용한다. payment_failed 주문의 재결제는 여기서 거부된다. */
function isPayable(order: Order): boolean {
  return order.status === 'pending' && order.totalKrw > 0;
}

function recordSuccess(order: Order): PaymentAttempt {
  const attempt: PaymentAttempt = {
    orderId: order.id,
    ok: true,
    amountKrw: order.totalKrw,
    at: new Date().toISOString(),
  };
  paymentAttempts.push(attempt);
  return attempt;
}

function recordFailure(order: Order, failureReason: PaymentFailureReason): PaymentAttempt {
  const attempt: PaymentAttempt = {
    orderId: order.id,
    ok: false,
    amountKrw: order.totalKrw,
    at: new Date().toISOString(),
    failureReason,
  };
  paymentAttempts.push(attempt);
  return attempt;
}

function toFailureInfo(attempt: PaymentAttempt): PaymentFailureInfo {
  if (attempt.ok || !attempt.failureReason) {
    throw new Error('Not a failed payment attempt');
  }
  return { reason: attempt.failureReason, amountKrw: attempt.amountKrw, at: attempt.at };
}

export const paymentsRouter = Router();

paymentsRouter.post(
  '/:id/pay',
  (req: Request<{ id: string }, unknown, PaymentBody>, res: Response) => {
    const order = orders.get(req.params.id);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    if (!isPayable(order)) {
      res.status(400).json({ message: 'Order is not payable' });
      return;
    }

    const card = parseCardToken(req.body.cardToken);
    if (!card) {
      res.status(400).json({ message: 'Invalid card token' });
      return;
    }

    if (card.shouldFail) {
      // 결제 정책: 주문을 삭제하지 않고 payment_failed로 보존, 실패 이력 기록, 402 반환. 재고는 건드리지 않는다.
      const attempt = recordFailure(order, 'card_declined');
      order.status = 'payment_failed';
      res.status(402).json({
        ok: false,
        orderId: order.id,
        status: order.status,
        failure: toFailureInfo(attempt),
      });
      return;
    }

    // 재고 정책: 결제 성공 확정 직전에 전체 품목 재고를 다시 검사한다.
    // 결제 시점 재고 부족의 상태·응답은 정책 보류 항목이라 주문 상태와 이력을 바꾸지 않고 409로만 거절한다.
    const insufficient = findInsufficientProduct(order.items);
    if (insufficient !== null) {
      res.status(409).json({ message: 'Insufficient stock', productId: insufficient });
      return;
    }

    deductStock(order.items);
    order.status = 'paid';
    recordSuccess(order);
    res.json({ ok: true, order });
  },
);
