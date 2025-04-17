// routes/adminUserManagementRoutes.js
const express = require('express');
const router = express.Router();
const adminUserManagementController = require('../controllers/adminUserManagementController');
const { protect, superAdmin } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación y permisos de superadmin
router.use(protect);
router.use(superAdmin);

// Rutas para gestión avanzada de usuarios
router.put('/:id/role', adminUserManagementController.updateUserRole);
router.post('/:id/reset-password', adminUserManagementController.resetUserPassword);

module.exports = router;