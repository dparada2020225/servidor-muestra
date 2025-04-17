// controllers/adminTenantActionController.js
const Tenant = require('../models/Tenant');
const auditService = require('../services/auditService');

/**
 * Controlador para gestión de acciones sobre tenants (suspensión, reactivación, etc.)
 */
const adminTenantActionController = {
  /**
   * Suspender un tenant
   * @route POST /api/admin/tenants/:id/suspend
   */
  suspendTenant: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      const { id } = req.params;
      const { reason } = req.body;

      // Buscar el tenant
      const tenant = await Tenant.findById(id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }

      // Verificar si ya está suspendido
      if (tenant.status === 'suspended') {
        return res.status(400).json({ message: 'El tenant ya se encuentra suspendido' });
      }

      // Guardar estado anterior para auditoría
      const previousStatus = tenant.status;
      
      // Actualizar estado a suspendido
      tenant.status = 'suspended';
      
      // Si se proporcionó una razón, guardarla en el tenant
      if (reason) {
        if (!tenant.adminNotes) {
          tenant.adminNotes = {};
        }
        tenant.adminNotes.suspensionReason = reason;
        tenant.adminNotes.suspendedAt = new Date();
        tenant.adminNotes.suspendedBy = req.user.id;
      }
      
      await tenant.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'suspend',
        entityType: 'tenant',
        entityId: tenant._id,
        description: `Suspensión del tenant: ${tenant.name} (${tenant.subdomain})`,
        details: {
          previousStatus,
          reason,
          suspendedAt: new Date()
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: 'Tenant suspendido correctamente',
        tenant: {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          status: tenant.status,
          suspendedAt: tenant.adminNotes?.suspendedAt
        }
      });
    } catch (error) {
      console.error('Error al suspender tenant:', error);
      res.status(500).json({ message: 'Error al suspender tenant', error: error.message });
    }
  },
  
  /**
   * Reactivar un tenant suspendido
   * @route POST /api/admin/tenants/:id/reactivate
   */
  reactivateTenant: async (req, res) => {
    try {
      // Verificar permisos
      if (req.user.role !== 'superAdmin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo disponible para SuperAdmin' });
      }

      const { id } = req.params;
      const { notes } = req.body;

      // Buscar el tenant
      const tenant = await Tenant.findById(id);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant no encontrado' });
      }

      // Verificar si está suspendido
      if (tenant.status !== 'suspended') {
        return res.status(400).json({ message: `El tenant no está suspendido. Estado actual: ${tenant.status}` });
      }

      // Guardar estado anterior para auditoría
      const previousStatus = tenant.status;
      
      // Actualizar estado a activo (o trial si estaba en período de prueba)
      // Si tenía otro estado antes de ser suspendido, podríamos recuperarlo de los adminNotes
      const wasInTrial = tenant.adminNotes?.previousStatusBeforeSuspension === 'trial';
      tenant.status = wasInTrial ? 'trial' : 'active';
      
      // Actualizar notas administrativas
      if (!tenant.adminNotes) {
        tenant.adminNotes = {};
      }
      
      tenant.adminNotes.reactivatedAt = new Date();
      tenant.adminNotes.reactivatedBy = req.user.id;
      tenant.adminNotes.reactivationNotes = notes;
      
      // Eliminar la razón de suspensión ya que fue reactivado
      delete tenant.adminNotes.suspensionReason;
      
      await tenant.save();
      
      // Registrar en auditoría
      await auditService.logAction({
        action: 'activate',
        entityType: 'tenant',
        entityId: tenant._id,
        description: `Reactivación del tenant: ${tenant.name} (${tenant.subdomain})`,
        details: {
          previousStatus,
          newStatus: tenant.status,
          reactivatedAt: new Date(),
          notes
        },
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        message: 'Tenant reactivado correctamente',
        tenant: {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          status: tenant.status,
          reactivatedAt: tenant.adminNotes?.reactivatedAt
        }
      });
    } catch (error) {
      console.error('Error al reactivar tenant:', error);
      res.status(500).json({ message: 'Error al reactivar tenant', error: error.message });
    }
  }
};

module.exports = adminTenantActionController;