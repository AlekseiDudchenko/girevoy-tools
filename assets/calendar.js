import {pageLocale,replaceSearch} from './page.js';
import {parseFilters} from './lib/calendar.js';
import {localISO} from './lib/calendar-series.js';
import {featureCard,seriesCards,renderBrowse,filterSubscribe} from './lib/calendar-view.js';
import {copyLinks} from './page.js';
const L=await pageLocale();
const {events,series,site}=JSON.parse(document.getElementById('calendar-data').textContent);
const form=document.getElementById('calendar-filters');
// «Сегодня» — дата браузера: страница могла быть собрана несколько дней назад.
const today=localISO();
document.getElementById('cal-next').innerHTML=featureCard(L,events,today,series);
document.getElementById('cal-series').innerHTML=seriesCards(L,series,events,today);
// Вкладки и фильтры работают только со скриптом: без него форма скрыта, виден список предстоящих.
form.classList.add('is-ready');
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
  document.getElementById('calendar-subscribe').innerHTML=filterSubscribe(L,site,filters,events);
  document.getElementById('calendar-count').textContent=L.t('calendar.count',{n:L.num(result.shown,0)});
  replaceSearch(Object.keys(filters).length?'?'+new URLSearchParams(filters):'');
}
fill(parseFilters(location.search));
form.addEventListener('submit',e=>{e.preventDefault();render();});
form.addEventListener('change',render);
form.addEventListener('reset',()=>{setTimeout(render,0);});
window.addEventListener('popstate',()=>{fill(parseFilters(location.search));render();});
render();
copyLinks(L);
