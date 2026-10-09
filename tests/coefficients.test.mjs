import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  K_MAX, convert, defaultK, defaultState, equivalentK, heavyReps, parseNumber, parseState,
  scoreOf, serializeState, sliderMax, tableRows, validCalc, validTable,
} from '../src/lib/coefficients.js';
import { calcNote, bellColor, colorVars, niceAxis, readout, scoreChart, equivChart, tableBody } from '../src/lib/coefficients-view.js';
import { locale } from '../src/i18n/index.js';

const L = locale('ru');

// ------------------------------------------------------------- расчёт

test('подъёмы на тяжёлой округляются вверх', () => {
  assert.equal(heavyReps(60, 1.6), 38); // 37,5 → 38
  assert.equal(heavyReps(100, 1.6), 63); // 62,5 → 63
  assert.equal(heavyReps(90, 1.6), 57); // 56,25 → 57
  assert.equal(heavyReps(50, 1.33), 38); // 37,59 → 38
  for (const score of [1, 7, 40, 99, 140, 333]) {
    for (const k of [1, 1.07, 1.25, 1.33, 1.5, 1.6, 2, 3.99]) {
      const n = heavyReps(score, k);
      assert.ok(scoreOf(n, k) >= score, `${n} × ${k} ≥ ${score}`);
      assert.ok(scoreOf(n - 1, k) < score, `${n - 1} × ${k} < ${score}`);
    }
  }
});

test('k = 1: подъёмов столько же, сколько зачётный результат', () => {
  for (const score of [1, 40, 80, 137]) assert.equal(heavyReps(score, 1), score);
});

test('дробные k', () => {
  assert.equal(heavyReps(80, 1.33), 61); // 60,15 → 61
  assert.equal(heavyReps(100, 1.25), 80); // ровно
  assert.equal(heavyReps(100, 1.26), 80); // 79,37 → 80
  assert.equal(heavyReps(10, 3.33), 4); // 3,003 → 4
  assert.equal(heavyReps(111, 1.11), 100); // ровно
});

test('граница плавающей точки: 50 × 1,6 = 80 → 50, а не 51', () => {
  assert.equal(heavyReps(80, 1.6), 50);
  assert.equal(heavyReps(120, 1.6), 75);
  // В double 21 / 1.4 = 15.000000000000002: наивный ceil дал бы 16 — поэтому сотые.
  assert.equal(Math.ceil(21 / 1.4), 16);
  assert.equal(heavyReps(21, 1.4), 15);
  assert.equal(heavyReps(69, 1.15), 60);
  assert.equal(heavyReps(69, 2.3), 30);
  assert.equal(scoreOf(50, 1.6), 80);
});

test('таблица из задачи: 24 и 32 кг, k = 1,60', () => {
  const rows = tableRows({ k: 1.6, step: 20, from: 40, to: 120 });
  assert.deepEqual(rows.map((r) => [r.light, r.heavy, r.score]), [
    [40, 25, 40], [60, 38, 60], [80, 50, 80], [100, 63, 100], [120, 75, 120],
  ]);
  assert.equal(tableRows({ k: 1.6, step: 10, from: 40, to: 140 }).length, 11);
  assert.equal(tableRows({ k: 1.6, step: 5, from: 40, to: 42 }).length, 1);
});

test('k из равноценных подъёмов и по весу гири', () => {
  assert.equal(equivalentK(80, 50), 1.6);
  assert.equal(equivalentK(80, 80), 1);
  assert.equal(equivalentK(80, 100), 1, 'k не меньше 1');
  assert.equal(equivalentK(80, 0), K_MAX);
  assert.equal(defaultK(24, 32), 1.33);
  assert.equal(defaultK(16, 24), 1.5);
  assert.equal(defaultK(8, 32), 4);
  assert.ok(sliderMax({ light: 24, heavy: 32, k: 1.33 }) >= 2);
  assert.ok(sliderMax({ light: 24, heavy: 32, k: 3.1 }) >= 3.1);
});

test('формат: десятичная запятая и склонение', () => {
  assert.equal(L.num(1.6, 2), '1,60');
  assert.equal(L.num(80, 1), '80,0');
  assert.equal(L.plural(1, 'reps'), 'подъём');
  assert.equal(L.plural(22, 'reps'), 'подъёма');
  assert.equal(L.plural(11, 'reps'), 'подъёмов');
  assert.equal(L.plural(80, 'reps'), 'подъёмов');
});

// ------------------------------------------------------------- адрес

test('состояние по умолчанию: 24 и 32 кг, k по весу гири', () => {
  const st = parseState('');
  assert.deepEqual(st, defaultState());
  assert.equal(st.light, 24);
  assert.equal(st.heavy, 32);
  assert.equal(st.k, 1.33);
  assert.equal(st.tab, 'score');
});

