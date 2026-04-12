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
  { value: 'none', label: 'Без ассимиляции', autoForm: '' },
  { value: 'add-t', label: 'Добавление -t', autoForm: '-t' },
  { value: 'd-to-s', label: 'Замена -d на -s', autoForm: '-s' },
  { value: 'r-to-s', label: 'Замена -r на -s', autoForm: '-s' },
  { value: 'consonant-g-to-s', label: 'Согласная + -g на -s', autoForm: '-s' },
  { value: 'b-to-pt', label: 'Замена -b на -pt', autoForm: '-pt' },
  { value: 'vowel-g-to-ct', label: 'Гласная + -g на -ct', autoForm: '-ct' },
  { value: 'h-to-ct', label: 'Замена -h на -ct', autoForm: '-ct' },
  { value: 'y-to-ct', label: 'Замена -y на -ct', autoForm: '-ct' },
  { value: 'se-to-ct', label: '-s/e на -ct', autoForm: '-ct' },
  { value: 'xe-to-ct', label: '-x/e на -ct', autoForm: '-ct' },

  { value: 'exc-seder', label: '1. seder — sess- (сидеть)', autoForm: 'sess-', rootForm: 'seder', rootMeaning: 'сидеть' },
  { value: 'exc-mover', label: '2. mover — mot- (двигать)', autoForm: 'mot-', rootForm: 'mover', rootMeaning: 'двигать' },
  { value: 'exc-venir', label: '3. venir — vent- (приходить)', autoForm: 'vent-', rootForm: 'venir', rootMeaning: 'приходить' },
  { value: 'exc-sentir', label: '4. sentir — sens- (чувствовать)', autoForm: 'sens-', rootForm: 'sentir', rootMeaning: 'чувствовать' },
  { value: 'exc-cognoscer', label: '5. cognoscer — cognit- (знать)', autoForm: 'cognit-', rootForm: 'cognoscer', rootMeaning: 'знать' },
  { value: 'exc-morir', label: '6. morir — mort- (умирать)', autoForm: 'mort-', rootForm: 'morir', rootMeaning: 'умирать' },
  { value: 'exc-aperir', label: '7. aperir — apert- (открывать)', autoForm: 'apert-', rootForm: 'aperir', rootMeaning: 'открывать' },
  { value: 'exc-experir', label: '8. experir — expert- (испытывать, пробовать)', autoForm: 'expert-', rootForm: 'experir', rootMeaning: 'испытывать, пробовать' },
  { value: 'exc-coverir', label: '9. coverir — covert- (покрывать)', autoForm: 'covert-', rootForm: 'coverir', rootMeaning: 'покрывать' },
  { value: 'exc-presider', label: '10. presider — presiss- (быть президентом)', autoForm: 'presiss-', rootForm: 'presider', rootMeaning: 'быть президентом' },
  { value: 'exc-friger', label: '11. friger — fris- (быть холодным, мёрзлым)', autoForm: 'fris-', rootForm: 'friger', rootMeaning: 'быть холодным, мёрзлым' },
  { value: 'exc-posseder', label: '12. posseder — possess- (владеть)', autoForm: 'possess-', rootForm: 'posseder', rootMeaning: 'владеть' },
  { value: 'exc-ceder', label: '13. -ceder — -cess- (часть корня)', autoForm: 'cess-' }
];

