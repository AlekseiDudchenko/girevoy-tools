// Данные календаря для сборки: проверенные события и серии из data/calendar/.
import { readFileSync } from 'node:fs';
import { validateEvents } from './lib/calendar.js';
import { validateSeries, todayISO } from './lib/calendar-series.js';
const read = (file) => JSON.parse(readFileSync(new URL(`../data/calendar/${file}`, import.meta.url), 'utf8'));
export const EVENTS = validateEvents(read('events.json'));
export const SERIES = validateSeries(read('series.json'), EVENTS);
/** Дата сборки: от неё зависит деление на предстоящие и прошедшие без JavaScript. */
export const BUILD_DAY = process.env.CALENDAR_TODAY || todayISO();
