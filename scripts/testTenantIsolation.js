// scripts/testTenantIsolation.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { connectDB } = require('../db');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Product = require('../models/Product');

dotenv.config();

async function testTenantIsolation() {
  try {
    console.log('Conectando a MongoDB...');
    await connectDB();
    
    // Crear dos tenants para prueba
    const tenant1 = await createTenant('Empresa A', 'empresa-a');
    const tenant2 = await createTenant('Empresa B', 'empresa-b');
    
    console.log(`Tenant 1: ${tenant1._id} - ${tenant1.name}`);
    console.log(`Tenant 2: ${tenant2._id} - ${tenant2.name}`);
    
    // Crear usuarios para cada tenant
    const user1 = await createUser('usuario1', 'password123', 'tenantAdmin', tenant1._id);
    const user2 = await createUser('usuario1', 'password123', 'tenantAdmin', tenant2._id); // Mismo nombre, diferente tenant
    
    console.log(`Usuario 1: ${user1._id} - ${user1.username} (Tenant: ${user1.tenantId})`);
    console.log(`Usuario 2: ${user2._id} - ${user2.username} (Tenant: ${user2.tenantId})`);
    
    // Crear productos para cada tenant
    const product1 = await createProduct('Producto Común', 'Categoría A', 'Rojo', 100, tenant1._id);
    const product2 = await createProduct('Producto Común', 'Categoría A', 'Rojo', 200, tenant2._id); // Mismo producto, diferente tenant
    
    console.log(`Producto 1: ${product1._id} - ${product1.name} (Tenant: ${product1.tenantId})`);
    console.log(`Producto 2: ${product2._id} - ${product2.name} (Tenant: ${product2.tenantId})`);
    
    // Verificar aislamiento de datos
    console.log('\n--- Verificando aislamiento de datos ---');
    
    // 1. Buscar usuarios con mismo nombre en diferentes tenants
    const usersWithSameName = await User.find({ username: 'usuario1' });
    console.log(`Usuarios con el mismo nombre: ${usersWithSameName.length}`);
    
    // 2. Buscar productos con mismo nombre en diferentes tenants
    const productsWithSameName = await Product.find({ name: 'Producto Común' });
    console.log(`Productos con el mismo nombre: ${productsWithSameName.length}`);
    
    // 3. Verificar aislamiento por tenant
    const tenant1Products = await Product.find({ tenantId: tenant1._id });
    const tenant2Products = await Product.find({ tenantId: tenant2._id });
    
    console.log(`Productos en Tenant 1: ${tenant1Products.length}`);
    console.log(`Productos en Tenant 2: ${tenant2Products.length}`);
    
    // Simulación de consulta con middleware de tenant
    console.log('\n--- Simulando consultas con middleware tenant ---');
    
    // Simulando contexto del tenant 1
    const contextTenant1 = { tenant: { _id: tenant1._id } };
    const productsTenant1 = await Product.find({ tenantId: contextTenant1.tenant._id });
    console.log(`Productos encontrados para Tenant 1: ${productsTenant1.length}`);
    
    // Simulando contexto del tenant 2
    const contextTenant2 = { tenant: { _id: tenant2._id } };
    const productsTenant2 = await Product.find({ tenantId: contextTenant2.tenant._id });
    console.log(`Productos encontrados para Tenant 2: ${productsTenant2.length}`);
    
    console.log('\nPrueba de aislamiento de datos completada con éxito.');
    
  } catch (error) {
    console.error('Error en las pruebas:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada.');
  }
}

// Función auxiliar para crear un tenant
async function createTenant(name, subdomain) {
  const existingTenant = await Tenant.findOne({ subdomain });
  if (existingTenant) {
    return existingTenant;
  }
  
  const tenant = new Tenant({
    name,
    subdomain,
    status: 'active',
    plan: 'basic',
    customization: {
      primaryColor: '#3b82f6',
      secondaryColor: '#333333',
      logoText: name,
      currencySymbol: 'Q'
    },
    contactInfo: {
      email: `admin@${subdomain}.com`
    }
  });
  
  await tenant.save();
  return tenant;
}

// Función auxiliar para crear un usuario
async function createUser(username, password, role, tenantId) {
  const existingUser = await User.findOne({ username, tenantId });
  if (existingUser) {
    return existingUser;
  }
  
  const user = new User({
    username,
    password,
    role,
    tenantId,
    email: `${username}@example.com`
  });
  
  await user.save();
  return user;
}

// Función auxiliar para crear un producto
async function createProduct(name, category, color, price, tenantId) {
  const product = new Product({
    name,
    category,
    color,
    salePrice: price,
    stock: 10,
    tenantId
  });
  
  await product.save();
  return product;
}

// Ejecutar pruebas
testTenantIsolation()
  .then(() => {
    console.log('Test completado');
  })
  .catch(err => {
    console.error('Error en el test:', err);
  });