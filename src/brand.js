// Название и адреса. Единственное место, где они заданы: шапка, <title> и подвал
// берут их отсюда.
export const BRAND = 'Всегири';
export const PRODUCT = 'Инструменты';
export const SITE_URL = 'https://tools.vsegiri.com';
export const ARCHIVE_URL = 'https://vsegiri.com';

// Единый шаблон <title>: «<раздел> — Инструменты | Всегири».
export const pageTitle = (section) => `${section} — ${PRODUCT} | ${BRAND}`;
