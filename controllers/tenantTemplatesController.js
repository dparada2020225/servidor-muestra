// controllers/tenantTemplatesController.js
const Tenant = require('../models/Tenant');
const mongoose = require('mongoose');
const auditService = require('../services/auditService');

/**
 * Controlador para gestionar plantillas de documentos por tenant
 */
const tenantTemplatesController = {
  /**
   * Obtener todas las plantillas disponibles para un tenant
   * @route GET /api/tenant/templates
   */
  getTemplates: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar permisos
      const hasPermission = req.user.role === 'tenantAdmin' || 
                          req.user.role === 'tenantManager' || 
                          req.user.role === 'superAdmin';
                          
      if (!hasPermission) {
        return res.status(403).json({ message: 'No tienes permiso para ver plantillas' });
      }
      
      // Obtener tenant
      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }
      
      // Obtener tipo de plantilla (opcional)
      const { type } = req.query;
      
      // Plantillas predeterminadas del sistema
      const defaultTemplates = [
        {
          id: 'invoice-default',
          name: 'Factura Estándar',
          type: 'invoice',
          systemTemplate: true,
          content: {
            header: '{{company_name}}',
            title: 'FACTURA',
            subtitle: 'Factura #{{invoice_number}}',
            date: 'Fecha: {{date}}',
            clientInfo: 'Cliente: {{client_name}}\nDirección: {{client_address}}',
            table: {
              headers: ['Cantidad', 'Descripción', 'Precio Unitario', 'Total'],
              rows: '{{items}}'
            },
            footer: 'Subtotal: {{subtotal}}\nImpuestos: {{taxes}}\nTotal: {{total}}',
            notes: 'Gracias por su compra'
          },
          createdAt: new Date('2023-01-01')
        },
        {
          id: 'receipt-default',
          name: 'Recibo de Caja',
          type: 'receipt',
          systemTemplate: true,
          content: {
            header: '{{company_name}}',
            title: 'RECIBO',
            subtitle: 'Recibo #{{receipt_number}}',
            date: 'Fecha: {{date}}',
            clientInfo: 'Recibido de: {{client_name}}',
            body: 'La cantidad de: {{amount_text}}\nPor concepto de: {{concept}}',
            total: 'Monto: {{amount}}',
            signature: 'Firma: ________________'
          },
          createdAt: new Date('2023-01-01')
        },
        {
          id: 'purchase-order-default',
          name: 'Orden de Compra',
          type: 'purchase',
          systemTemplate: true,
          content: {
            header: '{{company_name}}',
            title: 'ORDEN DE COMPRA',
            subtitle: 'Orden #{{order_number}}',
            date: 'Fecha: {{date}}',
            supplierInfo: 'Proveedor: {{supplier_name}}\nDirección: {{supplier_address}}',
            table: {
              headers: ['Cantidad', 'Descripción', 'Precio Unitario', 'Total'],
              rows: '{{items}}'
            },
            footer: 'Subtotal: {{subtotal}}\nImpuestos: {{taxes}}\nTotal: {{total}}',
            notes: 'Notas: {{notes}}'
          },
          createdAt: new Date('2023-01-01')
        }
      ];
      
      // Obtener plantillas personalizadas del tenant
      const customTemplates = tenant.templates || [];
      
      // Filtrar por tipo si se especifica
      let filteredTemplates = [...defaultTemplates, ...customTemplates];
      
      if (type) {
        filteredTemplates = filteredTemplates.filter(template => template.type === type);
      }
      
      // Transformar respuesta para incluir información de origen
      const formattedTemplates = filteredTemplates.map(template => ({
        ...template,
        source: template.systemTemplate ? 'system' : 'custom'
      }));
      
      res.status(200).json({
        templates: formattedTemplates
      });
    } catch (error) {
      console.error('Error al obtener plantillas:', error);
      res.status(500).json({ message: 'Error al obtener plantillas', error: error.message });
    }
  },
  
  /**
   * Obtener una plantilla específica
   * @route GET /api/tenant/templates/:id
   */
  getTemplateById: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar permisos
      const hasPermission = req.user.role === 'tenantAdmin' || 
                          req.user.role === 'tenantManager' || 
                          req.user.role === 'superAdmin';
                          
      if (!hasPermission) {
        return res.status(403).json({ message: 'No tienes permiso para ver plantillas' });
      }
      
      const templateId = req.params.id;
      
      // Verificar si es una plantilla del sistema
      const defaultTemplates = [
        {
          id: 'invoice-default',
          name: 'Factura Estándar',
          type: 'invoice',
          systemTemplate: true,
          content: {
            header: '{{company_name}}',
            title: 'FACTURA',
            subtitle: 'Factura #{{invoice_number}}',
            date: 'Fecha: {{date}}',
            clientInfo: 'Cliente: {{client_name}}\nDirección: {{client_address}}',
            table: {
              headers: ['Cantidad', 'Descripción', 'Precio Unitario', 'Total'],
              rows: '{{items}}'
            },
            footer: 'Subtotal: {{subtotal}}\nImpuestos: {{taxes}}\nTotal: {{total}}',
            notes: 'Gracias por su compra'
          },
          createdAt: new Date('2023-01-01')
        },
        {
          id: 'receipt-default',
          name: 'Recibo de Caja',
          type: 'receipt',
          systemTemplate: true,
          content: {
            header: '{{company_name}}',
            title: 'RECIBO',
            subtitle: 'Recibo #{{receipt_number}}',
            date: 'Fecha: {{date}}',
            clientInfo: 'Recibido de: {{client_name}}',
            body: 'La cantidad de: {{amount_text}}\nPor concepto de: {{concept}}',
            total: 'Monto: {{amount}}',
            signature: 'Firma: ________________'
          },
          createdAt: new Date('2023-01-01')
        },
        {
          id: 'purchase-order-default',
          name: 'Orden de Compra',
          type: 'purchase',
          systemTemplate: true,
          content: {
            header: '{{company_name}}',
            title: 'ORDEN DE COMPRA',
            subtitle: 'Orden #{{order_number}}',
            date: 'Fecha: {{date}}',
            supplierInfo: 'Proveedor: {{supplier_name}}\nDirección: {{supplier_address}}',
            table: {
              headers: ['Cantidad', 'Descripción', 'Precio Unitario', 'Total'],
              rows: '{{items}}'
            },
            footer: 'Subtotal: {{subtotal}}\nImpuestos: {{taxes}}\nTotal: {{total}}',
            notes: 'Notas: {{notes}}'
          },
          createdAt: new Date('2023-01-01')
        }
      ];
      
      // Buscar en plantillas del sistema
      const systemTemplate = defaultTemplates.find(template => template.id === templateId);
      
      if (systemTemplate) {
        return res.status(200).json({
          template: {
            ...systemTemplate,
            source: 'system'
          }
        });
      }
      
      // Si no es una plantilla del sistema, buscar en las del tenant
      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }
      
      if (!tenant.templates || !Array.isArray(tenant.templates)) {
        return res.status(404).json({ message: 'No se encontraron plantillas personalizadas' });
      }
      
      const customTemplate = tenant.templates.find(template => template.id === templateId);
      
      if (!customTemplate) {
        return res.status(404).json({ message: 'Plantilla no encontrada' });
      }
      
      res.status(200).json({
        template: {
          ...customTemplate,
          source: 'custom'
        }
      });
    } catch (error) {
      console.error('Error al obtener plantilla:', error);
      res.status(500).json({ message: 'Error al obtener plantilla', error: error.message });
    }
  },
  
  /**
   * Crear una nueva plantilla personalizada
   * @route POST /api/tenant/templates
   */
  createTemplate: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar permisos
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para crear plantillas' });
      }
      
      const { name, type, content } = req.body;
      
      if (!name || !type || !content) {
        return res.status(400).json({ message: 'Se requiere nombre, tipo y contenido para crear una plantilla' });
      }
      
      // Obtener el tenant completo
      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }
      
      // Inicializar array de plantillas si no existe
      if (!tenant.templates) {
        tenant.templates = [];
      }
      
      // Generar ID único para la plantilla
      const templateId = `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Crear nueva plantilla
      const newTemplate = {
        id: templateId,
        name,
        type,
        content,
        createdBy: req.user.id,
        createdAt: new Date()
      };
      
      // Añadir a la lista de plantillas
      tenant.templates.push(newTemplate);
      
      // Guardar cambios
      await tenant.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'create',
        entityType: 'template',
        description: `Creación de plantilla personalizada: ${name}`,
        details: newTemplate,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: tenant._id,
        ipAddress: req.ip
      });
      
      res.status(201).json({
        message: 'Plantilla creada correctamente',
        template: {
          ...newTemplate,
          source: 'custom'
        }
      });
    } catch (error) {
      console.error('Error al crear plantilla:', error);
      res.status(500).json({ message: 'Error al crear plantilla', error: error.message });
    }
  },
  
  /**
   * Actualizar una plantilla personalizada
   * @route PUT /api/tenant/templates/:id
   */
  updateTemplate: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar permisos
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para actualizar plantillas' });
      }
      
      const templateId = req.params.id;
      const { name, content } = req.body;
      
      if (!templateId || (!name && !content)) {
        return res.status(400).json({ message: 'Se requiere ID de plantilla y al menos un campo para actualizar' });
      }
      
      // Verificar si es una plantilla del sistema
      const systemTemplateIds = ['invoice-default', 'receipt-default', 'purchase-order-default'];
      if (systemTemplateIds.includes(templateId)) {
        return res.status(403).json({ message: 'No se pueden modificar plantillas del sistema' });
      }
      
      // Obtener el tenant completo
      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }
      
      // Verificar si existe la plantilla
      if (!tenant.templates || !Array.isArray(tenant.templates)) {
        return res.status(404).json({ message: 'No se encontraron plantillas personalizadas' });
      }
      
      // Buscar el índice de la plantilla en el array
      const templateIndex = tenant.templates.findIndex(template => template.id === templateId);
      
      if (templateIndex === -1) {
        return res.status(404).json({ message: 'Plantilla no encontrada' });
      }
      
      // Guardar plantilla anterior para auditoría
      const previousTemplate = { ...tenant.templates[templateIndex] };
      
      // Actualizar propiedades
      if (name) {
        tenant.templates[templateIndex].name = name;
      }
      
      if (content) {
        tenant.templates[templateIndex].content = {
          ...tenant.templates[templateIndex].content,
          ...content
        };
      }
      
      // Actualizar fecha de modificación
      tenant.templates[templateIndex].updatedAt = new Date();
      tenant.templates[templateIndex].updatedBy = req.user.id;
      
      // Guardar cambios
      await tenant.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'template',
        description: `Actualización de plantilla personalizada: ${tenant.templates[templateIndex].name}`,
        details: {
          previous: previousTemplate,
          current: tenant.templates[templateIndex]
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: tenant._id,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: 'Plantilla actualizada correctamente',
        template: {
          ...tenant.templates[templateIndex],
          source: 'custom'
        }
      });
    } catch (error) {
      console.error('Error al actualizar plantilla:', error);
      res.status(500).json({ message: 'Error al actualizar plantilla', error: error.message });
    }
  },
  
  /**
   * Eliminar una plantilla personalizada
   * @route DELETE /api/tenant/templates/:id
   */
  deleteTemplate: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar permisos
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para eliminar plantillas' });
      }
      
      const templateId = req.params.id;
      
      if (!templateId) {
        return res.status(400).json({ message: 'Se requiere ID de plantilla' });
      }
      
      // Verificar si es una plantilla del sistema
      const systemTemplateIds = ['invoice-default', 'receipt-default', 'purchase-order-default'];
      if (systemTemplateIds.includes(templateId)) {
        return res.status(403).json({ message: 'No se pueden eliminar plantillas del sistema' });
      }
      
      // Obtener el tenant completo
      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }
      
      // Verificar si existe la plantilla
      if (!tenant.templates || !Array.isArray(tenant.templates)) {
        return res.status(404).json({ message: 'No se encontraron plantillas personalizadas' });
      }
      
      // Buscar el índice de la plantilla en el array
      const templateIndex = tenant.templates.findIndex(template => template.id === templateId);
      
      if (templateIndex === -1) {
        return res.status(404).json({ message: 'Plantilla no encontrada' });
      }
      
      // Guardar plantilla para auditoría
      const deletedTemplate = { ...tenant.templates[templateIndex] };
      
      // Eliminar plantilla
      tenant.templates.splice(templateIndex, 1);
      
      // Guardar cambios
      await tenant.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'delete',
        entityType: 'template',
        description: `Eliminación de plantilla personalizada: ${deletedTemplate.name}`,
        details: deletedTemplate,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: tenant._id,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: 'Plantilla eliminada correctamente'
      });
    } catch (error) {
      console.error('Error al eliminar plantilla:', error);
      res.status(500).json({ message: 'Error al eliminar plantilla', error: error.message });
    }
  },
  
  /**
   * Duplicar una plantilla existente
   * @route POST /api/tenant/templates/:id/duplicate
   */
  duplicateTemplate: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar permisos
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para duplicar plantillas' });
      }
      
      const templateId = req.params.id;
      const { newName } = req.body;
      
      if (!templateId) {
        return res.status(400).json({ message: 'Se requiere ID de plantilla' });
      }
      
      let sourceTemplate = null;
      let isSystemTemplate = false;
      
      // Verificar si es una plantilla del sistema
      const defaultTemplates = [
        {
          id: 'invoice-default',
          name: 'Factura Estándar',
          type: 'invoice',
          systemTemplate: true,
          content: {
            header: '{{company_name}}',
            title: 'FACTURA',
            subtitle: 'Factura #{{invoice_number}}',
            date: 'Fecha: {{date}}',
            clientInfo: 'Cliente: {{client_name}}\nDirección: {{client_address}}',
            table: {
              headers: ['Cantidad', 'Descripción', 'Precio Unitario', 'Total'],
              rows: '{{items}}'
            },
            footer: 'Subtotal: {{subtotal}}\nImpuestos: {{taxes}}\nTotal: {{total}}',
            notes: 'Gracias por su compra'
          }
        },
        {
          id: 'receipt-default',
          name: 'Recibo de Caja',
          type: 'receipt',
          systemTemplate: true,
          content: {
            header: '{{company_name}}',
            title: 'RECIBO',
            subtitle: 'Recibo #{{receipt_number}}',
            date: 'Fecha: {{date}}',
            clientInfo: 'Recibido de: {{client_name}}',
            body: 'La cantidad de: {{amount_text}}\nPor concepto de: {{concept}}',
            total: 'Monto: {{amount}}',
            signature: 'Firma: ________________'
          }
        },
        {
          id: 'purchase-order-default',
          name: 'Orden de Compra',
          type: 'purchase',
          systemTemplate: true,
          content: {
            header: '{{company_name}}',
            title: 'ORDEN DE COMPRA',
            subtitle: 'Orden #{{order_number}}',
            date: 'Fecha: {{date}}',
            supplierInfo: 'Proveedor: {{supplier_name}}\nDirección: {{supplier_address}}',
            table: {
              headers: ['Cantidad', 'Descripción', 'Precio Unitario', 'Total'],
              rows: '{{items}}'
            },
            footer: 'Subtotal: {{subtotal}}\nImpuestos: {{taxes}}\nTotal: {{total}}',
            notes: 'Notas: {{notes}}'
          }
        }
      ];
      
      // Buscar en plantillas del sistema
      const systemTemplate = defaultTemplates.find(template => template.id === templateId);
      
      if (systemTemplate) {
        sourceTemplate = systemTemplate;
        isSystemTemplate = true;
      } else {
        // Si no es una plantilla del sistema, buscar en las del tenant
        const tenant = await Tenant.findById(req.tenant._id);
        
        if (!tenant) {
          return res.status(404).json({ message: 'Tenant no encontrado' });
        }
        
        if (!tenant.templates || !Array.isArray(tenant.templates)) {
          return res.status(404).json({ message: 'No se encontraron plantillas personalizadas' });
        }
        
        const customTemplate = tenant.templates.find(template => template.id === templateId);
        
        if (!customTemplate) {
          return res.status(404).json({ message: 'Plantilla no encontrada' });
        }
        
        sourceTemplate = customTemplate;
      }
      
      // Ahora tenemos la plantilla fuente, crear duplicado
      const tenant = await Tenant.findById(req.tenant._id);
      
      // Inicializar array de plantillas si no existe
      if (!tenant.templates) {
        tenant.templates = [];
      }
      
      // Generar ID único para la nueva plantilla
      const newTemplateId = `${sourceTemplate.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Crear nueva plantilla (copia)
      const newTemplate = {
        id: newTemplateId,
        name: newName || `Copia de ${sourceTemplate.name}`,
        type: sourceTemplate.type,
        content: JSON.parse(JSON.stringify(sourceTemplate.content)), // Copia profunda
        createdBy: req.user.id,
        createdAt: new Date(),
        source: isSystemTemplate ? 'system-copy' : 'custom-copy'
      };
      
      // Añadir a la lista de plantillas
      tenant.templates.push(newTemplate);
      
      // Guardar cambios
      await tenant.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'create',
        entityType: 'template',
        description: `Duplicación de plantilla: ${sourceTemplate.name} -> ${newTemplate.name}`,
        details: {
          sourceTemplate: {
            id: sourceTemplate.id,
            name: sourceTemplate.name,
            type: sourceTemplate.type,
            source: isSystemTemplate ? 'system' : 'custom'
          },
          newTemplate
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: tenant._id,
        ipAddress: req.ip
      });
      
      res.status(201).json({
        message: 'Plantilla duplicada correctamente',
        template: {
          ...newTemplate,
          source: 'custom'
        }
      });
    } catch (error) {
      console.error('Error al duplicar plantilla:', error);
      res.status(500).json({ message: 'Error al duplicar plantilla', error: error.message });
    }
  }
};

module.exports = tenantTemplatesController;