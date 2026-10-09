// Страница серии: пересчитать «ближайший» и «через N дней» на дату браузера.
import {pageLocale,copyLinks} from './page.js';
import {localISO} from './lib/calendar-series.js';
import {seriesBody} from './lib/calendar-view.js';
const L=await pageLocale();
const data=document.getElementById('calendar-data');
const {events,series,slug,site}=JSON.parse(data.textContent);
const s=series.find((x)=>x.slug===slug);
const page=document.querySelector('.cal-series-page');
page.outerHTML=seriesBody(L,s,events,localISO(),series,site);
copyLinks(L);
