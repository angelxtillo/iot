const clientPromise = require('../lib/db');
const { CITIES }    = require('../lib/cities-data');

// POST /api/seed — protegido con header x-seed-secret
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Usa POST para ejecutar el seed' });
  }

  const secret = req.headers['x-seed-secret'];
  if (!secret || secret !== process.env.SEED_SECRET) {
    return res.status(401).json({ success: false, error: 'No autorizado — header x-seed-secret incorrecto' });
  }

  try {
    const client     = await clientPromise;
    const collection = client.db('smart-city').collection('cities');

    const { deletedCount } = await collection.deleteMany({});

    const now  = new Date();
    const docs = CITIES.map(city => ({ ...city, createdAt: now, updatedAt: now }));
    const result = await collection.insertMany(docs);

    const summary = CITIES.map((city, i) => ({
      flag:    city.flag,
      name:    city.name,
      country: city.country,
      _id:     result.insertedIds[i]
    }));

    return res.status(200).json({
      success: true,
      message: `${result.insertedCount} ciudades insertadas`,
      deleted: deletedCount,
      cities:  summary
    });

  } catch (err) {
    console.error('[/api/seed]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