test('адрес из задачи читается', () => {
  const st = parseState('?light=24&heavy=32&k=1.6&tab=eq');
  assert.equal(st.k, 1.6);
  assert.equal(st.tab, 'eq');
  assert.equal(serializeState(st), '?light=24&heavy=32&k=1.6&tab=eq');
});

// ------------------------------------------------------------- пересчёт

test('пересчёт: подъёмы на лёгкой → тяжёлая и результат', () => {
  assert.deepEqual(convert(1.33, 'light', 80), { light: 80, heavy: 61, score: 80 });
  assert.deepEqual(convert(1.6, 'light', 80), { light: 80, heavy: 50, score: 80 }); // не 51
  assert.deepEqual(convert(1, 'light', 77), { light: 77, heavy: 77, score: 77 });
});

test('пересчёт: подъёмы на тяжёлой → результат точно до сотых, лёгкая вверх', () => {
  assert.deepEqual(convert(1.33, 'heavy', 61), { light: 82, heavy: 61, score: 81.13 });
  assert.deepEqual(convert(1.6, 'heavy', 50), { light: 80, heavy: 50, score: 80 });
  assert.deepEqual(convert(1.15, 'heavy', 60), { light: 69, heavy: 60, score: 69 }); // 60 × 1,15 = 69, не 69,000…01
  assert.deepEqual(convert(1.4, 'heavy', 15), { light: 21, heavy: 15, score: 21 });
});

test('пересчёт: результат → наименьшие подъёмы на обеих гирях', () => {
  assert.deepEqual(convert(1.33, 'score', 81.13), { light: 82, heavy: 61, score: 81.13 });
  assert.deepEqual(convert(1.6, 'score', 80), { light: 80, heavy: 50, score: 80 });
  assert.deepEqual(convert(2.3, 'score', 69), { light: 69, heavy: 30, score: 69 });
  for (const k of [1, 1.07, 1.33, 1.5, 2.37]) {
    for (const v of [1, 33, 80, 141]) {
      const r = convert(k, 'heavy', v);
      assert.equal(convert(k, 'score', r.score).heavy, v, `k=${k}, ${v} на тяжёлой`);
    }
  }
});

test('пересчёт: проверка ввода', () => {
  assert.equal(parseNumber('81,13'), 81.13);
  assert.equal(parseNumber(' 61 '), 61);
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('6a')));
  assert.ok(Number.isNaN(parseNumber('-5')));
  assert.equal(validCalc('light', 80), true);
  assert.equal(validCalc('light', 80.5), false); // подъёмы — целые
  assert.equal(validCalc('heavy', 0), false);
  assert.equal(validCalc('score', 81.13), true);
  assert.equal(validCalc('score', 81.135), false);
  assert.equal(validCalc('score', 1000), false);
  assert.equal(validCalc('other', 5), false);
  for (const q of ['?calc=light&v=8.5', '?calc=x&v=5', '?calc=heavy&v=0', '?calc=heavy']) {
    assert.deepEqual(parseState(q).calc, { field: 'light', value: 80 }, q);
  }
  assert.deepEqual(parseState('?calc=score&v=81,13').calc, { field: 'score', value: 81.13 });
});

test('пояснение пересчёта показывает исходные числа', () => {
  const st = { ...defaultState(), calc: { field: 'heavy', value: 61 } };
  assert.match(calcNote(L, st), /61 × 1,33 = 81,13/);
  assert.match(calcNote(L, st), /нужно <span class="n">82<\/span> подъёма/);
});

test('состояние → адрес → состояние без потерь', () => {
  const states = [
    defaultState(),
    { light: 16, heavy: 24, k: 1.5, tab: 'eq', step: 5, from: 20, to: 75, score: 33, calc: { field: 'heavy', value: 61 } },
    { light: 8, heavy: 32, k: 4, tab: 'score', step: 10, from: 1, to: 901, score: 999, calc: { field: 'score', value: 81.13 } },
    { light: 24, heavy: 28, k: 1, tab: 'score', step: 10, from: 40, to: 140, score: 80, calc: { field: 'light', value: 80 } },
  ];
  for (const st of states) assert.deepEqual(parseState(serializeState(st)), st);
  assert.deepEqual(parseState(new URLSearchParams('k=1,45')).k, 1.45, 'запятая в k допустима');
});

