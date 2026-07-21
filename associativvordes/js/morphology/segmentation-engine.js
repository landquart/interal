function sorted(morphs) { return [...(morphs || [])].sort((a,b)=>b.form.length-a.form.length || (b.priority||0)-(a.priority||0) || a.form.localeCompare(b.form)); }
export function segmentTail(tail, config, { maxAnalyses = 8 } = {}) {
  const suffixes = sorted(config.derivationalSuffixes);
  const endings = sorted(config.inflectionalEndings);
  const connectors = sorted(config.connectors);
  const memo = new Map();
  function rec(pos, usedDeriv) {
    const key = `${pos}:${usedDeriv}`; if (memo.has(key)) return memo.get(key);
    if (pos === tail.length) return [{ derivational: [], connectors: [], inflectional: '', fullCoverage: true }];
    const out = [];
    for (const m of suffixes) if (tail.startsWith(m.form, pos)) for (const rest of rec(pos + m.form.length, true)) out.push({ ...rest, derivational: [m, ...rest.derivational] });
    for (const e of endings) if (tail.startsWith(e.form, pos) && pos + e.form.length === tail.length) out.push({ derivational: [], connectors: [], inflectional: e.form, fullCoverage: true });
    for (const c of connectors) if (tail.startsWith(c.form, pos)) {
      for (const m of suffixes) if (tail.startsWith(m.form, pos + c.form.length)) for (const rest of rec(pos + c.form.length + m.form.length, true)) out.push({ ...rest, connectors: [c.form, ...rest.connectors], derivational: [m, ...rest.derivational] });
    }
    if (!tail.slice(pos)) out.push({ derivational: [], connectors: [], inflectional: '', fullCoverage: true });
    const ranked = out.slice(0, maxAnalyses);
    memo.set(key, ranked); return ranked;
  }
  return rec(0, false).slice(0, maxAnalyses);
}
export function parsePrefixChain(beforeRoot, config) {
  let rest = beforeRoot; const chain = []; const prefixes = sorted(config.prefixes);
  while (rest) { const p = prefixes.find(m => rest.startsWith(m.form)); if (!p) return { chain, unparsed: rest }; chain.push(p.canonical); rest = rest.slice(p.form.length); }
  return { chain, unparsed: '' };
}
