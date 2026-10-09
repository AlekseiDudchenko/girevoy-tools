// Посадочные страницы серий: /<язык>/calendar/<серия>/ — по одной на запись data/calendar/series.json.
import {seriesBody} from '../lib/calendar-view.js';
import {SITE_URL as site} from '../brand.js';
import {EVENTS as events, SERIES as series, BUILD_DAY as today} from '../calendar-data.js';
export default series.map((s) => ({
  slug: `calendar/${s.slug}/`, key: 'calendar', scripts: ['/calendar-series.js'],
  title: (L) => L.t('calendar.series.pageTitle', {name: s.name}),
  description: (L) => L.t('calendar.series.description', {name: s.name, federation: s.federation}),
  body: (L) => `${seriesBody(L, s, events, today, series, site)}<script type="application/json" id="calendar-data">${JSON.stringify({events, series, slug: s.slug, site}).replaceAll('<','\\u003c')}</script>`,
}));
