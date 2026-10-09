import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MINUTES, STRATEGIES, addSegment, canAddSegment, defaultState, editSegment, fitSegments,
  goalError, goalReps, paceReps, parseRate, parseState, planText, rateText, removeSegment, repsOf, rows,
  secPerRep, serializeState, setMinute, toMode, toSegments, withMinutes,
} from '../src/lib/tempo.js';
import { barChart, errorText, paceSum, summary, tableBody, tableFoot, tableHead } from '../src/lib/tempo-view.js';
import { locale } from '../src/i18n/index.js';

const L = locale('ru');
const goalText = (...args) => errorText(L, goalError(...args));
const segText = (...args) => errorText(L, editSegment(...args).error);

const total = (reps) => reps.reduce((a, r) => a + r, 0);

// ------------------------------------------------------------- стратегии

test('примеры из задачи: 80 за 10 минут', () => {
  assert.deepEqual(goalReps(80, 10, 'even', 2), [8, 8, 8, 8, 8, 8, 8, 8, 8, 8]);
  assert.deepEqual(goalReps(75, 10, 'even', 2), [7, 8, 7, 8, 7, 8, 7, 8, 7, 8]);
  assert.deepEqual(goalReps(80, 10, 'finish', 2), [7, 7, 8, 8, 8, 8, 8, 8, 8, 10]);
  assert.deepEqual(goalReps(80, 10, 'ramp', 2), [7, 7, 7, 8, 8, 8, 8, 9, 9, 9]);
});

test('каждая стратегия даёт ровно цель', () => {
  for (const n of MINUTES) {
    for (const { id } of STRATEGIES) {
      for (const d of [1, 2, 5, 10]) {
        for (let goal = 1; goal <= n * 30; goal += n === 60 ? 37 : 7) {
          const reps = goalReps(goal, n, id, d);
          assert.equal(reps.length, n);
          assert.equal(total(reps), goal, `${goal} за ${n}, ${id}, +${d}`);
          assert.ok(reps.every(Number.isInteger));
          if (!goalError(goal, n, id, d)) assert.ok(reps.every((r) => r >= 1 && r <= 30), `${goal} за ${n}, ${id}`);
        }
      }
    }
  }
});

test('разгон не убывает, запас на финиш: меньшие минуты в начале', () => {
  const ramp = goalReps(137, 10, 'ramp', 3);
  assert.ok(ramp.every((r, i) => i === 0 || r >= ramp[i - 1]), ramp.join());
  const finish = goalReps(95, 10, 'finish', 2);
  assert.ok(finish.slice(0, -1).every((r, i, a) => i === 0 || r >= a[i - 1]), finish.join());
  assert.equal(finish[9], 12); // 9,5 → 10, плюс 2
});

test('цель вне пределов не принимается и объясняется', () => {
  assert.equal(goalError(80, 10, 'finish', 2), null);
  assert.equal(goalText(80, 10, 'finish', 2), '');
  assert.match(goalText(0, 10, 'even', 2), /не меньше 1/);
  assert.match(goalText(3, 5, 'even', 2), /меньше 1 в минуту/);
  assert.match(goalText(80, 60, 'ramp', 2), /В 1-й минуте выходит 0/);
  assert.match(goalText(301, 10, 'even', 2), /не больше 300/);
  assert.match(goalText(300, 10, 'finish', 2), /больше 30 в минуту/);
  assert.match(goalText(80, 10, 'finish', 11), /Прибавка/);
  assert.match(goalText(8.5, 10, 'even', 2), /целое/);
});

// ------------------------------------------------------------- дробный темп

test('дробный темп: целые минуты без потери подъёмов', () => {
  assert.deepEqual(paceReps([{ n: 4, r: 750 }]), [7, 8, 7, 8]);
  assert.deepEqual(paceReps([{ n: 3, r: 700 }, { n: 6, r: 800 }, { n: 1, r: 1000 }]), [7, 7, 7, 8, 8, 8, 8, 8, 8, 10]);
  assert.equal(total(paceReps([{ n: 10, r: 733 }])), 73); // 73,3 → 73
  assert.equal(total(paceReps([{ n: 3, r: 1 * 100 + 33 }, { n: 3, r: 167 }])), 9); // 3,99 + 5,01 = 9
  // Сумма темпов в сотых: 0,1 × 10 в double дало бы 0,999…
  assert.equal(total(paceReps([{ n: 10, r: 110 }])), 11);
  assert.equal(parseRate('7,5'), 750);
  assert.equal(parseRate('7.25'), 725);
  assert.equal(parseRate('7,05'), 705);
  assert.ok(Number.isNaN(parseRate('0,5')));
  assert.ok(Number.isNaN(parseRate('31')));
  assert.ok(Number.isNaN(parseRate('7,555')));
  assert.equal(rateText(L, 750), '7,5');
  assert.equal(rateText(L, 700), '7');
});

