// Словари всех языков для сборки и тестов. Браузер сюда не ходит: страница
// загружает только словарь своего языка (/i18n/<lang>.js).
import { LANGS, makeLocale } from '../lib/locale.js';
import ru from './ru.js';
import en from './en.js';
import de from './de.js';

export { LANGS };
// ru is retained only for legacy test formatting and may omit public page keys.
// Only dictionaries in LANGS must have matching keys and are published.
export const DICTS = { ru, en, de };

/** Язык страницы для сборки: makeLocale со словарём этого языка. */
export const locale = (lang) => makeLocale(lang, DICTS[lang]);
