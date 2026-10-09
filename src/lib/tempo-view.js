// Разметка калькулятора темпа: график SVG, легенды, итог плана, отрезки, таблица.
// Чистые функции «состояние → строка HTML»: страница рисует ими состояние по
// умолчанию при сборке, браузер — после каждого изменения. Пользовательский текст
// сюда не попадает: только числа из состояния и постоянные подписи.
import { plural } from './format.js';
import { RATE_MAX, RATE_MIN, planText, rateText, rows, secPerRep, segSum } from './tempo.js';

const REPS = ['подъём', 'подъёма', 'подъёмов'];
const MINS = ['минута', 'минуты', 'минут'];

const r1 = (v) => Math.round(v * 10) / 10;
/** Число до сотых без лишних нулей, с запятой: 8 → «8», 7.5 → «7,5», 2.666… → «2,67». */
const dec = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
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
export function barChart(state, size = chartSize(900), opts = {}) {
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
  s += `<text class="axis-label" x="${x0 - 6}" y="${BAR_PAD.top - 10}">в минуту</text>`;
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
    s += `<rect class="${cls}" data-i="${i}" x="${r1(g.cx(i) - bw / 2)}" y="${y}" width="${bw}" height="${r1(g.y(0) - y)}" tabindex="${i === focus ? 0 : -1}" role="slider" aria-label="Минута ${r.minute}" aria-valuemin="${RATE_MIN}" aria-valuemax="${RATE_MAX}" aria-valuenow="${r.reps}" aria-valuetext="${r.reps} ${plural(r.reps, REPS)}, ${secPerRep(r.reps)} с на подъём"/>`;
    if (labels) s += `<text class="bar-label" x="${g.cx(i)}" y="${y - 5}" text-anchor="middle">${r.reps}</text>`;
  });
  const even = total / n;
  s += `<line class="even" x1="${x0}" x2="${x1}" y1="${g.y(even)}" y2="${g.y(even)}"/>`;
  s += `<text class="even-label" x="${x1}" y="${BAR_PAD.top - 10}" text-anchor="end">ровно ${dec(even)}</text>`;
  if (state.ex === 'snatch') {
    const hx = r1(x0 + g.slot * state.hand);
    s += `<line class="guide" x1="${hx}" x2="${hx}" y1="${BAR_PAD.top}" y2="${g.y(0)}"/>`;
  }
  return svg(size, 'chart-bars', 'role="group" aria-label="Темп по минутам: столбики можно тянуть или менять стрелками"', s);
}

// ------------------------------------------------------------- легенды и итог

const lineKey = (cls, text) => `<li><svg class="key" viewBox="0 0 22 8" aria-hidden="true"><line class="${cls}" x1="1" y1="4" x2="21" y2="4"/></svg>${text}</li>`;
const barKey = (cls, text) => `<li><svg class="key" viewBox="0 0 22 8" aria-hidden="true"><rect class="${cls}" x="6" y="0" width="10" height="8"/></svg>${text}</li>`;

export function barLegend(state) {
  const hands = state.ex === 'snatch'
    ? barKey('bar bar-h1', 'первая рука') + barKey('bar bar-h2', 'вторая рука') + lineKey('guide', 'смена руки')
    : barKey('bar', 'подъёмов в минуту');
  return `<ul class="legend">${hands}${lineKey('even', 'ровный темп того же итога')}<li class="legend-hint">столбик можно тянуть или менять стрелками ↑/↓</li></ul>`;
}


/** «Итог плана: 80 подъёмов за 10 минут, в среднем 8 в минуту. По минутам: 7, 7, 8 × 7, 10.» */
export function summary(state) {
  const data = rows(state);
  const n = data.length;
  const last = data[n - 1];
  const reps = data.map((r) => r.reps);
  let s = `Итог плана: <b class="n">${last.cum}</b> ${plural(last.cum, REPS)} за <span class="n">${n}</span> ${plural(n, MINS)}, в среднем <span class="n">${dec(last.cum / n)}</span> в минуту. По минутам: <span class="n plan-text">${planText(reps)}</span>.`;
  if (state.ex === 'snatch') {
    s += ` Первая рука — <b class="n">${last.h1}</b> (минуты <span class="n">1–${state.hand}</span>), вторая — <b class="n">${last.h2}</b> (<span class="n">${state.hand + 1}–${n}</span>).`;
  }
  return s;
}

