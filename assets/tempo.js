// Поведение страницы /tempo/. Расчёт и разметка — чистые функции из /lib/,
// здесь только события, поля, метроном и адрес страницы.
import {
  ANNOUNCE_END, D_MAX, D_MIN, RATE_MAX, STRATEGIES, addSegment, announce, canAddSegment, clicks, clock,
  editSegment, goalError, parseState, removeSegment, repsOf, serializeState, setMinute, toMode, withMinutes,
} from './lib/tempo.js';
import {
  barAxis, barChart, barGeometry, barLegend, chartSize, devChart, devLegend, paceSum, segmentRows, summary,
  tableBody, tableFoot, tableHead,
} from './lib/tempo-view.js';

document.documentElement.classList.add('js');

const $ = (id) => document.getElementById(id);
const el = {
  ex: $('ex'), min: $('min'), handField: $('hand-field'), hand: $('hand'),
  goal: $('goal'), strategy: $('strategy'), dField: $('d-field'), d: $('d'),
  goalError: $('goal-error'), strategyHint: $('strategy-hint'),
  segs: $('segs'), segAdd: $('seg-add'), segError: $('seg-error'), paceSum: $('pace-sum'),
  summary: $('summary'), boxBars: $('box-bars'), boxDev: $('box-dev'),
  legendBars: $('legend-bars'), legendDev: $('legend-dev'),
  head: $('table-head'), body: $('table-body'), foot: $('table-foot'), status: $('status'),
  metroStart: $('metro-start'), metroNow: $('metro-now'), voice: $('voice'),
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

function renderCharts() {
  const focused = el.boxBars.contains(document.activeElement);
  html(el.boxBars, barChart(state, size(), { focus: focusIdx, now: metro.minute, axis: drag?.axis }));
  html(el.boxDev, devChart(state, size()));
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
  el.strategyHint.textContent = STRATEGIES.find((s) => s.id === state.strategy).hint;

  if (state.mode === 'pace') {
    // Пока вводят число в отрезок, строки не перерисовываются — только остаток минут.
    if (skip === 'seg') $('seg-rest').textContent = String(state.seg[state.seg.length - 1].n);
    else {
      html(el.segs, segmentRows(state));
      el.segError.textContent = '';
    }
    html(el.paceSum, paceSum(state));
    el.segAdd.disabled = !canAddSegment(state.seg);
  }

  html(el.summary, summary(state));
  renderCharts();
  html(el.legendBars, barLegend(state));
  html(el.legendDev, devLegend(state));
  html(el.head, tableHead(state));
  html(el.body, tableBody(state, metro.minute));
  html(el.foot, tableFoot(state));
  if (!metro.on) el.metroNow.textContent = metroIdle();
  metro.resync();
  history.replaceState(null, '', location.pathname + serializeState(state) + location.hash);
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
  if (metro.on && n !== state.min) metro.stop();
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
    el.goalError.textContent = error;
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
    el.segError.textContent = res.error;
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

el.boxBars.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
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
    renderCharts();
    el.boxBars.querySelector(`[data-i="${focusIdx}"]`)?.focus();
  }
});

// ------------------------------------------------------------- метроном

const VOICE_KEY = 'tempo.voice';
try {
  if (localStorage.getItem(VOICE_KEY) === 'off') el.voice.checked = false;
} catch { /* без хранилища — голос включён */ }
el.voice.addEventListener('change', () => {
  try { localStorage.setItem(VOICE_KEY, el.voice.checked ? 'on' : 'off'); } catch { /* не страшно */ }
});

function speak(text) {
  if (!el.voice.checked || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ru-RU';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/** Строка метронома до старта: время, первая минута и её темп. */
const metroIdle = () => `0:00 · минута 1 из ${state.min} · ${repsOf(state)[0]} в минуту`;

const LOOKAHEAD = 0.15; // секунд: щелчки планируются заранее, таймер может опаздывать

const metro = {
  on: false, ctx: null, t0: 0, list: [], idx: 0, minute: -1, timer: 0, shown: '', lock: null,

  async start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      say('Браузер не умеет воспроизводить звук');
      return;
    }
    this.ctx ||= new AC();
    await this.ctx.resume();
    this.on = true;
    this.t0 = this.ctx.currentTime + 0.4;
    this.list = clicks(repsOf(state));
    this.idx = 0;
    this.minute = -1;
    this.timer = setInterval(() => this.tick(), 25);
    el.metroStart.textContent = 'Стоп';
    el.metroStart.setAttribute('aria-pressed', 'true');
    try { this.lock = await navigator.wakeLock?.request('screen'); } catch { /* экран может погаснуть */ }
    this.tick();
  },

  stop(finished) {
    if (!this.on) return;
    this.on = false;
    clearInterval(this.timer);
    this.minute = -1;
    this.shown = '';
    this.lock?.release().catch(() => {});
    this.lock = null;
    el.metroStart.textContent = 'Старт';
    el.metroStart.setAttribute('aria-pressed', 'false');
    if (finished) speak(ANNOUNCE_END);
    else if ('speechSynthesis' in window) speechSynthesis.cancel();
    render();
  },

  /** План изменили на ходу: щелчки дальше — по новому плану. */
  resync() {
    if (!this.on) return;
    const now = this.ctx.currentTime - this.t0 + LOOKAHEAD;
    this.list = clicks(repsOf(state));
    this.idx = this.list.findIndex((c) => c.t >= now);
    if (this.idx < 0) this.idx = this.list.length;
  },

  beep(at, first) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = first ? 1760 : 880;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.6, at + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.08);
  },

  tick() {
    const now = this.ctx.currentTime - this.t0;
    if (now >= state.min * 60) {
      this.stop(true);
      return;
    }
    while (this.idx < this.list.length && this.list[this.idx].t < now + LOOKAHEAD) {
      const c = this.list[this.idx];
      if (c.t >= now - 0.05) this.beep(this.t0 + c.t, c.first);
      this.idx += 1;
    }
    const m = Math.max(0, Math.floor(now / 60));
    if (now >= 0 && m !== this.minute) {
      this.minute = m;
      speak(announce(state, m));
      html(el.body, tableBody(state, m));
      renderCharts();
    }
    const reps = repsOf(state)[m];
    const text = `${clock(Math.max(0, now))} · минута ${m + 1} из ${state.min} · ${reps} в минуту`;
    if (text !== this.shown) {
      this.shown = text;
      el.metroNow.textContent = text;
    }
  },
};

el.metroStart.addEventListener('click', () => (metro.on ? metro.stop() : metro.start()));

// ------------------------------------------------------------- ссылка и печать

$('copy-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    say('Ссылка скопирована');
  } catch {
    say('Скопируйте адрес из строки браузера');
  }
});
$('print').addEventListener('click', () => window.print());

// ------------------------------------------------------------- ширина

let lastWidth = 0;
new ResizeObserver(() => {
  const w = el.boxBars.clientWidth;
  if (w && w !== lastWidth) {
    lastWidth = w;
    renderCharts();
  }
}).observe(el.boxBars);

render();
