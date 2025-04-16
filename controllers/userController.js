// controllers/userController.js
const User = require('../models/User');
const auditService = require('../services/auditService');
const bcrypt = require('bcrypt');
const { rolePermissions } = require('../middleware/permissionsMiddleware');

const userController = {
  /**
   * Obtener todos los usuarios del tenant actual
   * @route GET /api/users
   */
  getAllUsers: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para ver usuarios' });
      }
      
      // Verificar que hay un tenant
      if (!req.tenant && req.user.role !== 'superAdmin') {
        return res.status(400).json({ message: 'Tenant no identificado' });
      }
      
      // Si es superAdmin sin tenant especificado, puede ver todos los usuarios
      const query = req.tenant ? { tenantId: req.tenant._id } : {};
      
      // Excluir la contraseña en la respuesta
      const users = await User.find(query).select('-password');
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'view',
        entityType: 'user',
        description: 'Listado de usuarios',
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: req.tenant ? req.tenant._id : null,
        ipAddress: req.ip
      });
      
      res.status(200).json(users);
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
    }
  },
  
  /**
   * Obtener un usuario específico por ID
   * @route GET /api/users/:id
   */
  getUserById: async (req, res) => {
    try {
      // Verificar permisos (solo admin o el propio usuario)
      const isAdmin = ['tenantAdmin', 'superAdmin'].includes(req.user.role);
      const isSameUser = req.user.id === req.params.id;
      
      if (!isAdmin && !isSameUser) {
        return res.status(403).json({ message: 'No tienes permiso para ver este usuario' });
      }
      
      // Buscar usuario
      const user = await User.findById(req.params.id).select('-password');
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      // Verificar que pertenece al mismo tenant (si no es superAdmin)
      if (req.user.role !== 'superAdmin' && 
          req.tenant && 
          user.tenantId && 
          user.tenantId.toString() !== req.tenant._id.toString()) {
        return res.status(403).json({ message: 'No tienes permiso para ver este usuario' });
      }
      
      res.status(200).json(user);
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      res.status(500).json({ message: 'Error al obtener usuario', error: error.message });
    }
  },
  
  /**
   * Actualizar información de un usuario
   * @route PUT /api/users/:id
   */
  updateUser: async (req, res) => {
    try {
      // Verificar permisos (solo admin o el propio usuario)
      const isAdmin = ['tenantAdmin', 'superAdmin'].includes(req.user.role);
      const isSameUser = req.user.id === req.params.id;
      
      if (!isAdmin && !isSameUser) {
        return res.status(403).json({ message: 'No tienes permiso para actualizar este usuario' });
      }
      
      // Buscar usuario
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      // Verificar que pertenece al mismo tenant (si no es superAdmin)
      if (req.user.role !== 'superAdmin' && 
          req.tenant && 
          user.tenantId && 
          user.tenantId.toString() !== req.tenant._id.toString()) {
        return res.status(403).json({ message: 'No tienes permiso para actualizar este usuario' });
      }
      
      // Si no es admin, solo puede actualizar ciertos campos
      const allowedUpdates = {};
      
      if (isAdmin) {
        // Admins pueden actualizar más campos
        ['firstName', 'lastName', 'email', 'role', 'isActive'].forEach(field => {
          if (req.body[field] !== undefined) {
            allowedUpdates[field] = req.body[field];
          }
        });
        
        // Solo superAdmin puede cambiar rol a superAdmin
        if (allowedUpdates.role === 'superAdmin' && req.user.role !== 'superAdmin') {
          return res.status(403).json({ message: 'No tienes permiso para asignar rol de superAdmin' });
        }
      } else {
        // Usuarios normales solo pueden actualizar datos personales
        ['firstName', 'lastName', 'email'].forEach(field => {
          if (req.body[field] !== undefined) {
            allowedUpdates[field] = req.body[field];
          }
        });
      }
      
      // No permitir cambiar username o tenantId
      delete allowedUpdates.username;
      delete allowedUpdates.tenantId;
      
      // Guardar datos anteriores para auditoría
      const previousData = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      };
      
      // Actualizar usuario
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { $set: allowedUpdates },
        { new: true }
      ).select('-password');
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'user',
        entityId: updatedUser._id,
        description: `Actualización de usuario: ${updatedUser.username}`,
        details: {
          previous: previousData,
          current: {
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email,
            role: updatedUser.role,
            isActive: updatedUser.isActive
          },
          updatedFields: Object.keys(allowedUpdates)
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: updatedUser.tenantId,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: 'Usuario actualizado correctamente',
        user: updatedUser
      });
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      res.status(500).json({ message: 'Error al actualizar usuario', error: error.message });
    }
  },
  
  /**
   * Desactivar un usuario
   * @route DELETE /api/users/:id
   */
  deactivateUser: async (req, res) => {
    try {
      // Solo admins pueden desactivar usuarios
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para desactivar usuarios' });
      }
      
      // Buscar usuario
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      // Verificar que pertenece al mismo tenant (si no es superAdmin)
      if (req.user.role !== 'superAdmin' && 
          req.tenant && 
          user.tenantId && 
          user.tenantId.toString() !== req.tenant._id.toString()) {
        return res.status(403).json({ message: 'No tienes permiso para desactivar este usuario' });
      }
      
      // No permitir desactivar al único tenantAdmin
      if (user.role === 'tenantAdmin' && user.tenantId) {
        const adminCount = await User.countDocuments({
          tenantId: user.tenantId,
          role: 'tenantAdmin',
          isActive: true
        });
        
        if (adminCount <= 1) {
          return res.status(400).json({ 
            message: 'No se puede desactivar al único administrador del tenant' 
          });
        }
      }
      
      // Desactivar usuario (no eliminarlo)
      user.isActive = false;
      await user.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'user',
        entityId: user._id,
        description: `Desactivación de usuario: ${user.username}`,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: user.tenantId,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: 'Usuario desactivado correctamente',
        userId: user._id
      });
    } catch (error) {
      console.error('Error al desactivar usuario:', error);
      res.status(500).json({ message: 'Error al desactivar usuario', error: error.message });
    }
  },
  
  /**
   * Cambiar contraseña de usuario
   * @route PUT /api/users/:id/password
   */
  changePassword: async (req, res) => {
    try {
      // Verificar permisos (solo admin o el propio usuario)
      const isAdmin = ['tenantAdmin', 'superAdmin'].includes(req.user.role);
      const isSameUser = req.user.id === req.params.id;
      
      if (!isAdmin && !isSameUser) {
        return res.status(403).json({ message: 'No tienes permiso para cambiar esta contraseña' });
      }
      
      // Validar datos
      const { currentPassword, newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
      }
      
      // Buscar usuario
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      // Verificar que pertenece al mismo tenant (si no es superAdmin)
      if (req.user.role !== 'superAdmin' && 
          req.tenant && 
          user.tenantId && 
          user.tenantId.toString() !== req.tenant._id.toString()) {
        return res.status(403).json({ message: 'No tienes permiso para cambiar esta contraseña' });
      }
      
      // Si es el propio usuario, verificar contraseña actual
      if (isSameUser && !isAdmin) {
        if (!currentPassword) {
          return res.status(400).json({ message: 'Debe proporcionar la contraseña actual' });
        }
        
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
          return res.status(400).json({ message: 'Contraseña actual incorrecta' });
        }
      }
      
      // Actualizar contraseña
      user.password = newPassword;
      await user.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'user',
        entityId: user._id,
        description: `Cambio de contraseña para usuario: ${user.username}`,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: user.tenantId,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: 'Contraseña actualizada correctamente'
      });
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      res.status(500).json({ message: 'Error al cambiar contraseña', error: error.message });
    }
  },
  
  /**
   * Activar/desactivar usuario
   * @route PUT /api/users/:id/status
   */
  updateUserStatus: async (req, res) => {
    try {
      // Solo admins pueden cambiar el estado de usuarios
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'No tienes permiso para cambiar el estado de usuarios' });
      }
      
      // Validar datos
      const { isActive } = req.body;
      
      if (isActive === undefined) {
        return res.status(400).json({ message: 'Debe especificar el estado (isActive)' });
      }
      
      // Buscar usuario
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      // Verificar que pertenece al mismo tenant (si no es superAdmin)
      if (req.user.role !== 'superAdmin' && 
          req.tenant && 
          user.tenantId && 
          user.tenantId.toString() !== req.tenant._id.toString()) {
        return res.status(403).json({ message: 'No tienes permiso para cambiar el estado de este usuario' });
      }
      
      // No permitir desactivar al único tenantAdmin
      if (!isActive && user.role === 'tenantAdmin' && user.tenantId) {
        const adminCount = await User.countDocuments({
          tenantId: user.tenantId,
          role: 'tenantAdmin',
          isActive: true
        });
        
        if (adminCount <= 1) {
          return res.status(400).json({ 
            message: 'No se puede desactivar al único administrador del tenant' 
          });
        }
      }
      
      // Actualizar estado
      user.isActive = isActive;
      await user.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'user',
        entityId: user._id,
        description: `Cambio de estado de usuario: ${user.username} a ${isActive ? 'activo' : 'inactivo'}`,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        tenantId: user.tenantId,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: `Usuario ${isActive ? 'activado' : 'desactivado'} correctamente`,
        user: {
          _id: user._id,
          username: user.username,
          isActive: user.isActive
        }
      });
    } catch (error) {
      console.error('Error al cambiar estado de usuario:', error);
      res.status(500).json({ message: 'Error al cambiar estado de usuario', error: error.message });
    }
  },

  /**
   * Cambiar rol de un usuario dentro del tenant
   * @route PUT /api/users/:id/change-role
   */
  changeUserRole: async (req, res) => {
    try {
      // Solo los administradores pueden cambiar roles
      if (req.user.role !== 'tenantAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ 
          message: 'No tienes permiso para cambiar el rol de usuarios' 
        });
      }
      
      const { role } = req.body;
      
      // Validar que se proporcionó un rol válido
      if (!role) {
        return res.status(400).json({ message: 'Debe especificar el rol' });
      }
      
      // Verificar que el rol sea válido
      const validTenantRoles = ['tenantAdmin', 'tenantManager', 'tenantUser'];
      if (!validTenantRoles.includes(role) && req.user.role !== 'superAdmin') {
        return res.status(400).json({ 
          message: 'Rol inválido. Los roles válidos son: tenantAdmin, tenantManager, tenantUser' 
        });
      }
      
      // Solo superAdmin puede asignar rol de superAdmin
      if (role === 'superAdmin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({ 
          message: 'Solo un superAdmin puede asignar el rol de superAdmin' 
        });
      }
      
      // Buscar usuario
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      // Verificar que pertenece al mismo tenant (si no es superAdmin)
      if (req.user.role !== 'superAdmin' && 
          req.tenant && 
          user.tenantId && 
          user.tenantId.toString() !== req.tenant._id.toString()) {
        return res.status(403).json({ 
          message: 'No tienes permiso para cambiar el rol de este usuario' 
        });
      }
      
      // No permitir cambiar el rol del único tenantAdmin
      if (user.role === 'tenantAdmin' && role !== 'tenantAdmin' && user.tenantId) {
        const adminCount = await User.countDocuments({
          tenantId: user.tenantId,
          role: 'tenantAdmin',
          isActive: true
        });
        
        if (adminCount <= 1) {
          return res.status(400).json({ 
            message: 'No se puede cambiar el rol del único administrador del tenant' 
          });
        }
      }
      
      // Guardar rol anterior para auditoría
      const previousRole = user.role;
      
      // Actualizar rol
      user.role = role;
      await user.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'update',
        entityType: 'user',
        entityId: user._id,
        description: `Cambio de rol de usuario: ${user.username} de ${previousRole} a ${role}`,
        details: {
          previousRole,
          newRole: role
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
          _id: user._id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Error al cambiar rol de usuario:', error);
      res.status(500).json({ message: 'Error al cambiar rol de usuario', error: error.message });
    }
  },

  /**
   * Obtener información sobre roles y permisos disponibles
   * @route GET /api/users/roles
   */
  getRolesInfo: async (req, res) => {
    try {
      // Información sobre roles y sus permisos
      const rolesInfo = {
        roles: {
          superAdmin: {
            description: 'Administrador de la plataforma con acceso completo a todos los tenants',
            canBeAssignedBy: ['superAdmin']
          },
          tenantAdmin: {
            description: 'Administrador de un tenant específico con control total sobre ese tenant',
            canBeAssignedBy: ['superAdmin', 'tenantAdmin']
          },
          tenantManager: {
            description: 'Gerente con acceso a gestión de productos, inventario, ventas y compras',
            canBeAssignedBy: ['superAdmin', 'tenantAdmin']
          },
          tenantUser: {
            description: 'Usuario básico con acceso limitado a operaciones específicas',
            canBeAssignedBy: ['superAdmin', 'tenantAdmin']
          }
        },
        permissions: rolePermissions,
        // Mapeo de permisos a descripciones legibles
        permissionDescriptions: {
          'manage_users': 'Gestionar usuarios (crear, actualizar, desactivar)',
          'view_users': 'Ver lista de usuarios',
          'manage_roles': 'Asignar y cambiar roles a usuarios',
          'manage_products': 'Gestión completa de productos',
          'view_products': 'Ver productos',
          'manage_inventory': 'Gestionar inventario',
          'manage_sales': 'Crear y gestionar ventas',
          'view_sales': 'Ver ventas',
          'view_own_sales': 'Ver solo las ventas propias',
          'manage_purchases': 'Crear y gestionar compras',
          'view_purchases': 'Ver compras',
          'manage_reports': 'Acceso completo a todos los reportes',
          'view_reports': 'Ver reportes básicos',
          'view_basic_reports': 'Ver solo reportes sencillos',
          'manage_settings': 'Configurar ajustes del tenant',
          'view_settings': 'Ver configuración sin poder modificarla',
          'view_audit': 'Ver logs de auditoría',
          'export_data': 'Exportar datos a CSV/Excel'
        }
      };
      
      // Si el usuario no es superAdmin, filtrar información relevante solo para su tenant
      if (req.user.role !== 'superAdmin') {
        delete rolesInfo.roles.superAdmin;
      }
      
      res.status(200).json(rolesInfo);
    } catch (error) {
      console.error('Error al obtener información de roles:', error);
      res.status(500).json({ message: 'Error al obtener información de roles', error: error.message });
    }
  }
};

module.exports = userController;