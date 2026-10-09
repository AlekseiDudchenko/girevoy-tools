import { esc } from '../html.js';
import { langPath } from '../lib/locale.js';
import { TOOLS } from '../tools.js';

export default {
  slug: '',
  key: 'home',
  body(L) {
    const cards = TOOLS.map((t) => {
      const title = esc(L.t(`${t.key}.title`));
      const head = t.status === 'ready' ? `<a href="${langPath(L.lang, `${t.slug}/`)}">${title}</a>` : title;
      return `<li class="tool"><h2>${head}</h2><p>${esc(L.t(`${t.key}.card`))}</p><p class="status">${esc(L.t(`home.status.${t.status}`))}</p></li>`;
    }).join('\n');
    return `<h1>${esc(L.t('home.h1'))}</h1>
<p class="lead">${esc(L.t('home.lead'))}</p>
<ul class="tools">
${cards}
</ul>`;
  },
};
