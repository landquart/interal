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
  { id: 'suf-op', category: 'Суффиксы числительных', form: '-op', meaning: 'собирательное числительное' },
  { id: 'suf-anti', category: 'Суффиксы числительных', form: '-ant/i', meaning: 'образование десятков' },
  { id: 'suf-esmi', category: 'Суффиксы числительных', form: '-esm/i', meaning: 'порядковое числительное' }
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
  { id: 'pre-kilo', category: 'Приставки научные', form: 'kilo-', meaning: 'кило-' },
  { id: 'pre-hecto', category: 'Приставки научные', form: 'hecto-', meaning: 'гекто-' },
  { id: 'pre-nano', category: 'Приставки научные', form: 'nano-', meaning: 'нано-' },
  { id: 'pre-mega', category: 'Приставки научные', form: 'mega-', meaning: 'мега-' }
];

const componentMeaningsEn = {
  'ending-e': 'neutral noun ending; also used in several form variants',
  'ending-a': 'noun ending; also feminine gender for people and animals',
  'ending-o': 'noun ending; also masculine gender for people and animals',
  'ending-i': 'adjective ending; may replace adjective suffixes',
  'suf-er': 'person with a certain quality or occupation; tool, object',
  'suf-or': 'person with a certain quality or occupation; tool, object; after t and s in verbs ending in -er',
  'suf-ilo': 'tool, object',
  'suf-antia': 'noun derived from a verb; usually from verbs ending in -ar and -an',
  'suf-entia': 'noun derived from a verb; from verbs ending in -er, -ir',
  'suf-ari-noun': 'person engaged in or possessing something',
  'suf-astr': 'pejorative attitude toward a person of a certain profession or occupation',
  'suf-aj': 'something made of, consisting of, or having the character of something; collection of things; unit of measurement',
  'suf-ist': 'profession, affiliation with a school, movement, or trend',
  'suf-ism': 'movement in art, science, religion, or social activity, and other abstract concepts and their results',
  'suf-eria': 'place where the given action takes place',
  'suf-oria': 'variant after t and s for -ería in some words',
  'suf-essa': 'feminine gender',
  'suf-anda': 'necessity or obligation to be something; usually from verbs ending in -ar and -an',
  'suf-enda': 'necessity or obligation to be something; after -er and -ir',
  'suf-inda': 'worthiness or deservingness to be something',
  'suf-ede': 'quantity with which something is filled',
  'suf-ina-dim': 'diminutive-affectionate suffix',
  'suf-ia-concept': 'abstract concept; ideology; science',
  'suf-etta': 'diminution, weakening',
  'suf-ona': 'augmentation, largeness',
  'suf-ell': 'young animal, offspring of an animal',
  'suf-ita': 'concrete manifestation of an object, concept, feature, or action',
  'suf-ada': 'prolonged action; from verbs ending in -ar and -an',
  'suf-ida-action': 'prolonged action; from verbs ending in -ir, -er',
  'suf-ura': 'result of an action',
  'suf-ic-person': 'person suffering from a disease or dependent on something',
  'suf-ion': 'process, result of an action',
  'suf-ica': 'body of knowledge, discipline, practice, or activity',
  'suf-arium': 'collection, aggregate',
  'suf-an': 'inhabitant of a city or country, member of a collective; also language name',
  'suf-yer': 'container, receptacle',
  'suf-ache': 'pejorative meaning',
  'suf-id-desc': 'descendant',
  'suf-ese': 'language',
  'suf-ant': 'performer of an action; from verbs ending in -ar',
  'suf-ent': 'performer of an action; from verbs ending in -er',
  'suf-um': 'abstract noun',
  'suf-ment': 'result of an action',
  'suf-ia-country': 'name of a country or province associated with the main nation',
  'suf-oid': 'similar to something',
  'suf-meyt': 'person from the same collective or association',
  'suf-ing': 'occupation, activity',
  'suf-ite': 'group of people',
  'suf-iat': 'social stratum',
  'suf-illio': 'affectionate form, masculine gender',
  'suf-innia': 'affectionate form, feminine gender',
  'suf-esse': 'state, condition',
  'suf-ituda': 'measurable quality',
  'suf-on-particle': 'particle',
  'suf-ane': 'single-chain hydrocarbon',
  'suf-ene': 'hydrocarbon with a double bond',
  'suf-yne': 'hydrocarbon with a triple bond',
  'suf-ol': 'alcohol, phenol; contains an -OH group',
  'suf-ale': 'aldehyde; contains a -CHO group',
  'suf-one': 'ketone; contains a C=O group',
  'suf-oic': 'carboxylic',
  'suf-ide': 'anion, often monatomic',
  'suf-ite-chem': 'anion with fewer oxygens',
  'suf-ate-chem': 'anion with more oxygens',
  'suf-ema': 'minimal unit',
  'suf-plic': 'number multiplied by a certain number of times',
  'suf-yem': 'fractional numeral',
  'suf-op': 'collective numeral',
  'suf-anti': 'formation of tens',
  'suf-esmi': 'ordinal numeral',
  'adj-al': 'relation',
  'adj-ari': 'correspondence to something',
  'adj-ic': 'character, nature',
  'adj-osi': 'presence of something',
  'adj-in': 'origin',
  'adj-aci': 'inclination toward something',
  'adj-esc': 'behavior, manner',
  'adj-ori': 'purpose or mode of action',
  'adj-id': 'possession of a property',
  'adj-il': 'character, typicality, quality',
  'adj-inal': 'adjective suffix',
  'adj-bil': 'possibility; -ábil for words ending in -ar and -an',
  'adj-issim': 'superlative degree',
  'adj-atr': 'resemblance',
  'adj-iv': 'having an ability or property',
  'verb-isa': 'to make into something; to cause to be of a certain kind',
  'verb-ifica': 'to make into something; to cause to be of a certain kind',
  'verb-eskan': 'beginning of an action',
  'pre-des': 'opposite meaning',
  'pre-in': 'opposite meaning; also “in”',
  'pre-re': 'again, anew, re-',
  'pre-de': 'absence of a concept, negation, cancellation, removal',
  'pre-mis': 'wrongly, incorrectly',
  'pre-pre': 'before',
  'pre-post': 'after',
  'pre-ex': 'former; also “out of/from” without a hyphen',
  'pre-dis': 'separation, disconnection; may also express opposite meaning',
  'pre-pra': 'proto-, original, ancestral',
  'pre-proto': 'proto-',
  'pre-fin': 'end of an action',
  'pre-bo': 'kinship resulting from marriage',
  'pre-step': 'kinship resulting from a second marriage',
  'pre-ho': 'at the same time',
  'pre-hyper': 'hyper-, above normal',
  'pre-hypo': 'hypo-, below normal',
  'pre-retro': 'position behind, backward',
  'pre-poly': 'many, much',
  'pre-para': 'deviation from the norm',
  'pre-peri': 'near, around',
  'pre-semi': 'semi-, half-',
  'pre-mi': 'half, semi-',
  'pre-tele': 'at a distance, far',
  'pre-paleo': 'ancient, prehistoric, primitive',
  'pre-meso': 'intermediate, middle',
  'pre-hetero': 'other, different',
  'pre-melo': 'song-related, musical',
  'pre-exo': 'outside, external',
  'pre-atmo': 'vapor, steam',
  'pre-hydro': 'related to water',
  'pre-bi': 'two-, bi-',
  'pre-pro': 'beyond; in favor of something',
  'pre-ob': 'located opposite, against, or nearby',
  'pre-par': 'clear or thorough action',
  'pre-arc': 'arch-, chief-; before e becomes arki-',
  'pre-pseudo': 'pseudo-',
  'pre-pan': 'universal; including all members of a group or all elements',
  'pre-dys': 'bad, painful, abnormal',
  'pre-ab': 'away from',
  'pre-anti': 'anti-, against',
  'pre-auto': 'auto-, self-',
  'pre-omni': 'all-embracing, omniscient',
  'pre-a': 'without, absence; becomes an- before a vowel',
  'pre-meta': 'higher than; surpassing; all-encompassing',
  'pre-neo': 'new',
  'pre-pyro': 'related to fire',
  'pre-multi': 'many-, multi-',
  'pre-mini': 'small, minimal',
  'pre-macro': 'large, long-lasting',
  'pre-mono': 'single, only',
  'pre-di': 'two',
  'pre-tetra': 'four',
  'pre-iso': 'isomer',
  'pre-neo-science': 'another isomer, often branched',
  'pre-kilo': 'kilo-',
  'pre-hecto': 'hecto-',
  'pre-nano': 'nano-',
  'pre-mega': 'mega-'
};

