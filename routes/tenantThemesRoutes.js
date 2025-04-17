// routes/tenantThemesRoutes.js
const express = require('express');
const router = express.Router();
const tenantThemesController = require('../controllers/tenantThemesController');
const { protect } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionsMiddleware');

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para gestión de temas del tenant
router.get('/', requirePermission('view_settings'), tenantThemesController.getThemes);
router.post('/', requirePermission('manage_settings'), tenantThemesController.createTheme);
router.put('/:id', requirePermission('manage_settings'), tenantThemesController.updateTheme);
router.delete('/:id', requirePermission('manage_settings'), tenantThemesController.deleteTheme);
router.post('/:id/apply', requirePermission('manage_settings'), tenantThemesController.applyTheme);

module.exports = router;