// routes/supplierRoutes.js
const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { protect } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionsMiddleware');

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para proveedores
router.get('/', requirePermission('view_suppliers'), supplierController.getAllSuppliers);
router.post('/', requirePermission('manage_suppliers'), supplierController.createSupplier);
router.get('/:id', requirePermission('view_suppliers'), supplierController.getSupplierById);
router.put('/:id', requirePermission('manage_suppliers'), supplierController.updateSupplier);
router.delete('/:id', requirePermission('manage_suppliers'), supplierController.deleteSupplier);
router.get('/:id/orders', requirePermission('view_purchases'), supplierController.getSupplierOrderHistory);

module.exports = router;