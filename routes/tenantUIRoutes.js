// routes/tenantUIRoutes.js
const express = require('express');
const router = express.Router();
const tenantUIController = require('../controllers/tenantUIController');
const { protect } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionsMiddleware');

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para configuración de UI del tenant
router.get('/config', requirePermission('view_settings'), tenantUIController.getUIConfig);
router.put('/config', requirePermission('manage_settings'), tenantUIController.updateUIConfig);
router.post('/config/reset', requirePermission('manage_settings'), tenantUIController.resetUIConfig);

module.exports = router;