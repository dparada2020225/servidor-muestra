// models/Supplier.js
const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
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
  contactName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true }
  },
  taxId: {
    type: String,
    trim: true
  },
  paymentTerms: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  },
  totalPurchases: {
    type: Number,
    default: 0
  },
  lastOrderDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Índices compuestos para búsquedas eficientes
supplierSchema.index({ tenantId: 1, name: 1 });
supplierSchema.index({ tenantId: 1, email: 1 });
supplierSchema.index({ tenantId: 1, _id: 1 });

const Supplier = mongoose.model('Supplier', supplierSchema);

module.exports = Supplier;