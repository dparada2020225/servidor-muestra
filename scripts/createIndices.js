// scripts/createIndices.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { connectDB } = require('../db');

// Importar modelos
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');

dotenv.config();

async function createIndices() {
  try {
    console.log('Conectando a MongoDB...');
    await connectDB();
    
    console.log('Creando índices para Tenant...');
    await Tenant.createIndexes();
    
    console.log('Creando índices para User...');
    await User.createIndexes();
    
    console.log('Creando índices para Product...');
    await Product.createIndexes();
    
    console.log('Creando índices para Purchase...');
    await Purchase.createIndexes();
    
    console.log('Creando índices para Sale...');
    await Sale.createIndexes();
    
    console.log('Todos los índices creados correctamente.');
    
  } catch (error) {
    console.error('Error al crear índices:', error);
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada.');
  }
}

createIndices();