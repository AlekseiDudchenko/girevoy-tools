// Коэффициенты для гирь разного веса (#1). Сборка рисует состояние по умолчанию
// теми же функциями, что и браузер: без JavaScript видны графики и таблица для
// 24 и 32 кг с коэффициентом по весу гири.
import { esc } from '../html.js';
import { DEFAULT_TABLE, K_MAX, K_MIN, STEPS, WEIGHTS, defaultState, sliderMax } from '../lib/coefficients.js';
import {
  calcLabels, calcNote, calcText, calcValues, colorVars, equivChart, equivLegend, kg, ratioHint, readout, scoreChart,
  scoreLegend, tableBody, tableHead,
} from '../lib/coefficients-view.js';

const options = (L, values, selected, skip) => values
  .filter((v) => v !== skip)
  .map((v) => `<option value="${v}"${v === selected ? ' selected' : ''}>${kg(L, v)}</option>`)
  .join('');

// Строка пересчёта: ввести число в любое поле — два других пересчитываются.
function calcPanel(L, st) {
  const values = calcValues(st);
  const labels = calcLabels(L, st);
  const field = (name, mode) => `<div class="field calc-${name}${st.calc.field === name ? ' src' : ''}">
      <label for="calc-${name}" id="calc-${name}-label">${labels[name]}</label>
      <input id="calc-${name}" class="n" type="text" inputmode="${mode}" autocomplete="off" value="${calcText(L, values[name])}">
    </div>`;
  return `<section class="panel calc-panel js-only" aria-labelledby="calc-title">
  <h2 id="calc-title">${L.t('coef.calc.title')}</h2>
  <p class="hint calc-intro">${L.t('coef.calc.intro')}</p>
  <div class="calc-row">
    ${field('light', 'numeric')}
    <span class="calc-sep" aria-hidden="true">${L.t('coef.calc.or')}</span>
    ${field('heavy', 'numeric')}
    <span class="calc-sep" aria-hidden="true">→</span>
    ${field('score', 'decimal')}
  </div>
  <div class="calc-k">
    <label for="k-range-calc">${L.t('coef.calc.k')} <span id="calc-k-bell">${kg(L, st.heavy)}</span> <b class="n" id="calc-k-value">× ${L.num(st.k, 2)}</b></label>
    <input id="k-range-calc" class="k-range" type="range" min="${K_MIN}" max="${sliderMax(st)}" step="0.01" value="${st.k}">
  </div>
  <p class="hint calc-note" id="calc-note" aria-live="polite">${calcNote(L, st)}</p>
</section>`;
}

export default {
  slug: 'coefficients/',
  key: 'coef',
  scripts: ['/coefficients.js'],
  body(L) {
    const st = defaultState();
    const t = (key, args) => L.t(`coef.${key}`, args);
    return `<h1>${t('title')}</h1>
<p class="lead">${t('lead', { one: L.num(1, 2) })}</p>
<noscript><p class="note">${t('noscript', { light: st.light, heavyKg: kg(L, st.heavy), k: L.num(st.k, 2) })}</p></noscript>

<div class="coef" id="coef" style="${esc(colorVars(st))}">
<section class="panel bells" aria-label="${t('bells')}">
  <div class="bell">
    <span class="chip chip-light" id="chip-light">${kg(L, st.light)}</span>
    <div class="field js-only">
      <label for="light">${t('light')}</label>
      <select id="light">${options(L, WEIGHTS, st.light, WEIGHTS[WEIGHTS.length - 1])}</select>
    </div>
    <div class="field">
      <span class="label">${t('k')}</span>
      <span class="fixed n">× ${L.num(1, 2)}</span>
    </div>
  </div>
  <div class="bell bell-heavy">
    <span class="chip chip-heavy" id="chip-heavy">${kg(L, st.heavy)}</span>
    <div class="field js-only">
      <label for="heavy">${t('heavy')}</label>
      <select id="heavy">${options(L, WEIGHTS, st.heavy, WEIGHTS[0])}</select>
    </div>
    <div class="field nojs-only">
      <span class="label">${t('k')}</span>
      <span class="fixed n">× ${L.num(st.k, 2)}</span>
    </div>
    <div class="field js-only">
      <label for="k">${t('k')}</label>
      <input id="k" class="n" type="number" inputmode="decimal" min="${K_MIN}" max="${K_MAX}" step="0.01" value="${st.k.toFixed(2)}">
    </div>
    <input id="k-range" class="k-range js-only" type="range" min="${K_MIN}" max="${sliderMax(st)}" step="0.01" value="${st.k}" aria-label="${t('kRange')}">
    <p class="hint" id="ratio-hint">${ratioHint(L, st)}</p>
  </div>
</section>

${calcPanel(L, st)}

<section class="panel chart-panel" aria-label="${t('chartPanel')}">
  <div class="tabs" role="tablist" aria-label="${t('chartTabs')}">
    <button type="button" role="tab" id="tab-score" aria-controls="panel-score" aria-selected="true" data-tab="score">${t('score')}</button>
    <button type="button" role="tab" id="tab-eq" aria-controls="panel-eq" aria-selected="false" tabindex="-1" data-tab="eq">${t('eq')}</button>
  </div>
  <div class="tabpanel" role="tabpanel" id="panel-score" aria-labelledby="tab-score">
    <h2 class="nojs-title">${t('score')}</h2>
    <div class="chart-box" id="box-score">${scoreChart(L, st)}</div>
    <div id="legend-score">${scoreLegend(L, st)}</div>
  </div>
  <div class="tabpanel" role="tabpanel" id="panel-eq" aria-labelledby="tab-eq">
    <h2 class="nojs-title">${t('eq')}</h2>
    <div class="chart-box" id="box-eq">${equivChart(L, st)}</div>
    <div id="legend-eq">${equivLegend(L, st)}</div>
  </div>
  <div class="readout-row">
    <p class="readout" id="readout" aria-live="polite">${readout(L, st)}</p>
    <div class="field">
      <label for="score">${t('score')}</label>
      <input id="score" class="n" type="number" inputmode="numeric" min="1" max="999" step="1" value="${st.score}">
    </div>
  </div>
  <p class="hint">${t('oneK')}</p>
</section>

<section class="panel table-panel" aria-label="${t('tablePanel')}">
  <div class="table-controls">
    <div class="field">
      <label for="step">${t('step')}</label>
      <select id="step">${STEPS.map((s) => `<option value="${s}"${s === DEFAULT_TABLE.step ? ' selected' : ''}>${s}</option>`).join('')}</select>
    </div>
    <div class="field">
      <label for="from">${t('from')}</label>
      <input id="from" class="n" type="number" inputmode="numeric" min="1" max="999" step="1" value="${st.from}">
    </div>
    <div class="field">
      <label for="to">${t('to')}</label>
      <input id="to" class="n" type="number" inputmode="numeric" min="1" max="999" step="1" value="${st.to}">
    </div>
    <div class="actions">
      <button type="button" class="btn" id="copy-link">${L.t('common.copyLink')}</button>
      <button type="button" class="btn" id="print">${L.t('common.print')}</button>
      <span class="status" id="status" role="status"></span>
    </div>
  </div>
  <div class="table-wrap">
    <table class="coef-table">
      <thead id="table-head">${tableHead(L, st)}</thead>
      <tbody id="table-body">${tableBody(st)}</tbody>
    </table>
  </div>
  <p class="hint">${t('tableHint')}</p>
</section>
</div>`;
  },
};