const prefixAssimilationOptions = {
  'pre-con': [
    { form: 'col-', note: 'перед l' },
    { form: 'cor-', note: 'перед r' },
    { form: 'com-', note: 'перед p и m' },
    { form: 'co-', note: 'перед гласной и h' },
    { form: 'con-', note: 'без изменения' }
  ],
  'pre-in': [
    { form: 'il-', note: 'перед l' },
    { form: 'ir-', note: 'перед r' },
    { form: 'im-', note: 'перед p и m' },
    { form: 'in-', note: 'без изменения' }
  ],
  'pre-ex': [
    { form: 'em-', note: 'перед m' },
    { form: 'el-', note: 'перед l' },
    { form: 'ex-', note: 'без изменения' }
  ],
  'pre-sub': [
    { form: 'sup-', note: 'перед p' },
    { form: 'su-', note: 'перед s' },
    { form: 'sub-', note: 'без изменения' }
  ],
  'pre-ad': [
    { form: 'at-', note: 'перед t' },
    { form: 'ac-', note: 'перед c' },
    { form: 'an-', note: 'перед n' },
    { form: 'ag-', note: 'перед g' },
    { form: 'al-', note: 'перед l' },
    { form: 'af-', note: 'перед f' },
    { form: 'as-', note: 'перед s' },
    { form: 'ar-', note: 'перед r' },
    { form: 'ad-', note: 'без изменения' }
  ],
  'pre-ob': [
    { form: 'op-', note: 'перед p' },
    { form: 'of-', note: 'перед f' },
    { form: 'ob-', note: 'без изменения' }
  ],
  'pre-dis': [
    { form: 'dif-', note: 'перед f' },
    { form: 'di-', note: 'перед g, l, m, r, v' },
    { form: 'dis-', note: 'без изменения' }
  ],
  'pre-trans': [
    { form: 'tra-', note: 'перед d и j' },
    { form: 'tran-', note: 'перед s' },
    { form: 'trans-', note: 'без изменения' }
  ]
};

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
  saveRootBtn: document.getElementById('saveRootBtn'),
  componentCategorySelect: document.getElementById('componentCategorySelect'),
  componentSelect: document.getElementById('componentSelect'),
  componentMeaningPreview: document.getElementById('componentMeaningPreview'),
  saveComponentBtn: document.getElementById('saveComponentBtn'),
  prefixVariantModal: document.getElementById('prefixVariantModal'),
  prefixVariantSelect: document.getElementById('prefixVariantSelect'),
  prefixVariantPreview: document.getElementById('prefixVariantPreview'),
  savePrefixVariantBtn: document.getElementById('savePrefixVariantBtn'),
  backFromRootBtn: document.getElementById('backFromRootBtn'),
  backFromComponentBtn: document.getElementById('backFromComponentBtn'),
  backFromPrefixVariantBtn: document.getElementById('backFromPrefixVariantBtn')
};

let state = {
  components: []
};

let pendingPrefixItem = null;

const fixedRootAssimilationValues = new Set([
  'exc-seder',
  'exc-mover',
  'exc-venir',
  'exc-sentir',
  'exc-cognoscer',
  'exc-morir',
  'exc-aperir',
  'exc-experir',
  'exc-coverir',
  'exc-presider',
  'exc-friger',
  'exc-posseder'
]);

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

function syncRootFormByAssimilation() {
  const selected = assimilationOptions.find((x) => x.value === els.assimilationSelect.value);
  const lockFormInput = fixedRootAssimilationValues.has(els.assimilationSelect.value);

  if (lockFormInput) {
    els.rootFormInput.value = selected?.rootForm || '';
    els.rootMeaningInput.value = selected?.rootMeaning || '';
  } else {
    if (els.rootFormInput.readOnly) els.rootFormInput.value = '';
    if (els.rootMeaningInput.readOnly) els.rootMeaningInput.value = '';
  }

  els.rootFormInput.readOnly = lockFormInput;
  els.rootMeaningInput.readOnly = lockFormInput;
}

function syncBodyModalState() {
  const hasOpen = [
    els.chooserModal,
    els.rootModal,
    els.componentModal,
    els.prefixVariantModal
  ].some((m) => !m.classList.contains('hidden'));

  document.body.classList.toggle('modal-open', hasOpen);
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  syncBodyModalState();
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  syncBodyModalState();
}

function closeAllModals() {
  [els.chooserModal, els.rootModal, els.componentModal, els.prefixVariantModal].forEach(closeModal);
  pendingPrefixItem = null;
}

function addRootComponent() {
  const form = els.rootFormInput.value.trim();
  const meaning = els.rootMeaningInput.value.trim();
  const assimilation = els.assimilationSelect.value;
  const assimilationLabel = assimilationOptions.find((x) => x.value === assimilation)?.label || '';

  if (!form || !meaning) return;

  state.components.push({
    id: crypto.randomUUID(),
    type: 'root',
    label: 'Первичное корневое слово',
    form,
    meaning,
    assimilation,
    assimilationLabel
  });

  els.rootFormInput.value = '';
  els.rootMeaningInput.value = '';
  els.assimilationSelect.value = 'none';
  els.rootFormInput.readOnly = false;
  els.rootMeaningInput.readOnly = false;

  renderComponents();
  closeAllModals();
}

function openPrefixVariantStep(item) {
  pendingPrefixItem = item;
  els.prefixVariantSelect.innerHTML = '';

  const options = prefixAssimilationOptions[item.id] || [];
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.form;
    option.textContent = `${opt.form} — ${opt.note}`;
    els.prefixVariantSelect.appendChild(option);
  });

  updatePrefixVariantPreview();
  closeModal(els.componentModal);
  openModal(els.prefixVariantModal);
}

