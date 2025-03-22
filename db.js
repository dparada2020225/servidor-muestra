// db.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

let connection = null;

const connectDB = async () => {
  if (connection && mongoose.connection.readyState === 1) {
    return connection;
  }
  
  try {
    // Opciones mejoradas para manejar problemas de SSL
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      ssl: true,
      sslValidate: false,
      // Ajustes para TLS
      tls: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
      // Manejo de reconexiones
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000
    };
    
    console.log('Intentando conectar a MongoDB con opciones SSL...');
    connection = await mongoose.connect(process.env.MONGODB_URI, options);
    console.log('MongoDB conectado correctamente');
    
    mongoose.connection.on('error', err => {
      console.error('Error en la conexión MongoDB:', err);
    });
    
    return connection;
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error);
    console.error('Detalles del error:', error.message);
    // No hagas process.exit, solo reporta el error
    throw error;
  }
};

const closeConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    connection = null;
    console.log('Conexión a MongoDB cerrada');
  }
};

module.exports = { connectDB, closeConnection };