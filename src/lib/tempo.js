// Калькулятор темпа: чистые функции раскладки подъёмов по минутам и состояния
// страницы. Общие для браузера (/lib/tempo.js) и тестов: без DOM и без зависимостей.
//
// Подъёмы в минуте — всегда целые. Темп может быть дробным: минута i получает
// floor(S_i) − floor(S_{i−1}), где S_i — сумма темпов первых i минут. Так сумма
// минут равна floor(S_N) и подъёмы не теряются. Темп хранится в целых сотых:
// 7,5 → 750, поэтому 7,5 × 4 даёт ровно 30, а не 29,999…
//
// Текста здесь нет: названия, подсказки и объяснения ошибок — в словарях src/i18n/
// по ключам tempo.ex.<id>, tempo.s.<id>, tempo.err.<code>. Функции, которые
// показывают число, принимают L — язык страницы (locale.js).

export const EXERCISES = [{ id: 'jerk' }, { id: 'lc' }, { id: 'snatch' }];
export const MINUTES = [5, 10, 30, 60];
export const MODES = ['goal', 'pace', 'plan'];
export const STRATEGIES = [{ id: 'even' }, { id: 'ramp' }, { id: 'finish' }];

export const RATE_MIN = 1;
export const RATE_MAX = 30;
export const D_MIN = 1;
export const D_MAX = 10;
export const SEG_MAX = 10;

export const DEFAULT_EX = 'lc';
export const DEFAULT_MIN = 10;
export const DEFAULT_STRATEGY = 'finish';
export const DEFAULT_D = 2;
/** Цель по умолчанию — 8 подъёмов в минуту: 80 за 10 минут. */
export const defaultGoal = (n) => 8 * n;
/** Смена руки в рывке по умолчанию — после половины времени. */
export const defaultHand = (n) => Math.floor(n / 2);

const sum = (xs) => xs.reduce((a, x) => a + x, 0);

// Деление целых с округлением вниз. Числители здесь меньше 2^53, и если частное
// не целое, его дробная часть не меньше 1/знаменатель, а это много больше ошибки
// округления double, — поэтому Math.floor не ошибается на границе.
const idiv = (a, b) => Math.floor(a / b);

// ------------------------------------------------------------- раскладка

/** Подъёмы по минутам из нарастающего итога: минута i — cum(i) − cum(i − 1). */
function fromCumulative(n, cum) {
  const reps = [];
  let prev = 0;
  for (let i = 1; i <= n; i += 1) {
    const c = cum(i);
    reps.push(c - prev);
    prev = c;
  }
  return reps;
}

/**
 * От цели к темпу: goal подъёмов за n минут по стратегии, прибавка d.
 * Каждая стратегия даёт ровно goal; допустимость минут проверяет goalError.
 */
export function goalReps(goal, n, strategy, d) {
  if (strategy === 'finish') {
    // Последняя минута — ровный темп (округлённый) плюс d, остаток поровну
    // на n − 1 минут, минуты на один подъём больше — ближе к концу.
    const last = idiv(2 * goal + n, 2 * n) + d;
    const rest = goal - last;
    const base = idiv(rest, n - 1);
    const extra = rest - base * (n - 1);
    const reps = [];
    for (let i = 0; i < n - 1; i += 1) reps.push(i < n - 1 - extra ? base : base + 1);
    reps.push(last);
    return reps;
  }
  if (strategy === 'ramp') {
    // r_i = G/N − d/2 + d·(i−1)/(N−1); сумма первых i минут, умноженная
    // на 2N(N−1), — целое число.
    const den = 2 * n * (n - 1);
    return fromCumulative(n, (i) => idiv(2 * i * goal * (n - 1) - i * d * n * (n - 1) + d * n * i * (i - 1), den));
  }
  return fromCumulative(n, (i) => idiv(goal * i, n));
}

