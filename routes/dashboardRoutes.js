// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionsMiddleware');

// Todas las rutas requieren autenticación
router.use(protect);

// Obtener estadísticas generales del dashboard
// Requiere permiso para ver reportes
router.get('/stats', 
  requirePermission('view_reports'), 
  dashboardController.getStats
);

// Obtener datos para el gráfico de ventas
router.get('/sales-chart', 
  requirePermission('view_reports'), 
  dashboardController.getSalesChartData
);

// Obtener datos para el gráfico de compras
router.get('/purchases-chart', 
  requirePermission('view_reports'), 
  dashboardController.getPurchasesChartData
);

// Obtener estadísticas de categorías
router.get('/category-stats', 
  requirePermission('view_reports'), 
  dashboardController.getCategoryStats
);

// Obtener productos con stock bajo
router.get('/low-stock', 
  requirePermission('view_reports'), 
  dashboardController.getLowStockProducts
);

module.exports = router;