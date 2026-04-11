const endings = [
  { id: 'ending-e', category: 'Окончания', form: '-e', meaning: 'нейтральное окончание существительного; также употребляется в ряде вариантов формы' },
  { id: 'ending-a', category: 'Окончания', form: '-a', meaning: 'окончание существительного; также женский род у людей и животных' },
  { id: 'ending-o', category: 'Окончания', form: '-o', meaning: 'окончание существительного; также мужской род у людей и животных' },
  { id: 'ending-i', category: 'Окончания', form: '-i', meaning: 'окончание прилагательного; может заменять суффиксы прилагательных' }
];

const nounSuffixes = [
  { id: 'suf-er', category: 'Суффиксы существительных', form: '-er', meaning: 'человек с определённым качеством, занятием; инструмент, предмет' },
  { id: 'suf-or', category: 'Суффиксы существительных', form: '-or', meaning: 'человек с определённым качеством, занятием; инструмент, предмет; после t и s у глаголов на -er' },
  { id: 'suf-ilo', category: 'Суффиксы существительных', form: '-il/o', meaning: 'инструмент, предмет' },
  { id: 'suf-antia', category: 'Суффиксы существительных', form: '-anti/a', meaning: 'существительное от глагола; обычно у глаголов на -ar и на -an' },
  { id: 'suf-entia', category: 'Суффиксы существительных', form: '-enti/a', meaning: 'существительное от глагола; у глаголов на -er, -ir' },
  { id: 'suf-ari-noun', category: 'Суффиксы существительных', form: '-ari', meaning: 'занимающийся или обладающий чем-то человек' },
  { id: 'suf-astr', category: 'Суффиксы существительных', form: '-astr', meaning: 'пренебрежительное отношение к человеку определённой профессии или занятия' },
  { id: 'suf-aj', category: 'Суффиксы существительных', form: '-aj', meaning: 'нечто сделанное из, состоящее из, имеющее характер; коллекция вещей; единица измерения' },
  { id: 'suf-ist', category: 'Суффиксы существительных', form: '-ist', meaning: 'профессия, принадлежность к направлению или течению' },
  { id: 'suf-ism', category: 'Суффиксы существительных', form: '-ism', meaning: 'направление в искусстве, науке, религии, движении и прочие абстрактные понятия, а также их результаты' },
  { id: 'suf-eria', category: 'Суффиксы существительных', form: '-erí/a', meaning: 'место, где происходит данное действие' },
  { id: 'suf-oria', category: 'Суффиксы существительных', form: '-ori/a', meaning: 'вариант после t и s для -ería в ряде слов' },
  { id: 'suf-essa', category: 'Суффиксы существительных', form: '-ess/a', meaning: 'женский род' },
  { id: 'suf-anda', category: 'Суффиксы существительных', form: '-and/a', meaning: 'необходимость или обязательность быть чем-то; обычно у глаголов на -ar и на -an' },
  { id: 'suf-enda', category: 'Суффиксы существительных', form: '-end/a', meaning: 'необходимость или обязательность быть чем-то; после -er и -ir' },
  { id: 'suf-inda', category: 'Суффиксы существительных', form: '-ind/a', meaning: 'достоинство или заслуженность быть чем-то' },
  { id: 'suf-ede', category: 'Суффиксы существительных', form: '-ed/e', meaning: 'количество, которым наполняется что-либо' },
  { id: 'suf-ina-dim', category: 'Суффиксы существительных', form: '-in/a', meaning: 'уменьшительно-ласкательный суффикс' },
  { id: 'suf-ia-concept', category: 'Суффиксы существительных', form: '-i/a', meaning: 'абстрактная концепция; идеология; наука' },
  { id: 'suf-etta', category: 'Суффиксы существительных', form: '-ett/a', meaning: 'уменьшение, ослабление' },
  { id: 'suf-ona', category: 'Суффиксы существительных', form: '-on/a', meaning: 'увеличение, большой' },
  { id: 'suf-ell', category: 'Суффиксы существительных', form: '-ell', meaning: 'детёныш, потомок животного' },
  { id: 'suf-ita', category: 'Суффиксы существительных', form: '-it/á', meaning: 'конкретное проявление объекта, понятия, признака или действия' },
  { id: 'suf-ada', category: 'Суффиксы существительных', form: '-ad/a', meaning: 'продолжительное действие; у глаголов на -ar и на -an' },
  { id: 'suf-ida-action', category: 'Суффиксы существительных', form: '-id/a', meaning: 'продолжительное действие; у глаголов на -ir, -er' },
  { id: 'suf-ura', category: 'Суффиксы существительных', form: '-ur/a', meaning: 'результат действия' },
  { id: 'suf-ic-person', category: 'Суффиксы существительных', form: '-ic', meaning: 'человек, заболевающий болезнью или зависящий от чего-то' },
  { id: 'suf-ion', category: 'Суффиксы существительных', form: '-ion', meaning: 'процесс, результат действия' },
  { id: 'suf-ica', category: 'Суффиксы существительных', form: '-ic/a', meaning: 'совокупность знаний, дисциплина, практика или деятельность' },
  { id: 'suf-arium', category: 'Суффиксы существительных', form: '-arium', meaning: 'совокупность' },
  { id: 'suf-an', category: 'Суффиксы существительных', form: '-an', meaning: 'житель города, страны, член коллектива; также название языка' },
  { id: 'suf-yer', category: 'Суффиксы существительных', form: '-yér', meaning: 'вместилище' },
  { id: 'suf-ache', category: 'Суффиксы существительных', form: '-ach/e', meaning: 'пренебрежение' },
  { id: 'suf-id-desc', category: 'Суффиксы существительных', form: '-id', meaning: 'потомок' },
  { id: 'suf-ese', category: 'Суффиксы существительных', form: '-es/e', meaning: 'язык' },
  { id: 'suf-ant', category: 'Суффиксы существительных', form: '-ant', meaning: 'исполнитель действия; у глаголов на -ar' },
  { id: 'suf-ent', category: 'Суффиксы существительных', form: '-ent', meaning: 'исполнитель действия; у глаголов на -er' },
  { id: 'suf-um', category: 'Суффиксы существительных', form: '-um', meaning: 'абстрактное существительное' },
  { id: 'suf-ment', category: 'Суффиксы существительных', form: '-ment', meaning: 'результат действия' },
  { id: 'suf-ia-country', category: 'Суффиксы существительных', form: '-i/a', meaning: 'название страны, провинции с основной нацией' },
  { id: 'suf-oid', category: 'Суффиксы существительных', form: '-óid', meaning: 'похожий на что-то' },
  { id: 'suf-meyt', category: 'Суффиксы существительных', form: '-meyt', meaning: 'человек одного коллектива, объединения' },
  { id: 'suf-ing', category: 'Суффиксы существительных', form: '-ing', meaning: 'занятие' },
  { id: 'suf-ite', category: 'Суффиксы существительных', form: '-it/é', meaning: 'совокупность людей' },
  { id: 'suf-iat', category: 'Суффиксы существительных', form: '-iat', meaning: 'социальный слой' },
  { id: 'suf-illio', category: 'Суффиксы существительных', form: '-illi/o', meaning: 'ласкательная форма, мужской род' },
  { id: 'suf-innia', category: 'Суффиксы существительных', form: '-inni/a', meaning: 'ласкательная форма, женский род' },
  { id: 'suf-esse', category: 'Суффиксы существительных', form: '-ess/e', meaning: 'состояние' },
  { id: 'suf-ituda', category: 'Суффиксы существительных', form: '-itud/a', meaning: 'измеряемое качество' },
  { id: 'suf-on-particle', category: 'Суффиксы научные', form: '-on', meaning: 'частица' },
  { id: 'suf-ane', category: 'Суффиксы научные', form: '-an/e', meaning: 'одноцепочечный углеводород' },
  { id: 'suf-ene', category: 'Суффиксы научные', form: '-en/e', meaning: 'углеводород с двойной связью' },
  { id: 'suf-yne', category: 'Суффиксы научные', form: '-yn/e', meaning: 'углеводород с тройной связью' },
  { id: 'suf-ol', category: 'Суффиксы научные', form: '-ol', meaning: 'алкоголь, фенол; содержит группу -OH' },
  { id: 'suf-ale', category: 'Суффиксы научные', form: '-al/e', meaning: 'альдегид; содержит группу -CHO' },
  { id: 'suf-one', category: 'Суффиксы научные', form: '-on/e', meaning: 'кетон; содержит группу C=O' },
  { id: 'suf-oic', category: 'Суффиксы научные', form: '-oic', meaning: 'карбоксильный' },
  { id: 'suf-ide', category: 'Суффиксы научные', form: '-id/e', meaning: 'анион, часто одноатомный' },
  { id: 'suf-ite-chem', category: 'Суффиксы научные', form: '-it/e', meaning: 'анион с меньшим количеством оксигенов' },
  { id: 'suf-ate-chem', category: 'Суффиксы научные', form: '-at/e', meaning: 'анион с большим количеством оксигенов' },
  { id: 'suf-ema', category: 'Суффиксы научные', form: '-em/a', meaning: 'минимальная единица' },
  { id: 'suf-plic', category: 'Суффиксы числительных', form: '-plic', meaning: 'число, увеличенное в определённое число раз' },
  { id: 'suf-yem', category: 'Суффиксы числительных', form: '-yem', meaning: 'дробное числительное' },
  { id: 'suf-op', category: 'Суффиксы числительных', form: '-op', meaning: 'собирательное числительное' }
];

