// Разметка страницы коэффициентов: графики SVG, легенды, расшифровка, таблица.
// Чистые функции «состояние → строка HTML»: страница рисует ими состояние по
// умолчанию при сборке, браузер — после каждого изменения. Пользовательский текст
// сюда не попадает: только числа из состояния и подписи из словаря языка страницы.
// Первый аргумент каждой функции с текстом — L, язык страницы (locale.js).
import { convert, heavyReps, scoreOf, tableRows, weightRatio } from './coefficients.js';

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

/** Вес гири: «24 кг», «24 kg» — с неразрывным пробелом из словаря. */
export const kg = (L, w) => L.t('unit.kg', { w });

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

/** Обе гири для подстановки в строку словаря. */
const bells = (L, state) => ({ light: kg(L, state.light), heavy: kg(L, state.heavy) });

// ------------------------------------------------------------- «Зачётный результат»

/** X — подъёмы, Y — зачётный результат: подъёмы × 1, подъёмы × k, пунктир по весу. */
export function scoreChart(L, state, size = chartSize(900)) {
  const f = frame(size, state, L.t('coef.axis.reps'), L.t('coef.axis.score'));
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
  return svg(f, 'chart-score', L.t('coef.chart.score', bells(L, state)), s);
}

// ------------------------------------------------------------- «Равноценные подъёмы»

/** X — подъёмы на лёгкой, Y — на тяжёлой: тяжёлая = лёгкая / k и два ориентира. */
export function equivChart(L, state, size = chartSize(900)) {
  const f = frame(size, state, L.t('coef.axis.repsOn', { w: kg(L, state.light) }), L.t('coef.axis.repsOn', { w: kg(L, state.heavy) }));
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
    const text = L.t('coef.chart.equal', { score: S, n, ...bells(L, state) });
    s += `<text class="mark-label" ${labelPlace(f, px, py, text)}>${text}</text>`;
    s += `<rect class="hit" x="${f.sx(0)}" y="${f.sy(f.max)}" width="${r1(f.sx(f.max) - f.sx(0))}" height="${r1(f.sy(0) - f.sy(f.max))}"/>`;
    s += `<circle class="dot dot-heavy handle" cx="${px}" cy="${py}" r="9" tabindex="0" role="slider" aria-label="${L.t('coef.chart.handle')}" aria-valuemin="1" aria-valuemax="4" aria-valuenow="${state.k}" aria-valuetext="${L.t('coef.chart.handleValue', { text, k: L.num(state.k, 2) })}"/>`;
  }
  return svg(f, 'chart-eq', L.t('coef.chart.eq', bells(L, state)), s);
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

const times = (L, k) => `× <span class="n">${L.num(k, 2)}</span>`;

export function scoreLegend(L, state) {
  const ratio = weightRatio(state.light, state.heavy);
  return `<ul class="legend">${key('ln ln-light', `${kg(L, state.light)} ${times(L, 1)}`)}${key('ln ln-heavy', `${kg(L, state.heavy)} ${times(L, state.k)}`)}${key('ln ln-ratio', `${L.t('coef.legend.ratio')} ${times(L, ratio)}`)}</ul>`;
}

export function equivLegend(L, state) {
  const ratio = weightRatio(state.light, state.heavy);
  return `<ul class="legend">${key('ln ln-heavy', `${L.t('coef.legend.chosen')} ${times(L, state.k)}`)}${key('ln ln-ratio', `${L.t('coef.legend.ratio')} ${times(L, ratio)}`)}${key('ln ln-equal', `${L.t('coef.legend.equal')} ${times(L, 1)}`)}<li class="legend-hint">${L.t('coef.legend.drag')}</li></ul>`;
}

/** Пояснение к пунктиру: отношение весов гирь. */
export function ratioHint(L, state) {
  const ratio = `<span class="n">${state.heavy} / ${state.light} = ${L.num(weightRatio(state.light, state.heavy), 2)}</span>`;
  return L.t('coef.ratioHint', { ratio });
}

/** «Зачётный результат 80: 80 подъёмов на 24 кг или 50 на 32 кг (50 × 1,60 = 80,0)». */
export function readout(L, state) {
  const S = state.score;
  const n = heavyReps(S, state.k);
  const total = (n * Math.round(state.k * 100)) / 100;
  return L.t('coef.readout', {
    score: S, reps: L.plural(S, 'reps'), n, ...bells(L, state),
    calc: `<span class="n">${n} × ${L.num(state.k, 2)} = ${L.num(total, 1)}</span>`,
  });
}

// ------------------------------------------------------------- пересчёт

/** Значения трёх полей пересчёта по введённому. */
export const calcValues = (state) => convert(state.k, state.calc.field, state.calc.value);

/** Число для поля ввода: целое как есть, дробное — до сотых с десятичным знаком языка. */
export const calcText = (L, v) => (Number.isInteger(v) ? String(v) : L.num(v, 2));

/** Подписи полей пересчёта: меняются вместе с гирями. */
export const calcLabels = (L, state) => ({
  light: L.t('coef.repsOn', { w: kg(L, state.light) }),
  heavy: L.t('coef.repsOn', { w: kg(L, state.heavy) }),
  score: L.t('coef.score'),
});

/** Пояснение под строкой пересчёта: как получено каждое число. */
export function calcNote(L, state) {
  const { light, heavy, score } = calcValues(state);
  const lightLine = L.t('coef.calc.line', { calc: `<span class="n">${light} × ${L.num(1, 2)} = ${light}</span>`, w: kg(L, state.light) });
  const heavyLine = L.t('coef.calc.line', { calc: `<span class="n">${heavy} × ${L.num(state.k, 2)} = ${L.num(scoreOf(heavy, state.k), 2)}</span>`, w: kg(L, state.heavy) });
  if (state.calc.field === 'heavy') {
    return L.t('coef.calc.fromHeavy', { heavyLine, light: kg(L, state.light), n: `<span class="n">${light}</span>`, reps: L.plural(light, 'reps') });
  }
  return L.t('coef.calc.fromTarget', { target: `<span class="n">${calcText(L, score)}</span>`, lightLine, heavyLine });
}

// ------------------------------------------------------------- таблица

export function tableHead(L, state) {
  const head = (w, k) => `<th scope="col">${L.t('coef.repsOn', { w: kg(L, w) })}<br><span class="n">× ${L.num(k, 2)}</span></th>`;
  return `<tr>${head(state.light, 1)}${head(state.heavy, state.k)}<th scope="col" class="score">${L.t('coef.score')}</th></tr>`;
}

export function tableBody(state) {
  return tableRows(state)
    .map((r) => `<tr data-score="${r.score}" tabindex="0"${r.score === state.score ? ' class="on"' : ''}><td class="n">${r.light}</td><td class="n">${r.heavy}</td><td class="n score">${r.score}</td></tr>`)
    .join('');
}
