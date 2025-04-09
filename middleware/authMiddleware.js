// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Cache para usuarios autenticados (reduce consultas a BD)
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Verificar si hay token en el header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ message: 'No hay token, autorización denegada' });
    }
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    
    // Comprobar si tenemos el usuario en caché
    const cacheKey = decoded.id;
    const cachedUser = userCache.get(cacheKey);
    const now = Date.now();
    
    if (cachedUser && now - cachedUser.timestamp < CACHE_TTL) {
      // Usar usuario desde caché
      req.user = {
        id: cachedUser.user._id,
        username: cachedUser.user.username,
        role: cachedUser.user.role,
        tenantId: cachedUser.user.tenantId // Añadir tenantId al request
      };
      
      // Verificar que el usuario pertenece al tenant actual
      if (req.tenant && 
          req.user.role !== 'superAdmin' && 
          req.user.tenantId && 
          req.user.tenantId.toString() !== req.tenant._id.toString()) {
        return res.status(403).json({ message: 'No tienes permiso para acceder a este tenant' });
      }
      
      return next();
    }
    
    // Si no está en caché o expiró, consultar BD
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Token no válido o usuario no existe' });
    }
    
    // Actualizar caché
    userCache.set(cacheKey, {
      user,
      timestamp: now
    });
    
    // Añadir usuario al request
    req.user = {
      id: user._id,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId // Añadir tenantId al request
    };
    
    // Verificar que el usuario pertenece al tenant actual
    if (req.tenant && 
        req.user.role !== 'superAdmin' && 
        req.user.tenantId && 
        req.user.tenantId.toString() !== req.tenant._id.toString()) {
      return res.status(403).json({ message: 'No tienes permiso para acceder a este tenant' });
    }
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado' });
    }
    res.status(500).json({ message: 'Error de servidor', error: error.message });
  }
};

// Middleware para verificar si es admin
exports.admin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'tenantAdmin')) {
    next();
  } else {
    res.status(403).json({ message: 'Acceso denegado, se requiere rol de administrador' });
  }
};

// Middleware para verificar si es superadmin
exports.superAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'superAdmin') {
    next();
  } else {
    res.status(403).json({ message: 'Acceso denegado, se requiere rol de superadministrador' });
  }
};

// Middleware para validar permisos específicos
exports.hasPermission = (permission) => {
  return (req, res, next) => {
    // Implementación simple - se podría expandir con un sistema real de permisos
    const rolePermissions = {
      superAdmin: ['*'], // Superadmin tiene todos los permisos
      tenantAdmin: ['manage_users', 'manage_products', 'manage_sales', 'manage_purchases', 'view_reports'],
      tenantManager: ['manage_products', 'manage_sales', 'manage_purchases', 'view_reports'],
      tenantUser: ['view_products', 'create_sales']
    };

    // Si es superAdmin, siempre tiene permiso
    if (req.user.role === 'superAdmin') {
      return next();
    }

    // Verificar si el rol del usuario tiene el permiso requerido
    const userPermissions = rolePermissions[req.user.role] || [];
    if (userPermissions.includes(permission) || userPermissions.includes('*')) {
      next();
    } else {
      res.status(403).json({ 
        message: `Permiso denegado: se requiere el permiso "${permission}"`
      });
    }
  };
};