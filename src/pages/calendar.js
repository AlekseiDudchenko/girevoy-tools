import {readFileSync} from 'node:fs';
import {esc} from '../html.js';
import {FEDERATIONS, FORMATS, validateEvents} from '../lib/calendar.js';
import {countryName,renderEvents} from '../lib/calendar-view.js';
const events=validateEvents(JSON.parse(readFileSync(new URL('../../data/calendar/events.json',import.meta.url),'utf8')));
const option=(value,text)=>`<option value="${esc(value)}">${esc(text)}</option>`;
export default {
  slug:'calendar/',key:'calendar',scripts:['/calendar.js'],
  body(L) {
    const select=(key,options)=>`<label>${esc(L.t(`calendar.${key}`))}<select name="${key}">${option('',L.t('calendar.all'))}${options}</select></label>`;
    const countries=[...new Set(events.map(e=>e.country).filter(Boolean))].sort((a,b)=>countryName(L,a).localeCompare(countryName(L,b),L.lang));
    return `<section class="calendar"><h1>${esc(L.t('calendar.title'))}</h1><p class="lead">${esc(L.t('calendar.lead'))}</p>
      <div class="calendar-top"><a href="https://github.com/AlekseiDudchenko/girevoy-tools/issues/new?template=calendar.yml">${esc(L.t('calendar.submit'))}</a><span>${esc(L.t('calendar.moderation'))}</span></div>
      <form id="calendar-filters" class="calendar-filters" method="get">
      <label>${esc(L.t('calendar.from'))}<input type="date" name="from"></label><label>${esc(L.t('calendar.to'))}<input type="date" name="to"></label>
      ${select('country',countries.map(c=>option(c,countryName(L,c))).join(''))}
      ${select('region',['europe','north-america'].map(r=>option(r,L.t(`calendar.region.${r}`))).join(''))}
      ${select('federation',FEDERATIONS.map(f=>option(f,f)).join(''))}
      ${select('format',FORMATS.map(f=>option(f,L.t(`calendar.format.${f}`))).join(''))}
      <div class="calendar-filter-actions"><button type="submit">${esc(L.t('calendar.apply'))}</button><button type="reset">${esc(L.t('calendar.reset'))}</button></div>
      </form><noscript><p>${esc(L.t('calendar.noscript'))}</p></noscript>
      <p id="calendar-count" role="status" aria-live="polite">${esc(L.t('calendar.count',{n:L.num(events.length,0)}))}</p>
      <div id="calendar-events">${renderEvents(L,events)}</div><p class="calendar-note">${esc(L.t('calendar.note'))}</p>
      <script type="application/json" id="calendar-data">${JSON.stringify(events).replaceAll('<','\\u003c')}</script></section>`;
  },
};