const adjectiveSuffixes = [
  { id: 'adj-al', category: 'Суффиксы прилагательных', form: '-al', meaning: 'отношение' },
  { id: 'adj-ari', category: 'Суффиксы прилагательных', form: '-ar/i', meaning: 'соответствие чему-то' },
  { id: 'adj-ic', category: 'Суффиксы прилагательных', form: '-ic', meaning: 'характер' },
  { id: 'adj-osi', category: 'Суффиксы прилагательных', form: '-os/i', meaning: 'наличие чего-то' },
  { id: 'adj-in', category: 'Суффиксы прилагательных', form: '-in', meaning: 'происхождение' },
  { id: 'adj-aci', category: 'Суффиксы прилагательных', form: '-ac/i', meaning: 'склонность к чему-либо' },
  { id: 'adj-esc', category: 'Суффиксы прилагательных', form: '-esc', meaning: 'поведение, манера' },
  { id: 'adj-ori', category: 'Суффиксы прилагательных', form: '-or/i', meaning: 'предназначение или способ действия' },
  { id: 'adj-id', category: 'Суффиксы прилагательных', form: '-id', meaning: 'обладание свойством' },
  { id: 'adj-il', category: 'Суффиксы прилагательных', form: '-il', meaning: 'характер, свойственность чему-то, качество' },
  { id: 'adj-inal', category: 'Суффиксы прилагательных', form: '-inal', meaning: 'суффикс прилагательного' },
  { id: 'adj-bil', category: 'Суффиксы прилагательных', form: '-íbil / -ábil', meaning: 'возможность; -ábil у слов на -ar и на -an' },
  { id: 'adj-issim', category: 'Суффиксы прилагательных', form: '-issim', meaning: 'превосходная степень' },
  { id: 'adj-atr', category: 'Суффиксы прилагательных', form: '-atr', meaning: 'подобие' },
  { id: 'adj-iv', category: 'Суффиксы прилагательных', form: '-iv', meaning: 'обладать способностью, свойством' }
];

