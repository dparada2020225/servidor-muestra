// controllers/reportsController.js
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const reportsController = {
  /**
   * Obtener informe de ventas
   * @route GET /api/reports/sales
   */
  getSalesReport: async (req, res) => {
    try {
      // Verificar permisos
      if (!req.user) {
        return res.status(401).json({ message: 'No autorizado' });
      }
      
      // Verificar tenant
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Obtener parámetros de consulta
      const { startDate, endDate, customer, product } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;
      
      // Construir filtro base
      const filter = {
        tenantId: req.tenant._id
      };
      
      // Añadir filtros adicionales si se proporcionan
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999);
          filter.date.$lte = endDateObj;
        }
      }
      
      if (customer) {
        filter.customer = { $regex: customer, $options: 'i' };
      }
      
      // Pipeline de agregación
      const pipeline = [
        { $match: filter },
        { $sort: { date: -1 } },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userDetails'
          }
        },
        { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            date: 1,
            customer: 1,
            totalAmount: 1,
            items: 1,
            'userDetails.username': 1,
            createdAt: 1
          }
        }
      ];
      
      // Si se proporciona un producto, agregar un filtro adicional
      if (product) {
        // Buscar el producto por nombre
        const products = await Product.find({
          tenantId: req.tenant._id,
          name: { $regex: product, $options: 'i' }
        }).select('_id');
        
        const productIds = products.map(p => p._id);
        
        if (productIds.length > 0) {
          pipeline.unshift({
            $match: {
              'items.product': { $in: productIds }
            }
          });
        }
      }
      
      // Añadir paginación
      const paginatedPipeline = [
        ...pipeline,
        { $skip: skip },
        { $limit: limit }
      ];
      
      // Obtener ventas con paginación
      const sales = await Sale.aggregate(paginatedPipeline);
      
      // Contar total para paginación
      const countPipeline = [
        ...pipeline,
        { $count: 'total' }
      ];
      
      const countResult = await Sale.aggregate(countPipeline);
      const total = countResult.length > 0 ? countResult[0].total : 0;
      
      // Calcular totales
      const totalsPipeline = [
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        }
      ];
      
      const totalsResult = await Sale.aggregate(totalsPipeline);
      const totals = totalsResult.length > 0 ? {
        totalAmount: totalsResult[0].totalAmount,
        count: totalsResult[0].count
      } : {
        totalAmount: 0,
        count: 0
      };
      
      // Obtener detalles completos de los productos en las ventas
      for (const sale of sales) {
        if (sale.items && sale.items.length > 0) {
          const productIds = sale.items.map(item => item.product);
          const products = await Product.find({
            _id: { $in: productIds }
          }).select('name category');
          
          // Crear un mapa para búsqueda rápida
          const productMap = {};
          products.forEach(product => {
            productMap[product._id.toString()] = {
              name: product.name,
              category: product.category
            };
          });
          
          // Añadir detalles del producto a cada ítem
          sale.items = sale.items.map(item => {
            const productId = item.product.toString();
            return {
              ...item,
              productName: productMap[productId]?.name || 'Producto desconocido',
              productCategory: productMap[productId]?.category || 'Sin categoría'
            };
          });
        }
      }
      
      res.status(200).json({
        sales,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          limit
        },
        totals
      });
    } catch (error) {
      console.error('Error al obtener informe de ventas:', error);
      res.status(500).json({ message: 'Error al obtener informe de ventas', error: error.message });
    }
  },
  
  /**
   * Obtener informe de compras
   * @route GET /api/reports/purchases
   */
  getPurchasesReport: async (req, res) => {
    try {
      // Verificar permisos
      if (!req.user) {
        return res.status(401).json({ message: 'No autorizado' });
      }
      
      // Verificar tenant
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Obtener parámetros de consulta
      const { startDate, endDate, supplier, product } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;
      
      // Construir filtro base
      const filter = {
        tenantId: req.tenant._id
      };
      
      // Añadir filtros adicionales si se proporcionan
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999);
          filter.date.$lte = endDateObj;
        }
      }
      
      if (supplier) {
        filter.supplier = { $regex: supplier, $options: 'i' };
      }
      
      // Pipeline de agregación
      const pipeline = [
        { $match: filter },
        { $sort: { date: -1 } },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userDetails'
          }
        },
        { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            date: 1,
            supplier: 1,
            totalAmount: 1,
            items: 1,
            'userDetails.username': 1,
            createdAt: 1
          }
        }
      ];
      
      // Si se proporciona un producto, agregar un filtro adicional
      if (product) {
        // Buscar el producto por nombre
        const products = await Product.find({
          tenantId: req.tenant._id,
          name: { $regex: product, $options: 'i' }
        }).select('_id');
        
        const productIds = products.map(p => p._id);
        
        if (productIds.length > 0) {
          pipeline.unshift({
            $match: {
              'items.product': { $in: productIds }
            }
          });
        }
      }
      
      // Añadir paginación
      const paginatedPipeline = [
        ...pipeline,
        { $skip: skip },
        { $limit: limit }
      ];
      
      // Obtener compras con paginación
      const purchases = await Purchase.aggregate(paginatedPipeline);
      
      // Contar total para paginación
      const countPipeline = [
        ...pipeline,
        { $count: 'total' }
      ];
      
      const countResult = await Purchase.aggregate(countPipeline);
      const total = countResult.length > 0 ? countResult[0].total : 0;
      
      // Calcular totales
      const totalsPipeline = [
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        }
      ];
      
      const totalsResult = await Purchase.aggregate(totalsPipeline);
      const totals = totalsResult.length > 0 ? {
        totalAmount: totalsResult[0].totalAmount,
        count: totalsResult[0].count
      } : {
        totalAmount: 0,
        count: 0
      };
      
      // Obtener detalles completos de los productos en las compras
      for (const purchase of purchases) {
        if (purchase.items && purchase.items.length > 0) {
          const productIds = purchase.items.map(item => item.product);
          const products = await Product.find({
            _id: { $in: productIds }
          }).select('name category');
          
          // Crear un mapa para búsqueda rápida
          const productMap = {};
          products.forEach(product => {
            productMap[product._id.toString()] = {
              name: product.name,
              category: product.category
            };
          });
          
          // Añadir detalles del producto a cada ítem
          purchase.items = purchase.items.map(item => {
            const productId = item.product.toString();
            return {
              ...item,
              productName: productMap[productId]?.name || 'Producto desconocido',
              productCategory: productMap[productId]?.category || 'Sin categoría'
            };
          });
        }
      }
      
      res.status(200).json({
        purchases,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          limit
        },
        totals
      });
    } catch (error) {
      console.error('Error al obtener informe de compras:', error);
      res.status(500).json({ message: 'Error al obtener informe de compras', error: error.message });
    }
  },
  
  /**
   * Obtener informe de inventario
   * @route GET /api/reports/inventory
   */
  getInventoryReport: async (req, res) => {
    try {
      // Verificar permisos
      if (!req.user) {
        return res.status(401).json({ message: 'No autorizado' });
      }
      
      // Verificar tenant
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Obtener parámetros de consulta
      const { category, lowStock, search } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;
      
      // Construir filtro base
      const filter = {
        tenantId: req.tenant._id
      };
      
      // Añadir filtros adicionales si se proporcionan
      if (category) {
        filter.category = category;
      }
      
      if (lowStock === 'true') {
        const threshold = req.tenant.settings?.lowStockThreshold || 5;
        filter.stock = { $lte: threshold };
      }
      
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { color: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Obtener productos con paginación
      const products = await Product.find(filter)
        .sort({ category: 1, name: 1 })
        .skip(skip)
        .limit(limit);
      
      // Contar total para paginación
      const total = await Product.countDocuments(filter);
      
      // Calcular estadísticas
      const stats = {
        totalProducts: await Product.countDocuments({ tenantId: req.tenant._id }),
        totalCategories: (await Product.distinct('category', { tenantId: req.tenant._id })).length,
        totalValue: 0,
        lowStockCount: await Product.countDocuments({
          tenantId: req.tenant._id,
          stock: { $lte: req.tenant.settings?.lowStockThreshold || 5 }
        }),
        outOfStockCount: await Product.countDocuments({
          tenantId: req.tenant._id,
          stock: 0
        })
      };
      
      // Calcular valor total del inventario
      const totalValueResult = await Product.aggregate([
        { $match: { tenantId: mongoose.Types.ObjectId(req.tenant._id) } },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ['$stock', '$salePrice'] } }
          }
        }
      ]);
      
      if (totalValueResult.length > 0) {
        stats.totalValue = totalValueResult[0].total;
      }
      
      // Calcular valor por categoría
      const valueByCategory = await Product.aggregate([
        { $match: { tenantId: mongoose.Types.ObjectId(req.tenant._id) } },
        {
          $group: {
            _id: '$category',
            total: { $sum: { $multiply: ['$stock', '$salePrice'] } },
            count: { $sum: 1 }
          }
        },
        { $sort: { total: -1 } }
      ]);
      
      res.status(200).json({
        products,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          limit
        },
        stats,
        valueByCategory
      });
    } catch (error) {
      console.error('Error al obtener informe de inventario:', error);
      res.status(500).json({ message: 'Error al obtener informe de inventario', error: error.message });
    }
  }
};

