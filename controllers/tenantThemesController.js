// controllers/tenantThemesController.js
const Tenant = require('../models/Tenant');
const mongoose = require('mongoose');
const auditService = require('../services/auditService');

/**
 * Controlador para gestionar temas y esquemas de colores por tenant
 */
const tenantThemesController = {
  /**
   * Obtener temas disponibles para un tenant
   * @route GET /api/tenant/themes
   */
  getThemes: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Recuperar tenant
      const tenant = req.tenant;
      
      // Temas predefinidos
      const predefinedThemes = [
        {
          id: 'default',
          name: 'Tema Predeterminado',
          type: 'system',
          colors: {
            primary: '#3b82f6',
            secondary: '#333333',
            success: '#10b981',
            danger: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6',
            background: '#ffffff',
            text: '#333333',
            border: '#e5e7eb'
          }
        },
        {
          id: 'dark',
          name: 'Modo Oscuro',
          type: 'system',
          colors: {
            primary: '#3b82f6',
            secondary: '#6b7280',
            success: '#10b981',
            danger: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6',
            background: '#111827',
            text: '#f3f4f6',
            border: '#374151'
          }
        },
        {
          id: 'blue',
          name: 'Azul Corporativo',
          type: 'system',
          colors: {
            primary: '#2563eb',
            secondary: '#475569',
            success: '#10b981',
            danger: '#ef4444',
            warning: '#f59e0b',
            info: '#0ea5e9',
            background: '#f8fafc',
            text: '#0f172a',
            border: '#cbd5e1'
          }
        },
        {
          id: 'green',
          name: 'Verde Naturaleza',
          type: 'system',
          colors: {
            primary: '#059669',
            secondary: '#4b5563',
            success: '#16a34a',
            danger: '#dc2626',
            warning: '#f59e0b',
            info: '#0284c7',
            background: '#f8fafc',
            text: '#1e293b',
            border: '#d1d5db'
          }
        }
      ];
      
      // Temas personalizados del tenant
      const customThemes = tenant.themes || [];
      
      // Combinar temas predefinidos con personalizados
      const allThemes = [
        ...predefinedThemes,
        ...customThemes.map(theme => ({
          ...theme,
          type: 'custom'
        }))
      ];
      
      // Tema actual (configurado en el tenant)
      const currentThemeId = tenant.ui?.theme || 'default';
      const currentTheme = allThemes.find(theme => theme.id === currentThemeId) || predefinedThemes[0];
      
      res.status(200).json({
        currentTheme: currentThemeId,
        themes: allThemes
      });
    } catch (error) {
      console.error('Error al obtener temas:', error);
      res.status(500).json({ message: 'Error al obtener temas', error: error.message });
    }
  },
  
  /**
   * Crear un nuevo tema personalizado
   * @route POST /api/tenant/themes
   */
  createTheme: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar permisos
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para crear temas' });
      }
      
      const { name, colors } = req.body;
      
      if (!name || !colors) {
        return res.status(400).json({ message: 'Se requiere nombre y colores para crear un tema' });
      }
      
      // Obtener el tenant completo
      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }
      
      // Inicializar array de temas si no existe
      if (!tenant.themes) {
        tenant.themes = [];
      }
      
      // Generar ID único para el tema
      const themeId = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Crear nuevo tema
      const newTheme = {
        id: themeId,
        name,
        colors,
        createdBy: req.user.id,
        createdAt: new Date()
      };
      
      // Añadir a la lista de temas
      tenant.themes.push(newTheme);
      
      // Guardar cambios
      await tenant.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'create',
        entityType: 'theme',
        description: `Creación de tema personalizado: ${name}`,
        details: newTheme,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: tenant._id,
        ipAddress: req.ip
      });
      
      res.status(201).json({
        message: 'Tema creado correctamente',
        theme: {
          ...newTheme,
          type: 'custom'
        }
      });
    } catch (error) {
      console.error('Error al crear tema:', error);
      res.status(500).json({ message: 'Error al crear tema', error: error.message });
    }
  },
  
  /**
   * Actualizar un tema personalizado
   * @route PUT /api/tenant/themes/:id
   */
  updateTheme: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar permisos
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para actualizar temas' });
      }
      
      const { name, colors } = req.body;
      const themeId = req.params.id;
      
      if (!themeId || (!name && !colors)) {
        return res.status(400).json({ message: 'Se requiere ID del tema y al menos un campo para actualizar' });
      }
      
      // Obtener el tenant completo
      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }
      
      // Verificar si existe el tema
      if (!tenant.themes || !Array.isArray(tenant.themes)) {
        return res.status(404).json({ message: 'No se encontraron temas personalizados' });
      }
      
      // Buscar el índice del tema en el array
      const themeIndex = tenant.themes.findIndex(theme => theme.id === themeId);
      
      if (themeIndex === -1) {
        return res.status(404).json({ message: 'Tema no encontrado' });
      }
      
      // Verificar que no sea un tema del sistema
      if (themeId === 'default' || themeId === 'dark' || themeId === 'blue' || themeId === 'green') {
        return res.status(403).json({ message: 'No se pueden modificar temas del sistema' });
      }
      
      // Guardar tema anterior para auditoría
      const previousTheme = { ...tenant.themes[themeIndex] };
      
      // Actualizar propiedades
      if (name) {
        tenant.themes[themeIndex].name = name;
      }
      
      if (colors) {
        tenant.themes[themeIndex].colors = {
          ...tenant.themes[themeIndex].colors,
          ...colors
        };
      }
      
      // Actualizar fecha de modificación
      tenant.themes[themeIndex].updatedAt = new Date();
      tenant.themes[themeIndex].updatedBy = req.user.id;
      
      // Guardar cambios
      await tenant.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'theme',
        description: `Actualización de tema personalizado: ${tenant.themes[themeIndex].name}`,
        details: {
          previous: previousTheme,
          current: tenant.themes[themeIndex]
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: tenant._id,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: 'Tema actualizado correctamente',
        theme: {
          ...tenant.themes[themeIndex],
          type: 'custom'
        }
      });
    } catch (error) {
      console.error('Error al actualizar tema:', error);
      res.status(500).json({ message: 'Error al actualizar tema', error: error.message });
    }
  },
  
  /**
   * Eliminar un tema personalizado
   * @route DELETE /api/tenant/themes/:id
   */
  deleteTheme: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar permisos
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para eliminar temas' });
      }
      
      const themeId = req.params.id;
      
      if (!themeId) {
        return res.status(400).json({ message: 'Se requiere ID del tema' });
      }
      
      // Obtener el tenant completo
      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }
      
      // Verificar si existe el tema
      if (!tenant.themes || !Array.isArray(tenant.themes)) {
        return res.status(404).json({ message: 'No se encontraron temas personalizados' });
      }
      
      // Verificar que no sea un tema del sistema
      if (themeId === 'default' || themeId === 'dark' || themeId === 'blue' || themeId === 'green') {
        return res.status(403).json({ message: 'No se pueden eliminar temas del sistema' });
      }
      
      // Buscar el índice del tema en el array
      const themeIndex = tenant.themes.findIndex(theme => theme.id === themeId);
      
      if (themeIndex === -1) {
        return res.status(404).json({ message: 'Tema no encontrado' });
      }
      
      // Guardar tema para auditoría
      const deletedTheme = { ...tenant.themes[themeIndex] };
      
      // Verificar si el tema a eliminar es el actual
      if (tenant.ui && tenant.ui.theme === themeId) {
        // Cambiar al tema por defecto
        if (!tenant.ui) {
          tenant.ui = {};
        }
        tenant.ui.theme = 'default';
      }
      
      // Eliminar tema
      tenant.themes.splice(themeIndex, 1);
      
      // Guardar cambios
      await tenant.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'delete',
        entityType: 'theme',
        description: `Eliminación de tema personalizado: ${deletedTheme.name}`,
        details: deletedTheme,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: tenant._id,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: 'Tema eliminado correctamente',
        currentTheme: tenant.ui?.theme || 'default'
      });
    } catch (error) {
      console.error('Error al eliminar tema:', error);
      res.status(500).json({ message: 'Error al eliminar tema', error: error.message });
    }
  },
  
  /**
   * Aplicar un tema al tenant
   * @route POST /api/tenant/themes/:id/apply
   */
  applyTheme: async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Verificar permisos
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para cambiar el tema' });
      }
      
      const themeId = req.params.id;
      
      if (!themeId) {
        return res.status(400).json({ message: 'Se requiere ID del tema' });
      }
      
      // Obtener el tenant completo
      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }
      
      // Verificar si es un tema del sistema
      const isSystemTheme = ['default', 'dark', 'blue', 'green'].includes(themeId);
      
      // Si no es un tema del sistema, verificar que exista
      if (!isSystemTheme) {
        if (!tenant.themes || !Array.isArray(tenant.themes)) {
          return res.status(404).json({ message: 'No se encontraron temas personalizados' });
        }
        
        const themeExists = tenant.themes.some(theme => theme.id === themeId);
        
        if (!themeExists) {
          return res.status(404).json({ message: 'Tema no encontrado' });
        }
      }
      
      // Tema anterior para auditoría
      const previousTheme = tenant.ui?.theme || 'default';
      
      // Actualizar tema
      if (!tenant.ui) {
        tenant.ui = {};
      }
      tenant.ui.theme = themeId;
      
      // Guardar cambios
      await tenant.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'tenant',
        entityId: tenant._id,
        description: `Cambio de tema: de ${previousTheme} a ${themeId}`,
        details: {
          previous: previousTheme,
          current: themeId
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: tenant._id,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: 'Tema aplicado correctamente',
        currentTheme: themeId
      });
    } catch (error) {
      console.error('Error al aplicar tema:', error);
      res.status(500).json({ message: 'Error al aplicar tema', error: error.message });
    }
  }
};

module.exports = tenantThemesController;