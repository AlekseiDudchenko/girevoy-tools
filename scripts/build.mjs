// Сборка статического сайта в dist/: каждая страница из src/pages/ на каждом языке
// из src/i18n/ — в /<язык>/<slug>/index.html; файлы из assets/ — как есть в корень;
// чистые функции src/lib/ — в dist/lib/, словари src/i18n/ — в dist/i18n/: браузер
// импортирует те же модули, что проверяют тесты.
import { readFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schemaErrors } from '../src/lib/calendar-schema.js';
import { validateEvents, eventICS } from '../src/lib/calendar.js';
import { layout } from '../src/layout.js';
import { SITE_URL } from '../src/brand.js';
import { LANGS, locale } from '../src/i18n/index.js';
import { X_DEFAULT, langPath } from '../src/lib/locale.js';
import { PAGES } from '../src/pages/index.js';
import { redirects } from '../src/redirects.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, process.argv[2] || 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'assets'), dist, { recursive: true });
cpSync(join(root, 'src', 'lib'), join(dist, 'lib'), { recursive: true });
mkdirSync(join(dist, 'i18n'), { recursive: true });
for (const lang of LANGS) cpSync(join(root, 'src', 'i18n', `${lang}.js`), join(dist, 'i18n', `${lang}.js`));

for (const lang of LANGS) {
  const L = locale(lang);
  for (const page of PAGES) {
    const file = join(dist, langPath(lang, page.slug), 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, layout(L, page));
  }
}

const events = validateEvents(JSON.parse(readFileSync(join(root, 'data/calendar/events.json'), 'utf8')));
const eventSchema = JSON.parse(readFileSync(join(root, 'data/calendar/event.schema.json'), 'utf8'));
for (const event of events) { const errors = schemaErrors(event, eventSchema); if (errors.length) throw new Error(errors.join(', ')); }
mkdirSync(join(dist, 'calendar/ics'), {recursive:true});
cpSync(join(root, 'data/calendar/event.schema.json'), join(dist, 'calendar/event.schema.json'));
writeFileSync(join(dist, 'calendar/events.json'), JSON.stringify(events));
for (const event of events) writeFileSync(join(dist, 'calendar/ics', event.id + '.ics'), eventICS(event));

// sitemap: каждая версия со ссылками на остальные языки.
const loc = (lang, slug) => `${SITE_URL}${langPath(lang, slug)}`;
const urls = PAGES.flatMap((p) => LANGS.map((lang) => {
  const alt = [...LANGS, 'x-default']
    .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${loc(l === 'x-default' ? X_DEFAULT : l, p.slug)}"/>`)
    .join('\n');
  return `  <url>\n    <loc>${loc(lang, p.slug)}</loc>\n${alt}\n  </url>`;
})).join('\n');
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
writeFileSync(join(dist, '_redirects'), redirects());

console.log(`dist: ${PAGES.length} страниц × ${LANGS.length} языка`);
