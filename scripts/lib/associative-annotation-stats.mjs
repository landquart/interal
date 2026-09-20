export function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return { estimate: null, lower: null, upper: null };
  const p = successes / total, z2 = z * z, denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / denominator;
  return { estimate: p, lower: center - margin, upper: center + margin };
}
