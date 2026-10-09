// Язык страницы: строки из словаря, числа и склонения через Intl. Общий для сборки,
// браузера (/lib/locale.js) и тестов. Словари лежат в src/i18n/ и сюда не
// импортируются: сборка и браузер передают словарь своего языка в makeLocale().
//
// Строка словаря — текст с подстановками {name}; склоняемое слово — объект по
// категориям Intl.PluralRules этого языка: { one, few, many, other } по-русски,
// { one, other } по-английски и по-немецки.

/** Языки сайта в порядке переключателя. Первый — язык старых адресов без префикса. */
export const LANGS = ['en', 'de'];
/** Язык для hreflang="x-default": версия для тех, чей язык не поддержан. */
export const X_DEFAULT = 'en';
/** Адрес страницы на языке lang: slug '' — главная, 'tempo/' — инструмент. */
export const langPath = (lang, slug = '') => `/${lang}/${slug}`;

/** Тот же адрес на другом языке: меняется только префикс, путь и ?… сохраняются. */
export function switchPath(pathname, lang) {
  const rest = pathname.replace(/^\/(?:en|de)(?=\/|$)/, '');
  return `/${lang}${rest.startsWith('/') ? rest : `/${rest}`}`;
}

/**
 * Язык страницы: t(key, args) — строка словаря с подстановками, num(x, digits) —
 * число с фиксированными знаками, dec(x) — до сотых без лишних нулей,
 * plural(n, key) — склонённое слово из словаря.
 */
export function makeLocale(lang, dict) {
  if (!LANGS.includes(lang)) throw new RangeError(`нет такого языка: ${lang}`);
  const rules = new Intl.PluralRules(lang);
  const formats = new Map();
  const format = (min, max) => {
    const id = `${min}-${max}`;
    if (!formats.has(id)) {
      formats.set(id, new Intl.NumberFormat(lang, { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false }));
    }
    return formats.get(id);
  };
  const entry = (key) => {
    if (!(key in dict)) throw new RangeError(`нет строки «${key}» в словаре ${lang}`);
    return dict[key];
  };
  return {
    lang,
    t(key, args) {
      const value = entry(key);
      if (typeof value !== 'string') throw new TypeError(`«${key}» в словаре ${lang} — не строка`);
      if (!args) return value;
      return value.replace(/\{(\w+)\}/g, (m, name) => (name in args ? String(args[name]) : m));
    },
    num: (value, digits = 0) => format(digits, digits).format(value),
    dec: (value) => format(0, 2).format(Math.round(value * 100) / 100),
    plural(n, key) {
      const forms = entry(key);
      if (typeof forms !== 'object') throw new TypeError(`«${key}» в словаре ${lang} — не склонение`);
      return forms[rules.select(n)] ?? forms.other;
    },
  };
}
