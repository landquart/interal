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
    être: 'êt', connaître: 'conna', voir: 'voi', cuire: 'cui',
    moudre: 'moud', mourir: 'mour', vouloir: 'voul', droite: 'droit'
  },
  es: {
    ver: 've', dar: 'da', peer: 'pe', roer: 'ro',
    'silla de montar': 'sill'
  },
  it: {
    dare: 'da', stare: 'sta'
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
    'जुआ': 'जु'
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

for (const item of dictionary.items) {
  for (const language of dictionary.languages) {
    const cell = item[language];
    if (!cell || typeof cell !== 'object' || Array.isArray(cell)) continue;

    const root = rootFor(item, language, cell);
    const next = { word: cell.word, root };

    if (cell.romanization !== undefined) {
      next.romanization = cell.romanization;
      next.root_romanization = romanizedRootFor(item, language, cell, root);
    }

    for (const [key, value] of Object.entries(cell)) {
      if (!['word', 'root', 'romanization', 'root_romanization'].includes(key)) next[key] = value;
    }

    item[language] = next;
  }
}

await writeFile(dictionaryPath, `${JSON.stringify(dictionary, null, 2)}\n`, 'utf8');
