const dimWeights = {
  'Frontera':       0.20,
  'Economía':       0.17,
  'Capital Humano': 0.16,
  'Cohesión Social':0.16,
  'Gobernanza':     0.16,
  'Medio Ambiente': 0.15
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

module.exports = { calculateScore, calculateDimScores, calculateCompositeScore, dimWeights };
