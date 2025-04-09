// scripts/fixUserIndices.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { connectDB } = require('../db');

dotenv.config();

async function fixUserIndices() {
  try {
    console.log('Conectando a MongoDB...');
    await connectDB();
    
    console.log('Eliminando índices existentes en la colección users...');
    await mongoose.connection.db.collection('users').dropIndex('username_1');
    console.log('Índice eliminado correctamente');
    
    console.log('Operación completada. Ahora puedes volver a ejecutar el test');
  } catch (error) {
    // Si el índice no existe, esto generará un error pero podemos ignorarlo
    if (error.code === 27) {
      console.log('El índice no existía, por lo que no fue necesario eliminarlo');
    } else {
      console.error('Error:', error);
    }
  } finally {
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada.');
  }
}

fixUserIndices();