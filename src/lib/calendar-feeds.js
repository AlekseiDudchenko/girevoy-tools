// Ленты подписки календаря: постоянные адреса /calendar/feeds/<path>.ics, которые
// календарные приложения перечитывают сами. Набор лент выводится из справочников и
// данных: новый турнир, федерация, серия или страна попадают в ленты при сборке, руками
// ленты не ведутся. В ленте — только предстоящие и идущие события на дату сборки.
// Имена лент — свойства файла .ics, а не текст страницы: одни на всех языках, по-английски.
import {FEDERATIONS, REGIONS, REGION_COUNTRIES, filterEvents, calendarICS, icsText} from './calendar.js';
import {isPast, seriesEvents} from './calendar-series.js';

export const FEED_ROOT = '/calendar/feeds/';
const REGION_NAMES = {europe: 'Europe', 'north-america': 'North America', 'south-america': 'South America', asia: 'Asia', oceania: 'Oceania'};
const BRAND = 'VseGiri';
const isOnline = (e) => e.format === 'online' || e.format === 'hybrid';
const countryEn = (c) => new Intl.DisplayNames(['en'], {type: 'region'}).of(c);

/** Страны с лентой: все страны регионов и любая страна из событий — адрес не пропадает, когда турниров в стране не осталось. */
export const feedCountries = (events) => [...new Set([...Object.values(REGION_COUNTRIES).flat(), ...events.map((e) => e.country).filter(Boolean)])].sort();

/** Все ленты: kind, path (без .ics), name и select(events) — какие события в ней. */
export function feeds(events, series = []) {
  const list = [{kind: 'all', path: 'all', name: 'Kettlebell Sport Competitions', select: (ev) => ev}];
  for (const f of FEDERATIONS) {
    list.push({kind: 'federation', path: `federation/${f.toLowerCase()}`, name: `${f} Competitions`, federation: f, select: (ev) => filterEvents(ev, {federation: f})});
    for (const r of REGIONS) list.push({kind: 'federation-region', path: `federation/${f.toLowerCase()}/${r}`, name: `${f} Competitions in ${REGION_NAMES[r]}`, federation: f, region: r, select: (ev) => filterEvents(ev, {federation: f, region: r})});
  }
  for (const r of REGIONS) list.push({kind: 'region', path: `region/${r}`, name: `Kettlebell Competitions in ${REGION_NAMES[r]}`, region: r, select: (ev) => filterEvents(ev, {region: r})});
  for (const c of feedCountries(events)) list.push({kind: 'country', path: `country/${c.toLowerCase()}`, name: `Kettlebell Competitions in ${countryEn(c)}`, country: c, select: (ev) => filterEvents(ev, {country: c})});
  list.push({kind: 'online', path: 'online', name: 'Online Kettlebell Competitions', select: (ev) => ev.filter(isOnline)});
  for (const s of series) list.push({kind: 'series', path: `series/${s.slug}`, name: s.name, series: s.slug, select: (ev) => seriesEvents(s, ev)});
  return list;
}

export const feedURL = (path) => `${FEED_ROOT}${path}.ics`;

/** Файл ленты: предстоящие и идущие события на дату today, по дате начала. */
export function feedICS(feed, events, today, site) {
  const own = feed.select(events).filter((e) => !isPast(e, today)).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
  const desc = `Upcoming kettlebell sport competitions from ${site}/en/calendar/. Dates are attributed to official federation sources; check the organizer before booking.`;
  return calendarICS(own, ['METHOD:PUBLISH', `X-WR-CALNAME:${icsText(`${BRAND} — ${feed.name}`)}`, `X-WR-CALDESC:${icsText(desc)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H']);
}

/**
 * Лента, совпадающая с фильтрами страницы, или null. Даты и вкладка не учитываются:
 * лента всегда «от сегодня». Подходят: ничего, одна федерация, один регион, федерация
 * и регион, одна страна, формат «онлайн».
 */
export function feedFor(filters, events) {
  const {country, region, federation, format} = filters;
  const set = Object.entries({country, region, federation, format}).filter(([, v]) => v).map(([k]) => k).sort().join('+');
  const fed = FEDERATIONS.includes(federation), reg = REGIONS.includes(region);
  if (set === '') return 'all';
  if (set === 'federation' && fed) return `federation/${federation.toLowerCase()}`;
  if (set === 'region' && reg) return `region/${region}`;
  if (set === 'federation+region' && fed && reg) return `federation/${federation.toLowerCase()}/${region}`;
  if (set === 'country' && feedCountries(events).includes(country)) return `country/${country.toLowerCase()}`;
  if (set === 'format' && format === 'online') return 'online';
  return null;
}

/** Ссылки подписки: webcal:// для Apple Calendar и Outlook, Google Calendar по cid, https для копирования. */
export function subscribeLinks(site, path) {
  const https = `${site}${feedURL(path)}`;
  const webcal = https.replace(/^https?:/, 'webcal:');
  return {https, webcal, google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`};
}