const verbSuffixes = [
  { id: 'verb-isa', category: 'Суффиксы глаголов', form: '-is/a/r', meaning: 'делать каким-либо' },
  { id: 'verb-ifica', category: 'Суффиксы глаголов', form: '-ific/a/r', meaning: 'делать каким-либо' },
  { id: 'verb-eskan', category: 'Суффиксы глаголов', form: '-esk/an', meaning: 'начало действия' }
];

const prefixes = [
  { id: 'pre-des', category: 'Приставки', form: 'des-', meaning: 'противоположное значение' },
  { id: 'pre-in', category: 'Приставки', form: 'in-', meaning: 'противоположное значение; также «в»' },
  { id: 'pre-re', category: 'Приставки', form: 're-', meaning: 'заново, снова, пере' },
  { id: 'pre-de', category: 'Приставки', form: 'de-', meaning: 'отсутствие понятия, отрицание, отмена, вы-' },
  { id: 'pre-mis', category: 'Приставки', form: 'mis-', meaning: 'неправильно, ошибочно' },
  { id: 'pre-pre', category: 'Приставки', form: 'pre-', meaning: 'до' },
  { id: 'pre-post', category: 'Приставки', form: 'post-', meaning: 'после' },
  { id: 'pre-ex', category: 'Приставки', form: 'ex-', meaning: 'бывший; также «из-, изо-» без дефиса' },
  { id: 'pre-dis', category: 'Приставки', form: 'dis-', meaning: 'разобщение, разъединение, «раз»; может использоваться как противоположное значение' },
  { id: 'pre-pra', category: 'Приставки', form: 'pra-', meaning: '«пра», первоначальный' },
  { id: 'pre-proto', category: 'Приставки', form: 'proto-', meaning: 'прото-' },
  { id: 'pre-fin', category: 'Приставки', form: 'fin-', meaning: 'конец действия' },
  { id: 'pre-bo', category: 'Приставки', form: 'bo-', meaning: 'родство в результате брака' },
  { id: 'pre-step', category: 'Приставки', form: 'step-', meaning: 'родство в результате второго брака' },
  { id: 'pre-ho', category: 'Приставки', form: 'ho-', meaning: 'в то же самое время' },
  { id: 'pre-hyper', category: 'Приставки', form: 'hyper-', meaning: 'гипер-, выше нормы' },
  { id: 'pre-hypo', category: 'Приставки', form: 'hypo-', meaning: 'гипо-, ниже нормы' },
  { id: 'pre-retro', category: 'Приставки', form: 'retro-', meaning: 'положение сзади, назад' },
  { id: 'pre-poly', category: 'Приставки', form: 'poly-', meaning: 'много' },
  { id: 'pre-para', category: 'Приставки', form: 'para-', meaning: 'отклонение от нормы' },
  { id: 'pre-peri', category: 'Приставки', form: 'peri-', meaning: 'около, вокруг' },
  { id: 'pre-semi', category: 'Приставки', form: 'semi-', meaning: 'полу-' },
  { id: 'pre-mi', category: 'Приставки', form: 'mi-', meaning: 'пол, полу-' },
  { id: 'pre-tele', category: 'Приставки', form: 'tele-', meaning: 'на расстоянии, далеко' },
  { id: 'pre-paleo', category: 'Приставки', form: 'paleo-', meaning: 'древний, доисторический, примитивный' },
  { id: 'pre-meso', category: 'Приставки', form: 'meso-', meaning: 'промежуточный, средний' },
  { id: 'pre-hetero', category: 'Приставки', form: 'hetero-', meaning: 'иной, различный' },
  { id: 'pre-melo', category: 'Приставки', form: 'melo-', meaning: 'песенный, музыкальный' },
  { id: 'pre-exo', category: 'Приставки', form: 'exo-', meaning: 'снаружи, вне' },
  { id: 'pre-atmo', category: 'Приставки', form: 'atmo-', meaning: 'пар' },
  { id: 'pre-hydro', category: 'Приставки', form: 'hydro-', meaning: 'относящийся к воде' },
  { id: 'pre-bi', category: 'Приставки', form: 'bi-', meaning: 'дву(х)-' },
  { id: 'pre-pro', category: 'Приставки', form: 'pro-', meaning: 'за пределами; в пользу чего-то' },
  { id: 'pre-ob', category: 'Приставки', form: 'ob-', meaning: 'находящееся противоположно, напротив, рядом' },
  { id: 'pre-par', category: 'Приставки', form: 'par-', meaning: 'чёткое или тщательное действие' },
  { id: 'pre-arc', category: 'Приставки', form: 'arc-', meaning: 'арх(и)-; перед e — arki-' },
  { id: 'pre-pseudo', category: 'Приставки', form: 'pseudo-', meaning: 'псевдо-' },
  { id: 'pre-pan', category: 'Приставки', form: 'pan-', meaning: 'всеобщий; включающий всех членов группы или все элементы' },
  { id: 'pre-dys', category: 'Приставки', form: 'dys-', meaning: 'плохой, болезненный, ненормальный' },
  { id: 'pre-ab', category: 'Приставки', form: 'ab-', meaning: 'прочь' },
  { id: 'pre-anti', category: 'Приставки', form: 'anti-', meaning: 'анти-, против' },
  { id: 'pre-auto', category: 'Приставки', form: 'auto-', meaning: 'авто-, само-' },
  { id: 'pre-omni', category: 'Приставки', form: 'omni-', meaning: 'всеобъемлющий, всеведущий' },
  { id: 'pre-a', category: 'Приставки', form: 'a-', meaning: 'без, отсутствие; перед гласной становится an-' },
  { id: 'pre-meta', category: 'Приставки', form: 'meta-', meaning: 'выше, чем; превосходящий; всеохватывающий' },
  { id: 'pre-neo', category: 'Приставки', form: 'neo-', meaning: 'новый' },
  { id: 'pre-pyro', category: 'Приставки', form: 'pyro-', meaning: 'связанное с огнём' },
  { id: 'pre-multi', category: 'Приставки', form: 'multi-', meaning: 'много-, мульти-' },
  { id: 'pre-mini', category: 'Приставки', form: 'mini-', meaning: 'маленькое, минимальное' },
  { id: 'pre-macro', category: 'Приставки', form: 'macro-', meaning: 'большое, продолжительное' },
  { id: 'pre-mono', category: 'Приставки', form: 'mono-', meaning: 'единичное, единственное' },
  { id: 'pre-di', category: 'Приставки научные', form: 'di-', meaning: 'два' },
  { id: 'pre-tetra', category: 'Приставки научные', form: 'tetra-', meaning: 'четыре' },
  { id: 'pre-iso', category: 'Приставки научные', form: 'iso-', meaning: 'изомер' },
  { id: 'pre-neo-science', category: 'Приставки научные', form: 'neo-', meaning: 'другой изомер, часто разветвлённый' },
  { id: 'pre-kilo', category: 'Приставки научные', form: 'kilo-', meaning: 'приставка международной системы единиц' },
  { id: 'pre-hecto', category: 'Приставки научные', form: 'hecto-', meaning: 'приставка международной системы единиц' },
  { id: 'pre-nano', category: 'Приставки научные', form: 'nano-', meaning: 'приставка международной системы единиц' },
  { id: 'pre-mega', category: 'Приставки научные', form: 'mega-', meaning: 'приставка международной системы единиц' }
];

