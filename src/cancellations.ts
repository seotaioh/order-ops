import { Router } from 'express';
import type { Request, Response } from 'express';
import { cancellations, orders, type Cancellation, type Order } from './store.js';

/**
 * 주문 상태 정책: 취소(cancelled)는 결제 전 pending 주문에만 허용한다.
 * paid·refunded는 금지, payment_failed·cancelled는 표에 없는 전환이라 보류 → 모두 거부한다.
 */
function isCancellable(order: Order): boolean {
  return order.status === 'pending';
}

function recordCancellation(order: Order): Cancellation {
  const cancellation: Cancellation = { orderId: order.id, at: new Date().toISOString() };
  cancellations.push(cancellation);
  return cancellation;
}

export const cancellationsRouter = Router();

cancellationsRouter.post('/:id/cancel', (req: Request<{ id: string }>, res: Response) => {
  const order = orders.get(req.params.id);
  if (!order) {
    res.status(404).json({ message: 'Order not found' });
    return;
  }

  if (!isCancellable(order)) {
    // 거부 응답은 전환이 아니므로 상태·이력·재고를 바꾸지 않는다.
    res.status(400).json({ message: 'Order is not cancellable', status: order.status });
    return;
  }

  // 재고 정책: pending 주문은 재고를 차감한 적이 없으므로 복원할 것도 없다.
  order.status = 'cancelled';
  const cancellation = recordCancellation(order);
  res.json({ ok: true, order, cancellation: { at: cancellation.at } });
});
