import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  orders,
  paymentAttempts,
  type Order,
  type OrderStatus,
  type PaymentFailureReason,
} from './store.js';

interface AdminPaymentFailure {
  amountKrw: number;
  at: string;
  reason: PaymentFailureReason;
}

interface AdminOrder {
  id: string;
  totalKrw: number;
  status: OrderStatus;
  createdAt: string;
  /** payment_failed 주문에만 존재한다. 다른 상태에는 빈 값으로도 붙이지 않는다. */
  failure?: AdminPaymentFailure;
}

class InconsistentFailureRecordError extends Error {
  constructor(readonly orderId: string, detail: string) {
    super(`Inconsistent payment failure record for order ${orderId}: ${detail}`);
  }
}

/**
 * 주문 상태 정책의 관리자 조회 기준:
 * - 상태는 저장된 order.status를 그대로 쓴다. 실패 이력 존재만으로 상태를 덮어쓰지 않는다.
 * - payment_failed 주문은 자기 주문의 실패 이력에서 금액·시각·사유를 가져온다.
 * - 상태와 이력이 맞지 않으면 추정값으로 메우지 않고 데이터 불일치로 판정한다.
 *   실패 이력이 여러 개일 때의 선택 기준은 아직 사람의 결정이 없어 불일치로 다룬다.
 */
function findFailure(order: Order): AdminPaymentFailure {
  const failed = paymentAttempts.filter((attempt) => attempt.orderId === order.id && !attempt.ok);
  if (failed.length !== 1) {
    throw new InconsistentFailureRecordError(order.id, `${failed.length} failed attempts`);
  }
  const [attempt] = failed;
  if (!attempt.failureReason) {
    throw new InconsistentFailureRecordError(order.id, 'missing failure reason');
  }
  return { amountKrw: attempt.amountKrw, at: attempt.at, reason: attempt.failureReason };
}

function toAdminOrder(order: Order): AdminOrder {
  const base: AdminOrder = {
    id: order.id,
    totalKrw: order.totalKrw,
    status: order.status,
    createdAt: order.createdAt,
  };
  if (order.status === 'payment_failed') {
    base.failure = findFailure(order);
  }
  return base;
}

export const adminRouter = Router();

adminRouter.get('/orders', (_req: Request, res: Response) => {
  try {
    res.json(Array.from(orders.values(), toAdminOrder));
  } catch (error) {
    if (error instanceof InconsistentFailureRecordError) {
      // 내부 예외 메시지는 노출하지 않고, 어느 주문이 불일치인지만 알린다.
      res.status(500).json({ message: 'Inconsistent payment failure record', orderId: error.orderId });
      return;
    }
    throw error;
  }
});
