import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { PAGES } from '../src/pages/index.js';
import { LANGS, locale } from '../src/i18n/index.js';
import { layout } from '../src/layout.js';
import { esc } from '../src/html.js';
import { socialCard } from '../src/social.js';

const out = mkdtempSync(join(tmpdir(), 'tools-social-'));
execFileSync('node', ['scripts/build.mjs', out]);
const site = 'https://tools.vsegiri.com';
const published = (lang, slug) => readFileSync(join(out, lang, slug, 'index.html'), 'utf8');
const meta = (html, attr, key) => {
  const matches = [...html.matchAll(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`, 'g'))];
  assert.equal(matches.length, 1, `${key}: exactly one nonempty tag`);
  assert.ok(matches[0][1], key);
  return matches[0][1];
};

test('all localized pages and series publish complete matching social and search metadata', () => {
  const images = new Set();
  for (const lang of LANGS) {
    const L = locale(lang);
    for (const page of PAGES) {
      const html = published(lang, page.slug);
      const og = (key) => meta(html, 'property', `og:${key}`);
      const twitter = (key) => meta(html, 'name', `twitter:${key}`);
      const title = html.match(/<title>([^<]+)<\/title>/)[1];
      const description = meta(html, 'name', 'description');
      assert.equal(og('title'), title);
      assert.equal(twitter('title'), title);
      assert.equal(og('description'), description);
      assert.equal(twitter('description'), description);
      assert.equal(og('url'), `${site}/${lang}/${page.slug}`);
      assert.ok(html.includes(`<link rel="canonical" href="${og('url')}">`));
      assert.doesNotMatch(og('url'), /[?#]/);
      assert.equal(og('type'), 'website');
      assert.equal(og('site_name'), 'VseGiri');
      assert.equal(og('locale'), lang === 'en' ? 'en_GB' : 'de_DE');
      assert.equal(og('locale:alternate'), lang === 'en' ? 'de_DE' : 'en_GB');
      assert.equal(twitter('card'), 'summary_large_image');
      assert.equal(og('image:type'), 'image/png');
      assert.equal(og('image:width'), '1200');
      assert.equal(og('image:height'), '630');
      assert.equal(twitter('image'), og('image'));
      assert.equal(og('image:alt'), esc(L.t('site.socialImageAlt', { title: page.title ? page.title(L) : L.t(`${page.key}.seoTitle`) })));
      assert.equal(twitter('image:alt'), og('image:alt'));
      const image = new URL(og('image'));
      assert.equal(image.origin, site);
      assert.ok(image.pathname.startsWith(`/social/${lang}/`));
      assert.ok(image.pathname.endsWith('.png'));
      assert.equal(image.search, '');
      assert.ok(!images.has(image.href), `distinct page card: ${image.href}`);
      images.add(image.href);
      assert.doesNotMatch(html, /hreflang="ru"|data-lang="ru"|https:\/\/vsegiri\.com(?:\/|["'])/);
    }
  }
  assert.equal(images.size, PAGES.length * LANGS.length);
});

// Validate PNG structure/checksums and decompress its actual pixels, without
// requiring an image library in Node CI. A renamed SVG or truncated PNG fails.
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

test('every declared image is a copied valid 1200×630 PNG with decodable pixels', () => {
  for (const lang of LANGS) for (const page of PAGES) {
    const html = published(lang, page.slug);
    const path = new URL(meta(html, 'property', 'og:image')).pathname;
    const png = readFileSync(join(out, path));
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), path);
    assert.deepEqual(png, readFileSync(join('assets', path)), `unchanged export: ${path}`);
    const data = [];
    let position = 8;
    let ended = false;
    while (position < png.length) {
      const length = png.readUInt32BE(position);
      const type = png.toString('ascii', position + 4, position + 8);
      const end = position + 8 + length;
      assert.ok(end + 4 <= png.length, `${path}: truncated ${type}`);
      assert.equal(crc32(png.subarray(position + 4, end)), png.readUInt32BE(end), `${path}: ${type} checksum`);
      if (position === 8) {
        assert.equal(type, 'IHDR');
        assert.equal(length, 13);
        assert.equal(png.readUInt32BE(position + 8), 1200);
        assert.equal(png.readUInt32BE(position + 12), 630);
        assert.deepEqual([...png.subarray(position + 16, position + 21)], [8, 2, 0, 0, 0], '8-bit RGB, noninterlaced');
      }
      if (type === 'IDAT') data.push(png.subarray(position + 8, end));
      position = end + 4;
      if (type === 'IEND') {
        assert.equal(length, 0);
        ended = true;
        break;
      }
    }
    assert.ok(ended, `${path}: IEND present`);
    assert.equal(position, png.length, 'no trailing data');
    const pixels = inflateSync(Buffer.concat(data));
    assert.equal(pixels.length, (1200 * 3 + 1) * 630);
    for (let row = 0; row < 630; row++) assert.ok(pixels[row * (1200 * 3 + 1)] <= 4, 'valid PNG row filter');
  }
});

test('checked-in card copy matches current localized pages and approved logo', () => {
  const manifest = JSON.parse(readFileSync(join(out, 'social', 'manifest.json'), 'utf8'));
  assert.equal(manifest.width, 1200);
  assert.equal(manifest.height, 630);
  assert.equal(manifest.logoSha256, createHash('sha256').update(readFileSync('assets/logo.png')).digest('hex'), 'regenerate cards after a logo change');
  assert.deepEqual(manifest.cards, LANGS.flatMap((lang) => PAGES.map((page) => socialCard(locale(lang), page))), 'regenerate cards after changing page copy or adding a page');
});

test('social attributes escape quotes, ampersands and HTML in page copy', () => {
  const page = { ...PAGES[0], title: () => '<Tools "pace" & calendar>', description: () => '"Description" & <script>alert(1)</script>' };
  for (const lang of LANGS) {
    const html = layout(locale(lang), page);
    const head = html.split('</head>')[0];
    assert.equal(meta(head, 'property', 'og:title'), '&lt;Tools &quot;pace&quot; &amp; calendar&gt; | VseGiri');
    assert.equal(meta(head, 'name', 'twitter:title'), meta(head, 'property', 'og:title'));
    assert.equal(meta(head, 'property', 'og:description'), '&quot;Description&quot; &amp; &lt;script&gt;alert(1)&lt;/script&gt;');
    assert.equal(meta(head, 'name', 'twitter:description'), meta(head, 'property', 'og:description'));
    assert.ok(meta(head, 'property', 'og:image:alt').includes('&lt;Tools &quot;pace&quot; &amp; calendar&gt;'));
    assert.doesNotMatch(head, /<script>|<Tools /);
  }
});

test('social metadata preserves reciprocal hreflang and a public-only sitemap', () => {
  const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8');
  assert.equal([...sitemap.matchAll(/<loc>/g)].length, PAGES.length * LANGS.length);
  assert.doesNotMatch(sitemap, /\/ru\/|https:\/\/vsegiri\.com(?:\/|["'])/);
  for (const lang of LANGS) for (const page of PAGES) {
    const html = published(lang, page.slug);
    for (const other of [...LANGS, 'x-default']) {
      const expected = `${site}/${other === 'x-default' ? 'en' : other}/${page.slug}`;
      assert.ok(html.includes(`<link rel="alternate" hreflang="${other}" href="${expected}">`));
    }
    assert.ok(sitemap.includes(`<loc>${site}/${lang}/${page.slug}</loc>`));
  }
});
