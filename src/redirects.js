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
  return `${lines.join('\n')}\n`;
}
