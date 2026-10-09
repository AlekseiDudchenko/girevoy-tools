// Название и адреса. Единственное место, где они заданы: шапка, <title> и подвал
// берут их отсюда. Бренд «VseGiri» одинаков на всех языках; слово «Инструменты»
// переводится — ключ site.product словаря.
export const BRAND = 'VseGiri';
export const SITE_URL = 'https://tools.vsegiri.com';

// Единый шаблон <title>: «<раздел> — <продукт> | VseGiri».
export const pageTitle = (section, product) => `${section} — ${product} | ${BRAND}`;
