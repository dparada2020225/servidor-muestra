// routes/adminLogsRoutes.js
const express = require('express');
const router = express.Router();
const adminLogsController = require('../controllers/adminLogsController');
const { protect, superAdmin } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación y permisos de superadmin
router.use(protect);
router.use(superAdmin);

// Rutas para logs y diagnósticos
router.get('/system', adminLogsController.getSystemLogs);
router.get('/support/diagnostics', adminLogsController.getTenantDiagnostics);

module.exports = router;