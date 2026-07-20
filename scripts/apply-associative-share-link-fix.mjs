import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Could not find ${label}`);
  if (source.indexOf(search, index + search.length) >= 0) {
    throw new Error(`Found multiple matches for ${label}`);
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

const formDraftPath = 'shared/form-draft.js';
let formDraft = fs.readFileSync(formDraftPath, 'utf8');

const shareHelpers = `
  function finiteShareNumber(value) {
    if (value == null || value === '' || typeof value === 'boolean') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function truncateShareText(value, limit) {
    const text = String(value || '');
    return text.length > limit ? \`${'${text.slice(0, limit - 1)}'}…\` : text;
  }

  function compactShareSwowSide(side) {
    const source = side && typeof side === 'object' && !Array.isArray(side) ? side : {};
    return {
      found: source.found === true,
      r1_strength: finiteShareNumber(source.r1_strength),
      r123_strength: finiteShareNumber(source.r123_strength)
    };
  }

  function compactShareSwow(swow) {
    const source = swow && typeof swow === 'object' && !Array.isArray(swow) ? swow : {};
    return {
      bonus: finiteShareNumber(source.bonus) ?? 0,
      target_to_word: compactShareSwowSide(source.target_to_word),
      word_to_target: compactShareSwowSide(source.word_to_target)
    };
  }

  function compactAssociativeShareCandidate(item) {
    if (!item || typeof item !== 'object' || item.selected !== true) return null;
    const analysis = item.analysis && typeof item.analysis === 'object' && !Array.isArray(item.analysis)
      ? item.analysis
      : null;
    const association = analysis?.association && typeof analysis.association === 'object' && !Array.isArray(analysis.association)
      ? analysis.association
      : null;

    return {
      word: String(item.word || ''),
      normalized: String(item.normalized || ''),
      search_form: String(item.search_form || ''),
      match: item.match && typeof item.match === 'object' && !Array.isArray(item.match)
        ? {
            type: String(item.match.type || ''),
            distance: finiteShareNumber(item.match.distance),
            similarity: finiteShareNumber(item.match.similarity),
            fragment: String(item.match.fragment || ''),
            index: finiteShareNumber(item.match.index)
          }
        : null,
      rank: finiteShareNumber(item.rank),
      frequency_score: finiteShareNumber(item.frequency_score),
      model: String(item.model || ''),
      model_key: String(item.model_key || item.model_family_key || ''),
      selected: true,
      association_score: finiteShareNumber(item.association_score),
      final_score: finiteShareNumber(item.final_score),
      analysisStatus: item.analysisStatus || null,
      analysis: analysis
        ? {
            final_score: finiteShareNumber(analysis.final_score),
            frequency: analysis.frequency && typeof analysis.frequency === 'object'
              ? { frequency_score: finiteShareNumber(analysis.frequency.frequency_score) }
              : null,
            swow: analysis.swow ? compactShareSwow(analysis.swow) : null,
            association: association
              ? {
                  association_score: finiteShareNumber(association.association_score),
                  directness: finiteShareNumber(association.directness),
                  field_relatedness: finiteShareNumber(association.field_relatedness),
                  domain_shift: finiteShareNumber(association.domain_shift),
                  semantic_confirmed: association.semantic_confirmed === true,
                  explanation: truncateShareText(association.explanation, 320)
                }
              : null,
            warnings: Array.isArray(analysis.warnings)
              ? analysis.warnings.slice(0, 3).map((warning) => truncateShareText(warning, 120))
              : []
          }
        : null
    };
  }

  function compactAssociativePageStateForShare(pageState) {
    if (!pageState || pageState.page !== 'associativvordes' || !pageState.state || typeof pageState.state !== 'object') {
      return pageState;
    }

    const sourceState = pageState.state;
    const languages = {};

    Object.entries(sourceState.languages || {}).forEach(([code, items]) => {
      languages[code] = (Array.isArray(items) ? items : [])
        .filter((item) => item?.selected === true)
        .slice(0, 5)
        .map(compactAssociativeShareCandidate)
        .filter(Boolean);
    });

    return {
      version: pageState.version,
      page: pageState.page,
      state: {
        root: String(sourceState.root || ''),
        meaning: String(sourceState.meaning || ''),
        elementType: sourceState.elementType === 'preposition' ? 'preposition' : 'root',
        maxModels: Math.max(1, Math.min(5, Number(sourceState.maxModels) || 5)),
        activeLang: String(sourceState.activeLang || 'en'),
        languages,
        languageStatuses: sourceState.languageStatuses && typeof sourceState.languageStatuses === 'object'
          ? JSON.parse(JSON.stringify(sourceState.languageStatuses))
          : {},
        globalStatus: String(sourceState.globalStatus || 'idle'),
        checked: Boolean(sourceState.checked),
        result: sourceState.result && typeof sourceState.result === 'object'
          ? JSON.parse(JSON.stringify(sourceState.result))
          : null
      }
    };
  }

  function collectPageShareStateExport() {
    if (typeof window.InteralPageShareStateExport === 'function') {
      try {
        const state = window.InteralPageShareStateExport();
        if (state && typeof state === 'object' && !Array.isArray(state)) return state;
      } catch (error) {
        console.warn('Could not export page-specific compact share state:', error);
      }
    }

    return compactAssociativePageStateForShare(collectPageStateExport());
  }
`;

formDraft = replaceOnce(
  formDraft,
  `  function createSharePayload() {\n`,
  `${shareHelpers}\n  function createSharePayload() {\n`,
  'share-state helper insertion point'
);

formDraft = replaceOnce(
  formDraft,
  `    const pageState = collectPageStateExport();\n\n    if (pageState) {\n      payload.pageState = pageState;\n    }\n\n    return payload;\n  }\n`,
  `    const pageState = collectPageShareStateExport();\n\n    if (pageState) {\n      payload.pageState = pageState;\n    }\n\n    return payload;\n  }\n`,
  'share payload exporter'
);

fs.writeFileSync(formDraftPath, formDraft);

const testPath = 'tests/persistence-helper.test.mjs';
let test = fs.readFileSync(testPath, 'utf8');

const regressionTest = `
{
  const { ctx, store } = makeContext('', '/associativvordes/');
  const languages = Object.fromEntries(['en', 'de', 'fr', 'es', 'it', 'ru'].map((code) => [
    code,
    Array.from({ length: 80 }, (_, index) => ({
      word: \`${'${code}'}-word-${'${index}'}\`,
      normalized: \`${'${code}'}-word-${'${index}'}\`,
      search_form: \`${'${code}'}-word-${'${index}'}\`,
      match: { type: 'exact', distance: 0, similarity: 1, fragment: 'alter', index: 0 },
      rank: index + 1,
      frequency_score: 90 - index / 10,
      category_breakdown: { subtitles: { score: 88, weight: 1 } },
      sources: Array.from({ length: 12 }, (_, sourceIndex) => ({
        id: \`web/source-${'${sourceIndex}'}.json\`,
        file: \`source-${'${sourceIndex}'}.json\`,
        category: 'web',
        ipm: sourceIndex + 0.5
      })),
      warnings: ['w'.repeat(240)],
      model: \`model-${'${index}'}\`,
      model_key: \`model-${'${index}'}\`,
      selected: index < 8,
      association_score: 70,
      final_score: 75 - index,
      analysisStatus: 'completed',
      analysis: {
        final_score: 75 - index,
        frequency: { frequency_score: 90 - index / 10 },
        swow: {
          bonus: 4,
          target_to_word: { found: true, r1_strength: 0.5, r123_strength: 0.8 },
          word_to_target: { found: false, r1_strength: null, r123_strength: null }
        },
        association: {
          association_score: 70,
          directness: 72,
          field_relatedness: 68,
          domain_shift: 15,
          semantic_confirmed: true,
          explanation: 'x'.repeat(2000)
        },
        warnings: ['warning '.repeat(80)]
      }
    }))
  ]));

  ctx.window.InteralPageStateExport = () => ({
    version: 1,
    page: 'associativvordes',
    state: {
      root: 'alter',
      meaning: 'другой',
      elementType: 'root',
      maxModels: 5,
      activeLang: 'en',
      languages,
      languageStatuses: Object.fromEntries(Object.keys(languages).map((code) => [code, { status: 'completed' }])),
      globalStatus: 'completed',
      checked: true,
      result: { finalAssociation: 61.2, accepted: true }
    }
  });

  let posted = null;
  ctx.fetch = async (_url, options) => {
    posted = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ ok: true, id: 'AbCdEf123456' }) };
  };

  const shortUrl = await ctx.window.InteralFormDraft.createShortShareUrl();
  assert.equal(shortUrl, 'https://interal.vercel.app/associativvordes/?s=AbCdEf123456');
  assert.ok(posted);
  assert.ok(Buffer.byteLength(JSON.stringify(posted.payload), 'utf8') < 50_000);

  for (const items of Object.values(posted.payload.pageState.state.languages)) {
    assert.equal(items.length, 5);
    assert.ok(items.every((item) => item.selected === true));
    assert.ok(items.every((item) => !('sources' in item)));
    assert.ok(items.every((item) => item.analysis.association.explanation.length <= 320));
  }

  ctx.window.InteralFormDraft.save();
  const locallySaved = JSON.parse(store.get('interal-page-state:v2:/associativvordes/'));
  assert.equal(locallySaved.pageState.state.languages.en.length, 80);
  assert.equal(locallySaved.pageState.state.languages.en[0].sources.length, 12);
}

`;

test = replaceOnce(
  test,
  `console.log('persistence-helper tests passed');\n`,
  `${regressionTest}console.log('persistence-helper tests passed');\n`,
  'persistence regression test insertion point'
);

fs.writeFileSync(testPath, test);
console.log('Applied associative short share-link fix.');
