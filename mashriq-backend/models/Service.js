const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  basePrice: { type: Number, required: true, validate: v => v % 5 === 0 }, // Exactly one base price, multiple of 5 (no negotiation)
  extras: [{ name: String, price: Number }], // Optional extras only (no packages)
  category: { type: String, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
