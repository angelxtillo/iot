const clientPromise = require('../lib/db');
const { calculateScores } = require('../lib/score');

const DB  = 'smart-city';
const COL = 'cities';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const client     = await clientPromise;
    const collection = client.db(DB).collection(COL);
    const cities     = await collection.find({}).toArray();

    const ranked = cities
      .map(city => {
        const { compositeScore, dimScores } = calculateScores(city);
        return {
          _id:            city._id,
          name:           city.name,
          country:        city.country,
          flag:           city.flag,
          population:     city.population,
          region:         city.region,
          compositeScore: parseFloat(compositeScore.toFixed(4)),
          dimScores
        };
      })
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, 3);

    return res.status(200).json({ success: true, data: ranked });

  } catch (err) {
    console.error('[/api/rankings]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