const assimilationRootMeaningsEn = {
  'exc-seder': 'to sit',
  'exc-mover': 'to move',
  'exc-venir': 'to come',
  'exc-sentir': 'to feel',
  'exc-cognoscer': 'to know',
  'exc-morir': 'to die',
  'exc-aperir': 'to open',
  'exc-experir': 'to experience, to try',
  'exc-coverir': 'to cover',
  'exc-presider': 'to preside',
  'exc-friger': 'to be cold, frozen',
  'exc-posseder': 'to possess',
  'exc-merer': 'to measure'
};

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
  { value: 'exc-merer', label: '13. merer — mens- (мерить)', autoForm: 'mens-', rootForm: 'merer', rootMeaning: 'мерить' },
  { value: 'exc-ceder', label: '14. -ceder — -cess- (часть корня)', autoForm: 'cess-' },
  { value: 'exc-verter', label: '15. -verter — -vers- (часть корня)', autoForm: 'vers-' },
  { value: 'exc-mitter', label: '16. -mitter — -miss- (часть корня)', autoForm: 'miss-' }
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
  explanationChain: document.getElementById('explanationChain'),
  componentsList: document.getElementById('componentsList'),
  componentsSummary: document.getElementById('componentsSummary'),
  addComponentBtn: document.getElementById('addComponentBtn'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  clearBtn: document.getElementById('clearBtn'),
  resultPanel: document.getElementById('resultPanel'),
  result: document.getElementById('result'),
  useLlm: document.getElementById('useLlm'),
  ollamaUrl: document.getElementById('ollamaUrl'),
  ollamaModel: document.getElementById('ollamaModel'),
  manualPrompt: document.getElementById('manualPrompt'),
  buildPromptBtn: document.getElementById('buildPromptBtn'),
  copyPromptBtn: document.getElementById('copyPromptBtn'),
  manualEmbeddingResponse: document.getElementById('manualEmbeddingResponse'),
  chooserModal: document.getElementById('chooserModal'),
  rootModal: document.getElementById('rootModal'),
  componentModal: document.getElementById('componentModal'),
  chooseRootBtn: document.getElementById('chooseRootBtn'),
  chooseComponentBtn: document.getElementById('chooseComponentBtn'),
  rootFormInput: document.getElementById('rootFormInput'),
  rootMeaningInput: document.getElementById('rootMeaningInput'),
  assimilationSelect: document.getElementById('assimilationSelect'),
  saveRootBtn: document.getElementById('saveRootBtn'),
  componentSearchInput: document.getElementById('componentSearchInput'),
  componentSearchResults: document.getElementById('componentSearchResults'),
  componentCategorySelect: document.getElementById('componentCategorySelect'),
  componentSelect: document.getElementById('componentSelect'),
  saveComponentBtn: document.getElementById('saveComponentBtn'),
  prefixVariantModal: document.getElementById('prefixVariantModal'),
  prefixVariantSelect: document.getElementById('prefixVariantSelect'),
  savePrefixVariantBtn: document.getElementById('savePrefixVariantBtn'),
  backFromRootBtn: document.getElementById('backFromRootBtn'),
  backFromComponentBtn: document.getElementById('backFromComponentBtn'),
  backFromPrefixVariantBtn: document.getElementById('backFromPrefixVariantBtn')
};

let state = { components: [], lastAnalysis: null };
let activeRunId = 0;
function nextRunId() { activeRunId += 1; return activeRunId; }
function invalidateActiveRuns() { activeRunId += 1; }
function isCurrentRun(runId) { return runId === activeRunId; }
let pendingPrefixItem = null;
let copyPromptHighlightTimer;

const STORAGE_KEY = 'determinator-valentyp-state-v1';

async function performHardReset(message, storageKeys = []) {
  if (window.InteralUI?.hardReloadReset) {
    await window.InteralUI.hardReloadReset({ message, storageKeys });
    return;
  }

  const confirmed = window.confirm(message || 'Сбросить данные?');
  if (!confirmed) return;

  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (
        key.startsWith('interal.pageState:') ||
        storageKeys.includes(key) ||
        key === 'interal_associative_state' ||
        key === 'determinator-valentyp-state-v1'
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch (_) {}

  const url = new URL(window.location.href);
  url.searchParams.delete('s');
  url.searchParams.delete('state');

  if (/state=/.test(url.hash)) {
    url.hash = '';
  }

  const cleanUrl = `${url.pathname}${url.search}${url.hash}`;

  try {
    window.history.replaceState(null, '', cleanUrl);
  } catch (_) {}

  window.location.replace(cleanUrl);

  setTimeout(() => {
    window.location.href = cleanUrl;
  }, 100);
}


function currentLang() {
  return localStorage.getItem('interal.lang') === 'en' ? 'en' : 'ru';
}

const uiText = {
  ru: {
    missingRegular: 'Слово по регулярной модели не заполнено.',
    missingLogical: 'Логический анализ компонентов не заполнен.',
    missingInternational: 'Международное значение эквивалентного деривата не заполнено.',
    missingNaturalistic: 'Слово по натуралистической модели не заполнено.',
    noComponents: 'Компонентный анализ не добавлен.',
    copied: 'Скопировано',
    copyFailed: 'Ошибка копирования',
    copyPrompt: 'Копировать промпт',
    resetConfirm: 'Сбросить введённые данные? Это действие нельзя отменить.',
    fillAndAnalyse: 'Заполните поля и нажмите «Анализировать».',
    deleteComponent: 'Удалить компонент'
  },
  en: {
    missingRegular: 'Regular-model word is missing.',
    missingLogical: 'Logical component analysis is missing.',
    missingInternational: 'International meaning of equivalent derivative is missing.',
    missingNaturalistic: 'Naturalistic-model word is missing.',
    noComponents: 'No component analysis added.',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    copyPrompt: 'Copy prompt',
    resetConfirm: 'Reset entered data? This action cannot be undone.',
    fillAndAnalyse: 'Fill in fields and click “Analyse”.',
    deleteComponent: 'Delete component'
  }
};

const categoryNames = {
  'Окончания': { ru: 'Окончания', en: 'Endings' },
  'Суффиксы существительных': { ru: 'Суффиксы существительных', en: 'Noun suffixes' },
  'Суффиксы научные': { ru: 'Суффиксы научные', en: 'Scientific suffixes' },
  'Суффиксы числительных': { ru: 'Суффиксы числительных', en: 'Numeral suffixes' },
  'Суффиксы прилагательных': { ru: 'Суффиксы прилагательных', en: 'Adjective suffixes' },
  'Суффиксы глаголов': { ru: 'Суффиксы глаголов', en: 'Verb suffixes' },
  'Приставки': { ru: 'Приставки', en: 'Prefixes' },
  'Приставки научные': { ru: 'Приставки научные', en: 'Scientific prefixes' }
};

const assimilationLabelsEn = {
  none: 'No assimilation',
  'add-t': 'Add -t',
  'd-to-s': 'Replace -d with -s',
  'r-to-s': 'Replace -r with -s',
  'consonant-g-to-s': 'Consonant + -g to -s',
  'b-to-pt': 'Replace -b with -pt',
  'vowel-g-to-ct': 'Vowel + -g to -ct',
  'h-to-ct': 'Replace -h with -ct',
  'y-to-ct': 'Replace -y with -ct',
  'se-to-ct': 'Replace -s/e with -ct',
  'xe-to-ct': 'Replace -x/e with -ct',
  'exc-seder': '1. seder — sess- (to sit)',
  'exc-mover': '2. mover — mot- (to move)',
  'exc-venir': '3. venir — vent- (to come)',
  'exc-sentir': '4. sentir — sens- (to feel)',
  'exc-cognoscer': '5. cognoscer — cognit- (to know)',
  'exc-morir': '6. morir — mort- (to die)',
  'exc-aperir': '7. aperir — apert- (to open)',
  'exc-experir': '8. experir — expert- (to experience, to try)',
  'exc-coverir': '9. coverir — covert- (to cover)',
  'exc-presider': '10. presider — presiss- (to preside)',
  'exc-friger': '11. friger — fris- (to be cold, frozen)',
  'exc-posseder': '12. posseder — possess- (to possess)',
  'exc-merer': '13. merer — mens- (to measure)',
  'exc-ceder': '14. -ceder — -cess- (root part)',
  'exc-verter': '15. -verter — -vers- (root part)',
  'exc-mitter': '16. -mitter — -miss- (root part)'
};

const prefixNotesEn = {
  'перед l': 'before l',
  'перед r': 'before r',
  'перед p и m': 'before p and m',
  'перед гласной и h': 'before vowel and h',
  'без изменения': 'unchanged',
  'перед m': 'before m',
  'перед p': 'before p',
  'перед s': 'before s',
  'перед t': 'before t',
  'перед c': 'before c',
  'перед n': 'before n',
  'перед g': 'before g',
  'перед f': 'before f',
  'перед g, l, m, r, v': 'before g, l, m, r, v',
  'перед d и j': 'before d and j'
};

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
  'exc-posseder',
  'exc-merer'
]);

