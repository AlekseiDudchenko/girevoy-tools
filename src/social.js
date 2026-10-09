import { BRAND, SITE_URL } from './brand.js';
import { langPath } from './lib/locale.js';

export const SOCIAL_WIDTH = 1200;
export const SOCIAL_HEIGHT = 630;
export const SOCIAL_LOCALES = { en: 'en_GB', de: 'de_DE' };

// Stable public PNG paths: one localized card per page, including series.
export const socialImagePath = (lang, slug) => `/social/${lang}/${slug ? slug.replace(/\/$/, '') : 'home'}.png`;

export function socialCard(L, page) {
  const title = page.title ? page.title(L) : L.t(`${page.key}.seoTitle`);
  return {
    lang: L.lang, slug: page.slug, title, brand: BRAND,
    product: L.t('site.product'), language: L.t('site.langName'),
    site: new URL(SITE_URL).hostname,
    url: `${SITE_URL}${langPath(L.lang, page.slug)}`,
    image: socialImagePath(L.lang, page.slug),
    alt: L.t('site.socialImageAlt', { title }),
  };
}
