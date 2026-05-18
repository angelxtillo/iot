const clientPromise = require('../../lib/db');
const { calculateScores } = require('../../lib/score');
const { calcularIndice } = require('../../lib/calcular-indice');

function toSlug(name) {
  return (name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

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

      const data = cities.map(city => {
        const { compositeScore, dimScores } = calculateScores(city);
        const indice = city.indice_compuesto_final ?? parseFloat(compositeScore.toFixed(4));
        return {
          _id:                    city._id,
          name:                   city.name,
          slug:                   city.slug || toSlug(city.name),
          country:                city.country,
          flag:                   city.flag,
          population:             city.population,
          region:                 city.region,
          indice_compuesto_final: indice,
          compositeScore:         indice,
          dimScores,
          dimensiones:            city.dimensiones || null,
          updatedAt:              city.updatedAt
        };
      });

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