function t(key) {
  const lang = currentLang();
  return (uiText[lang] && uiText[lang][key]) || uiText.ru[key] || key;
}

function localizeCategory(category) {
  const lang = currentLang();
  return categoryNames[category]?.[lang] || category;
}

function localizeAssimilationLabel(option) {
  if (!option) return '';
  return currentLang() === 'en' ? assimilationLabelsEn[option.value] || option.value : option.label;
}

function localizeRootMeaningByAssimilation(value, fallback) {
  if (currentLang() !== 'en') return fallback || '';
  return assimilationRootMeaningsEn[value] || fallback || '';
}

function localizeMeaningByItem(item) {
  if (!item) return '';
  return currentLang() === 'en' ? componentMeaningsEn[item.id] || item.meaning : item.meaning;
}

function localizeComponentText(item) {
  return `${item.form} — ${localizeMeaningByItem(item)}`;
}

function localizePrefixNote(note) {
  return currentLang() === 'en' ? prefixNotesEn[note] || note : note;
}

function getComponentSource(item) {
  return allComponents.find((x) => x.id === item.sourceId) || allComponents.find((x) => x.id === item.id);
}

function getLocalizedComponentLabel(item) {
  if (item.type === 'root') return currentLang() === 'en' ? 'Primary root word' : 'Основной корень';
  const source = getComponentSource(item);
  return localizeCategory(source?.category || item.category || item.label || '');
}

function getLocalizedComponentMeaning(item) {
  if (item.type === 'root') {
    return localizeRootMeaningByAssimilation(item.assimilation, item.meaning);
  }
  const source = getComponentSource(item);
  return source ? localizeMeaningByItem(source) : item.meaning;
}

function getLocalizedAssimilationLabelByValue(value, fallback = '') {
  const option = assimilationOptions.find((x) => x.value === value);
  return option ? localizeAssimilationLabel(option) : fallback;
}

function getLocalizedAssimilationNote(item) {
  if (!item.assimilationNoteRaw && !item.assimilationNote) return '';
  return localizePrefixNote(item.assimilationNoteRaw || item.assimilationNote);
}

