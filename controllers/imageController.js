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
      } else if (req.headers['x-tenant-id']) {
        const tenant = await Tenant.findOne({ subdomain: req.headers['x-tenant-id'] });
        if (tenant) {
          tenantId = tenant._id;
        }
      }
      
      // En desarrollo, permitir continuar sin tenant
      if (!tenantId && process.env.NODE_ENV === 'development') {
        console.log('DESARROLLO: Permitiendo acceso a imagen sin tenant');
      } else if (!tenantId) {
        return res.status(400).send('Tenant no especificado');
      }
      
      // Convertir el id de string a ObjectId
      let objectId;
      try {
        objectId = new mongoose.Types.ObjectId(id);
      } catch (err) {
        console.error('ID de imagen inválido:', err);
        return res.status(400).send('ID de imagen inválido');
      }
      
      // Buscar archivo en la colección uploads.files
      const db = mongoose.connection.db;
      const file = await db.collection('uploads.files').findOne({ _id: objectId });
      
      if (!file) {
        console.error('Archivo no encontrado para ID:', id);
        return res.status(404).send('Imagen no encontrada');
      }
      
      // Verificar tenantId si no estamos en desarrollo
      if (process.env.NODE_ENV !== 'development' && tenantId) {
        const fileTenantId = file.metadata?.tenantId;
        
        // Si el archivo tiene tenantId y no coincide, denegar acceso
        if (fileTenantId && fileTenantId == tenantId.toString()) {
          console.error('Intento de acceso no autorizado a archivo de otro tenant');
          return res.status(403).send('No autorizado para acceder a esta imagen');
        }
      }
      
      // Establecer el tipo de contenido
      res.set('Content-Type', file.contentType || file.metadata?.mimetype || 'image/png');
      
      // Obtener los chunks y enviarlos como respuesta
      const chunks = await db.collection('uploads.chunks')
        .find({ files_id: objectId })
        .sort({ n: 1 })
        .toArray();
      
      if (!chunks || chunks.length === 0) {
        console.error('No se encontraron chunks para el archivo');
        return res.status(404).send('No se encontraron datos para la imagen');
      }
      
      // Concatenar los chunks en un solo buffer
      const fileData = chunks.reduce((acc, chunk) => {
        return Buffer.concat([acc, chunk.data.buffer]);
      }, Buffer.alloc(0));
      
      // Enviar el buffer como respuesta
      res.send(fileData);
      
    } catch (error) {
      console.error('Error al obtener imagen:', error);
      res.status(500).send('Error del servidor al recuperar la imagen');
    }
  }
};

module.exports = imageController;