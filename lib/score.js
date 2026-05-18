const dimWeights = {
  'Frontera':        0.20,
  'Economía':        0.16,
  'Capital Humano':  0.16,
  'Cohesión Social': 0.16,
  'Gobernanza':      0.16,
  'Medio Ambiente':  0.16
};

const DIM_KEY_TO_NAME = {
  capital_humano:  'Capital Humano',
  cohesion_social: 'Cohesión Social',
  economia:        'Economía',
  gobernanza:      'Gobernanza',
  medio_ambiente:  'Medio Ambiente',
  frontera:        'Frontera'
};

function calculateScore(tipo, val, ref) {
  if (val === 0 && tipo === 'neg') return 0;
  if (ref === 0 && tipo === 'pos') return 0;
  const raw = tipo === 'pos' ? (val / ref) * 10 : (ref / val) * 10;
  return Math.min(Math.max(raw, 0), 10);
}

function calculateDimScores(indicators) {
  const accum = {};
  indicators.forEach(item => {
    if (!accum[item.dim]) accum[item.dim] = { total: 0, count: 0 };
    accum[item.dim].total += calculateScore(item.tipo, item.val, item.ref);
    accum[item.dim].count++;
  });
  const scores = {};
  Object.keys(dimWeights).forEach(dim => {
    scores[dim] = accum[dim]
      ? parseFloat((accum[dim].total / accum[dim].count).toFixed(4))
      : 0;
  });
  return scores;
}

function calculateCompositeScore(indicators) {
  const dimScores = calculateDimScores(indicators);
  return Object.keys(dimWeights).reduce((composite, dim) => {
    return composite + dimScores[dim] * dimWeights[dim];
  }, 0);
}

// Handles both the legacy flat `indicators` array and the new `dimensiones` object.
// Returns { compositeScore, dimScores }.
function calculateScores(city) {
  if (city.dimensiones) {
    const dimScores = {};
    let compositeScore = 0;
    Object.entries(city.dimensiones).forEach(([key, dim]) => {
      const dimName = DIM_KEY_TO_NAME[key];
      if (dimName) {
        dimScores[dimName] = parseFloat((dim.puntaje_promedio || 0).toFixed(4));
        compositeScore += (dim.puntaje_promedio || 0) * ((dim.peso || 0) / 100);
      }
    });
    Object.keys(dimWeights).forEach(dim => {
      if (dimScores[dim] === undefined) dimScores[dim] = 0;
    });
    return { compositeScore, dimScores };
  }
  const dimScores = calculateDimScores(city.indicators || []);
  const compositeScore = Object.keys(dimWeights).reduce((c, dim) => {
    return c + dimScores[dim] * dimWeights[dim];
  }, 0);
  return { compositeScore, dimScores };
}

module.exports = { calculateScore, calculateDimScores, calculateCompositeScore, calculateScores, dimWeights };
