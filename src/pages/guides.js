import { esc } from '../html.js';
import { langPath } from '../lib/locale.js';
import { serializeState, defaultState } from '../lib/tempo.js';

export const PACE_EXAMPLES = [
  { id: 'jerk', state: { ...defaultState(), ex: 'jerk', goal: 100, strategy: 'even' } },
  { id: 'lc', state: { ...defaultState(), ex: 'lc', goal: 80, strategy: 'ramp', d: 2 } },
  { id: 'snatch', state: { ...defaultState(), ex: 'snatch', goal: 160, strategy: 'even', hand: 5 } },
];

export function homeGuide(L) {
  return `<section class="reading" aria-labelledby="home-guide"><h2 id="home-guide">${esc(L.t('home.guide.title'))}</h2><p>${esc(L.t('home.guide.text'))}</p></section>`;
}

export function tempoGuide(L) {
  const examples = PACE_EXAMPLES.map(({ id, state }) => {
    const args = Object.fromEntries(Object.entries({ goal: state.goal, min: state.min, rate: state.goal / state.min, d: state.d, hand: state.hand, perHand: state.goal / 2 }).map(([key, value]) => [key, L.num(value)]));
    return `<article><h3>${esc(L.t(`tempo.guide.${id}.title`))}</h3><p>${esc(L.t(`tempo.guide.${id}.text`, args))}</p><a href="${esc(langPath(L.lang, 'tempo/') + serializeState(state))}">${esc(L.t('tempo.guide.open'))}<span class="sr">: ${esc(L.t(`tempo.ex.${id}`))}</span></a></article>`;
  }).join('');
  return `<section class="reading" aria-labelledby="tempo-guide"><h2 id="tempo-guide">${esc(L.t('tempo.guide.title'))}</h2><p>${esc(L.t('tempo.guide.text'))}</p><h2>${esc(L.t('tempo.guide.examples'))}</h2>${examples}</section>`;
}

export function coefficientsGuide(L) {
  const args = { one: L.num(1, 2), target: L.num(80), k: L.num(1.6, 2), reps: L.num(50), next: L.num(81), rounded: L.num(51), heavy: L.num(32), light: L.num(24), ratio: L.num(1.33, 2) };
  return `<section class="reading" aria-labelledby="coef-guide"><h2 id="coef-guide">${esc(L.t('coef.guide.title'))}</h2>${['formula', 'example', 'precision', 'limits'].map((key) => `<p>${esc(L.t(`coef.guide.${key}`, args))}</p>`).join('')}<a href="${esc(langPath(L.lang, 'coefficients/') + '?light=24&heavy=32&k=1.6&tab=score')}">${esc(L.t('coef.guide.open'))}</a></section>`;
}
