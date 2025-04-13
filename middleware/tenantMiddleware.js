// middleware/tenantMiddleware.js
const Tenant = require('../models/Tenant');

/**
 * Middleware para extraer y validar el tenant basado en el subdominio
 */
const extractTenantMiddleware = async (req, res, next) => {
  try {
    // Lista de rutas que no requieren verificación de tenant
    const excludedPaths = [
      '/api/admin',
      '/images/',
      '/api/debug',
      '/upload'
    ];

    // Verificar si la ruta actual debe excluirse de la verificación de tenant
    for (const path of excludedPaths) {
      if (req.path.startsWith(path)) {
        console.log(`Ruta ${req.path} excluida de verificación de tenant`);
        return next();
      }
    }
    
    // Si es una ruta básica como '/' o rutas de test
    if (req.path === '/' || req.path === '/api/test') {
      return next();
    }
    
    // Extraer subdominio de la URL o headers
    let subdomain;
    
    // Primero intentar desde headers específicos
    if (req.headers['x-tenant-id']) {
      subdomain = req.headers['x-tenant-id'];
      console.log(`Tenant obtenido de header X-Tenant-ID: ${subdomain}`);
    } 
    // Luego intentar desde el host
    else {
      const host = req.headers.host;
      const hostParts = host.split('.');
      
      // Entorno de producción o staging con subdominios
      if (hostParts.length > 1) {
        subdomain = hostParts[0];
        
        // Ignorar subdominios especiales como 'www' o 'api'
        if (subdomain === 'www' || subdomain === 'api' || subdomain === 'admin') {
          return res.status(400).json({ error: 'Subdominio inválido' });
        }
      } 
      // Para desarrollo local usando localhost sin subdominio
      else {
        // Extraer de un query param
        subdomain = req.query.tenant;
        
        if (!subdomain) {
          // Si no hay subdominio ni parámetro, devolver error
          return res.status(400).json({ error: 'Tenant no especificado' });
        }
      }
      console.log(`Subdomain detectado: ${subdomain}`);
    }
    
    // Si tenemos el subdomain en body (para formularios), es prioritario
    if (req.body && req.body.tenantId) {
      subdomain = req.body.tenantId;
      console.log(`Tenant obtenido del body: ${subdomain}`);
    }
    
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