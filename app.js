const els = {
  baseWord: document.getElementById('baseWord'),
  logicalMeaning: document.getElementById('logicalMeaning'),
  transformRule: document.getElementById('transformRule'),
  regularWord: document.getElementById('regularWord'),
  regularMeaning: document.getElementById('regularMeaning'),
  internationalMeaning: document.getElementById('internationalMeaning'),
  modifiedWord: document.getElementById('modifiedWord'),
  useLlm: document.getElementById('useLlm'),
  ollamaUrl: document.getElementById('ollamaUrl'),
  ollamaModel: document.getElementById('ollamaModel'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  loadExampleBtn: document.getElementById('loadExampleBtn'),
  result: document.getElementById('result')
};

const bookRules = {
  source: {
    title: 'INTERAL russ (2).pdf',
    sections: ['§84']
  },
  section84: {
    title: 'Двойное значение в дериватах',
    enabled: true,
    coreRule: 'При образовании новых слов путём добавления суффиксов и приставок с фиксированным значением значение полученного слова может отличаться от значения, выведенного логическим анализом отдельных элементов, и от значения эквивалентного деривата в интернациональном понимании.',
    analysisMode: 'logical_vs_international',
    disambiguation: {
      nounMarker: 'u',
      methods: [
        'add_u_for_nouns',
        'replace_suffix',
        'replace_prefix_with_preposition_or_ending',
        'paraphrase'
      ],
      note: 'Если у одного слова может быть два значения, их нужно разграничивать путём добавления окончания -u для существительных, заменой суффикса, заменой приставки предлогом (или окончанием) с тем же значением, либо перефразированием.'
    },
    examples: {
      obsession: {
        baseWord: 'sess/ion',
        logicalMeaning: 'заседание',
        transformRule: 'ob- + sess/ion',
        regularWord: 'ob/sess/ion',
        regularMeaning: 'заседание напротив кого-то/чего-то',
        internationalMeaning: 'одержимость',
        modifiedWord: 'obsessionu'
      },
      radical: {
        baseWord: 'radic/e',
        logicalMeaning: 'корень',
        transformRule: 'radic/e + -al',
        regularWord: 'radic/al',
        regularMeaning: 'корневой',
        internationalMeaning: 'радикальный, принципиальный',
        modifiedWord: 'radical / radic(i)'
      }
    }
  }
};

function normalizeText(s) {
  return (s || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function hasValue(s) {
  return normalizeText(s).length > 0;
}

function equalMeaning(a, b) {
  return normalizeText(a) === normalizeText(b);
}

function analyzeByRules(input) {
  const reasons = [];
  let classification = 'undetermined';
  let confidence = 'low';

  const regularExists = hasValue(input.regularMeaning);
  const internationalExists = hasValue(input.internationalMeaning);
  const modifiedExists = hasValue(input.modifiedWord);

  reasons.push('Основа анализа: только §84 книги.');

  if (!regularExists) {
    reasons.push('Не задано значение регулярной формы.');
  } else {
    reasons.push('Задано значение регулярной формы.');
  }

  if (internationalExists) {
    reasons.push('Задано интернациональное значение эквивалентного деривата.');
  } else {
    reasons.push('Интернациональное значение не задано.');
  }

  if (regularExists && internationalExists) {
    if (equalMeaning(input.regularMeaning, input.internationalMeaning)) {
      classification = 'regular_only';
      confidence = 'high';
      reasons.push('Значение регулярной формы совпадает с интернациональным значением, поэтому разграничение не требуется.');
    } else if (modifiedExists) {
      classification = 'double_meaning_with_modification';
      confidence = 'high';
      reasons.push('Значение регулярной формы отличается от интернационального значения. По §84 значения нужно разграничивать.');
      reasons.push('Модифицированная форма задана.');
    } else {
      classification = 'double_meaning_modification_missing';
      confidence = 'medium';
      reasons.push('Значение регулярной формы отличается от интернационального значения, но модифицированная форма не задана.');
    }
  } else if (regularExists && !internationalExists) {
    classification = 'regular_only';
    confidence = 'medium';
    reasons.push('Есть только регулярное значение. Оснований для разграничения по §84 нет.');
  } else if (!regularExists && internationalExists) {
    classification = 'insufficient_data';
    confidence = 'low';
    reasons.push('Для классификации по §84 нужно также задать значение регулярной формы.');
  }

  return {
    classification,
    confidence,
    reasons,
    usedLlm: false,
    llm: null
  };
}

async function maybeAskLocalLlm(input, rulesResult) {
  if (!els.useLlm.checked) return rulesResult;

  const borderline = rulesResult.classification === 'double_meaning_modification_missing'
    || rulesResult.classification === 'insufficient_data'
    || rulesResult.classification === 'undetermined';

  if (!borderline) return rulesResult;

  try {
    const prompt = buildPrompt(input);
    const response = await fetch(els.ollamaUrl.value.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: els.ollamaModel.value.trim(),
        prompt,
        stream: false,
        format: {
          type: 'object',
          properties: {
            recommendation: { type: 'string' },
            short_reason: { type: 'string' }
          },
          required: ['recommendation', 'short_reason']
        }
      })
    });

    const data = await response.json();
    let parsed = null;
    try {
      parsed = JSON.parse(data.response);
    } catch {
      parsed = { recommendation: 'no_parse', short_reason: String(data.response || '') };
    }

    return {
      ...rulesResult,
      usedLlm: true,
      llm: parsed
    };
  } catch (error) {
    return {
      ...rulesResult,
      usedLlm: true,
      llm: {
        recommendation: 'error',
        short_reason: 'Локальная модель недоступна: ' + error.message
      }
    };
  }
}

