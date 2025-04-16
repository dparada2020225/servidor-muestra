// routes/tenantSettingsRoutes.js
const express = require('express');
const router = express.Router();
const tenantSettingsController = require('../controllers/tenantSettingsController');
const { protect } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionsMiddleware');

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para configuración de tenant
router.get('/', requirePermission('view_settings'), tenantSettingsController.getSettings);
router.put('/', requirePermission('manage_settings'), tenantSettingsController.updateSettings);

// Rutas para configuración de marca
router.get('/branding', requirePermission('view_settings'), tenantSettingsController.getBranding);
router.put('/branding', requirePermission('manage_settings'), tenantSettingsController.updateBranding);

module.exports = router;