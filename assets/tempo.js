// Поведение страницы /<язык>/tempo/. Расчёт и разметка — чистые функции из /lib/,
// здесь только события, поля и адрес страницы.
import {
  D_MAX, D_MIN, RATE_MAX, addSegment, canAddSegment,
  editSegment, goalError, parseState, removeSegment, repsOf, serializeState, setMinute, toMode, withMinutes,
} from './lib/tempo.js';
import {
  barAxis, barChart, barGeometry, barLegend, chartSize, errorText, paceSum, segmentRows, summary,
  tableBody, tableFoot, tableHead,
} from './lib/tempo-view.js';
import { pageLocale, replaceSearch } from './page.js';

document.documentElement.classList.add('js');
const L = await pageLocale();

const $ = (id) => document.getElementById(id);
const el = {
  ex: $('ex'), min: $('min'), handField: $('hand-field'), hand: $('hand'),
  goal: $('goal'), strategy: $('strategy'), dField: $('d-field'), d: $('d'),
  goalError: $('goal-error'), strategyHint: $('strategy-hint'),
  segs: $('segs'), segAdd: $('seg-add'), segError: $('seg-error'), paceSum: $('pace-sum'),
  summary: $('summary'), boxBars: $('box-bars'),
  legendBars: $('legend-bars'),
  head: $('table-head'), body: $('table-body'), foot: $('table-foot'), status: $('status'),
  barsEdit: $('bars-edit'),
  tabs: [...document.querySelectorAll('[role="tab"]')],
};

let state = parseState(location.search);
let focusIdx = 0; // столбик в порядке табуляции
let drag = null; // { i, axis } — пока тянут столбик, шкала не меняется

/** innerHTML только при изменении: перерисовка не сбрасывает фокус и указатель. */
const drawn = new WeakMap();
function html(node, value) {
  if (drawn.get(node) === value) return;
  drawn.set(node, value);
  node.innerHTML = value;
}

const size = () => chartSize(el.boxBars.clientWidth || 900);

function renderChart() {
  const focused = el.boxBars.contains(document.activeElement);
  html(el.boxBars, barChart(L, state, size(), { focus: focusIdx, axis: drag?.axis }));
  if (focused) el.boxBars.querySelector(`[data-i="${focusIdx}"]`)?.focus();
}

/** Перерисовать всё по состоянию. skip — поле, которое сейчас вводят: его не трогаем. */
function render(skip) {
  el.ex.value = state.ex;
  el.min.value = String(state.min);
  el.handField.hidden = state.ex !== 'snatch';
  el.hand.max = String(state.min - 1);
  if (skip !== 'hand') el.hand.value = String(state.hand);

  for (const tab of el.tabs) {
    const on = tab.dataset.mode === state.mode;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    $(tab.getAttribute('aria-controls')).hidden = !on;
  }

  if (skip !== 'goal') {
    el.goal.value = String(state.goal);
    el.goal.removeAttribute('aria-invalid');
    el.goalError.textContent = '';
  }
  el.strategy.value = state.strategy;
  el.dField.hidden = state.strategy === 'even';
  if (skip !== 'd') el.d.value = String(state.d);
  el.strategyHint.textContent = L.t(`tempo.s.${state.strategy}.hint`);

  if (state.mode === 'pace') {
    // Пока вводят число в отрезок, строки не перерисовываются — только остаток минут.
    if (skip === 'seg') $('seg-rest').textContent = String(state.seg[state.seg.length - 1].n);
    else {
      html(el.segs, segmentRows(L, state));
      el.segError.textContent = '';
    }
    html(el.paceSum, paceSum(L, state));
    el.segAdd.disabled = !canAddSegment(state.seg);
  }

  html(el.summary, summary(L, state));
  renderChart();
  html(el.legendBars, barLegend(L, state));
  html(el.head, tableHead(L, state));
  html(el.body, tableBody(L, state));
  html(el.foot, tableFoot(L, state));
  replaceSearch(serializeState(state));
}

function update(next, skip) {
  state = next;
  render(skip);
}

function say(text) {
  el.status.textContent = text;
  clearTimeout(say.timer);
  say.timer = setTimeout(() => { el.status.textContent = ''; }, 4000);
}

const int = (raw) => (/^\s*\d{1,4}\s*$/.test(raw) ? Number(raw) : NaN);

// ------------------------------------------------------------- упражнение и время

el.ex.addEventListener('change', () => update({ ...state, ex: el.ex.value }));
el.min.addEventListener('change', () => {
  const n = Number(el.min.value);
  focusIdx = Math.min(focusIdx, n - 1);
  update(withMinutes(state, n));
});
el.hand.addEventListener('input', () => {
  const hand = int(el.hand.value);
  if (hand >= 1 && hand <= state.min - 1) update({ ...state, hand }, 'hand');
});
el.hand.addEventListener('change', () => render());

// ------------------------------------------------------------- вкладки

