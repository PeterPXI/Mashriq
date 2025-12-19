const User = require('../models/User');
const Order = require('../models/Order');

class TrustService {
  async updateTrustScore(sellerId) {
    const completedOrders = await Order.countDocuments({ seller: sellerId, status: 'COMPLETED' });
    const cancelledOrders = await Order.countDocuments({ seller: sellerId, status: 'CANCELLED' });
    const score = completedOrders - cancelledOrders * 0.5; // Internal metric (affects visibility/order limits)
    await User.findByIdAndUpdate(sellerId, { trustScore: score });
  }

  async getOrderLimit(sellerId) {
    const user = await User.findById(sellerId);
    // Dynamic threshold-based limit (no visible formulas)
    return Math.min(10, Math.max(1, Math.floor(user.trustScore / 5)));
  }

  async canSellerAcceptOrder(sellerId) {
    const limit = await this.getOrderLimit(sellerId);
    const activeOrders = await Order.countDocuments({ seller: sellerId, status: 'ACTIVE' });
    return activeOrders < limit;
  }
}

module.exports = new TrustService();
