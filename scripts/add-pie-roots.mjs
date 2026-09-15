import { readFile, writeFile } from 'node:fs/promises';

const dictionaryPath = new URL('../indoeuropanvordes/pie_vordes', import.meta.url);
const dictionary = JSON.parse(await readFile(dictionaryPath, 'utf8'));

const explicit = {
  en: {
    oats: 'oat',
    sated: 'sate'
  },
  de: {
    Name: 'Nam', Mitte: 'Mitt', Auge: 'Aug', Achse: 'Achs', Nase: 'Nas',
    Witwe: 'Witw', Tanne: 'Tann', Fliege: 'Flieg', Ameise: 'Ameis',
    Buche: 'Buch', Wespe: 'Wesp', Wolle: 'Woll', andere: 'ander',
    erste: 'erst', dritte: 'dritt'
  },
  fr: {
    être: 'êt', connaître: 'connaiss', voir: 'voi', cuire: 'cuis',
    moudre: 'moul', mourir: 'mour', vouloir: 'voul', droite: 'droit',
    édible: 'édibl', siège: 'sièg'
  },
  es: {
    ver: 've', dar: 'da', peer: 'pe', roer: 'ro',
    'silla de montar': 'sill', lecho: 'lech'
  },
  it: {
    dare: 'da', stare: 'sta', letto: 'lett', edule: 'edul'
  },
  ru: {
    'мать': 'мат', 'имя': 'имен', 'ночь': 'ноч', 'соль': 'сол',
    'звезда': 'звезд', 'солнце': 'солнц', 'сердце': 'сердц', 'око': 'ок',
    'ноготь': 'ногт', 'колено': 'колен', 'иго': 'иг', 'ось': 'ос',
    'порог': 'порог', 'семя': 'семен', 'зуб': 'зуб', 'нос': 'нос',
    'ухо': 'ух', 'дверь': 'двер', 'дерево': 'дерев', 'вино': 'вин',
    'гусь': 'гус', 'мышь': 'мыш', 'вдова': 'вдов', 'море': 'мор',
    'вода': 'вод', 'тоска': 'тоск', 'борода': 'бород', 'дно': 'дн',
    'сестра': 'сестр', 'гость': 'гост', 'зерно': 'зерн', 'ключ': 'ключ',
    'муха': 'мух', 'смерть': 'смерт', 'гнездо': 'гнезд', 'яйцо': 'яйц',
    'отец': 'отц', 'рыба': 'рыб', 'блоха': 'блох', 'стопа': 'стоп',
    'колесо': 'колес', 'седло': 'седл', 'крыша': 'крыш', 'выдра': 'выдр',
    'червь': 'черв', 'зима': 'зим', 'оса': 'ос', 'яблоко': 'яблок',
    'осина': 'осин', 'берёза': 'берёз', 'бровь': 'бров', 'олень': 'олен',
    'сомнение': 'сомнен', 'вепрь': 'вепр', 'лось': 'лос', 'золото': 'золот',
    'пшеница': 'пшениц', 'луна': 'лун', 'дочь': 'доч', 'корова': 'коров',
    'корень': 'корен', 'воробей': 'вороб', 'пена': 'пен', 'свинья': 'свин',
    'зверь': 'звер', 'работа': 'работ', 'весна': 'весн', 'шерсть': 'шерст',
    'новый': 'нов', 'полный': 'полн', 'рыжий': 'рыж', 'лёгкий': 'лёгк',
    'бурый': 'бур', 'правый': 'прав', 'двойной': 'двойн', 'юный': 'юн',
    'сырой': 'сыр', 'короткий': 'коротк', 'длинный': 'длинн', 'нагой': 'наг',
    'первый': 'перв', 'прямой': 'прям', 'сытый': 'сыт', 'тёплый': 'тёпл',
    'тонкий': 'тонк', 'третий': 'трет', 'верный': 'верн', 'жёлтый': 'жёлт',
    'живой': 'жив', 'другой': 'друг', 'зелёный': 'зелён', 'белый': 'бел',
    'знать': 'зна', 'стоять': 'сто', 'лежать': 'леж', 'есть': 'ед',
    'сидеть': 'сид', 'давать': 'да', 'мешать': 'меш', 'умереть': 'мер',
    'молоть': 'мол', 'печь': 'печ', 'пердеть': 'перд', 'плести': 'плет',
    'сосать': 'сос', 'потеть': 'пот', 'тянуть': 'тян', 'дрожать': 'дрож',
    'жить': 'жи', 'ломать': 'лом', 'кашлять': 'кашл', 'грызть': 'грыз',
    'рыгать': 'рыг', 'свистеть': 'свист', 'скользить': 'скольз',
    'плевать': 'плев', 'видеть': 'вид', 'хотеть': 'хот'
  },
  el: {
    'μητέρα': 'μητερ', 'όνομα': 'ονοματ', 'νύχτα': 'νυχτ', 'αλάτι': 'αλατ',
    'λύκος': 'λυκ', 'αστέρι': 'αστερ', 'ήλιος': 'ηλι', 'μήνας': 'μην',
    'καρδιά': 'καρδι', 'όμμα': 'ομματ', 'όνυχας': 'ονυχ', 'γόνατο': 'γονατ',
    'ζυγό': 'ζυγ', 'άξονας': 'αξον', 'νιφάδα': 'νιφαδ', 'πόρος': 'πορ',
    'γένος': 'γεν', 'ἵημι': 'ἵη', 'δόντι': 'δοντ', 'ῥίς': 'ῥιν',
    'ους': 'ωτ', 'θύρα': 'θυρ', 'δρυς': 'δρυ', 'μέθυ': 'μεθυ',
    'οίνος': 'οιν', 'χήνα': 'χην', 'μυς': 'μυ', 'χήρα': 'χηρ',
    'κέρας': 'κερατ', 'κολωνός': 'κολων', 'άνεμος': 'ανεμ', 'πυρ': 'πυρ',
    'ύδωρ': 'υδατ', 'άγχος': 'αγχ', 'βρώμη': 'βρωμ', 'γένια': 'γενι',
    'πάτος': 'πατ', 'οξιά': 'οξι', 'αδελφός': 'αδελφ', 'αδελφή': 'αδελφ',
    'ξένος': 'ξεν', 'κόκκος': 'κοκκ', 'γεύση': 'γευσ', 'κλειδί': 'κλειδ',
    'λινάρι': 'λιναρ', 'φως': 'φωτ', 'μύγα': 'μυγ', 'θάνατος': 'θανατ',
    'μυρμήγκι': 'μυρμηγκ', 'φωλιά': 'φωλι', 'αυγό': 'αυγ',
    'πατέρας': 'πατερ', 'ψάρι': 'ψαρ', 'ψύλλος': 'ψυλλ', 'πόδι': 'ποδ',
    'ρόδα': 'ροδ', 'σέλα': 'σελ', 'χυμός': 'χυμ', 'στέγη': 'στεγ',
    'ταύρος': 'ταυρ', 'βίδρα': 'βιδρ', 'σκουλήκι': 'σκουληκ',
    'χειμώνας': 'χειμων', 'σφήκα': 'σφηκ', 'μήλο': 'μηλ', 'λεύκη': 'λευκ',
    'φασόλι': 'φασολ', 'κάστορας': 'καστορ', 'σημύδα': 'σημυδ',
    'φρύδι': 'φρυδ', 'εγκέφαλος': 'εγκεφαλ', 'ελάφι': 'ελαφ',
    'αμφιβολία': 'αμφιβολι', 'αγριόχοιρος': 'αγριοχοιρ',
    'σκαντζόχοιρος': 'σκαντζοχοιρ', 'άλκη': 'αλκ', 'χρυσός': 'χρυσ',
    'σιτάρι': 'σιταρ', 'φεγγάρι': 'φεγγαρ', 'κόρη': 'κορ',
    'αγελάδα': 'αγελαδ', 'ανιψιός': 'ανιψι', 'ρίζα': 'ριζ', 'γιος': 'γι',
    'ύπνος': 'υπν', 'σπουργίτι': 'σπουργιτ', 'αφρός': 'αφρ',
    'γουρούνι': 'γουρουν', 'θηρίο': 'θηρι', 'βαγόνι': 'βαγον', 'έργο': 'εργ',
    'άνοιξη': 'ανοιξ', 'μαλλί': 'μαλλ',
    'νέος': 'νε', 'πλήρης': 'πληρ', 'μέσος': 'μεσ', 'ερυθρός': 'ερυθρ',
    'ελαφρύς': 'ελαφρ', 'δεξιά': 'δεξι', 'διπλός': 'διπλ', 'ωμός': 'ωμ',
    'κοντός': 'κοντ', 'μακρύς': 'μακρ', 'γυμνός': 'γυμν',
    'πρώτος': 'πρωτ', 'ορθός': 'ορθ', 'χορτάτος': 'χορτατ',
    'χλιαρός': 'χλιαρ', 'λεπτός': 'λεπτ', 'τρίτος': 'τριτ',
    'αληθινός': 'αληθιν', 'κίτρινος': 'κιτριν', 'ζωντανός': 'ζωνταν',
    'άλλος': 'αλλ', 'λευκός': 'λευκ', 'πράσινος': 'πρασιν',
    'γνωρίζω': 'γνωριζ', 'στέκομαι': 'στεκ', 'λέχος': 'λεχ',
    'έδεσμα': 'εδεσμ', 'έδρα': 'εδρ', 'βελάζω': 'βελαζ', 'δίνω': 'διν',
    'ανακατεύω': 'ανακατευ', 'πεθαίνω': 'πεθαιν', 'αλέθω': 'αλεθ',
    'ψήνω': 'ψην', 'κλάνω': 'κλαν', 'πλέκω': 'πλεκ', 'ρουφάω': 'ρουφ',
    'ιδρώνω': 'ιδρων', 'τεντώνω': 'τεντων', 'τρέμω': 'τρεμ', 'ζω': 'ζ',
    'σπάω': 'σπ', 'βήχω': 'βηχ', 'ροκανίζω': 'ροκανιζ', 'ρεύομαι': 'ρευ',
    'σφυρίζω': 'σφυριζ', 'γλιστράω': 'γλιστρ', 'φτύνω': 'φτυν',
    'βλέπω': 'βλεπ', 'θέλω': 'θελ'
  },
  hi: {
    'जुआ': 'जु', 'ज़िंदा': 'ज़िंदा'
  },
  fa: {
    'قهوه‌ای': 'قهوه'
  }
};

