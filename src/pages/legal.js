import { esc } from '../html.js';

const sections = {
  legal: ['provider', 'independent', 'calendar', 'calculators', 'rights'],
  privacy: ['controller', 'hosting', 'security', 'local', 'sharing', 'email', 'rights'],
};

export const legalPages = Object.entries(sections).map(([key, names]) => ({
  key,
  slug: `${key}/`,
  scripts: ['/page.js'],
  body(L) {
    const t = part => esc(L.t(`${key}.${part}`));
    return `<h1>${t('title')}</h1><p class="lead">${t('intro')}</p>
<p class="note">${t('pending')}</p><div class="reading">
${names.map(name => `<section aria-labelledby="${key}-${name}"><h2 id="${key}-${name}">${t(`${name}.title`)}</h2><p>${t(`${name}.text`)}</p></section>`).join('\n')}
<p><a href="mailto:info@vsegiri.com">info@vsegiri.com</a></p>
${key === 'privacy' ? `<p><a href="https://www.cloudflare.com/privacypolicy/">${t('cloud')}</a></p>` : ''}
</div>`;
  },
}));
