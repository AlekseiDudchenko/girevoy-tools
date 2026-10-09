// Название и адреса. Единственное место, где они заданы: шапка, <title> и подвал
// берут их отсюда. Бренд «Всегири» пока одинаков на всех языках; слово «Инструменты»
// переводится — ключ site.product словаря.
export const BRAND = 'Всегири';
export const SITE_URL = 'https://tools.vsegiri.com';
export const ARCHIVE_URL = 'https://vsegiri.com';

// Единый шаблон <title>: «<раздел> — <продукт> | Всегири».
export const pageTitle = (section, product) => `${section} — ${product} | ${BRAND}`;
