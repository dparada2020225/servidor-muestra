// routes/adminPlatformRoutes.js
const express = require('express');
const router = express.Router();
const adminPlatformController = require('../controllers/adminPlatformController');
const { protect, superAdmin } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación y permisos de superadmin
router.use(protect);
router.use(superAdmin);

// Rutas para configuración global de la plataforma
router.get('/config', adminPlatformController.getPlatformConfig);
router.put('/config', adminPlatformController.updatePlatformConfig);
router.post('/config/reset', adminPlatformController.resetPlatformConfig);
router.post('/maintenance', adminPlatformController.toggleMaintenanceMode);

module.exports = router;