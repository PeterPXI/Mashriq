const Dispute = require('../models/Dispute');
const Order = require('../models/Order');
const escrowService = require('./escrowService');

class DisputeService {
  async openDispute(orderId, raisedBy, reason) {
    const order = await Order.findById(orderId);
    if (order.status !== 'DELIVERED') throw new Error('Disputes can ONLY be opened in DELIVERED state');
    const dispute = new Dispute({ order: orderId, raisedBy, reason });
    await dispute.save();
    return dispute;
  }

  async resolveDispute(disputeId, resolution) {
    const dispute = await Dispute.findById(disputeId);
    dispute.status = 'RESOLVED';
    dispute.resolution = resolution;
    dispute.resolvedAt = new Date();
    await dispute.save();
    // If refund, call escrowService.refundFunds
    if (resolution === 'refund') {
      const order = await Order.findById(dispute.order);
      await escrowService.refundFunds(order.buyer, order._id, order.totalPrice);
    }
    return dispute;
  }
}

module.exports = new DisputeService();
