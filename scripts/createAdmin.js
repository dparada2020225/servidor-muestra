// scripts/createAdmin.js
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectDB } = require('../db');
const dotenv = require('dotenv');

dotenv.config();

const createAdmin = async () => {
  try {
    // Usar la función de conexión centralizada
    await connectDB();
    
    console.log('Conectado a MongoDB');
    
    // Verificar si ya existe un admin
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (adminExists) {
      console.log('Ya existe un usuario administrador');
      return;
    }
    
    // Crear nuevo admin
    const admin = new User({
      username: 'admin',
      password: 'admin123', // Esto se hasheará automáticamente
      role: 'admin'
    });
    
    await admin.save();
    
    console.log('Usuario administrador creado con éxito:');
    console.log('username: admin');
    console.log('password: admin123');
    console.log('role: admin');
    
  } catch (error) {
    console.error('Error al crear admin:', error);
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión cerrada');
  }
};

createAdmin();