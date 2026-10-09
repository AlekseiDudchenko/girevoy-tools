import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DICTS, LANGS, locale } from '../src/i18n/index.js';
import { X_DEFAULT, makeLocale, switchPath } from '../src/lib/locale.js';
import { parseNumber } from '../src/lib/format.js';
import { defaultState as coefState, parseState as coefParse } from '../src/lib/coefficients.js';
import { calcText, readout, scoreChart, tableHead as coefHead } from '../src/lib/coefficients-view.js';
import { defaultState as tempoState, goalError, parseRate, rateText, secPerRep } from '../src/lib/tempo.js';
import { barChart, errorText, summary, tableHead } from '../src/lib/tempo-view.js';
import { PAGES } from '../src/pages/index.js';
import { redirects } from '../src/redirects.js';
import { BRAND } from '../src/brand.js';

const out = mkdtempSync(join(tmpdir(), 'tools-i18n-'));
execFileSync('node', ['scripts/build.mjs', out]);
const page = (lang, slug) => readFileSync(join(out, lang, slug, 'index.html'), 'utf8');
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/ /g, ' ');
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// ------------------------------------------------------------- словари

test('у каждого ключа словаря есть перевод на все языки, того же вида', () => {
  const keys = Object.keys(DICTS.en).sort();
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(DICTS[lang]).sort(), keys, `ключи ${lang} совпадают с ru`);
    const categories = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
    for (const key of keys) {
      const value = DICTS[lang][key];
      assert.equal(typeof value, typeof DICTS.en[key], `${lang} ${key}`);
      if (typeof value === 'string') {
        assert.ok(value.trim(), `${lang} ${key}: пусто`);
        assert.deepEqual([...new Set(placeholders(value))], [...new Set(placeholders(DICTS.en[key]))], `${lang} ${key}: подстановки`);
      } else {
        for (const c of categories) assert.ok(value[c], `${lang} ${key}: нет формы ${c}`);
      }
    }
  }
});

test('нет строки — ошибка, а не пустое место', () => {
  const L = locale('en');
  assert.throws(() => L.t('nope'), /nope/);
  assert.throws(() => makeLocale('fr', {}), /fr/);
  assert.equal(L.t('tempo.bar.label', { m: 3 }), 'Minute 3');
});

test('склонения — по правилам языка', () => {
  const en = locale('en');
  assert.deepEqual([0, 1, 2].map((n) => en.plural(n, 'reps')), ['reps', 'rep', 'reps']);
  const de = locale('de');
  assert.deepEqual([1, 5].map((n) => de.plural(n, 'minutes')), ['Minute', 'Minuten']);
});

// ------------------------------------------------------------- числа

test('числа — через Intl языка страницы: десятичная запятая по-русски и по-немецки', () => {
  const [en, de] = LANGS.map(locale);
  assert.equal(en.num(1.333, 2), '1.33');
  assert.equal(de.num(1.333, 2), '1,33');
  assert.equal(en.num(80, 1), '80.0');
  assert.equal(de.dec(7.5), '7,5');
  assert.equal(en.dec(8), '8');
  assert.equal(en.num(1800, 0), '1800', 'без разделителя тысяч');
  assert.equal(de.num(1800.5, 1), '1800,5');
  assert.equal(rateText(en, 725), '7.25');
  assert.equal(rateText(de, 750), '7,5');
  assert.equal(secPerRep(en, 7), '8.6');
  assert.equal(calcText(en, 81.13), '81.13');
  assert.equal(calcText(de, 81.13), '81,13');
});

test('ввод принимает и запятую, и точку на любом языке', () => {
  assert.equal(parseNumber('81,13'), 81.13);
  assert.equal(parseNumber('81.13'), 81.13);
  assert.equal(parseRate('7,5'), 750);
  assert.equal(parseRate('7.5'), 750);
  assert.equal(coefParse('?k=1,45').k, 1.45);
});

// ------------------------------------------------------------- подписи

test('подписи графиков, таблиц и расшифровка зависят от языка', () => {
  const [en, de] = LANGS.map(locale);
  const st = coefState();
  assert.match(scoreChart(en, st), />reps<.*>score</);
  assert.match(scoreChart(de, st), />Wiederholungen<.*>Punktzahl</);
  assert.equal(text(readout(en, { ...st, k: 1.6 })), 'Score 80: 80 reps with 24 kg or 50 with 32 kg (50 × 1.60 = 80.0)');
  assert.equal(text(readout(de, { ...st, k: 1.6 })), 'Punktzahl 80: 80 Wiederholungen mit 24 kg oder 50 mit 32 kg (50 × 1,60 = 80,0)');
  assert.match(coefHead(en, st), /Reps with 24\u00a0kg<br><span class="n">× 1.00<\/span>/);
  const tp = tempoState();
  assert.match(barChart(en, tp), />per minute<.*>even 8</);
  assert.match(barChart(de, tp), /aria-valuetext="7 Wiederholungen, 8,6 s pro Wiederholung"/);
  assert.match(tableHead(en, tp), /Seconds per&nbsp;rep/);
  assert.equal(text(summary(en, tp)), 'Plan total: 80 reps in 10 minutes, 8 per minute on average. By minute: 7, 7, 8 × 7, 10.');
  assert.equal(errorText(en, goalError(3, 5, 'even', 2)), 'Minute 1 comes out at 0 reps, fewer than 1 per minute. Raise the goal.');
  assert.equal(errorText(de, goalError(301, 10, 'even', 2)), 'In 10 Minuten höchstens 300 Wiederholungen: 30 pro Minute.');
});

