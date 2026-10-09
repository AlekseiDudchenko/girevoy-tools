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

/** Кнопки [data-copy]: скопировать ссылку и на секунду показать «Скопировано». Делегирование — блок перерисовывается. */
export function copyLinks(L) {
  document.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-copy]');
    if (!button) return;
    try { await navigator.clipboard.writeText(button.dataset.copy); } catch { button.previousElementSibling?.select(); return; }
    button.dataset.label ??= button.textContent;
    button.textContent = L.t('calendar.feed.copied');
    setTimeout(() => { button.textContent = button.dataset.label; }, 1500);
  });
}
