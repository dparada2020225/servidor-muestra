// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const path = require('path');
const { connectDB } = require('./db');
const Tenant = require('./models/Tenant');
const imageController = require('./controllers/imageController');
// Importar middlewares
const tenantMiddleware = require('./middleware/tenantMiddleware');

// Importar rutas
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes'); 
const purchaseRoutes = require('./routes/purchaseRoutes');
const saleRoutes = require('./routes/saleRoutes');

// Rutas de administración de plataforma (sistema multi-tenant)
const adminRoutes = require('./routes/adminRoutes'); // Deberás crear este archivo

// Configuración
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Permitir todas las conexiones
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID']
}));
app.use(express.json());

app.options('*', cors());

// Middleware para identificar tenant basado en subdominio
// Se aplica a todas las rutas excepto las de superadmin
app.use((req, res, next) => {
  // Si la ruta comienza con /api/admin, omitir el middleware de tenant
  if (req.path.startsWith('/api/admin') || req.path === '/' || req.path === '/api/test') {
    return next();
  }
  
  tenantMiddleware(req, res, next);
});

// Ruta de prueba simple
app.get('/', (req, res) => {
  res.send('API del Sistema Multi-Tenant de Inventario funcionando correctamente');
});

// Ruta de prueba para verificar la conexión a la base de datos
app.get('/api/test', async (req, res) => {
  try {
    // Verificar la conexión listando las colecciones
    if (mongoose.connection.readyState === 1) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      res.json({ 
        status: 'success',
        message: 'Conexión a MongoDB Atlas establecida correctamente',
        collections: collections.map(col => col.name)
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'No hay conexión activa a MongoDB',
        readyState: mongoose.connection.readyState
      });
    }
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: 'Error al listar colecciones',
      error: error.message
    });
  }
});

// Inicializar aplicación
const init = async () => {
  try {
    console.log('Intentando conectar a MongoDB Atlas...');
    
    // Conectar a MongoDB usando la función centralizada
    await connectDB();
    console.log('Conectado a MongoDB Atlas');
    
    // Inicializar GridFS
    let gfs;
    const conn = mongoose.connection;
    
    // Asegurarse de que la conexión esté completamente abierta
    if (conn.readyState === 1) {
      setupGridFS(conn);
    } else {
      conn.once('open', () => {
        setupGridFS(conn);
      });
    }
    
    function setupGridFS(connection) {
      gfs = Grid(connection.db, mongoose.mongo);
      gfs.collection('uploads');
      console.log('GridFS inicializado correctamente');
      
      // Configurar las rutas de subida de archivos DESPUÉS de que GridFS esté listo
      setupFileUploadRoutes(connection, gfs);
      
      // Configurar las rutas del API después de que todo esté inicializado
      
      // Rutas de administración de la plataforma (no requieren tenant)
      app.use('/api/admin', adminRoutes);
      
      // Rutas específicas de tenant (se aplica middleware de tenant)
      app.use('/api/auth', authRoutes); 
      app.use('/api/products', productRoutes);
      app.use('/api/purchases', purchaseRoutes);
      app.use('/api/sales', saleRoutes);
      app.use(tenantMiddleware);
      
      // Ruta para listar todos los archivos en GridFS (para diagnóstico)
      app.get('/gridfs-files', async (req, res) => {
        try {
          const collections = await connection.db.listCollections().toArray();
          console.log('Colecciones en la base de datos:', collections.map(c => c.name));
          
          if (!collections.some(c => c.name === 'uploads.files')) {
            return res.json({ 
              error: 'La colección uploads.files no existe',
              collections: collections.map(c => c.name)
            });
          }
          
          const files = await connection.db.collection('uploads.files').find().toArray();
          
          res.json({
            fileCount: files.length,
            files: files.map(file => ({
              id: file._id.toString(),
              filename: file.filename,
              contentType: file.contentType || file.metadata?.mimetype,
              size: file.length,
              uploadDate: file.uploadDate
            }))
          });
        } catch (error) {
          console.error('Error al listar archivos GridFS:', error);
          res.status(500).json({ error: 'Error al listar archivos', message: error.toString() });
        }
      });
      
      // Iniciar el servidor solo cuando todo esté configurado
      app.listen(PORT, () => {
        console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
      });
    }
  } catch (err) {
    console.error('Error conectando a MongoDB Atlas:', err);
  }
};