const hindiMarkedNouns = new Set([
  'तारा', 'महीना', 'घुटना', 'जुआ', 'दरवाज़ा', 'चूहा', 'बेटा', 'अंडा',
  'कीड़ा', 'पहिया', 'सोना'
]);

function latinVerbStem(word, language) {
  if (language === 'de') {
    if (word.endsWith('en') && word.length > 4) return word.slice(0, -2);
    if (word.endsWith('n') && word.length > 3) return word.slice(0, -1);
  }
  if (language === 'fr') {
    if (word.endsWith('er') || word.endsWith('ir')) return word.slice(0, -2);
    if (word.endsWith('re')) return word.slice(0, -2);
  }
  if (language === 'es') {
    if (/(?:ar|er|ir)$/.test(word)) return word.slice(0, -2);
  }
  if (language === 'it') {
    if (/(?:are|ere|ire)$/.test(word)) return word.slice(0, -3);
  }
  return word;
}

function romanceNominalStem(word, language, partOfSpeech) {
  if (!['noun', 'adjective'].includes(partOfSpeech)) return word;
  if (word.includes(' ')) return word;
  if (language === 'es' && /[aeo]$/.test(word) && word.length > 3) return word.slice(0, -1);
  if (language === 'it' && /[aeo]$/.test(word) && word.length > 3) return word.slice(0, -1);
  return word;
}

