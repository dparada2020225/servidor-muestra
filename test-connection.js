// test-connection.js
const { connectDB } = require('./db');

console.log('Intentando conectar a MongoDB Atlas...');

connectDB()
  .then(() => {
    console.log('Conexión exitosa a MongoDB Atlas');
    console.log('Base de datos:', mongoose.connection.db.databaseName);
    
    // Cerrar la conexión después de la prueba
    mongoose.connection.close();
    console.log('Conexión cerrada');
  })
  .catch(err => {
    console.error('Error conectando a MongoDB Atlas:', err);
  });