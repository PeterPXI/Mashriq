const Order = require('../models/Order');
const escrowService = require('./escrowService');

class OrderService {
  async createOrder(buyerId, service, selectedExtras) {
    const totalPrice = service.basePrice + selectedExtras.reduce((sum, e) => sum + e.price, 0);
    const order = new Order({
      buyer: buyerId,
      seller: service.seller,
      serviceSnapshot: { title: service.title, description: service.description, basePrice: service.basePrice, extras: service.extras },
      selectedExtras,
      totalPrice,
    });
    await order.save();
    await escrowService.holdFunds(buyerId, order._id, totalPrice); // Escrow holds funds at creation
    return order;
  }

  async deliverOrder(orderId, delivery) {
    const order = await Order.findById(orderId);
    if (order.status !== 'ACTIVE') throw new Error('Order must be ACTIVE to deliver');
    order.status = 'DELIVERED';
    order.delivery = delivery;
    order.deliveredAt = new Date();
    await order.save();
    // Auto-complete after inactivity (implement via cron job, not here)
    return order;
  }

  async approveOrder(orderId) {
    const order = await Order.findById(orderId);
    if (order.status !== 'DELIVERED') throw new Error('Order must be DELIVERED to approve');
    order.status = 'COMPLETED';
    order.completedAt = new Date();
    await order.save();
    await escrowService.releaseFunds(order.buyer, order.seller, order._id, order.totalPrice); // Release on COMPLETED
    return order;
  }

  async cancelOrder(orderId) {
    const order = await Order.findById(orderId);
    if (order.status !== 'ACTIVE') throw new Error('Order must be ACTIVE to cancel');
    order.status = 'CANCELLED';
    order.cancelledAt = new Date();
    await order.save();
    await escrowService.refundFunds(order.buyer, order._id, order.totalPrice); // Refund on CANCELLED
    return order;
  }

  // Auto-cancel/auto-complete logic (call via scheduled task)
  async autoCancel(orderId) {
    const order = await Order.findById(orderId);
    if (order.status === 'ACTIVE') {
      await this.cancelOrder(orderId); // Seller inactivity -> auto CANCEL + refund
    }
  }

  async autoComplete(orderId) {
    const order = await Order.findById(orderId);
    if (order.status === 'DELIVERED') {
      await this.approveOrder(orderId); // Buyer inactivity -> auto COMPLETE
    }
  }
}

module.exports = new OrderService();
