import fs from 'node:fs';

const descriptions = {
  'index.html': 'Interal — международный вспомогательный язык с международной лексикой, регулярной грамматикой и прозрачным словообразованием.',
  'instrumentes/index.html': 'Инструменты Interal для анализа и отбора лексики: индоевропейские и ассоциативные слова, интернационализмы, аффиксы и другие категории.',
  'indoeuropanvordes/index.html': 'Анализ индоевропейской лексики в Interal: сравнение слов разных языков, их сходства и пригодности для международного вспомогательного языка.',
  'associativvordes/index.html': 'Инструмент Interal для поиска и оценки ассоциативных слов — лексики, узнаваемой через международные и межъязыковые ассоциации.',
  'internationalismes/index.html': 'Инструмент Interal для работы с интернационализмами: оценки международного распространения слов и их пригодности для общей лексики.',
  'vordesofcommunites/index.html': 'Инструмент Interal для анализа слов языковых и культурных сообществ и оценки их пригодности для международной лексики.',
  'grammaticebrevivordes/index.html': 'Грамматические и краткие слова Interal: инструмент для отбора служебной лексики и форм с учётом международности и системности.',
  'altervordes/index.html': 'Иные слова Interal: инструмент для анализа и отбора лексики, не относящейся к основным категориям международного словаря.',
  'affixes/index.html': 'Аффиксы Interal: инструмент для анализа и отбора международных приставок и суффиксов для прозрачного и системного словообразования.',
  'registre/index.html': 'Реестр лексических карточек Interal: просмотр и систематизация данных о словах, их происхождении, анализе и статусе в проекте языка.',
  'logotypenomine/index.html': 'Официальный логотип Interal, фирменные цвета и правила использования названия международного вспомогательного языка.'
};

for (const [file, description] of Object.entries(descriptions)) {
  let html = fs.readFileSync(file, 'utf8');
  const tag = `<meta name="description" content="${description}">`;
  const descriptionRe = /<meta\s+name=["']description["'][^>]*>/i;

  if (descriptionRe.test(html)) {
    html = html.replace(descriptionRe, tag);
  } else {
    const titleRe = /<title\b[^>]*>[\s\S]*?<\/title>/i;
    if (!titleRe.test(html)) throw new Error(`No <title> found in ${file}`);
    html = html.replace(titleRe, (title) => `${title}\n  ${tag}`);
  }

  fs.writeFileSync(file, html);
  console.log(`SEO description updated: ${file}`);
}
