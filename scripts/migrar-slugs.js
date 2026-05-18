require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI no definida en .env'); process.exit(1); }

function toSlug(name) {
  return (name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Conectado a MongoDB Atlas\n');

    const col = client.db('smart-city').collection('cities');
    const cities = await col.find({}).toArray();

    console.log(`Migrando slugs para ${cities.length} ciudades...\n`);
    console.log('Nombre'.padEnd(35) + 'Slug resultante');
    console.log('-'.repeat(60));

    for (const city of cities) {
      const slug = toSlug(city.name);
      await col.updateOne(
        { _id: city._id },
        { $set: { slug, updatedAt: new Date() } }
      );
      console.log(city.name.padEnd(35) + slug);
    }

    console.log('\n✅ Migración de slugs completada.');
    console.log('\nVerifica con: GET /api/cities');
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
