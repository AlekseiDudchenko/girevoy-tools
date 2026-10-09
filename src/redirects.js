// Файл _redirects для Cloudflare Pages: старые адреса без языка ведут на английскую
// версию. Ранее сайт был русскоязычным, поэтому старые ссылки нужно сохранить.
// /coefficients/?… и /tempo/?… открываются на английском. Cloudflare сохраняет ?…
// при переадресации сам, в правиле его указывать не нужно.
//
// Язык по navigator.language не выбирается: ссылка должна открываться у
// получателя так же, как у отправителя.
import { LANGS, langPath } from './lib/locale.js';
import { readyTools } from './tools.js';

const OLD_LANG = LANGS[0];

// Снимок опубликованных русских страниц перед удалением языка в #25 (11bfda4).
// Новые страницы сюда не добавляются. При переименовании английской страницы
// меняется только адрес назначения: старый русский адрес остаётся навсегда.
const RETIRED_RU_PAGES = Object.freeze({
  '/ru/': '/en/',
  '/ru/tempo/': '/en/tempo/',
  '/ru/coefficients/': '/en/coefficients/',
  '/ru/calendar/': '/en/calendar/',
  '/ru/calendar/iukl-world-championship/': '/en/calendar/iukl-world-championship/',
  '/ru/calendar/iukl-european-championship/': '/en/calendar/iukl-european-championship/',
  '/ru/calendar/iukl-asian-championship/': '/en/calendar/iukl-asian-championship/',
  '/ru/calendar/ikmf-world-championship/': '/en/calendar/ikmf-world-championship/',
  '/ru/calendar/wksf-european-open-championship/': '/en/calendar/wksf-european-open-championship/',
  '/ru/calendar/weihnachts-snatch-berlin/': '/en/calendar/weihnachts-snatch-berlin/',
});

export function redirects() {
  const lines = [
    '# Старые адреса без языка → английская версия; ?… Cloudflare Pages сохраняет сам.',
    // Корень — 302: страница выбора языка или другой язык по умолчанию возможны позже.
    `/ ${langPath(OLD_LANG)} 302`,
  ];
  for (const t of readyTools()) {
    const to = langPath(OLD_LANG, `${t.slug}/`);
    lines.push(`/${t.slug} ${to} 301`, `/${t.slug}/ ${to} 301`);
    if (t.slug !== 'calendar') lines.push(`/${t.slug}/* ${to}:splat 301`);
  }
  // Только известные бывшие страницы: неизвестные адреса остаются 404.
  lines.push('# Retired Russian pages → English; query strings are preserved.');
  for (const [from, to] of Object.entries(RETIRED_RU_PAGES)) {
    lines.push(`${from.slice(0, -1)} ${to} 301`, `${from} ${to} 301`);
  }
  return `${lines.join('\n')}\n`;
}
