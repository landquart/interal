function sorted(morphs) {
  return [...(morphs || [])].filter(item => item?.form).sort((a, b) => b.form.length - a.form.length || (b.priority || 0) - (a.priority || 0) || a.form.localeCompare(b.form));
}

function contextualMorphs(config) {
  return (config.contextualSequences || []).map(sequence => {
    const parts = Array.isArray(sequence.sequence) ? sequence.sequence : [];
    const form = sequence.form || parts.join('');
    return { form, canonical: sequence.canonical || form, type: sequence.role || 'derivational_suffix', priority: sequence.priority || 120, contextual: true };
  }).filter(item => item.form);
}

function preliminaryScore(analysis) {
  let score = analysis.fullCoverage ? 100 : 0;
  score += analysis.derivational.length * 10;
  score += analysis.derivational.reduce((sum, item) => sum + item.form.length, 0);
  score -= analysis.connectors.length * 2;
  score -= analysis.serviceMorphs.length * 2;
  if (analysis.inflectional) score += 1;
  return score;
}

function stableKey(analysis) {
  return `${analysis.derivational.map(item => item.canonical).join('+')}|${analysis.connectors.join('+')}|${analysis.serviceMorphs.join('+')}|${analysis.inflectional}`;
}

function topK(values, limit) {
  const seen = new Set();
  return values
    .sort((a, b) => preliminaryScore(b) - preliminaryScore(a) || stableKey(a).localeCompare(stableKey(b)))
    .filter(item => { const key = stableKey(item); if (seen.has(key)) return false; seen.add(key); return true; })
    .slice(0, limit);
}

export function segmentTail(tail, config, { maxAnalyses = 8 } = {}) {
  const suffixes = sorted([...(config.derivationalSuffixes || []), ...contextualMorphs(config)]);
  const endings = sorted(config.inflectionalEndings);
  const connectors = sorted(config.connectors);
  const serviceMorphs = sorted(config.serviceMorphs);
  const memo = new Map();

  function rec(pos) {
    if (memo.has(pos)) return memo.get(pos);
    if (pos === tail.length) return [{ derivational: [], connectors: [], serviceMorphs: [], inflectional: '', fullCoverage: true }];
    const out = [];
    for (const morph of suffixes) {
      if (!tail.startsWith(morph.form, pos)) continue;
      for (const rest of rec(pos + morph.form.length)) out.push({ ...rest, derivational: [morph, ...rest.derivational] });
    }
    for (const ending of endings) {
      if (tail.startsWith(ending.form, pos) && pos + ending.form.length === tail.length) out.push({ derivational: [], connectors: [], serviceMorphs: [], inflectional: ending.form, fullCoverage: true });
    }
    for (const connector of connectors) {
      if (!tail.startsWith(connector.form, pos)) continue;
      for (const morph of suffixes) {
        const next = pos + connector.form.length;
        if (!tail.startsWith(morph.form, next)) continue;
        for (const rest of rec(next + morph.form.length)) out.push({ ...rest, connectors: [connector.form, ...rest.connectors], derivational: [morph, ...rest.derivational] });
      }
    }
    for (const service of serviceMorphs) {
      if (!tail.startsWith(service.form, pos)) continue;
      for (const rest of rec(pos + service.form.length)) out.push({ ...rest, serviceMorphs: [service.form, ...rest.serviceMorphs] });
    }
    const ranked = topK(out, maxAnalyses);
    memo.set(pos, ranked);
    return ranked;
  }
  return topK(rec(0), maxAnalyses);
}

export function parsePrefixChain(beforeRoot, config) {
  const prefixes = sorted(config.prefixes);
  const memo = new Map();
  function rec(pos) {
    if (pos === beforeRoot.length) return [[]];
    if (memo.has(pos)) return memo.get(pos);
    const candidates = [];
    for (const prefix of prefixes) {
      if (!beforeRoot.startsWith(prefix.form, pos)) continue;
      for (const rest of rec(pos + prefix.form.length)) candidates.push([prefix.canonical, ...rest]);
    }
    const ranked = candidates.sort((a, b) => a.length - b.length || b.join('').length - a.join('').length || a.join('+').localeCompare(b.join('+'))).slice(0, 8);
    memo.set(pos, ranked);
    return ranked;
  }
  const candidates = rec(0);
  return candidates.length ? { chain: candidates[0], alternatives: candidates.slice(1), unparsed: '' } : { chain: [], alternatives: [], unparsed: beforeRoot };
}
