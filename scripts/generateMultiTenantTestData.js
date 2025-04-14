// scripts/generateMultiTenantTestData.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const { connectDB } = require('../db');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Script para generar datos de prueba para múltiples tenants
 * con el fin de verificar el aislamiento de datos entre tenants
 */
const generateMultiTenantTestData = async () => {
  try {
    // Conectar a MongoDB
    await connectDB();
    console.log('Conectado a MongoDB');
    
    // Definir los tenants de prueba con datos distintos
    const tenants = [
      {
        name: 'Electronics Store',
        subdomain: 'electronics',
        status: 'active',
        plan: 'premium',
        customization: {
          primaryColor: '#3498db',
          secondaryColor: '#2c3e50',
          currencySymbol: '$'
        },
        contactInfo: {
          email: 'admin@electronics.com',
          phone: '123-456-7890'
        }
      },
      {
        name: 'Clothing Shop',
        subdomain: 'clothing',
        status: 'active',
        plan: 'basic',
        customization: {
          primaryColor: '#e74c3c',
          secondaryColor: '#34495e',
          currencySymbol: '$'
        },
        contactInfo: {
          email: 'admin@clothing.com',
          phone: '987-654-3210'
        }
      },
      {
        name: 'Office Supplies',
        subdomain: 'office',
        status: 'active',
        plan: 'premium',
        customization: {
          primaryColor: '#2ecc71',
          secondaryColor: '#27ae60',
          currencySymbol: '$'
        },
        contactInfo: {
          email: 'admin@office.com',
          phone: '555-123-4567'
        }
      }
    ];
    
    console.log('Creando tenants de prueba...');
    
    // Crear los tenants y sus datos
    for (const tenantData of tenants) {
      // Verificar si el tenant ya existe
      let tenant = await Tenant.findOne({ subdomain: tenantData.subdomain });
      
      if (!tenant) {
        console.log(`Creando tenant: ${tenantData.name} (${tenantData.subdomain})...`);
        tenant = new Tenant(tenantData);
        await tenant.save();
        console.log(`Tenant ${tenantData.name} creado con ID: ${tenant._id}`);
      } else {
        console.log(`Tenant ${tenantData.name} ya existe con ID: ${tenant._id}`);
      }
      
      // Crear usuario admin para el tenant
      const adminUsername = `admin_${tenantData.subdomain}`;
      let adminUser = await User.findOne({ username: adminUsername, tenantId: tenant._id });
      
      if (!adminUser) {
        console.log(`Creando usuario admin para ${tenantData.name}...`);
        adminUser = new User({
          username: adminUsername,
          password: 'admin123',
          role: 'tenantAdmin',
          tenantId: tenant._id,
          email: tenantData.contactInfo.email,
          isActive: true
        });
        await adminUser.save();
        console.log(`Usuario admin creado: ${adminUser.username}`);
      } else {
        console.log(`Usuario admin ya existe: ${adminUser.username}`);
      }
      
      // Crear usuario normal para el tenant
      const userUsername = `user_${tenantData.subdomain}`;
      let normalUser = await User.findOne({ username: userUsername, tenantId: tenant._id });
      
      if (!normalUser) {
        console.log(`Creando usuario normal para ${tenantData.name}...`);
        normalUser = new User({
          username: userUsername,
          password: 'user123',
          role: 'tenantUser',
          tenantId: tenant._id,
          email: `user@${tenantData.subdomain}.com`,
          isActive: true
        });
        await normalUser.save();
        console.log(`Usuario normal creado: ${normalUser.username}`);
      } else {
        console.log(`Usuario normal ya existe: ${normalUser.username}`);
      }
      
      // Productos específicos para cada tenant
      let products = [];
      
      switch (tenantData.subdomain) {
        case 'electronics':
          products = [
            {
              name: 'Smartphone XYZ',
              category: 'Phones',
              color: 'Black',
              stock: 20,
              salePrice: 799.99,
              lastPurchasePrice: 600.00
            },
            {
              name: 'Laptop ProBook',
              category: 'Computers',
              color: 'Silver',
              stock: 15,
              salePrice: 1299.99,
              lastPurchasePrice: 1000.00
            },
            {
              name: 'Wireless Headphones',
              category: 'Audio',
              color: 'White',
              stock: 30,
              salePrice: 149.99,
              lastPurchasePrice: 100.00
            },
            {
              name: 'Smart TV 55"',
              category: 'TVs',
              color: 'Black',
              stock: 8,
              salePrice: 899.99,
              lastPurchasePrice: 700.00
            },
            {
              name: 'Gaming Console',
              category: 'Gaming',
              color: 'Black',
              stock: 12,
              salePrice: 499.99,
              lastPurchasePrice: 400.00
            }
          ];
          break;
          
        case 'clothing':
          products = [
            {
              name: 'Denim Jeans',
              category: 'Pants',
              color: 'Blue',
              stock: 50,
              salePrice: 59.99,
              lastPurchasePrice: 30.00
            },
            {
              name: 'Cotton T-Shirt',
              category: 'Shirts',
              color: 'White',
              stock: 100,
              salePrice: 24.99,
              lastPurchasePrice: 10.00
            },
            {
              name: 'Leather Jacket',
              category: 'Outerwear',
              color: 'Brown',
              stock: 20,
              salePrice: 199.99,
              lastPurchasePrice: 120.00
            },
            {
              name: 'Running Shoes',
              category: 'Footwear',
              color: 'Black',
              stock: 40,
              salePrice: 79.99,
              lastPurchasePrice: 45.00
            },
            {
              name: 'Winter Hat',
              category: 'Accessories',
              color: 'Red',
              stock: 60,
              salePrice: 19.99,
              lastPurchasePrice: 8.00
            }
          ];
          break;
          
        case 'office':
          products = [
            {
              name: 'Printer Paper',
              category: 'Paper',
              color: 'White',
              stock: 200,
              salePrice: 12.99,
              lastPurchasePrice: 8.00
            },
            {
              name: 'Ballpoint Pens (12pk)',
              category: 'Writing',
              color: 'Blue',
              stock: 150,
              salePrice: 8.99,
              lastPurchasePrice: 4.50
            },
            {
              name: 'Office Chair',
              category: 'Furniture',
              color: 'Black',
              stock: 15,
              salePrice: 129.99,
              lastPurchasePrice: 80.00
            },
            {
              name: 'Filing Cabinet',
              category: 'Storage',
              color: 'Gray',
              stock: 10,
              salePrice: 89.99,
              lastPurchasePrice: 60.00
            },
            {
              name: 'Stapler',
              category: 'Tools',
              color: 'Black',
              stock: 75,
              salePrice: 6.99,
              lastPurchasePrice: 3.50
            }
          ];
          break;
      }
      
      // Crear productos para este tenant
      console.log(`Creando productos para ${tenantData.name}...`);
      
      for (const productData of products) {
        // Verificar si el producto ya existe
        const existingProduct = await Product.findOne({ 
          name: productData.name,
          tenantId: tenant._id
        });
        
        if (!existingProduct) {
          const product = new Product({
            ...productData,
            tenantId: tenant._id
          });
          await product.save();
          console.log(`Producto creado: ${product.name}`);
        } else {
          console.log(`Producto ya existe: ${existingProduct.name}`);
        }
      }
      
      // Crear algunas compras de prueba
      console.log(`Creando compras para ${tenantData.name}...`);
      
      // Obtener productos del tenant
      const tenantProducts = await Product.find({ tenantId: tenant._id });
      
      if (tenantProducts.length > 0 && adminUser) {
        // Verificar si ya hay compras para este tenant
        const existingPurchases = await Purchase.countDocuments({ tenantId: tenant._id });
        
        if (existingPurchases < 3) {  // Limitar a 3 compras por tenant
          // Crear una compra
          const purchaseItems = tenantProducts.slice(0, 3).map(product => ({
            product: product._id,
            quantity: Math.floor(Math.random() * 10) + 1,
            price: product.lastPurchasePrice,
            total: 0  // Se calculará abajo
          }));
          
          // Calcular totales
          purchaseItems.forEach(item => {
            item.total = item.quantity * item.price;
          });
          
          const totalAmount = purchaseItems.reduce((sum, item) => sum + item.total, 0);
          
          const purchase = new Purchase({
            date: new Date(),
            supplier: `Supplier for ${tenantData.name}`,
            items: purchaseItems,
            totalAmount,
            user: adminUser._id,
            tenantId: tenant._id
          });
          
          await purchase.save();
          console.log(`Compra creada para ${tenantData.name} por valor de ${totalAmount.toFixed(2)}`);
        } else {
          console.log(`Ya existen suficientes compras para ${tenantData.name}`);
        }
      }
      
      // Crear algunas ventas de prueba
      console.log(`Creando ventas para ${tenantData.name}...`);
      
      if (tenantProducts.length > 0 && adminUser) {
        // Verificar si ya hay ventas para este tenant
        const existingSales = await Sale.countDocuments({ tenantId: tenant._id });
        
        if (existingSales < 3) {  // Limitar a 3 ventas por tenant
          // Crear una venta
          const saleItems = tenantProducts.slice(0, 2).map(product => ({
            product: product._id,
            quantity: Math.floor(Math.random() * 5) + 1,
            price: product.salePrice,
            total: 0  // Se calculará abajo
          }));
          
          // Calcular totales
          saleItems.forEach(item => {
            item.total = item.quantity * item.price;
          });
          
          const totalAmount = saleItems.reduce((sum, item) => sum + item.total, 0);
          
          const sale = new Sale({
            date: new Date(),
            customer: `Customer for ${tenantData.name}`,
            items: saleItems,
            totalAmount,
            user: adminUser._id,
            tenantId: tenant._id
          });
          
          await sale.save();
          console.log(`Venta creada para ${tenantData.name} por valor de ${totalAmount.toFixed(2)}`);
        } else {
          console.log(`Ya existen suficientes ventas para ${tenantData.name}`);
        }
      }
    }
    
    console.log('\n===== DATOS MULTI-TENANT GENERADOS CORRECTAMENTE =====');
    console.log('Se han creado los siguientes tenants con datos aislados:');
    
    for (const tenantData of tenants) {
      console.log(`\n${tenantData.name} (${tenantData.subdomain})`);
      console.log('---------------------------------------------');
      console.log('Usuarios de acceso:');
      console.log(`- Admin: admin_${tenantData.subdomain} / admin123`);
      console.log(`- Usuario: user_${tenantData.subdomain} / user123`);
      console.log('\nEn desarrollo, accede mediante:');
      console.log(`- http://${tenantData.subdomain}.localhost:3000`);
      console.log(`- http://localhost:3000?tenant=${tenantData.subdomain}`);
    }
    
    console.log('\nPuedes usar estos datos para verificar el aislamiento entre tenants.');
    console.log('Cada tenant tiene productos, ventas y compras específicas.');
    console.log('=======================================================');
    
  } catch (error) {
    console.error('Error al generar datos multi-tenant:', error);
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión cerrada');
  }
};

// Ejecutar la función
console.log('Iniciando generación de datos multi-tenant...');
generateMultiTenantTestData();