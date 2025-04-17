// controllers/adminUserManagementController.js
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const bcrypt = require('bcrypt');
const auditService = require('../services/auditService');

/**
 * Controlador para gestión avanzada de usuarios por parte del superadmin
 */
const adminUserManagementController = {
  /**
   * Actualizar el rol de un usuario (incluyendo superadmin)
   * @route PUT /api/admin/users/:id/role
   */
  updateUserRole: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      const { id } = req.params;
      const { role, tenantId } = req.body;

      // Validar role
      const validRoles = ['superAdmin', 'tenantAdmin', 'tenantManager', 'tenantUser'];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ 
          message: 'Rol inválido. Debe ser uno de: superAdmin, tenantAdmin, tenantManager, tenantUser' 
        });
      }

      // Buscar usuario
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Guardar rol anterior para auditoría
      const previousRole = user.role;
      const previousTenantId = user.tenantId;

      // Validar tenantId si el rol no es superAdmin
      if (role !== 'superAdmin') {
        if (!tenantId) {
          return res.status(400).json({ message: 'Se requiere tenantId para roles diferentes a superAdmin' });
        }

        // Verificar que el tenant existe
        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
          return res.status(404).json({ message: 'Tenant no encontrado' });
        }

        // Si el usuario cambia de tenant, verificar si es el único admin del tenant actual
        if (previousRole === 'tenantAdmin' && 
            user.tenantId && 
            tenantId !== user.tenantId.toString()) {
          
          const adminCount = await User.countDocuments({
            tenantId: user.tenantId,
            role: 'tenantAdmin',
            _id: { $ne: user._id }
          });

          if (adminCount === 0) {
            return res.status(400).json({ 
              message: 'No se puede cambiar el tenant de este usuario porque es el único administrador del tenant actual' 
            });
          }
        }
        
        // Asignar nuevo tenant
        user.tenantId = tenantId;
      } else {
        // Para superAdmin, eliminar tenantId
        user.tenantId = null;
      }

      // Actualizar rol
      user.role = role;
      await user.save();

      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'user',
        entityId: user._id,
        description: `Actualización de rol de usuario: ${user.username} (${previousRole} -> ${role})`,
        details: {
          previousRole,
          newRole: role,
          previousTenantId: previousTenantId ? previousTenantId.toString() : null,
          newTenantId: user.tenantId ? user.tenantId.toString() : null
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: user.tenantId,
        ipAddress: req.ip
      });

      res.status(200).json({
        message: 'Rol de usuario actualizado correctamente',
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
          tenantId: user.tenantId,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Error al actualizar rol de usuario:', error);
      res.status(500).json({ message: 'Error al actualizar rol de usuario', error: error.message });
    }
  },
  
  /**
   * Forzar el restablecimiento de contraseña de un usuario
   * @route POST /api/admin/users/:id/reset-password
   */
  resetUserPassword: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      const { id } = req.params;
      const { newPassword, sendEmail } = req.body;

      // Validar nueva contraseña
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
      }

      // Buscar usuario
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Verificar si el usuario es otro superAdmin
      if (user.role === 'superAdmin' && user._id.toString() !== req.user.id) {
        return res.status(403).json({ 
          message: 'Por seguridad, no se permite restablecer la contraseña de otro superadmin' 
        });
      }

      // Actualizar contraseña
      user.password = newPassword; // Se hasheará automáticamente en el pre-save hook
      await user.save();

      // Simular envío de email (en producción, implementar sistema real de emails)
      let emailSent = false;
      if (sendEmail && user.email) {
        // Implementación simulada - en producción, integrar con servicio de email real
        console.log(`[SIMULACIÓN] Email enviado a ${user.email} con nueva contraseña`);
        emailSent = true;
      }

      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'user',
        entityId: user._id,
        description: `Restablecimiento forzado de contraseña para usuario: ${user.username}`,
        details: {
          emailSent,
          emailAddress: user.email
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: user.tenantId,
        ipAddress: req.ip
      });

      res.status(200).json({
        message: 'Contraseña restablecida correctamente',
        user: {
          id: user._id,
          username: user.username,
          emailSent
        }
      });
    } catch (error) {
      console.error('Error al restablecer contraseña:', error);
      res.status(500).json({ message: 'Error al restablecer contraseña', error: error.message });
    }
  }
};

module.exports = adminUserManagementController;