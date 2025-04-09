// controllers/purchaseController.js
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// Crear una nueva compra
exports.createPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verificar si es admin
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin') {
      return res.status(403).json({ message: 'No tienes permiso para crear compras' });
    }

    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    const { items, supplier } = req.body;

    // Validar que se proporcionaron items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Debe proporcionar al menos un producto para la compra' });
    }

    // Calcular total y actualizar productos
    let totalAmount = 0;
    const purchaseItems = [];

    for (const item of items) {
      // Validar datos del item
      if (!item.product || !item.quantity || !item.price) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Datos de producto incompletos' });
      }

      // Calcular total del item
      const itemTotal = item.quantity * item.price;
      totalAmount += itemTotal;

      // Preparar item para la compra
      purchaseItems.push({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        total: itemTotal
      });

      // Verificar que el producto pertenece al tenant
      const product = await Product.findOne({
        _id: item.product,
        tenantId
      }).session(session);
      
      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: `Producto con ID ${item.product} no encontrado en este tenant` });
      }

      // Actualizar stock y precio de compra del producto
      product.stock += item.quantity;
      product.lastPurchasePrice = item.price;
      await product.save({ session });
    }

    // Crear registro de compra con el usuario actual y tenant
    const purchase = new Purchase({
      date: new Date(),
      supplier,
      items: purchaseItems,
      totalAmount,
      user: req.user.id,
      tenantId
    });

    await purchase.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json(purchase);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Error al crear la compra', error: error.message });
  }
};

// Obtener todas las compras (con filtro de fecha opcional)
exports.getAllPurchases = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin') {
      return res.status(403).json({ message: 'No tienes permiso para ver las compras' });
    }

    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    // Filtros para la consulta
    const filter = { tenantId };
    
    // Filtrar por fecha si se proporcionan startDate y endDate
    if (req.query.startDate && req.query.endDate) {
      const startDate = new Date(req.query.startDate);
      const endDate = new Date(req.query.endDate);
      
      // Ajustar endDate para incluir todo el día
      endDate.setHours(23, 59, 59, 999);
      
      // Verificar que las fechas sean válidas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: 'Formato de fecha inválido' });
      }
      
      filter.date = {
        $gte: startDate,
        $lte: endDate
      };
      
      console.log(`Filtrando compras desde ${startDate.toISOString()} hasta ${endDate.toISOString()}`);
    }

    const purchases = await Purchase.find(filter)
      .populate('user', 'username')
      .populate('items.product', 'name')
      .sort({ date: -1 }); // Ordenar por fecha, más reciente primero
    
    res.status(200).json(purchases);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener compras', error: error.message });
  }
};

// Obtener una compra por ID
exports.getPurchaseById = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin') {
      return res.status(403).json({ message: 'No tienes permiso para ver esta compra' });
    }

    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    const purchase = await Purchase.findOne({
      _id: req.params.id,
      tenantId
    })
      .populate('user', 'username')
      .populate('items.product', 'name');
    
    if (!purchase) {
      return res.status(404).json({ message: 'Compra no encontrada' });
    }
    
    res.status(200).json(purchase);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener la compra', error: error.message });
  }
};