function setupSelects() {
  assimilationOptions.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = localizeAssimilationLabel(opt);
    els.assimilationSelect.appendChild(option);
  });

  Object.keys(byCategory).forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = localizeCategory(category);
    els.componentCategorySelect.appendChild(option);
  });

  fillComponentSelect();
  window.initCustomSelects?.();
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[‐-‒–—−]/g, '-')
    .replace(/[«»"']/g, '')
    .replace(/[.,;:!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactAffixText(value) {
  return normalizeSearchText(value)
    .replace(/^[-]+/, '')
    .replace(/[\/\\\s._-]+/g, '');
}

function componentSearchFields(item) {
  const localizedMeaning = localizeMeaningByItem(item);
  const englishMeaning = componentMeaningsEn[item.id] || '';
  const categoryRu = item.category || '';
  const categoryLocalized = localizeCategory(item.category);
  const form = item.form || '';

  return {
    form,
    formNoDash: form.replace(/^[-–—]+/, ''),
    formCompact: compactAffixText(form),
    categoryRu,
    categoryLocalized,
    localizedMeaning,
    englishMeaning,
    id: item.id
  };
}

function scoreComponentSearch(item, rawQuery) {
  const query = normalizeSearchText(rawQuery);
  const queryCompact = compactAffixText(rawQuery);

  if (!query && !queryCompact) return 0;

  const f = componentSearchFields(item);

  const formNorm = normalizeSearchText(f.form);
  const formNoDashNorm = normalizeSearchText(f.formNoDash);
  const formCompact = f.formCompact;

  const text = normalizeSearchText([
    f.form,
    f.formNoDash,
    f.formCompact,
    f.localizedMeaning,
    f.englishMeaning,
    f.categoryRu,
    f.categoryLocalized,
    f.id
  ].filter(Boolean).join(' '));

  const compactText = compactAffixText([
    f.form,
    f.formNoDash,
    f.formCompact
  ].filter(Boolean).join(' '));

  const tokens = query.split(' ').filter(Boolean);

  let score = 0;

  if (formNorm === query) score += 120;
  if (formNoDashNorm === query) score += 110;
  if (formCompact === queryCompact) score += 105;

  if (formNorm.startsWith(query)) score += 80;
  if (formNoDashNorm.startsWith(query)) score += 75;
  if (formCompact.startsWith(queryCompact)) score += 70;

  if (text.includes(query)) score += 40;
  if (queryCompact && compactText.includes(queryCompact)) score += 38;

  if (tokens.length) {
    const allTokensMatch = tokens.every((token) => text.includes(token) || compactText.includes(token));
    const tokenMatches = tokens.filter((token) => text.includes(token) || compactText.includes(token)).length;

    if (!allTokensMatch && score === 0) return 0;

    score += tokenMatches * 12;
    if (allTokensMatch) score += 20;
  }

  return score;
}

function selectComponentById(componentId, options = {}) {
  const item = allComponents.find((x) => x.id === componentId);
  if (!item) return;

  els.componentCategorySelect.value = item.category;
  fillComponentSelect({ keepSearch: true, selectedId: item.id });
  els.componentSelect.value = item.id;
  els.componentSelect.dispatchEvent(new Event('change', { bubbles: true }));

  if (options.clearSearch && els.componentSearchInput) {
    els.componentSearchInput.value = '';
    renderComponentSearchResults();
  } else {
    renderComponentSearchResults();
  }

  window.initCustomSelects?.();
}

function renderComponentSearchResults() {
  if (!els.componentSearchInput || !els.componentSearchResults) return;

  const query = els.componentSearchInput.value.trim();
  els.componentSearchResults.innerHTML = '';

  if (!query) {
    els.componentSearchResults.classList.remove('has-results');
    return;
  }

  const matches = allComponents
    .map((item) => ({
      item,
      score: scoreComponentSearch(item, query)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  els.componentSearchResults.classList.add('has-results');

  if (!matches.length) {
    const empty = document.createElement('div');
    empty.className = 'component-search-empty';
    empty.textContent = currentLang() === 'en'
      ? 'No components found. Try without hyphen, slash or by meaning.'
      : 'Компоненты не найдены. Попробуйте без дефиса, без / или по значению.';
    els.componentSearchResults.appendChild(empty);
    return;
  }

  matches.forEach(({ item }) => {
    const isSelected = els.componentSelect.value === item.id;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `component-search-option${isSelected ? ' is-selected' : ''}`;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(isSelected));
    button.dataset.componentId = item.id;

    button.innerHTML = `
      <span class="component-search-form">${escapeHtml(item.form)}</span>
      <span class="component-search-category">${escapeHtml(localizeCategory(item.category))}</span>
      <span class="component-search-meaning">${escapeHtml(localizeMeaningByItem(item))}</span>
    `;

    els.componentSearchResults.appendChild(button);
  });
}

function fillComponentSelect(options = {}) {
  const { keepSearch = false, selectedId = '' } = options;
  const category = els.componentCategorySelect.value || Object.keys(byCategory)[0];
  const items = byCategory[category] || [];
  els.componentSelect.innerHTML = '';

  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = localizeComponentText(item);
    els.componentSelect.appendChild(option);
  });

  if (selectedId) els.componentSelect.value = selectedId;
  updateComponentPreview();
  els.componentSelect.dispatchEvent(new Event('change', { bubbles: true }));
  if (!keepSearch) renderComponentSearchResults();
  window.initCustomSelects?.();
}

function updateComponentPreview() {
  // Preview removed: select option already includes full component text.
}

function syncRootFormByAssimilation() {
  const selected = assimilationOptions.find((x) => x.value === els.assimilationSelect.value);
  const lockFormInput = fixedRootAssimilationValues.has(els.assimilationSelect.value);

  if (lockFormInput) {
    els.rootFormInput.value = selected?.rootForm || '';
    els.rootMeaningInput.value = localizeRootMeaningByAssimilation(selected?.value, selected?.rootMeaning || '');
  } else {
    if (els.rootFormInput.readOnly) els.rootFormInput.value = '';
    if (els.rootMeaningInput.readOnly) els.rootMeaningInput.value = '';
  }

  els.rootFormInput.readOnly = lockFormInput;
  els.rootMeaningInput.readOnly = lockFormInput;
}

function syncBodyModalState() {
  const hasOpen = [els.chooserModal, els.rootModal, els.componentModal, els.prefixVariantModal]
    .some((m) => !m.classList.contains('hidden'));
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
  const assimilation = els.assimilationSelect.value;
  const selected = assimilationOptions.find((x) => x.value === assimilation);
  const rawMeaning = fixedRootAssimilationValues.has(assimilation)
    ? selected?.rootMeaning || ''
    : els.rootMeaningInput.value.trim();

  if (!form || !rawMeaning) return;

  state.components.push({
    id: crypto.randomUUID(),
    type: 'root',
    label: 'root',
    form,
    meaning: rawMeaning,
    assimilation
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
    option.textContent = `${opt.form} — ${localizePrefixNote(opt.note)}`;
    els.prefixVariantSelect.appendChild(option);
  });

  updatePrefixVariantPreview();
  window.initCustomSelects?.();
  closeModal(els.componentModal);
  openModal(els.prefixVariantModal);
}

function updatePrefixVariantPreview() {
  const item = pendingPrefixItem;
  if (!item) {
    return;
  }

  const form = els.prefixVariantSelect.value;
  const option = (prefixAssimilationOptions[item.id] || []).find((x) => x.form === form);
  const note = option ? localizePrefixNote(option.note) : '';
}

function savePrefixVariant() {
  if (!pendingPrefixItem) return;

  const option = (prefixAssimilationOptions[pendingPrefixItem.id] || [])
    .find((x) => x.form === els.prefixVariantSelect.value);
  if (!option) return;

  state.components.push({
    id: crypto.randomUUID(),
    type: 'component',
    label: pendingPrefixItem.category,
    form: option.form,
    meaning: pendingPrefixItem.meaning,
    sourceId: pendingPrefixItem.id,
    category: pendingPrefixItem.category,
    baseForm: pendingPrefixItem.form,
    assimilationNoteRaw: option.note
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
    label: item.category,
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
  const label = getLocalizedAssimilationLabelByValue(item.assimilation, item.assimilationLabel);
  return currentLang() === 'en' ? ` · Assimilation: ${label}` : ` · Ассимиляция: ${label}`;
}

function renderComponents() {
  if (!state.components.length) {
    els.componentsList.className = 'components-list empty';
    els.componentsList.textContent = t('noComponents');
    els.componentsSummary.textContent = '—';
    syncClearButtonVisibility();
    saveState();
    return;
  }

  els.componentsList.className = 'components-list';
  els.componentsList.innerHTML = state.components.map((item) => {
    const note = getLocalizedAssimilationNote(item);
    const deleteLabel = t('deleteComponent');
    return `
      <div class="component-item">
        <div class="component-main">
          <div class="component-title">${escapeHtml(item.form)}</div>
          <div class="component-meta">${escapeHtml(getLocalizedComponentLabel(item))}</div>
          <div class="component-meaning">
            ${escapeHtml(getLocalizedComponentMeaning(item))}${item.type === 'root' ? escapeHtml(renderAssimilationMeta(item)) : ''}
            ${note ? ` · ${escapeHtml(note)}` : ''}
          </div>
        </div>
        <button class="component-delete" type="button" data-delete-id="${item.id}" aria-label="${escapeHtml(deleteLabel)}"><img src="../elements/Eraser%20Square.svg" alt="" aria-hidden="true" /></button>
      </div>
    `;
  }).join('');

  els.componentsSummary.textContent = componentSummaryText();

  els.componentsList.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', () => removeComponent(btn.dataset.deleteId));
  });

  syncClearButtonVisibility();
  saveState();
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
  return { method: 'rule_based_jaccard', similarity, distance, intersection, union };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}


const preceZones = [
  {
    id: 'full_compositionality',
    ru: 'Полная композиционность',
    en: 'Full compositionality',
    range: { P: [4, 4], R: [4, 4], C: [0, 0], E: [0, 0] }
  },
  {
    id: 'full_partial_compositionality',
    ru: 'Полная — частичная композиционность',
    en: 'Full — partial compositionality',
    range: { P: [4, 4], R: [4, 4], C: [0, 1], E: [0, 0] }
  },
  {
    id: 'partial_compositionality',
    ru: 'Частичная композиционность',
    en: 'Partial compositionality',
    range: { P: [3, 4], R: [4, 4], C: [1, 1], E: [0, 1] }
  },
  {
    id: 'partial_semantic_extension',
    ru: 'Частичная композиционность — семантическое расширение',
    en: 'Partial compositionality — semantic extension',
    range: { P: [3, 3], R: [3, 4], C: [1, 2], E: [0, 1] }
  },
  {
    id: 'semantic_extension',
    ru: 'Семантическое расширение',
    en: 'Semantic extension',
    range: { P: [2, 3], R: [3, 4], C: [1, 2], E: [0, 2] }
  },
  {
    id: 'semantic_extension_transfer',
    ru: 'Семантическое расширение — перенос',
    en: 'Semantic extension — transfer',
    range: { P: [2, 2], R: [3, 3], C: [2, 2], E: [1, 2] }
  },
  {
    id: 'transfer',
    ru: 'Перенос',
    en: 'Transfer',
    range: { P: [1, 2], R: [2, 4], C: [2, 3], E: [0, 2] }
  },
  {
    id: 'transfer_semantic_conventionalization',
    ru: 'Перенос — семантическая конвенционализация',
    en: 'Transfer — semantic conventionalization',
    range: { P: [1, 1], R: [2, 3], C: [3, 3], E: [2, 3] }
  },
  {
    id: 'semantic_conventionalization',
    ru: 'Семантическая конвенционализация',
    en: 'Semantic conventionalization',
    range: { P: [0, 1], R: [1, 3], C: [3, 4], E: [3, 4] }
  },
  {
    id: 'semantic_conventionalization_lexicalization',
    ru: 'Семантическая конвенционализация — лексикализованность',
    en: 'Semantic conventionalization — lexicalization',
    range: { P: [0, 0], R: [1, 1], C: [4, 5], E: [4, 4] }
  },
  {
    id: 'lexicalization',
    ru: 'Лексикализованность',
    en: 'Lexicalization',
    range: { P: [0, 0], R: [0, 1], C: [5, 5], E: null }
  }
];

function clampScore(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.round(n), min), max);
}

function extractJsonFromText(text) {
  const source = String(text || '').trim();
  if (!source) throw new Error('Empty response');
  try { return JSON.parse(source); } catch (_error) {}
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch (_error) {}
  }
  const first = source.indexOf('{');
  const last = source.lastIndexOf('}');
  if (first >= 0 && last > first) return JSON.parse(source.slice(first, last + 1));
  throw new Error('Could not extract JSON');
}

function normalizeAiResult(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    chain: Array.isArray(data.chain) ? data.chain.map(String).filter(Boolean) : [],
    chain_type: String(data.chain_type || 'semantic_extension'),
    P: clampScore(data.P, 0, 4),
    R: clampScore(data.R, 0, 4),
    C: clampScore(data.C, 0, 5),
    E: data.E === null ? null : clampScore(data.E, 0, 4),
    zone_hint: String(data.zone_hint || ''),
    confidence: clamp(Number(data.confidence) || 0.5, 0, 1),
    explanation: String(data.explanation || ''),
    analogies_used: Array.isArray(data.analogies_used) ? data.analogies_used.map(String).filter(Boolean) : []
  };
}