// Función para configurar las rutas de subida de archivos
function setupFileUploadRoutes(connection, gfs) {
  // Configuración del almacenamiento GridFS
  const storage = new GridFsStorage({
    db: connection,
    file: (req, file) => {
      // Incluir el tenantId en los metadatos del archivo
      let tenantId = null;
      
      if (req.tenant) {
        tenantId = req.tenant._id.toString();
      } else if (req.headers['x-tenant-id']) {
        // Si viene en el header pero no se procesó por el middleware
        tenantId = req.headers['x-tenant-id'];
      }
      
      if (!tenantId) {
        throw new Error('No se pudo identificar el tenant para la subida de archivo');
      }
      
      const metadata = {
        mimetype: file.mimetype,
        tenantId: tenantId,
        originalName: file.originalname
      };

      return {
        filename: `${Date.now()}-${file.originalname}`,
        bucketName: 'uploads',
        metadata
      };
    }
  });

  const upload = multer({ 
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB límite
    },
    fileFilter: (req, file, cb) => {
      const filetypes = /jpeg|jpg|png|gif/;
      const mimetype = filetypes.test(file.mimetype);
      const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
      
      if (mimetype && extname) {
        return cb(null, true);
      }
      cb(new Error("Solo se permiten imágenes (jpg, jpeg, png, gif)"));
    }
  });

  // Ruta para subir imágenes
  app.post('/upload', upload.single('image'), async (req, res) => {
    try {
      // Verificar que hay un tenant en la solicitud
      if (!req.tenant) {
        console.error('Intento de subida sin tenant identificado');
        return res.status(400).json({ message: 'No se pudo identificar el tenant para la subida' });
      }
      
      console.log('Archivo recibido en upload:', req.file);
      console.log('Tenant para la subida:', req.tenant.subdomain);
      
      if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo' });
      }
      
      // Obtener el ID del archivo subido
      const fileId = req.file.id;
      
      // Verificar que se guardó correctamente y tiene el tenantId
      const file = await connection.db.collection('uploads.files').findOne({ _id: fileId });
      
      if (!file) {
        return res.status(500).json({ message: 'Error al guardar el archivo' });
      }
      
      // Asegurarse de que el tenantId está en los metadatos
      if (!file.metadata?.tenantId) {
        // Actualizar el archivo para añadir el tenantId si no se guardó correctamente
        await connection.db.collection('uploads.files').updateOne(
          { _id: fileId },
          { $set: { 'metadata.tenantId': req.tenant._id.toString() } }
        );
      }
      
      console.log('Archivo guardado con ID:', fileId, 'para tenant:', req.tenant.subdomain);
      
      res.status(201).json({ 
        imageId: fileId.toString(),
        filename: file.filename,
        contentType: file.contentType || file.metadata?.mimetype
      });
    } catch (error) {
      console.error('Error en la subida de archivo:', error);
      res.status(500).json({ message: 'Error interno al subir archivo', error: error.toString() });
    }
  });
  app.get('/images/:id', imageController.getImage);

  // Ruta para obtener imágenes
  app.get('/images/:id', async (req, res) => {
    try {
      const id = req.params.id;
      console.log('Solicitando imagen ID:', id);
      
      // Permitir acceso directo a imágenes en entorno de desarrollo
      const isDevEnvironment = process.env.NODE_ENV === 'development';
      
      // En desarrollo, podemos omitir la verificación de tenant
      if (!isDevEnvironment) {
        // Verificar tenant solo en producción
        if (!req.tenant) {
          // En producción, intentar obtener tenant del query param
          if (req.query.tenantId) {
            const tenant = await Tenant.findOne({ subdomain: req.query.tenantId });
            if (tenant) {
              req.tenant = tenant;
            } else {
              return res.status(400).json({ error: 'Tenant no especificado' });
            }
          } else {
            return res.status(400).json({ error: 'Tenant no especificado' });
          }
        }
      } else {
        console.log('Entorno de desarrollo: omitiendo verificación de tenant para imagen');
      }
      
      let objectId;
      try {
        objectId = new mongoose.Types.ObjectId(id);
      } catch (err) {
        console.error('ID de imagen inválido:', err);
        return res.status(400).send('ID de imagen inválido');
      }
      
      // Buscar el archivo directamente en la colección
      const file = await connection.db.collection('uploads.files').findOne({ _id: objectId });
      
      if (!file) {
        console.error('Archivo no encontrado para ID:', id);
        return res.status(404).send('Imagen no encontrada');
      }
      
      // Verificar tenantId solo en producción
      if (!isDevEnvironment && req.tenant) {
        const fileTenantId = file.metadata?.tenantId;
        const requestTenantId = req.tenant._id.toString();
        
        if (fileTenantId && fileTenantId !== requestTenantId) {
          console.error('Intento de acceso no autorizado a archivo de otro tenant');
          return res.status(403).send('No autorizado para acceder a esta imagen');
        }
      }
      
      // Establecer el tipo de contenido
      res.set('Content-Type', file.contentType || file.metadata?.mimetype || 'image/png');
      
      // Obtener los chunks manualmente
      const chunks = await connection.db.collection('uploads.chunks')
        .find({ files_id: objectId })
        .sort({ n: 1 })
        .toArray();
      
      if (!chunks || chunks.length === 0) {
        console.error('No se encontraron chunks para el archivo');
        return res.status(404).send('No se encontraron datos para la imagen');
      }
      
      // Concatenar los chunks en un solo buffer
      let fileData;
      try {
        fileData = chunks.reduce((acc, chunk) => {
          return Buffer.concat([acc, chunk.data.buffer]);
        }, Buffer.alloc(0));
      } catch (err) {
        console.error('Error al procesar chunks:', err);
        return res.status(500).send('Error al procesar datos de imagen');
      }
      
      // Enviar el buffer como respuesta
      res.send(fileData);
      
    } catch (error) {
      console.error('Error al obtener imagen:', error);
      res.status(500).send('Error del servidor al recuperar la imagen');
    }
  });
}

