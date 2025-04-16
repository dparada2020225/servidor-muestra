// controllers/adminPlatformController.js
const mongoose = require('mongoose');
const auditService = require('../services/auditService');
const fs = require('fs');
const path = require('path');

/**
 * Configuración global de la plataforma
 * Nota: Como no hay un modelo específico para configuración global,
 * utilizaremos un archivo JSON para almacenar la configuración.
 */

// Ruta al archivo de configuración
const configFilePath = path.join(__dirname, '../config/platform-config.json');

// Asegurar que el directorio config existe
if (!fs.existsSync(path.join(__dirname, '../config'))) {
  fs.mkdirSync(path.join(__dirname, '../config'), { recursive: true });
}

// Configuración por defecto
const defaultConfig = {
  platform: {
    name: 'Inventario SaaS',
    version: '1.0.0',
    defaultLanguage: 'es',
    supportEmail: 'soporte@tuapp.com',
    mainDomain: 'tuapp.com'
  },
  security: {
    passwordPolicies: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false
    },
    sessionTimeout: 60, // minutos
    maxLoginAttempts: 5,
    lockoutDuration: 30, // minutos
    jwtExpiration: 24 // horas
  },
  email: {
    enabled: false,
    provider: 'smtp',
    from: 'no-reply@tuapp.com',
    smtp: {
      host: 'smtp.example.com',
      port: 587,
      secure: false
    }
  },
  tenants: {
    defaultPlan: 'trial',
    trialDurationDays: 30,
    plans: [
      {
        id: 'free',
        name: 'Gratuito',
        price: 0,
        maxUsers: 3,
        maxProducts: 50,
        maxStorageMB: 100,
        features: {
          multipleLocations: false,
          advancedReports: false,
          apiAccess: false
        }
      },
      {
        id: 'basic',
        name: 'Básico',
        price: 9.99,
        maxUsers: 10,
        maxProducts: 500,
        maxStorageMB: 1024,
        features: {
          multipleLocations: false,
          advancedReports: true,
          apiAccess: false
        }
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 29.99,
        maxUsers: 25,
        maxProducts: 5000,
        maxStorageMB: 10240,
        features: {
          multipleLocations: true,
          advancedReports: true,
          apiAccess: true
        }
      },
      {
        id: 'enterprise',
        name: 'Empresarial',
        price: 99.99,
        maxUsers: 100,
        maxProducts: 50000,
        maxStorageMB: 102400,
        features: {
          multipleLocations: true,
          advancedReports: true,
          apiAccess: true
        }
      }
    ]
  },
  maintenance: {
    enabled: false,
    message: 'El sistema está en mantenimiento. Por favor, inténtelo más tarde.',
    plannedEndTime: null
  },
  backup: {
    autoBackup: true,
    backupFrequency: 'daily', // daily, weekly, monthly
    backupTime: '03:00', // 3 AM
    retentionDays: 30
  }
};

/**
 * Cargar configuración actual
 * @returns {Object} La configuración actual o la configuración por defecto
 */
const loadConfig = () => {
  try {
    if (fs.existsSync(configFilePath)) {
      const configData = fs.readFileSync(configFilePath, 'utf8');
      return JSON.parse(configData);
    } else {
      // Si no existe, guardar y devolver la configuración por defecto
      fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      return defaultConfig;
    }
  } catch (error) {
    console.error('Error al cargar configuración de plataforma:', error);
    return defaultConfig;
  }
};

/**
 * Guardar configuración
 * @param {Object} config La configuración a guardar
 * @returns {Boolean} true si se guardó correctamente, false en caso contrario
 */
const saveConfig = (config) => {
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error al guardar configuración de plataforma:', error);
    return false;
  }
};

