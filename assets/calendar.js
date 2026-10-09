import {pageLocale,replaceSearch} from './page.js';
import {parseFilters} from './lib/calendar.js';
import {todayISO,split} from './lib/calendar-series.js';
import {featureCard,regionTiles,renderBrowse} from './lib/calendar-view.js';
const L=await pageLocale();
const {events,series}=JSON.parse(document.getElementById('calendar-data').textContent);
const form=document.getElementById('calendar-filters');
// «Сегодня» — дата браузера: страница могла быть собрана несколько дней назад.
const today=todayISO();
document.getElementById('cal-next').innerHTML=featureCard(L,events,today,series);
document.getElementById('cal-tiles').innerHTML=regionTiles(L,events,today);
const {upcoming}=split(events,today);
document.getElementById('stat-upcoming').textContent=L.num(upcoming.length,0);
document.getElementById('stat-countries').textContent=L.num(new Set(upcoming.map(e=>e.country).filter(Boolean)).size,0);
function fill(filters) {
  form.reset();
  for (const [key,value] of Object.entries(filters)) {
    const field=form.elements.namedItem(key);
    if (field instanceof RadioNodeList) { for (const r of field) r.checked=r.value===value; } else if (field) field.value=value;
  }
}
function render() {
  const filters=Object.fromEntries([...new FormData(form)].filter(([,v])=>v));
  const result=renderBrowse(L,events,filters,{today,series});
  document.getElementById('calendar-events').innerHTML=result.html;
  for (const n of form.querySelectorAll('[data-when]')) n.textContent=L.num(result[n.dataset.when],0);
  document.getElementById('calendar-count').textContent=L.t('calendar.count',{n:L.num(result.shown,0)});
  replaceSearch(Object.keys(filters).length?'?'+new URLSearchParams(filters):'');
}
fill(parseFilters(location.search));
form.addEventListener('submit',e=>{e.preventDefault();render();});
form.addEventListener('change',render);
form.addEventListener('reset',()=>{setTimeout(render,0);});
window.addEventListener('popstate',()=>{fill(parseFilters(location.search));render();});
render();
