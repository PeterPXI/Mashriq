const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  balance: { type: Number, default: 0 },
  heldFunds: [{ order: mongoose.Schema.Types.ObjectId, amount: Number }], // Escrow holds
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);
