// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Campo para relación con tenant
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    required: true,
    trim: true
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  salePrice: {
    type: Number,
    required: true,
    min: 0
  },
  lastPurchasePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  image: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'uploads.files',
    default: null
  }
}, {
  timestamps: true
});

// Índices compuestos para búsquedas eficientes
productSchema.index({ tenantId: 1, category: 1 });
productSchema.index({ tenantId: 1, name: 1 });
productSchema.index({ tenantId: 1, _id: 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;