// Общее для страниц инструментов в браузере: язык страницы и переключатель языка.
// Язык берётся из <html lang> — его задаёт адрес /<язык>/…, а не настройки браузера.
import { makeLocale } from './lib/locale.js';

/** Язык страницы: словарь только этого языка, числа и склонения через Intl. */
export async function pageLocale() {
  const lang = document.documentElement.lang;
  const { default: dict } = await import(`./i18n/${lang}.js`);
  return makeLocale(lang, dict);
}

/**
 * Ссылки переключателя языка — на ту же страницу с тем же состоянием: после
 * каждого изменения адреса к ним дописывается текущий ?….
 */
export function syncLangLinks() {
  for (const a of document.querySelectorAll('a[data-lang]')) a.search = location.search;
}

/** Заменить адрес страницы на состояние и обновить переключатель языка. */
export function replaceSearch(search) {
  history.replaceState(null, '', location.pathname + search + location.hash);
  syncLangLinks();
}
