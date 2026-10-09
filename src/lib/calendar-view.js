// Разметка календаря: общая для сборки (значения на дату сборки) и браузера (на сегодня).
// Текст — только из словаря L; даты, страны и числа — через Intl.
import {safeURL,filterEvents} from './calendar.js';
import {split,nextEvent,isLive,daysUntil,seriesOf,seriesEvents,todayISO} from './calendar-series.js';
import {langPath} from './locale.js';
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const countryName = (L,country) => country ? new Intl.DisplayNames([L.lang],{type:'region'}).of(country) : L.t('calendar.unknown');
const utc = date => new Date(`${date}T00:00:00Z`);
const fmt = (L,options) => new Intl.DateTimeFormat(L.lang,{...options,timeZone:'UTC'});
export function dateLabel(L,date) { return fmt(L,{dateStyle:'medium'}).format(utc(date)); }
export const rangeLabel = (L,e) => dateLabel(L,e.startDate)+(e.startDate!==e.endDate?` – ${dateLabel(L,e.endDate)}`:'');
const link = (url,text,cls='') => safeURL(url) ? `<a${cls?` class="${cls}"`:''} href="${esc(url)}" rel="noopener noreferrer">${esc(text)}</a>` : '';
const disciplineLabel = (L,d) => { try { return L.t(`calendar.discipline.${d}`); } catch { return d; } };
const span = (a,b) => a===b ? a : `${a}–${b}`;
export const seriesHref = (L,s) => langPath(L.lang,`calendar/${s.slug}/`);
export const calendarHref = (L,query='') => langPath(L.lang,'calendar/')+query;

/** Листок календаря: месяц, число или диапазон, день недели. */
export function leaf(L,e,cls='') {
  const [s,f]=[utc(e.startDate),utc(e.endDate)];
  const part=o=>[fmt(L,o).format(s),fmt(L,o).format(f)];
  const [m1,m2]=part({month:'short'}),[d1,d2]=part({day:'numeric'}),[w1,w2]=part({weekday:'short'});
  return `<time class="cal-leaf${cls?` ${cls}`:''}" datetime="${e.startDate}"><span class="sr">${esc(rangeLabel(L,e))}</span>
    <span class="cal-mon" aria-hidden="true">${esc(span(m1,m2))}</span><span class="cal-day" aria-hidden="true">${esc(span(d1,d2))}</span><span class="cal-wd" aria-hidden="true">${esc(span(w1,w2))}</span></time>`;
}
export function placeLabel(L,e) {
  if (!e.country && e.format==='online') return L.t('calendar.format.online');
  return [e.city||L.t('calendar.cityUnknown'),countryName(L,e.country)].join(', ');
}
/** «Идёт сейчас» или «через N дней»; для прошедших — пусто. */
export function relative(L,e,today) {
  if (isLive(e,today)) return L.t('calendar.live');
  const n=daysUntil(e.startDate,today);
  return n>0 ? L.t('calendar.in',{n:L.num(n,0),days:L.plural(n,'calendar.days')}) : '';
}
const tags = (L,e) => [...e.federations.map(f=>`<span class="cal-tag">${esc(f)}</span>`),
  `<span class="cal-tag cal-${e.format}">${esc(L.t(`calendar.format.${e.format}`))}</span>`,
  e.status!=='confirmed'?`<span class="cal-tag cal-status-${e.status}">${esc(L.t(`calendar.status.${e.status}`))}</span>`:''].join('');
function sourceLinks(L,e) {
  const orgs=[...new Set(e.sources.map(s=>s.organization))];
  return orgs.map(o=>{ const urls=e.sources.filter(s=>s.organization===o&&safeURL(s.url)).map(s=>s.url);
    return urls.length===1 ? link(urls[0],o) : `${esc(o)} (${urls.map((u,i)=>link(u,L.num(i+1,0))).join(', ')})`; }).join(' · ');
}
const seriesLink = (L,e,series) => { const s=seriesOf(series,e); return s ? `<a class="cal-series-link" href="${seriesHref(L,s)}">${esc(L.t('calendar.series.part',{name:s.name}))}</a>` : ''; };
const actions = (L,e,today) => `<div class="cal-actions">${e.registrationUrl&&!(e.registrationDeadline&&e.registrationDeadline<today)?link(e.registrationUrl,L.t('calendar.register'),'btn btn-primary'):''}<a class="btn" href="/calendar/ics/${esc(e.id)}.ics" download>${esc(L.t('calendar.ics'))}</a></div>`;

