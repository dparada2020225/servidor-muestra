// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { protect, superAdmin } = require('../middleware/authMiddleware');
const Tenant = require('../models/Tenant');
const User = require('../models/User');

// Todas las rutas requieren autenticación
router.use(protect);

// Todas las rutas requieren ser superAdmin
router.use(superAdmin);

/**
 * @route   GET /api/admin/tenants
 * @desc    Obtener todos los tenants
 * @access  Solo superAdmin
 */
router.get('/tenants', async (req, res) => {
  try {
    const tenants = await Tenant.find({}).select('-__v').sort({ createdAt: -1 });
    res.status(200).json(tenants);
  } catch (error) {
    console.error('Error al obtener tenants:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

/**
 * @route   GET /api/admin/tenants/:id
 * @desc    Obtener un tenant por ID
 * @access  Solo superAdmin
 */
router.get('/tenants/:id', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant no encontrado' });
    }
    
    res.status(200).json(tenant);
  } catch (error) {
    console.error('Error al obtener tenant:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

/**
 * @route   POST /api/admin/tenants
 * @desc    Crear un nuevo tenant
 * @access  Solo superAdmin
 */
router.post('/tenants', async (req, res) => {
  try {
    const { name, subdomain, status, plan, contactInfo } = req.body;
    
    // Validar campos obligatorios
    if (!name || !subdomain || !contactInfo || !contactInfo.email) {
      return res.status(400).json({ message: 'Nombre, subdominio y email son obligatorios' });
    }
    
    // Verificar si el subdominio ya existe
    const existingTenant = await Tenant.findOne({ subdomain });
    if (existingTenant) {
      return res.status(400).json({ message: 'Este subdominio ya está en uso' });
    }
    
    // Crear nuevo tenant
    const tenant = new Tenant({
      name,
      subdomain,
      status: status || 'trial', // Valor por defecto si no se proporciona
      plan: plan || 'free',      // Valor por defecto si no se proporciona
      customization: {
        primaryColor: req.body.primaryColor || '#3b82f6',
        secondaryColor: req.body.secondaryColor || '#333333',
        logoText: req.body.logoText || name,
        currencySymbol: req.body.currencySymbol || 'Q'
      },
      contactInfo: {
        email: contactInfo.email,
        phone: contactInfo.phone || '',
        address: contactInfo.address || '',
        taxId: contactInfo.taxId || ''
      },
      settings: {
        maxUsers: req.body.maxUsers || 5,
        maxProducts: req.body.maxProducts || 100,
        maxStorage: req.body.maxStorage || 100,
        features: {
          multipleLocations: req.body.features?.multipleLocations || false,
          advancedReports: req.body.features?.advancedReports || false,
          api: req.body.features?.api || false
        }
      },
      createdBy: req.user.id
    });
    
    // Si se proporciona información de facturación
    if (req.body.billing) {
      tenant.billing = {
        planStartDate: req.body.billing.planStartDate || new Date(),
        planEndDate: req.body.billing.planEndDate,
        paymentMethod: req.body.billing.paymentMethod,
        paymentDetails: req.body.billing.paymentDetails
      };
    }
    
    await tenant.save();
    
    // Crear el primer usuario administrador del tenant
    const adminPassword = Math.random().toString(36).slice(-8); // Generar contraseña aleatoria
    
    const adminUser = new User({
      username: `admin_${subdomain}`,
      password: adminPassword,
      role: 'tenantAdmin',
      tenantId: tenant._id,
      email: contactInfo.email,
      isActive: true
    });
    
    await adminUser.save();
    
    res.status(201).json({
      tenant,
      adminUser: {
        username: adminUser.username,
        password: adminPassword, // Solo enviamos la contraseña en la creación inicial
        email: adminUser.email,
        role: adminUser.role
      },
      message: 'Tenant creado exitosamente con usuario administrador'
    });
    
  } catch (error) {
    console.error('Error al crear tenant:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

/**
 * @route   PUT /api/admin/tenants/:id
 * @desc    Actualizar un tenant
 * @access  Solo superAdmin
 */
router.put('/tenants/:id', async (req, res) => {
  try {
    const { name, status, plan, contactInfo, customization, settings, billing } = req.body;
    
    // No permitir actualizar el subdominio (podría causar problemas)
    if (req.body.subdomain) {
      delete req.body.subdomain;
    }
    
    // Buscar el tenant
    const tenant = await Tenant.findById(req.params.id);
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant no encontrado' });
    }
    
    // Actualizar propiedades
    if (name) tenant.name = name;
    if (status) tenant.status = status;
    if (plan) tenant.plan = plan;
    
    // Actualizar contactInfo si se proporciona
    if (contactInfo) {
      tenant.contactInfo = {
        ...tenant.contactInfo,
        ...contactInfo
      };
    }
    
    // Actualizar customization si se proporciona
    if (customization) {
      tenant.customization = {
        ...tenant.customization,
        ...customization
      };
    }
    
    // Actualizar settings si se proporciona
    if (settings) {
      // Si se proporcionan features, fusionarlas con las existentes
      if (settings.features) {
        settings.features = {
          ...tenant.settings.features,
          ...settings.features
        };
      }
      
      tenant.settings = {
        ...tenant.settings,
        ...settings
      };
    }
    
    // Actualizar billing si se proporciona
    if (billing) {
      tenant.billing = {
        ...tenant.billing,
        ...billing
      };
    }
    
    await tenant.save();
    res.status(200).json({ tenant, message: 'Tenant actualizado exitosamente' });
    
  } catch (error) {
    console.error('Error al actualizar tenant:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

/**
 * @route   DELETE /api/admin/tenants/:id
 * @desc    Suspender o desactivar un tenant (no eliminar totalmente)
 * @access  Solo superAdmin
 */
router.delete('/tenants/:id', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant no encontrado' });
    }
    
    // No eliminar realmente, solo cambiar estado
    tenant.status = 'cancelled';
    await tenant.save();
    
    res.status(200).json({ message: 'Tenant desactivado exitosamente' });
  } catch (error) {
    console.error('Error al desactivar tenant:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

/**
 * @route   GET /api/admin/stats
 * @desc    Obtener estadísticas de la plataforma
 * @access  Solo superAdmin
 */
router.get('/stats', async (req, res) => {
  try {
    // Contar tenants por estado
    const tenantsCount = await Tenant.countDocuments();
    const activeTenantsCount = await Tenant.countDocuments({ status: 'active' });
    const trialTenantsCount = await Tenant.countDocuments({ status: 'trial' });
    const suspendedTenantsCount = await Tenant.countDocuments({ status: 'suspended' });
    const cancelledTenantsCount = await Tenant.countDocuments({ status: 'cancelled' });
    
    // Contar tenants por plan
    const freeTenantsCount = await Tenant.countDocuments({ plan: 'free' });
    const basicTenantsCount = await Tenant.countDocuments({ plan: 'basic' });
    const premiumTenantsCount = await Tenant.countDocuments({ plan: 'premium' });
    const enterpriseTenantsCount = await Tenant.countDocuments({ plan: 'enterprise' });
    
    // Contar usuarios
    const usersCount = await User.countDocuments();
    const superAdminsCount = await User.countDocuments({ role: 'superAdmin' });
    const tenantAdminsCount = await User.countDocuments({ role: 'tenantAdmin' });
    
    // Obtener últimos tenants creados
    const recentTenants = await Tenant.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name subdomain status plan createdAt');
    
    res.status(200).json({
      totalTenants: tenantsCount,
      tenantsByStatus: {
        active: activeTenantsCount,
        trial: trialTenantsCount,
        suspended: suspendedTenantsCount,
        cancelled: cancelledTenantsCount
      },
      tenantsByPlan: {
        free: freeTenantsCount,
        basic: basicTenantsCount,
        premium: premiumTenantsCount,
        enterprise: enterpriseTenantsCount
      },
      users: {
        total: usersCount,
        superAdmins: superAdminsCount,
        tenantAdmins: tenantAdminsCount
      },
      recentTenants
    });
    
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

/**
 * @route   POST /api/admin/superadmins
 * @desc    Crear un nuevo superadmin
 * @access  Solo superAdmin
 */
router.post('/superadmins', async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;
    
    // Validar campos obligatorios
    if (!username || !password) {
      return res.status(400).json({ message: 'Nombre de usuario y contraseña son obligatorios' });
    }
    
    // Verificar si el superadmin ya existe
    const existingUser = await User.findOne({ username, role: 'superAdmin' });
    if (existingUser) {
      return res.status(400).json({ message: 'Este nombre de usuario ya está en uso' });
    }
    
    // Crear nuevo superadmin (sin tenantId)
    const superAdmin = new User({
      username,
      password,
      role: 'superAdmin',
      email,
      firstName,
      lastName,
      isActive: true
    });
    
    await superAdmin.save();
    
    // No devolver la contraseña en la respuesta
    const response = {
      _id: superAdmin._id,
      username: superAdmin.username,
      role: superAdmin.role,
      email: superAdmin.email,
      firstName: superAdmin.firstName,
      lastName: superAdmin.lastName,
      isActive: superAdmin.isActive
    };
    
    res.status(201).json({ superAdmin: response, message: 'SuperAdmin creado exitosamente' });
    
  } catch (error) {
    console.error('Error al crear superadmin:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

/**
 * @route   GET /api/admin/superadmins
 * @desc    Obtener todos los superadmins
 * @access  Solo superAdmin
 */
router.get('/superadmins', async (req, res) => {
  try {
    const superAdmins = await User.find({ role: 'superAdmin' })
      .select('-password -__v')
      .sort({ createdAt: -1 });
    
    res.status(200).json(superAdmins);
  } catch (error) {
    console.error('Error al obtener superadmins:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

/**
 * @route   PUT /api/admin/tenant/:tenantId/status
 * @desc    Cambiar el estado de un tenant (activar, suspender, etc.)
 * @access  Solo superAdmin
 */
router.put('/tenant/:tenantId/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['active', 'suspended', 'trial', 'cancelled'].includes(status)) {
      return res.status(400).json({ 
        message: 'Estado no válido. Debe ser: active, suspended, trial o cancelled' 
      });
    }
    
    const tenant = await Tenant.findById(req.params.tenantId);
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant no encontrado' });
    }
    
    tenant.status = status;
    await tenant.save();
    
    res.status(200).json({ message: `Estado del tenant actualizado a ${status}`, tenant });
    
  } catch (error) {
    console.error('Error al actualizar estado del tenant:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

/**
 * @route   GET /api/admin/tenant/:tenantId/users
 * @desc    Obtener todos los usuarios de un tenant específico
 * @access  Solo superAdmin
 */
router.get('/tenant/:tenantId/users', async (req, res) => {
  try {
    const users = await User.find({ tenantId: req.params.tenantId })
      .select('-password -__v')
      .sort({ createdAt: -1 });
    
    res.status(200).json(users);
  } catch (error) {
    console.error('Error al obtener usuarios del tenant:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

/**
 * @route   POST /api/admin/impersonate/:userId
 * @desc    Impersonar un usuario (obtener token para acceder como ese usuario)
 * @access  Solo superAdmin
 */
router.post('/impersonate/:userId', async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    
    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Generar token de impersonación
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        id: targetUser._id, 
        username: targetUser.username, 
        role: targetUser.role,
        tenantId: targetUser.tenantId,
        impersonatedBy: req.user.id // Marcar que es una impersonación
      },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '1h' } // Token con vida limitada para seguridad
    );
    
    res.status(200).json({
      message: 'Impersonación autorizada',
      token,
      user: {
        _id: targetUser._id,
        username: targetUser.username,
        role: targetUser.role,
        tenantId: targetUser.tenantId
      }
    });
    
  } catch (error) {
    console.error('Error al impersonar usuario:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

module.exports = router;