const allComponents = [...prefixes, ...nounSuffixes, ...adjectiveSuffixes, ...verbSuffixes, ...endings];
const byCategory = allComponents.reduce((acc, item) => {
  acc[item.category] ||= [];
  acc[item.category].push(item);
  return acc;
}, {});

const assimilationOptions = [
  { value: 'none', label: 'Без ассимиляции' },
  { value: 'deval-general', label: 'Модифицированное правило де Валя / вручную' },
  { value: 'drop-double-consonant', label: '§122: сокращение двойной согласной' },
  { value: 'root-loss', label: '§123: выпадение части корня' },
  { value: 'con-in-prefix', label: '§124: con-/in- → col-/il-, cor-/ir-, com-/im-, co-' },
  { value: 'ex-prefix', label: '§124: ex- → em-, el-' },
  { value: 'sub-prefix', label: '§124: sub- → sup-, su-' },
  { value: 'ad-prefix', label: '§124: ad- → at-, ac-, an-, ag-, al-, af-, as-, ar-' },
  { value: 'ob-prefix', label: '§124: ob- → op-, of-' },
  { value: 'dis-prefix', label: '§124: dis- → dif-, di-' },
  { value: 'trans-prefix', label: '§124: trans- → tra-, tran-' },
  { value: 'regular-prefix-models', label: '§125: non-, in-, ad-, a(n)-, co-, de-, dis-, e(x)-, o(b)-, su(b)-, trans-' },
  { value: 'd-to-s', label: 'Исключение из книги: -d → -s' },
  { value: 'd-to-t', label: 'Исключение из книги: -d → -t' },
  { value: 'se-xe-to-ct', label: 'Исключение из книги: -s/e, -x/e → -ct' }
];

