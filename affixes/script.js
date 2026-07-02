const CONTROL_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'ru'];
const AUXILIARY_LANGUAGES = ['pl', 'sv', 'ca', 'oc', 'ro'];

const procedureDefaults = {
  international_affix: { required: 'at_least_5_of_6', actual: 'strong' },
  associativ_affix: { required: 'at_least_3_of_6', actual: 'requires_check' },
  alter_affix: { required: 'partial_presence_or_alternative_need', actual: 'weak_or_partial' }
};

const examples = {
  international_affix: {
    id: 'af_2vfwODldoZ3e',
    form: '-ion',
    morphemeType: 'suffix',
    meaning: {
      en: 'action, process, or result of an action',
      de: 'Handlung, Prozess oder Ergebnis einer Handlung',
      fr: "action, processus ou résultat d'une action",
      es: 'acción, proceso o resultado de una acción',
      it: "azione, processo o risultato di un'azione",
      ru: 'действие, процесс или результат действия'
    },
    controlLanguages: { en: ['-ion', '-tion', '-sion'], de: ['-ion', '-tion', '-sion'], fr: ['-ion', '-tion', '-sion'], es: ['-ión', '-ción', '-sión'], it: ['-ione', '-zione', '-sione'], ru: ['-ия', '-ция', '-сия'] },
    auxiliaryLanguages: { pl: ['-ion', '-cja', '-sja'], sv: ['-ion', '-tion'], ca: ['-ió', '-ció', '-sió'], oc: ['-ion', '-cion'], ro: ['-ion', '-ție', '-siune'] }
  },
  associativ_affix: {
    id: 'af_7kQmR2xNdP9s',
    form: '-etta',
    morphemeType: 'suffix',
    meaning: {
      en: 'small object, diminutive form, or derived object-related variant',
      de: 'kleiner Gegenstand, Diminutivform oder abgeleitete gegenständliche Variante',
      fr: 'petit objet, forme diminutive ou variante objectale dérivée',
      es: 'objeto pequeño, forma diminutiva o variante objetual derivada',
      it: 'piccolo oggetto, forma diminutiva o variante oggettuale derivata',
      ru: 'малый предмет, уменьшенная форма или производный предметный вариант'
    },
    controlLanguages: { en: ['-ette'], de: ['-ette'], fr: ['-ette'], es: ['-eta'], it: ['-etto', '-etta'], ru: ['-етка'] },
    auxiliaryLanguages: { pl: ['-etka'], sv: ['-ett'], ca: ['-et', '-eta'], oc: ['-et', '-eta'], ro: ['-etă'] }
  },
  alter_affix: {
    id: 'af_N5pQw8rXsT2a',
    form: '-ilo',
    morphemeType: 'suffix',
    meaning: {
      en: 'instrument, means, or device for an action',
      de: 'Instrument, Mittel oder Gerät für eine Handlung',
      fr: 'instrument, moyen ou dispositif pour une action',
      es: 'instrumento, medio o dispositivo para una acción',
      it: "strumento, mezzo o dispositivo per un'azione",
      ru: 'инструмент, средство или приспособление для действия'
    },
    controlLanguages: { en: ['-er', '-or'], de: ['-er'], fr: ['-eur', '-oir'], es: ['-dor'], it: ['-tore'], ru: ['-ло', '-тель'] },
    auxiliaryLanguages: { pl: ['-ło', '-nik'], sv: ['-are'], ca: ['-dor'], oc: ['-dor'], ro: ['-tor'] }
  }
};

const elements = {
  id: document.getElementById('idInput'),
  status: document.getElementById('statusInput'),
  form: document.getElementById('formInput'),
  morphemeType: document.getElementById('morphemeTypeInput'),
  procedure: document.getElementById('procedureInput'),
  version: document.getElementById('versionInput'),
  cardType: document.getElementById('cardTypeInput'),
  vordType: document.getElementById('vordTypeInput'),
  createdAt: document.getElementById('createdAtInput'),
  required: document.getElementById('criteriaRequiredInput'),
  actual: document.getElementById('criteriaActualInput'),
  meaningInputs: document.getElementById('meaningInputs'),
  controlFormsInputs: document.getElementById('controlFormsInputs'),
  auxiliaryFormsInputs: document.getElementById('auxiliaryFormsInputs'),
  output: document.getElementById('jsonOutput'),
  notice: document.getElementById('notice'),
  buildButton: document.getElementById('buildButton'),
  qwenButton: document.getElementById('qwenButton'),
  copyButton: document.getElementById('copyButton'),
  downloadButton: document.getElementById('downloadButton')
};

