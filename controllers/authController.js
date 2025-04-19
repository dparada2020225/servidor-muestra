// controllers/authController.js - actualizado
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const jwt = require('jsonwebtoken');
const auditService = require('../services/auditService');

// Cache para usuarios (almacena resultados por un corto período)
let usersCache = {
  data: null,
  timestamp: 0,
  expiryTime: 60000 // 60 segundos de caché
};

// Generar token JWT
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      username: user.username, 
      role: user.role,
      tenantId: user.tenantId // Incluir tenantId en el token
    },
    process.env.JWT_SECRET || 'your_jwt_secret_key',
    { expiresIn: '24h' }
  );
};

// Registrar un nuevo usuario
exports.register = async (req, res) => {
  try {
    // Verificar si el usuario que está creando es admin (solo admins pueden crear otros admins)
    if (req.body.role === 'admin' || req.body.role === 'tenantAdmin') {
      // Si no hay token o el usuario no es admin, rechazar
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin')) {
        return res.status(403).json({ message: 'No tienes permiso para crear administradores' });
      }
    }

    const { username, password, role, email, firstName, lastName } = req.body;
    
    // Obtener tenantId del contexto actual o del cuerpo de la solicitud
    let tenantId = req.tenant ? req.tenant._id : req.body.tenantId;
    
    // Si es superAdmin y no proporciona tenantId, se permite (será null)
    if (!tenantId && req.user?.role !== 'superAdmin') {
      return res.status(400).json({ message: 'Se requiere tenant para crear usuario' });
    }
    
    // Verificar si el usuario ya existe en este tenant
    const existingUser = await User.findOne({ 
      username,
      ...(tenantId ? { tenantId } : {})
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso' });
    }
    
    // Crear nuevo usuario
    const newUser = new User({
      username,
      password,
      role: role || 'tenantUser', // Por defecto es 'tenantUser'
      tenantId,
      email,
      firstName,
      lastName,
      isActive: true
    });
    
    await newUser.save();
    
    // No enviar el password en la respuesta
    const userResponse = {
      _id: newUser._id,
      username: newUser.username,
      role: newUser.role,
      tenantId: newUser.tenantId,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName
    };
    
    // Invalidar caché después de crear un nuevo usuario
    usersCache.data = null;
    
    // Registrar en auditoría
    await auditService.logAction({
      action: 'create',
      entityType: 'user',
      entityId: newUser._id,
      description: `Creación de usuario: ${newUser.username} con rol ${newUser.role}`,
      userId: req.user ? req.user.id : null,
      username: req.user ? req.user.username : 'Sistema',
      userRole: req.user ? req.user.role : 'sistema',
      tenantId,
      ipAddress: req.ip
    });
    
    res.status(201).json({ message: 'Usuario creado exitosamente', user: userResponse });
    
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ message: 'Error al registrar usuario', error: error.message });
  }
};