/** От темпа к итогу: отрезки [{ n: минут, r: темп в сотых }]. */
export function paceReps(seg) {
  const reps = [];
  let s = 0;
  let prev = 0;
  for (const { n, r } of seg) {
    for (let k = 0; k < n; k += 1) {
      s += r;
      const c = idiv(s, 100);
      reps.push(c - prev);
      prev = c;
    }
  }
  return reps;
}

/** Подъёмы по минутам для состояния страницы в любом режиме. */
export function repsOf(state) {
  if (state.mode === 'plan') return [...state.plan];
  if (state.mode === 'pace') return paceReps(state.seg);
  return goalReps(state.goal, state.min, state.strategy, state.d);
}

/**
 * Почему цель не принимается: null — цель допустима, иначе { code, …числа } для
 * строки словаря tempo.err.<code>. Темп каждой минуты — от 1 до 30 подъёмов.
 * В стратегиях с прибавкой совет называет и её: код с окончанием D.
 */
export function goalError(goal, n, strategy, d) {
  if (!Number.isInteger(goal) || goal < 1) return { code: 'goalInt' };
  if (goal > n * RATE_MAX) return { code: 'goalMax', n, max: n * RATE_MAX, rate: RATE_MAX };
  if (!Number.isInteger(d) || d < D_MIN || d > D_MAX) return { code: 'd', min: D_MIN, max: D_MAX };
  const reps = goalReps(goal, n, strategy, d);
  const tail = strategy === 'even' ? '' : 'D';
  const low = reps.findIndex((r) => r < RATE_MIN);
  if (low >= 0) return { code: `low${tail}`, m: low + 1, reps: reps[low], limit: RATE_MIN };
  const high = reps.findIndex((r) => r > RATE_MAX);
  if (high >= 0) return { code: `high${tail}`, m: high + 1, reps: reps[high], limit: RATE_MAX };
  return null;
}

// ------------------------------------------------------------- отрезки

export const segMinutes = (seg) => sum(seg.map((s) => s.n));

export function validSegments(seg, n) {
  return Array.isArray(seg) && seg.length >= 1 && seg.length <= SEG_MAX
    && seg.every((s) => Number.isInteger(s.n) && s.n >= 1
      && Number.isInteger(s.r) && s.r >= RATE_MIN * 100 && s.r <= RATE_MAX * 100)
    && segMinutes(seg) === n;
}

/** Последний отрезок добирает оставшиеся минуты; лишние отрезки отбрасываются. */
export function fitSegments(seg, n) {
  const out = [];
  let used = 0;
  for (const s of seg.slice(0, -1)) {
    const k = Math.min(s.n, n - 1 - used);
    if (k >= 1) {
      out.push({ n: k, r: s.r });
      used += k;
    }
  }
  out.push({ n: n - used, r: seg[seg.length - 1].r });
  return out;
}

/**
 * Отрезки из подъёмов по минутам: одинаковые минуты подряд — один отрезок.
 * Если отрезков больше SEG_MAX, — один отрезок со средним темпом.
 */
export function toSegments(reps) {
  const runs = [];
  for (const r of reps) {
    const last = runs[runs.length - 1];
    if (last && last.r === r * 100) last.n += 1;
    else runs.push({ n: 1, r: r * 100 });
  }
  if (runs.length <= SEG_MAX) return runs;
  return [{ n: reps.length, r: idiv(sum(reps) * 100, reps.length) }];
}

/** Темп из поля ввода в сотых: «7,5» → 750; неверный — NaN. */
export function parseRate(raw) {
  const m = /^\s*(\d{1,2})(?:[.,](\d{1,2}))?\s*$/.exec(String(raw));
  if (!m) return NaN;
  const r = Number(m[1]) * 100 + Number((m[2] || '0').padEnd(2, '0'));
  return r >= RATE_MIN * 100 && r <= RATE_MAX * 100 ? r : NaN;
}

