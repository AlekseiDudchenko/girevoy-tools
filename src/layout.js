import { ARCHIVE_URL, BRAND, PRODUCT, SITE_URL, pageTitle } from './brand.js';
import { esc } from './html.js';
import { readyTools } from './tools.js';

// Оболочка страницы: <head>, шапка, подвал. Стили и скрипты — файлами из assets/,
// в HTML встроены только данные конкретной страницы.
export function layout({ path, title, description, body, scripts = [] }) {
  const fullTitle = path === '/' ? `${PRODUCT} | ${BRAND}` : pageTitle(title);
  const nav = readyTools()
    .map((t) => {
      const href = `/${t.slug}/`;
      return `<a href="${href}"${href === path ? ' class="on" aria-current="page"' : ''}>${esc(t.nav)}</a>`;
    })
    .join('');
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE_URL}${path}">
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="/fonts.css">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="site"><div class="inner">
<a class="brand" href="/"><img class="brand-mark" src="/logo.png" alt="" width="32" height="32"><span class="brand-name">${BRAND}</span><span class="brand-sub">${esc(PRODUCT.toLowerCase())}</span></a>
<nav aria-label="Инструменты">${nav}<a href="${ARCHIVE_URL}/">Гиревой архив</a></nav>
</div></header>
<main class="inner">
${body}
</main>
<footer class="foot"><div class="inner">
<p>Расчёты на этих страницах — ваш ввод и арифметика, а не данные протоколов. Результаты соревнований — в <a href="${ARCHIVE_URL}/">Гиревом архиве</a>.</p>
<p>Ничего из введённого на сервер не отправляется.</p>
</div></footer>
${scripts.map((s) => `<script type="module" src="${esc(s)}"></script>`).join('\n')}
</body>
</html>
`;
}
