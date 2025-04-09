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
      // Incluir el tenantId en los metadatos del archivo si está disponible
      const metadata = {
        mimetype: file.mimetype,
        tenantId: req.tenant ? req.tenant._id.toString() : null
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
      console.log('Archivo recibido en upload:', req.file);
      
      if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo' });
      }
      
      // Verificar que el archivo se guardó correctamente
      const fileId = req.file.id;
      console.log('Archivo guardado con ID:', fileId);
      
      // Verificar que el archivo existe en GridFS
      const file = await connection.db.collection('uploads.files').findOne({ _id: fileId });
      
      if (!file) {
        console.error('El archivo subido no se encuentra en GridFS');
        return res.status(500).json({ message: 'Error al guardar el archivo' });
      }
      
      console.log('Archivo confirmado en GridFS:', file._id.toString());
      
      // Verificar que existen chunks
      const chunkCount = await connection.db.collection('uploads.chunks').countDocuments({ files_id: fileId });
      console.log('Chunks almacenados para el archivo:', chunkCount);
      
      res.status(201).json({ 
        imageId: file._id.toString(),
        filename: file.filename,
        contentType: file.contentType
      });
    } catch (error) {
      console.error('Error en la subida de archivo:', error);
      res.status(500).json({ message: 'Error interno al subir archivo', error: error.toString() });
    }
  });

  // Ruta para obtener imágenes
  app.get('/images/:id', async (req, res) => {
    try {
      const id = req.params.id;
      console.log('Solicitando imagen ID:', id);
      
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
      
      // Verificar tenantId si no es superAdmin
      if (req.tenant && req.user && req.user.role !== 'superAdmin') {
        const fileTenantId = file.metadata?.tenantId;
        const requestTenantId = req.tenant._id.toString();
        
        if (fileTenantId && fileTenantId !== requestTenantId) {
          console.error('Intento de acceso no autorizado a archivo de otro tenant');
          return res.status(403).send('No autorizado para acceder a esta imagen');
        }
      }
      
      console.log('Archivo encontrado:', file.filename);
      
      // Establecer el tipo de contenido
      res.set('Content-Type', file.contentType || 'image/png');
      
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
      const fileData = chunks.reduce((acc, chunk) => {
        // Si acc es buffer, concatenar con el buffer del chunk
        return Buffer.concat([acc, chunk.data.buffer]);
      }, Buffer.alloc(0));
      
      // Enviar el buffer como respuesta
      res.send(fileData);
      
    } catch (error) {
      console.error('Error al obtener imagen:', error);
      res.status(500).send('Error del servidor al recuperar la imagen');
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