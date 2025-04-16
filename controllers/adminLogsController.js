// controllers/adminLogsController.js
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Audit = require('../models/Audit');
const auditService = require('../services/auditService');
const { connectDB } = require('../db');

/**
 * Controlador para logs del sistema y herramientas de diagnóstico
 */
const adminLogsController = {
  /**
   * Obtener logs del sistema para un tenant específico o todos los tenants
   * @route GET /api/admin/logs/system
   */
  getSystemLogs: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      // Parámetros de consulta
      const { 
        tenantId, 
        level = 'info', 
        startDate, 
        endDate, 
        component, 
        limit = 100, 
        page = 1 
      } = req.query;

      // Construir filtro base
      const filter = {};
      
      // Filtrar por nivel de log
      if (level !== 'all') {
        filter.level = level;
      }

      // Filtrar por tenant si se proporciona
      if (tenantId) {
        filter.tenantId = tenantId;
      }

      // Filtrar por componente
      if (component) {
        filter.component = component;
      }

      // Filtrar por fecha
      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) {
          filter.timestamp.$gte = new Date(startDate);
        }
        if (endDate) {
          // Ajustar el endDate para incluir todo el día
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          filter.timestamp.$lte = endDateTime;
        }
      }

      // Verificar si es una consulta de auditoría
      const isAuditQuery = component === 'audit';

      // Consultar registros de auditoría
      if (isAuditQuery) {
        // Usamos el servicio existente de auditoría
        const auditFilter = {};
        
        if (tenantId) {
          auditFilter.tenantId = mongoose.Types.ObjectId(tenantId);
        }
        
        if (startDate || endDate) {
          auditFilter.timestamp = {};
          if (startDate) auditFilter.timestamp.$gte = new Date(startDate);
          if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            auditFilter.timestamp.$lte = endDateTime;
          }
        }

        const auditOptions = {
          page: parseInt(page),
          limit: parseInt(limit),
          sort: { timestamp: -1 }
        };

        const auditResult = await auditService.getAuditLogs(auditFilter, auditOptions);
        
        // Registrar en auditoría
        await auditService.logAction({
          action: 'view',
          entityType: 'system',
          description: `Consulta de logs de auditoría${tenantId ? ' para tenant específico' : ''}`,
          userId: req.user.id,
          username: req.user.username,
          userRole: req.user.role,
          ipAddress: req.ip
        });

        return res.status(200).json({
          source: 'audit',
          logs: auditResult.logs,
          pagination: auditResult.pagination
        });
      }

      // Simulación de logs del sistema (como no hay una implementación real de logs)
      // En un sistema real, estos logs vendrían de un archivo o servicio de logs

      // Generar datos simulados
      const generateMockLogs = (count, tenantId) => {
        const mockLogs = [];
        const levels = ['info', 'warn', 'error', 'debug'];
        const components = ['server', 'database', 'auth', 'api', 'tenant', 'scheduler'];
        const messages = [
          'Servidor iniciado correctamente',
          'Conexión a base de datos establecida',
          'Reconexión a MongoDB después de error temporal',
          'Intento de acceso no autorizado',
          'Timeout en solicitud API',
          'Carga de CPU alta detectada',
          'Memoria RAM en uso elevada',
          'Error de validación en datos de entrada',
          'Peticiones lentas detectadas',
          'Caché reiniciado',
          'Error al procesar pago',
          'Tarea programada completada'
        ];

        // Fecha base (hace una semana)
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() - 7);

        for (let i = 0; i < count; i++) {
          const level = levels[Math.floor(Math.random() * levels.length)];
          const component = components[Math.floor(Math.random() * components.length)];
          const message = messages[Math.floor(Math.random() * messages.length)];
          
          // Fecha aleatoria entre hace una semana y ahora
          const timestamp = new Date(baseDate.getTime() + Math.random() * (Date.now() - baseDate.getTime()));
          
          // Añadir log con el tenant correcto
          mockLogs.push({
            id: `mock-log-${i}`,
            timestamp,
            level,
            component,
            message: `[${component.toUpperCase()}] ${message}`,
            tenantId,
            details: {
              ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
              user: Math.random() > 0.7 ? 'system' : `user-${Math.floor(Math.random() * 1000)}`,
              duration: Math.floor(Math.random() * 1000)
            }
          });
        }

        // Ordenar por fecha, más recientes primero
        return mockLogs.sort((a, b) => b.timestamp - a.timestamp);
      };

      // Mock logs
      const totalLogs = 1000; // Simular 1000 logs
      const allMockLogs = generateMockLogs(totalLogs, tenantId);
      
      // Filtrar los logs según los criterios
      let filteredLogs = allMockLogs;
      
      // Aplicar filtros
      if (level !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.level === level);
      }
      
      if (component && component !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.component === component);
      }
      
      if (startDate) {
        const startDateTime = new Date(startDate);
        filteredLogs = filteredLogs.filter(log => log.timestamp >= startDateTime);
      }
      
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filteredLogs = filteredLogs.filter(log => log.timestamp <= endDateTime);
      }

      // Paginación
      const paginatedLogs = filteredLogs.slice(
        (parseInt(page) - 1) * parseInt(limit),
        parseInt(page) * parseInt(limit)
      );

      // Registrar en auditoría
      await auditService.logAction({
        action: 'view',
        entityType: 'system',
        description: `Consulta de logs del sistema${tenantId ? ' para tenant específico' : ''}`,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });

      res.status(200).json({
        source: 'system',
        logs: paginatedLogs,
        pagination: {
          total: filteredLogs.length,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(filteredLogs.length / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error al obtener logs del sistema:', error);
      res.status(500).json({ message: 'Error al obtener logs del sistema', error: error.message });
    }
  },

  /**
   * Obtener herramientas de diagnóstico para un tenant específico
   * @route GET /api/admin/support/diagnostics
   */
  getTenantDiagnostics: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      // Obtener tenant
      const { tenantId } = req.query;
      
      if (!tenantId) {
        return res.status(400).json({ message: 'Se requiere ID de tenant' });
      }

      const tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }

      // Comprobar estado de la base de datos
      const conn = mongoose.connection;
      const dbStatus = {
        connected: conn.readyState === 1,
        readyState: conn.readyState
      };

      // Realizar verificaciones de diagnóstico
      const [
        usersCount,
        adminCount,
        productsCount,
        salesCount,
        purchasesCount,
        recentAuditLogs,
        storageInfo
      ] = await Promise.all([
        // Conteo total de usuarios
        User.countDocuments({ tenantId: tenant._id }),
        
        // Conteo de administradores
        User.countDocuments({ 
          tenantId: tenant._id,
          role: 'tenantAdmin',
          isActive: true
        }),
        
        // Conteo de productos
        Product.countDocuments({ tenantId: tenant._id }),
        
        // Conteo de ventas
        Sale.countDocuments({ tenantId: tenant._id }),
        
        // Conteo de compras
        Purchase.countDocuments({ tenantId: tenant._id }),
        
        // Últimos logs de auditoría
        Audit.find({ tenantId: tenant._id })
          .sort({ timestamp: -1 })
          .limit(10)
          .lean(),
          
        // Info de almacenamiento
        mongoose.connection.db.collection('uploads.files')
          .aggregate([
            { 
              $match: { 
                'metadata.tenantId': tenant._id.toString() 
              } 
            },
            { 
              $group: { 
                _id: null, 
                totalSize: { $sum: '$length' },
                count: { $sum: 1 },
                avgSize: { $avg: '$length' }
              } 
            }
          ]).toArray()
          .then(result => (result.length > 0 ? result[0] : { totalSize: 0, count: 0, avgSize: 0 }))
      ]);

      // Verificar si hay usuarios de cada tipo
      const roleCheck = {
        hasAdmin: adminCount > 0,
        adminCount,
        usersCount
      };

      // Verificar límites del plan
      const planLimits = {
        users: {
          limit: tenant.settings?.maxUsers || 5,
          current: usersCount,
          percentage: Math.round((usersCount / (tenant.settings?.maxUsers || 5)) * 100),
          exceeded: usersCount > (tenant.settings?.maxUsers || 5)
        },
        products: {
          limit: tenant.settings?.maxProducts || 100,
          current: productsCount,
          percentage: Math.round((productsCount / (tenant.settings?.maxProducts || 100)) * 100),
          exceeded: productsCount > (tenant.settings?.maxProducts || 100)
        },
        storage: {
          limit: tenant.settings?.maxStorage || 100, // MB
          current: Math.round(storageInfo.totalSize / (1024 * 1024) * 100) / 100, // Convertir a MB
          percentage: Math.round((storageInfo.totalSize / (1024 * 1024)) / (tenant.settings?.maxStorage || 100) * 100),
          exceeded: (storageInfo.totalSize / (1024 * 1024)) > (tenant.settings?.maxStorage || 100)
        }
      };

      // Registrar en auditoría
      await auditService.logAction({
        action: 'view',
        entityType: 'tenant',
        entityId: tenant._id,
        description: `Ejecución de diagnóstico para tenant: ${tenant.name}`,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });

      // Construir respuesta con toda la información de diagnóstico
      res.status(200).json({
        tenant: {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          status: tenant.status,
          plan: tenant.plan,
          createdAt: tenant.createdAt
        },
        database: dbStatus,
        roleCheck,
        planLimits,
        counts: {
          users: usersCount,
          products: productsCount,
          sales: salesCount,
          purchases: purchasesCount,
          uploads: storageInfo.count
        },
        storage: {
          totalSize: storageInfo.totalSize,
          totalSizeMB: Math.round(storageInfo.totalSize / (1024 * 1024) * 100) / 100,
          fileCount: storageInfo.count,
          averageFileSize: Math.round(storageInfo.avgSize / 1024 * 100) / 100 // KB
        },
        recentActivity: recentAuditLogs,
        recommendations: [
          // Generar recomendaciones basadas en las verificaciones
          ...(adminCount === 0 ? [{
            type: 'critical',
            message: 'No hay administradores activos en este tenant. Debe crear uno.'
          }] : []),
          ...(planLimits.users.exceeded ? [{
            type: 'warning',
            message: `El límite de usuarios (${planLimits.users.limit}) ha sido excedido.`
          }] : []),
          ...(planLimits.products.exceeded ? [{
            type: 'warning',
            message: `El límite de productos (${planLimits.products.limit}) ha sido excedido.`
          }] : []),
          ...(planLimits.storage.exceeded ? [{
            type: 'warning',
            message: `El límite de almacenamiento (${planLimits.storage.limit} MB) ha sido excedido.`
          }] : []),
          ...(planLimits.storage.percentage > 90 && !planLimits.storage.exceeded ? [{
            type: 'info',
            message: `El almacenamiento está por encima del 90% de su capacidad. Considere actualizar el plan.`
          }] : [])
        ]
      });
    } catch (error) {
      console.error('Error al obtener diagnóstico del tenant:', error);
      res.status(500).json({ message: 'Error al obtener diagnóstico', error: error.message });
    }
  }
};

module.exports = adminLogsController;