// controllers/adminMetricsController.js
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const mongoose = require('mongoose');
const auditService = require('../services/auditService');

/**
 * Controlador para métricas y estadísticas de administración 
 */
const adminMetricsController = {
  /**
   * Obtener estadísticas de uso por tenant
   * @route GET /api/admin/metrics/usage
   */
  getTenantUsageMetrics: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      // Opcionalmente filtrar por tenant específico
      const { tenantId } = req.query;
      const filter = tenantId ? { _id: mongoose.Types.ObjectId(tenantId) } : {};

      // Obtener todos los tenants activos
      const tenants = await Tenant.find({
        ...filter,
        status: { $in: ['active', 'trial'] }
      }).select('name subdomain plan status createdAt');

      // Resultados a devolver
      const results = [];

      // Para cada tenant, obtener estadísticas
      for (const tenant of tenants) {
        // Ejecutar consultas en paralelo para mejorar rendimiento
        const [
          usersCount,
          productsCount,
          salesCount,
          salesTotal,
          purchasesCount,
          purchasesTotal,
          storageUsed
        ] = await Promise.all([
          // Conteo de usuarios
          User.countDocuments({ tenantId: tenant._id }),
          
          // Conteo de productos
          Product.countDocuments({ tenantId: tenant._id }),
          
          // Conteo de ventas
          Sale.countDocuments({ tenantId: tenant._id }),
          
          // Total de ventas
          Sale.aggregate([
            { $match: { tenantId: mongoose.Types.ObjectId(tenant._id) } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]).then(result => (result.length > 0 ? result[0].total : 0)),
          
          // Conteo de compras
          Purchase.countDocuments({ tenantId: tenant._id }),
          
          // Total de compras
          Purchase.aggregate([
            { $match: { tenantId: mongoose.Types.ObjectId(tenant._id) } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]).then(result => (result.length > 0 ? result[0].total : 0)),
          
          // Uso de almacenamiento (tamaño de archivos en GridFS)
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
                  totalSize: { $sum: '$length' } 
                } 
              }
            ]).toArray()
            .then(result => (result.length > 0 ? result[0].totalSize : 0))
        ]);

        // Calcular límites según el plan
        const limits = {
          users: tenant.settings?.maxUsers || (tenant.plan === 'free' ? 3 : tenant.plan === 'basic' ? 10 : tenant.plan === 'premium' ? 25 : 100),
          products: tenant.settings?.maxProducts || (tenant.plan === 'free' ? 50 : tenant.plan === 'basic' ? 500 : tenant.plan === 'premium' ? 5000 : 50000),
          storage: tenant.settings?.maxStorage || (tenant.plan === 'free' ? 100 : tenant.plan === 'basic' ? 1024 : tenant.plan === 'premium' ? 10240 : 102400) // En MB
        };

        // Convertir bytes a MB para almacenamiento
        const storageUsedMB = Math.round(storageUsed / (1024 * 1024) * 100) / 100;

        // Añadir al resultado
        results.push({
          tenant: {
            id: tenant._id,
            name: tenant.name,
            subdomain: tenant.subdomain,
            plan: tenant.plan,
            status: tenant.status,
            createdAt: tenant.createdAt
          },
          usage: {
            users: {
              count: usersCount,
              limit: limits.users,
              percentage: Math.round((usersCount / limits.users) * 100)
            },
            products: {
              count: productsCount,
              limit: limits.products,
              percentage: Math.round((productsCount / limits.products) * 100)
            },
            storage: {
              used: storageUsedMB,
              limit: limits.storage,
              percentage: Math.round((storageUsedMB / limits.storage) * 100)
            },
            sales: {
              count: salesCount,
              total: salesTotal
            },
            purchases: {
              count: purchasesCount,
              total: purchasesTotal
            }
          }
        });
      }

      // Registrar en auditoría
      await auditService.logAction({
        action: 'view',
        entityType: 'tenant',
        description: `Consulta de métricas de uso de tenants${tenantId ? ' para tenant específico' : ''}`,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });

      res.status(200).json({
        tenantCount: results.length,
        metrics: results
      });
    } catch (error) {
      console.error('Error al obtener métricas de uso por tenant:', error);
      res.status(500).json({ message: 'Error al obtener métricas de uso', error: error.message });
    }
  },

  /**
   * Obtener métricas de crecimiento para la plataforma
   * @route GET /api/admin/metrics/growth
   */
  getGrowthMetrics: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      // Obtener rango de fechas (por defecto: últimos 12 meses)
      const { months = 12 } = req.query;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - parseInt(months));

      // Generar el primer día de cada mes en el rango
      const monthlyDates = [];
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        monthlyDates.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Convertir fechas a formato YYYY-MM
      const monthlyLabels = monthlyDates.map(date => 
        date.toISOString().substring(0, 7)
      );

      // Consultas de agregación para obtener datos mensuales
      // 1. Crecimiento de tenants por mes
      const tenantGrowth = await Tenant.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { 
          $sort: { '_id.year': 1, '_id.month': 1 } 
        }
      ]);

      // 2. Crecimiento de usuarios por mes
      const userGrowth = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { 
          $sort: { '_id.year': 1, '_id.month': 1 } 
        }
      ]);

      // 3. Ventas por mes
      const salesGrowth = await Sale.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' }
            },
            count: { $sum: 1 },
            amount: { $sum: '$totalAmount' }
          }
        },
        { 
          $sort: { '_id.year': 1, '_id.month': 1 } 
        }
      ]);

      // Transformar los datos agregados a series de tiempo completas
      const formatGrowthData = (growthData, valueField = 'count') => {
        const dataMap = {};
        
        // Inicializar el mapa con ceros para todos los meses
        monthlyLabels.forEach(month => {
          dataMap[month] = 0;
        });
        
        // Rellenar con datos reales
        growthData.forEach(item => {
          const year = item._id.year;
          // Asegurarse de que el mes tenga dos dígitos
          const month = String(item._id.month).padStart(2, '0');
          const key = `${year}-${month}`;
          
          if (dataMap.hasOwnProperty(key)) {
            dataMap[key] = item[valueField];
          }
        });
        
        // Convertir mapa a arreglo
        return monthlyLabels.map(month => ({
          month,
          value: dataMap[month]
        }));
      };

      // Crear respuesta con series de tiempo completas
      const response = {
        timeRange: {
          startDate,
          endDate,
          months: monthlyLabels
        },
        tenants: formatGrowthData(tenantGrowth),
        users: formatGrowthData(userGrowth),
        sales: {
          count: formatGrowthData(salesGrowth, 'count'),
          amount: formatGrowthData(salesGrowth, 'amount')
        }
      };

      // Añadir totales
      response.totals = {
        tenants: await Tenant.countDocuments(),
        users: await User.countDocuments(),
        sales: await Sale.countDocuments(),
        salesAmount: await Sale.aggregate([
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]).then(result => (result.length > 0 ? result[0].total : 0))
      };

      // Registrar en auditoría
      await auditService.logAction({
        action: 'view',
        entityType: 'platform',
        description: `Consulta de métricas de crecimiento de plataforma (${months} meses)`,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });

      res.status(200).json(response);
    } catch (error) {
      console.error('Error al obtener métricas de crecimiento:', error);
      res.status(500).json({ message: 'Error al obtener métricas de crecimiento', error: error.message });
    }
  }
};

module.exports = adminMetricsController;