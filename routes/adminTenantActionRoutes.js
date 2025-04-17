// routes/adminTenantActionRoutes.js (versión modificada)
const express = require('express');
const router = express.Router();
const adminTenantActionController = require('../controllers/adminTenantActionController');
const { protect, superAdmin } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación y permisos de superadmin
router.use(protect);
router.use(superAdmin);

// Rutas específicas para acciones sobre tenants
router.post('/suspend/:id', adminTenantActionController.suspendTenant);
router.post('/reactivate/:id', adminTenantActionController.reactivateTenant);

module.exports = router;