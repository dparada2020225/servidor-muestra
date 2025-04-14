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
    
    // MODIFICACIÓN IMPORTANTE: Orden de prioridad para detectar el tenant
    
    // 1. Primero intentar desde el header específico X-Tenant-ID
    if (req.headers['x-tenant-id']) {
      subdomain = req.headers['x-tenant-id'];
      console.log(`Tenant obtenido de header X-Tenant-ID: ${subdomain}`);
    } 
    // 2. Luego intentar desde query params (para compatibilidad con desarrollo)
    else if (req.query.tenantId) {
      subdomain = req.query.tenantId;
      console.log(`Tenant obtenido de query param tenantId: ${subdomain}`);
    }
    // 3. Luego intentar desde el body (para formularios)
    else if (req.body && req.body.tenantId) {
      subdomain = req.body.tenantId;
      console.log(`Tenant obtenido del body: ${subdomain}`);
    }
    // 4. Por último intentar desde el host
    else {
      const host = req.headers.host;
      console.log(`Analizando host: ${host}`);
      
      if (host) {
        const hostParts = host.split('.');
        
        // Para desarrollo con subdominio en localhost
        if (hostParts.length > 1) {
          subdomain = hostParts[0];
          
          // Ignorar subdominios especiales
          if (subdomain === 'www' || subdomain === 'api' || subdomain === 'admin') {
            return res.status(400).json({ error: 'Subdominio inválido' });
          }
          
          console.log(`Subdominio extraído del host: ${subdomain}`);
        } 
        else {
          // No se pudo detectar subdominio
          return res.status(400).json({ error: 'Tenant no especificado' });
        }
      } else {
        // No hay host en el header
        return res.status(400).json({ error: 'Host no especificado' });
      }
    }
    
    // Validar subdomain
    if (!subdomain || subdomain === 'www' || subdomain === 'api' || subdomain === 'admin') {
      return res.status(400).json({ message: 'Subdomain inválido' });
    }
    
    // Buscar el tenant en la base de datos
    const tenant = await Tenant.findOne({ 
      subdomain, 
      status: { $ne: 'cancelled' } 
    });
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant no encontrado' });
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