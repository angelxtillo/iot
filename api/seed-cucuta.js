// POST /api/seed-cucuta — Lee el Excel del proyecto y hace upsert de Cúcuta en MongoDB.
// Llamar desde Vercel para evitar restricciones de red locales.
// No requiere secreto porque sólo modifica Cúcuta (upsert, no deleteMany).
const clientPromise = require('../lib/db');
const XLSX = require('xlsx');
const path = require('path');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Usa POST para ejecutar el seed' });
  }

  const EXCEL_PATH = path.join(process.cwd(), 'ModeloCiudadInteligenteCucuta_v5_3.xlsx');
  const SHEETS = [
    { nombre: 'Capital Humano',  key: 'capital_humano',  peso: 16 },
    { nombre: 'Cohesión Social', key: 'cohesion_social', peso: 16 },
    { nombre: 'Economía',        key: 'economia',        peso: 16 },
    { nombre: 'Gobernanza',      key: 'gobernanza',      peso: 16 },
    { nombre: 'Medio Ambiente',  key: 'medio_ambiente',  peso: 16 },
    { nombre: 'Frontera',        key: 'frontera',        peso: 20 },
  ];

  function pf(v) {
    if (v == null || v === '') return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  try {
    const wb = XLSX.readFile(EXCEL_PATH);
    const dimensiones = {};

    for (const { nombre, key, peso } of SHEETS) {
      let ws = wb.Sheets[nombre];
      if (!ws) {
        const found = wb.SheetNames.find(n =>
          n.toLowerCase().replace(/\s+/g,'') === nombre.toLowerCase().replace(/\s+/g,'')
        );
        if (found) ws = wb.Sheets[found];
      }
      if (!ws) throw new Error(`Hoja no encontrada: "${nombre}"`);

      const rows     = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
      const nonEmpty = rows.filter(r => r && r.some(c => c !== null && c !== '' && c !== undefined));
      const promRow  = nonEmpty[nonEmpty.length - 1];
      const puntaje_promedio = pf(promRow[6]);

      const indicadores = nonEmpty
        .filter(r => r[0] != null && !isNaN(Number(r[0])) && Number(r[0]) > 0)
        .map(r => ({
          numero: Number(r[0]),
          nombre: String(r[1] || '').trim(),
          descripcion: String(r[2] || '').trim(),
          tipo: String(r[3] || '').includes('↑') ? 'Positivo' : 'Negativo',
          valor_real: pf(r[4]), referencia_optima: pf(r[5]), puntaje: pf(r[6]),
          justificacion: String(r[7] || '').trim(),
          fuente_url: String(r[8] || '').trim(),
          año: String(r[9] || '').trim(),
        }));

      dimensiones[key] = { peso, puntaje_promedio, indicadores };
    }

    const indice_compuesto_final = parseFloat(
      Object.values(dimensiones)
        .reduce((s, d) => s + (d.puntaje_promedio * d.peso / 100), 0)
        .toFixed(4)
    );

    const doc = {
      name: 'Cúcuta', ciudad: 'Cúcuta', pais: 'Colombia', country: 'Colombia',
      bandera: '🇨🇴', flag: '🇨🇴', poblacion: 800000, population: 800000,
      region: 'Norte de Santander', dimensiones, indice_compuesto_final, updatedAt: new Date()
    };

    const client = await clientPromise;
    const col = client.db('smart-city').collection('cities');

    await col.findOneAndUpdate(
      { name: 'Cúcuta' },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    const summary = {};
    for (const { nombre, key } of SHEETS) {
      summary[nombre] = {
        indicadores: dimensiones[key].indicadores.length,
        promedio: dimensiones[key].puntaje_promedio
      };
    }

    return res.status(200).json({
      success: true,
      message: 'Cúcuta actualizada con 60 indicadores oficiales (v5.3)',
      indice_compuesto_final,
      dimensiones: summary
    });

  } catch (err) {
    console.error('[/api/seed-cucuta]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
