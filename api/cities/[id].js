const { ObjectId } = require('mongodb');
const clientPromise = require('../../lib/db');
const { calculateScores } = require('../../lib/score');
const { calcularIndice } = require('../../lib/calcular-indice');

const DB  = 'smart-city';
const COL = 'cities';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, error: 'ID de ciudad inválido' });
  }

  try {
    const client     = await clientPromise;
    const collection = client.db(DB).collection(COL);
    const _id        = new ObjectId(id);

    if (req.method === 'GET') {
      const city = await collection.findOne({ _id });
      if (!city) return res.status(404).json({ success: false, error: 'Ciudad no encontrada' });

      const { compositeScore, dimScores } = calculateScores(city);
      const indice = city.indice_compuesto_final ?? parseFloat(compositeScore.toFixed(4));
      return res.status(200).json({
        success: true,
        data: {
          ...city,
          indice_compuesto_final: indice,
          compositeScore: indice,
          dimScores
        }
      });
    }

    if (req.method === 'PUT') {
      const body = { ...req.body };
      delete body._id;
      const updatedDoc = { ...body, updatedAt: new Date() };
      updatedDoc.indice_compuesto_final = calcularIndice({ ...updatedDoc });

      const result = await collection.findOneAndUpdate(
        { _id },
        { $set: updatedDoc },
        { returnDocument: 'after' }
      );
      if (!result) return res.status(404).json({ success: false, error: 'Ciudad no encontrada' });

      const { compositeScore, dimScores } = calculateScores(result);
      const indice = result.indice_compuesto_final ?? parseFloat(compositeScore.toFixed(4));
      return res.status(200).json({
        success: true,
        data: {
          ...result,
          indice_compuesto_final: indice,
          compositeScore: indice,
          dimScores
        }
      });
    }

    if (req.method === 'DELETE') {
      const result = await collection.deleteOne({ _id });
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, error: 'Ciudad no encontrada' });
      }
      return res.status(200).json({ success: true, message: 'Ciudad eliminada correctamente' });
    }

    return res.status(405).json({ success: false, error: 'Método no permitido' });

  } catch (err) {
    console.error('[/api/cities/[id]]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
