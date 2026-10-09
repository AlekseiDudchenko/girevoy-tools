import { esc } from './html.js';

// Edition-specific facts verified against official HTML sources on 2026-10-09.
// Never infer later entry conditions from an earlier edition.
export const SERIES_INFO = {
  'weihnachts-snatch-berlin': { key: 'berlin', url: 'https://bvdks.de/event/weihnachts-snatch-berlin-2026/' },
  'iukl-world-championship': { key: 'world', url: 'https://giri-iukl.com/news/2026/youths-world-championship-2026' },
  'iukl-european-championship': { key: 'european', url: 'https://giri-iukl.com/news/2026/european-championships-2026-in-york' },
  'iukl-asian-championship': { key: 'asian', url: 'https://giri-iukl.com/news/2026/asian-championship-2026-aktau' },
};

export function seriesInfo(L, slug) {
  const info = SERIES_INFO[slug];
  if (!info) return '';
  const date = new Intl.DateTimeFormat(L.lang, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date('2026-10-09T00:00:00Z'));
  return `<section class="reading" aria-labelledby="series-info"><h2 id="series-info">${esc(L.t('calendar.info.title'))}</h2><p>${esc(L.t(`calendar.info.${info.key}`))}</p><p><a href="${esc(info.url)}" target="_blank" rel="noopener">${esc(L.t('calendar.info.source'))}</a> · ${esc(L.t('calendar.info.checked', { date }))}</p><p class="hint">${esc(L.t('calendar.info.scope'))}</p></section>`;
}
