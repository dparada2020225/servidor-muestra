// Crear un nuevo archivo controllers/imageController.js

// controllers/imageController.js
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

const imageController = {
  // Obtener una imagen por ID
  getImage: async (req, res) => {
    try {
      const id = req.params.id;
      console.log('Solicitando imagen ID:', id);
      
      // Identificar el tenant
      let tenantId = null;
      
      // Intentar obtener el tenant de diferentes fuentes
      if (req.query.tenantId) {
        console.log(`Tenant en query param: ${req.query.tenantId}`);
        const tenant = await Tenant.findOne({ subdomain: req.query.tenantId });
        if (tenant) {
          tenantId = tenant._id;
        }
      } else if (req.tenant) {
        tenantId = req.tenant._id;
      }
      
      // En desarrollo, permitir continuar sin tenant
      if (!tenantId && process.env.NODE_ENV === 'development') {
        console.log('DESARROLLO: Permitiendo acceso a imagen sin tenant');
      } else if (!tenantId) {
        return res.status(400).json({ error: 'Tenant no especificado2' });
      }
      
      // Resto del código para obtener la imagen...
      // ...
    } catch (error) {
      console.error('Error al obtener imagen:', error);
      res.status(500).send('Error del servidor al recuperar la imagen');
    }
  }
};

module.exports = imageController;