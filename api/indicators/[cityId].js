const { ObjectId } = require('mongodb');
const clientPromise = require('../../lib/db');
const { calculateScore } = require('../../lib/score');

const DB  = 'smart-city';
const COL = 'cities';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { cityId } = req.query;
  if (!ObjectId.isValid(cityId)) {
    return res.status(400).json({ success: false, error: 'cityId inválido' });
  }

  try {
    const client     = await clientPromise;
    const collection = client.db(DB).collection(COL);
    const _id        = new ObjectId(cityId);

    if (req.method === 'GET') {
      const city = await collection.findOne({ _id }, { projection: { name: 1, indicators: 1 } });
      if (!city) return res.status(404).json({ success: false, error: 'Ciudad no encontrada' });

      const data = (city.indicators || []).map(ind => ({
        ...ind,
        score: parseFloat(calculateScore(ind.tipo, ind.val, ind.ref).toFixed(4))
      }));
      return res.status(200).json({ success: true, cityName: city.name, data });
    }

    if (req.method === 'PUT') {
      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ success: false, error: 'updates debe ser un array no vacío' });
      }

      const city = await collection.findOne({ _id });
      if (!city) return res.status(404).json({ success: false, error: 'Ciudad no encontrada' });

      const updateMap         = new Map(updates.map(u => [u.id, u.val]));
      const updatedIndicators = (city.indicators || []).map(ind =>
        updateMap.has(ind.id) ? { ...ind, val: updateMap.get(ind.id) } : ind
      );

      await collection.updateOne(
        { _id },
        { $set: { indicators: updatedIndicators, updatedAt: new Date() } }
      );

      const data = updatedIndicators.map(ind => ({
        ...ind,
        score: parseFloat(calculateScore(ind.tipo, ind.val, ind.ref).toFixed(4))
      }));
      return res.status(200).json({ success: true, data });
    }

    return res.status(405).json({ success: false, error: 'Método no permitido' });

  } catch (err) {
    console.error('[/api/indicators/[cityId]]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
