import { createHash } from 'node:crypto';

export function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return { estimate: null, lower: null, upper: null };
  const p = successes / total, z2 = z * z, denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / denominator;
  return { estimate: p, lower: center - margin, upper: center + margin };
}

export function confusionMatrix(left, right, categories) {
  const matrix = Object.fromEntries(categories.map(a => [a, Object.fromEntries(categories.map(b => [b, 0]))]));
  for (let i = 0; i < left.length; i += 1) matrix[left[i]][right[i]] += 1;
  return matrix;
}

export function cohensKappa(left, right, categories) {
  if (left.length !== right.length) throw new Error('Kappa inputs have different lengths');
  if (!left.length) return null;
  const matrix = confusionMatrix(left, right, categories);
  const n = left.length;
  let observed = 0, expected = 0;
  for (const category of categories) {
    observed += matrix[category][category];
    const row = categories.reduce((sum, other) => sum + matrix[category][other], 0);
    const column = categories.reduce((sum, other) => sum + matrix[other][category], 0);
    expected += (row / n) * (column / n);
  }
  const po = observed / n;
  return expected === 1 ? (po === 1 ? 1 : null) : (po - expected) / (1 - expected);
}

export function weightedPrecision(rows) {
  let tp = 0, fp = 0, uncertain = 0, total = 0, sumWeights = 0, sumSquaredWeights = 0;
  for (const row of rows) {
    const weight = Number(row.sampling_weight);
    if (!(weight > 0)) throw new Error(`Invalid sampling_weight for ${row.sample_id}`);
    total += weight;
    sumWeights += weight;
    sumSquaredWeights += weight * weight;
    if (row.final_membership_verdict === 'true_positive') tp += weight;
    else if (row.final_membership_verdict === 'false_positive') fp += weight;
    else if (row.final_membership_verdict === 'uncertain') uncertain += weight;
  }
  return {
    weighted_tp: tp,
    weighted_fp: fp,
    weighted_uncertain: uncertain,
    precision_resolved: tp + fp ? tp / (tp + fp) : null,
    precision_conservative: total ? tp / total : null,
    precision_optimistic: total ? (tp + uncertain) / total : null,
    effective_sample_size: sumSquaredWeights ? (sumWeights * sumWeights) / sumSquaredWeights : 0
  };
}

function randomFactory(seed) {
  let state = createHash('sha256').update(seed).digest().readUInt32LE(0) || 1;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

export function stratifiedClusterBootstrap(rows, { repetitions = 2000, seed = 'associative-family-v5-bootstrap' } = {}) {
  if (!rows.length) return { method: 'stratified_family_cluster_bootstrap', repetitions, seed, lower: null, upper: null };
  const strata = new Map();
  for (const row of rows) {
    const stratum = row.sampling_stratum;
    if (!stratum || !row.family_id) throw new Error(`Missing sampling_stratum/family_id for ${row.sample_id}`);
    if (!strata.has(stratum)) strata.set(stratum, new Map());
    const clusters = strata.get(stratum);
    if (!clusters.has(row.family_id)) clusters.set(row.family_id, []);
    clusters.get(row.family_id).push(row);
  }
  const random = randomFactory(seed), estimates = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const draw = [];
    for (const clusters of strata.values()) {
      const values = [...clusters.values()];
      for (let i = 0; i < values.length; i += 1) draw.push(...values[Math.floor(random() * values.length)]);
    }
    const estimate = weightedPrecision(draw).precision_resolved;
    if (estimate !== null) estimates.push(estimate);
  }
  estimates.sort((a, b) => a - b);
  const quantile = p => estimates[Math.min(estimates.length - 1, Math.max(0, Math.floor(p * estimates.length)))];
  return {
    method: 'stratified_family_cluster_bootstrap', repetitions, seed,
    lower: estimates.length ? quantile(0.025) : null,
    upper: estimates.length ? quantile(0.975) : null
  };
}
