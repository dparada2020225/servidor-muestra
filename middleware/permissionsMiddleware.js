// middleware/permissionsMiddleware.js
/**
 * Middleware para verificar permisos granulares basados en roles y tenant
 */

// Definición centralizada de permisos por rol
const rolePermissions = {
    // Superadmin tiene todos los permisos
    superAdmin: ['*'],
    
    // Permisos para admin de tenant
    tenantAdmin: [
      'manage_users',           // Gestionar usuarios del tenant
      'manage_roles',           // Gestionar roles dentro del tenant
      'manage_products',        // CRUD de productos
      'manage_inventory',       // Gestionar inventario
      'manage_sales',           // Crear y gestionar ventas
      'manage_purchases',       // Crear y gestionar compras
      'manage_reports',         // Acceso a reportes completos
      'manage_settings',        // Configuración del tenant
      'view_audit',             // Ver logs de auditoría del tenant
      'export_data'             // Exportar datos del tenant
    ],
    
    // Permisos para gerente de tenant
    tenantManager: [
      'view_users',             // Ver usuarios pero no modificarlos
      'manage_products',        // CRUD de productos
      'manage_inventory',       // Gestionar inventario
      'manage_sales',           // Crear y gestionar ventas
      'manage_purchases',       // Crear y gestionar compras
      'view_reports',           // Ver reportes pero no todos
      'view_settings',          // Ver configuración del tenant
      'export_data'             // Exportar datos del tenant
    ],
    
    // Permisos para usuario básico del tenant
    tenantUser: [
      'view_products',          // Ver productos
      'create_sales',           // Crear ventas
      'view_own_sales',         // Ver sólo sus propias ventas
      'view_basic_reports'      // Ver reportes básicos
    ]
  };
  
  /**
   * Verifica si un usuario tiene un permiso específico
   * @param {Object} user - El usuario a verificar
   * @param {String} permission - El permiso requerido
   * @returns {Boolean} - true si tiene permiso, false en caso contrario
   */
  const hasPermission = (user, permission) => {
    if (!user || !user.role) return false;
    
    // Obtener los permisos del rol del usuario
    const userPerms = rolePermissions[user.role] || [];
    
    // Superadmin o cualquier rol con permiso wildcard '*' tiene todos los permisos
    if (user.role === 'superAdmin' || userPerms.includes('*')) {
      return true;
    }
    
    // Verificar si el usuario tiene el permiso específico
    return userPerms.includes(permission);
  };
  
  /**
   * Middleware para verificar un permiso específico
   * @param {String} permission - El permiso requerido
   * @returns {Function} - Middleware de Express
   */
  const requirePermission = (permission) => {
    return (req, res, next) => {
      // Verificar si el usuario está en req (debería estar si pasó por 'protect')
      if (!req.user) {
        return res.status(401).json({ message: 'No autorizado, inicie sesión' });
      }
      
      // Verificar el permiso
      if (hasPermission(req.user, permission)) {
        next();
      } else {
        res.status(403).json({ 
          message: `Permiso denegado, se requiere: ${permission}`,
          requiredPermission: permission
        });
      }
    };
  };
  
  /**
   * Middleware para verificar múltiples permisos (requiere TODOS los permisos)
   * @param {Array} permissions - Lista de permisos requeridos
   * @returns {Function} - Middleware de Express
   */
  const requireAllPermissions = (permissions) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ message: 'No autorizado, inicie sesión' });
      }
      
      // Verificar cada permiso
      for (const permission of permissions) {
        if (!hasPermission(req.user, permission)) {
          return res.status(403).json({ 
            message: `Permiso denegado, se requiere: ${permission}`,
            requiredPermissions: permissions,
            missingPermission: permission
          });
        }
      }
      
      // Si pasa todas las verificaciones
      next();
    };
  };
  
  /**
   * Middleware para verificar si tiene al menos uno de los permisos
   * @param {Array} permissions - Lista de permisos, de los cuales se requiere al menos uno
   * @returns {Function} - Middleware de Express
   */
  const requireAnyPermission = (permissions) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ message: 'No autorizado, inicie sesión' });
      }
      
      // Verificar si tiene al menos un permiso
      for (const permission of permissions) {
        if (hasPermission(req.user, permission)) {
          return next();
        }
      }
      
      // Si no tiene ninguno
      res.status(403).json({ 
        message: `Permiso denegado, se requiere al menos uno de: ${permissions.join(', ')}`,
        requiredAnyPermission: permissions
      });
    };
  };
  
  // Exportar las funciones y definiciones
  module.exports = {
    rolePermissions,
    hasPermission,
    requirePermission,
    requireAllPermissions,
    requireAnyPermission
  };