test('каждая страница каждого языка ссылается hreflang на все версии, x-default — на английскую', () => {
  for (const lang of LANGS) {
    for (const p of PAGES) {
      const html = page(lang, p.slug);
      assert.match(html, new RegExp(`<html lang="${lang}">`));
      for (const other of LANGS) {
        assert.ok(html.includes(`<link rel="alternate" hreflang="${other}" href="https://tools.vsegiri.com/${other}/${p.slug}">`), `${lang}/${p.slug} → ${other}`);
        // Переключатель ведёт на ту же страницу на другом языке.
        assert.ok(html.includes(`<a href="/${other}/${p.slug}" hreflang="${other}" lang="${other}" data-lang="${other}"`), `${lang}/${p.slug}: переключатель ${other}`);
      }
      assert.ok(html.includes(`<link rel="alternate" hreflang="x-default" href="https://tools.vsegiri.com/${X_DEFAULT}/${p.slug}">`));
    }
  }
});

test('английские и немецкие страницы — без русского текста, кроме бренда', () => {
  for (const lang of ['en', 'de']) {
    for (const p of PAGES) {
      const html = page(lang, p.slug).replace(/<nav class="langs"[\s\S]*?<\/nav>/, '');
      const rest = text(html).replaceAll(BRAND, '');
      assert.doesNotMatch(rest, /[а-яё]/i, `${lang}/${p.slug}: ${rest.match(/.{0,40}[а-яё]+.{0,40}/i)?.[0]}`);
    }
  }
});

test('в коде страниц и разметки нет текста: только ключи словаря', () => {
  const files = [
    ...['coefficients-view.js', 'tempo-view.js', 'tempo.js'].map((f) => join('src', 'lib', f)),
    ...readdirSync('src/pages').map((f) => join('src', 'pages', f)),
    'src/layout.js',
    ...readdirSync('assets').filter((f) => f.endsWith('.js')).map((f) => join('assets', f)),
  ];
  for (const file of files) {
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '$1');
    assert.doesNotMatch(code, /[а-яё]/i, `${file}: ${code.match(/.{0,40}[а-яё]+.{0,40}/i)?.[0]}`);
  }
});

test('sitemap: все версии всех страниц', () => {
  const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8');
  for (const lang of LANGS) {
    for (const p of PAGES) assert.ok(sitemap.includes(`<loc>https://tools.vsegiri.com/${lang}/${p.slug}</loc>`), `${lang}/${p.slug}`);
  }
  assert.equal(sitemap.match(/<url>/g).length, LANGS.length * PAGES.length);
  assert.match(sitemap, /hreflang="x-default" href="https:\/\/tools.vsegiri.com\/en\/tempo\/"/);
});

// ------------------------------------------------------------- старые адреса

test('_redirects: корень и старые адреса без языка — на английскую версию', () => {
  const file = readFileSync(join(out, '_redirects'), 'utf8');
  assert.equal(file, redirects());
  const rules = file.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split(' '));
  assert.deepEqual(rules, [
    ['/', '/en/', '302'],
    ['/calendar', '/en/calendar/', '301'],
    ['/calendar/', '/en/calendar/', '301'],
    ['/tempo', '/en/tempo/', '301'],
    ['/tempo/', '/en/tempo/', '301'],
    ['/tempo/*', '/en/tempo/:splat', '301'],
    ['/coefficients', '/en/coefficients/', '301'],
    ['/coefficients/', '/en/coefficients/', '301'],
    ['/coefficients/*', '/en/coefficients/:splat', '301'],
  ]);
  for (const [from, to] of rules) {
    // ?… не переписывается в правиле: Cloudflare Pages переносит его сам.
    assert.doesNotMatch(`${from} ${to}`, /\?/);
    // Цель существует, источник — нет: правило не перекрывает страницы и файлы сайта.
    assert.ok(existsSync(join(out, to.replace(':splat', ''), 'index.html')), to);
    if (from !== '/' && !from.endsWith('*')) assert.ok(!existsSync(join(out, from, 'index.html')), from);
    assert.ok(!LANGS.some((l) => from.startsWith(`/${l}/`)), `${from}: без петли`);
  }
});

test('переключатель языка сохраняет путь', () => {
  assert.equal(switchPath('/en/coefficients/', 'de'), '/de/coefficients/');
  assert.equal(switchPath('/de/', 'en'), '/en/');
  assert.equal(switchPath('/en', 'de'), '/de/');
  assert.equal(switchPath('/tempo/', 'en'), '/en/tempo/');
});