function distanceToRange(value, range) {
  if (range === null) return 0;
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 1;
  if (value < range[0]) return range[0] - value;
  if (value > range[1]) return value - range[1];
  return 0;
}

function distanceToZone(scores, zone) {
  return ['P', 'R', 'C', 'E'].reduce((sum, key) => sum + distanceToRange(scores[key], zone.range[key]), 0);
}

function zoneSpecificity(zone) {
  return ['P', 'R', 'C', 'E'].reduce((sum, key) => {
    const range = zone.range[key];
    return sum + (range === null ? 10 : range[1] - range[0]);
  }, 0);
}

function getBorderlineZones(scores) {
  const distances = preceZones
    .map((zone) => ({ zone, distance: distanceToZone(scores, zone) }))
    .sort((a, b) => a.distance - b.distance || zoneSpecificity(a.zone) - zoneSpecificity(b.zone));
  const best = distances[0]?.distance ?? 0;
  return distances
    .filter((item) => item.distance > best && item.distance <= best + 1)
    .slice(0, 3)
    .map((item) => ({ zone_id: item.zone.id, zone_ru: item.zone.ru, zone_en: item.zone.en, distance: item.distance }));
}

function classifyByPRECE(scores) {
  const normalizedScores = {
    P: clampScore(scores.P, 0, 4),
    R: clampScore(scores.R, 0, 4),
    C: clampScore(scores.C, 0, 5),
    E: scores.E === null ? null : clampScore(scores.E, 0, 4)
  };
  const distances = preceZones
    .map((zone) => ({ zone, distance: distanceToZone(normalizedScores, zone) }))
    .sort((a, b) => a.distance - b.distance || zoneSpecificity(a.zone) - zoneSpecificity(b.zone));
  const selected = distances[0].zone;
  const selectedDistance = distances[0].distance;
  const borderline_zones = getBorderlineZones(normalizedScores).filter((item) => item.zone_id !== selected.id);
  const confidence = selectedDistance === 0 && borderline_zones.length === 0 ? 'high' : selectedDistance <= 1 ? 'medium' : 'low';
  return {
    zone_id: selected.id,
    zone_ru: selected.ru,
    zone_en: selected.en,
    scores: normalizedScores,
    confidence,
    borderline_zones,
    warnings: []
  };
}

function buildFormRecommendation(zone, input) {
  const noSeparateMarking = [
    'full_compositionality',
    'full_partial_compositionality',
    'partial_compositionality'
  ];

  const optionalMarking = [
    'partial_semantic_extension'
  ];

  const natural = input.naturalisticWord || 'натуралистическая форма';
  const regular = input.regularWord || 'регулярная форма';

  if (noSeparateMarking.includes(zone.zone_id)) {
    return {
      strategy: 'regular_form_usually_enough',
      text: `Обычно достаточно логической/регулярной формы: ${regular}. Отдельная интернациональная маркировка не обязательна.`
    };
  }

  if (optionalMarking.includes(zone.zone_id)) {
    return {
      strategy: 'borderline_marking_optional',
      text: `Случай пограничный. Можно оставить логическую/регулярную форму: ${regular}, но если интернациональное значение закреплено отдельно, допустима отдельная маркировка: ${natural}.`
    };
  }

  return {
    strategy: 'separate_international_marking_recommended',
    text: `Рекомендуется отдельная интернациональная маркировка: для существительного — -u (${natural}), для интернациональных прилагательных — -al/-ari/-ic, для логических прилагательных — -i; глаголы с интернациональным значением сохраняют консервативный корень, а логические — изменённую корневую основу, если она есть.`
  };
}

function shouldWarn(result) {
  const warnings = [];
  if (!result?.ai?.chain?.length) warnings.push('Модель не вернула объяснительную цепочку. Можно выставить P/R/C/E вручную.');
  if (result?.ai?.zone_hint && result?.computed?.zone_ru && !result.ai.zone_hint.toLowerCase().includes(result.computed.zone_ru.toLowerCase())) {
    warnings.push('Подсказка модели по зоне отличается от расчёта P/R/C/E; итоговая зона пересчитана кодом.');
  }
  if (result?.ai?.chain_type === 'lexicalized_no_working_chain' && result?.computed?.zone_id !== 'lexicalization') {
    warnings.push('Тип цепочки похож на лексикализацию, но оценки P/R/C/E попали в другую зону.');
  }
  return warnings;
}

function recomputeResultFromManualScores(scores) {
  if (!state.lastAnalysis) return;
  const computed = classifyByPRECE(scores);
  computed.formRecommendation = buildFormRecommendation(computed, getInput());
  const next = {
    ...state.lastAnalysis,
    ai: { ...state.lastAnalysis.ai, ...computed.scores },
    computed
  };
  next.computed.warnings = shouldWarn(next);
  state.lastAnalysis = next;
  renderResult(next, getInput());
  saveState();
}

function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) throw new Error('Both embeddings must be arrays');
  if (vecA.length !== vecB.length) throw new Error('Embedding vectors must have the same length');

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

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbedding(text, baseUrl, model) {
  const cleanedBaseUrl = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
  const parseResponseError = async (response) => {
    let details = '';
    try {
      const textBody = await response.text();
      details = textBody ? ` — ${textBody.slice(0, 200)}` : '';
    } catch (_error) {
      details = '';
    }
    return `Embedding request failed: ${response.status} ${response.statusText}${details}`;
  };

  const response = await fetch(`${cleanedBaseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text })
  });

  if (response.ok) {
    const data = await response.json();
    const vector = data?.embeddings?.[0];
    if (!Array.isArray(vector)) throw new Error('Invalid embedding response from Ollama /api/embed');
    return vector;
  }

  if (response.status !== 404) throw new Error(await parseResponseError(response));

  const legacyResponse = await fetch(`${cleanedBaseUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text })
  });

  if (!legacyResponse.ok) throw new Error(await parseResponseError(legacyResponse));

  const legacyData = await legacyResponse.json();
  if (!legacyData.embedding || !Array.isArray(legacyData.embedding)) {
    throw new Error('Invalid embedding response from Ollama /api/embeddings');
  }
  return legacyData.embedding;
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
  return { provider: 'ollama_embeddings', model, similarity, distance, similarityRaw };
}

function combineDistances(rule, embedding, weights = {}) {
  if (!embedding) {
    return { distance: rule.distance, similarity: rule.similarity, weights: { rule: 1, embedding: 0 } };
  }

  const ruleWeight = typeof weights.rule === 'number' ? weights.rule : 0.7;
  const embeddingWeight = typeof weights.embedding === 'number' ? weights.embedding : 0.3;
  const totalWeight = ruleWeight + embeddingWeight;
  const rw = ruleWeight / totalWeight;
  const ew = embeddingWeight / totalWeight;
  const distance = clamp(rw * rule.distance + ew * embedding.distance, 0, 1);
  const similarity = clamp(1 - distance, 0, 1);
  return { distance, similarity, weights: { rule: rw, embedding: ew } };
}

