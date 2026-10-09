import { BRAND, SITE_URL, pageTitle } from './brand.js';
import { esc } from './html.js';
import { DICTS } from './i18n/index.js';
import { LANGS, X_DEFAULT, langPath } from './lib/locale.js';
import { readyTools } from './tools.js';
import { socialCard, SOCIAL_WIDTH, SOCIAL_HEIGHT, SOCIAL_LOCALES } from './social.js';

// Оболочка страницы: <head>, шапка, подвал. Стили и скрипты — файлами из assets/,
// в HTML встроены только данные конкретной страницы. Весь текст — из словаря
// языка L; адрес страницы — /<язык>/<slug>.
export function layout(L, page) {
  const { lang } = L;
  const product = L.t('site.product');
  const path = langPath(lang, page.slug);
  const card = socialCard(L, page);
  const fullTitle = pageTitle(card.title);
  const description = page.description ? page.description(L) : L.t(`${page.key}.description`);
  const image = `${SITE_URL}${card.image}`;
  const nav = readyTools()
    .map((t) => {
      const href = langPath(lang, `${t.slug}/`);
      return `<a href="${href}"${path.startsWith(href) ? ` class="on"${href === path ? ' aria-current="page"' : ''}` : ''}>${esc(L.t(`${t.key}.nav`))}</a>`;
    })
    .join('');
  const alternates = [...LANGS, 'x-default']
    .map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE_URL}${langPath(l === 'x-default' ? X_DEFAULT : l, page.slug)}">`)
    .join('\n');
  // Переключатель: та же страница на другом языке. Состояние (?…) браузер
  // дописывает к этим ссылкам после каждого изменения — assets/page.js.
  const langs = LANGS
    .map((l) => {
      const name = DICTS[l]['site.langName'];
      const on = l === lang ? ' class="on" aria-current="true"' : '';
      return `<a href="${langPath(l, page.slug)}" hreflang="${l}" lang="${l}" data-lang="${l}"${on}><span aria-hidden="true">${l.toUpperCase()}</span><span class="sr">${esc(name)}</span></a>`;
    })
    .join('');
  const scripts = page.scripts || [];
  const preload = scripts.length ? `\n<link rel="modulepreload" href="/i18n/${lang}.js">` : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE_URL}${path}">
${alternates}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(BRAND)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(card.url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${SOCIAL_WIDTH}">
<meta property="og:image:height" content="${SOCIAL_HEIGHT}">
<meta property="og:image:alt" content="${esc(card.alt)}">
<meta property="og:locale" content="${SOCIAL_LOCALES[lang]}">
${LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${SOCIAL_LOCALES[l]}">`).join('\n')}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="twitter:image:alt" content="${esc(card.alt)}">
<link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16 32x32 48x48">
<link rel="stylesheet" href="/fonts.css">
<link rel="stylesheet" href="/style.css">${preload}
</head>
<body>
<header class="site"><div class="inner">
<a class="brand" href="${langPath(lang)}"><img class="brand-mark" src="/logo.png" alt="" width="32" height="32"><span class="brand-name">${BRAND}</span><span class="brand-sub">${esc(product.toLocaleLowerCase(lang))}</span></a>
<nav class="tools-nav" aria-label="${esc(product)}">${nav}</nav>
<nav class="langs" aria-label="${esc(L.t('site.lang'))}">${langs}</nav>
</div></header>
<main class="inner">
${page.body(L)}
</main>
<footer class="foot"><div class="inner">
<p>${L.t(page.key === 'calendar' ? 'calendar.foot' : 'site.foot.calc')}</p>
<p>${esc(L.t(page.key === 'calendar' ? 'calendar.privacy' : 'site.foot.privacy'))}</p>
</div></footer>
${scripts.map((s) => `<script type="module" src="${esc(s)}"></script>`).join('\n')}
</body>
</html>
`;
}
