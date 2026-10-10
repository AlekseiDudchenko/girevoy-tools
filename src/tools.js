// Перечень инструментов: главная, навигация и sitemap собираются отсюда.
// status: 'ready' — страница опубликована; 'planned' — только карточка на главной.
// Название, пункт меню и описание карточки — в словарях: <key>.title, <key>.nav, <key>.card.
export const TOOLS = [
  { slug: 'calendar', key: 'calendar', status: 'ready' },
  { slug: 'tempo', key: 'tempo', status: 'ready' },
  { slug: 'coefficients', key: 'coef', status: 'ready' },
  { slug: 'workout', key: 'workout', status: 'ready' },
];

export const readyTools = () => TOOLS.filter((t) => t.status === 'ready');