/** Ближайший старт — крупная карточка в шапке календаря. */
export function featureCard(L,events,today,series=[]) {
  const e=nextEvent(events,today);
  if (!e) return '';
  const when=relative(L,e,today);
  return `<article class="cal-feature${isLive(e,today)?' is-live':''}"><p class="cal-kicker">${esc(L.t('calendar.next'))}${when?` · <strong>${esc(when)}</strong>`:''}</p>
    <div class="cal-feature-main">${leaf(L,e,'cal-leaf-lg')}<div><h2>${esc(e.title)}</h2><p class="cal-place">${esc(placeLabel(L,e))}</p><p class="cal-tags">${tags(L,e)}</p></div></div>
    ${actions(L,e,today)}</article>`;
}
/** Карточки серий: число выпусков, следующий или последний. */
export function seriesCards(L,series,events,today) {
  return series.map(s=>{
    const own=split(seriesEvents(s,events),today);
    const next=own.upcoming[0], last=own.past[0];
    const n=own.upcoming.length+own.past.length;
    const when=next ? L.t('calendar.series.nextOn',{date:dateLabel(L,next.startDate)}) : L.t('calendar.series.lastOn',{date:dateLabel(L,last.startDate)});
    return `<a class="cal-series-card" href="${seriesHref(L,s)}"><span class="cal-series-fed">${esc(s.federation)}</span><strong>${esc(s.name)}</strong>
      <span class="cal-series-meta">${esc(`${L.num(n,0)} ${L.plural(n,'calendar.editions')}`)} · ${esc(when)}</span></a>`;
  }).join('');
}
export function eventCard(L,e,today,series=[]) {
  const time=o=>new Intl.DateTimeFormat(L.lang,{timeStyle:'short',timeZone:e.timeZone}).format(new Date(o));
  const times=e.startAt ? `${time(e.startAt)}–${time(e.endAt)} (${e.timeZone})` : '';
  const fact=(key,value)=>`<div><dt>${esc(L.t(key))}</dt><dd>${value}</dd></div>`;
  const facts=[fact('calendar.organizer',e.organizerUrl?link(e.organizerUrl,e.organizer):esc(e.organizer)),
    e.disciplines.length?fact('calendar.disciplines',esc(e.disciplines.map(d=>disciplineLabel(L,d)).join(' · '))):'',
    e.registrationDeadline?fact('calendar.deadline',`<strong>${esc(dateLabel(L,e.registrationDeadline))}</strong>`):''].join('');
  const when=relative(L,e,today);
  return `<article class="cal-event cal-is-${e.status}${isLive(e,today)?' is-live':''}" id="${esc(e.id)}">${leaf(L,e)}
    <div class="cal-body">${when?`<p class="cal-when">${esc(when)}</p>`:''}<h4>${esc(e.title)}</h4>
    <p class="cal-place">${esc(placeLabel(L,e))}${times?` · ${esc(times)}`:''}</p>
    <p class="cal-tags">${tags(L,e)}</p><dl class="cal-facts">${facts}</dl>
    <p class="cal-source">${seriesLink(L,e,series)}<span>${esc(L.t('calendar.sources'))}: ${sourceLinks(L,e)}</span></p></div>
    ${actions(L,e,today)}</article>`;
}
/** Прошедший турнир — строка: дата, название, место, федерация, источник. */
export function pastRow(L,e,series=[]) {
  return `<li class="cal-past${e.status==='cancelled'?' cal-is-cancelled':''}" id="${esc(e.id)}"><time class="cal-past-date" datetime="${e.startDate}">${esc(fmt(L,{day:'numeric',month:'short'}).formatRange(utc(e.startDate),utc(e.endDate)))}</time>
    <div class="cal-past-main"><strong>${esc(e.title)}</strong><span class="cal-place">${esc(placeLabel(L,e))}</span>${seriesLink(L,e,series)}</div>
    <span class="cal-past-src">${esc(L.t('calendar.sources'))}: ${sourceLinks(L,e)}</span></li>`;
}
export function renderEvents(L,events,{today=todayISO(),when='',series=[]}={}) {
  const list=split(events,today)[when==='past'?'past':'upcoming'];
  if (!list.length) return `<p class="calendar-empty">${esc(L.t('calendar.empty'))}</p>`;
  let group='';
  if (when==='past') {
    let html='';
    for (const e of list) {
      const year=e.startDate.slice(0,4);
      if (year!==group) { html+=`${group?'</ol>':''}<h3 class="calendar-month">${esc(fmt(L,{year:'numeric'}).format(utc(e.startDate)))}</h3><ol class="cal-past-list">`; group=year; }
      html+=pastRow(L,e,series);
    }
    return html+'</ol>';
  }
  return list.map(e=>{
    const next=e.startDate.slice(0,7);
    const heading=group!==next?`<h3 class="calendar-month">${esc(fmt(L,{month:'long',year:'numeric'}).format(utc(e.startDate)))}</h3>`:'';
    group=next;return heading+eventCard(L,e,today,series);
  }).join('');
}
/** Список по фильтрам и вкладке: вкладка «прошедшие» — ?when=past. */
export function renderBrowse(L,events,filters,{today,series=[]}) {
  const {when='',...rest}=filters;
  const matched=filterEvents(events,rest);
  const parts=split(matched,today);
  return {html:renderEvents(L,matched,{today,when,series}),upcoming:parts.upcoming.length,past:parts.past.length,shown:(when==='past'?parts.past:parts.upcoming).length};
}
/** Тело посадочной страницы серии. */
export function seriesBody(L,s,events,today,series) {
  const own=split(seriesEvents(s,events),today);
  const all=[...own.upcoming,...own.past].sort((a,b)=>b.startDate.localeCompare(a.startDate));
  const edition=e=>`<li class="cal-edition${isLive(e,today)?' is-live':''}" id="${esc(e.id)}"><span class="cal-edition-year">${esc(e.startDate.slice(0,4))}</span>
    <div class="cal-edition-main"><strong>${esc(e.title)}</strong><span>${esc(rangeLabel(L,e))}</span><span class="cal-place">${esc(placeLabel(L,e))}</span>
    <span class="cal-source"><span>${esc(L.t('calendar.sources'))}: ${sourceLinks(L,e)}</span></span></div>
    ${e.endDate>=today?`<span class="cal-edition-when">${esc(relative(L,e,today))}</span>`:''}</li>`;
  return `<section class="cal cal-series-page"><nav class="crumbs"><a href="${calendarHref(L)}">${esc(L.t('calendar.nav'))}</a> › <span>${esc(s.name)}</span></nav>
    <header class="cal-hero"><div><p class="cal-kicker">${esc(s.federation)}</p><h1>${esc(s.name)}</h1><p class="lead">${esc(L.t('calendar.series.lead',{name:s.name,federation:s.federation}))}</p></div>
    <div id="cal-next">${featureCard(L,own.upcoming,today,series)}</div></header>
    <h2>${esc(L.t('calendar.series.editions'))}</h2><ol class="cal-editions">${all.map(edition).join('')}</ol>
    <p class="cal-more"><a href="${calendarHref(L,`?federation=${s.federation}`)}#list">${esc(L.t('calendar.series.federation',{federation:s.federation}))}</a> · <a href="${calendarHref(L)}">${esc(L.t('calendar.series.back'))}</a></p>
    <p class="calendar-note">${esc(L.t('calendar.note'))}</p></section>`;
}
