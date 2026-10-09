// Экранирование текста для HTML. Всё, что вставляется в шаблоны, проходит через esc().
export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
