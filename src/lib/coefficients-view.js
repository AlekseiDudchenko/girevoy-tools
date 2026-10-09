// Разметка страницы коэффициентов: графики SVG, легенды, расшифровка, таблица.
// Чистые функции «состояние → строка HTML»: страница рисует ими состояние по
// умолчанию при сборке, браузер — после каждого изменения. Пользовательский текст
// сюда не попадает: только числа из состояния и постоянные подписи.
import { fmt, heavyReps, plural, tableRows, weightRatio } from './coefficients.js';

const BELL_TOKENS = { 16: 'bell-16', 24: 'bell-24', 32: 'bell-32' };

/**
 * Цвет гири: токен соревновательной гири, если он есть для этого веса,
 * иначе — цвет серии (лёгкая --s1, тяжёлая --s2).
 */
export function bellColor(weight, role) {
  const bell = BELL_TOKENS[weight];
  if (bell) return { color: `var(--${bell})`, ink: weight === 16 ? 'var(--bell-16-ink)' : 'var(--bell-ink)', halo: weight === 16 };
  return { color: role === 'light' ? 'var(--s1)' : 'var(--s2)', ink: 'var(--bell-ink)', halo: false };
}

/** Значения для style="" корневого блока: цвета гирь как ссылки на токены. */
export function colorVars(state) {
  const l = bellColor(state.light, 'light');
  const h = bellColor(state.heavy, 'heavy');
  return `--c-light: ${l.color}; --c-light-ink: ${l.ink}; --c-heavy: ${h.color}; --c-heavy-ink: ${h.ink}`;
}

export const kg = (w) => `${w}\u00a0кг`; // неразрывный пробел: «24 кг» не рвётся
const REPS = ['подъём', 'подъёма', 'подъёмов'];

// ------------------------------------------------------------- оси

const PAD = { left: 44, right: 14, top: 26, bottom: 34 };
const TICKS = [5, 10, 20, 25, 50, 100, 200];

/** Верх шкалы и шаг делений: не больше maxTicks делений, с запасом над value. */
export function niceAxis(value, maxTicks) {
  const tick = TICKS.find((t) => Math.ceil(value / t) <= maxTicks) || TICKS[TICKS.length - 1];
  return { max: Math.max(tick, Math.ceil(value / tick) * tick), tick };
}

/** Размер графика по ширине контейнера: подписи остаются 12px на любом экране. */
export function chartSize(width) {
  const w = Math.max(280, Math.round(width));
  return { width: w, height: Math.round(Math.min(380, Math.max(250, w * 0.46))) };
}

const r1 = (v) => Math.round(v * 10) / 10;

function frame(size, state, xLabel, yLabel) {
  const { width, height } = size;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const maxTicks = width < 300 ? 5 : 8;
  const { max, tick } = niceAxis(Math.max(state.to, state.score) * 1.1, maxTicks);
  const sx = (v) => r1(PAD.left + (v / max) * plotW);
  const sy = (v) => r1(PAD.top + plotH - (v / max) * plotH);
  let s = '';
  for (let v = 0; v <= max; v += tick) {
    s += `<line class="grid" x1="${sx(0)}" x2="${sx(max)}" y1="${sy(v)}" y2="${sy(v)}"/>`;
    s += `<text x="${PAD.left - 6}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`;
    s += `<text x="${sx(v)}" y="${sy(0) + 18}" text-anchor="middle">${v}</text>`;
  }
  s += `<line class="axis" x1="${sx(0)}" x2="${sx(max)}" y1="${sy(0)}" y2="${sy(0)}"/>`;
  s += `<text class="axis-label" x="${sx(max)}" y="${sy(0) - 6}" text-anchor="end">${xLabel}</text>`;
  s += `<text class="axis-label" x="${PAD.left - 6}" y="${PAD.top - 12}">${yLabel}</text>`;
  const inv = {
    x: (px) => ((px - PAD.left) / plotW) * max,
    y: (py) => ((PAD.top + plotH - py) / plotH) * max,
  };
  return { s, sx, sy, max, width, height, inv };
}

