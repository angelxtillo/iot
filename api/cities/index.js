const clientPromise = require('../../lib/db');
const { calculateCompositeScore } = require('../../lib/score');

const DB   = 'smart-city';
const COL  = 'cities';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const client     = await clientPromise;
    const collection = client.db(DB).collection(COL);

    if (req.method === 'GET') {
      const cities = await collection.find({}).toArray();

      const data = cities.map(city => ({
        _id:            city._id,
        name:           city.name,
        country:        city.country,
        flag:           city.flag,
        population:     city.population,
        region:         city.region,
        compositeScore: parseFloat(calculateCompositeScore(city.indicators || []).toFixed(4)),
        updatedAt:      city.updatedAt
      }));

      return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
      const { name, country, flag, population, region, indicators } = req.body;
      if (!name || !country) {
        return res.status(400).json({ success: false, error: 'name y country son requeridos' });
      }

      const now = new Date();
      const doc = { name, country, flag: flag || '', population: population || 0,
                    region: region || '', indicators: indicators || [],
                    createdAt: now, updatedAt: now };

      const result = await collection.insertOne(doc);
      return res.status(201).json({ success: true, data: { _id: result.insertedId, ...doc } });
    }

    return res.status(405).json({ success: false, error: 'Método no permitido' });

  } catch (err) {
    console.error('[/api/cities]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
