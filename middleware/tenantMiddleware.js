// middleware/tenantMiddleware.js
const Tenant = require('../models/Tenant');

/**
 * Middleware para extraer y validar el tenant basado en el subdominio
 */
const extractTenantMiddleware = async (req, res, next) => {
  try {
    // Si la ruta comienza con /api/admin, es para el panel de superadmin
    if (req.path.startsWith('/api/admin')) {
      return next();
    }
    
    // Extraer subdominio de la URL
    const host = req.headers.host;
    const hostParts = host.split('.');
    
    // Manejar diferentes ambientes
    let subdomain;
    
    if (hostParts.length > 1) {
      // Entorno de producción o staging con subdominios
      subdomain = hostParts[0];
      
      // Ignorar subdominios especiales como 'www' o 'api'
      if (subdomain === 'www' || subdomain === 'api' || subdomain === 'admin') {
        return res.status(400).json({ error: 'Subdominio inválido' });
      }
    } else {
      // Para desarrollo local usando localhost sin subdominio
      // Extraer de un header personalizado o query param
      subdomain = req.headers['x-tenant-id'] || req.query.tenant;
      
      if (!subdomain) {
        // Si no hay subdominio ni parámetro, devolver error
        return res.status(400).json({ error: 'Tenant no especificado' });
      }
    }
    
    console.log(`Subdomain detectado: ${subdomain}`);
    
    // Buscar el tenant en la base de datos
    const tenant = await Tenant.findOne({ 
      subdomain, 
      status: { $ne: 'cancelled' } 
    });
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    
    // Si el tenant está suspendido, mostrar mensaje específico
    if (tenant.status === 'suspended') {
      return res.status(403).json({ 
        error: 'Tenant suspendido', 
        message: 'El acceso a esta cuenta ha sido suspendido. Contacte al administrador.' 
      });
    }
    
    // Adjuntar tenant al objeto request
    req.tenant = tenant;
    req.tenantId = tenant._id;
    console.log(`Tenant encontrado: ${tenant.name} (${tenant._id})`);
    
    next();
  } catch (error) {
    console.error('Error en middleware de tenant:', error);
    res.status(500).json({ error: 'Error al procesar el tenant' });
  }
};

module.exports = extractTenantMiddleware;