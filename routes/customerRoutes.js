// routes/customerRoutes.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionsMiddleware');

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para clientes
router.get('/', requirePermission('view_customers'), customerController.getAllCustomers);
router.post('/', requirePermission('manage_customers'), customerController.createCustomer);
router.get('/:id', requirePermission('view_customers'), customerController.getCustomerById);
router.put('/:id', requirePermission('manage_customers'), customerController.updateCustomer);
router.delete('/:id', requirePermission('manage_customers'), customerController.deleteCustomer);
router.get('/:id/purchases', requirePermission('view_sales'), customerController.getCustomerPurchaseHistory);

module.exports = router;