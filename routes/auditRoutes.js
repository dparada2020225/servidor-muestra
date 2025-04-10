// routes/auditRoutes.js
const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { protect, superAdmin } = require('../middleware/authMiddleware');

// Todas las rutas de auditoría requieren permisos de superadmin
router.use(protect);
router.use(superAdmin);

// Rutas para auditoría
router.get('/', auditController.getAuditLogs);
router.get('/stats', auditController.getAuditStats);

module.exports = router;