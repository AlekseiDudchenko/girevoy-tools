// Разметка калькулятора темпа: график SVG, легенды, итог плана, отрезки, таблица.
// Чистые функции «состояние → строка HTML»: страница рисует ими состояние по
// умолчанию при сборке, браузер — после каждого изменения. Пользовательский текст
// сюда не попадает: только числа из состояния и подписи из словаря языка страницы.
// Первый аргумент каждой функции с текстом — L, язык страницы (locale.js).
import { RATE_MAX, RATE_MIN, clock, planText, rateText, repsOf, rows, secPerRep, segSum } from './tempo.js';

const r1 = (v) => Math.round(v * 10) / 10;
/** Отклонение со знаком: +1, 0, −2. */
const signed = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');

// ------------------------------------------------------------- оси

const TICKS = [1, 2, 5, 10, 20, 50, 100, 200, 500];

/** Верх шкалы и шаг делений: не больше maxTicks делений, не ниже value. */
export function niceAxis(value, maxTicks) {
  const tick = TICKS.find((t) => Math.ceil(value / t) <= maxTicks) || TICKS[TICKS.length - 1];
  return { max: Math.max(tick, Math.ceil(value / tick) * tick), tick };
}

/** Размер графика по ширине контейнера: подписи остаются 12px на любом экране. */
export function chartSize(width) {
  const w = Math.max(280, Math.round(width));
  return { width: w, height: Math.round(Math.min(300, Math.max(200, w * 0.34))) };
}

/** Через сколько минут подписывать ось X. */
const minuteStep = (n) => (n <= 10 ? 1 : n <= 30 ? 5 : 10);

function svg(size, id, attrs, inner) {
  return `<svg class="chart" id="${id}" viewBox="0 0 ${size.width} ${size.height}" width="${size.width}" height="${size.height}" ${attrs}>${inner}</svg>`;
}

// ------------------------------------------------------------- темп по минутам

const BAR_PAD = { left: 34, right: 8, top: 22, bottom: 26 };

/** Шкала столбиков: с запасом над самой быстрой минутой. */
export function barAxis(state) {
  const data = rows(state);
  const peak = Math.max(...data.map((r) => r.reps));
  return niceAxis(Math.min(RATE_MAX, peak) * 1.15 + 1, 6);
}

/** Геометрия столбиков и обратный пересчёт указателя в минуту и темп. */
export function barGeometry(n, size, axis) {
  const plotW = size.width - BAR_PAD.left - BAR_PAD.right;
  const plotH = size.height - BAR_PAD.top - BAR_PAD.bottom;
  const slot = plotW / n;
  return {
    slot,
    plotH,
    cx: (i) => r1(BAR_PAD.left + slot * (i + 0.5)),
    y: (v) => r1(BAR_PAD.top + plotH - (v / axis.max) * plotH),
    minute: (px) => Math.min(n - 1, Math.max(0, Math.floor((px - BAR_PAD.left) / slot))),
    value: (py) => Math.min(axis.max, Math.max(RATE_MIN, Math.round(((BAR_PAD.top + plotH - py) / plotH) * axis.max))),
  };
}

/**
 * Столбики темпа по минутам. Каждый столбик — ползунок: его тянут мышью и
 * меняют стрелками. opts.focus — столбик в порядке табуляции, opts.now —
 * текущая минута метронома, opts.axis — шкала, закреплённая на время перетаскивания.
 */