function selectTab(tab, focus) {
  update(toMode(state, tab.dataset.mode));
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

// ------------------------------------------------------------- от цели к темпу

/** Применить цель, стратегию и прибавку или объяснить, почему нельзя. */
function tryGoal(patch, skip) {
  const next = { ...state, ...patch };
  const error = goalError(next.goal, next.min, next.strategy, next.d);
  if (error) {
    el.goalError.textContent = errorText(L, error);
    el.goal.setAttribute('aria-invalid', 'true');
    return false;
  }
  el.goal.removeAttribute('aria-invalid');
  el.goalError.textContent = '';
  update(next, skip);
  return true;
}

el.goal.addEventListener('input', () => tryGoal({ goal: int(el.goal.value) }, 'goal'));
el.strategy.addEventListener('change', () => {
  // Недопустимая стратегия не применяется: поле возвращается, объяснение остаётся.
  if (!tryGoal({ strategy: el.strategy.value })) el.strategy.value = state.strategy;
});
el.d.addEventListener('input', () => {
  const d = int(el.d.value);
  if (d >= D_MIN && d <= D_MAX) tryGoal({ d }, 'd');
});
el.d.addEventListener('change', () => {
  if (!tryGoal({ d: int(el.d.value) }, 'd')) el.d.value = String(state.d);
});

// ------------------------------------------------------------- от темпа к итогу

el.segs.addEventListener('input', (e) => {
  const input = e.target;
  const i = Number(input.closest('[data-i]')?.dataset.i);
  if (!input.dataset.k || Number.isNaN(i)) return;
  const res = editSegment(state.seg, i, input.dataset.k, input.value, state.min);
  for (const other of el.segs.querySelectorAll('input')) other.removeAttribute('aria-invalid');
  if (res.error) {
    input.setAttribute('aria-invalid', 'true');
    el.segError.textContent = errorText(L, res.error);
    return;
  }
  el.segError.textContent = '';
  update({ ...state, seg: res.seg }, 'seg');
});
// Ушли из поля с неверным числом — вернуть отрезки из состояния.
el.segs.addEventListener('change', () => { if (el.segError.textContent) render(); });
el.segs.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (btn) update({ ...state, seg: removeSegment(state.seg, Number(btn.dataset.remove), state.min) });
});
el.segAdd.addEventListener('click', () => {
  update({ ...state, seg: addSegment(state.seg) });
  el.segs.querySelector('li:last-child .seg-r')?.focus();
});

// ------------------------------------------------------------- столбики

/** Координаты указателя в единицах viewBox графика. */
function pointer(e) {
  const svg = el.boxBars.querySelector('svg');
  const rect = svg.getBoundingClientRect();
  const sz = size();
  return { x: ((e.clientX - rect.left) * sz.width) / rect.width, y: ((e.clientY - rect.top) * sz.height) / rect.height };
}

function dragTo(e) {
  const g = barGeometry(state.min, size(), drag.axis);
  const p = pointer(e);
  if (drag.i === null) drag.i = g.minute(p.x);
  focusIdx = drag.i;
  const value = g.value(p.y);
  if (value !== repsOf(state)[drag.i] || state.mode !== 'plan') update(setMinute(state, drag.i, value));
}

// На сенсорном экране палец, которым прокручивают страницу, не должен менять план:
// столбики тянутся только в режиме редактирования (кнопка у графика). Мышью —
// всегда, с клавиатуры — всегда.
const touch = matchMedia('(pointer: coarse)');
let editing = false;
const canDrag = () => editing || !touch.matches;

function setEditing(on) {
  editing = on;
  el.barsEdit.setAttribute('aria-pressed', String(on));
  el.barsEdit.textContent = L.t(on ? 'tempo.barsDone' : 'tempo.barsEdit');
  el.boxBars.classList.toggle('locked', !canDrag());
  el.boxBars.classList.toggle('editing', on);
}
el.barsEdit.addEventListener('click', () => setEditing(!editing));
touch.addEventListener('change', () => setEditing(false));
setEditing(false);

el.boxBars.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !canDrag()) return;
  e.preventDefault();
  drag = { i: null, axis: barAxis(state) };
  el.boxBars.setPointerCapture(e.pointerId);
  el.boxBars.classList.add('dragging');
  dragTo(e);
});
el.boxBars.addEventListener('pointermove', (e) => { if (drag) dragTo(e); });
function stopDrag() {
  if (!drag) return;
  drag = null;
  el.boxBars.classList.remove('dragging');
  render(); // шкала подстраивается под новый план
}
el.boxBars.addEventListener('pointerup', stopDrag);
el.boxBars.addEventListener('pointercancel', stopDrag);

el.boxBars.addEventListener('focusin', (e) => {
  const i = Number(e.target.dataset?.i);
  if (!Number.isNaN(i)) focusIdx = i;
});
el.boxBars.addEventListener('keydown', (e) => {
  const i = Number(e.target.dataset?.i);
  if (Number.isNaN(i)) return;
  const reps = repsOf(state);
  const delta = { ArrowUp: 1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[e.key];
  const move = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: reps.length - 1 }[e.key];
  if (delta !== undefined) {
    e.preventDefault();
    focusIdx = i;
    const value = Math.min(RATE_MAX, Math.max(1, reps[i] + delta));
    if (value !== reps[i] || state.mode !== 'plan') update(setMinute(state, i, value));
  } else if (move !== undefined) {
    e.preventDefault();
    focusIdx = Math.min(reps.length - 1, Math.max(0, move));
    renderChart();
    el.boxBars.querySelector(`[data-i="${focusIdx}"]`)?.focus();
  }
});

// ------------------------------------------------------------- ссылка и печать

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
  const w = el.boxBars.clientWidth;
  if (w && w !== lastWidth) {
    lastWidth = w;
    renderChart();
  }
}).observe(el.boxBars);

render();
