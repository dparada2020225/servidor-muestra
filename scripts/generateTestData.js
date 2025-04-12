// scripts/generateTestData.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Product = require('../models/Product');
const { connectDB } = require('../db');
const dotenv = require('dotenv');

dotenv.config();

const generateTestData = async () => {
  try {
    // Conectar a MongoDB
    await connectDB();
    console.log('Conectado a MongoDB');
    
    // 1. Crear un superAdmin (si no existe)
    let superAdmin = await User.findOne({ role: 'superAdmin' });
    
    if (!superAdmin) {
      console.log('Creando usuario superAdmin...');
      superAdmin = new User({
        username: 'superadmin',
        password: 'superadmin123',
        role: 'superAdmin',
        email: 'superadmin@tuapp.com',
        isActive: true
      });
      
      await superAdmin.save();
      console.log('SuperAdmin creado con éxito:', {
        username: superAdmin.username,
        role: superAdmin.role,
        id: superAdmin._id
      });
    } else {
      console.log('Usuario superAdmin ya existe:', {
        username: superAdmin.username,
        id: superAdmin._id
      });
    }
    
    // 2. Crear tenant de prueba (si no existe)
    let testTenant = await Tenant.findOne({ subdomain: 'demo' });
    
    if (!testTenant) {
      console.log('Creando tenant de prueba (demo)...');
      testTenant = new Tenant({
        name: 'Empresa Demo',
        subdomain: 'demo',
        status: 'active',
        plan: 'premium',
        customization: {
          primaryColor: '#3b82f6',
          secondaryColor: '#333333',
          logoText: 'DEMO',
          currencySymbol: 'Q'
        },
        contactInfo: {
          email: 'admin@demo.com',
          phone: '123-456-7890',
          address: 'Calle Demo #123'
        },
        settings: {
          enableInventoryAlerts: true,
          lowStockThreshold: 5,
          defaultDateRange: 30
        }
      });
      
      await testTenant.save();
      console.log('Tenant demo creado con éxito:', {
        name: testTenant.name,
        subdomain: testTenant.subdomain,
        id: testTenant._id
      });
    } else {
      console.log('Tenant demo ya existe:', {
        name: testTenant.name,
        id: testTenant._id
      });
    }
    
    // 3. Crear un tenant suspendido para pruebas de errores
    let suspendedTenant = await Tenant.findOne({ subdomain: 'suspended' });
    
    if (!suspendedTenant) {
      console.log('Creando tenant suspendido...');
      suspendedTenant = new Tenant({
        name: 'Empresa Suspendida',
        subdomain: 'suspended',
        status: 'suspended',
        plan: 'basic',
        customization: {
          primaryColor: '#f44336',
          secondaryColor: '#333333',
          logoText: 'SUSPENDED',
          currencySymbol: 'Q'
        },
        contactInfo: {
          email: 'admin@suspended.com',
          phone: '123-456-7890'
        }
      });
      
      await suspendedTenant.save();
      console.log('Tenant suspendido creado con éxito:', {
        name: suspendedTenant.name,
        subdomain: suspendedTenant.subdomain,
        status: suspendedTenant.status,
        id: suspendedTenant._id
      });
    } else {
      console.log('Tenant suspendido ya existe:', {
        name: suspendedTenant.name,
        id: suspendedTenant._id
      });
    }
    
    // 4. Crear usuarios para el tenant demo con diferentes roles
    const users = [
      {
        username: 'admin',
        password: 'admin123',
        role: 'tenantAdmin',
        email: 'admin@demo.com',
        tenantId: testTenant._id
      },
      {
        username: 'manager',
        password: 'manager123',
        role: 'tenantManager',
        email: 'manager@demo.com',
        tenantId: testTenant._id
      },
      {
        username: 'user',
        password: 'user123',
        role: 'tenantUser',
        email: 'user@demo.com',
        tenantId: testTenant._id
      }
    ];
    
    for (const userData of users) {
      let existingUser = await User.findOne({ 
        username: userData.username,
        tenantId: userData.tenantId 
      });
      
      if (!existingUser) {
        console.log(`Creando usuario ${userData.username} con rol ${userData.role}...`);
        const user = new User(userData);
        await user.save();
        console.log(`Usuario ${userData.username} creado con éxito:`, {
          role: user.role,
          id: user._id,
          tenantId: user.tenantId
        });
      } else {
        console.log(`Usuario ${userData.username} ya existe:`, {
          role: existingUser.role,
          id: existingUser._id
        });
      }
    }
    
    // 5. Crear usuario para tenant suspendido
    let suspendedUser = await User.findOne({ 
      username: 'suspended',
      tenantId: suspendedTenant._id 
    });
    
    if (!suspendedUser) {
      console.log('Creando usuario para tenant suspendido...');
      suspendedUser = new User({
        username: 'suspended',
        password: 'suspended123',
        role: 'tenantAdmin',
        email: 'admin@suspended.com',
        tenantId: suspendedTenant._id
      });
      
      await suspendedUser.save();
      console.log('Usuario para tenant suspendido creado con éxito:', {
        username: suspendedUser.username,
        id: suspendedUser._id,
        tenantId: suspendedUser.tenantId
      });
    } else {
      console.log('Usuario para tenant suspendido ya existe:', {
        username: suspendedUser.username,
        id: suspendedUser._id
      });
    }
    
    // 6. Crear productos para el tenant demo
    const products = [
      {
        name: 'Laptop Gamer',
        category: 'Electrónicos',
        color: 'Negro',
        stock: 10,
        salePrice: 9999.99,
        lastPurchasePrice: 8500.00,
        tenantId: testTenant._id
      },
      {
        name: 'Smartphone XYZ',
        category: 'Electrónicos',
        color: 'Azul',
        stock: 25,
        salePrice: 4999.99,
        lastPurchasePrice: 3800.00,
        tenantId: testTenant._id
      },
      {
        name: 'Auriculares Bluetooth',
        category: 'Accesorios',
        color: 'Blanco',
        stock: 15,
        salePrice: 899.99,
        lastPurchasePrice: 600.00,
        tenantId: testTenant._id
      },
      {
        name: 'Monitor LED 24"',
        category: 'Electrónicos',
        color: 'Negro',
        stock: 8,
        salePrice: 1499.99,
        lastPurchasePrice: 1100.00,
        tenantId: testTenant._id
      },
      {
        name: 'Teclado Mecánico',
        category: 'Accesorios',
        color: 'RGB',
        stock: 12,
        salePrice: 799.99,
        lastPurchasePrice: 550.00,
        tenantId: testTenant._id
      },
      {
        name: 'Mouse Gamer',
        category: 'Accesorios',
        color: 'Negro',
        stock: 20,
        salePrice: 349.99,
        lastPurchasePrice: 200.00,
        tenantId: testTenant._id
      },
      {
        name: 'Tablet Pro',
        category: 'Electrónicos',
        color: 'Gris',
        stock: 5,
        salePrice: 5999.99,
        lastPurchasePrice: 4500.00,
        tenantId: testTenant._id
      },
      {
        name: 'Webcam HD',
        category: 'Accesorios',
        color: 'Negro',
        stock: 3,
        salePrice: 499.99,
        lastPurchasePrice: 350.00,
        tenantId: testTenant._id
      },
      {
        name: 'Disco Duro SSD 1TB',
        category: 'Componentes',
        color: 'Negro',
        stock: 0,
        salePrice: 1299.99,
        lastPurchasePrice: 950.00,
        tenantId: testTenant._id
      },
      {
        name: 'Memoria RAM 16GB',
        category: 'Componentes',
        color: 'Verde',
        stock: 2,
        salePrice: 799.99,
        lastPurchasePrice: 600.00,
        tenantId: testTenant._id
      }
    ];
    
    // Verificar si ya existen productos en el tenant
    const existingProductCount = await Product.countDocuments({ tenantId: testTenant._id });
    
    if (existingProductCount === 0) {
      console.log('Creando productos para el tenant demo...');
      
      for (const productData of products) {
        const product = new Product(productData);
        await product.save();
      }
      
      console.log(`${products.length} productos creados para el tenant demo`);
    } else {
      console.log(`Ya existen ${existingProductCount} productos en el tenant demo`);
    }
    
    console.log('\n===== DATOS DE PRUEBA GENERADOS CORRECTAMENTE =====');
    console.log('Puedes iniciar sesión con los siguientes usuarios:');
    console.log('1. SuperAdmin:');
    console.log('   - Username: superadmin');
    console.log('   - Password: superadmin123');
    console.log('   - URL: https://tuapp.com');
    console.log('\n2. Tenant Admin (Demo):');
    console.log('   - Username: admin');
    console.log('   - Password: admin123');
    console.log('   - URL: https://demo.tuapp.com');
    console.log('\n3. Tenant Manager (Demo):');
    console.log('   - Username: manager');
    console.log('   - Password: manager123');
    console.log('   - URL: https://demo.tuapp.com');
    console.log('\n4. Tenant User (Demo):');
    console.log('   - Username: user');
    console.log('   - Password: user123');
    console.log('   - URL: https://demo.tuapp.com');
    console.log('\n5. Tenant Suspendido:');
    console.log('   - Username: suspended');
    console.log('   - Password: suspended123');
    console.log('   - URL: https://suspended.tuapp.com');
    console.log('\nEn entorno de desarrollo, puedes usar localhost con los siguientes parámetros:');
    console.log('- Tenant Demo: http://localhost:3000?tenant=demo');
    console.log('- Tenant Suspendido: http://localhost:3000?tenant=suspended');
    console.log('=====================================================');
  } catch (error) {
    console.error('Error al generar datos de prueba:', error);
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión cerrada');
  }
};

// Ejecutar la función
console.log('Iniciando generación de datos de prueba...');
generateTestData();