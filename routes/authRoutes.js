// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware');

// Rutas públicas
router.post('/login', authController.login);

// Rutas protegidas
router.post('/register', protect, authController.register); // Solo usuarios logueados pueden registrar
router.get('/me', protect, authController.getCurrentUser);
router.get('/users', protect, admin, authController.getAllUsers); // Solo admin puede ver todos

module.exports = router;