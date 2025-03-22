// routes/saleRoutes.js
const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { protect, admin } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para ventas (solo admin)
router.post('/', saleController.createSale);
router.get('/', saleController.getAllSales);
router.get('/:id', saleController.getSaleById);

module.exports = router;