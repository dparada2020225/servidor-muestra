// scripts/cleanTestData.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { connectDB } = require('../db');

dotenv.config();

async function cleanTestData() {
  try {
    console.log('Conectando a MongoDB...');
    await connectDB();
    
    console.log('Eliminando datos de prueba...');
    
    // Eliminar usuarios con nombre 'usuario1'
    const deleteResult = await mongoose.connection.db.collection('users').deleteMany({ username: 'usuario1' });
    console.log(`Usuarios eliminados: ${deleteResult.deletedCount}`);
    
    console.log('Operación completada.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada.');
  }
}

cleanTestData();