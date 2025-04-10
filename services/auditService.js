// services/auditService.js
const Audit = require('../models/Audit');

/**
 * Servicio para centralizar la lógica de auditoría
 */
const auditService = {
  /**
   * Registra una acción en el sistema de auditoría
   * @param {Object} auditData Datos de la acción a auditar
   * @returns {Promise} Promise con el resultado de la operación
   */
  logAction: async (auditData) => {
    try {
      // Validar campos requeridos
      if (!auditData.action || !auditData.entityType || !auditData.description || 
          !auditData.userId || !auditData.username || !auditData.userRole) {
        throw new Error('Faltan campos requeridos para el registro de auditoría');
      }
      
      // Crear registro de auditoría
      const audit = new Audit({
        action: auditData.action,
        entityType: auditData.entityType,
        entityId: auditData.entityId || null,
        description: auditData.description,
        details: auditData.details || {},
        userId: auditData.userId,
        username: auditData.username,
        userRole: auditData.userRole,
        impersonatedBy: auditData.impersonatedBy || null,
        tenantId: auditData.tenantId || null,
        ipAddress: auditData.ipAddress || null,
      });
      
      await audit.save();
      return audit;
    } catch (error) {
      console.error('Error al registrar auditoría:', error);
      // No queremos que un error en auditoría detenga la operación principal
      // pero sí queremos registrarlo para depuración
      return null;
    }
  },
  
  /**
   * Obtiene registros de auditoría con filtros opcionales
   * @param {Object} filters Criterios de filtrado
   * @param {Object} options Opciones de paginación y ordenamiento
   * @returns {Promise} Promise con los resultados
   */
  getAuditLogs: async (filters = {}, options = {}) => {
    try {
      const query = {};
      
      // Aplicar filtros
      if (filters.action) query.action = filters.action;
      if (filters.entityType) query.entityType = filters.entityType;
      if (filters.entityId) query.entityId = filters.entityId;
      if (filters.userId) query.userId = filters.userId;
      if (filters.tenantId) query.tenantId = filters.tenantId;
      if (filters.username) query.username = { $regex: filters.username, $options: 'i' };
      
      // Filtro por rango de fechas
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) {
          let endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          query.timestamp.$lte = endDate;
        }
      }
      
      // Configurar opciones de paginación
      const limit = options.limit || 50;
      const page = options.page || 1;
      const skip = (page - 1) * limit;
      
      // Configurar ordenamiento
      const sort = options.sort || { timestamp: -1 };
      
      // Ejecutar consulta con paginación
      const logs = await Audit.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
      
      // Obtener total para paginación
      const total = await Audit.countDocuments(query);
      
      return {
        logs,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          limit
        }
      };
    } catch (error) {
      console.error('Error al obtener registros de auditoría:', error);
      throw error;
    }
  },

  /**
   * Agrega estadísticas por tipo de acción
   * @param {Object} filter Filtro para la agregación
   * @returns {Promise<Array>} Resultados de la agregación
   */
  aggregateActionStats: async (filter) => {
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
  },

  /**
   * Agrega estadísticas por tipo de entidad
   * @param {Object} filter Filtro para la agregación
   * @returns {Promise<Array>} Resultados de la agregación
   */
  aggregateEntityTypeStats: async (filter) => {
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
  },

  /**
   * Agrega estadísticas de usuarios más activos
   * @param {Object} filter Filtro para la agregación
   * @returns {Promise<Array>} Resultados de la agregación
   */
  aggregateTopUsers: async (filter) => {
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
  }
};

module.exports = auditService;