function rootFor(item, language, cell) {
  const word = String(cell.word || '');
  if (!word) return '';
  if (explicit[language]?.[word] !== undefined) return explicit[language][word];

  if (item.part_of_speech === 'verb' && ['de', 'fr', 'es', 'it'].includes(language)) {
    return latinVerbStem(word, language);
  }

  if (language === 'es' || language === 'it') {
    return romanceNominalStem(word, language, item.part_of_speech);
  }

  if (language === 'hi') {
    if (item.part_of_speech === 'verb' && word.endsWith('ना')) return word.slice(0, -2);
    if (item.part_of_speech === 'adjective') return word.replace(/ाँ$|ा$/, '');
    if (hindiMarkedNouns.has(word)) return word.replace(/ा$/, '');
  }

  if (language === 'fa' && item.part_of_speech === 'verb' && word.endsWith('ن')) {
    return word.slice(0, -1);
  }

  return word;
}

function romanizedRootFor(item, language, cell, root) {
  const romanization = String(cell.romanization || '');
  if (!romanization) return '';

  if (language === 'hi') {
    if (cell.word === 'ज़िंदा') return romanization;
    if (item.part_of_speech === 'verb' && romanization.endsWith('nā')) return romanization.slice(0, -2);
    if (item.part_of_speech === 'adjective') return romanization.replace(/ā̃$|ā$/, '');
    if (hindiMarkedNouns.has(cell.word)) return romanization.replace(/ā$/, '');
  }

  if (language === 'fa') {
    if (cell.word === 'قهوه‌ای') return 'ġahve';
    if (item.part_of_speech === 'verb' && romanization.endsWith('an')) return romanization.slice(0, -2);
  }

  return romanization;
}

