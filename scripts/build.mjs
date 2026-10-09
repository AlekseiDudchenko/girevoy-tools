// Сборка статического сайта в dist/: страницы из src/pages/ в общей оболочке,
// файлы из assets/ — как есть в корень, чистые функции src/lib/ — в dist/lib/:
// браузер импортирует их из /lib/ те же, что проверяют тесты.
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout } from '../src/layout.js';
import { SITE_URL } from '../src/brand.js';
import { PAGES } from '../src/pages/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, process.argv[2] || 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'assets'), dist, { recursive: true });
cpSync(join(root, 'src', 'lib'), join(dist, 'lib'), { recursive: true });

// Версия стилей и скриптов — хеш их содержимого: после обновления браузер не возьмёт
// из кэша старый модуль к новой странице. Модули /lib/ получают версию через importmap.
const files = (dir, ext) => readdirSync(join(root, dir)).filter((f) => f.endsWith(ext)).sort();
const libFiles = files('src/lib', '.js');
const hash = createHash('sha256');
for (const f of [...files('assets', '.js'), ...files('assets', '.css')]) hash.update(readFileSync(join(root, 'assets', f)));
for (const f of libFiles) hash.update(readFileSync(join(root, 'src', 'lib', f)));
const version = hash.digest('hex').slice(0, 10);
const modules = libFiles.map((f) => `/lib/${f}`);

for (const page of PAGES) {
  const file = join(dist, page.path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, layout({ ...page, body: page.body(), version, modules }));
}

const urls = PAGES.map((p) => `  <url><loc>${SITE_URL}${p.path}</loc></url>`).join('\n');
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`dist: ${PAGES.length} страниц`);