/** Темп для показа на языке страницы: 750 → «7,5» или «7.5», 700 → «7», 725 → «7,25». */
export const rateText = (L, r) => L.dec(r / 100);

/** Темп для адреса: 750 → «7.5». */
const rateParam = (r) => String(r / 100);

/**
 * Изменение одного поля отрезка: key — 'n' (минут) или 'r' (темп), raw — ввод
 * с запятой или точкой. Возвращает { seg } или { error: { code, …числа } }
 * для строки словаря tempo.err.<code>.
 */
export function editSegment(seg, idx, key, raw, n) {
  let value;
  if (key === 'r') {
    value = parseRate(raw);
    if (Number.isNaN(value)) return { error: { code: 'rate', min: RATE_MIN, max: RATE_MAX } };
  } else {
    value = /^\s*\d{1,2}\s*$/.test(String(raw)) ? Number(raw) : NaN;
    if (!(value >= 1)) return { error: { code: 'segMin' } };
  }
  const out = seg.map((s, i) => (i === idx ? { ...s, [key]: value } : { ...s }));
  out[out.length - 1].n = n - segMinutes(out.slice(0, -1));
  if (!validSegments(out, n)) return { error: { code: 'segOver', n: n - 1 } };
  return { seg: out };
}

/** Можно ли добавить отрезок: их меньше SEG_MAX и есть отрезок длиннее минуты. */
export const canAddSegment = (seg) => seg.length < SEG_MAX && seg.some((s) => s.n >= 2);

/** Новый отрезок в конце: минута берётся у последнего отрезка длиннее минуты. */
export function addSegment(seg) {
  if (!canAddSegment(seg)) return seg;
  const out = seg.map((s) => ({ ...s }));
  let i = out.length - 1;
  while (out[i].n < 2) i -= 1;
  out[i].n -= 1;
  out.push({ n: 1, r: out[out.length - 1].r });
  return out;
}

export function removeSegment(seg, idx, n) {
  if (seg.length < 2) return seg;
  return fitSegments(seg.filter((_, i) => i !== idx), n);
}

/** Сумма темпов отрезков в сотых — итог до округления. */
export const segSum = (seg) => sum(seg.map((s) => s.n * s.r));

// ------------------------------------------------------------- свой план

export const validPlan = (plan, n) => Array.isArray(plan) && plan.length === n
  && plan.every((r) => Number.isInteger(r) && r >= RATE_MIN && r <= RATE_MAX);

/** Перетаскивание столбика: меняется только минута i, режим — «свой план». */
export function setMinute(state, i, value) {
  const plan = repsOf(state);
  plan[i] = Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(value)));
  return { ...state, mode: 'plan', plan };
}

// ------------------------------------------------------------- переходы

/** Смена режима: «от темпа» и «свой план» начинаются с текущей раскладки. */
export function toMode(state, mode) {
  if (mode === state.mode) return state;
  const reps = repsOf(state);
  const next = { ...state, mode, seg: [], plan: [] };
  if (mode === 'pace') next.seg = toSegments(reps);
  if (mode === 'plan') next.plan = reps;
  return next;
}

/**
 * Смена времени регламента. Цель — пропорционально, темп сохраняется
 * (80 за 10 минут → 40 за 5); отрезки — последний добирает; свой план —
 * обрезается или продолжается последней минутой.
 */
export function withMinutes(state, n) {
  const old = state.min;
  if (n === old) return state;
  const next = { ...state, min: n };
  next.goal = Math.round((state.goal * n) / old);
  if (goalError(next.goal, n, next.strategy, next.d)) {
    if (!goalError(next.goal, n, 'even', next.d)) next.strategy = 'even';
    else Object.assign(next, { goal: defaultGoal(n), strategy: DEFAULT_STRATEGY, d: DEFAULT_D });
  }
  if (state.seg.length) next.seg = fitSegments(state.seg, n);
  if (state.plan.length) {
    next.plan = state.plan.slice(0, n);
    while (next.plan.length < n) next.plan.push(next.plan[next.plan.length - 1]);
  }
  next.hand = state.hand === defaultHand(old) ? defaultHand(n) : Math.min(state.hand, n - 1);
  return next;
}

