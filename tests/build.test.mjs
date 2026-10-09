import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PAGES } from '../src/pages/index.js';
import { TOOLS } from '../src/tools.js';
import { esc } from '../src/html.js';
import { LANGS } from '../src/i18n/index.js';

const out = mkdtempSync(join(tmpdir(), 'tools-dist-'));
execFileSync('node', ['scripts/build.mjs', out]);

test('каждая страница собрана на каждом языке, с заголовком, описанием и канонической ссылкой', () => {
  for (const lang of LANGS) {
    for (const page of PAGES) {
      const html = readFileSync(join(out, lang, page.slug, 'index.html'), 'utf8');
      assert.match(html, new RegExp(`<html lang="${lang}">`));
      assert.match(html, /<title>[^<]+<\/title>/);
      assert.match(html, /<meta name="description" content="[^"]+">/);
      assert.ok(html.includes(`<link rel="canonical" href="https://tools.vsegiri.com/${lang}/${page.slug}">`));
    }
  }
});

test('у каждой готовой карточки есть страница, у готовящейся — нет ссылки', () => {
  for (const lang of LANGS) {
    const home = readFileSync(join(out, lang, 'index.html'), 'utf8');
    for (const tool of TOOLS) {
      const linked = home.includes(`href="/${lang}/${tool.slug}/"`);
      assert.equal(linked, tool.status === 'ready', `${lang} ${tool.slug}`);
      if (tool.status === 'ready') assert.ok(PAGES.some((p) => p.slug === `${tool.slug}/`), tool.slug);
    }
  }
});

test('стили, шрифты и sitemap лежат в корне', () => {
  for (const f of ['style.css', 'fonts.css', 'logo.png', 'favicon.ico', 'sitemap.xml', 'robots.txt']) {
    assert.ok(existsSync(join(out, f)), f);
  }
  const fonts = readFileSync(join(out, 'fonts.css'), 'utf8');
  for (const [, url] of fonts.matchAll(/url\(([^)]+)\)/g)) assert.ok(existsSync(join(out, url)), url);
});

test('esc экранирует разметку', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});
