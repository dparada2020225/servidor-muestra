// controllers/tenantSettingsController.js
const Tenant = require('../models/Tenant');
const auditService = require('../services/auditService');

const tenantSettingsController = {
  /**
   * Obtener configuraciones del tenant actual
   * @route GET /api/tenant/settings
   */
  getSettings: async (req, res) => {
    try {
      // Verificar si hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Devolver la configuración actual
      res.status(200).json({
        settings: req.tenant.settings,
        status: req.tenant.status,
        plan: req.tenant.plan
      });
    } catch (error) {
      console.error('Error al obtener configuraciones:', error);
      res.status(500).json({ message: 'Error al obtener configuraciones', error: error.message });
    }
  },
  
  /**
   * Actualizar configuraciones del tenant actual
   * @route PUT /api/tenant/settings
   */
  updateSettings: async (req, res) => {
    try {
      // Verificar si hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar si el usuario tiene permisos para actualizar
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para actualizar configuraciones' });
      }
      
      const { settings } = req.body;
      
      if (!settings) {
        return res.status(400).json({ message: 'No se proporcionaron configuraciones para actualizar' });
      }
      
      // Guardar configuración anterior para auditoría
      const previousSettings = { ...req.tenant.settings };
      
      // Actualizar configuraciones (fusionar con las existentes)
      const tenant = await Tenant.findByIdAndUpdate(
        req.tenant._id,
        { 
          $set: { 
            'settings': {
              ...req.tenant.settings,
              ...settings
            }
          } 
        },
        { new: true }
      );
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'tenant',
        entityId: tenant._id,
        description: `Actualización de configuraciones del tenant: ${tenant.name}`,
        details: {
          previous: previousSettings,
          current: tenant.settings,
          changedBy: req.user.username
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: tenant._id,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: 'Configuraciones actualizadas correctamente',
        settings: tenant.settings
      });
    } catch (error) {
      console.error('Error al actualizar configuraciones:', error);
      res.status(500).json({ message: 'Error al actualizar configuraciones', error: error.message });
    }
  },
  
  /**
   * Obtener configuración de marca del tenant actual
   * @route GET /api/tenant/branding
   */
  getBranding: async (req, res) => {
    try {
      // Verificar si hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Devolver la configuración de marca
      res.status(200).json({
        branding: req.tenant.customization,
        logo: req.tenant.logo
      });
    } catch (error) {
      console.error('Error al obtener configuración de marca:', error);
      res.status(500).json({ message: 'Error al obtener configuración de marca', error: error.message });
    }
  },
  
  /**
   * Actualizar configuración de marca del tenant actual
   * @route PUT /api/tenant/branding
   */
  updateBranding: async (req, res) => {
    try {
      // Verificar si hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar si el usuario tiene permisos para actualizar
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para actualizar la marca' });
      }
      
      const { customization, logo } = req.body;
      
      if (!customization && !logo) {
        return res.status(400).json({ message: 'No se proporcionaron datos para actualizar' });
      }
      
      // Construir objeto de actualización
      const updateData = {};
      
      if (customization) {
        // Fusionar con la configuración existente
        updateData.customization = {
          ...req.tenant.customization,
          ...customization
        };
      }
      
      if (logo) {
        updateData.logo = logo;
      }
      
      // Guardar configuración anterior para auditoría
      const previousBranding = { 
        customization: { ...req.tenant.customization },
        logo: req.tenant.logo
      };
      
      // Actualizar tenant
      const tenant = await Tenant.findByIdAndUpdate(
        req.tenant._id,
        { $set: updateData },
        { new: true }
      );
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'tenant',
        entityId: tenant._id,
        description: `Actualización de marca del tenant: ${tenant.name}`,
        details: {
          previous: previousBranding,
          current: {
            customization: tenant.customization,
            logo: tenant.logo
          },
          changedBy: req.user.username
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: tenant._id,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: 'Configuración de marca actualizada correctamente',
        branding: tenant.customization,
        logo: tenant.logo
      });
    } catch (error) {
      console.error('Error al actualizar configuración de marca:', error);
      res.status(500).json({ message: 'Error al actualizar configuración de marca', error: error.message });
    }
  }
};

module.exports = tenantSettingsController;