// ------------------------------------------------------------- таблица

/**
 * Строки таблицы по минутам. dev — отклонение нарастающего итога от ровной
 * раскладки того же итога: cum − floor(T·i/N). В рывке hand — 1 или 2, h1 и h2 —
 * нарастающий итог каждой руки; в остальных упражнениях hand = 0.
 */
export function rows(state) {
  const reps = repsOf(state);
  const n = reps.length;
  const total = sum(reps);
  const snatch = state.ex === 'snatch';
  let cum = 0;
  let h1 = 0;
  let h2 = 0;
  return reps.map((r, i) => {
    cum += r;
    const hand = snatch ? (i < state.hand ? 1 : 2) : 0;
    if (hand === 2) h2 += r;
    else h1 += r;
    return { minute: i + 1, reps: r, cum, dev: cum - idiv(total * (i + 1), n), hand, h1, h2 };
  });
}

/** Секунд на подъём, один знак: 7 → «8,6» или «8.6»; 0 подъёмов — «—». */
export const secPerRep = (L, reps) => (reps > 0 ? L.num(60 / reps, 1) : '—');

/** Раскладка коротко: «7, 7, 8 × 7, 10» — три и больше одинаковых минуты подряд сжимаются. */
export function planText(reps) {
  const parts = [];
  for (let i = 0; i < reps.length;) {
    let j = i;
    while (j < reps.length && reps[j] === reps[i]) j += 1;
    const len = j - i;
    if (len >= 3) parts.push(`${reps[i]} × ${len}`);
    else for (let k = 0; k < len; k += 1) parts.push(String(reps[i]));
    i = j;
  }
  return parts.join(', ');
}

// ------------------------------------------------------------- метроном

/** Обратный отсчёт перед стартом, секунд: выбор в метрономе. */
export const COUNTDOWNS = [5, 10];
export const DEFAULT_COUNTDOWN = 10;
/** Секунд между предварительными тиками и сигналом подъёма: меньше самого короткого
 *  промежутка между подъёмами (60 / RATE_MAX = 2 с), чтобы сигналы не налезали. */
export const PRE_GAP = 0.4;

/**
 * Сигналы метронома: t — секунда от старта (отсчёт — до нуля, с минусом), kind —
 * count (тик отсчёта), go (старт), pre (предварительный тик), rep (подъём), minute — с 0.
 * Отсчёт — тик каждую секунду, на нуле долгий сигнал старта. Подъёмы минуты делят её
 * поровну, сигнал подъёма — в конце своего промежутка: последний в минуте — ровно на
 * её конце. Перед каждым подъёмом — два коротких тика через PRE_GAP.
 */
export function clicks(reps, countdown = 0) {
  const out = [];
  for (let s = countdown; s >= 1; s -= 1) out.push({ t: -s, kind: 'count' });
  out.push({ t: 0, kind: 'go' });
  reps.forEach((r, minute) => {
    for (let k = 1; k <= r; k += 1) {
      const t = 60 * minute + (60 * k) / r;
      out.push({ t: t - 2 * PRE_GAP, kind: 'pre', minute }, { t: t - PRE_GAP, kind: 'pre', minute }, { t, kind: 'rep', minute });
    }
  });
  return out;
}

