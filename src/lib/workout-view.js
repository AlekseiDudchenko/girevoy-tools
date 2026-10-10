import { esc } from './workout-html.js';
import {
  summary,
  targetReps,
  blockSeconds,
  recordOf,
  isLocked,
  compareBlock,
} from './workout.js';
export const text = (L, k, args) => esc(L.t('workout.' + k, args));
export const clock = (L, s) =>
  `${L.num(Math.floor(s / 60))}:${L.num(s % 60).padStart(2, '0')}`;
export const blockTitle = (L, b) =>
  b.title || L.t('workout.' + (b.label ? 'block.' + b.label : 'untitled'));
export const workoutTitle = (L, w) =>
  w.title ||
  L.t(
    'workout.' +
      (w.blocks.some((b) => b.label === 'main') ? 'example.title' : 'untitled'),
  );
export const exerciseName = (L, b) =>
  b.exercise === 'custom'
    ? L.t('workout.customExercise')
    : L.t('tempo.ex.' + b.exercise);
const btn = (L, k, action, extra = '') =>
  `<button type="button" class="btn" data-action="${action}" ${extra}>${text(L, k)}</button>`;
const field = (L, k, input, cls = '') =>
  `<label class="wk-field ${cls}">${text(L, k)}${input}</label>`;
const input = (name, value = '', extra = '') =>
  `<input name="${name}" value="${esc(value)}" ${extra}>`;
const options = (L, items, current) =>
  items
    .map(
      ([v, k]) =>
        `<option value="${v}" ${v === current ? 'selected' : ''}>${text(L, k)}</option>`,
    )
    .join('');
