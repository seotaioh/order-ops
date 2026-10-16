import { Router } from 'express';
import type { Request, Response } from 'express';
import { restoreStock } from './inventory.js';
import { orders, refunds, type Order, type Refund } from './store.js';

/** 주문 상태 정책: 환불은 paid 주문에만 허용한다(paid → refunded). 그 밖의 상태는 모두 거부한다. */
function isRefundable(order: Order): boolean {
  return order.status === 'paid';
}

function recordRefund(order: Order): Refund {
  const refund: Refund = {
    orderId: order.id,
    amountKrw: order.totalKrw,
    at: new Date().toISOString(),
  };
  refunds.push(refund);
  return refund;
}

export const refundsRouter = Router();

refundsRouter.post('/:id/refund', (req: Request<{ id: string }>, res: Response) => {
  const order = orders.get(req.params.id);
  if (!order) {
    res.status(404).json({ message: 'Order not found' });
    return;
  }

  if (!isRefundable(order)) {
    // 거부 응답은 전환이 아니므로 상태·이력·재고를 바꾸지 않는다.
    res.status(400).json({ message: 'Order is not refundable', status: order.status });
    return;
  }

  // 결제 정책: 이 저장소는 실결제 연동이 없으므로 금액 반환은 즉시 완료되는 것으로 모사한다. 전액 환불만 지원한다.
  // 재고 정책: 결제 성공 때 차감한 수량을 환불 완료 시점에 한 번 복원한다.
  restoreStock(order.items);
  order.status = 'refunded';
  const refund = recordRefund(order);
  res.json({ ok: true, order, refund: { amountKrw: refund.amountKrw, at: refund.at } });
});
