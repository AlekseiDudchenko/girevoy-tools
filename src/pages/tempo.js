// Калькулятор темпа (#6). Сборка рисует состояние по умолчанию теми же функциями,
// что и браузер: без JavaScript видны графики и таблица для примера из задачи —
// длинный цикл, 10 минут, цель 80, запас на финиш.
import { D_MAX, D_MIN, EXERCISES, MINUTES, MODES, STRATEGIES, defaultState, planText, repsOf } from '../lib/tempo.js';
import { barChart, barLegend, metroText, summary, tableBody, tableFoot, tableHead } from '../lib/tempo-view.js';

const options = (items, selected) => items
  .map(({ id, name }) => `<option value="${id}"${id === selected ? ' selected' : ''}>${name}</option>`)
  .join('');

export default {
  slug: 'tempo/',
  key: 'tempo',
  scripts: ['/tempo.js'],
  body(L) {
    const st = defaultState();
    const t = (key, args) => L.t(`tempo.${key}`, args);
    const tabs = MODES.map((id) => `<button type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${id === st.mode}"${id === st.mode ? '' : ' tabindex="-1"'} data-mode="${id}">${t(`mode.${id}`)}</button>`).join('\n    ');
    const exercises = EXERCISES.map(({ id }) => ({ id, name: t(`ex.${id}`) }));
    const strategies = STRATEGIES.map(({ id }) => ({ id, name: t(`s.${id}`) }));
    const minutes = MINUTES.map((m) => ({ id: m, name: t('minOption', { n: m, minutes: L.plural(m, 'minutes') }) }));
    return `<h1>${t('title')}</h1>
<p class="lead">${t('lead')}</p>
<noscript><p class="note">${t('noscript', { min: st.min, minutes: L.plural(st.min, 'minutes'), goal: st.goal, plan: planText(repsOf(st)) })}</p></noscript>

<div class="tempo" id="tempo">
<section class="panel setup js-only" aria-label="${t('setup')}">
  <div class="field">
    <label for="ex">${t('ex')}</label>
    <select id="ex">${options(exercises, st.ex)}</select>
  </div>
  <div class="field">
    <label for="min">${t('time')}</label>
    <select id="min">${options(minutes, st.min)}</select>
  </div>
  <div class="field" id="hand-field" hidden>
    <label for="hand">${t('hand')}</label>
    <input id="hand" class="n" type="number" inputmode="numeric" min="1" max="${st.min - 1}" step="1" value="${st.hand}">
  </div>
</section>

<section class="panel mode-panel js-only" aria-label="${t('modes')}">
  <div class="tabs" role="tablist" aria-label="${t('modes')}">
    ${tabs}
  </div>
  <div class="tabpanel" role="tabpanel" id="panel-goal" aria-labelledby="tab-goal">
    <div class="goal-row">
      <div class="field">
        <label for="goal">${t('goal')}</label>
        <input id="goal" class="n" type="text" inputmode="numeric" autocomplete="off" value="${st.goal}" aria-describedby="goal-error">
      </div>
      <div class="field">
        <label for="strategy">${t('strategy')}</label>
        <select id="strategy">${options(strategies, st.strategy)}</select>
      </div>
      <div class="field" id="d-field">
        <label for="d">${t('d')}</label>
        <input id="d" class="n" type="number" inputmode="numeric" min="${D_MIN}" max="${D_MAX}" step="1" value="${st.d}">
      </div>
    </div>
    <p class="error" id="goal-error" aria-live="polite"></p>
    <p class="hint" id="strategy-hint">${t(`s.${st.strategy}.hint`)}</p>
  </div>
  <div class="tabpanel" role="tabpanel" id="panel-pace" aria-labelledby="tab-pace" hidden>
    <ol class="segs" id="segs"></ol>
    <button type="button" class="btn" id="seg-add">${t('segAdd')}</button>
    <p class="error" id="seg-error" aria-live="polite"></p>
    <p class="hint" id="pace-sum"></p>
    <p class="hint">${t('paceHint')}</p>
  </div>
  <div class="tabpanel" role="tabpanel" id="panel-plan" aria-labelledby="tab-plan" hidden>
    <p class="hint plan-hint">${t('planHint')}</p>
  </div>
</section>

<p class="readout" id="summary" aria-live="polite">${summary(L, st)}</p>

<section class="panel chart-panel" aria-label="${t('chartPanel')}">
  <h2>${t('chartTitle')}</h2>
  <div class="chart-box" id="box-bars">${barChart(L, st)}</div>
  <div id="legend-bars">${barLegend(L, st)}</div>
</section>

<section class="panel metro js-only" aria-labelledby="metro-title">
  <h2 id="metro-title">${t('metro.title')}</h2>
  <div class="metro-row">
    <button type="button" class="btn btn-main" id="metro-start" aria-pressed="false">${t('metro.start')}</button>
    <p class="metro-now n" id="metro-now">${metroText(L, '0:00', 1, st.min, repsOf(st)[0])}</p>
    <label class="check"><input type="checkbox" id="voice" checked> ${t('metro.voice')}</label>
  </div>
  <p class="hint">${t('metro.hint')}</p>
</section>

<section class="panel table-panel" aria-label="${t('tablePanel')}">
  <div class="table-controls js-only">
    <div class="actions">
      <button type="button" class="btn" id="copy-link">${L.t('common.copyLink')}</button>
      <button type="button" class="btn" id="print">${L.t('common.print')}</button>
      <span class="status" id="status" role="status"></span>
    </div>
  </div>
  <div class="table-wrap">
    <table class="tempo-table">
      <thead id="table-head">${tableHead(L, st)}</thead>
      <tbody id="table-body">${tableBody(L, st)}</tbody>
      <tfoot id="table-foot">${tableFoot(L, st)}</tfoot>
    </table>
  </div>
  <p class="hint">${t('tableHint')}</p>
</section>
</div>`;
  },
};
