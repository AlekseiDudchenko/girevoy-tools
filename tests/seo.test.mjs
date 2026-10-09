import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PAGES } from '../src/pages/index.js';
import { LANGS } from '../src/i18n/index.js';

const out = mkdtempSync(join(tmpdir(), 'tools-seo-'));
execFileSync('node', ['scripts/build.mjs', out]);
const page = (lang, slug = '') => readFileSync(join(out, lang, slug, 'index.html'), 'utf8');

test('search titles describe the tools in each language and escape the ampersand', () => {
  const titles = {
    en: {
      '': 'Kettlebell Sport Tools &amp; Calculators | VseGiri',
      'tempo/': 'Kettlebell Sport Pace Calculator | VseGiri',
      'coefficients/': 'Kettlebell Weight Coefficient Calculator | VseGiri',
      'calendar/': 'Kettlebell Sport Competition Calendar | VseGiri',
    },
    de: {
      '': 'Tools und Rechner für Kettlebell-Sport | VseGiri',
      'tempo/': 'Tempo-Rechner für Kettlebell-Sport | VseGiri',
      'coefficients/': 'Koeffizienten-Rechner für Kettlebells | VseGiri',
      'calendar/': 'Wettkampfkalender für Kettlebell-Sport | VseGiri',
    },
  };
  for (const [lang, pages] of Object.entries(titles)) {
    for (const [slug, title] of Object.entries(pages)) {
      assert.ok(page(lang, slug).includes(`<title>${title}</title>`), `${lang}/${slug}`);
    }
  }
  assert.match(page('en', 'tempo/'), /<h1>Kettlebell sport pace calculator<\/h1>/);
  assert.match(page('en', 'calendar/'), /<h1>Kettlebell sport competition calendar<\/h1>/);
  assert.match(page('de', 'tempo/'), /<h1>Tempo-Rechner für Kettlebell-Sport<\/h1>/);
  assert.match(page('de', 'calendar/'), /<h1>Wettkampfkalender für Kettlebell-Sport<\/h1>/);
  assert.match(page('en', 'tempo/'), />Pace<\/a>/);
});

test('every page including series has a distinct title and a clean self-canonical', () => {
  for (const lang of LANGS) {
    const titles = new Set();
    for (const { slug } of PAGES) {
      const html = page(lang, slug);
      const title = html.match(/<title>([^<]+)<\/title>/)[1];
      assert.ok(!titles.has(title), `${lang}/${slug}: duplicate title`);
      titles.add(title);
      assert.ok(!title.includes('— Tools'), `${lang}/${slug}: redundant product suffix`);
      assert.ok(html.includes(`<link rel="canonical" href="https://tools.vsegiri.com/${lang}/${slug}">`));
      assert.doesNotMatch(html, /rel="canonical"[^>]*[?#]/);
      assert.doesNotMatch(html, /hreflang="ru"|data-lang="ru"|https:\/\/vsegiri\.com(?:\/|["'])/);
    }
  }
  assert.ok(page('en', 'calendar/iukl-world-championship/').includes('<title>IUKL World Championship — dates and venues | VseGiri</title>'));
});

test('all known retired Russian pages permanently redirect to existing English pages', () => {
  const rules = readFileSync(join(out, '_redirects'), 'utf8').split('\n')
    .filter((line) => line && !line.startsWith('#')).map((line) => line.split(' '));
  const retired = rules.filter(([from]) => /^\/ru(?:\/|$)/.test(from));
  assert.ok(retired.some(([from, to, code]) => from === '/ru' && to === '/en/' && code === '301'));
  const sources = retired.map(([from]) => from);
  assert.equal(new Set(sources).size, sources.length, 'no duplicate retired rules');
  // Published Russian URLs before #25; new public pages do not extend this set.
  const retiredSlugs = ['', 'tempo/', 'coefficients/', 'calendar/',
    'calendar/iukl-world-championship/', 'calendar/iukl-european-championship/',
    'calendar/iukl-asian-championship/', 'calendar/ikmf-world-championship/',
    'calendar/wksf-european-open-championship/', 'calendar/weihnachts-snatch-berlin/'];
  assert.equal(retired.length, retiredSlugs.length * 2);
  for (const slug of retiredSlugs) {
    const from = `/ru/${slug}`;
    for (const source of [from, from.slice(0, -1)]) {
      assert.ok(retired.some(([old, to, code]) => old === source && to === `/en/${slug}` && code === '301'), source);
    }
  }
  for (const [from, to, code] of retired) {
    assert.equal(code, '301');
    assert.doesNotMatch(`${from} ${to}`, /[?*]/, 'only known pages; no query rewrite or broad wildcard');
    assert.ok(existsSync(join(out, to, 'index.html')), to);
    assert.ok(!existsSync(join(out, from, 'index.html')), from);
  }
  assert.ok(!existsSync(join(out, 'ru')));
  assert.ok(!existsSync(join(out, 'i18n', 'ru.js')));
  assert.doesNotMatch(readFileSync(join(out, 'sitemap.xml'), 'utf8'), /\/ru\/|hreflang="ru"/);
});

test('retired redirects survive page removal and ignore newly added pages', () => {
  // Isolate registry changes from other build tests.
  const result = JSON.parse(execFileSync('node', ['--input-type=module', '-e', `
    import { PAGES } from './src/pages/index.js';
    import { redirects } from './src/redirects.js';
    const before = redirects();
    PAGES.splice(0, PAGES.length, { slug: 'calendar/new-series/' });
    console.log(JSON.stringify({ before, after: redirects() }));
  `], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }));
  assert.equal(result.after, result.before);
  assert.ok(result.after.includes('/ru/calendar/iukl-world-championship/ /en/calendar/iukl-world-championship/ 301'));
  assert.doesNotMatch(result.after, /\/ru\/calendar\/new-series/);
});