export function barChart(L, state, size = chartSize(900), opts = {}) {
  const data = rows(state);
  const n = data.length;
  const total = data[n - 1].cum;
  const axis = opts.axis || barAxis(state);
  const g = barGeometry(n, size, axis);
  const x0 = BAR_PAD.left;
  const x1 = size.width - BAR_PAD.right;
  let s = '';
  for (let v = 0; v <= axis.max; v += axis.tick) {
    s += `<line class="grid" x1="${x0}" x2="${x1}" y1="${g.y(v)}" y2="${g.y(v)}"/>`;
    s += `<text x="${x0 - 6}" y="${g.y(v) + 4}" text-anchor="end">${v}</text>`;
  }
  s += `<line class="axis" x1="${x0}" x2="${x1}" y1="${g.y(0)}" y2="${g.y(0)}"/>`;
  s += `<text class="axis-label" x="${x0 - 6}" y="${BAR_PAD.top - 10}">${L.t('tempo.axis.perMin')}</text>`;
  const step = minuteStep(n);
  for (const r of data) {
    if (r.minute === 1 || r.minute % step === 0) s += `<text x="${g.cx(r.minute - 1)}" y="${g.y(0) + 17}" text-anchor="middle">${r.minute}</text>`;
  }
  const bw = r1(Math.max(1.5, g.slot * (n > 30 ? 0.8 : 0.66)));
  const focus = Math.min(opts.focus ?? 0, n - 1);
  const labels = g.slot >= 16;
  data.forEach((r, i) => {
    const cls = ['bar', r.hand ? `bar-h${r.hand}` : '', opts.now === i ? 'now' : ''].filter(Boolean).join(' ');
    const y = g.y(r.reps);
    s += `<rect class="${cls}" data-i="${i}" x="${r1(g.cx(i) - bw / 2)}" y="${y}" width="${bw}" height="${r1(g.y(0) - y)}" tabindex="${i === focus ? 0 : -1}" role="slider" aria-label="${L.t('tempo.bar.label', { m: r.minute })}" aria-valuemin="${RATE_MIN}" aria-valuemax="${RATE_MAX}" aria-valuenow="${r.reps}" aria-valuetext="${L.t('tempo.bar.value', { reps: r.reps, word: L.plural(r.reps, 'reps'), sec: secPerRep(L, r.reps) })}"/>`;
    if (labels) s += `<text class="bar-label" x="${g.cx(i)}" y="${y - 5}" text-anchor="middle">${r.reps}</text>`;
  });
  const even = total / n;
  s += `<line class="even" x1="${x0}" x2="${x1}" y1="${g.y(even)}" y2="${g.y(even)}"/>`;
  s += `<text class="even-label" x="${x1}" y="${BAR_PAD.top - 10}" text-anchor="end">${L.t('tempo.even', { v: L.dec(even) })}</text>`;
  if (state.ex === 'snatch') {
    const hx = r1(x0 + g.slot * state.hand);
    s += `<line class="guide" x1="${hx}" x2="${hx}" y1="${BAR_PAD.top}" y2="${g.y(0)}"/>`;
  }
  return svg(size, 'chart-bars', `role="group" aria-label="${L.t('tempo.chart.label')}"`, s);
}

// ------------------------------------------------------------- легенды и итог

const lineKey = (cls, text) => `<li><svg class="key" viewBox="0 0 22 8" aria-hidden="true"><line class="${cls}" x1="1" y1="4" x2="21" y2="4"/></svg>${text}</li>`;
const barKey = (cls, text) => `<li><svg class="key" viewBox="0 0 22 8" aria-hidden="true"><rect class="${cls}" x="6" y="0" width="10" height="8"/></svg>${text}</li>`;

export function barLegend(L, state) {
  const hands = state.ex === 'snatch'
    ? barKey('bar bar-h1', L.t('tempo.legend.h1')) + barKey('bar bar-h2', L.t('tempo.legend.h2')) + lineKey('guide', L.t('tempo.legend.switch'))
    : barKey('bar', L.t('tempo.legend.perMin'));
  return `<ul class="legend">${hands}${lineKey('even', L.t('tempo.legend.even'))}<li class="legend-hint">${L.t('tempo.legend.hint')}</li></ul>`;
}


/** «Итог плана: 80 подъёмов за 10 минут, в среднем 8 в минуту. По минутам: 7, 7, 8 × 7, 10.» */
export function summary(L, state) {
  const data = rows(state);
  const n = data.length;
  const last = data[n - 1];
  const reps = data.map((r) => r.reps);
  let s = L.t('tempo.summary', {
    total: `<b class="n">${last.cum}</b>`, reps: L.plural(last.cum, 'reps'),
    n: `<span class="n">${n}</span>`, minutes: L.plural(n, 'minutes'),
    avg: `<span class="n">${L.dec(last.cum / n)}</span>`, plan: `<span class="n plan-text">${planText(reps)}</span>`,
  });
  if (state.ex === 'snatch') {
    s += ` ${L.t('tempo.summary.hands', {
      h1: `<b class="n">${last.h1}</b>`, first: `<span class="n">1–${state.hand}</span>`,
      h2: `<b class="n">${last.h2}</b>`, second: `<span class="n">${state.hand + 1}–${n}</span>`,
    })}`;
  }
  return s;
}

// ------------------------------------------------------------- ошибки и голос

/** Объяснение ошибки цели или отрезка: { code, …числа } из tempo.js → строка словаря. */
export function errorText(L, error) {
  if (!error) return '';
  const words = {};
  if ('reps' in error) words.word = L.plural(Math.abs(error.reps), 'reps');
  if ('n' in error) words.minutes = L.plural(error.n, error.code === 'segOver' ? 'minutesGen' : 'minutes');
  if (error.code === 'goalMax') words.maxWord = L.plural(error.max, 'reps');
  if (error.code === 'rate') words.example = L.dec(7.5);
  return L.t(`tempo.err.${error.code}`, { ...error, ...words });
}

/** Что метроном говорит в начале минуты m (с 0). */
export function announce(L, state, m) {
  const reps = repsOf(state);
  const parts = [];
  if (state.ex === 'snatch' && m === state.hand) parts.push(L.t('tempo.say.switch'));
  parts.push(m === reps.length - 1 ? L.t('tempo.say.last') : L.t('tempo.say.minute', { m: m + 1 }));
  parts.push(L.t('tempo.say.rate', { r: reps[m] }));
  return parts.join(' ');
}

