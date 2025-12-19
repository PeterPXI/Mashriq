const Wallet = require('../models/Wallet');

class EscrowService {
  async holdFunds(buyerId, orderId, amount) {
    const wallet = await Wallet.findOne({ user: buyerId });
    if (wallet.balance < amount) throw new Error('Insufficient funds');
    wallet.balance -= amount;
    wallet.heldFunds.push({ order: orderId, amount });
    await wallet.save(); // Money held by platform (escrow rules)
  }

  async releaseFunds(buyerId, sellerId, orderId, amount) {
    const buyerWallet = await Wallet.findOne({ user: buyerId });
    const sellerWallet = await Wallet.findOne({ user: sellerId });
    const held = buyerWallet.heldFunds.find(h => h.order.toString() === orderId.toString());
    if (!held) throw new Error('Funds not held');
    buyerWallet.heldFunds = buyerWallet.heldFunds.filter(h => h.order.toString() !== orderId.toString());
    const commission = amount * 0.1; // Fixed platform commission
    sellerWallet.balance += (amount - commission);
    await buyerWallet.save();
    await sellerWallet.save(); // Release only on COMPLETED
  }

  async refundFunds(buyerId, orderId, amount) {
    const wallet = await Wallet.findOne({ user: buyerId });
    const held = wallet.heldFunds.find(h => h.order.toString() === orderId.toString());
    if (!held) throw new Error('Funds not held');
    wallet.heldFunds = wallet.heldFunds.filter(h => h.order.toString() !== orderId.toString());
    wallet.balance += amount;
    await wallet.save(); // Refund on CANCELLED or dispute resolution
  }
}

module.exports = new EscrowService();
