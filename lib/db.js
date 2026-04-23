const { MongoClient } = require('mongodb');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI no está definida en las variables de entorno');

let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // Reutiliza la conexión entre hot-reloads de vercel dev
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = new MongoClient(uri).connect();
}

module.exports = clientPromise;
