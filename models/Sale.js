// models/Sale.js
const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
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

const saleSchema = new mongoose.Schema({
  // Campo para relación con tenant
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  customer: {
    type: String,
    trim: true
  },
  items: [saleItemSchema],
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

// Índices compuestos para búsquedas eficientes
saleSchema.index({ tenantId: 1, date: -1 });
saleSchema.index({ tenantId: 1, customer: 1 });
saleSchema.index({ tenantId: 1, _id: 1 });

const Sale = mongoose.model('Sale', saleSchema);

module.exports = Sale;