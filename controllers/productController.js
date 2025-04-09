// controllers/productController.js
const Product = require('../models/Product');

// Obtener todos los productos
exports.getAllProducts = async (req, res) => {
  try {
    // Filtrar por tenant
    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }
    
    const products = await Product.find({ tenantId });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos', error: error.message });
  }
};

// Crear un nuevo producto
exports.createProduct = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin') {
      return res.status(403).json({ message: 'No tienes permiso para crear productos' });
    }

    // Asociar el producto al tenant actual
    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    const product = new Product({
      ...req.body,
      tenantId
    });
    
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Error al crear producto', error: error.message });
  }
};

// Obtener un producto por ID
exports.getProductById = async (req, res) => {
  try {
    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }
    
    const product = await Product.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener producto', error: error.message });
  }
};

// Actualizar un producto
exports.updateProduct = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin') {
      return res.status(403).json({ message: 'No tienes permiso para actualizar productos' });
    }

    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    // No permitir cambiar el tenantId
    const updateData = {...req.body};
    delete updateData.tenantId;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    res.status(200).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Error al actualizar producto', error: error.message });
  }
};

// Eliminar un producto
exports.deleteProduct = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin') {
      return res.status(403).json({ message: 'No tienes permiso para eliminar productos' });
    }

    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      tenantId
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    res.status(200).json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar producto', error: error.message });
  }
};