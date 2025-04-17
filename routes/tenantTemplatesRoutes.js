// routes/tenantTemplatesRoutes.js
const express = require('express');
const router = express.Router();
const tenantTemplatesController = require('../controllers/tenantTemplatesController');
const { protect } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionsMiddleware');

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para gestión de plantillas de documentos
router.get('/', requirePermission('view_settings'), tenantTemplatesController.getTemplates);
router.get('/:id', requirePermission('view_settings'), tenantTemplatesController.getTemplateById);
router.post('/', requirePermission('manage_settings'), tenantTemplatesController.createTemplate);
router.put('/:id', requirePermission('manage_settings'), tenantTemplatesController.updateTemplate);
router.delete('/:id', requirePermission('manage_settings'), tenantTemplatesController.deleteTemplate);
router.post('/:id/duplicate', requirePermission('manage_settings'), tenantTemplatesController.duplicateTemplate);

module.exports = router;