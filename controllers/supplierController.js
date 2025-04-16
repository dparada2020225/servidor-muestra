// controllers/supplierController.js
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const auditService = require('../services/auditService');
const mongoose = require('mongoose');

// Obtener todos los proveedores
exports.getAllSuppliers = async (req, res) => {
  try {
    // Filtrar por tenant
    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }
    
    // Obtener parámetros de consulta para filtros
    const { search, active, sort, order, page, limit } = req.query;
    const filter = { tenantId };
    
    // Aplicar filtros adicionales
    if (active !== undefined) {
      filter.active = active === 'true';
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Configurar opciones de paginación
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 50;
    const skip = (pageNumber - 1) * limitNumber;
    
    // Configurar ordenamiento
    const sortField = sort || 'name';
    const sortOrder = order === 'desc' ? -1 : 1;
    const sortOptions = {};
    sortOptions[sortField] = sortOrder;
    
    // Obtener proveedores con paginación
    const suppliers = await Supplier.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNumber);
    
    // Obtener conteo total para paginación
    const total = await Supplier.countDocuments(filter);
    
    // Registrar en auditoría
    await auditService.logAction({
      action: 'view',
      entityType: 'supplier',
      description: 'Listado de proveedores',
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      tenantId,
      ipAddress: req.ip
    });
    
    res.status(200).json({
      suppliers,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ message: 'Error al obtener proveedores', error: error.message });
  }
};

// Crear un nuevo proveedor
exports.createSupplier = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin') {
      return res.status(403).json({ message: 'No tienes permiso para crear proveedores' });
    }

    // Asociar el proveedor al tenant actual
    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    // Verificar si ya existe un proveedor con el mismo email
    if (req.body.email) {
      const existingSupplier = await Supplier.findOne({ 
        tenantId, 
        email: req.body.email
      });
      
      if (existingSupplier) {
        return res.status(400).json({ message: 'Ya existe un proveedor con este email' });
      }
    }

    // Crear nuevo proveedor
    const supplier = new Supplier({
      ...req.body,
      tenantId
    });
    
    await supplier.save();
    
    // Registrar en auditoría
    await auditService.logAction({
      action: 'create',
      entityType: 'supplier',
      entityId: supplier._id,
      description: `Creación de proveedor: ${supplier.name}`,
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      tenantId,
      ipAddress: req.ip
    });
    
    res.status(201).json(supplier);
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    res.status(400).json({ message: 'Error al crear proveedor', error: error.message });
  }
};

// Obtener un proveedor por ID
exports.getSupplierById = async (req, res) => {
  try {
    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }
    
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }
    
    res.status(200).json(supplier);
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ message: 'Error al obtener proveedor', error: error.message });
  }
};

// Actualizar un proveedor
exports.updateSupplier = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin') {
      return res.status(403).json({ message: 'No tienes permiso para actualizar proveedores' });
    }

    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    // No permitir cambiar el tenantId
    const updateData = {...req.body};
    delete updateData.tenantId;
    delete updateData.totalPurchases; // No permitir actualizar estos campos directamente
    delete updateData.lastOrderDate;

    // Verificar si se actualiza el email y si ya existe
    if (updateData.email) {
      const existingSupplier = await Supplier.findOne({ 
        tenantId, 
        email: updateData.email,
        _id: { $ne: req.params.id }
      });
      
      if (existingSupplier) {
        return res.status(400).json({ message: 'Ya existe un proveedor con este email' });
      }
    }

    // Guardar estado anterior para auditoría
    const originalSupplier = await Supplier.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!originalSupplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      updateData,
      { new: true, runValidators: true }
    );
    
    // Registrar en auditoría
    await auditService.logAction({
      action: 'update',
      entityType: 'supplier',
      entityId: supplier._id,
      description: `Actualización de proveedor: ${supplier.name}`,
      details: {
        previous: {
          name: originalSupplier.name,
          email: originalSupplier.email,
          phone: originalSupplier.phone,
          active: originalSupplier.active
        },
        current: {
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone,
          active: supplier.active
        }
      },
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      tenantId,
      ipAddress: req.ip
    });
    
    res.status(200).json(supplier);
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    res.status(400).json({ message: 'Error al actualizar proveedor', error: error.message });
  }
};

// Eliminar un proveedor (desactivar)
exports.deleteSupplier = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin') {
      return res.status(403).json({ message: 'No tienes permiso para eliminar proveedores' });
    }

    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    // Verificar si hay compras asociadas
    const purchasesCount = await Purchase.countDocuments({
      tenantId,
      supplier: req.params.id
    });
    
    if (purchasesCount > 0) {
      // Si hay compras, solo desactivar el proveedor
      const supplier = await Supplier.findOneAndUpdate(
        { _id: req.params.id, tenantId },
        { active: false },
        { new: true }
      );
      
      if (!supplier) {
        return res.status(404).json({ message: 'Proveedor no encontrado' });
      }
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'supplier',
        entityId: supplier._id,
        description: `Desactivación de proveedor: ${supplier.name}`,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId,
        ipAddress: req.ip
      });
      
      return res.status(200).json({ 
        message: 'Proveedor desactivado correctamente (tiene compras asociadas)',
        supplier
      });
    }
    
    // Si no hay compras, eliminar el proveedor
    const supplier = await Supplier.findOneAndDelete({
      _id: req.params.id,
      tenantId
    });
    
    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }
    
    // Registrar en auditoría
    await auditService.logAction({
      action: 'delete',
      entityType: 'supplier',
      entityId: supplier._id,
      description: `Eliminación de proveedor: ${supplier.name}`,
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      tenantId,
      ipAddress: req.ip
    });
    
    res.status(200).json({ message: 'Proveedor eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    res.status(500).json({ message: 'Error al eliminar proveedor', error: error.message });
  }
};

// Obtener historial de compras a un proveedor
exports.getSupplierOrderHistory = async (req, res) => {
  try {
    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }
    
    const supplierId = req.params.id;
    
    // Verificar que el proveedor existe
    const supplier = await Supplier.findOne({
      _id: supplierId,
      tenantId
    });
    
    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }
    
    // Obtener parámetros de paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Buscar compras del proveedor
    const purchases = await Purchase.find({
      tenantId,
      supplier: supplierId
    })
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit)
    .populate('items.product', 'name category');
    
    // Obtener conteo total para paginación
    const total = await Purchase.countDocuments({
      tenantId,
      supplier: supplierId
    });
    
    res.status(200).json({
      supplier: {
        id: supplier._id,
        name: supplier.name,
        totalPurchases: supplier.totalPurchases
      },
      orders: purchases,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error al obtener historial de compras:', error);
    res.status(500).json({ message: 'Error al obtener historial de compras', error: error.message });
  }
};

module.exports = exports;