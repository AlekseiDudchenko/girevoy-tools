import {safeURL} from './calendar.js';
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const countryName = (L,country) => country ? new Intl.DisplayNames([L.lang],{type:'region'}).of(country) : L.t('calendar.unknown');
export function dateLabel(L,date) { return new Intl.DateTimeFormat(L.lang,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`)); }
const link = (url,text) => safeURL(url) ? `<a href="${esc(url)}" rel="noopener noreferrer">${esc(text)}</a>` : '';
export function correctionURL(e) {
  const p = new URLSearchParams({template:'calendar.yml',title:`[Calendar] ${e.id}`});
  return `https://github.com/AlekseiDudchenko/girevoy-tools/issues/new?${p}`;
}
const disciplineLabel = (L,d) => { try { return L.t(`calendar.discipline.${d}`); } catch { return d; } };
export function eventCard(L,e) {
  const dates=dateLabel(L,e.startDate)+(e.startDate!==e.endDate ? ` – ${dateLabel(L,e.endDate)}`:'');
  const times=e.startAt ? new Intl.DateTimeFormat(L.lang,{timeStyle:'short',timeZone:e.timeZone}).format(new Date(e.startAt))+'–'+new Intl.DateTimeFormat(L.lang,{timeStyle:'short',timeZone:e.timeZone}).format(new Date(e.endAt))+` (${e.timeZone})` : '';
  const sourceLinks=e.sources.map(s=>`<li>${link(s.url,s.organization)} <span>${esc(dateLabel(L,s.checkedAt.slice(0,10)))}</span></li>`).join('');
  return `<article class="calendar-event" id="${esc(e.id)}">
    <div class="calendar-date"><time datetime="${e.startDate}">${esc(dates)}</time>${times?`<small>${esc(times)}</small>`:''}</div>
    <div class="calendar-info"><h2>${esc(e.title)}</h2>
    <p class="calendar-place">${esc([e.city||L.t('calendar.cityUnknown'),countryName(L,e.country)].join(' · '))}</p>
    <p class="calendar-badges"><span>${esc(e.federations.join(' · '))}</span><span>${esc(L.t(`calendar.format.${e.format}`))}</span><span>${esc(L.t(`calendar.status.${e.status}`))}</span></p>
    <dl><dt>${esc(L.t('calendar.organizer'))}</dt><dd>${e.organizerUrl?link(e.organizerUrl,e.organizer):esc(e.organizer)}</dd>
    ${e.disciplines.length?`<dt>${esc(L.t('calendar.disciplines'))}</dt><dd>${esc(e.disciplines.map(d=>disciplineLabel(L,d)).join(' · '))}</dd>`:''}
    ${e.registrationDeadline?`<dt>${esc(L.t('calendar.deadline'))}</dt><dd>${esc(dateLabel(L,e.registrationDeadline))}</dd>`:''}
    <dt>${esc(L.t('calendar.checked'))}</dt><dd>${esc(dateLabel(L,e.lastChecked.slice(0,10)))}</dd></dl>
    <div class="calendar-actions">${e.registrationUrl?link(e.registrationUrl,L.t('calendar.register')):''}<a href="/calendar/ics/${esc(e.id)}.ics" download>${esc(L.t('calendar.ics'))}</a>${link(correctionURL(e),L.t('calendar.correct'))}</div>
    <details><summary>${esc(L.t('calendar.sources'))} (${L.num(e.sources.length,0)})</summary><ul class="calendar-sources">${sourceLinks}</ul></details>
    </div></article>`;
}
export function renderEvents(L,events) {
  if (!events.length) return `<p class="calendar-empty">${esc(L.t('calendar.empty'))}</p>`;
  let month='';
  return events.map(e=>{
    const next=e.startDate.slice(0,7);
    const heading=month!==next?`<h2 class="calendar-month">${esc(new Intl.DateTimeFormat(L.lang,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${e.startDate}T00:00:00Z`)))}</h2>`:'';
    month=next;return heading+eventCard(L,e);
  }).join('');
}
