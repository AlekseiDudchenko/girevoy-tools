// Поведение страницы /<язык>/coefficients/. Расчёт и разметка — чистые функции из /lib/,
// здесь только события, синхронизация полей и адрес страницы.
import {
  CALC_FIELDS, K_MAX, K_MIN, SCORE_MAX, WEIGHTS, clampK, defaultK, parseNumber, parseState, round2,
  serializeState, sliderMax, validCalc, validTable,
} from './lib/coefficients.js';
import {
  calcLabels, calcNote, calcText, calcValues, chartInverse, chartSize, colorVars, equivChart, equivLegend, kg, ratioHint,
  readout, scoreChart, scoreLegend, tableBody, tableHead,
} from './lib/coefficients-view.js';
import { pageLocale, replaceSearch } from './page.js';

document.documentElement.classList.add('js');
const L = await pageLocale();

const $ = (id) => document.getElementById(id);
const root = $('coef');
const el = {
  light: $('light'), heavy: $('heavy'), k: $('k'), range: $('k-range'), rangeCalc: $('k-range-calc'),
  calcKValue: $('calc-k-value'), calcKBell: $('calc-k-bell'),
  chipLight: $('chip-light'), chipHeavy: $('chip-heavy'), ratioHint: $('ratio-hint'),
  boxScore: $('box-score'), boxEq: $('box-eq'), legendScore: $('legend-score'), legendEq: $('legend-eq'),
  readout: $('readout'), score: $('score'),
  step: $('step'), from: $('from'), to: $('to'),
  head: $('table-head'), body: $('table-body'), status: $('status'),
  calcNote: $('calc-note'),
  tabs: [...document.querySelectorAll('[role="tab"]')],
  tablist: document.querySelector('.tabs'),
};

let state = parseState(location.search);

/** innerHTML только при изменении: иначе щелчок по строке теряется, если между
 *  нажатием и отпусканием перерисовка заменила её такой же. */
const drawn = new WeakMap();
function html(node, value) {
  if (drawn.get(node) === value) return;
  drawn.set(node, value);
  node.innerHTML = value;
}

function size() {
  return chartSize(el.tablist.clientWidth || 900);
}

function renderCharts() {
  const sz = size();
  const handleFocused = document.activeElement?.classList.contains('handle');
  html(el.boxScore, scoreChart(L, state, sz));
  html(el.boxEq, equivChart(L, state, sz));
  if (handleFocused) el.boxEq.querySelector('.handle')?.focus();
}

/** Перерисовать всё по состоянию. skip — поле, которое сейчас вводят: его не трогаем. */
function render(skip) {
  root.setAttribute('style', colorVars(state));
  el.chipLight.textContent = kg(L, state.light);
  el.chipHeavy.textContent = kg(L, state.heavy);
  el.light.value = String(state.light);
  el.heavy.value = String(state.heavy);
  if (skip !== 'k') el.k.value = state.k.toFixed(2);
  el.range.max = String(sliderMax(state));
  if (skip !== 'range') el.range.value = String(state.k);
  // Второй ползунок — в строке пересчёта; оба меняют один и тот же k.
  el.rangeCalc.max = el.range.max;
  if (skip !== 'range-calc') el.rangeCalc.value = String(state.k);
  el.calcKValue.textContent = `× ${L.num(state.k, 2)}`;
  el.calcKBell.textContent = kg(L, state.heavy);
  html(el.ratioHint, ratioHint(L, state));
  renderCharts();
  html(el.legendScore, scoreLegend(L, state));
  html(el.legendEq, equivLegend(L, state));
  html(el.readout, readout(L, state));
  if (skip !== 'score') el.score.value = String(state.score);
  el.step.value = String(state.step);
  el.from.value = String(state.from);
  el.to.value = String(state.to);
  renderCalc(skip);
  html(el.head, tableHead(L, state));
  html(el.body, tableBody(state));
  for (const tab of el.tabs) {
    const on = tab.dataset.tab === state.tab;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    $(tab.getAttribute('aria-controls')).hidden = !on;
  }
  replaceSearch(serializeState(state));
}

/** Строка пересчёта: введённое поле не трогаем, два других — по коэффициенту. */
function renderCalc(skip) {
  const values = calcValues(state);
  const labels = calcLabels(L, state);
  for (const name of CALC_FIELDS) {
    const input = $(`calc-${name}`);
    $(`calc-${name}-label`).textContent = labels[name];
    input.closest('.field').classList.toggle('src', name === state.calc.field);
    if (skip === `calc-${name}`) continue;
    input.value = calcText(L, values[name]);
    input.removeAttribute('aria-invalid');
  }
  html(el.calcNote, calcNote(L, state));
}

function update(patch, skip) {
  state = { ...state, ...patch };
  render(skip);
}

function say(text) {
  el.status.textContent = text;
  clearTimeout(say.timer);
  say.timer = setTimeout(() => { el.status.textContent = ''; }, 4000);
}

// ------------------------------------------------------------- гири и коэффициент

el.light.addEventListener('change', () => {
  const light = Number(el.light.value);
  const heavy = state.heavy > light ? state.heavy : WEIGHTS.find((w) => w > light);
  update({ light, heavy, k: defaultK(light, heavy) });
});

el.heavy.addEventListener('change', () => {
  const heavy = Number(el.heavy.value);
  const light = state.light < heavy ? state.light : [...WEIGHTS].reverse().find((w) => w < heavy);
  update({ light, heavy, k: defaultK(light, heavy) });
});

