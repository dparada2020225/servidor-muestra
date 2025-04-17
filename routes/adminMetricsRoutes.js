// routes/adminMetricsRoutes.js
const express = require('express');
const router = express.Router();
const adminMetricsController = require('../controllers/adminMetricsController');
const { protect, superAdmin } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación y permisos de superadmin
router.use(protect);
router.use(superAdmin);

// Rutas para métricas y estadísticas de administración
router.get('/usage', adminMetricsController.getTenantUsageMetrics);
router.get('/growth', adminMetricsController.getGrowthMetrics);

module.exports = router;