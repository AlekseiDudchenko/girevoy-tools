import {esc} from '../html.js';
import {FEDERATIONS, FORMATS, REGIONS} from '../lib/calendar.js';
import {split} from '../lib/calendar-series.js';
import {countryName,featureCard,seriesCards,renderBrowse} from '../lib/calendar-view.js';
import {EVENTS as events, SERIES as series, BUILD_DAY as today} from '../calendar-data.js';
const option=(value,text)=>`<option value="${esc(value)}">${esc(text)}</option>`;
export default {
  slug:'calendar/',key:'calendar',scripts:['/calendar.js'],
  body(L) {
    const select=(key,options)=>`<label>${esc(L.t(`calendar.${key}`))}<select name="${key}">${option('',L.t('calendar.all'))}${options}</select></label>`;
    const countries=[...new Set(events.map(e=>e.country).filter(Boolean))].sort((a,b)=>countryName(L,a).localeCompare(countryName(L,b),L.lang));
    const browse=renderBrowse(L,events,{},{today,series});
    const {upcoming}=split(events,today);
    const stat=(id,n,label)=>`<div class="cal-stat"><span class="cal-tile-n" id="${id}">${L.num(n,0)}</span><span class="cal-tile-label">${esc(L.t(label))}</span></div>`;
    const tab=(value,label,n)=>`<label class="cal-tab"><input type="radio" name="when" value="${value}"${value?'':' checked'}><span>${esc(L.t(label))} <span class="cal-tab-n" data-when="${value||'upcoming'}">${L.num(n,0)}</span></span></label>`;
    return `<section class="cal">
      <header class="cal-hero"><div><h1>${esc(L.t('calendar.title'))}</h1><p class="lead">${esc(L.t('calendar.lead'))}</p>
      <div class="cal-stats">${stat('stat-upcoming',upcoming.length,'calendar.upcoming')}${stat('stat-countries',new Set(upcoming.map(e=>e.country).filter(Boolean)).size,'calendar.countries')}${stat('stat-series',series.length,'calendar.series.title')}</div></div>
      <div id="cal-next">${featureCard(L,events,today,series)}</div></header>
      <section class="cal-section"><h2>${esc(L.t('calendar.series.title'))}</h2><p class="cal-section-lead">${esc(L.t('calendar.series.intro'))}</p><div class="cal-series-grid">${seriesCards(L,series,events,today)}</div></section>
      <section class="cal-section" id="list"><h2 class="sr">${esc(L.t('calendar.list'))}</h2>
      <form id="calendar-filters" class="calendar-filters" method="get">
      <div class="cal-tabs" role="radiogroup" aria-label="${esc(L.t('calendar.when'))}">${tab('','calendar.upcoming',browse.upcoming)}${tab('past','calendar.past',browse.past)}</div>
      <div class="cal-fields">
      ${select('region',REGIONS.map(r=>option(r,L.t(`calendar.region.${r}`))).join(''))}
      ${select('country',countries.map(c=>option(c,countryName(L,c))).join(''))}
      ${select('federation',FEDERATIONS.map(f=>option(f,f)).join(''))}
      ${select('format',FORMATS.map(f=>option(f,L.t(`calendar.format.${f}`))).join(''))}
      <label>${esc(L.t('calendar.from'))}<input type="date" name="from"></label><label>${esc(L.t('calendar.to'))}<input type="date" name="to"></label>
      </div>
      <div class="calendar-filter-actions"><p id="calendar-count" role="status" aria-live="polite">${esc(L.t('calendar.count',{n:L.num(browse.shown,0)}))}</p><button class="btn" type="reset">${esc(L.t('calendar.reset'))}</button></div>
      </form><noscript><p>${esc(L.t('calendar.noscript'))}</p></noscript>
      <div id="calendar-events">${browse.html}</div></section><p class="calendar-note">${esc(L.t('calendar.note'))}</p>
      <script type="application/json" id="calendar-data">${JSON.stringify({events,series}).replaceAll('<','\\u003c')}</script></section>`;
  },
};
