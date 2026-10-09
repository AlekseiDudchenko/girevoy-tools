// Коэффициенты для гирь разного веса: чистые функции расчёта и состояния страницы.
// Общие для браузера (/lib/coefficients.js) и тестов: без DOM и без зависимостей.
//
// Зачётный результат = подъёмы × коэффициент. У лёгкой гири коэффициент 1,00,
// у тяжёлой — k ≥ 1. Коэффициент хранится с точностью до сотых и в расчёте
// переводится в целые сотые: так 50 × 1,6 даёт ровно 80, а не 80,000…01.

export const WEIGHTS = [8, 12, 16, 20, 24, 28, 32];
export const STEPS = [5, 10];
export const TABS = ['score', 'eq'];
export const K_MIN = 1;
export const K_MAX = 4;
export const SCORE_MAX = 999;
export const ROWS_MAX = 100;

export const DEFAULT_LIGHT = 24;
export const DEFAULT_HEAVY = 32;
export const DEFAULT_TABLE = { step: 10, from: 40, to: 140 };
export const DEFAULT_SCORE = 80;

/** Округление до сотых без хвостов плавающей точки. */
export const round2 = (x) => Math.round(x * 100) / 100;

/** Коэффициент в целых сотых: 1.6 → 160. */
export const hundredths = (k) => Math.round(k * 100);

/** Отношение «по весу гири»: тяжёлая / лёгкая, 32 / 24 = 1,333… */
export const weightRatio = (light, heavy) => heavy / light;

/** Коэффициент по умолчанию — отношение весов, округлённое до сотых. */
export const defaultK = (light, heavy) => round2(weightRatio(light, heavy));

/**
 * Подъёмов на тяжёлой гире: наименьшее целое n, при котором n × k ≥ результата.
 * Считается в целых сотых, поэтому ceil(80 / 1,6) = 50, а не 51.
 */
export function heavyReps(score, k) {
  const kh = hundredths(k);
  if (!(kh > 0)) throw new RangeError(`коэффициент должен быть положительным: ${k}`);
  const s = Math.round(score * 100);
  if (Math.abs(s - score * 100) > 1e-6) {
    // Результат с точностью мельче сотых: целочисленный путь неприменим.
    return Math.ceil(score / (kh / 100) - 1e-9);
  }
  // ceil(s / kh) для целых: s = результат × 100, kh = k × 100.
  return Math.floor((s + kh - 1) / kh);
}

/** Зачётный результат: подъёмы × k, точно до сотых. */
export const scoreOf = (reps, k) => (reps * hundredths(k)) / 100;

/** Коэффициент из равноценных подъёмов: 80 на лёгкой = 50 на тяжёлой → 1,60. */
export function equivalentK(lightReps, heavyRepsValue) {
  if (!(heavyRepsValue > 0)) return K_MAX;
  return clampK(round2(lightReps / heavyRepsValue));
}

export const clampK = (k) => Math.min(K_MAX, Math.max(K_MIN, k));

/** Верхняя граница ползунка: с запасом над ориентиром по весу и выбранным k. */
export function sliderMax(state) {
  const ratio = weightRatio(state.light, state.heavy);
  const base = ratio <= 1.6 ? 2.5 : K_MAX;
  return Math.min(K_MAX, Math.max(base, Math.ceil(state.k * 4) / 4));
}

/** Строки таблицы: результат от from до to с шагом step. */
export function tableRows({ k, step, from, to }) {
  const rows = [];
  for (let score = from; score <= to; score += step) {
    rows.push({ score, light: score, heavy: heavyReps(score, k) });
  }
  return rows;
}

// ------------------------------------------------------------- форматирование

/** Число с десятичной запятой: fmt(1.6, 2) → «1,60». */
export const fmt = (value, digits = 0) => Number(value).toFixed(digits).replace('.', ',');

/** Склонение: plural(5, ['подъём', 'подъёма', 'подъёмов']) → «подъёмов». */
export function plural(n, [one, few, many]) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** k для адреса: без лишних нулей, с точкой — 1.6, 1.33, 2. */
export const kParam = (k) => String(round2(k));

// ------------------------------------------------------------- состояние и адрес

export function defaultState() {
  return {
    light: DEFAULT_LIGHT,
    heavy: DEFAULT_HEAVY,
    k: defaultK(DEFAULT_LIGHT, DEFAULT_HEAVY),
    tab: 'score',
    ...DEFAULT_TABLE,
    score: DEFAULT_SCORE,
  };
}

const intParam = (params, name) => {
  const raw = params.get(name);
  if (raw === null || !/^\d{1,4}$/.test(raw.trim())) return null;
  return Number(raw.trim());
};

/**
 * Состояние из адреса страницы. Каждая группа параметров проверяется отдельно;
 * неверная группа заменяется значениями по умолчанию, остальные сохраняются.
 */
export function parseState(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');
  const state = defaultState();

  const light = intParam(params, 'light');
  const heavy = intParam(params, 'heavy');
  if (WEIGHTS.includes(light) && WEIGHTS.includes(heavy) && heavy > light) {
    state.light = light;
    state.heavy = heavy;
  }
  state.k = defaultK(state.light, state.heavy);

  const kRaw = params.get('k');
  if (kRaw !== null && /^\d+([.,]\d+)?$/.test(kRaw.trim())) {
    const k = round2(Number(kRaw.trim().replace(',', '.')));
    if (k >= K_MIN && k <= K_MAX) state.k = k;
  }

  const tab = params.get('tab');
  if (TABS.includes(tab)) state.tab = tab;

  const step = intParam(params, 'step') ?? state.step;
  const from = intParam(params, 'from') ?? state.from;
  const to = intParam(params, 'to') ?? state.to;
  if (validTable({ step, from, to })) Object.assign(state, { step, from, to });

  const score = intParam(params, 's');
  if (score !== null && score >= 1 && score <= SCORE_MAX) state.score = score;

  return state;
}

export function validTable({ step, from, to }) {
  return STEPS.includes(step)
    && Number.isInteger(from) && Number.isInteger(to)
    && from >= 1 && to <= SCORE_MAX && from < to
    && Math.floor((to - from) / step) + 1 <= ROWS_MAX;
}

/**
 * Адрес из состояния: гири, k и вкладка — всегда, настройки таблицы и выбранный
 * результат — только если отличаются от значений по умолчанию.
 */
export function serializeState(state) {
  const params = new URLSearchParams();
  params.set('light', String(state.light));
  params.set('heavy', String(state.heavy));
  params.set('k', kParam(state.k));
  params.set('tab', state.tab);
  for (const key of ['step', 'from', 'to']) {
    if (state[key] !== DEFAULT_TABLE[key]) params.set(key, String(state[key]));
  }
  if (state.score !== DEFAULT_SCORE) params.set('s', String(state.score));
  return `?${params}`;
}
