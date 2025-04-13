// routes/tenantRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const auditService = require('../services/auditService');

/**
 * @route   GET /api/tenants/:subdomain
 * @desc    Obtener información de un tenant por subdominio (ruta pública)
 * @access  Public
 */
router.get('/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    
    // Validar subdomain
    if (!subdomain || subdomain === 'www' || subdomain === 'api' || subdomain === 'admin') {
      return res.status(400).json({ message: 'Subdomain inválido' });
    }
    
    // Buscar tenant
    const tenant = await Tenant.findOne({ 
      subdomain,
      status: { $ne: 'cancelled' } // No mostrar tenants cancelados
    }).select('-billing.paymentDetails'); // Omitir datos sensibles de pago
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant no encontrado' });
    }
    
    // Si el tenant está suspendido, devolver código específico
    if (tenant.status === 'suspended') {
      return res.status(403).json({ 
        message: 'Tenant suspendido',
        tenant: {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          status: tenant.status,
          customization: tenant.customization
        }
      });
    }
    
    // Devolver información básica del tenant
    res.status(200).json({
      id: tenant._id,
      _id: tenant._id, // Para compatibilidad
      name: tenant.name,
      subdomain: tenant.subdomain,
      logo: tenant.logo,
      status: tenant.status,
      slogan: tenant.slogan,
      description: tenant.description,
      customization: tenant.customization,
      contactInfo: tenant.contactInfo,
      settings: {
        enableInventoryAlerts: tenant.settings?.enableInventoryAlerts,
        lowStockThreshold: tenant.settings?.lowStockThreshold,
        defaultDateRange: tenant.settings?.defaultDateRange,
        features: tenant.settings?.features
      }
    });
  } catch (error) {
    console.error('Error al obtener tenant:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

/**
 * @route   POST /api/tenants/register
 * @desc    Registrar un nuevo tenant y su admin
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { tenantName, subdomain, email, username, password } = req.body;
    
    // Validar campos requeridos
    if (!tenantName || !subdomain || !email || !username || !password) {
      return res.status(400).json({ 
        message: 'Faltan campos requeridos. Se requiere tenantName, subdomain, email, username y password.' 
      });
    }
    
    // Verificar si el subdominio ya existe
    const existingTenant = await Tenant.findOne({ subdomain });
    if (existingTenant) {
      return res.status(400).json({ message: 'Este subdominio ya está en uso' });
    }
    
    // Crear nuevo tenant con valores por defecto
    const tenant = new Tenant({
      name: tenantName,
      subdomain,
      status: 'trial', // Todos los tenants nuevos comienzan en modo trial
      plan: 'free',    // Plan gratuito por defecto
      customization: {
        primaryColor: '#3b82f6',
        secondaryColor: '#333333',
        logoText: tenantName,
        currencySymbol: 'Q'
      },
      contactInfo: {
        email,
        phone: '',
        address: '',
        taxId: ''
      },
      settings: {
        maxUsers: 5,
        maxProducts: 100,
        maxStorage: 100,
        features: {
          multipleLocations: false,
          advancedReports: false,
          api: false
        }
      },
      billing: {
        planStartDate: new Date(),
        planEndDate: new Date(new Date().setMonth(new Date().getMonth() + 1)) // Trial de 1 mes
      }
    });
    
    await tenant.save();
    
    // Crear usuario administrador para el tenant
    const admin = new User({
      username,
      password,
      role: 'tenantAdmin',
      tenantId: tenant._id,
      email,
      isActive: true
    });
    
    await admin.save();
    
    // No devolver la contraseña en la respuesta
    const adminResponse = {
      _id: admin._id,
      username: admin.username,
      role: admin.role,
      email: admin.email
    };
    
    // Respuesta
    res.status(201).json({
      message: 'Tenant registrado exitosamente',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        status: tenant.status,
        plan: tenant.plan
      },
      admin: adminResponse
    });
  } catch (error) {
    console.error('Error al registrar tenant:', error);
    res.status(500).json({ message: 'Error al registrar tenant', error: error.message });
  }
});

// A partir de aquí todas las rutas requieren autenticación
router.use(protect);

/**
 * @route   PUT /api/tenants/:id
 * @desc    Actualizar configuración de un tenant
 * @access  Private (TenantAdmin o SuperAdmin)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Verificar que el ID sea válido
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de tenant inválido' });
    }
    
    // Buscar el tenant
    const tenant = await Tenant.findById(id);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant no encontrado' });
    }
    
    // Verificar permisos - solo el admin del tenant o un superAdmin pueden modificarlo
    const isTenantAdmin = req.user.role === 'tenantAdmin' && req.user.tenantId && 
                          req.user.tenantId.toString() === tenant._id.toString();
    const isSuperAdmin = req.user.role === 'superAdmin';
    
    if (!isTenantAdmin && !isSuperAdmin) {
      return res.status(403).json({ message: 'No tienes permiso para modificar este tenant' });
    }
    
    // No permitir modificar subdomain (podría causar problemas)
    if (updates.subdomain) {
      delete updates.subdomain;
    }
    
    // No permitir que un tenantAdmin cambie el plan o status
    if (isTenantAdmin && !isSuperAdmin) {
      delete updates.plan;
      delete updates.status;
    }
    
    // Validar los campos permitidos para actualizar
    const allowedUpdates = ['name', 'slogan', 'description', 'logo', 'contactInfo', 'customization', 'settings'];
    if (isSuperAdmin) {
      allowedUpdates.push('plan', 'status', 'billing');
    }
    
    // Filtrar actualizaciones para incluir solo campos permitidos
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });
    
    // Guardar estado anterior para auditoría
    const previousState = {
      name: tenant.name,
      status: tenant.status,
      plan: tenant.plan
    };
    
    // Actualizar tenant con los campos filtrados
    Object.keys(filteredUpdates).forEach(key => {
      if (key === 'contactInfo' || key === 'customization' || key === 'settings') {
        // Para objetos anidados, hacer merge
        tenant[key] = { ...tenant[key], ...filteredUpdates[key] };
      } else {
        tenant[key] = filteredUpdates[key];
      }
    });
    
    await tenant.save();
    
    // Registrar en auditoría
    await auditService.logAction({
      action: 'update',
      entityType: 'tenant',
      entityId: tenant._id,
      description: `Actualización del tenant: ${tenant.name}`,
      details: {
        previous: previousState,
        current: {
          name: tenant.name,
          status: tenant.status,
          plan: tenant.plan
        },
        updatedFields: Object.keys(filteredUpdates)
      },
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      tenantId: tenant._id,
      ipAddress: req.ip
    });
    
    // Respuesta
    res.status(200).json({
      message: 'Tenant actualizado exitosamente',
      tenant: {
        id: tenant._id,
        _id: tenant._id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        logo: tenant.logo,
        status: tenant.status,
        slogan: tenant.slogan,
        description: tenant.description,
        customization: tenant.customization,
        contactInfo: tenant.contactInfo,
        settings: tenant.settings
      }
    });
  } catch (error) {
    console.error('Error al actualizar tenant:', error);
    res.status(500).json({ message: 'Error al actualizar tenant', error: error.message });
  }
});

/**
 * @route   GET /api/tenants/:id/users
 * @desc    Obtener usuarios de un tenant específico
 * @access  Private (TenantAdmin o SuperAdmin)
 */
router.get('/:id/users', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el ID sea válido
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de tenant inválido' });
    }
    
    // Buscar el tenant
    const tenant = await Tenant.findById(id);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant no encontrado' });
    }
    
    // Verificar permisos - solo el admin del tenant o un superAdmin pueden ver los usuarios
    const isTenantAdmin = req.user.role === 'tenantAdmin' && req.user.tenantId && 
                          req.user.tenantId.toString() === tenant._id.toString();
    const isSuperAdmin = req.user.role === 'superAdmin';
    
    if (!isTenantAdmin && !isSuperAdmin) {
      return res.status(403).json({ message: 'No tienes permiso para ver los usuarios de este tenant' });
    }
    
    // Obtener usuarios del tenant
    const users = await User.find({ tenantId: id }).select('-password');
    
    res.status(200).json(users);
  } catch (error) {
    console.error('Error al obtener usuarios del tenant:', error);
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
});

module.exports = router;