if (process.env.NODE_ENV === 'development') {
  app.get('/api/debug/gridfs', async (req, res) => {
    try {
      // Comprobar si las colecciones existen
      const collections = await connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      // Buscar colecciones de GridFS
      const hasFiles = collectionNames.includes('uploads.files');
      const hasChunks = collectionNames.includes('uploads.chunks');
      
      let files = [];
      let filesCount = 0;
      let chunksCount = 0;
      
      if (hasFiles) {
        files = await connection.db.collection('uploads.files').find().toArray();
        filesCount = files.length;
      }
      
      if (hasChunks) {
        chunksCount = await connection.db.collection('uploads.chunks').countDocuments();
      }
      
      res.json({
        collections: collectionNames,
        hasFiles,
        hasChunks,
        filesCount,
        chunksCount,
        files: files.map(f => ({
          id: f._id.toString(),
          filename: f.filename,
          contentType: f.contentType,
          length: f.length,
          uploadDate: f.uploadDate,
          metadata: f.metadata
        }))
      });
    } catch (error) {
      console.error('Error en depuración GridFS:', error);
      res.status(500).json({ error: error.toString() });
    }
  });
}
// Iniciar la aplicación
init();

// Manejar el cierre gracioso de la aplicación
process.on('SIGINT', async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('Conexión MongoDB cerrada debido a la terminación de la aplicación');
  }
  process.exit(0);
});

module.exports = app;