export function workoutShell(L, w) {
  const disabled = isLocked(w) ? 'disabled' : '';
  return `<div class="workout" id="workout">
<div class="wk-toolbar"><div class="wk-tabs" role="tablist" aria-label="${text(L, 'name')}">${['plan', 'execution', 'review'].map((m, i) => `<button type="button" id="wk-tab-${m}" role="tab" aria-controls="wk-panel" aria-selected="${i === 0}" ${i ? 'tabindex="-1"' : ''} data-mode="${m}">${text(L, m)}</button>`).join('')}</div><div class="wk-actions">${btn(L, 'import', 'import')}${btn(L, 'export', 'export')}${btn(L, 'share', 'share')}</div></div>
<div class="wk-layout"><section class="wk-card"><div class="wk-header"><span id="wk-save-status" class="wk-micro" role="status"></span>${field(L, 'name', input('title', w.title, 'id="wk-title" maxlength="120" ' + disabled))}<div class="wk-meta">${field(L, 'date', input('date', w.date, 'type="date" ' + disabled))}${field(L, 'athlete', input('athlete', w.athlete, 'maxlength="100" ' + disabled))}${field(L, 'coach', input('coach', w.coach, 'maxlength="100" ' + disabled))}</div></div><div id="wk-panel" class="wk-panel" role="tabpanel" aria-labelledby="wk-tab-plan">${planView(L, w)}</div></section><aside class="wk-sidebar"><div class="wk-card" id="wk-summary">${summaryView(L, w)}</div><div class="wk-storage"><strong>${text(L, 'storage')}</strong><p id="wk-storage-hint">${text(L, 'storageHint')}</p></div><div class="wk-card wk-library"><h2>${text(L, 'library')}</h2><div id="wk-library"></div><div class="wk-actions">${btn(L, 'new', 'new')}${btn(L, 'example', 'example')}</div></div></aside></div>
<dialog id="wk-share"><div class="wk-modal-head"><h2 id="wk-share-title">${text(L, 'shareTitle')}</h2>${btn(L, 'close', 'close')}</div><div class="wk-modal-body"><div class="wk-scopes">${[
    ['plan', 'scopePlan', 'scopePlanHint'],
    ['all', 'scopeAll', 'scopeAllHint'],
  ]
    .map(
      ([v, k, h]) =>
        `<label class="wk-scope"><input type="radio" name="scope" value="${v}" ${v === 'plan' ? 'checked' : ''}><span><strong>${text(L, k)}</strong><small>${text(L, h)}</small></span></label>`,
    )
    .join(
      '',
    )}</div><div id="wk-link-area">${field(L, 'link', input('link', '', 'id="wk-link" readonly'))}<div class="wk-actions">${btn(L, 'copyLink', 'copy-link')}</div><p class="wk-micro">${text(L, 'linkHint')}</p><p id="wk-link-warning" class="error" hidden>${text(L, 'longLink')}</p></div><div class="wk-actions wk-downloads">${btn(L, 'downloadJSON', 'json')}${btn(L, 'downloadTXT', 'txt')}${btn(L, 'pdfLater', 'pdf', 'disabled')}</div></div></dialog>
<dialog id="wk-block"><form id="wk-block-form"><div class="wk-modal-head"><h2>${text(L, 'add')}</h2>${btn(L, 'close', 'close')}</div><div class="wk-modal-body wk-formgrid">${field(
    L,
    'blockType',
    `<select name="type">${options(
      L,
      [
        ['exercise', 'exerciseBlock'],
        ['note', 'noteBlock'],
      ],
      'exercise',
    )}</select>`,
    'wk-wide',
  )}${field(L, 'blockTitle', input('blockTitle', '', 'maxlength="120"'), 'wk-wide')}${field(L, 'exercise', `<select name="exercise">${['lc', 'jerk', 'snatch'].map((e) => `<option value="${e}">${esc(L.t('tempo.ex.' + e))}</option>`).join('')}<option value="custom">${text(L, 'customExercise')}</option></select>`, 'wk-exercise-only')}${field(
    L,
    'basis',
    `<select name="basis">${options(
      L,
      [
        ['time', 'timeBasis'],
        ['reps', 'repsBasis'],
      ],
      'time',
    )}</select>`,
    'wk-exercise-only',
  )}${field(L, 'weight', input('weight', '24', 'inputmode="decimal"'), 'wk-exercise-only')}${field(L, 'bells', `<select name="bells"><option value="2">${L.num(2)}</option><option value="1">${L.num(1)}</option></select>`, 'wk-exercise-only')}${field(L, 'durationMin', input('duration', '2', 'inputmode="decimal"'))}${field(L, 'setCount', input('setCount', '5', 'inputmode="numeric"'), 'wk-exercise-only')}${field(L, 'restMin', input('rest', '2', 'inputmode="decimal"'), 'wk-exercise-only')}${field(L, 'pace', input('pace', '8', 'inputmode="decimal"'), 'wk-time-only wk-exercise-only')}${field(L, 'goal', input('goal', '16', 'inputmode="numeric"'), 'wk-reps-only wk-exercise-only')}${field(L, 'switchMin', input('handSwitch', '', 'inputmode="decimal"'), 'wk-exercise-only')}${field(L, 'instructions', '<textarea name="note" maxlength="2000"></textarea>', 'wk-wide')}<p class="wk-micro wk-wide">${text(L, 'blockHelp')}</p><p class="error wk-wide" id="wk-block-error" role="alert" hidden></p></div><div class="wk-modal-foot">${btn(L, 'cancel', 'close')}<button type="submit" class="btn">${text(L, 'saveBlock')}</button></div></form></dialog><input id="wk-import-file" type="file" accept=".json,application/json" hidden><div class="wk-toast" id="wk-toast" role="status" hidden></div></div>`;
}
function blockHead(L, w, b, i, editing = false) {
  return `<div class="wk-block-head"><span class="wk-number n">${L.num(i + 1)}</span><div><h3>${esc(blockTitle(L, b))}</h3><p class="wk-micro">${b.type === 'exercise' ? `${esc(exerciseName(L, b))} · ${text(L, 'sets', { n: L.num(b.sets.length) })} · ${L.num(b.bells)} × ${L.dec(b.weight)} ${text(L, 'kg')}` : clock(L, b.duration)}</p></div>${
    editing
      ? `<div class="wk-block-actions">${[
          ['up', '↑'],
          ['down', '↓'],
          ['edit', '✎'],
          ['remove', '×'],
        ]
          .map(
            ([k, s]) =>
              `<button type="button" class="wk-icon" data-action="${k}" data-id="${esc(b.id)}" aria-label="${text(L, k)}" title="${text(L, k)}" ${isLocked(w) || (k === 'up' && i === 0) || (k === 'down' && i === w.blocks.length - 1) ? 'disabled' : ''}>${s}</button>`,
          )
          .join('')}</div>`
      : ''
  }</div>`;
}
export function planView(L, w) {
  return `${isLocked(w) ? `<div class="wk-notice">${text(L, 'locked')}${btn(L, 'editCopy', 'edit-copy')}</div>` : ''}<div class="wk-section"><h2>${text(L, 'blocks')}</h2><p class="wk-micro">${text(L, 'blocksHint')}</p></div>${
    w.blocks
      .map(
        (b, i) =>
          `<article class="wk-block">${blockHead(L, w, b, i, true)}<div class="wk-block-body">${
            b.type === 'exercise'
              ? `<div class="wk-chips"><span>${clock(L, b.duration)} / ${text(L, 'set', { n: '—' }).replace(' —', '')}</span>${b.pace ? `<span>${text(L, 'rate', { n: L.dec(b.pace) })}</span>` : ''}${b.rest && b.sets.length > 1 ? `<span>${text(L, 'rest')} ${clock(L, b.rest)}</span>` : ''}${b.handSwitch ? `<span>${text(L, 'switch', { time: clock(L, b.handSwitch) })}</span>` : ''}</div><div class="wk-set-strip">${b.sets
                  .slice(0, 8)
                  .map(
                    (s, j) =>
                      `<div><small>${text(L, 'set', { n: L.num(j + 1) })}</small><strong class="n">${targetReps(b) === null ? '—' : L.num(targetReps(b))}</strong><small>${targetReps(b) === null ? text(L, 'open') : esc(L.plural(targetReps(b), 'reps'))}</small></div>`,
                  )
                  .join(
                    '',
                  )}</div>${b.sets.length > 8 ? `<p class="wk-micro">${text(L, 'sets', { n: L.num(b.sets.length) })}</p>` : ''}<div class="wk-block-total"><span>${clock(L, blockSeconds(b))}</span><b>${targetReps(b) === null ? text(L, 'open') : text(L, 'reps', { n: L.num(targetReps(b) * b.sets.length) })}</b></div>`
              : ''
          }${b.note ? `<p class="wk-note">${esc(b.note)}</p>` : ''}</div></article>`,
      )
      .join('') || `<p class="wk-empty">${text(L, 'empty')}</p>`
  }${btn(L, 'add', 'add', isLocked(w) ? 'disabled' : '')}${field(L, 'planNotes', `<textarea name="planNotes" maxlength="4000" ${isLocked(w) ? 'disabled' : ''}>${esc(w.notes)}</textarea>`, 'wk-notes')}`;
}
export function executionView(L, w) {
  const e = w.execution;
  return `<div class="wk-section"><h2>${text(L, 'execution')}</h2><p class="wk-micro">${text(L, 'recordHint')}</p></div><div class="wk-meta">${field(L, 'performedDate', input('executionDate', e?.date || '', 'type="date"'))}${field(
    L,
    'status',
    `<select name="executionStatus">${options(
      L,
      ['not-started', 'in-progress', 'completed'].map((s) => [s, s]),
      e?.status || 'not-started',
    )}</select>`,
  )}</div>${w.blocks
    .map(
      (b, i) =>
        `<article class="wk-block">${blockHead(L, w, b, i)}${
          b.type === 'note'
            ? `<label class="wk-note-check"><input type="checkbox" data-note-id="${esc(b.id)}" ${recordOf(w, b.id).status === 'done' ? 'checked' : ''}>${text(L, 'done')} <span class="wk-micro">${esc(b.note)}</span></label>`
            : `<div class="wk-block-body"><div class="table-wrap"><table class="wk-record-table"><thead><tr>${['set', 'plan', 'actualReps', 'duration', 'weight', 'bells', 'status'].map((k) => `<th scope="col">${k === 'set' ? text(L, k, { n: '' }) : text(L, k)}</th>`).join('')}</tr></thead><tbody>${b.sets
                .map((s, j) => {
                  const r = recordOf(w, s.id),
                    label =
                      blockTitle(L, b) +
                      ' ' +
                      L.t('workout.set', { n: L.num(j + 1) }),
                    disabled = r.status === 'skipped' ? 'disabled' : '';
                  return `<tr data-record="${esc(s.id)}" class="wk-${r.status}"><th scope="row" class="n">${L.num(j + 1)}</th><td class="wk-planned">${targetReps(b) === null ? text(L, 'open') : text(L, 'reps', { n: L.num(targetReps(b)) })}<br>${b.duration ? clock(L, b.duration) : '—'} · ${L.num(b.bells)} × ${L.dec(b.weight)} ${text(L, 'kg')}</td>${[
                    ['reps', r.reps, 'actualReps', '—'],
                    [
                      'duration',
                      r.duration === null ? '' : clock(L, r.duration),
                      'duration',
                      clock(L, b.duration),
                    ],
                    [
                      'weight',
                      r.weight === null ? '' : L.dec(r.weight),
                      'weight',
                      L.dec(b.weight),
                    ],
                  ]
                    .map(
                      ([k, v, caption, placeholder]) =>
                        `<td><input type="text" inputmode="${k === 'duration' ? 'text' : 'decimal'}" data-record-field="${k}" aria-label="${esc(label)}: ${text(L, caption)}" value="${esc(v ?? '')}" placeholder="${esc(placeholder)}" ${disabled}></td>`,
                    )
                    .join(
                      '',
                    )}<td><select data-record-field="bells" aria-label="${esc(label)}: ${text(L, 'bells')}" ${disabled}><option value="">${L.num(b.bells)}</option>${[1, 2].map((n) => `<option value="${n}" ${r.bells === n ? 'selected' : ''}>${L.num(n)}</option>`).join('')}</select></td><td><select data-record-field="status" aria-label="${esc(label)}: ${text(L, 'status')}">${options(
                    L,
                    ['pending', 'done', 'skipped'].map((s) => [s, s]),
                    r.status,
                  )}</select></td></tr><tr data-record="${esc(s.id)}"><td colspan="7"><details class="wk-set-details"><summary>${text(L, 'setNotes')} · ${text(L, 'set', { n: L.num(j + 1) })}</summary><div class="wk-detail-fields">${field(L, 'actualRest', `<input data-record-field="rest" value="${r.rest === null ? '' : clock(L, r.rest)}" placeholder="${clock(L, b.rest)}" ${disabled}>`)}${field(L, 'setNotes', `<textarea data-record-field="note" maxlength="2000">${esc(r.note)}</textarea>`)}</div></details></td></tr>`;
                })
                .join(
                  '',
                )}</tbody></table></div><p class="wk-micro">${text(L, 'recordHelp')}</p></div>`
        }</article>`,
    )
    .join(
      '',
    )}${field(L, 'sessionNotes', `<textarea name="executionNotes" maxlength="4000">${esc(e?.notes || '')}</textarea>`, 'wk-notes')}<div class="wk-actions">${btn(L, 'finish', 'finish')}${btn(L, 'reviewAction', 'review')}</div>`;
}
export function reviewView(L, w) {
  const count = summary(w);
  return `<div class="wk-section"><h2>${text(L, 'comparison')}</h2><p class="wk-micro">${text(L, 'comparisonHint')}</p></div><div class="wk-notice">${text(L, 'progress', { done: L.num(count.done), total: L.num(count.sets) })} · ${text(L, 'status')}: ${text(L, w.execution?.status || 'not-started')}</div>${w.blocks
    .filter((b) => b.type === 'exercise')
    .map((b) => {
      const c = compareBlock(w, b),
        max = Math.max(
          c.target || 0,
          ...b.sets.map((s) => recordOf(w, s.id).reps || 0),
          1,
        );
      return `<article class="wk-block"><div class="wk-block-head"><div><h3>${esc(blockTitle(L, b))} · ${esc(exerciseName(L, b))}</h3><p class="wk-micro">${L.num(b.bells)} × ${L.dec(b.weight)} ${text(L, 'kg')}</p></div></div><div class="wk-block-body"><div class="wk-chart" role="img" aria-label="${text(L, 'comparison')}: ${text(L, 'plan')} ${c.planned === null ? text(L, 'open') : L.num(c.planned)}, ${text(L, 'recorded')} ${L.num(c.actual)}">${b.sets
        .map((s, j) => {
          const r = recordOf(w, s.id);
          return `<div class="wk-chart-group"><div class="wk-bar" style="height:${((c.target || 0) / max) * 100}px"><span>${c.target === null ? '—' : L.num(c.target)}</span></div><div class="wk-bar wk-fact ${r.status === 'skipped' ? 'wk-skipped' : ''}" style="height:${r.status === 'done' ? ((r.reps || 0) / max) * 100 : 2}px"><span>${r.status === 'skipped' ? '×' : r.status === 'done' && r.reps !== null ? L.num(r.reps) : '—'}</span></div><small>${L.num(j + 1)}</small></div>`;
        })
        .join(
          '',
        )}</div><div class="wk-legend"><span>${text(L, 'plan')}</span><span>${text(L, 'execution')}</span></div><div class="wk-block-total"><span>${text(L, 'plan')}: <b>${c.planned === null ? text(L, 'open') : text(L, 'reps', { n: L.num(c.planned) })}</b></span><span>${text(L, 'recorded')}: <b>${text(L, 'reps', { n: L.num(c.actual) })}</b></span></div><p class="wk-micro">${c.known && c.delta !== null ? text(L, 'delta', { n: (c.delta > 0 ? '+' : '') + L.num(c.delta) }) : text(L, 'noFacts')}</p>${c.changedEquipment ? `<p class="wk-notice">${text(L, 'equipmentChanged')}</p>` : ''}</div></article>`;
    })
    .join(
      '',
    )}<p class="wk-note">${esc(w.execution?.notes || L.t('workout.noNotes'))}</p><div class="wk-actions">${btn(L, 'share', 'share-all')}${btn(L, 'repeat', 'repeat')}</div>`;
}
export function summaryView(L, w) {
  const s = summary(w),
    reps = new Map();
  for (const b of w.blocks.filter((b) => b.type === 'exercise')) {
    const name = exerciseName(L, b),
      n = targetReps(b);
    const previous = reps.get(name);
    reps.set(
      name,
      n === null || previous === null
        ? null
        : (previous || 0) + n * b.sets.length,
    );
  }
  return `<h2>${text(L, 'summary')}</h2><div class="wk-total"><strong class="n">${L.dec(s.seconds / 60)}</strong><span>${text(L, 'plannedMinutes')}</span></div>${s.untimed ? `<p class="wk-micro">${text(L, 'untimed')}</p>` : ''}<div class="wk-summary-stats"><b class="n">${L.num(s.sets)}</b><span>${text(L, 'sets', { n: '' })}</span><b class="n">${L.num(w.blocks.length)}</b><span>${text(L, 'blocks')}</span></div><h3>${text(L, 'plannedReps')}</h3>${[...reps].map(([name, n]) => `<p class="wk-exercise-total"><span>${esc(name)}</span><b class="n">${n === null ? text(L, 'open') : L.num(n)}</b></p>`).join('')}<p class="wk-micro">${text(L, 'progress', { done: L.num(s.done), total: L.num(s.sets) })}</p>${btn(L, 'recordAction', 'execution')}${btn(L, 'repeat', 'repeat')}`;
}