el.k.addEventListener('input', () => {
  const k = Number(el.k.value.replace(',', '.'));
  if (Number.isFinite(k) && k >= K_MIN && k <= K_MAX) update({ k: round2(k) }, 'k');
});
el.k.addEventListener('change', () => {
  const k = Number(el.k.value.replace(',', '.'));
  update({ k: Number.isFinite(k) ? clampK(round2(k)) : state.k });
});

el.range.addEventListener('input', () => update({ k: round2(Number(el.range.value)) }, 'range'));
el.rangeCalc.addEventListener('input', () => update({ k: round2(Number(el.rangeCalc.value)) }, 'range-calc'));

// ------------------------------------------------------------- пересчёт

for (const name of CALC_FIELDS) {
  const input = $(`calc-${name}`);
  input.addEventListener('input', () => {
    const value = parseNumber(input.value);
    const ok = validCalc(name, value);
    input.setAttribute('aria-invalid', String(!ok && input.value.trim() !== ''));
    if (ok) update({ calc: { field: name, value } }, `calc-${name}`);
  });
  // Ушли из поля с неверным числом — вернуть пересчитанное значение.
  input.addEventListener('change', () => render());
}

// ------------------------------------------------------------- вкладки

function selectTab(tab, focus) {
  update({ tab: tab.dataset.tab });
  if (focus) tab.focus();
}
for (const tab of el.tabs) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (e) => {
    const i = el.tabs.indexOf(tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: el.tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    selectTab(el.tabs[(next + el.tabs.length) % el.tabs.length], true);
  });
}

// ------------------------------------------------------------- графики

/** Координаты указателя в значениях осей графика. */
function pointer(box, e) {
  const svg = box.querySelector('svg');
  const rect = svg.getBoundingClientRect();
  const sz = size();
  const inv = chartInverse(state, sz);
  const vx = ((e.clientX - rect.left) * sz.width) / rect.width;
  const vy = ((e.clientY - rect.top) * sz.height) / rect.height;
  return { x: inv.x(vx), y: inv.y(vy) };
}

const clampScore = (v, max = SCORE_MAX) => Math.min(max, Math.max(1, Math.round(v)));

// «Зачётный результат»: щелчок выбирает результат по высоте.
el.boxScore.addEventListener('click', (e) => {
  update({ score: clampScore(pointer(el.boxScore, e).y) });
});

// «Равноценные подъёмы»: точку тянут, k = подъёмы на лёгкой / подъёмы на тяжёлой.
let drag = null;
function dragTo(e) {
  const p = pointer(el.boxEq, e);
  const score = clampScore(p.x, drag.maxScore);
  const heavy = Math.max(1, Math.min(score, p.y));
  update({ score, k: clampK(round2(score / heavy)) });
}
el.boxEq.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  drag = { maxScore: Math.max(state.to, state.score) };
  el.boxEq.setPointerCapture(e.pointerId);
  el.boxEq.classList.add('dragging');
  dragTo(e);
});
el.boxEq.addEventListener('pointermove', (e) => { if (drag) dragTo(e); });
const stopDrag = () => { drag = null; el.boxEq.classList.remove('dragging'); };
el.boxEq.addEventListener('pointerup', stopDrag);
el.boxEq.addEventListener('pointercancel', stopDrag);
el.boxEq.addEventListener('keydown', (e) => {
  if (!e.target.classList.contains('handle')) return;
  const delta = { ArrowUp: 0.01, ArrowRight: 0.01, ArrowDown: -0.01, ArrowLeft: -0.01, PageUp: 0.1, PageDown: -0.1 }[e.key];
  if (delta === undefined) return;
  e.preventDefault();
  update({ k: clampK(round2(state.k + delta)) });
});

el.score.addEventListener('input', () => {
  const v = Number(el.score.value);
  if (Number.isInteger(v) && v >= 1 && v <= SCORE_MAX) update({ score: v }, 'score');
});
el.score.addEventListener('change', () => render());

// ------------------------------------------------------------- таблица

el.body.addEventListener('click', (e) => {
  const row = e.target.closest('tr[data-score]');
  if (row) update({ score: Number(row.dataset.score) });
});

el.body.addEventListener('keydown', (e) => {
  const row = e.target.closest('tr[data-score]');
  if (!row || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  update({ score: Number(row.dataset.score) });
  el.body.querySelector(`tr[data-score="${row.dataset.score}"]`)?.focus();
});

function tableChanged() {
  const next = { step: Number(el.step.value), from: Number(el.from.value), to: Number(el.to.value) };
  if (validTable(next)) {
    update(next);
  } else {
    say(L.t('coef.rangeError'));
    render();
  }
}
el.step.addEventListener('change', tableChanged);
el.from.addEventListener('change', tableChanged);
el.to.addEventListener('change', tableChanged);

$('copy-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    say(L.t('common.copied'));
  } catch {
    say(L.t('common.copyFailed'));
  }
});
$('print').addEventListener('click', () => window.print());

// ------------------------------------------------------------- ширина

let lastWidth = 0;
new ResizeObserver(() => {
  const w = el.tablist.clientWidth;
  if (w && w !== lastWidth) {
    lastWidth = w;
    renderCharts();
  }
}).observe(el.tablist);

render();
