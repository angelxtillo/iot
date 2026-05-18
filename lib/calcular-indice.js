// Única función de cálculo del índice compuesto — fuente canónica.
// Usada por APIs, scripts de migración y seeds.
// NUNCA duplicar esta lógica en otros archivos.

const PESOS_KEY = {
  capital_humano:  16,
  cohesion_social: 16,
  economia:        16,
  gobernanza:      16,
  medio_ambiente:  16,
  frontera:        20
};

// Para ciudades con estructura flat (indicators[].dim usa nombres display)
const PESOS_DISPLAY = {
  'Capital Humano':  16,
  'Cohesión Social': 16,
  'Economía':        16,
  'Gobernanza':      16,
  'Medio Ambiente':  16,
  'Frontera':        20
};

function calcScoreIndicador(tipo, val, ref) {
  if (tipo === 'neg' && val === 0) return 0;
  if (tipo === 'pos' && ref === 0) return 0;
  const raw = tipo === 'pos' ? (val / ref) * 10 : (ref / val) * 10;
  return Math.min(Math.max(raw, 0), 10);
}

/**
 * Calcula el índice compuesto final de una ciudad.
 *
 * Soporta tres estructuras de documento:
 * 1. dimensiones.X.indicadores[].puntaje  → promedio por dim → suma ponderada
 * 2. dimensiones.X.puntaje_promedio       → suma ponderada directa
 * 3. indicators[].tipo/val/ref (legacy)   → calculateScore → promedio por dim → suma ponderada
 *
 * @param {object} city - Documento de ciudad de MongoDB
 * @returns {number} índice entre 0 y 10, redondeado a 4 decimales
 */
function calcularIndice(city) {
  if (city.dimensiones) {
    let indice = 0;
    for (const [key, dim] of Object.entries(city.dimensiones)) {
      const peso = PESOS_KEY[key] ?? (dim.peso ?? 0);
      let promedio;
      if (dim.indicadores && dim.indicadores.length > 0) {
        const suma = dim.indicadores.reduce((s, ind) => s + (ind.puntaje ?? 0), 0);
        promedio = suma / dim.indicadores.length;
      } else {
        promedio = dim.puntaje_promedio ?? 0;
      }
      indice += promedio * peso / 100;
    }
    return parseFloat(indice.toFixed(4));
  }

  if (city.indicators && city.indicators.length > 0) {
    const accum = {};
    for (const ind of city.indicators) {
      const dim = ind.dim;
      if (!accum[dim]) accum[dim] = { total: 0, count: 0 };
      accum[dim].total += calcScoreIndicador(ind.tipo, ind.val, ind.ref);
      accum[dim].count++;
    }
    let indice = 0;
    for (const [dim, peso] of Object.entries(PESOS_DISPLAY)) {
      const promedio = accum[dim] ? accum[dim].total / accum[dim].count : 0;
      indice += promedio * peso / 100;
    }
    return parseFloat(indice.toFixed(4));
  }

  return 0;
}

module.exports = { calcularIndice, PESOS_KEY, PESOS_DISPLAY };