const explicitRootIpa = {
  en: {
    oat: 'oʊt', sate: 'seɪt'
  },
  fr: {
    connaiss: 'kɔnɛs', 'êt': 'ɛt', 'bêl': 'bɛl', donn: 'dɔn', droit: 'dʁwat',
    mélang: 'melɑ̃ʒ', mour: 'muʁ', moul: 'mul', cuis: 'kɥiz', pét: 'pɛt',
    tress: 'tʁɛs', suc: 'sys', su: 'sɥ', tend: 'tɑ̃d', trembl: 'tʁɑ̃bl',
    viv: 'viv', bris: 'bʁiz', touss: 'tus', rong: 'ʁɔ̃ʒ', rot: 'ʁɔt',
    siffl: 'sifl', gliss: 'ɡlis', crach: 'kʁaʃ', voi: 'vwa', voul: 'vul',
    édibl: 'edibl', sièg: 'sjɛʒ'
  },
  es: {
    ve: 'be', da: 'da', pe: 'pe', ro: 'ro', sill: 'siʎ'
  },
  it: {
    da: 'da', sta: 'sta'
  },
  hi: {
    जु: 'dʒʊ'
  },
  fa: {
    'قهوه': 'ɢæhve'
  }
};

function withoutStress(ipa) {
  return String(ipa || '').replace(/[ˈˌ]/g, '');
}

function russianRootToIpa(root) {
  const text = root.toLowerCase().normalize('NFC');
  const consonants = {
    'б': 'b', 'в': 'v', 'г': 'ɡ', 'д': 'd', 'з': 'z', 'к': 'k', 'л': 'l',
    'м': 'm', 'н': 'n', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'ф': 'f',
    'х': 'x', 'ж': 'ʐ', 'ш': 'ʂ', 'ц': 't͡s', 'ч': 't͡ɕ', 'щ': 'ɕː', 'й': 'j'
  };
  const vowels = { 'а': 'a', 'е': 'e', 'ё': 'o', 'и': 'i', 'о': 'o', 'у': 'u', 'ы': 'ɨ', 'э': 'e', 'ю': 'u', 'я': 'a' };
  const softeners = new Set(['е', 'ё', 'и', 'ю', 'я', 'ь']);
  const neverSoft = new Set(['ж', 'ш', 'ц']);
  let result = '';

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1] || '';
    if (consonants[char]) {
      result += consonants[char];
      if (softeners.has(next) && !neverSoft.has(char) && !['ч', 'щ', 'й'].includes(char)) result += 'ʲ';
      continue;
    }
    if (vowels[char]) {
      const previous = text[index - 1] || '';
      if (['е', 'ё', 'ю', 'я'].includes(char) && (!previous || vowels[previous] || previous === 'ь' || previous === 'ъ')) result += 'j';
      result += vowels[char];
      continue;
    }
    if (char === 'ь' || char === 'ъ') continue;
    result += char;
  }
  return result;
}

