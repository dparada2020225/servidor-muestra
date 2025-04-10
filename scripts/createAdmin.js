// scripts/createAdmin.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { connectDB } = require('../db');
const dotenv = require('dotenv');

dotenv.config();

const createAdmin = async () => {
  try {
    // Usar la función de conexión centralizada
    await connectDB();
    
    console.log('Conectado a MongoDB');
    
    // Verificar si ya existe un tenant para la demo
    let demoTenant = await Tenant.findOne({ subdomain: 'demo' });
    
    // Si no existe, crear un tenant de demo
    if (!demoTenant) {
      console.log('Creando tenant de demostración...');
      demoTenant = new Tenant({
        name: 'Empresa Demo',
        subdomain: 'demo',
        status: 'active',
        plan: 'premium',
        customization: {
          primaryColor: '#3b82f6',
          secondaryColor: '#333333',
          logoText: 'Empresa Demo',
          currencySymbol: 'Q'
        },
        contactInfo: {
          email: 'admin@demo.com',
          phone: '123-456-7890',
          address: 'Calle Demo #123'
        }
      });
      
      await demoTenant.save();
      console.log('Tenant de demostración creado con ID:', demoTenant._id);
    } else {
      console.log('Usando tenant de demostración existente con ID:', demoTenant._id);
    }
    
    // Verificar si ya existe un admin para este tenant
    const adminExists = await User.findOne({ 
      role: 'tenantAdmin', 
      tenantId: demoTenant._id 
    });
    
    if (adminExists) {
      console.log('Ya existe un usuario administrador para este tenant:');
      console.log(`username: ${adminExists.username}`);
      console.log(`role: ${adminExists.role}`);
      console.log(`tenantId: ${adminExists.tenantId}`);
      await mongoose.connection.close();
      return;
    }
    
    // Crear nuevo admin para el tenant
    const admin = new User({
      username: 'admin',
      password: 'admin123', // Esto se hasheará automáticamente
      role: 'tenantAdmin',
      tenantId: demoTenant._id,
      email: 'admin@demo.com',
      isActive: true
    });
    
    await admin.save();
    
    console.log('Usuario administrador creado con éxito:');
    console.log('username: admin');
    console.log('password: admin123');
    console.log('role: tenantAdmin');
    console.log(`tenantId: ${demoTenant._id}`);
    
  } catch (error) {
    console.error('Error al crear admin:', error);
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión cerrada');
  }
};

// Ejecutar la función
console.log('Iniciando creación de admin...');
createAdmin();