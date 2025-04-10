// scripts/createSuperAdmin.js
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectDB } = require('../db');
const dotenv = require('dotenv');

dotenv.config();

const createSuperAdmin = async () => {
  try {
    // Usar la función de conexión centralizada
    await connectDB();
    
    console.log('Conectado a MongoDB');
    
    // Verificar si ya existe un superAdmin
    const superAdminExists = await User.findOne({ role: 'superAdmin' });
    
    if (superAdminExists) {
      console.log('Ya existe un usuario superAdmin:');
      console.log(`username: ${superAdminExists.username}`);
      console.log(`role: ${superAdminExists.role}`);
      await mongoose.connection.close();
      return;
    }
    
    // Crear nuevo superAdmin
    const superAdmin = new User({
      username: 'superadmin',
      password: 'superadmin123', // Esto se hasheará automáticamente
      role: 'superAdmin',
      email: 'superadmin@saasplatform.com',
      isActive: true
    });
    
    await superAdmin.save();
    
    console.log('Usuario superadministrador creado con éxito:');
    console.log('username: superadmin');
    console.log('password: superadmin123');
    console.log('role: superAdmin');
    
  } catch (error) {
    console.error('Error al crear superAdmin:', error);
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión cerrada');
  }
};

// Ejecutar la función
console.log('Iniciando creación de superAdmin...');
createSuperAdmin();