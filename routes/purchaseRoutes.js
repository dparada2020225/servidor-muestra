// routes/purchaseRoutes.js
const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { protect, admin } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para compras (solo admin)
router.post('/', purchaseController.createPurchase);
router.get('/', purchaseController.getAllPurchases);
router.get('/:id', purchaseController.getPurchaseById);

module.exports = router;