// controllers/exportController.js
const exportController = {
  /**
   * Exportar productos a CSV
   * @route GET /api/exports/products
   */
  exportProducts: async (req, res) => {
    try {
      // Verificar permisos
      if (!req.user) {
        return res.status(401).json({ message: 'No autorizado' });
      }
      
      // Verificar tenant
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Obtener parámetros de consulta
      const { category, lowStock, search } = req.query;
      
      // Construir filtro base
      const filter = {
        tenantId: req.tenant._id
      };
      
      // Añadir filtros adicionales si se proporcionan
      if (category) {
        filter.category = category;
      }
      
      if (lowStock === 'true') {
        const threshold = req.tenant.settings?.lowStockThreshold || 5;
        filter.stock = { $lte: threshold };
      }
      
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { color: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Obtener productos
      const products = await Product.find(filter)
        .sort({ category: 1, name: 1 });
      
      // Crear archivo CSV temporal
      const tmpDir = os.tmpdir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const csvFilePath = path.join(tmpDir, `productos-${timestamp}.csv`);
      
      const csvWriter = createObjectCsvWriter({
        path: csvFilePath,
        header: [
          { id: 'name', title: 'Nombre' },
          { id: 'category', title: 'Categoría' },
          { id: 'color', title: 'Color' },
          { id: 'stock', title: 'Stock' },
          { id: 'salePrice', title: 'Precio de Venta' },
          { id: 'lastPurchasePrice', title: 'Último Precio de Compra' },
          { id: 'value', title: 'Valor Total' }
        ]
      });
      
      // Formatear datos
      const records = products.map(product => ({
        name: product.name,
        category: product.category,
        color: product.color,
        stock: product.stock,
        salePrice: product.salePrice,
        lastPurchasePrice: product.lastPurchasePrice,
        value: product.stock * product.salePrice
      }));
      
      // Escribir CSV
      await csvWriter.writeRecords(records);
      
      // Enviar archivo
      res.download(csvFilePath, `productos-${req.tenant.name}-${timestamp}.csv`, err => {
        if (err) {
          console.error('Error al enviar archivo CSV:', err);
        }
        
        // Eliminar archivo temporal después de enviarlo
        fs.unlink(csvFilePath, unlinkErr => {
          if (unlinkErr) {
            console.error('Error al eliminar archivo temporal:', unlinkErr);
          }
        });
      });
    } catch (error) {
      console.error('Error al exportar productos:', error);
      res.status(500).json({ message: 'Error al exportar productos', error: error.message });
    }
  },
  
  /**
   * Exportar ventas a CSV
   * @route GET /api/exports/sales
   */
  exportSales: async (req, res) => {
    try {
      // Verificar permisos
      if (!req.user) {
        return res.status(401).json({ message: 'No autorizado' });
      }
      
      // Verificar tenant
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Obtener parámetros de consulta
      const { startDate, endDate, customer } = req.query;
      
      // Construir filtro base
      const filter = {
        tenantId: req.tenant._id
      };
      
      // Añadir filtros adicionales si se proporcionan
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999);
          filter.date.$lte = endDateObj;
        }
      }
      
      if (customer) {
        filter.customer = { $regex: customer, $options: 'i' };
      }
      
      // Obtener ventas con detalles
      const sales = await Sale.find(filter)
        .sort({ date: -1 })
        .populate('user', 'username')
        .populate('items.product', 'name category');
      
      // Crear archivo CSV temporal
      const tmpDir = os.tmpdir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const csvFilePath = path.join(tmpDir, `ventas-${timestamp}.csv`);
      
      const csvWriter = createObjectCsvWriter({
        path: csvFilePath,
        header: [
          { id: 'date', title: 'Fecha' },
          { id: 'saleId', title: 'ID Venta' },
          { id: 'customer', title: 'Cliente' },
          { id: 'product', title: 'Producto' },
          { id: 'category', title: 'Categoría' },
          { id: 'quantity', title: 'Cantidad' },
          { id: 'price', title: 'Precio Unitario' },
          { id: 'total', title: 'Total' },
          { id: 'user', title: 'Usuario' }
        ]
      });
      
      // Formatear datos (expandir items para tener una fila por producto)
      const records = [];
      
      sales.forEach(sale => {
        sale.items.forEach(item => {
          records.push({
            date: sale.date.toISOString().split('T')[0],
            saleId: sale._id.toString(),
            customer: sale.customer || 'N/A',
            product: item.product?.name || 'Producto desconocido',
            category: item.product?.category || 'Sin categoría',
            quantity: item.quantity,
            price: item.price,
            total: item.total,
            user: sale.user?.username || 'N/A'
          });
        });
      });
      
      // Escribir CSV
      await csvWriter.writeRecords(records);
      
      // Enviar archivo
      res.download(csvFilePath, `ventas-${req.tenant.name}-${timestamp}.csv`, err => {
        if (err) {
          console.error('Error al enviar archivo CSV:', err);
        }
        
        // Eliminar archivo temporal después de enviarlo
        fs.unlink(csvFilePath, unlinkErr => {
          if (unlinkErr) {
            console.error('Error al eliminar archivo temporal:', unlinkErr);
          }
        });
      });
    } catch (error) {
      console.error('Error al exportar ventas:', error);
      res.status(500).json({ message: 'Error al exportar ventas', error: error.message });
    }
  },
  
  /**
   * Exportar compras a CSV
   * @route GET /api/exports/purchases
   */
  exportPurchases: async (req, res) => {
    try {
      // Verificar permisos
      if (!req.user) {
        return res.status(401).json({ message: 'No autorizado' });
      }
      
      // Verificar tenant
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Obtener parámetros de consulta
      const { startDate, endDate, supplier } = req.query;
      
      // Construir filtro base
      const filter = {
        tenantId: req.tenant._id
      };
      
      // Añadir filtros adicionales si se proporcionan
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999);
          filter.date.$lte = endDateObj;
        }
      }
      
      if (supplier) {
        filter.supplier = { $regex: supplier, $options: 'i' };
      }
      
      // Obtener compras con detalles
      const purchases = await Purchase.find(filter)
        .sort({ date: -1 })
        .populate('user', 'username')
        .populate('items.product', 'name category');
      
      // Crear archivo CSV temporal
      const tmpDir = os.tmpdir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const csvFilePath = path.join(tmpDir, `compras-${timestamp}.csv`);
      
      const csvWriter = createObjectCsvWriter({
        path: csvFilePath,
        header: [
          { id: 'date', title: 'Fecha' },
          { id: 'purchaseId', title: 'ID Compra' },
          { id: 'supplier', title: 'Proveedor' },
          { id: 'product', title: 'Producto' },
          { id: 'category', title: 'Categoría' },
          { id: 'quantity', title: 'Cantidad' },
          { id: 'price', title: 'Precio Unitario' },
          { id: 'total', title: 'Total' },
          { id: 'user', title: 'Usuario' }
        ]
      });
      
      // Formatear datos (expandir items para tener una fila por producto)
      const records = [];
      
      purchases.forEach(purchase => {
        purchase.items.forEach(item => {
          records.push({
            date: purchase.date.toISOString().split('T')[0],
            purchaseId: purchase._id.toString(),
            supplier: purchase.supplier || 'N/A',
            product: item.product?.name || 'Producto desconocido',
            category: item.product?.category || 'Sin categoría',
            quantity: item.quantity,
            price: item.price,
            total: item.total,
            user: purchase.user?.username || 'N/A'
          });
        });
      });
      
      // Escribir CSV
      await csvWriter.writeRecords(records);
      
      // Enviar archivo
      res.download(csvFilePath, `compras-${req.tenant.name}-${timestamp}.csv`, err => {
        if (err) {
          console.error('Error al enviar archivo CSV:', err);
        }
        
        // Eliminar archivo temporal después de enviarlo
        fs.unlink(csvFilePath, unlinkErr => {
          if (unlinkErr) {
            console.error('Error al eliminar archivo temporal:', unlinkErr);
          }
        });
      });
    } catch (error) {
      console.error('Error al exportar compras:', error);
      res.status(500).json({ message: 'Error al exportar compras', error: error.message });
    }
  }
};

module.exports = {
  reportsController,
  exportController
};