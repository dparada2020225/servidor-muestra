// models/Audit.js
const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  // La acción realizada (crear, actualizar, eliminar, etc.)
  action: {
    type: String,
    required: true,
    enum: ['create', 'update', 'delete', 'view', 'login', 'logout', 'impersonate', 'suspend', 'activate']
  },
  
  // El tipo de entidad sobre la que se realizó la acción
  entityType: {
    type: String,
    required: true,
    enum: ['tenant', 'user', 'product', 'purchase', 'sale', 'setting']
  },
  
  // El ID de la entidad (si aplica)
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    default: null
  },
  
  // Descripción de la acción
  description: {
    type: String,
    required: true
  },
  
  // Detalles adicionales en formato JSON
  details: {
    type: Object,
    default: {}
  },
  
  // ID del usuario que realizó la acción
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Nombre de usuario (para facilitar consultas)
  username: {
    type: String,
    required: true
  },
  
  // Role del usuario cuando realizó la acción
  userRole: {
    type: String,
    required: true
  },
  
  // Si la acción fue una impersonación, usuario original
  impersonatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // ID del tenant en el que se realizó la acción (null para acciones de plataforma)
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    default: null
  },
  
  // Dirección IP desde donde se realizó la acción
  ipAddress: {
    type: String,
    default: null
  },
  
  // Marca temporal de la acción
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices para consultas frecuentes
auditSchema.index({ action: 1, timestamp: -1 });
auditSchema.index({ tenantId: 1, timestamp: -1 });
auditSchema.index({ userId: 1, timestamp: -1 });
auditSchema.index({ entityType: 1, entityId: 1 });

const Audit = mongoose.model('Audit', auditSchema);

module.exports = Audit;