import { ARCHIVE_URL, BRAND, SITE_URL, pageTitle } from './brand.js';
import { esc } from './html.js';
import { DICTS } from './i18n/index.js';
import { LANGS, X_DEFAULT, langPath } from './lib/locale.js';
import { readyTools } from './tools.js';

// Оболочка страницы: <head>, шапка, подвал. Стили и скрипты — файлами из assets/,
// в HTML встроены только данные конкретной страницы. Весь текст — из словаря
// языка L; адрес страницы — /<язык>/<slug>.
export function layout(L, page) {
  const { lang } = L;
  const product = L.t('site.product');
  const path = langPath(lang, page.slug);
  const fullTitle = page.slug === '' ? `${product} | ${BRAND}` : pageTitle(L.t(`${page.key}.title`), product);
  const nav = readyTools()
    .map((t) => {
      const href = langPath(lang, `${t.slug}/`);
      return `<a href="${href}"${href === path ? ' class="on" aria-current="page"' : ''}>${esc(L.t(`${t.key}.nav`))}</a>`;
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
<meta name="description" content="${esc(L.t(`${page.key}.description`))}">
<link rel="canonical" href="${SITE_URL}${path}">
${alternates}
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="/fonts.css">
<link rel="stylesheet" href="/style.css">${preload}
</head>
<body>
<header class="site"><div class="inner">
<a class="brand" href="${langPath(lang)}"><img class="brand-mark" src="/logo.png" alt="" width="32" height="32"><span class="brand-name">${BRAND}</span><span class="brand-sub">${esc(product.toLocaleLowerCase(lang))}</span></a>
<nav class="tools-nav" aria-label="${esc(product)}">${nav}<a href="${ARCHIVE_URL}/"${lang === 'ru' ? '' : ' hreflang="ru"'}>${esc(L.t('site.archive'))}</a></nav>
<nav class="langs" aria-label="${esc(L.t('site.lang'))}">${langs}</nav>
</div></header>
<main class="inner">
${page.body(L)}
</main>
<footer class="foot"><div class="inner">
<p>${L.t(page.key === 'calendar' ? 'calendar.foot' : 'site.foot.calc', { archive: `${ARCHIVE_URL}/` })}</p>
<p>${esc(L.t(page.key === 'calendar' ? 'calendar.privacy' : 'site.foot.privacy'))}</p>
</div></footer>
${scripts.map((s) => `<script type="module" src="${esc(s)}"></script>`).join('\n')}
</body>
</html>
`;
}
