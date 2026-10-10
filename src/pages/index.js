// Все страницы сайта. Каждая собирается на всех языках из src/i18n/ по адресу
// /<язык>/<slug>. Новая страница инструмента добавляется сюда и в src/tools.js
// со status: 'ready'; её тексты — в словари всех языков.
import calendar from './calendar.js';
import calendarSeries from './calendar-series.js';
import home from './home.js';
import tempo from './tempo.js';
import coefficients from './coefficients.js';
import workout from './workout.js';

export const PAGES = [home, tempo, coefficients, workout, calendar, ...calendarSeries];