/** Время на часах метронома: 135 → «2:15», отсчёт до старта — с минусом: −4,2 → «−0:05». */
export const clock = (sec) => (sec < 0
  ? `−${clock(Math.ceil(-sec))}`
  : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`);

// ------------------------------------------------------------- состояние и адрес

export function defaultState() {
  return {
    ex: DEFAULT_EX,
    min: DEFAULT_MIN,
    mode: 'goal',
    goal: defaultGoal(DEFAULT_MIN),
    strategy: DEFAULT_STRATEGY,
    d: DEFAULT_D,
    seg: [],
    plan: [],
    hand: defaultHand(DEFAULT_MIN),
  };
}

const intParam = (params, name) => {
  const raw = params.get(name);
  if (raw === null || !/^\d{1,4}$/.test(raw.trim())) return null;
  return Number(raw.trim());
};

/** «3x7,6x8,1x10» → отрезки; последний добирает минуты; неверное — null. */
function parseSegments(raw, n) {
  if (!raw) return null;
  const seg = [];
  for (const part of raw.split(',')) {
    const m = /^(\d{1,2})x(\d{1,2}(?:\.\d{1,2})?)$/.exec(part.trim());
    if (!m) return null;
    seg.push({ n: Number(m[1]), r: parseRate(m[2]) });
  }
  seg[seg.length - 1].n = n - segMinutes(seg.slice(0, -1));
  return validSegments(seg, n) ? seg : null;
}

/** «7,7,8,…» → подъёмы по минутам; неверное или не та длина — null. */
function parsePlan(raw, n) {
  if (!raw) return null;
  const plan = raw.split(',').map((x) => (/^\d{1,2}$/.test(x.trim()) ? Number(x) : NaN));
  return validPlan(plan, n) ? plan : null;
}

/**
 * Состояние из адреса страницы. Каждая группа параметров проверяется отдельно;
 * неверная группа заменяется значениями по умолчанию, остальные сохраняются.
 */
export function parseState(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');
  const state = defaultState();

  const ex = params.get('ex');
  if (EXERCISES.some((e) => e.id === ex)) state.ex = ex;
  const n = intParam(params, 'min');
  if (MINUTES.includes(n)) state.min = n;
  state.goal = defaultGoal(state.min);
  state.hand = defaultHand(state.min);

  const goal = intParam(params, 'goal') ?? state.goal;
  const s = params.get('s');
  const strategy = STRATEGIES.some((x) => x.id === s) ? s : state.strategy;
  const d = intParam(params, 'd') ?? state.d;
  if (!goalError(goal, state.min, strategy, d)) Object.assign(state, { goal, strategy, d });

  const hand = intParam(params, 'hand');
  if (hand !== null && hand >= 1 && hand <= state.min - 1) state.hand = hand;

  const plan = parsePlan(params.get('p'), state.min);
  if (plan) {
    state.mode = 'plan';
    state.plan = plan;
  } else if (params.get('mode') === 'pace') {
    state.seg = parseSegments(params.get('seg'), state.min) ?? toSegments(repsOf(state));
    state.mode = 'pace';
  }
  return state;
}

/** Адрес из состояния: только то, что отличается от умолчания и нужно режиму. */
export function serializeState(state) {
  const params = new URLSearchParams();
  if (state.ex !== DEFAULT_EX) params.set('ex', state.ex);
  if (state.min !== DEFAULT_MIN) params.set('min', String(state.min));
  if (state.mode === 'goal') {
    if (state.goal !== defaultGoal(state.min)) params.set('goal', String(state.goal));
    if (state.strategy !== DEFAULT_STRATEGY) params.set('s', state.strategy);
    if (state.strategy !== 'even' && state.d !== DEFAULT_D) params.set('d', String(state.d));
  } else if (state.mode === 'pace') {
    params.set('mode', 'pace');
    params.set('seg', state.seg.map((s) => `${s.n}x${rateParam(s.r)}`).join(','));
  } else {
    params.set('p', state.plan.join(','));
  }
  if (state.ex === 'snatch' && state.hand !== defaultHand(state.min)) params.set('hand', String(state.hand));
  const query = params.toString().replace(/%2C/g, ',');
  return query ? `?${query}` : '';
}
