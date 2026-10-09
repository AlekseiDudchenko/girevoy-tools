import {safeURL} from './calendar.js';
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const countryName = (L,country) => country ? new Intl.DisplayNames([L.lang],{type:'region'}).of(country) : L.t('calendar.unknown');
const utc = date => new Date(`${date}T00:00:00Z`);
const fmt = (L,options) => new Intl.DateTimeFormat(L.lang,{...options,timeZone:'UTC'});
export function dateLabel(L,date) { return fmt(L,{dateStyle:'medium'}).format(utc(date)); }
const link = (url,text,cls='') => safeURL(url) ? `<a${cls?` class="${cls}"`:''} href="${esc(url)}" rel="noopener noreferrer">${esc(text)}</a>` : '';
const disciplineLabel = (L,d) => { try { return L.t(`calendar.discipline.${d}`); } catch { return d; } };
const span = (a,b) => a===b ? a : `${a}–${b}`;
// Листок календаря: месяц, число (или диапазон), день недели — всё из Intl.
function leaf(L,e) {
  const [s,f]=[utc(e.startDate),utc(e.endDate)];
  const part=o=>[fmt(L,o).format(s),fmt(L,o).format(f)];
  const [m1,m2]=part({month:'short'}),[d1,d2]=part({day:'numeric'}),[w1,w2]=part({weekday:'short'});
  const full=dateLabel(L,e.startDate)+(e.startDate!==e.endDate?` – ${dateLabel(L,e.endDate)}`:'');
  return `<time class="cal-leaf" datetime="${e.startDate}" title="${esc(full)}"><span class="visually-hidden">${esc(full)}</span>
    <span class="cal-mon" aria-hidden="true">${esc(span(m1,m2))}</span><span class="cal-day n" aria-hidden="true">${esc(span(d1,d2))}</span><span class="cal-wd" aria-hidden="true">${esc(span(w1,w2))}</span></time>`;
}
export function eventCard(L,e) {
  const time=o=>new Intl.DateTimeFormat(L.lang,{timeStyle:'short',timeZone:e.timeZone}).format(new Date(o));
  const place=[e.city||L.t('calendar.cityUnknown'),countryName(L,e.country)].join(', ');
  const times=e.startAt ? `${time(e.startAt)}–${time(e.endAt)} (${e.timeZone})` : '';
  const tags=[...e.federations.map(f=>`<span class="cal-tag">${esc(f)}</span>`),`<span class="cal-tag cal-${e.format}">${esc(L.t(`calendar.format.${e.format}`))}</span>`,
    e.status!=='confirmed'?`<span class="cal-tag cal-status-${e.status}">${esc(L.t(`calendar.status.${e.status}`))}</span>`:''].join('');
  const fact=(key,value)=>`<div><dt>${esc(L.t(key))}</dt><dd>${value}</dd></div>`;
  const facts=[fact('calendar.organizer',e.organizerUrl?link(e.organizerUrl,e.organizer):esc(e.organizer)),
    e.disciplines.length?fact('calendar.disciplines',esc(e.disciplines.map(d=>disciplineLabel(L,d)).join(' · '))):'',
    e.registrationDeadline?fact('calendar.deadline',`<strong>${esc(dateLabel(L,e.registrationDeadline))}</strong>`):''].join('');
  const orgs=[...new Set(e.sources.map(s=>s.organization))];
  const sources=orgs.map(o=>{ const urls=e.sources.filter(s=>s.organization===o&&safeURL(s.url)).map(s=>s.url);
    return urls.length===1 ? link(urls[0],o) : `${esc(o)} (${urls.map((u,i)=>link(u,L.num(i+1,0))).join(', ')})`; }).join(' · ');
  return `<article class="cal-event cal-is-${e.status}" id="${esc(e.id)}">${leaf(L,e)}
    <div class="cal-body"><h3>${esc(e.title)}</h3>
    <p class="cal-place">${esc(place)}${times?` · ${esc(times)}`:''}</p>
    <p class="cal-tags">${tags}</p><dl class="cal-facts">${facts}</dl>
    <p class="cal-source">${esc(L.t('calendar.sources'))}: ${sources}</p></div>
    <div class="cal-actions">${e.registrationUrl?link(e.registrationUrl,L.t('calendar.register'),'btn btn-primary'):''}<a class="btn" href="/calendar/ics/${esc(e.id)}.ics" download>${esc(L.t('calendar.ics'))}</a></div>
    </article>`;
}
export function renderEvents(L,events) {
  if (!events.length) return `<p class="calendar-empty">${esc(L.t('calendar.empty'))}</p>`;
  let month='';
  return events.map(e=>{
    const next=e.startDate.slice(0,7);
    const heading=month!==next?`<h2 class="calendar-month">${esc(fmt(L,{month:'long',year:'numeric'}).format(utc(e.startDate)))}</h2>`:'';
    month=next;return heading+eventCard(L,e);
  }).join('');
}
