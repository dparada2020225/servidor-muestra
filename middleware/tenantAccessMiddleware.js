// middleware/tenantAccessMiddleware.js
/**
 * Middleware para verificar que el usuario tiene acceso al tenant actual
 */
const tenantAccessMiddleware = (req, res, next) => {
    // Ignorar validación para superAdmin
    if (req.user && ['superAdmin', 'superAdminLimited'].includes(req.user.role)) {
      return next();
    }
    
    // Si no hay tenant en la solicitud (puede pasar en desarrollo), continuar
    if (!req.tenant && process.env.NODE_ENV === 'development') {
      return next();
    }
    
    // Verificar si el usuario pertenece al tenant
    if (!req.user.tenantId || !req.tenant || 
        req.user.tenantId.toString() !== req.tenant._id.toString()) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a este tenant' });
    }
    
    next();
  };
  
  module.exports = tenantAccessMiddleware;