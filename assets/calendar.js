import {pageLocale,replaceSearch} from './page.js';
import {filterEvents,parseFilters} from './lib/calendar.js';
import {renderEvents} from './lib/calendar-view.js';
const L=await pageLocale();
const events=JSON.parse(document.getElementById('calendar-data').textContent);
const form=document.getElementById('calendar-filters');
function render() {
  const filters=Object.fromEntries([...new FormData(form)].filter(([,v])=>v));
  const filtered=filterEvents(events,filters);
  document.getElementById('calendar-events').innerHTML=renderEvents(L,filtered);
  document.getElementById('calendar-count').textContent=L.t('calendar.count',{n:L.num(filtered.length,0)});
  replaceSearch(Object.keys(filters).length?'?'+new URLSearchParams(filters):'');
}
for (const [key,value] of Object.entries(parseFilters(location.search))) form.elements.namedItem(key).value=value;
form.addEventListener('submit',e=>{e.preventDefault();render();});
form.addEventListener('change',render);
form.addEventListener('reset',()=>{queueMicrotask(render);});
window.addEventListener('popstate',()=>{
  form.reset();
  for (const [key,value] of Object.entries(parseFilters(location.search))) form.elements.namedItem(key).value=value;
  render();
});
render();
