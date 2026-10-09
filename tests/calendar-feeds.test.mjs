import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {FEDERATIONS, REGIONS, REGION_COUNTRIES, validateEvents, filterEvents} from '../src/lib/calendar.js';
import {validateSeries, isPast, seriesEvents} from '../src/lib/calendar-series.js';
import {feeds, feedICS, feedFor, feedCountries, subscribeLinks} from '../src/lib/calendar-feeds.js';
import {filterSubscribe} from '../src/lib/calendar-view.js';
import {locale} from '../src/i18n/index.js';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const events = validateEvents(read('data/calendar/events.json'));
const series = validateSeries(read('data/calendar/series.json'), events);
const SITE = 'https://tools.vsegiri.com';
const TODAY = '2026-10-09';
const YESTERDAY = '2026-10-08';
const uids = (ics) => [...ics.matchAll(/^UID:(.+)@tools\.vsegiri\.com\r$/gm)].map((m) => m[1]);
const unfold = (ics) => ics.replace(/\r\n /g, '');

test('every federation, region, federation × region, series, country and online has a feed', () => {
  const paths = new Set(feeds(events, series).map((f) => f.path));
  assert.ok(paths.has('all') && paths.has('online'));
  for (const f of FEDERATIONS) {
    assert.ok(paths.has(`federation/${f.toLowerCase()}`), f);
    for (const r of REGIONS) assert.ok(paths.has(`federation/${f.toLowerCase()}/${r}`), `${f} ${r}`);
  }
  for (const r of REGIONS) assert.ok(paths.has(`region/${r}`), r);
  for (const s of series) assert.ok(paths.has(`series/${s.slug}`), s.slug);
  for (const c of Object.values(REGION_COUNTRIES).flat()) assert.ok(paths.has(`country/${c.toLowerCase()}`), c);
  assert.equal(paths.size, feeds(events, series).length, 'paths are unique');
});

test('country feeds do not depend on events: a country keeps its address after its last event is gone', () => {
  assert.deepEqual(feedCountries([]), feedCountries(events));
  for (const e of events) if (e.country) assert.ok(Object.values(REGION_COUNTRIES).flat().includes(e.country), `${e.id}: add ${e.country} to REGION_COUNTRIES`);
});

test('each feed holds exactly the upcoming events its filter selects, past ones are left out', () => {
  const upcoming = events.filter((e) => !isPast(e, YESTERDAY));
  const expected = {
    all: upcoming,
    'federation/iukl': filterEvents(upcoming, {federation: 'IUKL'}),
    'federation/iukl/europe': filterEvents(upcoming, {federation: 'IUKL', region: 'europe'}),
    'region/europe': filterEvents(upcoming, {region: 'europe'}),
    'country/de': filterEvents(upcoming, {country: 'DE'}),
    online: upcoming.filter((e) => e.format !== 'in-person'),
    [`series/${series[0].slug}`]: seriesEvents(series[0], upcoming),
  };
  const byPath = Object.fromEntries(feeds(events, series).map((f) => [f.path, f]));
  for (const [path, list] of Object.entries(expected)) {
    assert.deepEqual(uids(feedICS(byPath[path], events, TODAY, SITE)).sort(), list.map((e) => e.id).sort(), path);
  }
  assert.ok(events.some((e) => isPast(e, TODAY)), 'data has past events to leave out');
});

test('an event stays one day after it ends: the build date is UTC, in the Americas its last day is still on', () => {
  const all = feeds(events, series)[0];
  const e = {...events.find((x) => x.country === 'US'), startDate: '2026-11-27', endDate: '2026-11-28'};
  assert.deepEqual(uids(feedICS(all, [e], '2026-11-29', SITE)), [e.id]);
  assert.deepEqual(uids(feedICS(all, [e], '2026-11-30', SITE)), []);
});

test('every region has an English feed name', () => {
  for (const f of feeds(events, series)) assert.doesNotMatch(f.name, /undefined/, f.path);
});

test('a feed is a valid calendar even when empty: name, refresh, CRLF, folded lines', () => {
  const empty = feeds(events, series).find((f) => f.path === 'region/oceania');
  for (const ics of [feedICS(empty, events, '2099-01-01', SITE), feedICS(feeds(events, series)[0], events, TODAY, SITE)]) {
    assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
    assert.match(ics, /END:VCALENDAR\r\n$/);
    assert.doesNotMatch(ics, /[^\r]\n/);
    for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
    const properties = unfold(ics);
    const name = properties.match(/^NAME:(.+)\r$/m)?.[1];
    assert.ok(name?.startsWith('VseGiri — '));
    assert.equal(properties.match(/^X-WR-CALNAME:(.+)\r$/m)?.[1], name);
    assert.match(ics, /\r\nREFRESH-INTERVAL;VALUE=DURATION:PT12H\r\n/);
  }
  assert.doesNotMatch(feedICS(empty, events, '2099-01-01', SITE), /BEGIN:VEVENT/);
});

