// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionsMiddleware');

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para información de roles (disponible para todos los usuarios autenticados)
router.get('/roles', userController.getRolesInfo);

// Rutas para gestión de usuarios
router.get('/', requirePermission('view_users'), userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', requirePermission('manage_users'), userController.deactivateUser);

// Rutas específicas
router.put('/:id/password', userController.changePassword);
router.put('/:id/status', requirePermission('manage_users'), userController.updateUserStatus);
router.put('/:id/change-role', requirePermission('manage_roles'), userController.changeUserRole);

module.exports = router;