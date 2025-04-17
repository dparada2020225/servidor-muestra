// routes/adminStatisticsRoutes.js
const express = require('express');
const router = express.Router();
const adminStatisticsController = require('../controllers/adminStatisticsController');
const { protect, superAdmin } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación y permisos de superadmin
router.use(protect);
router.use(superAdmin);

// Rutas para estadísticas de plataforma
router.get('/dashboard', adminStatisticsController.getDashboardStats);
router.get('/tenants/active', adminStatisticsController.getActiveTenantStats);
router.get('/tenants/growth', adminStatisticsController.getTenantGrowthStats);

module.exports = router;