function seg(cls, x1, y1, x2, y2) {
  return `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
}

/** Прямая из начала координат с наклоном slope, обрезанная квадратом [0, max]. */
function ray(f, cls, slope, halo) {
  const x2 = Math.min(f.max, f.max / slope);
  const line = seg(cls, f.sx(0), f.sy(0), f.sx(x2), f.sy(x2 * slope));
  return halo ? seg('ln-halo', f.sx(0), f.sy(0), f.sx(x2), f.sy(x2 * slope)) + line : line;
}

function svg(f, id, label, inner) {
  return `<svg class="chart" id="${id}" viewBox="0 0 ${f.width} ${f.height}" width="${f.width}" height="${f.height}" role="img" aria-label="${label}">${inner}</svg>`;
}

// ------------------------------------------------------------- «Зачётный результат»

/** X — подъёмы, Y — зачётный результат: подъёмы × 1, подъёмы × k, пунктир по весу. */
export function scoreChart(state, size = chartSize(900)) {
  const f = frame(size, state, 'подъёмы', 'зачётный результат');
  const lc = bellColor(state.light, 'light');
  const hc = bellColor(state.heavy, 'heavy');
  const S = state.score;
  const n = heavyReps(S, state.k);
  let s = f.s;
  s += ray(f, 'ln ln-light', 1, lc.halo);
  s += ray(f, 'ln ln-heavy', state.k, hc.halo);
  // Ориентир поверх: при k, равном отношению весов, пунктир виден на линии тяжёлой.
  s += ray(f, 'ln ln-ratio', weightRatio(state.light, state.heavy));
  if (S <= f.max) {
    const xh = S / state.k;
    s += seg('guide', f.sx(0), f.sy(S), f.sx(S), f.sy(S));
    s += `<text class="guide-label" x="${f.sx(0) + 6}" y="${f.sy(S) - 6}">${S}</text>`;
    const near = Math.abs(f.sx(S) - f.sx(xh)) < 34;
    const marks = [
      { x: xh, cls: 'dot dot-heavy', label: n, anchor: near ? 'end' : 'start', dx: near ? -6 : 6 },
      { x: S, cls: 'dot dot-light', label: S, anchor: 'start', dx: 6 },
    ];
    for (const m of marks) {
      s += seg('guide', f.sx(m.x), f.sy(S), f.sx(m.x), f.sy(0));
      s += `<text class="mark-label" x="${f.sx(m.x) + m.dx}" y="${f.sy(0) - 6}" text-anchor="${m.anchor}">${m.label}</text>`;
    }
    for (const m of marks) s += `<circle class="${m.cls}" cx="${f.sx(m.x)}" cy="${f.sy(S)}" r="6"/>`;
  }
  s += `<rect class="hit" x="${f.sx(0)}" y="${f.sy(f.max)}" width="${r1(f.sx(f.max) - f.sx(0))}" height="${r1(f.sy(0) - f.sy(f.max))}"/>`;
  return svg(f, 'chart-score', `График: зачётный результат от числа подъёмов на ${kg(state.light)} и ${kg(state.heavy)}`, s);
}

// ------------------------------------------------------------- «Равноценные подъёмы»

/** X — подъёмы на лёгкой, Y — на тяжёлой: тяжёлая = лёгкая / k и два ориентира. */
export function equivChart(state, size = chartSize(900)) {
  const f = frame(size, state, `подъёмы ${kg(state.light)}`, `подъёмы ${kg(state.heavy)}`);
  const hc = bellColor(state.heavy, 'heavy');
  const S = state.score;
  const n = heavyReps(S, state.k);
  let s = f.s;
  s += ray(f, 'ln ln-equal', 1);
  s += ray(f, 'ln ln-heavy', 1 / state.k, hc.halo);
  s += ray(f, 'ln ln-ratio', 1 / weightRatio(state.light, state.heavy));
  if (S <= f.max) {
    const px = f.sx(S);
    const py = f.sy(S / state.k);
    s += seg('guide', px, f.sy(0), px, py);
    s += seg('guide', f.sx(0), py, px, py);
    const text = `${S} на ${kg(state.light)} = ${n} на ${kg(state.heavy)}`;
    s += `<text class="mark-label" ${labelPlace(f, px, py, text)}>${text}</text>`;
    s += `<rect class="hit" x="${f.sx(0)}" y="${f.sy(f.max)}" width="${r1(f.sx(f.max) - f.sx(0))}" height="${r1(f.sy(0) - f.sy(f.max))}"/>`;
    s += `<circle class="dot dot-heavy handle" cx="${px}" cy="${py}" r="9" tabindex="0" role="slider" aria-label="Равноценные подъёмы: перетащите, чтобы задать коэффициент" aria-valuemin="1" aria-valuemax="4" aria-valuenow="${state.k}" aria-valuetext="${S} на ${kg(state.light)} = ${n} на ${kg(state.heavy)}, коэффициент ${fmt(state.k, 2)}"/>`;
  }
  return svg(f, 'chart-eq', `График: равноценные подъёмы на ${kg(state.light)} и ${kg(state.heavy)}`, s);
}

/** Подпись точки: справа, если влезает, иначе слева, иначе над точкой. */
function labelPlace(f, px, py, text) {
  const w = text.length * 7.3; // моноширинный 12px
  if (px + 14 + w <= f.width - PAD.right) return `x="${px + 14}" y="${py + 4}"`;
  if (px - 14 - w >= PAD.left) return `x="${px - 14}" y="${py + 4}" text-anchor="end"`;
  const x = r1(Math.min(Math.max(PAD.left, px - w / 2), f.width - PAD.right - w));
  return `x="${x}" y="${py - 16}"`;
}

/** Пересчёт координат указателя в значения осей — для перетаскивания и щелчка. */
export function chartInverse(state, size) {
  return frame(size, state, '', '').inv;
}

// ------------------------------------------------------------- легенды и расшифровка

const key = (cls, text) => `<li><svg class="key" viewBox="0 0 22 8" aria-hidden="true"><line class="${cls}" x1="1" y1="4" x2="21" y2="4"/></svg>${text}</li>`;

export function scoreLegend(state) {
  const ratio = weightRatio(state.light, state.heavy);
  return `<ul class="legend">${key('ln ln-light', `${kg(state.light)} × <span class="n">1,00</span>`)}${key('ln ln-heavy', `${kg(state.heavy)} × <span class="n">${fmt(state.k, 2)}</span>`)}${key('ln ln-ratio', `по весу гири × <span class="n">${fmt(ratio, 2)}</span>`)}</ul>`;
}

export function equivLegend(state) {
  const ratio = weightRatio(state.light, state.heavy);
  return `<ul class="legend">${key('ln ln-heavy', `выбранный × <span class="n">${fmt(state.k, 2)}</span>`)}${key('ln ln-ratio', `по весу гири × <span class="n">${fmt(ratio, 2)}</span>`)}${key('ln ln-equal', 'гири равны × <span class="n">1,00</span>')}<li class="legend-hint">точку можно перетащить</li></ul>`;
}

/** «Зачётный результат 80: 80 подъёмов на 24 кг или 50 на 32 кг (50 × 1,60 = 80,0)». */
export function readout(state) {
  const S = state.score;
  const n = heavyReps(S, state.k);
  const total = (n * Math.round(state.k * 100)) / 100;
  return `Зачётный результат <b class="n">${S}</b>: <b class="n">${S}</b> ${plural(S, REPS)} на ${kg(state.light)} или <b class="n">${n}</b> на ${kg(state.heavy)} (<span class="n">${n} × ${fmt(state.k, 2)} = ${fmt(total, 1)}</span>)`;
}

// ------------------------------------------------------------- таблица

export function tableHead(state) {
  return `<tr><th scope="col">Подъёмов на ${kg(state.light)}<br><span class="n">× 1,00</span></th><th scope="col">Подъёмов на ${kg(state.heavy)}<br><span class="n">× ${fmt(state.k, 2)}</span></th><th scope="col" class="score">Зачётный результат</th></tr>`;
}

export function tableBody(state) {
  return tableRows(state)
    .map((r) => `<tr data-score="${r.score}" tabindex="0"${r.score === state.score ? ' class="on"' : ''}><td class="n">${r.light}</td><td class="n">${r.heavy}</td><td class="n score">${r.score}</td></tr>`)
    .join('');
}