function greekRootToIpa(root) {
  let text = root.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ς/g, 'σ');
  const replacements = [
    [/αι/g, 'E'], [/ει|οι|υι/g, 'I'], [/ου/g, 'U'], [/αυ/g, 'A'], [/ευ/g, 'V'],
    [/μπ/g, 'B'], [/ντ/g, 'D'], [/γκ/g, 'G'], [/τσ/g, 'C'], [/τζ/g, 'J']
  ];
  for (const [pattern, value] of replacements) text = text.replace(pattern, value);
  const simple = {
    'α': 'a', 'ε': 'e', 'η': 'i', 'ι': 'i', 'ο': 'o', 'υ': 'i', 'ω': 'o',
    'β': 'v', 'δ': 'ð', 'ζ': 'z', 'θ': 'θ', 'κ': 'k', 'λ': 'l', 'μ': 'm',
    'ν': 'n', 'ξ': 'ks', 'π': 'p', 'ρ': 'r', 'σ': 's', 'τ': 't', 'φ': 'f',
    'ψ': 'ps', 'E': 'e', 'I': 'i', 'U': 'u', 'B': 'mb', 'D': 'nd', 'G': 'ŋg',
    'C': 't͡s', 'J': 'd͡z'
  };
  const front = new Set(['ε', 'η', 'ι', 'υ', 'E', 'I']);
  const voiceless = new Set(['κ', 'π', 'τ', 'φ', 'θ', 'χ', 'σ', 'ξ', 'ψ', 'C']);
  let result = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1] || '';
    if (char === 'γ') result += front.has(next) ? 'ʝ' : 'ɣ';
    else if (char === 'χ') result += front.has(next) ? 'ç' : 'x';
    else if (char === 'A') result += voiceless.has(next) ? 'af' : 'av';
    else if (char === 'V') result += voiceless.has(next) ? 'ef' : 'ev';
    else result += simple[char] ?? char;
  }
  return result;
}

function deriveRootIpa(item, language, cell, root, rootRomanization) {
  const ipa = String(cell.ipa || '');
  if (!ipa) return '';
  if (root === cell.word) return ipa;
  if (explicitRootIpa[language]?.[root]) return explicitRootIpa[language][root];

  let value = withoutStress(ipa);
  if (language === 'de') {
    if (item.part_of_speech === 'verb') return value.replace(/(?:ən|n̩|n)$/, '');
    return value.replace(/ə$/, '');
  }
  if (language === 'es') {
    if (/(?:ar|er|ir)$/.test(cell.word)) return value.replace(/[aei]ɾ$/, '');
    return value.replace(/[aeo]$/, '');
  }
  if (language === 'it') {
    const removed = cell.word.startsWith(root) ? cell.word.slice(root.length) : '';
    if (removed.length === 3 && /^(?:are|ere|ire)$/.test(removed)) return value.replace(/[aei]ː?re$/, '');
    return value.replace(/[aeo]$/, '');
  }
  if (language === 'ru') return russianRootToIpa(root);
  if (language === 'el') return greekRootToIpa(root);
  if (language === 'hi') {
    if (item.part_of_speech === 'verb' && String(cell.romanization).endsWith('nā')) return value.replace(/n(?:̪)?ɑː$/, '');
    if (/ā̃?$/.test(String(cell.romanization)) && !/ā̃?$/.test(rootRomanization)) return value.replace(/ɑ(?:ː̃|̃ː|ː)$/, '');
  }
  if (language === 'fa') {
    if (String(cell.romanization).endsWith('an')) return value.replace(/æ[nɴ]$/, '');
  }
  return value;
}

for (const item of dictionary.items) {
  for (const language of dictionary.languages) {
    const cell = item[language];
    if (!cell || typeof cell !== 'object' || Array.isArray(cell)) continue;

    const root = rootFor(item, language, cell);
    const rootRomanization = romanizedRootFor(item, language, cell, root);
    const rootIpa = deriveRootIpa(item, language, cell, root, rootRomanization);
    const next = { word: cell.word, root };

    if (cell.romanization !== undefined) {
      next.romanization = cell.romanization;
      next.root_romanization = rootRomanization;
    }

    next.ipa = cell.ipa;
    next.root_ipa = rootIpa;

    for (const [key, value] of Object.entries(cell)) {
      if (!['word', 'root', 'romanization', 'root_romanization', 'ipa', 'root_ipa'].includes(key)) next[key] = value;
    }

    item[language] = next;
  }
}

await writeFile(dictionaryPath, `${JSON.stringify(dictionary, null, 2)}\n`, 'utf8');