test('feed names are the common English ones', () => {
  const name = (p) => feeds(events, series).find((f) => f.path === p).name;
  assert.equal(name('all'), 'Kettlebell Sport Competitions');
  assert.equal(name('federation/iukl'), 'IUKL Competitions');
  assert.equal(name('federation/iukl/europe'), 'IUKL Competitions in Europe');
  assert.equal(name('country/de'), 'Kettlebell Competitions in Germany');
  assert.equal(name('online'), 'Online Kettlebell Competitions');
});

test('the page filters choose the matching feed; dates and the past tab do not matter', () => {
  assert.equal(feedFor({}, events), 'all');
  assert.equal(feedFor({when: 'past', from: '2026-01-01'}, events), 'all');
  assert.equal(feedFor({federation: 'IUKL'}, events), 'federation/iukl');
  assert.equal(feedFor({region: 'asia'}, events), 'region/asia');
  assert.equal(feedFor({federation: 'WKSF', region: 'europe'}, events), 'federation/wksf/europe');
  assert.equal(feedFor({country: 'DE'}, events), 'country/de');
  assert.equal(feedFor({format: 'online'}, events), 'online');
  assert.equal(feedFor({format: 'hybrid'}, events), 'online');
  for (const f of [{format: 'in-person'}, {country: 'DE', federation: 'IUKL'}, {format: 'online', region: 'europe'}, {federation: 'NOPE'}]) assert.equal(feedFor(f, events), null, JSON.stringify(f));
  const L = locale('en');
  assert.match(filterSubscribe(L, SITE, {federation: 'IUKL'}, events), /webcal:\/\/tools\.vsegiri\.com\/calendar\/feeds\/federation\/iukl\.ics/);
  assert.match(filterSubscribe(L, SITE, {format: 'in-person'}, events), /cal-subscribe-none/);
});

test('subscribe links: webcal for Apple and Outlook, Google by cid, https to copy', () => {
  assert.deepEqual(subscribeLinks(SITE, 'all'), {
    https: 'https://tools.vsegiri.com/calendar/feeds/all.ics',
    webcal: 'webcal://tools.vsegiri.com/calendar/feeds/all.ics',
    google: 'https://calendar.google.com/calendar/render?cid=https%3A%2F%2Ftools.vsegiri.com%2Fcalendar%2Ffeeds%2Fall.ics',
  });
});

test('the build writes every feed and serves them as text/calendar; the sitemap lists no feeds', () => {
  const out = mkdtempSync(join(tmpdir(), 'tools-feeds-'));
  execFileSync('node', ['scripts/build.mjs', out], {env: {...process.env, CALENDAR_TODAY: TODAY}});
  for (const f of feeds(events, series)) assert.ok(existsSync(join(out, 'calendar/feeds', `${f.path}.ics`)), f.path);
  assert.match(readFileSync(join(out, '_headers'), 'utf8'), /\/calendar\/feeds\/\*\n {2}Content-Type: text\/calendar; charset=utf-8/);
  assert.doesNotMatch(readFileSync(join(out, 'sitemap.xml'), 'utf8'), /\.ics/);
  const page = readFileSync(join(out, 'en/calendar/index.html'), 'utf8');
  assert.match(page, /href="webcal:\/\/tools\.vsegiri\.com\/calendar\/feeds\/federation\/iukl\.ics"/);
  assert.match(page, /Subscribe to calendar/);
  assert.match(page, /href="https:\/\/calendar\.google\.com\/calendar\/render\?cid=https%3A%2F%2Ftools\.vsegiri\.com%2Fcalendar%2Ffeeds%2Fall\.ics"/);
  const germany = unfold(readFileSync(join(out, 'calendar/feeds/country/de.ics'), 'utf8'));
  assert.match(germany, /\r\nNAME:VseGiri — Kettlebell Competitions in Germany\r\n/);
  assert.match(germany, /\r\nX-WR-CALNAME:VseGiri — Kettlebell Competitions in Germany\r\n/);
  assert.match(readFileSync(join(out, `de/calendar/${series[0].slug}/index.html`), 'utf8'), new RegExp(`feeds/series/${series[0].slug}\\.ics`));
});