const adminPlatformController = {
  /**
   * Obtener configuración de la plataforma
   * @route GET /api/admin/platform/config
   */
  getPlatformConfig: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      // Cargar configuración
      const config = loadConfig();

      // Registrar en auditoría
      await auditService.logAction({
        action: 'view',
        entityType: 'setting',
        description: 'Consulta de configuración global de plataforma',
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });

      res.status(200).json(config);
    } catch (error) {
      console.error('Error al obtener configuración de plataforma:', error);
      res.status(500).json({ message: 'Error al obtener configuración', error: error.message });
    }
  },

  /**
   * Actualizar configuración de la plataforma
   * @route PUT /api/admin/platform/config
   */
  updatePlatformConfig: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      // Obtener configuración actual
      const currentConfig = loadConfig();
      
      // Obtener actualizaciones del body
      const updates = req.body;
      
      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No se proporcionaron datos para actualizar' });
      }

      // Función para actualizar recursivamente respetando la estructura
      const mergeConfigs = (target, source) => {
        Object.keys(source).forEach(key => {
          if (
            source[key] && 
            typeof source[key] === 'object' && 
            !Array.isArray(source[key])
          ) {
            // Si la propiedad no existe en el target, crearla
            if (!target[key]) {
              target[key] = {};
            }
            
            // Recursivamente actualizar propiedades anidadas
            mergeConfigs(target[key], source[key]);
          } else {
            // Asignar directamente para valores simples o arrays
            target[key] = source[key];
          }
        });
        return target;
      };

      // Crear copia para auditoría
      const previousConfig = JSON.parse(JSON.stringify(currentConfig));
      
      // Actualizar configuración mediante fusión recursiva
      const updatedConfig = mergeConfigs(currentConfig, updates);
      
      // Guardar configuración actualizada
      const saved = saveConfig(updatedConfig);
      
      if (!saved) {
        return res.status(500).json({ 
          message: 'Error al guardar la configuración. Verifica permisos de escritura.' 
        });
      }

      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'setting',
        description: 'Actualización de configuración global de plataforma',
        details: {
          previous: previousConfig,
          current: updatedConfig,
          changedSections: Object.keys(updates)
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });

      res.status(200).json({ 
        message: 'Configuración actualizada correctamente',
        config: updatedConfig
      });
    } catch (error) {
      console.error('Error al actualizar configuración de plataforma:', error);
      res.status(500).json({ message: 'Error al actualizar configuración', error: error.message });
    }
  },

  /**
   * Restablecer configuración de la plataforma a valores predeterminados
   * @route POST /api/admin/platform/config/reset
   */
  resetPlatformConfig: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      // Obtener configuración actual para auditoría
      const currentConfig = loadConfig();
      
      // Guardar configuración por defecto
      const saved = saveConfig(defaultConfig);
      
      if (!saved) {
        return res.status(500).json({ 
          message: 'Error al restablecer la configuración. Verifica permisos de escritura.' 
        });
      }

      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'setting',
        description: 'Restablecimiento de configuración global a valores predeterminados',
        details: {
          previous: currentConfig,
          current: defaultConfig
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });

      res.status(200).json({ 
        message: 'Configuración restablecida a valores predeterminados',
        config: defaultConfig
      });
    } catch (error) {
      console.error('Error al restablecer configuración de plataforma:', error);
      res.status(500).json({ message: 'Error al restablecer configuración', error: error.message });
    }
  },

  /**
   * Activar/desactivar modo mantenimiento
   * @route POST /api/admin/platform/maintenance
   */
  toggleMaintenanceMode: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      const { enabled, message, plannedEndTime } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'Se requiere especificar enabled como true o false' });
      }

      // Cargar configuración actual
      const config = loadConfig();
      
      // Actualizar configuración de mantenimiento
      config.maintenance = {
        enabled,
        message: message || config.maintenance.message,
        plannedEndTime: plannedEndTime || config.maintenance.plannedEndTime
      };
      
      // Guardar configuración actualizada
      const saved = saveConfig(config);
      
      if (!saved) {
        return res.status(500).json({ 
          message: 'Error al actualizar modo mantenimiento. Verifica permisos de escritura.' 
        });
      }

      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'setting',
        description: `${enabled ? 'Activación' : 'Desactivación'} de modo mantenimiento`,
        details: {
          enabled,
          message: config.maintenance.message,
          plannedEndTime: config.maintenance.plannedEndTime
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });

      res.status(200).json({ 
        message: `Modo mantenimiento ${enabled ? 'activado' : 'desactivado'} correctamente`,
        maintenance: config.maintenance
      });
    } catch (error) {
      console.error('Error al cambiar modo mantenimiento:', error);
      res.status(500).json({ message: 'Error al cambiar modo mantenimiento', error: error.message });
    }
  }
};

module.exports = adminPlatformController;