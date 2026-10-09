// Коэффициенты для гирь разного веса (#1). Сборка рисует состояние по умолчанию
// теми же функциями, что и браузер: без JavaScript видны графики и таблица для
// 24 и 32 кг с коэффициентом по весу гири.
import { esc } from '../html.js';
import { DEFAULT_TABLE, K_MAX, K_MIN, STEPS, WEIGHTS, defaultState, fmt, sliderMax, weightRatio } from '../lib/coefficients.js';
import { colorVars, equivChart, equivLegend, readout, scoreChart, scoreLegend, tableBody, tableHead } from '../lib/coefficients-view.js';

const options = (values, selected, skip) => values
  .filter((v) => v !== skip)
  .map((v) => `<option value="${v}"${v === selected ? ' selected' : ''}>${v} кг</option>`)
  .join('');

export default {
  path: '/coefficients/',
  title: 'Коэффициенты для гирь разного веса',
  description: 'Для организаторов: коэффициент тяжёлой гири, график и таблица — сколько подъёмов нужно на каждой гире для одного зачётного результата.',
  scripts: ['/coefficients.js'],
  body() {
    const st = defaultState();
    const ratio = weightRatio(st.light, st.heavy);
    return `<h1>Коэффициенты для гирь разного веса</h1>
<p class="lead">Для положений, где в одной категории выступают с гирями разного веса. Зачётный результат = подъёмы × коэффициент. У лёгкой гири коэффициент 1,00, коэффициент тяжёлой подбирается.</p>
<noscript><p class="note">Без JavaScript показаны графики и таблица для ${st.light} и ${st.heavy} кг с коэффициентом ${fmt(st.k, 2)}. Чтобы выбрать гири и коэффициент, включите JavaScript.</p></noscript>

<div class="coef" id="coef" style="${esc(colorVars(st))}">
<section class="panel bells" aria-label="Гири и коэффициент">
  <div class="bell">
    <span class="chip chip-light" id="chip-light">${st.light} кг</span>
    <div class="field js-only">
      <label for="light">Лёгкая гиря</label>
      <select id="light">${options(WEIGHTS, st.light, WEIGHTS[WEIGHTS.length - 1])}</select>
    </div>
    <div class="field">
      <span class="label">Коэффициент</span>
      <span class="fixed n">× 1,00</span>
    </div>
  </div>
  <div class="bell bell-heavy">
    <span class="chip chip-heavy" id="chip-heavy">${st.heavy} кг</span>
    <div class="field js-only">
      <label for="heavy">Тяжёлая гиря</label>
      <select id="heavy">${options(WEIGHTS, st.heavy, WEIGHTS[0])}</select>
    </div>
    <div class="field nojs-only">
      <span class="label">Коэффициент</span>
      <span class="fixed n">× ${fmt(st.k, 2)}</span>
    </div>
    <div class="field js-only">
      <label for="k">Коэффициент</label>
      <input id="k" class="n" type="number" inputmode="decimal" min="${K_MIN}" max="${K_MAX}" step="0.01" value="${st.k.toFixed(2)}">
    </div>
    <input id="k-range" class="k-range js-only" type="range" min="${K_MIN}" max="${sliderMax(st)}" step="0.01" value="${st.k}" aria-label="Коэффициент тяжёлой гири">
    <p class="hint" id="ratio-hint">Пунктир на графиках — «по весу гири»: <span class="n">${st.heavy} / ${st.light} = ${fmt(ratio, 2)}</span>. Это арифметика, а не рекомендация.</p>
  </div>
</section>

<section class="panel chart-panel" aria-label="График">
  <div class="tabs" role="tablist" aria-label="Вид графика">
    <button type="button" role="tab" id="tab-score" aria-controls="panel-score" aria-selected="true" data-tab="score">Зачётный результат</button>
    <button type="button" role="tab" id="tab-eq" aria-controls="panel-eq" aria-selected="false" tabindex="-1" data-tab="eq">Равноценные подъёмы</button>
  </div>
  <div class="tabpanel" role="tabpanel" id="panel-score" aria-labelledby="tab-score">
    <h2 class="nojs-title">Зачётный результат</h2>
    <div class="chart-box" id="box-score">${scoreChart(st)}</div>
    <div id="legend-score">${scoreLegend(st)}</div>
  </div>
  <div class="tabpanel" role="tabpanel" id="panel-eq" aria-labelledby="tab-eq">
    <h2 class="nojs-title">Равноценные подъёмы</h2>
    <div class="chart-box" id="box-eq">${equivChart(st)}</div>
    <div id="legend-eq">${equivLegend(st)}</div>
  </div>
  <div class="readout-row">
    <p class="readout" id="readout" aria-live="polite">${readout(st)}</p>
    <div class="field">
      <label for="score">Зачётный результат</label>
      <input id="score" class="n" type="number" inputmode="numeric" min="1" max="999" step="1" value="${st.score}">
    </div>
  </div>
  <p class="hint">Один коэффициент задаёт одно отношение на всех уровнях: если 50 подъёмов на 32 кг равны 80 на 24 кг, то и 25 равны 40. Если сильным и начинающим тяжёлая гиря даётся по-разному, один коэффициент этого не учтёт.</p>
</section>

<section class="panel table-panel" aria-label="Таблица">
  <div class="table-controls">
    <div class="field">
      <label for="step">Шаг</label>
      <select id="step">${STEPS.map((s) => `<option value="${s}"${s === DEFAULT_TABLE.step ? ' selected' : ''}>${s}</option>`).join('')}</select>
    </div>
    <div class="field">
      <label for="from">От</label>
      <input id="from" class="n" type="number" inputmode="numeric" min="1" max="999" step="1" value="${st.from}">
    </div>
    <div class="field">
      <label for="to">До</label>
      <input id="to" class="n" type="number" inputmode="numeric" min="1" max="999" step="1" value="${st.to}">
    </div>
    <div class="actions">
      <button type="button" class="btn" id="copy-link">Скопировать ссылку</button>
      <button type="button" class="btn" id="print">Печать</button>
      <span class="status" id="status" role="status"></span>
    </div>
  </div>
  <div class="table-wrap">
    <table class="coef-table">
      <thead id="table-head">${tableHead(st)}</thead>
      <tbody id="table-body">${tableBody(st)}</tbody>
    </table>
  </div>
  <p class="hint">Подъёмы на тяжёлой гире округлены вверх: наименьшее число, которое даёт не меньше зачётного результата. Строка таблицы показывает её на графике.</p>
</section>
</div>`;
  },
};
