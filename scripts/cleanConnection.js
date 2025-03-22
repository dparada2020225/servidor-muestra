// scripts/cleanConnection.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const cleanConnection = async () => {
  try {
    console.log('Intentando conectar a MongoDB Atlas...');
    
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 1 // Usar solo una conexión
    });
    
    console.log('Conexión establecida. Limpiando recursos...');

    // Ver cuántas conexiones hay actualmente (solo para información)
    const db = mongoose.connection.db;
    const adminDb = db.admin();
    
    try {
      const serverStatus = await adminDb.serverStatus();
      console.log(`Conexiones actuales: ${serverStatus.connections?.current || 'No disponible'}`);
      console.log(`Conexiones disponibles: ${serverStatus.connections?.available || 'No disponible'}`);
    } catch (error) {
      console.log('No se pudo obtener el estado del servidor:', error.message);
    }
    
    // Forzar garbage collection si está disponible
    if (global.gc) {
      console.log('Ejecutando garbage collection...');
      global.gc();
    }
    
    // Cerrar nuestra conexión correctamente
    console.log('Cerrando conexión...');
    await mongoose.connection.close();
    console.log('Conexión cerrada correctamente');
    
  } catch (error) {
    console.error('Error durante el proceso:', error);
  } finally {
    // Esperar un momento antes de finalizar
    setTimeout(() => {
      console.log('Proceso completado');
      process.exit(0);
    }, 1000);
  }
};

// Ejecutar la función principal
cleanConnection();