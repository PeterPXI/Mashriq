const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceSnapshot: { // Snapshot at creation (no changes after)
    title: String,
    description: String,
    basePrice: Number,
    extras: [{ name: String, price: Number }],
  },
  selectedExtras: [{ name: String, price: Number }],
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['ACTIVE', 'DELIVERED', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE' },
  delivery: { type: String }, // Seller's delivery content
  deliveredAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  escrowHeld: { type: Boolean, default: true }, // Money held by platform (escrow rules)
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
