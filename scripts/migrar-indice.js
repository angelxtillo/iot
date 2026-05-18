require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient } = require('mongodb');
const { calcularIndice } = require('../lib/calcular-indice');

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI no definida en .env'); process.exit(1); }

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Conectado a MongoDB Atlas\n');

    const col = client.db('smart-city').collection('cities');
    const cities = await col.find({}).toArray();

    console.log(`Migrando ${cities.length} ciudades...\n`);
    console.log('Ciudad'.padEnd(28) + 'Anterior'.padEnd(12) + 'Nuevo'.padEnd(12) + 'Diferencia');
    console.log('-'.repeat(62));

    for (const city of cities) {
      const anterior = city.indice_compuesto_final ?? null;
      const nuevo = calcularIndice(city);
      const diff = anterior !== null ? (nuevo - anterior).toFixed(4) : 'N/A';
      const diffDisplay = anterior !== null
        ? (Math.abs(nuevo - anterior) < 0.0001 ? '(sin cambio)' : diff)
        : 'N/A';

      await col.updateOne(
        { _id: city._id },
        { $set: { indice_compuesto_final: nuevo, updatedAt: new Date() } }
      );

      console.log(
        city.name.padEnd(28) +
        (anterior !== null ? anterior.toFixed(4) : 'N/A').padEnd(12) +
        nuevo.toFixed(4).padEnd(12) +
        diffDisplay
      );
    }

    console.log('\n✅ Migración completada.');
    console.log('\nVerifica con: GET /api/cities');
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
