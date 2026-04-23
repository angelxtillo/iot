require('dotenv').config();
const { MongoClient } = require('mongodb');
const { CITIES }      = require('../lib/cities-data');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌  MONGODB_URI no está definida en .env');
  process.exit(1);
}

async function seed() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅  Conectado a MongoDB Atlas');

    const collection = client.db('smart-city').collection('cities');

    const { deletedCount } = await collection.deleteMany({});
    console.log(`🗑️   Colección limpiada (${deletedCount} documentos eliminados)`);

    const now  = new Date();
    const docs = CITIES.map(city => ({ ...city, createdAt: now, updatedAt: now }));
    const result = await collection.insertMany(docs);

    console.log(`\n🌱  Seed completado — ${result.insertedCount} ciudades insertadas:\n`);
    CITIES.forEach((city, i) => {
      console.log(`   ${city.flag}  ${city.name.padEnd(28)} ${city.country.padEnd(12)} _id: ${result.insertedIds[i]}`);
    });
    console.log('\n✅  Verifica en: GET /api/rankings');

  } catch (err) {
    console.error('❌  Error durante el seed:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
