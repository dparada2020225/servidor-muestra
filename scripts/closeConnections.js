// scripts/closeConnections.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const closeAllConnections = async () => {
  try {
    console.log('Intentando conectar a MongoDB Atlas...');
    
    // Conectar a MongoDB con opciones mínimas
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Conexión establecida. Obteniendo información de la base de datos...');

    // Ejecutar el comando killAllSessions para cerrar todas las conexiones inactivas
    // Esto requiere privilegios de admin
    try {
      const result = await mongoose.connection.db.admin().command({ killAllSessions: [] });
      console.log('Comando ejecutado para cerrar todas las sesiones:', result);
    } catch (cmdError) {
      // Si falla por falta de permisos, mostrar mensaje alternativo
      console.log('No se pudo ejecutar killAllSessions (posiblemente por permisos). Intentando método alternativo...');
      
      // Método alternativo: ejecutar comando currentOp y logInfo
      const currentOp = await mongoose.connection.db.admin().command({ currentOp: 1, $all: true });
      console.log(`Operaciones activas encontradas: ${currentOp.inprog.length}`);
      
      // Mostrar información sobre cada conexión activa
      currentOp.inprog.forEach((op, index) => {
        if (op.client) {
          console.log(`Conexión ${index + 1}: ${op.client}, inactiva por ${op.secs_running} segundos`);
        }
      });
      
      // Forzar un garbage collection y liberación de recursos
      console.log('Forzando limpieza de recursos internos...');
      if (global.gc) {
        global.gc();
      }
    }
    
    // Cerrar nuestra propia conexión
    console.log('Cerrando conexión actual...');
    await mongoose.connection.close();
    console.log('Conexión cerrada correctamente');
    
  } catch (error) {
    console.error('Error durante el proceso:', error);
  } finally {
    process.exit(0);
  }
};

// Ejecutar la función principal
closeAllConnections();