function buildPrompt(input) {
  return `
Ты помогаешь только в спорных случаях и не должен придумывать новые значения.
Нужно опираться только на данные пользователя и на правило из §84 книги Interal:
- если значение, выведенное логическим анализом элементов, отличается от интернационального значения эквивалентного деривата, значения нужно разграничивать;
- разграничение делается путём добавления -u для существительных, заменой суффикса, заменой приставки предлогом (или окончанием) с тем же значением, либо перефразированием.

Верни JSON с полями recommendation и short_reason.
Возможные значения recommendation:
- regular_only
- double_meaning_with_modification
- double_meaning_modification_missing
- insufficient_data

Данные:
Первичное слово: ${input.baseWord}
Логический анализ компонентов: ${input.logicalMeaning}
Правило деривации: ${input.transformRule}
Регулярная форма: ${input.regularWord}
Значение регулярной формы: ${input.regularMeaning}
Интернациональное значение: ${input.internationalMeaning}
Модифицированная форма: ${input.modifiedWord}
`.trim();
}

function getInput() {
  return {
    baseWord: els.baseWord.value,
    logicalMeaning: els.logicalMeaning.value,
    transformRule: els.transformRule.value,
    regularWord: els.regularWord.value,
    regularMeaning: els.regularMeaning.value,
    internationalMeaning: els.internationalMeaning.value,
    modifiedWord: els.modifiedWord.value
  };
}

function badge(label, type) {
  return `<span class="badge ${type}">${label}</span>`;
}

function render(result, input) {
  const labels = {
    regular_only: 'Только регулярное значение',
    double_meaning_with_modification: 'Разграничение нужно; модификация задана',
    double_meaning_modification_missing: 'Разграничение нужно; модификация не задана',
    insufficient_data: 'Недостаточно данных',
    undetermined: 'Не определено'
  };

  const badgeType = {
    regular_only: 'ok',
    double_meaning_with_modification: 'ok',
    double_meaning_modification_missing: 'warn',
    insufficient_data: 'no',
    undetermined: 'no'
  }[result.classification] || 'no';

  const html = `
    <div>
      ${badge(labels[result.classification] || result.classification, badgeType)}
      ${badge('Уверенность: ' + result.confidence, 'warn')}
    </div>

    <div class="grid">
      <div class="card">
        <h3>Регулярная форма</h3>
        <div><code>${escapeHtml(input.regularWord || '—')}</code></div>
        <pre>${escapeHtml(input.regularMeaning || '—')}</pre>
      </div>
      <div class="card">
        <h3>Интернациональное значение</h3>
        <div><code>${escapeHtml(input.modifiedWord || '—')}</code></div>
        <pre>${escapeHtml(input.internationalMeaning || '—')}</pre>
      </div>
    </div>

    <div class="card">
      <h3>Основания</h3>
      <pre>${escapeHtml(result.reasons.join('
'))}</pre>
    </div>

    ${result.usedLlm ? `
      <div class="card">
        <h3>Локальная модель</h3>
        <pre>${escapeHtml(JSON.stringify(result.llm, null, 2))}</pre>
      </div>
    ` : ''}
  `;

  els.result.classList.remove('empty');
  els.result.innerHTML = html;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

els.analyzeBtn.addEventListener('click', async () => {
  const input = getInput();
  els.result.classList.remove('empty');
  els.result.innerHTML = 'Анализ...';

  const rulesResult = analyzeByRules(input);
  const finalResult = await maybeAskLocalLlm(input, rulesResult);
  render(finalResult, input);
});

els.loadExampleBtn.addEventListener('click', () => {
  const ex = bookRules.section84.examples.obsession;
  els.baseWord.value = ex.baseWord;
  els.logicalMeaning.value = ex.logicalMeaning;
  els.transformRule.value = ex.transformRule;
  els.regularWord.value = ex.regularWord;
  els.regularMeaning.value = ex.regularMeaning;
  els.internationalMeaning.value = ex.internationalMeaning;
  els.modifiedWord.value = ex.modifiedWord;
});

els.loadExampleBtn.click();
