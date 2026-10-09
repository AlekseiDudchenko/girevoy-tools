// Калькулятор темпа (#6). Сборка рисует состояние по умолчанию теми же функциями,
// что и браузер: без JavaScript видны графики и таблица для примера из задачи —
// длинный цикл, 10 минут, цель 80, запас на финиш.
import { D_MAX, D_MIN, EXERCISES, MINUTES, STRATEGIES, defaultState, planText, repsOf } from '../lib/tempo.js';
import { barChart, barLegend, devChart, devLegend, summary, tableBody, tableFoot, tableHead } from '../lib/tempo-view.js';

const options = (items, selected) => items
  .map(({ id, name }) => `<option value="${id}"${id === selected ? ' selected' : ''}>${name}</option>`)
  .join('');

const TABS = [
  { id: 'goal', name: 'От цели к темпу' },
  { id: 'pace', name: 'От темпа к итогу' },
  { id: 'plan', name: 'Свой план' },
];

export default {
  path: '/tempo/',
  title: 'Калькулятор темпа',
  description: 'Раскладка подъёмов по минутам: от цели к темпу и от темпа к итогу. Таблица, графики и метроном для толчка, длинного цикла и рывка.',
  scripts: ['/tempo.js'],
  body() {
    const st = defaultState();
    const strategy = STRATEGIES.find((s) => s.id === st.strategy);
    const tabs = TABS.map((t) => `<button type="button" role="tab" id="tab-${t.id}" aria-controls="panel-${t.id}" aria-selected="${t.id === st.mode}"${t.id === st.mode ? '' : ' tabindex="-1"'} data-mode="${t.id}">${t.name}</button>`).join('\n    ');
    return `<h1>Калькулятор темпа</h1>
<p class="lead">Раскладка подъёмов по минутам: сколько делать в каждой минуте, чтобы выйти на цель, и сколько выйдет при заданном темпе. Таблица для печати и метроном для тренировки.</p>
<noscript><p class="note">Без JavaScript показан пример: длинный цикл, ${st.min} минут, цель ${st.goal}, запас на финиш → ${planText(repsOf(st))}. Чтобы задать свою цель и темп, включите JavaScript.</p></noscript>

<div class="tempo" id="tempo">
<section class="panel setup js-only" aria-label="Упражнение и время">
  <div class="field">
    <label for="ex">Упражнение</label>
    <select id="ex">${options(EXERCISES, st.ex)}</select>
  </div>
  <div class="field">
    <label for="min">Время</label>
    <select id="min">${options(MINUTES.map((m) => ({ id: m, name: `${m} минут` })), st.min)}</select>
  </div>
  <div class="field" id="hand-field" hidden>
    <label for="hand">Смена руки после минуты</label>
    <input id="hand" class="n" type="number" inputmode="numeric" min="1" max="${st.min - 1}" step="1" value="${st.hand}">
  </div>
</section>

<section class="panel mode-panel js-only" aria-label="Способ расчёта">
  <div class="tabs" role="tablist" aria-label="Способ расчёта">
    ${tabs}
  </div>
  <div class="tabpanel" role="tabpanel" id="panel-goal" aria-labelledby="tab-goal">
    <div class="goal-row">
      <div class="field">
        <label for="goal">Цель, подъёмов</label>
        <input id="goal" class="n" type="text" inputmode="numeric" autocomplete="off" value="${st.goal}" aria-describedby="goal-error">
      </div>
      <div class="field">
        <label for="strategy">Стратегия</label>
        <select id="strategy">${options(STRATEGIES, st.strategy)}</select>
      </div>
      <div class="field" id="d-field">
        <label for="d">Прибавка, в минуту</label>
        <input id="d" class="n" type="number" inputmode="numeric" min="${D_MIN}" max="${D_MAX}" step="1" value="${st.d}">
      </div>
    </div>
    <p class="error" id="goal-error" aria-live="polite"></p>
    <p class="hint" id="strategy-hint">${strategy.hint}</p>
  </div>
  <div class="tabpanel" role="tabpanel" id="panel-pace" aria-labelledby="tab-pace" hidden>
    <ol class="segs" id="segs"></ol>
    <button type="button" class="btn" id="seg-add">+ Отрезок</button>
    <p class="error" id="seg-error" aria-live="polite"></p>
    <p class="hint" id="pace-sum"></p>
    <p class="hint">Последний отрезок добирает оставшиеся минуты. Дробный темп раскладывается целыми: 7,5 в минуту → 7, 8, 7, 8. В рывке отдельный темп каждой руке — отдельными отрезками.</p>
  </div>
  <div class="tabpanel" role="tabpanel" id="panel-plan" aria-labelledby="tab-plan" hidden>
    <p class="hint plan-hint">Тяните столбики на графике мышью или пальцем. С клавиатуры: Tab — на график, ←/→ — соседняя минута, ↑/↓ — темп минуты. Меняется только эта минута, итог плана — вместе с ней. План начинается с раскладки, которая была на другой вкладке.</p>
  </div>
</section>

<p class="readout" id="summary" aria-live="polite">${summary(st)}</p>

<section class="panel chart-panel" aria-label="Графики">
  <h2>Темп по минутам</h2>
  <div class="chart-box" id="box-bars">${barChart(st)}</div>
  <div id="legend-bars">${barLegend(st)}</div>
  <h2>Впереди или позади ровного темпа</h2>
  <div class="chart-box" id="box-dev">${devChart(st)}</div>
  <div id="legend-dev">${devLegend(st)}</div>
</section>

<section class="panel metro js-only" aria-labelledby="metro-title">
  <h2 id="metro-title">Метроном</h2>
  <div class="metro-row">
    <button type="button" class="btn btn-main" id="metro-start" aria-pressed="false">Старт</button>
    <p class="metro-now n" id="metro-now">0:00 · минута 1 из ${st.min} · ${repsOf(st)[0]} в минуту</p>
    <label class="check"><input type="checkbox" id="voice" checked> Объявлять минуты голосом</label>
  </div>
  <p class="hint">Щелчок — на каждый подъём текущей минуты, высокий — в начале минуты. Метроном идёт по плану на странице: изменения применяются сразу. Звук и голос — в браузере, без интернета.</p>
</section>

<section class="panel table-panel" aria-label="Таблица по минутам">
  <div class="table-controls js-only">
    <div class="actions">
      <button type="button" class="btn" id="copy-link">Скопировать ссылку</button>
      <button type="button" class="btn" id="print">Печать</button>
      <span class="status" id="status" role="status"></span>
    </div>
  </div>
  <div class="table-wrap">
    <table class="tempo-table">
      <thead id="table-head">${tableHead(st)}</thead>
      <tbody id="table-body">${tableBody(st)}</tbody>
      <tfoot id="table-foot">${tableFoot(st)}</tfoot>
    </table>
  </div>
  <p class="hint">«± к ровному» — на сколько подъёмов нарастающий итог впереди (+) или позади (−) ровной раскладки того же итога.</p>
</section>
</div>`;
  },
};
