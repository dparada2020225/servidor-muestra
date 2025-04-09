// models/Tenant.js
const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  subdomain: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  logo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'uploads.files',
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'trial', 'cancelled'],
    default: 'trial'
  },
  plan: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise'],
    default: 'free'
  },
  customization: {
    primaryColor: { type: String, default: '#3b82f6' },
    secondaryColor: { type: String, default: '#333333' },
    logoText: { type: String },
    currencySymbol: { type: String, default: 'Q' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' }
  },
  settings: {
    maxUsers: { type: Number, default: 5 },
    maxProducts: { type: Number, default: 100 },
    maxStorage: { type: Number, default: 100 }, // en MB
    features: {
      multipleLocations: { type: Boolean, default: false },
      advancedReports: { type: Boolean, default: false },
      api: { type: Boolean, default: false }
    }
  },
  contactInfo: {
    email: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    taxId: { type: String }
  },
  billing: {
    planStartDate: { type: Date, default: Date.now },
    planEndDate: { type: Date },
    paymentMethod: { type: String },
    paymentDetails: { type: Object }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }
}, {
  timestamps: true
});

// Índices para búsqueda eficiente
tenantSchema.index({ subdomain: 1 }, { unique: true });
tenantSchema.index({ status: 1 });
tenantSchema.index({ 'billing.planEndDate': 1 });

const Tenant = mongoose.model('Tenant', tenantSchema);

module.exports = Tenant;