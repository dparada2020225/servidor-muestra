// controllers/auditController.js
const auditService = require('../services/auditService');

const auditController = {
  /**
   * Obtener registros de auditoría con filtros opcionales
   * @route GET /api/admin/audit
   */
  getAuditLogs: async (req, res) => {
    try {
      // Extraer parámetros de consulta para filtros
      const { 
        action, entityType, entityId, userId, tenantId, 
        username, startDate, endDate, page, limit, sortBy, sortOrder 
      } = req.query;
      
      // Construir objeto de filtros
      const filters = {};
      if (action) filters.action = action;
      if (entityType) filters.entityType = entityType;
      if (entityId) filters.entityId = entityId;
      if (userId) filters.userId = userId;
      if (tenantId) filters.tenantId = tenantId;
      if (username) filters.username = username;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      
      // Construir opciones
      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50
      };
      
      // Configurar ordenamiento
      if (sortBy) {
        options.sort = {};
        options.sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      } else {
        options.sort = { timestamp: -1 }; // Por defecto ordenar por fecha descendente
      }
      
      // Obtener registros
      const result = await auditService.getAuditLogs(filters, options);
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error al obtener logs de auditoría:', error);
      res.status(500).json({ message: 'Error al obtener logs de auditoría', error: error.message });
    }
  },
  
  /**
   * Obtener estadísticas de auditoría
   * @route GET /api/admin/audit/stats
   */
  getAuditStats: async (req, res) => {
    try {
      // Extraer parámetros
      const { tenantId, startDate, endDate } = req.query;
      
      // Construir filtros de tiempo
      const timeFilter = {};
      if (startDate || endDate) {
        timeFilter.timestamp = {};
        if (startDate) timeFilter.timestamp.$gte = new Date(startDate);
        if (endDate) {
          let endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          timeFilter.timestamp.$lte = endDateTime;
        }
      }
      
      // Filtrar por tenant si se especifica
      const tenantFilter = tenantId ? { tenantId } : {};
      
      // Combinar filtros
      const filter = {
        ...timeFilter,
        ...tenantFilter
      };
      
      // Consultas de estadísticas en paralelo
      const [
        totalLogs,
        actionStats,
        entityTypeStats,
        topUsers
      ] = await Promise.all([
        // Total de logs
        auditService.getAuditLogs(filter, { limit: 1 }).then(result => result.pagination.total),
        
        // Estadísticas por tipo de acción
        auditService.aggregateActionStats(filter),
        
        // Estadísticas por tipo de entidad
        auditService.aggregateEntityTypeStats(filter),
        
        // Top usuarios por actividad
        auditService.aggregateTopUsers(filter)
      ]);
      
      res.status(200).json({
        totalLogs,
        actionStats,
        entityTypeStats,
        topUsers
      });
    } catch (error) {
      console.error('Error al obtener estadísticas de auditoría:', error);
      res.status(500).json({ message: 'Error al obtener estadísticas de auditoría', error: error.message });
    }
  }
};

// Agregar métodos de agregación al servicio de auditoría
auditService.aggregateActionStats = async (filter) => {
  try {
    return await Audit.aggregate([
      { $match: filter },
      { $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  } catch (error) {
    console.error('Error en agregación de acciones:', error);
    return [];
  }
};

auditService.aggregateEntityTypeStats = async (filter) => {
  try {
    return await Audit.aggregate([
      { $match: filter },
      { $group: {
          _id: '$entityType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  } catch (error) {
    console.error('Error en agregación de tipos de entidad:', error);
    return [];
  }
};

auditService.aggregateTopUsers = async (filter) => {
  try {
    return await Audit.aggregate([
      { $match: filter },
      { $group: {
          _id: { userId: '$userId', username: '$username' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: {
          _id: 0,
          userId: '$_id.userId',
          username: '$_id.username',
          count: 1
        }
      }
    ]);
  } catch (error) {
    console.error('Error en agregación de usuarios top:', error);
    return [];
  }
};

module.exports = auditController;