function updatePrefixVariantPreview() {
  const item = pendingPrefixItem;
  if (!item) {
    els.prefixVariantPreview.textContent = '—';
    return;
  }

  const form = els.prefixVariantSelect.value;
  const option = (prefixAssimilationOptions[item.id] || []).find((x) => x.form === form);
  els.prefixVariantPreview.textContent = option ? `${item.form} → ${option.form} (${option.note})` : '—';
}

function savePrefixVariant() {
  if (!pendingPrefixItem) return;

  const option = (prefixAssimilationOptions[pendingPrefixItem.id] || []).find((x) => x.form === els.prefixVariantSelect.value);
  if (!option) return;

  state.components.push({
    id: crypto.randomUUID(),
    type: 'component',
    label: 'Приставка',
    form: option.form,
    meaning: pendingPrefixItem.meaning,
    sourceId: pendingPrefixItem.id,
    category: pendingPrefixItem.category,
    baseForm: pendingPrefixItem.form,
    assimilationNote: option.note
  });

  pendingPrefixItem = null;
  renderComponents();
  closeAllModals();
}

function addSelectedComponent() {
  const item = allComponents.find((x) => x.id === els.componentSelect.value);
  if (!item) return;

  if (item.category.startsWith('Приставки') && prefixAssimilationOptions[item.id]) {
    openPrefixVariantStep(item);
    return;
  }

  state.components.push({
    id: crypto.randomUUID(),
    type: 'component',
    label: item.category.endsWith('ы') ? item.category.slice(0, -1) : item.category,
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

function renderAssimilationMeta(item) {
  if (!item.assimilation || item.assimilation === 'none') return '';
  return ` · Ассимиляция: ${item.assimilationLabel}`;
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
        <div class="component-meaning">
          ${escapeHtml(item.meaning)}${item.type === 'root' ? escapeHtml(renderAssimilationMeta(item)) : ''}
          ${item.assimilationNote ? ` · ${escapeHtml(item.assimilationNote)}` : ''}
        </div>
      </div>
      <button class="component-delete" type="button" data-delete-id="${item.id}">×</button>
    </div>
  `).join('');

  els.componentsSummary.textContent = componentSummaryText();

  els.componentsList.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', () => removeComponent(btn.dataset.deleteId));
  });
}

function normalizeText(value) {
  return (value || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function hasValue(value) {
  return normalizeText(value).length > 0;
}

function normalizeSemanticText(text) {
  return (text || '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[.,;:!?()[\]{}"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeDistanceRuleBased(a, b) {
  const normA = normalizeSemanticText(a);
  const normB = normalizeSemanticText(b);

  const setA = new Set(normA.split(' ').filter(Boolean));
  const setB = new Set(normB.split(' ').filter(Boolean));

  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size || 1;

  const similarity = intersection / union;
  const distance = 1 - similarity;

  return {
    method: 'rule_based_jaccard',
    similarity,
    distance,
    intersection,
    union
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
    throw new Error('Both embeddings must be arrays');
  }

  if (vecA.length !== vecB.length) {
    throw new Error('Embedding vectors must have the same length');
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];

    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbedding(text, baseUrl, model) {
  const cleanedBaseUrl = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');

  const response = await fetch(`${cleanedBaseUrl}/api/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      prompt: text
    })
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error('Invalid embedding response from Ollama');
  }

  return data.embedding;
}

