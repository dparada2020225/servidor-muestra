// controllers/adminStatisticsController.js
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const auditService = require('../services/auditService');

/**
 * Controlador para estadísticas específicas de la plataforma
 */
const adminStatisticsController = {
  /**
   * Obtener estadísticas generales para el dashboard de superadmin
   * @route GET /api/admin/statistics/dashboard
   */
  getDashboardStats: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      // Fechas para estadísticas
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      // Obtener estadísticas en paralelo para mejorar el rendimiento
      const [
        totalTenants,
        activeTenants,
        suspendedTenants,
        trialTenants,
        cancelledTenants,
        totalUsers,
        tenantsCreatedToday,
        tenantsCreatedThisMonth,
        tenantsCreatedLastMonth,
        usersCreatedToday,
        usersCreatedThisMonth,
        totalProducts,
        totalSales,
        totalPurchases,
        recentTenants
      ] = await Promise.all([
        // Total de tenants
        Tenant.countDocuments(),
        
        // Tenants activos
        Tenant.countDocuments({ status: 'active' }),
        
        // Tenants suspendidos
        Tenant.countDocuments({ status: 'suspended' }),
        
        // Tenants en prueba
        Tenant.countDocuments({ status: 'trial' }),
        
        // Tenants cancelados
        Tenant.countDocuments({ status: 'cancelled' }),
        
        // Total de usuarios
        User.countDocuments(),
        
        // Tenants creados hoy
        Tenant.countDocuments({ createdAt: { $gte: startOfToday } }),
        
        // Tenants creados este mes
        Tenant.countDocuments({ createdAt: { $gte: startOfThisMonth } }),
        
        // Tenants creados el mes pasado
        Tenant.countDocuments({ 
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } 
        }),
        
        // Usuarios creados hoy
        User.countDocuments({ createdAt: { $gte: startOfToday } }),
        
        // Usuarios creados este mes
        User.countDocuments({ createdAt: { $gte: startOfThisMonth } }),
        
        // Total de productos
        Product.countDocuments(),
        
        // Total de ventas
        Sale.countDocuments(),
        
        // Total de compras
        Purchase.countDocuments(),
        
        // Tenants recientes
        Tenant.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .select('name subdomain status createdAt')
      ]);

      // Calcular porcentajes y cambios
      const tenantsByStatus = {
        active: activeTenants,
        suspended: suspendedTenants,
        trial: trialTenants,
        cancelled: cancelledTenants
      };

      const percentagesByStatus = {
        active: totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 100) : 0,
        suspended: totalTenants > 0 ? Math.round((suspendedTenants / totalTenants) * 100) : 0,
        trial: totalTenants > 0 ? Math.round((trialTenants / totalTenants) * 100) : 0,
        cancelled: totalTenants > 0 ? Math.round((cancelledTenants / totalTenants) * 100) : 0
      };

      // Calcular crecimiento de tenants comparado con el mes anterior
      const tenantGrowthRate = tenantsCreatedLastMonth > 0 
        ? Math.round(((tenantsCreatedThisMonth - tenantsCreatedLastMonth) / tenantsCreatedLastMonth) * 100) 
        : 100; // Si no había tenants el mes pasado, el crecimiento es del 100%

      // Registrar en auditoría
      await auditService.logAction({
        action: 'view',
        entityType: 'platform',
        description: 'Consulta de estadísticas de dashboard de plataforma',
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });

      // Construir respuesta
      res.status(200).json({
        tenants: {
          total: totalTenants,
          byStatus: tenantsByStatus,
          percentagesByStatus,
          createdToday: tenantsCreatedToday,
          createdThisMonth: tenantsCreatedThisMonth,
          growthRate: tenantGrowthRate
        },
        users: {
          total: totalUsers,
          createdToday: usersCreatedToday,
          createdThisMonth: usersCreatedThisMonth,
          avgPerTenant: totalTenants > 0 ? Math.round(totalUsers / totalTenants * 10) / 10 : 0
        },
        usage: {
          totalProducts,
          totalSales,
          totalPurchases,
          avgProductsPerTenant: totalTenants > 0 ? Math.round(totalProducts / totalTenants * 10) / 10 : 0
        },
        recentTenants: recentTenants.map(t => ({
          id: t._id,
          name: t.name,
          subdomain: t.subdomain,
          status: t.status,
          createdAt: t.createdAt
        }))
      });
    } catch (error) {
      console.error('Error al obtener estadísticas de dashboard:', error);
      res.status(500).json({ message: 'Error al obtener estadísticas de dashboard', error: error.message });
    }
  },

  /**
   * Obtener estadísticas de tenants activos
   * @route GET /api/admin/statistics/tenants/active
   */
  getActiveTenantStats: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      // Opciones de filtrado por plan
      const { plan } = req.query;
      const planFilter = plan ? { plan } : {};

      // Construir filtro combinado
      const filter = {
        status: { $in: ['active', 'trial'] },
        ...planFilter
      };

      // Obtener tenants con estadísticas básicas
      const tenants = await Tenant.find(filter)
        .select('name subdomain status plan createdAt')
        .sort({ createdAt: -1 });

      // Obtener estadísticas detalladas para cada tenant
      const tenantStats = await Promise.all(
        tenants.map(async (tenant) => {
          const [usersCount, productsCount, salesCount, purchasesCount] = await Promise.all([
            User.countDocuments({ tenantId: tenant._id }),
            Product.countDocuments({ tenantId: tenant._id }),
            Sale.countDocuments({ tenantId: tenant._id }),
            Purchase.countDocuments({ tenantId: tenant._id })
          ]);

          return {
            tenant: {
              id: tenant._id,
              name: tenant.name,
              subdomain: tenant.subdomain,
              status: tenant.status,
              plan: tenant.plan,
              createdAt: tenant.createdAt
            },
            stats: {
              users: usersCount,
              products: productsCount,
              sales: salesCount,
              purchases: purchasesCount
            }
          };
        })
      );

      // Calcular estadísticas resumidas por plan
      const planSummary = {};
      tenantStats.forEach(stat => {
        const plan = stat.tenant.plan;
        if (!planSummary[plan]) {
          planSummary[plan] = {
            count: 0,
            users: 0,
            products: 0,
            sales: 0,
            purchases: 0
          };
        }
        
        planSummary[plan].count++;
        planSummary[plan].users += stat.stats.users;
        planSummary[plan].products += stat.stats.products;
        planSummary[plan].sales += stat.stats.sales;
        planSummary[plan].purchases += stat.stats.purchases;
      });

      // Calcular promedios para cada plan
      Object.keys(planSummary).forEach(plan => {
        const summary = planSummary[plan];
        summary.avgUsersPerTenant = summary.count > 0 ? Math.round(summary.users / summary.count * 10) / 10 : 0;
        summary.avgProductsPerTenant = summary.count > 0 ? Math.round(summary.products / summary.count * 10) / 10 : 0;
        summary.avgSalesPerTenant = summary.count > 0 ? Math.round(summary.sales / summary.count * 10) / 10 : 0;
        summary.avgPurchasesPerTenant = summary.count > 0 ? Math.round(summary.purchases / summary.count * 10) / 10 : 0;
      });

      // Registrar en auditoría
      await auditService.logAction({
        action: 'view',
        entityType: 'tenant',
        description: 'Consulta de estadísticas de tenants activos',
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });

      // Enviar respuesta
      res.status(200).json({
        totalActiveTenants: tenantStats.length,
        planSummary,
        tenants: tenantStats
      });
    } catch (error) {
      console.error('Error al obtener estadísticas de tenants activos:', error);
      res.status(500).json({ message: 'Error al obtener estadísticas de tenants activos', error: error.message });
    }
  },

  /**
   * Obtener gráficos de crecimiento de tenants por período
   * @route GET /api/admin/statistics/tenants/growth
   */
  getTenantGrowthStats: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      // Parámetros de consulta para período
      const { period = 'monthly', months = 12 } = req.query;
      const endDate = new Date();
      const startDate = new Date();

      // Ajustar fecha de inicio según el período solicitado
      if (period === 'monthly') {
        startDate.setMonth(startDate.getMonth() - parseInt(months));
      } else if (period === 'weekly') {
        startDate.setDate(startDate.getDate() - (parseInt(months) * 7));
      } else if (period === 'daily') {
        startDate.setDate(startDate.getDate() - parseInt(months));
      } else {
        return res.status(400).json({ message: 'Período inválido. Use: monthly, weekly, o daily' });
      }

      // Agregación para crecimiento de tenants por período
      let tenantGrowth;
      if (period === 'monthly') {
        tenantGrowth = await Tenant.aggregate([
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
              count: { $sum: 1 },
              byPlan: {
                $push: {
                  plan: '$plan',
                  status: '$status'
                }
              }
            }
          },
          { 
            $sort: { '_id.year': 1, '_id.month': 1 } 
          }
        ]);
      } else if (period === 'weekly') {
        tenantGrowth = await Tenant.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                week: { $week: '$createdAt' }
              },
              count: { $sum: 1 },
              byPlan: {
                $push: {
                  plan: '$plan',
                  status: '$status'
                }
              }
            }
          },
          { 
            $sort: { '_id.year': 1, '_id.week': 1 } 
          }
        ]);
      } else { // daily
        tenantGrowth = await Tenant.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              count: { $sum: 1 },
              byPlan: {
                $push: {
                  plan: '$plan',
                  status: '$status'
                }
              }
            }
          },
          { 
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } 
          }
        ]);
      }

      // Preparar etiquetas de períodos para el gráfico
      let periodLabels = [];
      let currentDate = new Date(startDate);
      
      // Generar todas las etiquetas de períodos
      if (period === 'monthly') {
        while (currentDate <= endDate) {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth() + 1;
          periodLabels.push(`${year}-${month.toString().padStart(2, '0')}`);
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      } else if (period === 'weekly') {
        while (currentDate <= endDate) {
          const year = currentDate.getFullYear();
          const week = Math.ceil((currentDate - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
          periodLabels.push(`${year}-W${week.toString().padStart(2, '0')}`);
          currentDate.setDate(currentDate.getDate() + 7);
        }
      } else { // daily
        while (currentDate <= endDate) {
          periodLabels.push(currentDate.toISOString().split('T')[0]);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      // Formatear datos para el gráfico
      const formatGrowthData = () => {
        const dataMap = {};
        
        // Inicializar el mapa con ceros para todos los períodos
        periodLabels.forEach(label => {
          dataMap[label] = {
            total: 0,
            byPlan: {
              free: 0,
              basic: 0,
              premium: 0,
              enterprise: 0
            },
            byStatus: {
              active: 0,
              trial: 0,
              suspended: 0,
              cancelled: 0
            }
          };
        });
        
        // Rellenar con datos reales
        tenantGrowth.forEach(item => {
          let label;
          
          if (period === 'monthly') {
            const year = item._id.year;
            const month = item._id.month.toString().padStart(2, '0');
            label = `${year}-${month}`;
          } else if (period === 'weekly') {
            const year = item._id.year;
            const week = item._id.week.toString().padStart(2, '0');
            label = `${year}-W${week}`;
          } else { // daily
            const year = item._id.year;
            const month = item._id.month.toString().padStart(2, '0');
            const day = item._id.day.toString().padStart(2, '0');
            label = `${year}-${month}-${day}`;
          }
          
          if (dataMap[label]) {
            dataMap[label].total = item.count;
            
            // Contar por plan y status
            item.byPlan.forEach(tenant => {
              // Incrementar conteo por plan
              if (tenant.plan && dataMap[label].byPlan[tenant.plan] !== undefined) {
                dataMap[label].byPlan[tenant.plan]++;
              }
              
              // Incrementar conteo por status
              if (tenant.status && dataMap[label].byStatus[tenant.status] !== undefined) {
                dataMap[label].byStatus[tenant.status]++;
              }
            });
          }
        });
        
        // Convertir mapa a arreglo
        return periodLabels.map(label => ({
          period: label,
          total: dataMap[label].total,
          byPlan: dataMap[label].byPlan,
          byStatus: dataMap[label].byStatus
        }));
      };

      // Generar datos acumulados para mostrar crecimiento total
      const generateCumulativeData = (growthData) => {
        let cumulative = {
          total: 0,
          byPlan: {
            free: 0,
            basic: 0,
            premium: 0,
            enterprise: 0
          },
          byStatus: {
            active: 0,
            trial: 0,
            suspended: 0,
            cancelled: 0
          }
        };
        
        return growthData.map(item => {
          // Actualizar acumulados
          cumulative.total += item.total;
          
          Object.keys(item.byPlan).forEach(plan => {
            cumulative.byPlan[plan] += item.byPlan[plan];
          });
          
          Object.keys(item.byStatus).forEach(status => {
            cumulative.byStatus[status] += item.byStatus[status];
          });
          
          // Retornar copia del acumulado actual
          return {
            period: item.period,
            total: cumulative.total,
            byPlan: { ...cumulative.byPlan },
            byStatus: { ...cumulative.byStatus }
          };
        });
      };

      // Formatear datos para gráficos
      const growthData = formatGrowthData();
      const cumulativeData = generateCumulativeData(growthData);

      // Registrar en auditoría
      await auditService.logAction({
        action: 'view',
        entityType: 'tenant',
        description: `Consulta de estadísticas de crecimiento de tenants (${period})`,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });

      // Enviar respuesta
      res.status(200).json({
        period,
        periodLabels,
        growthData,
        cumulativeData
      });
    } catch (error) {
      console.error('Error al obtener estadísticas de crecimiento de tenants:', error);
      res.status(500).json({ message: 'Error al obtener estadísticas de crecimiento', error: error.message });
    }
  }
};

module.exports = adminStatisticsController;