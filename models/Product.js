// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    required: true,
    trim: true
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  salePrice: {
    type: Number,
    required: true,
    min: 0
  },
  lastPurchasePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  image: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'uploads.files',
    default: null
  }
}, {
  timestamps: true
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;