async function computeDistanceWithEmbeddings(a, b, options = {}) {
  const baseUrl = (options.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
  const model = options.model || 'qwen3-embedding';

  const [vecA, vecB] = await Promise.all([
    getEmbedding(a, baseUrl, model),
    getEmbedding(b, baseUrl, model)
  ]);

  const similarityRaw = cosineSimilarity(vecA, vecB);
  const similarity = clamp((similarityRaw + 1) / 2, 0, 1);
  const distance = clamp(1 - similarity, 0, 1);

  return {
    provider: 'ollama_embeddings',
    model,
    similarity,
    distance,
    similarityRaw
  };
}

function combineDistances(rule, embedding, weights = {}) {
  if (!embedding) {
    return {
      distance: rule.distance,
      similarity: rule.similarity,
      weights: {
        rule: 1,
        embedding: 0
      }
    };
  }

  const ruleWeight = typeof weights.rule === 'number' ? weights.rule : 0.7;
  const embeddingWeight = typeof weights.embedding === 'number' ? weights.embedding : 0.3;

  const totalWeight = ruleWeight + embeddingWeight;
  const rw = ruleWeight / totalWeight;
  const ew = embeddingWeight / totalWeight;

  const distance = clamp(rw * rule.distance + ew * embedding.distance, 0, 1);
  const similarity = clamp(1 - distance, 0, 1);

  return {
    distance,
    similarity,
    weights: {
      rule: rw,
      embedding: ew
    }
  };
}

async function computeSemanticDistance(a, b, useLLM = false, options = {}) {
  const rule = computeDistanceRuleBased(a, b);

  if (!useLLM) {
    return {
      method: 'rule_only',
      rule,
      embedding: null,
      final: {
        distance: rule.distance,
        similarity: rule.similarity,
        weights: {
          rule: 1,
          embedding: 0
        }
      }
    };
  }

  try {
    const embedding = await computeDistanceWithEmbeddings(a, b, {
      baseUrl: options.baseUrl || 'http://localhost:11434',
      model: options.model || 'qwen3-embedding'
    });

    const final = combineDistances(rule, embedding, {
      rule: 0.7,
      embedding: 0.3
    });

    return {
      method: 'rule_plus_embedding',
      rule,
      embedding,
      final
    };
  } catch (error) {
    return {
      method: 'rule_fallback',
      rule,
      embedding: null,
      final: {
        distance: rule.distance,
        similarity: rule.similarity,
        weights: {
          rule: 1,
          embedding: 0
        }
      },
      error: String(error)
    };
  }
}

function getInput() {
  return {
    regularWord: els.regularWord.value.trim(),
    logicalMeaning: els.logicalMeaning.value.trim(),
    internationalMeaning: els.internationalMeaning.value.trim(),
    naturalisticWord: els.naturalisticWord.value.trim(),
    components: [...state.components],
    useLLM: els.useLlm.checked,
    ollamaUrl: els.ollamaUrl ? els.ollamaUrl.value.trim() : 'http://localhost:11434',
    embeddingModel: els.ollamaModel ? els.ollamaModel.value.trim() : 'qwen3-embedding'
  };
}

async function analyzeByRules(input) {
  const reasons = [];
  let classification = 'undetermined';
  let confidence = 'low';

  if (!input.regularWord) reasons.push('Не задано слово по регулярной модели.');
  if (!input.logicalMeaning) reasons.push('Не задан логический анализ компонентов.');
  if (!input.internationalMeaning) reasons.push('Не задано интернациональное значение эквивалентного деривата.');
  if (!input.naturalisticWord) reasons.push('Не задано слово по натуралистичной модели.');
  if (!input.components.length) reasons.push('Не добавлен анализ компонентов.');

  const enough = input.regularWord && input.logicalMeaning && input.internationalMeaning;

  if (!enough) {
    return {
      classification: 'insufficient_data',
      confidence,
      reasons,
      distanceResult: null
    };
  }

  const distanceResult = await computeSemanticDistance(
    input.logicalMeaning,
    input.internationalMeaning,
    input.useLLM,
    {
      baseUrl: input.ollamaUrl || 'http://localhost:11434',
      model: input.embeddingModel || 'qwen3-embedding'
    }
  );

  const finalDistance = distanceResult.final.distance;
  const sameMeaning = normalizeText(input.logicalMeaning) === normalizeText(input.internationalMeaning);

  if (sameMeaning) {
    classification = 'regular_only';
    confidence = 'high';
    reasons.push('Логическое значение совпадает с интернациональным значением. Разграничение не требуется.');
  } else if (input.naturalisticWord) {
    classification = 'double_meaning_with_modification';
    confidence = finalDistance >= 0.5 ? 'high' : 'medium';
    reasons.push('Логическое значение отличается от интернационального значения.');
    reasons.push('Слово по натуралистичной модели задано.');
  } else {
    classification = 'double_meaning_modification_missing';
    confidence = finalDistance >= 0.5 ? 'medium' : 'low';
    reasons.push('Логическое значение отличается от интернационального значения, но натуралистичная форма не задана.');
  }

  reasons.push(`Rule-based дистанция: ${distanceResult.rule.distance.toFixed(2)}`);
  if (distanceResult.embedding) {
    reasons.push(`Embedding-дистанция: ${distanceResult.embedding.distance.toFixed(2)}`);
  }
  reasons.push(`Итоговая дистанция: ${distanceResult.final.distance.toFixed(2)}`);

  return {
    classification,
    confidence,
    reasons,
    distanceResult
  };
}

function distanceMethodText(distanceResult) {
  if (!distanceResult) {
    return 'Дистанция не рассчитана.';
  }

  if (distanceResult.method === 'rule_only') {
    return 'Используется только rule-based расчёт: сравниваются наборы слов в логическом анализе и в интернациональном значении. Чем меньше общих слов, тем выше дистанция.';
  }

  if (distanceResult.method === 'rule_plus_embedding') {
    return 'Сначала считается rule-based дистанция по пересечению слов. Затем локальная embedding-модель оценивает смысловую близость двух значений. Итоговая дистанция = 0.7 × rule-based + 0.3 × embedding.';
  }

  if (distanceResult.method === 'rule_fallback') {
    return 'Был запрошен embedding-расчёт, но локальная модель недоступна. Использован fallback на rule-based дистанцию.';
  }

  return 'Используется комбинированный расчёт дистанции.';
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

  const distanceResult = result.distanceResult;
  const ruleDistance = distanceResult?.rule?.distance;
  const embeddingDistance = distanceResult?.embedding?.distance;
  const finalDistance = distanceResult?.final?.distance;

  const confidenceRu = {
    high: 'высокая',
    medium: 'средняя',
    low: 'низкая'
  };

  els.result.classList.remove('empty');
  els.result.innerHTML = `
    <div class="badges">
      ${badge(labels[result.classification] || result.classification, types[result.classification] || 'no')}
      ${badge('Уверенность: ' + (confidenceRu[result.confidence] || result.confidence), 'warn')}
      ${typeof finalDistance === 'number' ? badge('Дистанция: ' + finalDistance.toFixed(2), 'warn') : ''}
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

    <div class="result-card" style="margin-top: 10px;">
      <h3>Дистанция</h3>
      <pre>${escapeHtml([
        `Rule-based: ${typeof ruleDistance === 'number' ? ruleDistance.toFixed(2) : '—'}`,
        `Embedding: ${typeof embeddingDistance === 'number' ? embeddingDistance.toFixed(2) : '—'}`,
        `Итоговая: ${typeof finalDistance === 'number' ? finalDistance.toFixed(2) : '—'}`
      ].join('\n'))}</pre>
    </div>

    <div class="result-card" style="margin-top: 10px;">
      <h3>Как считается дистанция</h3>
      <pre>${escapeHtml(distanceMethodText(distanceResult))}</pre>
    </div>

    ${distanceResult?.method === 'rule_fallback' && distanceResult?.error ? `
      <div class="result-card" style="margin-top: 10px;">
        <h3>Локальная модель</h3>
        <pre>${escapeHtml('Fallback: ' + distanceResult.error)}</pre>
      </div>
    ` : ''}

    ${distanceResult?.method === 'rule_plus_embedding' ? `
      <div class="result-card" style="margin-top: 10px;">
        <h3>Локальная модель</h3>
        <pre>${escapeHtml(JSON.stringify({
          provider: distanceResult.embedding.provider,
          model: distanceResult.embedding.model,
          weights: distanceResult.final.weights
        }, null, 2))}</pre>
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

  els.backFromRootBtn.addEventListener('click', () => {
    closeModal(els.rootModal);
    openModal(els.chooserModal);
  });

  els.backFromComponentBtn.addEventListener('click', () => {
    closeModal(els.componentModal);
    openModal(els.chooserModal);
  });

  els.backFromPrefixVariantBtn.addEventListener('click', () => {
    closeModal(els.prefixVariantModal);
    openModal(els.componentModal);
    pendingPrefixItem = null;
  });

  els.componentCategorySelect.addEventListener('change', fillComponentSelect);
  els.componentSelect.addEventListener('change', updateComponentPreview);
  els.assimilationSelect.addEventListener('change', syncRootFormByAssimilation);
  els.prefixVariantSelect.addEventListener('change', updatePrefixVariantPreview);

  els.saveRootBtn.addEventListener('click', addRootComponent);
  els.saveComponentBtn.addEventListener('click', addSelectedComponent);
  els.savePrefixVariantBtn.addEventListener('click', savePrefixVariant);
  els.clearBtn.addEventListener('click', clearAll);

  els.analyzeBtn.addEventListener('click', async () => {
    const input = getInput();
    const result = await analyzeByRules(input);
    renderResult(result, input);
  });

  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', closeAllModals);
  });
}

setupSelects();
attachEvents();
syncRootFormByAssimilation();
renderComponents();