const els = {
  regularWord: document.getElementById('regularWord'),
  logicalMeaning: document.getElementById('logicalMeaning'),
  internationalMeaning: document.getElementById('internationalMeaning'),
  naturalisticWord: document.getElementById('naturalisticWord'),
  componentsList: document.getElementById('componentsList'),
  componentsSummary: document.getElementById('componentsSummary'),
  addComponentBtn: document.getElementById('addComponentBtn'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  clearBtn: document.getElementById('clearBtn'),
  result: document.getElementById('result'),
  useLlm: document.getElementById('useLlm'),
  ollamaUrl: document.getElementById('ollamaUrl'),
  ollamaModel: document.getElementById('ollamaModel'),

  chooserModal: document.getElementById('chooserModal'),
  rootModal: document.getElementById('rootModal'),
  componentModal: document.getElementById('componentModal'),
  chooseRootBtn: document.getElementById('chooseRootBtn'),
  chooseComponentBtn: document.getElementById('chooseComponentBtn'),
  rootFormInput: document.getElementById('rootFormInput'),
  rootMeaningInput: document.getElementById('rootMeaningInput'),
  assimilationSelect: document.getElementById('assimilationSelect'),
  assimilationCustomWrap: document.getElementById('assimilationCustomWrap'),
  assimilationCustomInput: document.getElementById('assimilationCustomInput'),
  saveRootBtn: document.getElementById('saveRootBtn'),
  componentCategorySelect: document.getElementById('componentCategorySelect'),
  componentSelect: document.getElementById('componentSelect'),
  componentMeaningPreview: document.getElementById('componentMeaningPreview'),
  saveComponentBtn: document.getElementById('saveComponentBtn')
};

const bookRules = {
  source: { title: 'INTERAL russ (2).pdf', sections: ['§84'] },
  section84: {
    coreRule: 'Если логическое значение, выведенное из элементов, отличается от интернационального значения эквивалентного деривата, значения нужно разграничивать.',
    nounMarker: 'u',
    methods: ['add_u_for_nouns', 'replace_suffix', 'replace_prefix_with_preposition_or_ending', 'paraphrase']
  }
};

let state = {
  components: []
};

function setupSelects() {
  assimilationOptions.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    els.assimilationSelect.appendChild(option);
  });

  Object.keys(byCategory).forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    els.componentCategorySelect.appendChild(option);
  });

  fillComponentSelect();
}

