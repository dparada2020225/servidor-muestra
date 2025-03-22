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
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'your_jwt_secret_key',
    { expiresIn: '24h' }
  );
};

// Registrar un nuevo usuario
exports.register = async (req, res) => {
  try {
    // Verificar si el usuario que está creando es admin (solo admins pueden crear otros admins)
    if (req.body.role === 'admin') {
      // Si no hay token o el usuario no es admin, rechazar
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'No tienes permiso para crear administradores' });
      }
    }

    const { username, password, role } = req.body;
    
    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso' });
    }
    
    // Crear nuevo usuario
    const newUser = new User({
      username,
      password,
      role: role || 'user' // Por defecto es 'user'
    });
    
    await newUser.save();
    
    // No enviar el password en la respuesta
    const userResponse = {
      _id: newUser._id,
      username: newUser.username,
      role: newUser.role
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
    
    // Buscar usuario
    const user = await User.findOne({ username });
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
        role: user.role
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
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    
    // Forzar actualización si se proporciona un parámetro específico
    const forceRefresh = req.query.forceRefresh === 'true';
    
    // Verificar si tenemos datos en caché válidos
    const now = Date.now();
    if (!forceRefresh && usersCache.data && (now - usersCache.timestamp < usersCache.expiryTime)) {
      console.log('Retornando usuarios desde caché');
      // Añadir encabezados para indicar que se está usando caché
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(usersCache.data);
    }
    
    console.log('Consultando usuarios desde base de datos');
    
    // Si no hay caché o expiró, consultar la base de datos
    const users = await User.find().select('-password').lean();
    
    // Actualizar caché
    usersCache.data = users;
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
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuario', error: error.message });
  }
};