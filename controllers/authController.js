// controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

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

    const { username, password, role } = req.body;
    
    // Obtener tenantId del contexto actual
    const tenantId = req.tenant ? req.tenant._id : null;
    
    // Si no es superAdmin, se requiere tenantId
    if (!tenantId && req.user.role !== 'superAdmin') {
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
      tenantId
    });
    
    await newUser.save();
    
    // No enviar el password en la respuesta
    const userResponse = {
      _id: newUser._id,
      username: newUser.username,
      role: newUser.role,
      tenantId: newUser.tenantId
    };
    
    // Invalidar caché después de crear un nuevo usuario
    usersCache.data = null;
    
    res.status(201).json({ message: 'Usuario creado exitosamente', user: userResponse });
    
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar usuario', error: error.message });
  }
};

// Iniciar sesión
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Si hay un tenant en el contexto, buscar el usuario en ese tenant
    const tenantId = req.tenant ? req.tenant._id : null;
    
    // Buscar usuario
    let query = { username };
    
    // Solo agregar tenantId al query si existe en el contexto (para subdominios específicos)
    if (tenantId) {
      query.tenantId = tenantId;
    }
    
    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    // Verificar contraseña
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    // Generar token
    const token = generateToken(user);
    
    // Respuesta
    res.status(200).json({
      message: 'Login exitoso',
      token,
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId
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
    
    const tenantId = req.tenant ? req.tenant._id : null;
    
    // Si no es superAdmin, se requiere tenantId
    if (!tenantId && req.user.role !== 'superAdmin') {
      return res.status(400).json({ message: 'Se requiere tenant para listar usuarios' });
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
      console.log('Retornando usuarios desde caché');
      // Añadir encabezados para indicar que se está usando caché
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(usersCache.data[cacheKey]);
    }
    
    console.log('Consultando usuarios desde base de datos');
    
    // Si no hay caché o expiró, consultar la base de datos
    let query = {};
    
    // Si es un admin de tenant, solo listar usuarios de su tenant
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
    res.status(500).json({ message: 'Error al obtener usuario', error: error.message });
  }
};