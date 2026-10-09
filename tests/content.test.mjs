import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locale, LANGS } from '../src/i18n/index.js';
import { PACE_EXAMPLES, tempoGuide, coefficientsGuide } from '../src/pages/guides.js';
import { parseState, repsOf, rows } from '../src/lib/tempo.js';
import { parseState as parseCoefficient, heavyReps, scoreOf } from '../src/lib/coefficients.js';
import { PAGES } from '../src/pages/index.js';
import { layout } from '../src/layout.js';
import { SERIES_INFO, seriesInfo } from '../src/calendar-series-info.js';

const hrefs = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&'));

test('localized example links reproduce the stated pace totals and hand split', () => {
  for (const lang of LANGS) {
    const links = hrefs(tempoGuide(locale(lang)));
    assert.equal(links.length, 3);
    const plans = links.map((href, i) => {
      const url = new URL(href, 'https://tools.vsegiri.com');
      assert.equal(url.pathname, `/${lang}/tempo/`);
      const state = parseState(url.search);
      assert.deepEqual(state, PACE_EXAMPLES[i].state);
      const reps = repsOf(state);
      assert.equal(reps.reduce((a, b) => a + b), state.goal);
      return { state, reps };
    });
    assert.deepEqual(plans[0].reps, Array(10).fill(10));
    assert.ok(plans[1].reps[0] < plans[1].reps.at(-1));
    const snatch = rows(plans[2].state).at(-1);
    assert.equal(snatch.h1, 80);
    assert.equal(snatch.h2, 80);
  }
});

test('coefficient example opens the stated model and rounds required reps up', () => {
  for (const lang of LANGS) {
    const url = new URL(hrefs(coefficientsGuide(locale(lang)))[0], 'https://tools.vsegiri.com');
    assert.equal(url.pathname, `/${lang}/coefficients/`);
    const state = parseCoefficient(url.search);
    assert.equal(state.light, 24);
    assert.equal(state.heavy, 32);
    assert.equal(state.k, 1.6);
    assert.equal(scoreOf(50, state.k), 80);
    assert.equal(heavyReps(81, state.k), 51);
  }
});

test('guides are present in initial HTML and sourced edition copy survives date refresh', () => {
  for (const lang of LANGS) {
    const L = locale(lang);
    for (const slug of ['', 'tempo/', 'coefficients/']) {
      const html = layout(L, PAGES.find((p) => p.slug === slug));
      assert.equal([...html.matchAll(/<section class="reading"/g)].length, 1);
      assert.ok(html.indexOf('<section class="reading"') > html.lastIndexOf('class="js-only"'));
      if (slug === 'coefficients/') assert.ok(html.indexOf('id="coef-guide"') > html.indexOf('id="table-body"'));
      assert.doesNotMatch(html, /\{(?:goal|target|perHand|date)\}/);
    }
    for (const page of PAGES.filter((p) => p.slug.startsWith('calendar/'))) {
      const slug = page.slug.split('/')[1];
      const html = layout(L, page);
      if (SERIES_INFO[slug]) {
        assert.ok(html.includes(seriesInfo(L, slug)));
        assert.ok(html.indexOf('id="series-info"') > html.indexOf('</section>'));
        assert.ok(html.includes(SERIES_INFO[slug].url));
        assert.ok(html.includes(L.t('calendar.info.scope')));
      } else assert.ok(!html.includes('id="series-info"'), 'no unsupported boilerplate');
    }
  }
});
