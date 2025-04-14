// controllers/dashboardController.js
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const mongoose = require('mongoose');

// Obtener estadísticas generales del dashboard
exports.getStats = async (req, res) => {
  try {
    // Verificar el tenant
    const tenantId = req.tenant ? req.tenant._id : null;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    // Obtener umbral de stock bajo desde la configuración del tenant o usar valor por defecto
    const lowStockThreshold = req.tenant?.settings?.lowStockThreshold || 5;
    
    // Fechas para los datos de los últimos 30 días
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    // Ejecutar consultas en paralelo para mejorar rendimiento
    const [
      totalProducts,
      lowStockProductsCount,
      totalSales,
      totalPurchases,
      recentSales,
      recentPurchases,
      productsWithLowStock
    ] = await Promise.all([
      // Total de productos
      Product.countDocuments({ tenantId }),
      
      // Productos con stock bajo
      Product.countDocuments({ 
        tenantId,
        stock: { $lte: lowStockThreshold }
      }),
      
      // Total de ventas
      Sale.countDocuments({ tenantId }),
      
      // Total de compras
      Purchase.countDocuments({ tenantId }),
      
      // Ventas de los últimos 30 días
      Sale.find({
        tenantId,
        date: { $gte: startDate, $lte: endDate }
      }),
      
      // Compras de los últimos 30 días
      Purchase.find({
        tenantId,
        date: { $gte: startDate, $lte: endDate }
      }),
      
      // Lista de productos con stock bajo
      Product.find({
        tenantId,
        stock: { $lte: lowStockThreshold }
      })
      .sort({ stock: 1 }) // Ordenar por stock, menor primero
      .limit(10) // Limitar a 10 resultados
    ]);
    
    // Calcular montos totales
    const recentSalesAmount = recentSales.reduce(
      (sum, sale) => sum + sale.totalAmount, 0
    );
    
    const recentPurchasesAmount = recentPurchases.reduce(
      (sum, purchase) => sum + purchase.totalAmount, 0
    );
    
    // Crear objeto de respuesta con todas las estadísticas
    const stats = {
      totalProducts,
      lowStockProducts: lowStockProductsCount,
      totalSales,
      totalPurchases,
      recentSalesAmount,
      recentPurchasesAmount,
      recentSalesCount: recentSales.length,
      recentPurchasesCount: recentPurchases.length,
      lowStockThreshold,
      productsWithLowStock
    };
    
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error al obtener estadísticas del dashboard:', error);
    res.status(500).json({ 
      message: 'Error al obtener estadísticas del dashboard',
      error: error.message
    });
  }
};