function setNotice(message) { elements.notice.textContent = message || ''; }
function splitValues(value) { return String(value || '').split(',').map((item) => item.trim()).filter(Boolean); }
function readLanguageText(container, languages) {
  const result = {};
  languages.forEach((lang) => {
    const field = container.querySelector(`[data-lang="${lang}"]`);
    result[lang] = field ? field.value.trim() : '';
  });
  return result;
}
function readLanguageArrays(container, languages) {
  const result = {};
  languages.forEach((lang) => {
    const field = container.querySelector(`[data-lang="${lang}"]`);
    result[lang] = field ? splitValues(field.value) : [];
  });
  return result;
}
function writeLanguageText(container, data, languages) {
  languages.forEach((lang) => {
    const field = container.querySelector(`[data-lang="${lang}"]`);
    if (field) field.value = data?.[lang] || '';
  });
}
function writeLanguageArrays(container, data, languages) {
  languages.forEach((lang) => {
    const field = container.querySelector(`[data-lang="${lang}"]`);
    if (field) field.value = Array.isArray(data?.[lang]) ? data[lang].join(', ') : '';
  });
}
function buildStrictCard() {
  return {
    id: elements.id.value.trim(),
    status: elements.status.value.trim(),
    form: elements.form.value.trim(),
    morphemeType: elements.morphemeType.value,
    procedure: elements.procedure.value,
    version: elements.version.value.trim(),
    card_type: elements.cardType.value.trim(),
    vord_type: elements.vordType.value.trim(),
    created_at: elements.createdAt.value.trim(),
    meaning: readLanguageText(elements.meaningInputs, CONTROL_LANGUAGES),
    criteria: { controlLanguagePresence: { required: elements.required.value.trim(), actual: elements.actual.value.trim() } },
    forms: {
      controlLanguages: readLanguageArrays(elements.controlFormsInputs, CONTROL_LANGUAGES),
      auxiliaryLanguages: readLanguageArrays(elements.auxiliaryFormsInputs, AUXILIARY_LANGUAGES)
    }
  };
}
function renderCard(card = buildStrictCard()) {
  elements.output.textContent = JSON.stringify(card, null, 2);
  return card;
}
function applyExample(procedure) {
  const example = examples[procedure];
  const defaults = procedureDefaults[procedure];
  if (!example || !defaults) return;
  elements.id.value = example.id;
  elements.form.value = example.form;
  elements.morphemeType.value = example.morphemeType;
  elements.required.value = defaults.required;
  elements.actual.value = defaults.actual;
  writeLanguageText(elements.meaningInputs, example.meaning, CONTROL_LANGUAGES);
  writeLanguageArrays(elements.controlFormsInputs, example.controlLanguages, CONTROL_LANGUAGES);
  writeLanguageArrays(elements.auxiliaryFormsInputs, example.auxiliaryLanguages, AUXILIARY_LANGUAGES);
  updateQwenButtonState();
  renderCard();
}
function updateQwenButtonState() { elements.qwenButton.disabled = elements.procedure.value !== 'alter_affix'; }
async function copyJson() {
  const text = elements.output.textContent || JSON.stringify(buildStrictCard(), null, 2);
  await navigator.clipboard.writeText(text);
  setNotice('JSON скопирован.');
}
function downloadJson() {
  const card = buildStrictCard();
  const blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${card.id || 'affix-card'}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setNotice('JSON скачан.');
}
function applyCardPatch(card) {
  if (!card || typeof card !== 'object') return;
  elements.id.value = card.id || elements.id.value;
  elements.status.value = card.status || elements.status.value;
  elements.form.value = card.form || elements.form.value;
  elements.morphemeType.value = card.morphemeType || elements.morphemeType.value;
  elements.procedure.value = card.procedure || elements.procedure.value;
  elements.version.value = card.version || elements.version.value;
  elements.cardType.value = card.card_type || elements.cardType.value;
  elements.vordType.value = card.vord_type || elements.vordType.value;
  elements.createdAt.value = card.created_at || elements.createdAt.value;
  writeLanguageText(elements.meaningInputs, card.meaning || {}, CONTROL_LANGUAGES);
  writeLanguageArrays(elements.controlFormsInputs, card.forms?.controlLanguages || {}, CONTROL_LANGUAGES);
  writeLanguageArrays(elements.auxiliaryFormsInputs, card.forms?.auxiliaryLanguages || {}, AUXILIARY_LANGUAGES);
  const presence = card.criteria?.controlLanguagePresence || {};
  elements.required.value = presence.required || elements.required.value;
  elements.actual.value = presence.actual || elements.actual.value;
  updateQwenButtonState();
  renderCard();
}
async function analyzeAlterAffix() {
  if (elements.procedure.value !== 'alter_affix') return;
  setNotice('Qwen анализирует иной аффикс...');
  elements.qwenButton.disabled = true;
  try {
    const response = await fetch('/api/qwen-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'affixes_alter_card',
        payload: buildStrictCard(),
        interfaceLanguage: document.documentElement.lang?.startsWith('en') ? 'en' : 'ru'
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Qwen request failed.');
    applyCardPatch(data.card);
    setNotice('Карточка заполнена через Qwen.');
  } catch (error) {
    console.error(error);
    setNotice(`Ошибка: ${error.message}`);
  } finally {
    updateQwenButtonState();
  }
}
elements.procedure.addEventListener('change', () => applyExample(elements.procedure.value));
elements.buildButton.addEventListener('click', () => { renderCard(); setNotice('JSON создан.'); });
elements.copyButton.addEventListener('click', () => copyJson().catch((error) => setNotice(error.message)));
elements.downloadButton.addEventListener('click', downloadJson);
elements.qwenButton.addEventListener('click', analyzeAlterAffix);
document.addEventListener('input', () => renderCard());
updateQwenButtonState();
renderCard();