// ------------------------------------------------------------- таблица

test('таблица: секунд на подъём, нарастающий итог, отклонение от ровного', () => {
  const data = rows(defaultState());
  assert.deepEqual(data.map((r) => r.cum), [7, 14, 22, 30, 38, 46, 54, 62, 70, 80]);
  assert.deepEqual(data.map((r) => r.dev), [-1, -2, -2, -2, -2, -2, -2, -2, -2, 0]);
  assert.equal(secPerRep(L, 7), '8,6');
  assert.equal(secPerRep(L, 8), '7,5');
  assert.equal(secPerRep(L, 0), '—');
  assert.equal(planText(repsOf(defaultState())), '7, 7, 8 × 7, 10');
  assert.equal(planText([8, 8, 9, 9, 9]), '8, 8, 9 × 3');
});

test('рывок: первая рука до смены, вторая после', () => {
  const st = { ...parseState('?ex=snatch&mode=pace&seg=5x8,5x7.5'), hand: 5 };
  const data = rows(st);
  assert.deepEqual(data.map((r) => r.hand), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
  assert.equal(data[9].h1, 40);
  assert.equal(data[9].h2, 37);
  assert.equal(data[9].cum, 77);
  assert.match(tableHead(L, st), /Первая рука.*Вторая рука.*Сумма/);
  assert.match(tableFoot(L, st), /<td class="n">40<\/td><td class="n">37<\/td><td class="n total">77<\/td>/);
  assert.match(summary(L, st), /Первая рука — <b class="n">40<\/b>/);
});

// ------------------------------------------------------------- отрезки и свой план

test('отрезки: последний добирает минуты, ошибки объясняются', () => {
  const seg = [{ n: 3, r: 700 }, { n: 6, r: 800 }, { n: 1, r: 1000 }];
  assert.deepEqual(editSegment(seg, 0, 'n', '2', 10).seg, [{ n: 2, r: 700 }, { n: 6, r: 800 }, { n: 2, r: 1000 }]);
  assert.deepEqual(editSegment(seg, 2, 'r', '9,5', 10).seg[2], { n: 1, r: 950 });
  assert.match(segText(seg, 0, 'n', '4', 10), /хотя бы одна минута/);
  assert.match(segText(seg, 0, 'r', 'abc', 10), /Темп/);
  assert.match(segText(seg, 0, 'n', '0', 10), /не меньше 1/);
  assert.deepEqual(fitSegments(seg, 5), [{ n: 3, r: 700 }, { n: 1, r: 800 }, { n: 1, r: 1000 }]);
  assert.deepEqual(fitSegments(seg, 30).at(-1), { n: 21, r: 1000 });
  assert.deepEqual(addSegment(seg), [{ n: 3, r: 700 }, { n: 5, r: 800 }, { n: 1, r: 1000 }, { n: 1, r: 1000 }]);
  assert.deepEqual(removeSegment(seg, 2, 10), [{ n: 3, r: 700 }, { n: 7, r: 800 }]);
  assert.equal(canAddSegment([{ n: 1, r: 700 }]), false);
  assert.deepEqual(toSegments([7, 7, 8, 8, 8, 10]), [{ n: 2, r: 700 }, { n: 3, r: 800 }, { n: 1, r: 1000 }]);
  assert.equal(toSegments(goalReps(480, 60, 'ramp', 4)).length, 1, 'больше 10 отрезков — один средний');
  const sum = paceSum(L, { seg: [{ n: 3, r: 700 }, { n: 4, r: 750 }] }).replace(/<[^>]+>/g, '');
  assert.match(sum, /3 × 7 \+ 4 × 7,5 = 51\.$/);
  assert.match(paceSum(L, { seg: [{ n: 3, r: 750 }] }).replace(/<[^>]+>/g, ''), /= 22,5 → 22/);
});

test('перетаскивание столбика меняет только эту минуту, режим — свой план', () => {
  const st = setMinute(defaultState(), 3, 12);
  assert.equal(st.mode, 'plan');
  assert.deepEqual(st.plan, [7, 7, 8, 12, 8, 8, 8, 8, 8, 10]);
  assert.equal(rows(st).at(-1).cum, 84);
  assert.equal(setMinute(st, 0, 99).plan[0], 30);
  assert.equal(setMinute(st, 0, -3).plan[0], 1);
});

test('переходы: режимы начинаются с текущей раскладки, время сохраняет темп', () => {
  const pace = toMode(defaultState(), 'pace');
  assert.deepEqual(pace.seg, [{ n: 2, r: 700 }, { n: 7, r: 800 }, { n: 1, r: 1000 }]);
  assert.deepEqual(repsOf(pace), repsOf(defaultState()));
  assert.deepEqual(repsOf(toMode(pace, 'plan')), repsOf(defaultState()));
  assert.equal(toMode(pace, 'goal').goal, 80);
  const five = withMinutes(defaultState(), 5);
  assert.equal(five.goal, 40);
  assert.equal(five.hand, 2);
  assert.equal(withMinutes(defaultState(), 60).goal, 480);
  const plan = withMinutes(setMinute(defaultState(), 9, 12), 30);
  assert.equal(plan.plan.length, 30);
  assert.equal(plan.plan.at(-1), 12);
  assert.deepEqual(withMinutes(pace, 5).seg, [{ n: 2, r: 700 }, { n: 2, r: 800 }, { n: 1, r: 1000 }]);
  assert.equal(withMinutes({ ...defaultState(), hand: 8 }, 5).hand, 4);
});

test('значения по умолчанию в адрес не пишутся', () => {
  assert.deepEqual(parseState(''), defaultState());
  assert.equal(serializeState(defaultState()), '');
  assert.equal(serializeState(parseState('?ex=lc&min=10&goal=80&s=finish&d=2')), '');
  assert.equal(serializeState(parseState('?ex=snatch&hand=5')), '?ex=snatch');
});

test('адрес ⇄ состояние: примеры из задачи', () => {
  const pace = parseState('?mode=pace&seg=3x7,6x8,1x10');
  assert.equal(pace.mode, 'pace');
  assert.equal(rows(pace).at(-1).cum, 79);
  const plan = parseState('?p=7,7,8,8,8,8,8,8,8,10');
  assert.equal(plan.mode, 'plan');
  assert.equal(rows(plan).at(-1).cum, 80);
  const snatch = parseState('?ex=snatch&hand=4');
  assert.equal(snatch.hand, 4);
  for (const q of [
    '?mode=pace&seg=3x7,6x8,1x10',
    '?p=7,7,8,8,8,8,8,8,8,10',
    '?ex=snatch&hand=4',
    '?ex=jerk&min=30&goal=250&s=ramp&d=3',
    '?min=5&goal=60&s=even',
    '?ex=snatch&mode=pace&seg=5x8,5x7.5',
    '?min=60&mode=pace&seg=20x8,39x7.25,1x12',
  ]) {
    assert.equal(serializeState(parseState(q)), q, q);
    assert.deepEqual(parseState(serializeState(parseState(q))), parseState(q), q);
  }
});

test('неверные параметры заменяются значениями по умолчанию', () => {
  const d = defaultState();
  const cases = [
    ['?ex=press', { ex: 'lc' }],
    ['?min=7', { min: 10 }],
    ['?goal=0', { goal: 80 }],
    ['?goal=abc', { goal: 80 }],
    ['?goal=3&min=5', { goal: 40, min: 5 }],
    ['?s=fast', { strategy: 'finish' }],
    ['?d=99', { d: 2, goal: 80 }],
    ['?min=60&goal=80&s=ramp', { goal: 480, strategy: 'finish' }],
    ['?hand=10', { hand: 5 }],
    ['?hand=0', { hand: 5 }],
    ['?p=7,7,8', { mode: 'goal', plan: [] }], // не та длина
    ['?p=7,0,8,8,8,8,8,8,8,10', { mode: 'goal' }],
    ['?p=7,x,8,8,8,8,8,8,8,10', { mode: 'goal' }],
  ];
  for (const [q, expected] of cases) {
    const st = parseState(q);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(st[key], value, `${q}: ${key}`);
  }
  // Неверные отрезки — раскладка цели, режим сохраняется.
  for (const q of ['?mode=pace&seg=10x7,1x8', '?mode=pace&seg=3x7,6x40', '?mode=pace&seg=3-7', '?mode=pace']) {
    const st = parseState(q);
    assert.equal(st.mode, 'pace', q);
    assert.deepEqual(repsOf(st), repsOf(d), q);
  }
  // Неверная группа не портит остальные.
  const mixed = parseState('?ex=snatch&min=30&goal=0&hand=12');
  assert.equal(mixed.ex, 'snatch');
  assert.equal(mixed.min, 30);
  assert.equal(mixed.goal, 240);
  assert.equal(mixed.hand, 12);
});

// ------------------------------------------------------------- разметка

test('графики: цвет — классами, столбики — ползунки с клавиатуры', () => {
  for (const st of [defaultState(), parseState('?ex=snatch&min=60')]) {
    const bars = barChart(L, st);
    assert.doesNotMatch(bars, /#[0-9a-f]{3,6}\b|fill="|stroke="/i);
    assert.equal(bars.match(/role="slider"/g).length, st.min);
    assert.equal(bars.match(/tabindex="0"/g).length, 1, 'в порядке табуляции один столбик');
  }
  const bars = barChart(L, defaultState(), undefined, { focus: 3 });
  assert.match(bars, /data-i="3"[^>]*tabindex="0"/);
  assert.match(bars, /aria-valuenow="7" aria-valuetext="7 подъёмов, 8,6 с на подъём"/);
  assert.match(barChart(L, parseState('?ex=snatch')), /class="bar bar-h2"/);
});

test('таблица на 60 минут, смена руки в рывке', () => {
  const st = parseState('?min=60');
  assert.equal(tableBody(L, st).match(/<tr/g).length, 60);
  assert.match(tableBody(L, { ...defaultState(), ex: 'snatch', hand: 5 }), /<tr class="switch"><td class="n">6<\/td>/);
});

// ------------------------------------------------------------- собранная страница

test('страница собрана: пример по умолчанию без JavaScript и общие функции в /lib/', () => {
  const out = mkdtempSync(join(tmpdir(), 'tools-tempo-'));
  execFileSync('node', ['scripts/build.mjs', out]);
  const html = readFileSync(join(out, 'en', 'tempo', 'index.html'), 'utf8');
  assert.match(html, /<h1>Pace calculator<\/h1>/);
  assert.match(html, /<svg class="chart" id="chart-bars"/);
  assert.match(html, /7, 7, 8 × 7, 10/);
  assert.match(html, /<tr><td class="n">10<\/td><td class="n">10<\/td><td class="n">6,0<\/td><td class="n total">80<\/td>/);
  assert.match(html, /<div class="table-wrap">/);
  // Только планирование: без старта и метронома; столбики на телефоне — по кнопке.
  assert.match(html, /<button type="button" class="btn bars-edit js-only" id="bars-edit" aria-pressed="false"[^>]*>Edit bars</);
  assert.doesNotMatch(html, /metro|Старт|Метроном/i);
  assert.match(html, /<script type="module" src="\/tempo.js"><\/script>/);
  for (const f of ['tempo.js', 'lib/tempo.js', 'lib/tempo-view.js', 'lib/format.js']) assert.ok(existsSync(join(out, f)), f);
  for (const file of ['tempo.js', 'lib/tempo.js', 'lib/tempo-view.js', 'lib/coefficients.js']) {
    const script = readFileSync(join(out, file), 'utf8');
    const base = file.includes('/') ? join(out, 'lib') : out;
    for (const [, path] of script.matchAll(/from '\.\/([^']+)'/g)) assert.ok(existsSync(join(base, path)), `${file} → ${path}`);
  }
  const home = readFileSync(join(out, 'en', 'index.html'), 'utf8');
  assert.match(home, /href="\/ru\/tempo\/"/);
});