function parseManualEmbeddingResponse(raw) {
  const text = (raw || '').trim();
  if (!text) return null;

  const tryParseJson = () => {
    try { return JSON.parse(text); } catch (_error) { return null; }
  };

  const parsed = tryParseJson();
  let similarity;
  let distance;
  let reason = '';

  if (parsed && typeof parsed === 'object') {
    if (typeof parsed.similarity === 'number') similarity = parsed.similarity;
    if (typeof parsed.distance === 'number') distance = parsed.distance;
    if (typeof parsed.reason === 'string') reason = parsed.reason;
  }

  if (typeof similarity !== 'number') {
    const similarityMatch = text.match(/similarity["'\s:=]+(-?\d+(?:\.\d+)?)/i)
      || text.match(/схожесть["'\s:=]+(-?\d+(?:\.\d+)?)/i);
    if (similarityMatch) similarity = Number(similarityMatch[1]);
  }

  if (typeof distance !== 'number') {
    const distanceMatch = text.match(/distance["'\s:=]+(-?\d+(?:\.\d+)?)/i)
      || text.match(/дистанц(?:ия|ию|ии)["'\s:=]+(-?\d+(?:\.\d+)?)/i);
    if (distanceMatch) distance = Number(distanceMatch[1]);
  }

  if (typeof similarity !== 'number' && typeof distance !== 'number') {
    const generic = text.match(/-?\d+(?:\.\d+)?/g) || [];
    if (generic.length) {
      const value = Number(generic[0]);
      if (!Number.isNaN(value)) distance = value;
    }
  }

  if (typeof similarity === 'number' && similarity > 1 && similarity <= 100) similarity /= 100;
  if (typeof distance === 'number' && distance > 1 && distance <= 100) distance /= 100;
  if (typeof distance === 'number' && typeof similarity !== 'number') similarity = 1 - distance;
  if (typeof similarity === 'number' && typeof distance !== 'number') distance = 1 - similarity;

  if (typeof similarity !== 'number' || typeof distance !== 'number') {
    throw new Error('Could not extract distance/similarity from neural model response.');
  }

  return {
    provider: 'manual_embedding',
    model: 'external_llm',
    similarity: clamp(similarity, 0, 1),
    distance: clamp(distance, 0, 1),
    reason
  };
}

function buildManualPrompt(input) {
  return [
    'You are a linguistic assistant. Estimate semantic distance between two meaning formulations.',
    '',
    'Task context:',
    '- Determine value type in Determinator of valen typ.',
    '- The app computes final score as Rule-based + embedding estimate.',
    '- Your part: provide embedding-like meaning similarity from 0 to 1.',
    '',
    `Logical analysis: "${input.logicalMeaning || '—'}"`,
    `International meaning: "${input.internationalMeaning || '—'}"`,
    '',
    'Response requirements:',
    '1) Respond with exactly one JSON object without Markdown.',
    '2) Format:',
    '{"distance":0.00,"similarity":0.00,"reason":"краткое пояснение"}',
    '3) distance = 0 means almost same meaning, distance = 1 means very far.',
    '4) similarity = 1 - distance.',
    '5) Use decimal numbers with precision to two digits.',
    '',
    'Return JSON only.'
  ].join('\n');
}

async function computeSemanticDistance(a, b, useLLM = false, options = {}) {
  const rule = computeDistanceRuleBased(a, b);
  let manualEmbedding = null;
  let manualEmbeddingError = '';

  try {
    manualEmbedding = parseManualEmbeddingResponse(options.manualEmbeddingResponse || '');
  } catch (error) {
    manualEmbeddingError = String(error);
  }

  if (manualEmbedding) {
    const final = combineDistances(rule, manualEmbedding, { rule: 0.7, embedding: 0.3 });
    return { method: 'rule_plus_manual_embedding', rule, embedding: manualEmbedding, final, manualEmbeddingError: '' };
  }

  if (!useLLM) {
    return {
      method: 'rule_only',
      rule,
      embedding: null,
      final: { distance: rule.distance, similarity: rule.similarity, weights: { rule: 1, embedding: 0 } },
      manualEmbeddingError
    };
  }

  try {
    const embedding = await computeDistanceWithEmbeddings(a, b, {
      baseUrl: options.baseUrl || 'http://localhost:11434',
      model: options.model || 'qwen3-embedding'
    });
    const final = combineDistances(rule, embedding, { rule: 0.7, embedding: 0.3 });
    return { method: 'rule_plus_embedding', rule, embedding, final };
  } catch (error) {
    return {
      method: 'rule_fallback',
      rule,
      embedding: null,
      final: { distance: rule.distance, similarity: rule.similarity, weights: { rule: 1, embedding: 0 } },
      error: currentLang() === 'en'
        ? 'Local model unavailable. Used only Rule-based calculation.'
        : 'Локальная модель недоступна. Использован только расчёт по правилам.',
      debugError: String(error),
      manualEmbeddingError
    };
  }
}

function getInput() {
  return {
    regularWord: els.regularWord.value.trim(),
    logicalMeaning: els.logicalMeaning.value.trim(),
    internationalMeaning: els.internationalMeaning.value.trim(),
    naturalisticWord: els.naturalisticWord.value.trim(),
    explanationChain: els.explanationChain ? els.explanationChain.value.trim() : '',
    components: [...state.components],
    useLLM: els.useLlm.checked,
    ollamaUrl: els.ollamaUrl ? els.ollamaUrl.value.trim() : 'http://localhost:11434',
    embeddingModel: els.ollamaModel ? els.ollamaModel.value.trim() : 'qwen3-embedding',
    manualEmbeddingResponse: els.manualEmbeddingResponse ? els.manualEmbeddingResponse.value.trim() : ''
  };
}


async function analyzeByRules(input, runId) {
  if (!input.logicalMeaning || !input.internationalMeaning) {
    return {
      ok: false,
      error: 'insufficient_data',
      details: 'Заполните логическое и международное значение. Ручной блок P/R/C/E доступен ниже.',
      computed: classifyByPRECE({ P: 2, R: 3, C: 2, E: 1 }),
      ai: normalizeAiResult({ chain: [], P: 2, R: 3, C: 2, E: 1, confidence: 0.3 }),
      retrieval: { examples_used: [] }
    };
  }

  const response = await fetch('/api/determine-valen-type', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      regularWord: input.regularWord,
      naturalisticWord: input.naturalisticWord,
      logicalMeaning: input.logicalMeaning,
      internationalMeaning: input.internationalMeaning,
      explanationChain: input.explanationChain,
      components: input.components,
      manualScores: null
    })
  });

  if (!isCurrentRun(runId)) return null;

  let data;
  const text = await response.text();
  if (!isCurrentRun(runId)) return null;
  try {
    data = extractJsonFromText(text);
  } catch (_error) {
    data = { ok: false, error: 'invalid_response', details: text.slice(0, 500) };
  }

  if (!response.ok || data.ok === false) {
    const fallbackScores = state.lastAnalysis?.computed?.scores || { P: 2, R: 3, C: 2, E: 1 };
    const computed = classifyByPRECE(fallbackScores);
    computed.formRecommendation = buildFormRecommendation(computed, input);
    computed.warnings = [
      'API недоступен или вернул ошибку. Можно вручную выставить P/R/C/E ниже — зона пересчитается локально без нового запроса.',
      String(data.details || data.error || response.statusText || 'Unknown error')
    ];
    return {
      ok: false,
      error: data.error || 'api_error',
      details: data.details || response.statusText,
      ai: normalizeAiResult({ ...fallbackScores, chain: [], confidence: 0.2 }),
      computed,
      retrieval: { examples_used: [] }
    };
  }

  if (!data.computed.formRecommendation) data.computed.formRecommendation = buildFormRecommendation(data.computed, input);
  data.computed.warnings = Array.isArray(data.computed.warnings) ? data.computed.warnings : shouldWarn(data);
  return data;
}

function badge(text, type = '') {
  return `<span class="badge ${type}">${escapeHtml(text)}</span>`;
}


function renderResult(result, input) {
  els.resultPanel.hidden = false;
  const isEn = currentLang() === 'en';
  const computed = result.computed || classifyByPRECE(result.ai || { P: 2, R: 3, C: 2, E: 1 });
  const ai = normalizeAiResult(result.ai || computed.scores || {});
  const confidenceLabels = { high: isEn ? 'high' : 'высокая', medium: isEn ? 'medium' : 'средняя', low: isEn ? 'low' : 'низкая' };
  const zoneName = isEn ? computed.zone_en : computed.zone_ru;
  const formRecommendation = computed.formRecommendation || buildFormRecommendation(computed, input);
  const warnings = Array.isArray(computed.warnings) ? computed.warnings : [];
  const examples = result.retrieval?.examples_used || [];
  const chain = ai.chain.length ? ai.chain : (input.explanationChain ? input.explanationChain.split(/\s*→\s*/).filter(Boolean) : []);

  state.lastAnalysis = result;
  els.result.classList.remove('empty');
  els.result.innerHTML = `
    <div class="badges">
      ${badge(zoneName, computed.zone_id === 'semantic_conventionalization' || computed.zone_id === 'lexicalization' ? 'warn' : 'ok')}
      ${badge((isEn ? 'Confidence: ' : 'Уверенность: ') + (confidenceLabels[computed.confidence] || computed.confidence), 'warn')}
      ${result.ok === false ? badge(isEn ? 'API error / manual mode' : 'Ошибка API / ручной режим', 'no') : ''}
    </div>

    <div class="result-grid">
      <div class="result-card">
        <h3>${isEn ? 'Spectrum zone' : 'Зона спектра'}</h3>
        <pre>${escapeHtml(zoneName)}\n${escapeHtml(computed.zone_id)}</pre>
      </div>
      <div class="result-card">
        <h3>P/R/C/E</h3>
        <div class="score-grid" data-score-editor="true">
          ${['P', 'R', 'C', 'E'].map((key) => `
            <label class="score-field">
              <span>${key}</span>
              <input type="number" min="0" max="${key === 'C' ? 5 : 4}" step="1" value="${escapeHtml(computed.scores[key] ?? '')}" data-score-key="${key}" />
            </label>
          `).join('')}
        </div>
        <p class="result-hint">${isEn ? 'Edit scores to recalculate the zone locally.' : 'Измените оценки, чтобы пересчитать зону локально без API.'}</p>
      </div>
      <div class="result-card">
        <h3>${isEn ? 'Chain type' : 'Тип цепочки'}</h3>
        <pre>${escapeHtml(ai.chain_type || '—')}</pre>
      </div>
      <div class="result-card">
        <h3>${isEn ? 'AI confidence' : 'Уверенность модели'}</h3>
        <pre>${escapeHtml(Math.round((ai.confidence || 0) * 100))}%</pre>
      </div>
    </div>

    <div class="result-card">
      <h3>${isEn ? 'Explanatory chain' : 'Объяснительная цепочка'}</h3>
      <ol class="chain-list">${chain.length ? chain.map((step) => `<li>${escapeHtml(step)}</li>`).join('') : '<li>—</li>'}</ol>
    </div>

    <div class="result-card">
      <h3>${isEn ? 'Explanation' : 'Обоснование'}</h3>
      <pre>${escapeHtml(ai.explanation || result.details || '—')}</pre>
    </div>

    <div class="result-grid">
      <div class="result-card">
        <h3>${isEn ? 'Analogies used' : 'Использованные аналогии'}</h3>
        <pre>${escapeHtml((ai.analogies_used && ai.analogies_used.length ? ai.analogies_used : examples.map((ex) => ex.word)).join('\n') || '—')}</pre>
      </div>
      <div class="result-card">
        <h3>${isEn ? 'Borderline zones' : 'Граничные зоны'}</h3>
        <pre>${escapeHtml((computed.borderline_zones || []).map((zone) => `${isEn ? zone.zone_en : zone.zone_ru} (${zone.zone_id})`).join('\n') || '—')}</pre>
      </div>
      <div class="result-card">
        <h3>${isEn ? 'Warnings' : 'Предупреждения'}</h3>
        <pre>${escapeHtml(warnings.join('\n') || '—')}</pre>
      </div>
      <div class="result-card">
        <h3>${isEn ? 'Form recommendation' : 'Рекомендация формы'}</h3>
        <pre>${escapeHtml(formRecommendation.text || '—')}</pre>
      </div>
    </div>
  `;

  els.result.querySelectorAll('[data-score-key]').forEach((inputEl) => {
    inputEl.addEventListener('change', () => {
      const scores = { ...computed.scores };
      els.result.querySelectorAll('[data-score-key]').forEach((field) => {
        const key = field.dataset.scoreKey;
        scores[key] = field.value === '' && key === 'E' ? null : Number(field.value);
      });
      recomputeResultFromManualScores(scores);
    });
  });
}


function hasUserInputForClear() {
  const fields = [
    els.regularWord,
    els.logicalMeaning,
    els.internationalMeaning,
    els.naturalisticWord,
    els.explanationChain,
    els.manualPrompt,
    els.manualEmbeddingResponse
  ];

  const hasTypedText = fields.some((field) => field && field.value && field.value.trim().length > 0);
  const selectorChanged = [
    els.assimilationSelect,
    els.componentCategorySelect,
    els.componentSelect,
    els.prefixVariantSelect
  ].some((select) => select && select.selectedIndex > 0);
  return hasTypedText || selectorChanged || state.components.length > 0;
}

function syncClearButtonVisibility() {
  if (!els.clearBtn) return;
  els.clearBtn.classList.toggle('is-hidden', !hasUserInputForClear());
}

function resetComponentDraftControls() {
  if (els.rootFormInput) {
    els.rootFormInput.value = '';
    els.rootFormInput.readOnly = false;
  }
  if (els.rootMeaningInput) {
    els.rootMeaningInput.value = '';
    els.rootMeaningInput.readOnly = false;
  }
  if (els.assimilationSelect) els.assimilationSelect.value = 'none';
  if (els.componentSearchInput) els.componentSearchInput.value = '';
  if (els.componentCategorySelect) {
    els.componentCategorySelect.selectedIndex = 0;
    fillComponentSelect();
  }
  if (els.componentSelect) els.componentSelect.selectedIndex = 0;
  if (els.prefixVariantSelect) els.prefixVariantSelect.selectedIndex = 0;
  pendingPrefixItem = null;
  renderComponentSearchResults();
  window.initCustomSelects?.();
}

async function clearAll() {
  await performHardReset(t('resetConfirm'), [
    STORAGE_KEY
  ]);
}



window.InteralPageState = {
  collect() {
    return {
      regularWord: els.regularWord?.value || '',
      logicalMeaning: els.logicalMeaning?.value || '',
      internationalMeaning: els.internationalMeaning?.value || '',
      naturalisticWord: els.naturalisticWord?.value || '',
      explanationChain: els.explanationChain?.value || '',
      components: state.components || [],
      lastAnalysis: state.lastAnalysis || null,
      manualPrompt: els.manualPrompt?.value || '',
      manualEmbeddingResponse: els.manualEmbeddingResponse?.value || ''
    };
  },

  apply(data) {
    if (els.regularWord) els.regularWord.value = data.regularWord || '';
    if (els.logicalMeaning) els.logicalMeaning.value = data.logicalMeaning || '';
    if (els.internationalMeaning) els.internationalMeaning.value = data.internationalMeaning || '';
    if (els.naturalisticWord) els.naturalisticWord.value = data.naturalisticWord || '';
    if (els.explanationChain) els.explanationChain.value = data.explanationChain || '';
    if (els.manualPrompt) els.manualPrompt.value = data.manualPrompt || '';
    if (els.manualEmbeddingResponse) els.manualEmbeddingResponse.value = data.manualEmbeddingResponse || '';

    state.components = Array.isArray(data.components) ? data.components : [];
    state.lastAnalysis = data.lastAnalysis || null;

    renderComponents();
    syncPromptButtonsVisibility();
    syncClearButtonVisibility();
  },

  clearStorageKeys: [
    STORAGE_KEY
  ]
};

function saveState() {
  const payload = {
    regularWord: els.regularWord.value,
    logicalMeaning: els.logicalMeaning.value,
    internationalMeaning: els.internationalMeaning.value,
    naturalisticWord: els.naturalisticWord.value,
    explanationChain: els.explanationChain ? els.explanationChain.value : '',
    components: state.components,
    useLLM: els.useLlm.checked,
    ollamaUrl: els.ollamaUrl ? els.ollamaUrl.value : '',
    ollamaModel: els.ollamaModel ? els.ollamaModel.value : '',
    manualPrompt: els.manualPrompt ? els.manualPrompt.value : '',
    manualEmbeddingResponse: els.manualEmbeddingResponse ? els.manualEmbeddingResponse.value : '',
    resultHtml: els.result.innerHTML,
    resultIsEmpty: els.result.classList.contains('empty'),
    lastAnalysis: state.lastAnalysis
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function migrateSavedComponents(components) {
  return components.map((item) => ({
    ...item,
    label: item.type === 'root' ? 'root' : item.category || item.label,
    assimilationNoteRaw: item.assimilationNoteRaw || item.assimilationNote
  }));
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    els.regularWord.value = saved.regularWord || '';
    els.logicalMeaning.value = saved.logicalMeaning || '';
    els.internationalMeaning.value = saved.internationalMeaning || '';
    els.naturalisticWord.value = saved.naturalisticWord || '';
    if (els.explanationChain) els.explanationChain.value = saved.explanationChain || '';
    state.components = Array.isArray(saved.components) ? migrateSavedComponents(saved.components) : [];
    state.lastAnalysis = saved.lastAnalysis || null;
    els.useLlm.checked = Boolean(saved.useLLM);
    if (els.ollamaUrl) els.ollamaUrl.value = saved.ollamaUrl || 'http://localhost:11434';
    if (els.ollamaModel) els.ollamaModel.value = saved.ollamaModel || 'qwen3-embedding';
    if (els.manualPrompt) els.manualPrompt.value = saved.manualPrompt || '';
    syncPromptButtonsVisibility();
    if (els.manualEmbeddingResponse) els.manualEmbeddingResponse.value = saved.manualEmbeddingResponse || '';

    if (saved.lastAnalysis && !saved.resultIsEmpty) {
      renderResult(saved.lastAnalysis, getInput());
    } else if (saved.resultHtml) {
      els.result.innerHTML = saved.resultHtml;
      els.result.classList.toggle('empty', Boolean(saved.resultIsEmpty));
      els.resultPanel.hidden = Boolean(saved.resultIsEmpty);
    }

    syncClearButtonVisibility();
  } catch (_error) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function syncPromptButtonsVisibility() {
  if (!els.buildPromptBtn || !els.manualPrompt) return;
  const hasPrompt = Boolean(els.manualPrompt.value && els.manualPrompt.value.trim());
  els.buildPromptBtn.classList.toggle('is-hidden', hasPrompt);
}

function flashCopiedPromptField() {
  if (!els.manualPrompt) return;
  els.manualPrompt.classList.add('copy-flash');
  clearTimeout(copyPromptHighlightTimer);
  copyPromptHighlightTimer = setTimeout(() => {
    els.manualPrompt.classList.remove('copy-flash');
  }, 900);
}

function hideBuildPromptButtonWithShift() {
  if (!els.buildPromptBtn || !els.copyPromptBtn) return;
  if (els.buildPromptBtn.classList.contains('is-hidden')) return;

  const before = els.copyPromptBtn.getBoundingClientRect();
  els.buildPromptBtn.classList.add('is-hidden');

  requestAnimationFrame(() => {
    const after = els.copyPromptBtn.getBoundingClientRect();
    const deltaX = before.left - after.left;
    if (!deltaX) return;
    els.copyPromptBtn.animate(
      [{ transform: `translateX(${deltaX}px)` }, { transform: 'translateX(0)' }],
      { duration: 220, easing: 'ease-out' }
    );
  });
}

function refreshSelectLocalization() {
  const assimilationValue = els.assimilationSelect.value;
  els.assimilationSelect.querySelectorAll('option').forEach((optionEl) => {
    const found = assimilationOptions.find((opt) => opt.value === optionEl.value);
    optionEl.textContent = localizeAssimilationLabel(found);
  });
  els.assimilationSelect.value = assimilationValue;

  els.componentCategorySelect.querySelectorAll('option').forEach((optionEl) => {
    optionEl.textContent = localizeCategory(optionEl.value);
  });

  fillComponentSelect({ keepSearch: true });
  renderComponentSearchResults();
  window.initCustomSelects?.();
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
    renderComponentSearchResults();
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

  els.componentCategorySelect.addEventListener('change', () => fillComponentSelect());
  els.componentSelect.addEventListener('change', updateComponentPreview);
  els.componentSearchInput?.addEventListener('input', renderComponentSearchResults);
  els.componentSearchResults?.addEventListener('click', (event) => {
    const option = event.target.closest('[data-component-id]');
    if (!option) return;

    selectComponentById(option.dataset.componentId);

    const item = allComponents.find((x) => x.id === option.dataset.componentId);
    if (!item) return;

    if (item.category.startsWith('Приставки') && prefixAssimilationOptions[item.id]) {
      openPrefixVariantStep(item);
      return;
    }

    addSelectedComponent();

    if (els.componentSearchInput) els.componentSearchInput.value = '';
    renderComponentSearchResults();
  });
  els.assimilationSelect.addEventListener('change', syncRootFormByAssimilation);
  els.prefixVariantSelect.addEventListener('change', updatePrefixVariantPreview);
  [els.componentCategorySelect, els.componentSelect, els.assimilationSelect, els.prefixVariantSelect]
    .forEach((el) => el && el.addEventListener('change', syncClearButtonVisibility));

  document.addEventListener('interal:languagechange', () => {
    refreshSelectLocalization();
    syncRootFormByAssimilation();
    renderComponents();
    els.result.classList.add('empty');
    els.result.textContent = t('fillAndAnalyse');
    saveState();
  });

  els.saveRootBtn.addEventListener('click', addRootComponent);
  els.saveComponentBtn.addEventListener('click', addSelectedComponent);
  els.savePrefixVariantBtn.addEventListener('click', savePrefixVariant);
  if (els.clearBtn) els.clearBtn.addEventListener('click', clearAll);

  els.buildPromptBtn.addEventListener('click', () => {
    const input = getInput();
    if (els.manualPrompt) {
      els.manualPrompt.value = buildManualPrompt(input);
      hideBuildPromptButtonWithShift();
      saveState();
    }
  });

  if (els.copyPromptBtn) {
    els.copyPromptBtn.addEventListener('click', async () => {
      const promptText = els.manualPrompt ? els.manualPrompt.value.trim() : '';
      if (!promptText) return;

      els.copyPromptBtn.classList.remove('is-copied', 'is-failed');
      try {
        await navigator.clipboard.writeText(promptText);
        els.copyPromptBtn.classList.add('is-copied');
        els.copyPromptBtn.setAttribute('aria-label', t('copied'));
        hideBuildPromptButtonWithShift();
        flashCopiedPromptField();
      } catch (error) {
        els.copyPromptBtn.classList.add('is-failed');
        els.copyPromptBtn.setAttribute('aria-label', t('copyFailed'));
      } finally {
        setTimeout(() => {
          els.copyPromptBtn.classList.remove('is-copied', 'is-failed');
          els.copyPromptBtn.setAttribute('aria-label', t('copyPrompt'));
        }, 1200);
      }
    });
  }

  els.analyzeBtn.addEventListener('click', async () => {
    const runId = nextRunId();
    const input = getInput();
    els.analyzeBtn.disabled = true;
    els.analyzeBtn.textContent = currentLang() === 'en' ? 'Analysing…' : 'Анализируем…';
    try {
      const result = await analyzeByRules(input, runId);
      if (!isCurrentRun(runId) || !result) return;
      renderResult(result, input);
      if (!isCurrentRun(runId)) return;
      saveState();
    } catch (error) {
      if (!isCurrentRun(runId)) return;
      const computed = classifyByPRECE({ P: 2, R: 3, C: 2, E: 1 });
      computed.formRecommendation = buildFormRecommendation(computed, input);
      computed.warnings = ['API недоступен. Выставьте P/R/C/E вручную — зона пересчитается локально.', String(error.message || error)];
      if (!isCurrentRun(runId)) return;
      renderResult({ ok: false, error: 'frontend_error', details: String(error.message || error), ai: normalizeAiResult({ P: 2, R: 3, C: 2, E: 1, confidence: 0.2 }), computed, retrieval: { examples_used: [] } }, input);
    } finally {
      if (!isCurrentRun(runId)) return;
      els.analyzeBtn.disabled = false;
      els.analyzeBtn.textContent = t('analyse');
    }
  });

  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', closeAllModals);
  });

  [
    els.regularWord,
    els.logicalMeaning,
    els.internationalMeaning,
    els.naturalisticWord,
    els.explanationChain,
    els.useLlm,
    els.ollamaUrl,
    els.ollamaModel,
    els.manualPrompt,
    els.manualEmbeddingResponse
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener('input', () => {
      syncClearButtonVisibility();
      saveState();
    });
    el.addEventListener('change', saveState);
  });
}

setupSelects();
window.initCustomSelects?.();
restoreState();
attachEvents();
syncRootFormByAssimilation();
renderComponents();
syncPromptButtonsVisibility();
syncClearButtonVisibility();
