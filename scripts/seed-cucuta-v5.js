require('dotenv').config();
// El ISP local bloquea las consultas SRV de MongoDB Atlas.
// Usamos Google DNS (8.8.8.8) para resolverlas correctamente.
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient } = require('mongodb');
const XLSX = require('xlsx');
const path = require('path');

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI no está definida en .env'); process.exit(1); }

const EXCEL_PATH = path.join(__dirname, '..', 'ModeloCiudadInteligenteCucuta_v5_3.xlsx');

const DIMENSION_SHEETS = [
  { nombre: 'Capital Humano',  key: 'capital_humano',  peso: 16 },
  { nombre: 'Cohesión Social', key: 'cohesion_social', peso: 16 },
  { nombre: 'Economía',        key: 'economia',        peso: 16 },
  { nombre: 'Gobernanza',      key: 'gobernanza',      peso: 16 },
  { nombre: 'Medio Ambiente',  key: 'medio_ambiente',  peso: 16 },
  { nombre: 'Frontera',        key: 'frontera',        peso: 20 },
];

function pf(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function parseDimensionSheet(worksheet, sheetNombre) {
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false });

  // Last non-empty row = PUNTAJE PROMEDIO row
  const nonEmpty = rows.filter(r => r && r.some(c => c !== null && c !== '' && c !== undefined));
  const promedioRow = nonEmpty[nonEmpty.length - 1];
  const puntaje_promedio = pf(promedioRow[6]);

  // Data rows: keep only rows where col 0 is a positive integer (the No. column)
  const indicadores = nonEmpty
    .filter(row => {
      const no = row[0];
      return no !== null && no !== undefined && !isNaN(Number(no)) && Number(no) > 0;
    })
    .map(row => ({
      numero:           Number(row[0]),
      nombre:           String(row[1] || '').trim(),
      descripcion:      String(row[2] || '').trim(),
      tipo:             String(row[3] || '').includes('↑') ? 'Positivo' : 'Negativo',
      valor_real:       pf(row[4]),
      referencia_optima: pf(row[5]),
      puntaje:          pf(row[6]),
      justificacion:    String(row[7] || '').trim(),
      fuente_url:       String(row[8] || '').trim(),
      año:              String(row[9] || '').trim(),
    }));

  return { indicadores, puntaje_promedio };
}

async function main() {
  console.log('Leyendo Excel:', EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);

  const dimensiones = {};

  for (const { nombre, key, peso } of DIMENSION_SHEETS) {
    let ws = wb.Sheets[nombre];
    if (!ws) {
      const found = wb.SheetNames.find(n =>
        n.toLowerCase().replace(/\s+/g,'') === nombre.toLowerCase().replace(/\s+/g,'')
      );
      if (found) ws = wb.Sheets[found];
    }
    if (!ws) throw new Error(`Hoja no encontrada: "${nombre}". Disponibles: ${wb.SheetNames.join(', ')}`);

    const { indicadores, puntaje_promedio } = parseDimensionSheet(ws, nombre);
    dimensiones[key] = { peso, puntaje_promedio, indicadores };
    console.log(`  ${nombre}: ${indicadores.length} indicadores, promedio ${puntaje_promedio}`);
  }

  // Verificar contra valores esperados
  const expected = {
    capital_humano: 5.98, cohesion_social: 5.96, economia: 5.34,
    gobernanza: 6.83, medio_ambiente: 5.02, frontera: 6.94
  };
  let allOk = true;
  for (const [key, exp] of Object.entries(expected)) {
    const got = dimensiones[key]?.puntaje_promedio;
    const ok = Math.abs(got - exp) < 0.01;
    if (!ok) { console.warn(`  AVISO: ${key} esperado ${exp}, obtenido ${got}`); allOk = false; }
  }
  if (allOk) console.log('  ✓ Todos los promedios coinciden con valores esperados.');

  // Calcular índice compuesto final
  const indice_compuesto_final = Object.values(dimensiones).reduce(
    (sum, dim) => sum + (dim.puntaje_promedio * dim.peso / 100), 0
  );
  console.log(`  Índice Compuesto Final: ${indice_compuesto_final.toFixed(4)}`);

  const doc = {
    name:                  'Cúcuta',
    ciudad:                'Cúcuta',
    pais:                  'Colombia',
    country:               'Colombia',
    bandera:               '🇨🇴',
    flag:                  '🇨🇴',
    poblacion:             800000,
    population:            800000,
    region:                'Norte de Santander',
    dimensiones,
    indice_compuesto_final: parseFloat(indice_compuesto_final.toFixed(4)),
    updatedAt:              new Date(),
  };

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('\nConectado a MongoDB Atlas');

    const col = client.db('smart-city').collection('cities');

    const result = await col.findOneAndUpdate(
      { name: 'Cúcuta' },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );

    const id = result?._id || result?.value?._id || 'insertado';
    console.log(`\n✅  Cúcuta actualizada (_id: ${id})`);
    console.log('\nResumen final:');

    const totalInds = Object.values(dimensiones).reduce((s, d) => s + d.indicadores.length, 0);
    for (const { nombre, key } of DIMENSION_SHEETS) {
      const dim = dimensiones[key];
      console.log(`  ${nombre.padEnd(18)} ${dim.indicadores.length} ind.  promedio ${dim.puntaje_promedio}`);
    }
    console.log(`  ${'Total indicadores'.padEnd(18)} ${totalInds}`);
    console.log(`  Índice Compuesto Final: ${indice_compuesto_final.toFixed(4)}`);
    console.log('\nVerifica en: GET /api/cities');

  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
