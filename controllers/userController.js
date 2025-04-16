// controllers/userController.js
const User = require('../models/User');
const auditService = require('../services/auditService');
const bcrypt = require('bcrypt');

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
  }
};

module.exports = userController;