function fillComponentSelect() {
  const category = els.componentCategorySelect.value || Object.keys(byCategory)[0];
  const items = byCategory[category] || [];
  els.componentSelect.innerHTML = '';
  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.form} — ${item.meaning}`;
    els.componentSelect.appendChild(option);
  });
  updateComponentPreview();
}

function updateComponentPreview() {
  const item = allComponents.find((x) => x.id === els.componentSelect.value);
  els.componentMeaningPreview.textContent = item ? `${item.form} — ${item.meaning}` : '—';
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function closeAllModals() {
  [els.chooserModal, els.rootModal, els.componentModal].forEach(closeModal);
}

function addRootComponent() {
  const form = els.rootFormInput.value.trim();
  const meaning = els.rootMeaningInput.value.trim();
  const assimilation = els.assimilationSelect.value;
  const assimilationLabel = assimilationOptions.find((x) => x.value === assimilation)?.label || '';
  const assimilationCustom = els.assimilationCustomInput.value.trim();

  if (!form || !meaning) return;

  state.components.push({
    id: crypto.randomUUID(),
    type: 'root',
    label: 'Первичное корневое слово',
    form,
    meaning,
    assimilation,
    assimilationLabel,
    assimilationCustom
  });

  els.rootFormInput.value = '';
  els.rootMeaningInput.value = '';
  els.assimilationSelect.value = 'none';
  els.assimilationCustomInput.value = '';
  els.assimilationCustomWrap.classList.add('hidden');
  renderComponents();
  closeAllModals();
}

function addSelectedComponent() {
  const item = allComponents.find((x) => x.id === els.componentSelect.value);
  if (!item) return;

  state.components.push({
    id: crypto.randomUUID(),
    type: 'component',
    label: item.category.slice(0, -1) || item.category,
    form: item.form,
    meaning: item.meaning,
    sourceId: item.id,
    category: item.category
  });

  renderComponents();
  closeAllModals();
}

function removeComponent(id) {
  state.components = state.components.filter((item) => item.id !== id);
  renderComponents();
}

function componentSummaryText() {
  if (!state.components.length) return '—';
  return state.components.map((item) => item.form).join(' / ');
}

function renderComponents() {
  if (!state.components.length) {
    els.componentsList.className = 'components-list empty';
    els.componentsList.textContent = 'Компоненты не добавлены.';
    els.componentsSummary.textContent = '—';
    return;
  }

  els.componentsList.className = 'components-list';
  els.componentsList.innerHTML = state.components.map((item) => `
    <div class="component-item">
      <div class="component-main">
        <div class="component-title">${escapeHtml(item.form)}</div>
        <div class="component-meta">${escapeHtml(item.label)}</div>
        <div class="component-meaning">${escapeHtml(item.meaning)}${item.type === 'root' ? renderAssimilationMeta(item) : ''}</div>
      </div>
      <button class="component-delete" type="button" data-delete-id="${item.id}">×</button>
    </div>
  `).join('');

  els.componentsSummary.textContent = componentSummaryText();

  els.componentsList.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', () => removeComponent(btn.dataset.deleteId));
  });
}

function renderAssimilationMeta(item) {
  if (!item.assimilation || item.assimilation === 'none') return '';
  const note = item.assimilation === 'manual' && item.assimilationCustom
    ? item.assimilationCustom
    : item.assimilationLabel;
  return ` · Ассимиляция: ${note}`;
}

function normalizeText(value) {
  return (value || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function hasValue(value) {
  return normalizeText(value).length > 0;
}

function getInput() {
  return {
    regularWord: els.regularWord.value.trim(),
    logicalMeaning: els.logicalMeaning.value.trim(),
    internationalMeaning: els.internationalMeaning.value.trim(),
    naturalisticWord: els.naturalisticWord.value.trim(),
    components: [...state.components]
  };
}

function analyzeByRules(input) {
  const reasons = [];
  let classification = 'undetermined';
  let confidence = 'low';

  reasons.push('Основа анализа: только §84.');

  if (!input.regularWord) reasons.push('Не задано слово по регулярной модели.');
  if (!input.logicalMeaning) reasons.push('Не задан логический анализ компонентов.');
  if (!input.internationalMeaning) reasons.push('Не задано интернациональное значение эквивалентного деривата.');
  if (!input.naturalisticWord) reasons.push('Не задано слово по натуралистичной модели.');
  if (!input.components.length) reasons.push('Не добавлен анализ компонентов.');

  const enough = input.regularWord && input.logicalMeaning && input.internationalMeaning;
  if (!enough) {
    return { classification: 'insufficient_data', confidence, reasons, semanticDistance: null, usedLlm: false, llm: null };
  }

  const sameMeaning = normalizeText(input.logicalMeaning) === normalizeText(input.internationalMeaning);
  if (sameMeaning) {
    classification = 'regular_only';
    confidence = 'high';
    reasons.push('Логическое значение совпадает с интернациональным значением. Разграничение не требуется.');
  } else if (input.naturalisticWord) {
    classification = 'double_meaning_with_modification';
    confidence = 'high';
    reasons.push('Логическое значение отличается от интернационального значения. По §84 значения нужно разграничивать.');
    reasons.push('Слово по натуралистичной модели задано.');
  } else {
    classification = 'double_meaning_modification_missing';
    confidence = 'medium';
    reasons.push('Логическое значение отличается от интернационального значения, но натуралистичная форма не задана.');
  }

  const semanticDistance = computeSemanticDistance(input.logicalMeaning, input.internationalMeaning);
  reasons.push(`Семантическая дистанция: ${semanticDistance.toFixed(2)}`);

  return { classification, confidence, reasons, semanticDistance, usedLlm: false, llm: null };
}

function computeSemanticDistance(logical, international) {
  const a = normalizeText(logical).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const b = normalizeText(international).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size || 1;
  return 1 - intersection / union;
}

async function maybeAskLocalLlm(input, rulesResult) {
  if (!els.useLlm.checked) return rulesResult;

  const borderline = rulesResult.classification === 'double_meaning_modification_missing'
    || rulesResult.classification === 'insufficient_data'
    || rulesResult.semanticDistance >= 0.8;

  if (!borderline) return rulesResult;

  try {
    const response = await fetch(els.ollamaUrl.value.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: els.ollamaModel.value.trim(),
        prompt: buildPrompt(input),
        stream: false,
        format: {
          type: 'object',
          properties: {
            recommendation: { type: 'string' },
            semantic_distance: { type: 'number' },
            short_reason: { type: 'string' }
          },
          required: ['recommendation', 'short_reason']
        }
      })
    });
    const data = await response.json();
    let parsed;
    try {
      parsed = JSON.parse(data.response);
    } catch {
      parsed = { recommendation: 'no_parse', short_reason: String(data.response || '') };
    }
    return { ...rulesResult, usedLlm: true, llm: parsed };
  } catch (error) {
    return {
      ...rulesResult,
      usedLlm: true,
      llm: { recommendation: 'error', short_reason: 'Локальная модель недоступна: ' + error.message }
    };
  }
}

function buildPrompt(input) {
  const componentsText = input.components.map((item, index) => {
    const extra = item.type === 'root' && item.assimilation && item.assimilation !== 'none'
      ? `; ассимиляция: ${item.assimilationCustom || item.assimilationLabel}`
      : '';
    return `${index + 1}. ${item.form} — ${item.meaning}${extra}`;
  }).join('\n');

  return [
    'Ты помогаешь только в спорных случаях и не должен придумывать новые значения.',
    'Основа: только §84 книги Interal.',
    'Если логическое значение, выведенное из элементов, отличается от интернационального значения эквивалентного деривата, значения нужно разграничивать.',
    'Верни JSON с полями recommendation, semantic_distance и short_reason.',
    '',
    `Слово по регулярной модели: ${input.regularWord}`,
    `Анализ компонентов:\n${componentsText || 'нет данных'}`,
    `Логический анализ: ${input.logicalMeaning}`,
    `Интернациональное значение: ${input.internationalMeaning}`,
    `Слово по натуралистичной модели: ${input.naturalisticWord || 'не задано'}`
  ].join('\n');
}

function badge(text, type = '') {
  return `<span class="badge ${type}">${escapeHtml(text)}</span>`;
}

function renderResult(result, input) {
  const labels = {
    regular_only: 'Только регулярное значение',
    double_meaning_with_modification: 'Разграничение нужно; натуралистичная форма задана',
    double_meaning_modification_missing: 'Разграничение нужно; натуралистичная форма не задана',
    insufficient_data: 'Недостаточно данных',
    undetermined: 'Не определено'
  };

  const types = {
    regular_only: 'ok',
    double_meaning_with_modification: 'ok',
    double_meaning_modification_missing: 'warn',
    insufficient_data: 'no',
    undetermined: 'no'
  };

  els.result.classList.remove('empty');
  els.result.innerHTML = `
    <div class="badges">
      ${badge(labels[result.classification] || result.classification, types[result.classification] || 'no')}
      ${badge('Уверенность: ' + result.confidence, 'warn')}
      ${result.semanticDistance !== null ? badge('Дистанция: ' + result.semanticDistance.toFixed(2), 'warn') : ''}
    </div>

    <div class="result-grid">
      <div class="result-card">
        <h3>Регулярная модель</h3>
        <pre>${escapeHtml(input.regularWord || '—')}</pre>
      </div>
      <div class="result-card">
        <h3>Натуралистичная модель</h3>
        <pre>${escapeHtml(input.naturalisticWord || '—')}</pre>
      </div>
      <div class="result-card">
        <h3>Анализ компонентов</h3>
        <pre>${escapeHtml(componentSummaryText())}</pre>
      </div>
      <div class="result-card">
        <h3>Логический анализ</h3>
        <pre>${escapeHtml(input.logicalMeaning || '—')}</pre>
      </div>
      <div class="result-card">
        <h3>Интернациональное значение</h3>
        <pre>${escapeHtml(input.internationalMeaning || '—')}</pre>
      </div>
    </div>

    <div class="result-card">
      <h3>Основания</h3>
      <pre>${escapeHtml(result.reasons.join('\n'))}</pre>
    </div>

    ${result.usedLlm ? `
      <div class="result-card" style="margin-top: 10px;">
        <h3>Локальная модель</h3>
        <pre>${escapeHtml(JSON.stringify(result.llm, null, 2))}</pre>
      </div>
    ` : ''}
  `;
}

function clearAll() {
  els.regularWord.value = '';
  els.logicalMeaning.value = '';
  els.internationalMeaning.value = '';
  els.naturalisticWord.value = '';
  state.components = [];
  renderComponents();
  els.result.classList.add('empty');
  els.result.textContent = 'Заполните поля и нажмите «Анализировать».';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function attachEvents() {
  els.addComponentBtn.addEventListener('click', () => openModal(els.chooserModal));
  els.chooseRootBtn.addEventListener('click', () => {
    closeModal(els.chooserModal);
    openModal(els.rootModal);
  });
  els.chooseComponentBtn.addEventListener('click', () => {
    closeModal(els.chooserModal);
    openModal(els.componentModal);
  });
  els.assimilationSelect.addEventListener('change', () => {
    els.assimilationCustomWrap.classList.toggle('hidden', els.assimilationSelect.value !== 'manual');
  });
  els.componentCategorySelect.addEventListener('change', fillComponentSelect);
  els.componentSelect.addEventListener('change', updateComponentPreview);
  els.saveRootBtn.addEventListener('click', addRootComponent);
  els.saveComponentBtn.addEventListener('click', addSelectedComponent);
  els.clearBtn.addEventListener('click', clearAll);
  els.analyzeBtn.addEventListener('click', async () => {
    const input = getInput();
    const rulesResult = analyzeByRules(input);
    const finalResult = await maybeAskLocalLlm(input, rulesResult);
    renderResult(finalResult, input);
  });
  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', closeAllModals);
  });
}

setupSelects();
attachEvents();
renderComponents();