// ------------------------------------------------------------- отрезки

/** Строки отрезков «N мин по R в минуту»; минуты последнего — остаток. */
export function segmentRows(state) {
  const { seg } = state;
  return seg.map((s, i) => {
    const k = i + 1;
    const last = i === seg.length - 1;
    const minutes = last
      ? `<span class="n seg-rest" id="seg-rest">${s.n}</span>`
      : `<input class="n seg-n" type="text" inputmode="numeric" autocomplete="off" data-k="n" value="${s.n}" aria-label="Отрезок ${k}: минут">`;
    const remove = seg.length > 1 ? `<button type="button" class="btn-x" data-remove="${i}" aria-label="Удалить отрезок ${k}">×</button>` : '';
    return `<li class="seg" data-i="${i}">${minutes}<span>мин по</span><input class="n seg-r" type="text" inputmode="decimal" autocomplete="off" data-k="r" value="${rateText(s.r)}" aria-label="Отрезок ${k}: подъёмов в минуту"><span>в минуту${last ? ', до конца' : ''}</span>${remove}</li>`;
  }).join('');
}

/** Сумма темпов: «3 × 7 + 6 × 8 + 1 × 10 = 79»; дробная — с округлением вниз. */
export function paceSum(state) {
  const { seg } = state;
  const total = segSum(seg);
  const terms = seg.map((s) => `${s.n} × ${rateText(s.r)}`).join(' + ');
  const whole = Math.floor(total / 100);
  const tail = total % 100 ? ` → <b>${whole}</b>` : '';
  return `Итог — от суммы темпов, без округления каждой минуты: <span class="n">${terms} = ${rateText(total)}${tail}</span>.`;
}

// ------------------------------------------------------------- таблица

export function tableHead(state) {
  const counts = state.ex === 'snatch'
    ? '<th scope="col">Первая рука</th><th scope="col">Вторая рука</th><th scope="col" class="total">Сумма</th>'
    : '<th scope="col" class="total">Итог</th>';
  return `<tr><th scope="col">Минута</th><th scope="col">Подъёмов</th><th scope="col">Секунд на&nbsp;подъём</th>${counts}<th scope="col">± к&nbsp;ровному</th></tr>`;
}

export function tableBody(state, now = -1) {
  const snatch = state.ex === 'snatch';
  return rows(state).map((r, i) => {
    const cls = [i === now ? 'now' : '', snatch && i === state.hand ? 'switch' : ''].filter(Boolean).join(' ');
    const counts = snatch
      ? `<td class="n">${r.hand === 1 ? r.h1 : ''}</td><td class="n">${r.hand === 2 ? r.h2 : ''}</td><td class="n total">${r.cum}</td>`
      : `<td class="n total">${r.cum}</td>`;
    return `<tr${cls ? ` class="${cls}"` : ''}><td class="n">${r.minute}</td><td class="n">${r.reps}</td><td class="n">${secPerRep(r.reps)}</td>${counts}<td class="n">${signed(r.dev)}</td></tr>`;
  }).join('');
}

export function tableFoot(state) {
  const data = rows(state);
  const last = data[data.length - 1];
  const counts = state.ex === 'snatch'
    ? `<td class="n">${last.h1}</td><td class="n">${last.h2}</td><td class="n total">${last.cum}</td>`
    : `<td class="n total">${last.cum}</td>`;
  return `<tr><th scope="row">Всего</th><td class="n">${last.cum}</td><td class="n">${secPerRep(last.cum / data.length)}</td>${counts}<td></td></tr>`;
}