/** Строка метронома: время, минута и её темп. */
export const metroText = (L, clockText, m, n, reps) => L.t('tempo.metro.now', { clock: clockText, m, n, reps });

/**
 * Табло метронома на весь экран: часы, темп текущей минуты крупно, минута из скольких,
 * рука в рывке и темп следующей минуты. sec — секунды от старта.
 */
export function metroBoard(L, state, sec) {
  const reps = repsOf(state);
  const n = reps.length;
  const m = Math.min(n - 1, Math.max(0, Math.floor(sec / 60)));
  const t = (key, args) => L.t(`tempo.board.${key}`, args);
  const hand = state.ex === 'snatch' ? ` · ${L.t(`tempo.legend.${m < state.hand ? 'h1' : 'h2'}`)}` : '';
  const next = m === n - 1 ? t('last') : t('next', { reps: reps[m + 1] });
  return `<p class="board-clock n">${clock(Math.max(0, sec))}</p>
<p class="board-rate"><span class="n">${reps[m]}</span> <span class="board-unit">${L.t('tempo.axis.perMin')}</span></p>
<p class="board-minute">${t('minute', { m: m + 1, n })}${hand}</p>
<p class="board-next">${next}</p>`;
}

// ------------------------------------------------------------- отрезки

/** Строки отрезков «N мин по R в минуту»; минуты последнего — остаток. */
export function segmentRows(L, state) {
  const { seg } = state;
  return seg.map((s, i) => {
    const k = i + 1;
    const last = i === seg.length - 1;
    const minutes = last
      ? `<span class="n seg-rest" id="seg-rest">${s.n}</span>`
      : `<input class="n seg-n" type="text" inputmode="numeric" autocomplete="off" data-k="n" value="${s.n}" aria-label="${L.t('tempo.seg.minutesAria', { k })}">`;
    const remove = seg.length > 1 ? `<button type="button" class="btn-x" data-remove="${i}" aria-label="${L.t('tempo.seg.remove', { k })}">×</button>` : '';
    return `<li class="seg" data-i="${i}">${minutes}<span>${L.t('tempo.seg.minBy')}</span><input class="n seg-r" type="text" inputmode="decimal" autocomplete="off" data-k="r" value="${rateText(L, s.r)}" aria-label="${L.t('tempo.seg.rateAria', { k })}"><span>${L.t(last ? 'tempo.seg.perMinLast' : 'tempo.seg.perMin')}</span>${remove}</li>`;
  }).join('');
}

/** Сумма темпов: «3 × 7 + 6 × 8 + 1 × 10 = 79»; дробная — с округлением вниз. */
export function paceSum(L, state) {
  const { seg } = state;
  const total = segSum(seg);
  const terms = seg.map((s) => `${s.n} × ${rateText(L, s.r)}`).join(' + ');
  const whole = Math.floor(total / 100);
  const tail = total % 100 ? ` → <b>${whole}</b>` : '';
  return L.t('tempo.paceSum', { sum: `<span class="n">${terms} = ${rateText(L, total)}${tail}</span>` });
}

// ------------------------------------------------------------- таблица

export function tableHead(L, state) {
  const th = (key, cls) => `<th scope="col"${cls ? ` class="${cls}"` : ''}>${L.t(`tempo.th.${key}`)}</th>`;
  const counts = state.ex === 'snatch' ? th('h1') + th('h2') + th('sum', 'total') : th('total', 'total');
  return `<tr>${th('minute')}${th('reps')}${th('sec')}${counts}${th('dev')}</tr>`;
}

export function tableBody(L, state, now = -1) {
  const snatch = state.ex === 'snatch';
  return rows(state).map((r, i) => {
    const cls = [i === now ? 'now' : '', snatch && i === state.hand ? 'switch' : ''].filter(Boolean).join(' ');
    const counts = snatch
      ? `<td class="n">${r.hand === 1 ? r.h1 : ''}</td><td class="n">${r.hand === 2 ? r.h2 : ''}</td><td class="n total">${r.cum}</td>`
      : `<td class="n total">${r.cum}</td>`;
    return `<tr${cls ? ` class="${cls}"` : ''}><td class="n">${r.minute}</td><td class="n">${r.reps}</td><td class="n">${secPerRep(L, r.reps)}</td>${counts}<td class="n">${signed(r.dev)}</td></tr>`;
  }).join('');
}

export function tableFoot(L, state) {
  const data = rows(state);
  const last = data[data.length - 1];
  const counts = state.ex === 'snatch'
    ? `<td class="n">${last.h1}</td><td class="n">${last.h2}</td><td class="n total">${last.cum}</td>`
    : `<td class="n total">${last.cum}</td>`;
  return `<tr><th scope="row">${L.t('tempo.tf.total')}</th><td class="n">${last.cum}</td><td class="n">${secPerRep(L, last.cum / data.length)}</td>${counts}<td></td></tr>`;
}
