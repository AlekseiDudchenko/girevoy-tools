import { esc } from '../html.js';
import { TOOLS } from '../tools.js';

const STATUS = { ready: 'Готово', planned: 'Готовится' };

export default {
  path: '/',
  title: 'Инструменты',
  description: 'Калькуляторы и графики для гиревиков, тренеров и организаторов соревнований.',
  body() {
    const cards = TOOLS.map((t) => {
      const head = t.status === 'ready' ? `<a href="/${t.slug}/">${esc(t.title)}</a>` : esc(t.title);
      return `<li class="tool"><h2>${head}</h2><p>${esc(t.summary)}</p><p class="status">${STATUS[t.status]}</p></li>`;
    }).join('\n');
    return `<h1>Инструменты гиревика</h1>
<p class="lead">Калькуляторы и графики для спортсменов, тренеров и организаторов. Всё считается в браузере.</p>
<ul class="tools">
${cards}
</ul>`;
  },
};