// Obtener datos de ventas para el gráfico
exports.getSalesChartData = async (req, res) => {
  try {
    // Verificar el tenant
    const tenantId = req.tenant ? req.tenant._id : null;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }
    
    // Obtener parámetros de la consulta
    const days = parseInt(req.query.days) || 30;
    
    // Fechas para el filtro
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Consulta para ventas agrupadas por fecha
    const salesByDate = await Sale.aggregate([
      // Filtrar por tenant y rango de fechas
      {
        $match: {
          tenantId: mongoose.Types.ObjectId(tenantId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      // Extraer solo la fecha (sin hora) para agrupar
      {
        $project: {
          dateOnly: { 
            $dateToString: { format: "%Y-%m-%d", date: "$date" } 
          },
          totalAmount: 1
        }
      },
      // Agrupar por fecha y sumar montos
      {
        $group: {
          _id: "$dateOnly",
          amount: { $sum: "$totalAmount" },
          count: { $sum: 1 }
        }
      },
      // Formato de salida
      {
        $project: {
          _id: 0,
          date: "$_id",
          amount: 1,
          count: 1
        }
      },
      // Ordenar por fecha
      {
        $sort: { date: 1 }
      }
    ]);
    
    // Generar todas las fechas del rango para incluir días sin ventas
    const allDates = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      allDates.push({
        date: dateStr,
        amount: 0,
        count: 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Combinar fechas con datos existentes
    const salesMap = {};
    salesByDate.forEach(item => {
      salesMap[item.date] = item;
    });
    
    const result = allDates.map(item => {
      return salesMap[item.date] || item;
    });
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error al obtener datos de gráfico de ventas:', error);
    res.status(500).json({ 
      message: 'Error al obtener datos de gráfico de ventas',
      error: error.message
    });
  }
};

// Obtener datos de compras para el gráfico
exports.getPurchasesChartData = async (req, res) => {
  try {
    // Verificar el tenant
    const tenantId = req.tenant ? req.tenant._id : null;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }
    
    // Obtener parámetros de la consulta
    const days = parseInt(req.query.days) || 30;
    
    // Fechas para el filtro
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Consulta para compras agrupadas por fecha
    const purchasesByDate = await Purchase.aggregate([
      // Filtrar por tenant y rango de fechas
      {
        $match: {
          tenantId: mongoose.Types.ObjectId(tenantId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      // Extraer solo la fecha (sin hora) para agrupar
      {
        $project: {
          dateOnly: { 
            $dateToString: { format: "%Y-%m-%d", date: "$date" } 
          },
          totalAmount: 1
        }
      },
      // Agrupar por fecha y sumar montos
      {
        $group: {
          _id: "$dateOnly",
          amount: { $sum: "$totalAmount" },
          count: { $sum: 1 }
        }
      },
      // Formato de salida
      {
        $project: {
          _id: 0,
          date: "$_id",
          amount: 1,
          count: 1
        }
      },
      // Ordenar por fecha
      {
        $sort: { date: 1 }
      }
    ]);
    
    // Generar todas las fechas del rango para incluir días sin compras
    const allDates = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      allDates.push({
        date: dateStr,
        amount: 0,
        count: 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Combinar fechas con datos existentes
    const purchasesMap = {};
    purchasesByDate.forEach(item => {
      purchasesMap[item.date] = item;
    });
    
    const result = allDates.map(item => {
      return purchasesMap[item.date] || item;
    });
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error al obtener datos de gráfico de compras:', error);
    res.status(500).json({ 
      message: 'Error al obtener datos de gráfico de compras',
      error: error.message
    });
  }
};

// Obtener estadísticas de categorías (para gráfico de pastel)
exports.getCategoryStats = async (req, res) => {
  try {
    // Verificar el tenant
    const tenantId = req.tenant ? req.tenant._id : null;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }
    
    // Consulta para productos agrupados por categoría
    const categoryStats = await Product.aggregate([
      // Filtrar por tenant
      {
        $match: {
          tenantId: mongoose.Types.ObjectId(tenantId)
        }
      },
      // Agrupar por categoría y contar
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalStock: { $sum: "$stock" },
          averagePrice: { $avg: "$salePrice" }
        }
      },
      // Formato de salida
      {
        $project: {
          _id: 0,
          name: "$_id",
          value: "$count",
          totalStock: 1,
          averagePrice: 1
        }
      },
      // Ordenar por cantidad descendente
      {
        $sort: { value: -1 }
      }
    ]);
    
    res.status(200).json(categoryStats);
  } catch (error) {
    console.error('Error al obtener estadísticas de categorías:', error);
    res.status(500).json({ 
      message: 'Error al obtener estadísticas de categorías',
      error: error.message
    });
  }
};

// Obtener productos con stock bajo
exports.getLowStockProducts = async (req, res) => {
  try {
    // Verificar el tenant
    const tenantId = req.tenant ? req.tenant._id : null;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }
    
    // Obtener umbral de stock bajo desde la configuración del tenant o usar valor por defecto
    const threshold = parseInt(req.query.threshold) || req.tenant?.settings?.lowStockThreshold || 5;
    const limit = parseInt(req.query.limit) || 10;
    
    // Consulta para productos con stock bajo
    const lowStockProducts = await Product.find({
      tenantId,
      stock: { $lte: threshold }
    })
    .sort({ stock: 1 })
    .limit(limit);
    
    res.status(200).json(lowStockProducts);
  } catch (error) {
    console.error('Error al obtener productos con stock bajo:', error);
    res.status(500).json({ 
      message: 'Error al obtener productos con stock bajo',
      error: error.message
    });
  }
};

module.exports = exports;