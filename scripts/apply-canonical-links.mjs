import fs from 'node:fs';

const canonicals = {
  'index.html': 'https://interal.vercel.app/',
  'instrumentes/index.html': 'https://interal.vercel.app/instrumentes/',
  'indoeuropanvordes/index.html': 'https://interal.vercel.app/indoeuropanvordes/',
  'associativvordes/index.html': 'https://interal.vercel.app/associativvordes/',
  'internationalismes/index.html': 'https://interal.vercel.app/internationalismes/',
  'vordesofcommunites/index.html': 'https://interal.vercel.app/vordesofcommunites/',
  'grammaticebrevivordes/index.html': 'https://interal.vercel.app/grammaticebrevivordes/',
  'altervordes/index.html': 'https://interal.vercel.app/altervordes/',
  'affixes/index.html': 'https://interal.vercel.app/affixes/',
  'registre/index.html': 'https://interal.vercel.app/registre/',
  'logotypenomine/index.html': 'https://interal.vercel.app/logotypenomine/'
};

for (const [file, url] of Object.entries(canonicals)) {
  let html = fs.readFileSync(file, 'utf8');
  const tag = `<link rel="canonical" href="${url}">`;
  const canonicalRe = /<link\s+rel=["']canonical["'][^>]*>/i;

  if (canonicalRe.test(html)) {
    html = html.replace(canonicalRe, tag);
  } else {
    const descriptionRe = /<meta\s+name=["']description["'][^>]*>/i;
    if (descriptionRe.test(html)) {
      html = html.replace(descriptionRe, (description) => `${description}\n  ${tag}`);
    } else {
      const titleRe = /<title\b[^>]*>[\s\S]*?<\/title>/i;
      if (!titleRe.test(html)) throw new Error(`No suitable insertion point in ${file}`);
      html = html.replace(titleRe, (title) => `${title}\n  ${tag}`);
    }
  }

  fs.writeFileSync(file, html);
  console.log(`Canonical updated: ${file}`);
}
