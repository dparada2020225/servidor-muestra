// models/Purchase.js
const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  }
});

const purchaseSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now
  },
  supplier: {
    type: String,
    trim: true
  },
  items: [purchaseItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const Purchase = mongoose.model('Purchase', purchaseSchema);

module.exports = Purchase;