// Función de login actualizada en controllers/authController.js
exports.login = async (req, res) => {
  try {
    const { username, password, tenantId } = req.body;
    console.log('Intento de login:', { username, tenantId: tenantId || 'No tenant especificado' });
    
    // Manejo especial para superadmin
    if (username === 'superadmin') {
      console.log('Detectado intento de login como superadmin');
      
      // Buscar al superadmin sin filtrar por tenant
      const superAdmin = await User.findOne({ username, role: 'superAdmin' });
      
      if (!superAdmin) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }
      
      // Verificar si el usuario está activo
      if (superAdmin.isActive === false) {
        console.log('Superadmin está desactivado');
        return res.status(403).json({ 
          message: 'Tu cuenta ha sido desactivada. Por favor, contacta con el administrador.',
          isActive: false 
        });
      }
      
      // Verificar contraseña
      const isMatch = await superAdmin.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }
      
      // Generar token (sin tenantId)
      const token = jwt.sign(
        { 
          id: superAdmin._id, 
          username: superAdmin.username, 
          role: superAdmin.role
          // No incluimos tenantId para superAdmin
        },
        process.env.JWT_SECRET || 'your_jwt_secret_key',
        { expiresIn: '24h' }
      );
      
      // Actualizar último login
      superAdmin.lastLogin = new Date();
      await superAdmin.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'login',
        entityType: 'user',
        entityId: superAdmin._id,
        description: `Inicio de sesión: ${superAdmin.username} (superAdmin)`,
        userId: superAdmin._id,
        username: superAdmin.username,
        userRole: superAdmin.role,
        ipAddress: req.ip
      });
      
      // Respuesta
      return res.status(200).json({
        message: 'Login exitoso (superAdmin)',
        token,
        user: {
          _id: superAdmin._id,
          username: superAdmin.username,
          role: superAdmin.role,
          email: superAdmin.email,
          isActive: superAdmin.isActive
        }
      });
    }
    
    // Proceso normal para usuarios no superadmin
    // Buscar tenant si se proporciona un ID o usar el del contexto
    let tenant = null;
    if (tenantId) {
      tenant = await Tenant.findOne({ subdomain: tenantId });
      console.log('Tenant encontrado por subdomain:', tenant ? tenant.name : 'No encontrado');
      
      // Verificar estado del tenant
      if (tenant && tenant.status === 'suspended') {
        return res.status(403).json({ message: 'Este tenant está suspendido temporalmente' });
      }
      if (tenant && tenant.status === 'cancelled') {
        return res.status(403).json({ message: 'Este tenant ha sido cancelado' });
      }
    } else if (req.tenant) {
      tenant = req.tenant;
      console.log('Usando tenant del contexto:', tenant.name);
    }
    
    if (!tenant && req.headers.host) {
      const hostParts = req.headers.host.split('.');
      if (hostParts.length > 1 && hostParts[0] !== 'www') {
        const subdomain = hostParts[0];
        tenant = await Tenant.findOne({ subdomain });
        console.log(`Detectado tenant desde el host: ${subdomain}, encontrado:`, tenant ? 'Sí' : 'No');
      }
    }
    
    // Buscar usuario
    let query = { username };
    
    // Si hay un tenant, restringir la búsqueda a ese tenant
    if (tenant) {
      query.tenantId = tenant._id;
    }
    
    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    // Verificar si el usuario está activo
    if (user.isActive === false) {
      console.log('Usuario desactivado intentando iniciar sesión:', user.username);
      return res.status(403).json({ 
        message: 'Tu cuenta ha sido desactivada. Por favor, contacta con el administrador.', 
        isActive: false 
      });
    }
    
    // Verificar contraseña
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    // Si es superAdmin puede iniciar sesión sin importar el tenant
    // Para otros roles, verificar que pertenezcan al tenant correcto
    if (user.role !== 'superAdmin' && tenant && user.tenantId.toString() !== tenant._id.toString()) {
      return res.status(403).json({ message: 'No tienes acceso a este tenant' });
    }
    
    // Generar token
    const token = generateToken(user);
    
    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();
    
    // Registrar en auditoría
    await auditService.logAction({
      action: 'login',
      entityType: 'user',
      entityId: user._id,
      description: `Inicio de sesión: ${user.username}`,
      userId: user._id,
      username: user.username,
      userRole: user.role,
      tenantId: user.tenantId,
      ipAddress: req.ip
    });
    
    // Respuesta
    res.status(200).json({
      message: 'Login exitoso',
      token,
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive
      }
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en login', error: error.message });
  }
};

// Obtener todos los usuarios (solo para admin) - con implementación de caché optimizada
exports.getAllUsers = async (req, res) => {
  try {
    // Verificar permisos
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    
    let tenantId = null;
    
    // Si no es superAdmin, debe filtrar por tenant
    if (req.user.role !== 'superAdmin') {
      tenantId = req.user.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
    } else if (req.tenant) {
      // Si es superAdmin pero hay un tenant en el contexto, usarlo
      tenantId = req.tenant._id;
    }
    
    // Forzar actualización si se proporciona un parámetro específico
    const forceRefresh = req.query.forceRefresh === 'true';
    
    // Crear una clave única para la caché basada en tenantId
    const cacheKey = tenantId ? tenantId.toString() : 'all';
    
    // Verificar si tenemos datos en caché válidos
    const now = Date.now();
    if (!forceRefresh && 
        usersCache.data && 
        usersCache.data[cacheKey] && 
        (now - usersCache.timestamp < usersCache.expiryTime)) {
      console.log('Retornando usuarios desde caché para:', cacheKey);
      // Añadir encabezados para indicar que se está usando caché
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(usersCache.data[cacheKey]);
    }
    
    console.log('Consultando usuarios desde base de datos para:', cacheKey);
    
    // Si no hay caché o expiró, consultar la base de datos
    let query = {};
    
    // Si es un admin de tenant o se específica un tenant, filtrar por tenantId
    if (tenantId) {
      query.tenantId = tenantId;
    }
    
    const users = await User.find(query).select('-password').lean();
    
    // Inicializar la estructura de caché si es necesario
    if (!usersCache.data) {
      usersCache.data = {};
    }
    
    // Actualizar caché
    usersCache.data[cacheKey] = users;
    usersCache.timestamp = now;
    
    // Registrar en auditoría
    await auditService.logAction({
      action: 'view',
      entityType: 'user',
      description: 'Listado de usuarios',
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      tenantId: tenantId,
      ipAddress: req.ip
    });
    
    // Indicar que los datos son frescos
    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(users);
  } catch (error) {
    console.error('Error en getAllUsers:', error);
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
};

// Obtener información del usuario actual
exports.getCurrentUser = async (req, res) => {
  try {
    // Asegurarse de que el usuario pertenece al tenant actual
    const tenantId = req.tenant ? req.tenant._id : null;
    
    // Construir query
    let query = { _id: req.user.id };
    
    // Si hay un tenant en el contexto y el usuario no es superAdmin, verificar que pertenezca a este tenant
    if (tenantId && req.user.role !== 'superAdmin') {
      query.tenantId = tenantId;
    }
    
    const user = await User.findOne(query).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Error al obtener usuario actual:', error);
    res.status(500).json({ message: 'Error al obtener usuario', error: error.message });
  }
};