test('неверные параметры заменяются значениями по умолчанию', () => {
  const d = defaultState();
  const cases = [
    ['?light=32&heavy=24', { light: 24, heavy: 32, k: 1.33 }], // тяжёлая легче
    ['?light=24&heavy=24', { light: 24, heavy: 32 }],
    ['?light=25&heavy=32', { light: 24, heavy: 32 }], // нет такой гири
    ['?light=abc', { light: 24 }],
    ['?light=16&heavy=24&k=0.9', { light: 16, heavy: 24, k: 1.5 }], // k < 1 → по весу
    ['?k=5', { k: 1.33 }],
    ['?k=NaN', { k: 1.33 }],
    ['?k=-1.2', { k: 1.33 }],
    ['?k=1e2', { k: 1.33 }],
    ['?tab=other', { tab: 'score' }],
    ['?step=7', { step: d.step, from: d.from, to: d.to }],
    ['?from=200&to=100', { from: d.from, to: d.to }],
    ['?step=5&from=1&to=999', { step: d.step, from: d.from, to: d.to }], // больше 100 строк
    ['?s=0', { score: 80 }],
    ['?s=1000', { score: 80 }],
    ['?s=8.5', { score: 80 }],
  ];
  for (const [q, expected] of cases) {
    const st = parseState(q);
    for (const [key, value] of Object.entries(expected)) assert.equal(st[key], value, `${q}: ${key}`);
  }
  // Неверная группа не портит остальные.
  const mixed = parseState('?light=24&heavy=32&k=1.6&tab=eq&step=7&s=0');
  assert.equal(mixed.k, 1.6);
  assert.equal(mixed.tab, 'eq');
  assert.equal(mixed.step, d.step);
  assert.equal(validTable({ step: 10, from: 40, to: 140 }), true);
});

// ------------------------------------------------------------- разметка

test('расшифровка под графиком', () => {
  const html = readout(L, { ...defaultState(), k: 1.6 });
  const text = html.replace(/<[^>]+>/g, '').replace(/ /g, ' ');
  assert.equal(text, 'Зачётный результат 80: 80 подъёмов на 24 кг или 50 на 32 кг (50 × 1,60 = 80,0)');
});

test('цвета гирь — токены: гиря 24/32/16 своим цветом, остальные — цветом серии', () => {
  assert.equal(bellColor(24, 'light').color, 'var(--bell-24)');
  assert.equal(bellColor(32, 'heavy').color, 'var(--bell-32)');
  assert.equal(bellColor(16, 'light').halo, true);
  assert.equal(bellColor(20, 'light').color, 'var(--s1)');
  assert.equal(bellColor(28, 'heavy').color, 'var(--s2)');
  assert.doesNotMatch(colorVars(defaultState()), /#[0-9a-f]{3,6}/i);
  const st = defaultState();
  for (const svg of [scoreChart(L, st), equivChart(L, st)]) assert.doesNotMatch(svg, /#[0-9a-f]{3,6}\b|fill="|stroke="/i);
});

test('шкала графика', () => {
  assert.deepEqual(niceAxis(154, 8), { max: 160, tick: 20 });
  assert.deepEqual(niceAxis(154, 5), { max: 200, tick: 50 });
});

test('выбранная строка таблицы отмечена', () => {
  const body = tableBody({ ...defaultState(), k: 1.6 });
  assert.match(body, /<tr data-score="80" tabindex="0" class="on"><td class="n">80<\/td><td class="n">50<\/td>/);
});

// ------------------------------------------------------------- собранная страница

test('страница собрана: таблица по умолчанию без JavaScript и общие функции в /lib/', () => {
  const out = mkdtempSync(join(tmpdir(), 'tools-coef-'));
  execFileSync('node', ['scripts/build.mjs', out]);
  const html = readFileSync(join(out, 'en', 'coefficients', 'index.html'), 'utf8');
  assert.match(html, /<h1>Coefficients for different kettlebell weights<\/h1>/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /<svg class="chart" id="chart-score"/);
  assert.match(html, /<svg class="chart" id="chart-eq"/);
  assert.match(html, /<tr data-score="80" tabindex="0" class="on"><td class="n">80<\/td><td class="n">61<\/td>/);
  assert.match(html, /<script type="module" src="\/coefficients.js"><\/script>/);
  assert.ok(existsSync(join(out, 'coefficients.js')));
  assert.ok(existsSync(join(out, 'lib', 'coefficients.js')));
  assert.ok(existsSync(join(out, 'lib', 'coefficients-view.js')));
  const script = readFileSync(join(out, 'coefficients.js'), 'utf8');
  for (const [, path] of script.matchAll(/from '\.\/(lib\/[^']+)'/g)) assert.ok(existsSync(join(out, path)), path);
  const home = readFileSync(join(out, 'en', 'index.html'), 'utf8');
  assert.match(home, /href="\/ru\/coefficients\/"/);
});
