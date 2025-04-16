// controllers/tenantUIController.js
const Tenant = require('../models/Tenant');
const mongoose = require('mongoose');
const auditService = require('../services/auditService');

/**
 * Controlador para gestionar la interfaz de usuario y personalización por tenant
 */
const tenantUIController = {
  /**
   * Obtener configuración UI para un tenant
   * @route GET /api/tenant/ui/config
   */
  getUIConfig: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Recuperar tenant
      const tenant = req.tenant;
      
      // Devolver solo la información relevante para UI
      const uiConfig = {
        tenant: {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          logo: tenant.logo
        },
        customization: tenant.customization || {
          primaryColor: '#3b82f6',
          secondaryColor: '#333333',
          logoText: tenant.name,
          currencySymbol: 'Q',
          dateFormat: 'DD/MM/YYYY'
        },
        ui: tenant.ui || {
          theme: 'light',
          sidebarCollapsed: false,
          menuLayout: 'vertical',
          density: 'comfortable',
          borderRadius: 'medium',
          fontFamily: 'system-ui'
        }
      };
      
      res.status(200).json(uiConfig);
    } catch (error) {
      console.error('Error al obtener configuración UI:', error);
      res.status(500).json({ message: 'Error al obtener configuración UI', error: error.message });
    }
  },
  
  /**
   * Actualizar configuración UI para un tenant
   * @route PUT /api/tenant/ui/config
   */
  updateUIConfig: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar permisos
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para actualizar esta configuración' });
      }
      
      const { customization, ui } = req.body;
      
      if (!customization && !ui) {
        return res.status(400).json({ message: 'No se proporcionaron datos para actualizar' });
      }
      
      // Obtener el tenant completo
      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }
      
      // Guardar estado anterior para auditoría
      const previousState = {
        customization: tenant.customization,
        ui: tenant.ui
      };
      
      // Actualizar campos
      if (customization) {
        // Si es un objeto, fusionar con la configuración existente
        tenant.customization = {
          ...tenant.customization,
          ...customization
        };
      }
      
      // Actualizar UI si se proporciona
      if (ui) {
        // Si no existe la propiedad ui, crearla
        if (!tenant.ui) {
          tenant.ui = {};
        }
        
        // Fusionar con la configuración existente
        tenant.ui = {
          ...tenant.ui,
          ...ui
        };
      }
      
      // Guardar cambios
      await tenant.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'tenant',
        entityId: tenant._id,
        description: 'Actualización de configuración UI de tenant',
        details: {
          previous: previousState,
          current: {
            customization: tenant.customization,
            ui: tenant.ui
          },
          updatedBy: req.user.username
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: tenant._id,
        ipAddress: req.ip
      });
      
      // Devolver configuración actualizada
      res.status(200).json({
        message: 'Configuración UI actualizada correctamente',
        tenant: {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          logo: tenant.logo
        },
        customization: tenant.customization,
        ui: tenant.ui
      });
    } catch (error) {
      console.error('Error al actualizar configuración UI:', error);
      res.status(500).json({ message: 'Error al actualizar configuración UI', error: error.message });
    }
  },
  
  /**
   * Restablecer configuración UI a valores predeterminados
   * @route POST /api/tenant/ui/config/reset
   */
  resetUIConfig: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar permisos
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para restablecer esta configuración' });
      }
      
      // Obtener el tenant completo
      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }
      
      // Guardar estado anterior para auditoría
      const previousState = {
        customization: tenant.customization,
        ui: tenant.ui
      };
      
      // Valores predeterminados
      const defaultCustomization = {
        primaryColor: '#3b82f6',
        secondaryColor: '#333333',
        logoText: tenant.name,
        currencySymbol: 'Q',
        dateFormat: 'DD/MM/YYYY'
      };
      
      const defaultUI = {
        theme: 'light',
        sidebarCollapsed: false,
        menuLayout: 'vertical',
        density: 'comfortable',
        borderRadius: 'medium',
        fontFamily: 'system-ui'
      };
      
      // Actualizar a valores predeterminados
      tenant.customization = defaultCustomization;
      tenant.ui = defaultUI;
      
      // Guardar cambios
      await tenant.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'tenant',
        entityId: tenant._id,
        description: 'Restablecimiento de configuración UI de tenant a valores predeterminados',
        details: {
          previous: previousState,
          current: {
            customization: tenant.customization,
            ui: tenant.ui
          },
          updatedBy: req.user.username
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: tenant._id,
        ipAddress: req.ip
      });
      
      // Devolver configuración restablecida
      res.status(200).json({
        message: 'Configuración UI restablecida a valores predeterminados',
        tenant: {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          logo: tenant.logo
        },
        customization: tenant.customization,
        ui: tenant.ui
      });
    } catch (error) {
      console.error('Error al restablecer configuración UI:', error);
      res.status(500).json({ message: 'Error al restablecer configuración UI', error: error.message });
    }
  }
};

module.exports = tenantUIController;