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
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes'); // Nueva
const tenantRoutes = require('./routes/tenantRoutes'); // Nueva
const customerRoutes = require('./routes/customerRoutes'); // Nueva
const supplierRoutes = require('./routes/supplierRoutes'); // Nueva
const tenantSettingsRoutes = require('./routes/tenantSettingsRoutes'); // Nueva - si existe
const { reportsController, exportController } = require('./controllers/reportsController'); // Para crear rutas

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
      app.use('/api/users', userRoutes);
      app.use('/api/tenants', tenantRoutes);
      app.use('/api/products', productRoutes);
      app.use('/api/purchases', purchaseRoutes);
      app.use('/api/sales', saleRoutes);
      app.use('/api/dashboard', dashboardRoutes);
      app.use('/api/customers', customerRoutes);
      app.use('/api/suppliers', supplierRoutes);
      
      // Crear rutas para reportes y exportación
      // (usando controladores existentes)
      const reportsRouter = express.Router();
      reportsRouter.get('/sales', reportsController.getSalesReport);
      reportsRouter.get('/purchases', reportsController.getPurchasesReport);
      reportsRouter.get('/inventory', reportsController.getInventoryReport);
      app.use('/api/reports', reportsRouter);
      
      const exportsRouter = express.Router();
      exportsRouter.get('/products', exportController.exportProducts);
      exportsRouter.get('/sales', exportController.exportSales);
      exportsRouter.get('/purchases', exportController.exportPurchases);
      app.use('/api/exports', exportsRouter);
      
      // Ruta para configuraciones de tenant si existe
      if (typeof tenantSettingsRoutes !== 'undefined') {
        app.use('/api/tenant/settings', tenantSettingsRoutes);
      }
      
      // Aplicar middleware de tenant para todas las rutas que lo requieran
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
      
      // Intentar obtener el tenant de diferentes fuentes
      if (req.tenant) {
        tenantId = req.tenant._id.toString();
      } else if (req.headers['x-tenant-id']) {
        tenantId = req.headers['x-tenant-id'];
      } else if (req.body && req.body.tenantId) {
        tenantId = req.body.tenantId;
      }
      
      if (!tenantId) {
        console.error('No se pudo identificar el tenant para la subida:', {
          headers: req.headers,
          body: req.body,
          tenant: req.tenant
        });
        throw new Error('No se pudo identificar el tenant para la subida');
      }
      
      console.log(`Subiendo archivo para tenant: ${tenantId}`, {
        filename: file.originalname,
        mimetype: file.mimetype
      });
      
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
      if (!req.tenant && !req.headers['x-tenant-id'] && (!req.body || !req.body.tenantId)) {
        console.error('Intento de subida sin tenant identificado');
        return res.status(400).json({ message: 'No se pudo identificar el tenant para la subida' });
      }
      
      console.log('Archivo recibido en upload:', req.file);
      
      if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo' });
      }
      
      // Obtener el ID del archivo subido
      const fileId = req.file.id;
      
      // Verificar que se guardó correctamente
      const file = await connection.db.collection('uploads.files').findOne({ _id: fileId });
      
      if (!file) {
        return res.status(500).json({ message: 'Error al guardar el archivo' });
      }
      
      // Asegurarse de que el tenantId está en los metadatos
      let tenantId = file.metadata?.tenantId;
      if (!tenantId) {
        // Si no se guardó el tenantId en los metadatos, intentar actualizarlo
        tenantId = req.tenant ? req.tenant._id.toString() : 
                  req.headers['x-tenant-id'] || 
                  (req.body ? req.body.tenantId : null);
        
        if (tenantId) {
          await connection.db.collection('uploads.files').updateOne(
            { _id: fileId },
            { $set: { 'metadata.tenantId': tenantId } }
          );
        }
      }
      
      console.log('Archivo guardado con ID:', fileId, 'para tenant:', tenantId);
      
      res.status(201).json({ 
        imageId: fileId.toString(),
        filename: file.filename,
        contentType: file.contentType || file.metadata?.mimetype
      });
    } catch (error) {
      console.error('Error en la subida de archivo:', error);
      res.status(500).json({ 
        message: 'Error interno al subir archivo', 
        error: error.toString(),
        stack: error.stack
      });
    }
  });

  // Usar el controlador para la ruta de imágenes
  app.get('/images/:id', imageController.getImage);
}

app.get('/api/debug/upload-status', (req, res) => {
  // Verificar tenant desde las diferentes fuentes
  const tenantFromHeader = req.headers['x-tenant-id'];
  const tenantFromQuery = req.query.tenant;
  const tenantFromBody = req.body ? req.body.tenantId : undefined;
  const tenantFromReq = req.tenant ? req.tenant.subdomain : undefined;
  
  // Devolver información de depuración
  res.json({
    tenant: {
      fromHeader: tenantFromHeader,
      fromQuery: tenantFromQuery,
      fromBody: tenantFromBody,
      fromReq: tenantFromReq
    },
    headers: req.headers,
    cookies: req.cookies,
    session: req.session
  });
});

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