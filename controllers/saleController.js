// controllers/saleController.js
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// Crear una nueva venta
exports.createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verificar si es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'No tienes permiso para crear ventas' });
    }

    const { items, customer } = req.body;

    // Validar que se proporcionaron items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Debe proporcionar al menos un producto para la venta' });
    }

    // Calcular total y actualizar productos
    let totalAmount = 0;
    const saleItems = [];

    for (const item of items) {
      // Validar datos del item
      if (!item.product || !item.quantity || !item.price) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Datos de producto incompletos' });
      }

      // Buscar producto
      const product = await Product.findById(item.product).session(session);
      
      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: `Producto con ID ${item.product} no encontrado` });
      }

      // Verificar stock suficiente
      if (product.stock < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          message: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Solicitado: ${item.quantity}` 
        });
      }

      // Calcular total del item
      const itemTotal = item.quantity * item.price;
      totalAmount += itemTotal;

      // Preparar item para la venta
      saleItems.push({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        total: itemTotal
      });

      // Actualizar stock del producto
      product.stock -= item.quantity;
      await product.save({ session });
    }

    // Crear registro de venta con el usuario actual
    const sale = new Sale({
      date: new Date(),
      customer,
      items: saleItems,
      totalAmount,
      user: req.user.id // Usar el ID del usuario que está haciendo la venta
    });

    await sale.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json(sale);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Error al crear la venta', error: error.message });
  }
};

// Obtener todas las ventas (con filtro de fecha opcional)
exports.getAllSales = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'No tienes permiso para ver las ventas' });
    }

    // Filtros para la consulta
    const filter = {};
    
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
      
      console.log(`Filtrando ventas desde ${startDate.toISOString()} hasta ${endDate.toISOString()}`);
    }

    const sales = await Sale.find(filter)
      .populate('user', 'username') // Poblar el campo user con el nombre de usuario
      .populate('items.product', 'name')
      .sort({ date: -1 }); // Ordenar por fecha, más reciente primero
    
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener ventas', error: error.message });
  }
};

// Obtener una venta por ID
exports.getSaleById = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'No tienes permiso para ver esta venta' });
    }

    const sale = await Sale.findById(req.params.id)
      .populate('user', 'username')
      .populate('items.product', 'name');
    
    if (!sale) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }
    
    res.status(200).json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener la venta', error: error.message });
  }
};