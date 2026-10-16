import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  cancellations,
  orders,
  paymentAttempts,
  refunds,
  type Order,
  type OrderStatus,
  type PaymentFailureReason,
} from './store.js';

interface AdminPaymentFailure {
  amountKrw: number;
  at: string;
  reason: PaymentFailureReason;
}

interface AdminRefund {
  amountKrw: number;
  at: string;
}

interface AdminCancellation {
  at: string;
}

interface AdminOrder {
  id: string;
  totalKrw: number;
  status: OrderStatus;
  createdAt: string;
  /** payment_failed 주문에만 존재한다. 다른 상태에는 빈 값으로도 붙이지 않는다. */
  failure?: AdminPaymentFailure;
  /** refunded 주문에만 존재한다. */
  refund?: AdminRefund;
  /** cancelled 주문에만 존재한다. */
  cancellation?: AdminCancellation;
}

class InconsistentRecordError extends Error {
  constructor(readonly orderId: string, readonly kind: 'payment failure' | 'refund' | 'cancellation', detail: string) {
    super(`Inconsistent ${kind} record for order ${orderId}: ${detail}`);
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
    throw new InconsistentRecordError(order.id, 'payment failure', `${failed.length} failed attempts`);
  }
  const [attempt] = failed;
  if (!attempt.failureReason) {
    throw new InconsistentRecordError(order.id, 'payment failure', 'missing failure reason');
  }
  return { amountKrw: attempt.amountKrw, at: attempt.at, reason: attempt.failureReason };
}

/** cancelled 주문은 자기 취소 이력이 정확히 하나여야 한다. 아니면 데이터 불일치다. */
function findCancellation(order: Order): AdminCancellation {
  const own = cancellations.filter((c) => c.orderId === order.id);
  if (own.length !== 1) {
    throw new InconsistentRecordError(order.id, 'cancellation', `${own.length} cancellations`);
  }
  return { at: own[0].at };
}

/** refunded 주문은 자기 환불 이력이 정확히 하나여야 한다. 아니면 데이터 불일치다. */
function findRefund(order: Order): AdminRefund {
  const own = refunds.filter((refund) => refund.orderId === order.id);
  if (own.length !== 1) {
    throw new InconsistentRecordError(order.id, 'refund', `${own.length} refunds`);
  }
  return { amountKrw: own[0].amountKrw, at: own[0].at };
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
  if (order.status === 'refunded') {
    base.refund = findRefund(order);
  }
  if (order.status === 'cancelled') {
    base.cancellation = findCancellation(order);
  }
  return base;
}

export const adminRouter = Router();

adminRouter.get('/orders', (_req: Request, res: Response) => {
  try {
    res.json(Array.from(orders.values(), toAdminOrder));
  } catch (error) {
    if (error instanceof InconsistentRecordError) {
      // 내부 예외 메시지는 노출하지 않고, 어느 주문의 어떤 이력이 불일치인지만 알린다.
      res.status(500).json({ message: `Inconsistent ${error.kind} record`, orderId: error.orderId });
      return;
    }
    throw error;
  }
});
