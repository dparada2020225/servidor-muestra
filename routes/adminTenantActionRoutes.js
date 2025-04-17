// routes/adminTenantActionRoutes.js
const express = require('express');
const router = express.Router();
const adminTenantActionController = require('../controllers/adminTenantActionController');
const { protect, superAdmin } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación y permisos de superadmin
router.use(protect);
router.use(superAdmin);

// Rutas para gestión de acciones sobre tenants
router.post('/:id/suspend', adminTenantActionController.suspendTenant);
router.post('/:id/reactivate', adminTenantActionController.reactivateTenant);

module.exports = router;