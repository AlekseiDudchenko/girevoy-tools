// Форматирование чисел и слов, общее для всех инструментов.

/** Число из поля ввода: «81,13» и «81.13» — одно и то же; пустое — NaN. */
export const parseNumber = (raw) => (/^\s*\d+([.,]\d+)?\s*$/.test(raw) ? Number(raw.trim().replace(',', '.')) : NaN);

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
