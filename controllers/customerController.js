// controllers/customerController.js
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const auditService = require('../services/auditService');
const mongoose = require('mongoose');

// Obtener todos los clientes
exports.getAllCustomers = async (req, res) => {
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
    
    // Obtener clientes con paginación
    const customers = await Customer.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNumber);
    
    // Obtener conteo total para paginación
    const total = await Customer.countDocuments(filter);
    
    // Registrar en auditoría
    await auditService.logAction({
      action: 'view',
      entityType: 'customer',
      description: 'Listado de clientes',
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      tenantId,
      ipAddress: req.ip
    });
    
    res.status(200).json({
      customers,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ message: 'Error al obtener clientes', error: error.message });
  }
};

// Crear un nuevo cliente
exports.createCustomer = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin') {
      return res.status(403).json({ message: 'No tienes permiso para crear clientes' });
    }

    // Asociar el cliente al tenant actual
    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    // Verificar si ya existe un cliente con el mismo email
    if (req.body.email) {
      const existingCustomer = await Customer.findOne({ 
        tenantId, 
        email: req.body.email
      });
      
      if (existingCustomer) {
        return res.status(400).json({ message: 'Ya existe un cliente con este email' });
      }
    }

    // Crear nuevo cliente
    const customer = new Customer({
      ...req.body,
      tenantId
    });
    
    await customer.save();
    
    // Registrar en auditoría
    await auditService.logAction({
      action: 'create',
      entityType: 'customer',
      entityId: customer._id,
      description: `Creación de cliente: ${customer.name}`,
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      tenantId,
      ipAddress: req.ip
    });
    
    res.status(201).json(customer);
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(400).json({ message: 'Error al crear cliente', error: error.message });
  }
};

// Obtener un cliente por ID
exports.getCustomerById = async (req, res) => {
  try {
    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }
    
    const customer = await Customer.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    res.status(200).json(customer);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ message: 'Error al obtener cliente', error: error.message });
  }
};

// Actualizar un cliente
exports.updateCustomer = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin') {
      return res.status(403).json({ message: 'No tienes permiso para actualizar clientes' });
    }

    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    // No permitir cambiar el tenantId
    const updateData = {...req.body};
    delete updateData.tenantId;
    delete updateData.totalPurchases; // No permitir actualizar estos campos directamente
    delete updateData.lastPurchaseDate;

    // Verificar si se actualiza el email y si ya existe
    if (updateData.email) {
      const existingCustomer = await Customer.findOne({ 
        tenantId, 
        email: updateData.email,
        _id: { $ne: req.params.id }
      });
      
      if (existingCustomer) {
        return res.status(400).json({ message: 'Ya existe un cliente con este email' });
      }
    }

    // Guardar estado anterior para auditoría
    const originalCustomer = await Customer.findOne({
      _id: req.params.id,
      tenantId
    });
    
    if (!originalCustomer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      updateData,
      { new: true, runValidators: true }
    );
    
    // Registrar en auditoría
    await auditService.logAction({
      action: 'update',
      entityType: 'customer',
      entityId: customer._id,
      description: `Actualización de cliente: ${customer.name}`,
      details: {
        previous: {
          name: originalCustomer.name,
          email: originalCustomer.email,
          phone: originalCustomer.phone,
          active: originalCustomer.active
        },
        current: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          active: customer.active
        }
      },
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      tenantId,
      ipAddress: req.ip
    });
    
    res.status(200).json(customer);
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(400).json({ message: 'Error al actualizar cliente', error: error.message });
  }
};

// Eliminar un cliente (desactivar)
exports.deleteCustomer = async (req, res) => {
  try {
    // Verificar si es admin
    if (req.user.role !== 'admin' && req.user.role !== 'tenantAdmin') {
      return res.status(403).json({ message: 'No tienes permiso para eliminar clientes' });
    }

    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }

    // Verificar si hay ventas asociadas
    const salesCount = await Sale.countDocuments({
      tenantId,
      customer: req.params.id
    });
    
    if (salesCount > 0) {
      // Si hay ventas, solo desactivar el cliente
      const customer = await Customer.findOneAndUpdate(
        { _id: req.params.id, tenantId },
        { active: false },
        { new: true }
      );
      
      if (!customer) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'customer',
        entityId: customer._id,
        description: `Desactivación de cliente: ${customer.name}`,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId,
        ipAddress: req.ip
      });
      
      return res.status(200).json({ 
        message: 'Cliente desactivado correctamente (tiene ventas asociadas)',
        customer
      });
    }
    
    // Si no hay ventas, eliminar el cliente
    const customer = await Customer.findOneAndDelete({
      _id: req.params.id,
      tenantId
    });
    
    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    // Registrar en auditoría
    await auditService.logAction({
      action: 'delete',
      entityType: 'customer',
      entityId: customer._id,
      description: `Eliminación de cliente: ${customer.name}`,
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      tenantId,
      ipAddress: req.ip
    });
    
    res.status(200).json({ message: 'Cliente eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({ message: 'Error al eliminar cliente', error: error.message });
  }
};

// Obtener historial de compras de un cliente
exports.getCustomerPurchaseHistory = async (req, res) => {
  try {
    const tenantId = req.tenant ? req.tenant._id : null;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant no especificado' });
    }
    
    const customerId = req.params.id;
    
    // Verificar que el cliente existe
    const customer = await Customer.findOne({
      _id: customerId,
      tenantId
    });
    
    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    // Obtener parámetros de paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Buscar ventas del cliente
    const sales = await Sale.find({
      tenantId,
      customer: customerId
    })
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit)
    .populate('items.product', 'name category');
    
    // Obtener conteo total para paginación
    const total = await Sale.countDocuments({
      tenantId,
      customer: customerId
    });
    
    res.status(200).json({
      customer: {
        id: customer._id,
        name: customer.name,
        totalPurchases: customer.totalPurchases
      },
      purchases: sales,
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