import { pageLocale, syncLangLinks } from './page.js';
import {
  newWorkout,
  exampleWorkout,
  newId,
  localDate,
  isLocked,
  ensureExecution,
  updateRecord,
  recordOf,
  resizeSets,
  canFinish,
  cloneWorkout,
} from './lib/workout.js';
import {
  validateWorkout,
  parseWorkoutJSON,
  MAX_BYTES,
} from './lib/workout-schema.js';
import {
  workoutShell,
  planView,
  executionView,
  reviewView,
  summaryView,
  clock,
  workoutTitle,
  blockTitle,
} from './lib/workout-view.js';
import {
  workoutLink,
  encodeWorkout,
  decodeWorkout,
} from './lib/workout-share.js';
import { workoutJSON, workoutTXT } from './lib/workout-export.js';
import { openWorkoutStore } from './lib/workout-storage.js';
import { parseNumber } from './lib/format.js';
import { esc } from './lib/workout-html.js';
const L = await pageLocale(),
  t = (k, args) => L.t('workout.' + k, args),
  $ = (id) => document.getElementById(id);
let w = exampleWorkout(),
  mode = 'plan',
  store = null,
  ready = false,
  editId = null,
  saveTimer,
  chain = Promise.resolve(),
  shareGeneration = 0,
  urlGeneration = 0,
  toastTimer,
  exportOnly = false;
$('workout').inert = true;
const message = (key, args) => {
  clearTimeout(toastTimer);
  $('wk-toast').textContent = t(key, args);
  $('wk-toast').hidden = false;
  toastTimer = setTimeout(() => ($('wk-toast').hidden = true), 4500);
};
const error = (e) => message('error.' + (e?.code || 'invalid'));
function syncHeader() {
  for (const name of ['title', 'date', 'athlete', 'coach']) {
    const el = document.querySelector(`#workout .wk-header [name="${name}"]`);
    el.disabled = isLocked(w);
    if (document.activeElement !== el) el.value = w[name];
  }
}
function render() {
  syncHeader();
  $('wk-panel').innerHTML =
    mode === 'plan'
      ? planView(L, w)
      : mode === 'execution'
        ? executionView(L, w)
        : reviewView(L, w);
  $('wk-panel').setAttribute('aria-labelledby', 'wk-tab-' + mode);
  for (const m of ['plan', 'execution', 'review']) {
    const el = $('wk-tab-' + m);
    el.setAttribute('aria-selected', String(m === mode));
    el.tabIndex = m === mode ? 0 : -1;
  }
  renderSide();
}
async function renderSide() {
  $('wk-summary').innerHTML = summaryView(L, w);
  if (!store) return;
  try {
    const rows = await store.list();
    $('wk-library').innerHTML = rows
      .slice(0, 20)
      .map(
        (x) =>
          `<div class="wk-saved-row"><button type="button" data-action="load" data-id="${esc(x.id)}"><strong>${esc(workoutTitle(L, x))}</strong><small>${esc(x.date || '—')} · ${textStatus(x)}</small></button><button type="button" class="wk-icon" data-action="delete" data-id="${esc(x.id)}" aria-label="${esc(t('remove'))}">×</button></div>`,
      )
      .join('');
  } catch {
    storageFailed();
  }
}
function textStatus(x) {
  return esc(t(x.execution?.status || 'not-started'));
}
function storageFailed() {
  $('wk-save-status').textContent = t('storageFailed');
  $('wk-storage-hint').textContent = t('storageFailed');
}
function queueSave() {
  if (!store) {
    storageFailed();
    return Promise.resolve();
  }
  const copy = structuredClone(w);
  chain = chain
    .catch(() => {})
    .then(() => store.save(copy))
    .then(() => {
      if (w.id === copy.id) $('wk-save-status').textContent = t('saved');
      try {
        localStorage.setItem('vsegiri-workout-last', copy.id);
      } catch {}
      renderSide();
    })
    .catch(storageFailed);
  return chain;
}
async function flush() {
  clearTimeout(saveTimer);
  await queueSave();
}
async function updateLanguageLinks() {
  const generation = ++urlGeneration,
    id = w.id;
  try {
    const encoded = await encodeWorkout(w);
    if (generation !== urlGeneration || id !== w.id) return;
    const hash = '#data=' + encoded;
    syncLangLinks();
    for (const a of document.querySelectorAll('a[data-lang]')) a.hash = hash;
  } catch {
    syncLangLinks();
  }
}
function changed(plan = false) {
  if (plan) {
    w.planRevision++;
    w.execution = null;
  }
  w.updatedAt = new Date().toISOString();
  $('wk-save-status').textContent = t('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    queueSave();
    updateLanguageLinks();
  }, 350);
  $('wk-summary').innerHTML = summaryView(L, w);
  syncHeader();
}
async function sharedCopy(next) {
  const saved = await store?.load(next.id);
  if (!saved || JSON.stringify(validateWorkout(saved)) !== JSON.stringify(next))
    next.id = newId();
  return next;
}
async function selectWorkout(next) {
  await flush();
  w = validateWorkout(next);
  mode = 'plan';
  $('workout').outerHTML = workoutShell(L, w);
  render();
  changed();
  await updateLanguageLinks();
}
async function addCopy(kind) {
  const copy = cloneWorkout(w, kind === 'edit-copy');
  if (!copy.title) copy.title = workoutTitle(L, w);
  await selectWorkout(copy);
  message(kind === 'edit-copy' ? 'copiedPlan' : 'repeated');
}
function openBlock(id) {
  editId = id;
  const f = $('wk-block-form');
  f.reset();
  const b = w.blocks.find((b) => b.id === id);
  if (b) {
    for (const k of [
      'type',
      'exercise',
      'basis',
      'weight',
      'bells',
      'pace',
      'goal',
      'note',
    ])
      if (f.elements[k])
        f.elements[k].value =
          typeof b[k] === 'number' ? L.dec(b[k]) : b[k] || '';
    f.elements.blockTitle.value = blockTitle(L, b);
    for (const k of ['duration', 'rest', 'handSwitch'])
      f.elements[k].value = b[k] ? L.dec(b[k] / 60) : '';
    f.elements.setCount.value = b.sets?.length || 1;
  }
  $('wk-block-error').hidden = true;
  syncBlockForm();
  $('wk-block').showModal();
}
function syncBlockForm() {
  const f = $('wk-block-form'),
    note = f.elements.type.value === 'note';
  for (const el of f.querySelectorAll('.wk-exercise-only')) {
    el.hidden = note;
    el.querySelectorAll('input,select').forEach((i) => (i.disabled = note));
  }
  for (const [cls, show] of [
    ['wk-time-only', !note && f.elements.basis.value === 'time'],
    ['wk-reps-only', !note && f.elements.basis.value === 'reps'],
  ])
    for (const el of f.querySelectorAll('.' + cls)) {
      el.hidden = !show;
      el.querySelectorAll('input,select').forEach((i) => (i.disabled = !show));
    }
}
function saveBlock(e) {
  e.preventDefault();
  if (isLocked(w)) return;
  const f = e.target,
    read = (k) => f.elements[k]?.value.trim() || '',
    n = (k, defaultValue = 0) =>
      read(k) === '' ? defaultValue : parseNumber(read(k)),
    existing = w.blocks.find((b) => b.id === editId);
  try {
    const b = {
      id: editId || newId(),
      type: read('type'),
      title: read('blockTitle'),
      label: '',
      duration: Math.round(n('duration') * 60),
      note: read('note'),
    };
    if (b.type === 'exercise') {
      const count = n('setCount', 1);
      if (!Number.isInteger(count) || count < 1 || count > 30)
        throw new Error();
      Object.assign(b, {
        exercise: read('exercise'),
        basis: read('basis'),
        weight: n('weight'),
        bells: n('bells'),
        rest: Math.round(n('rest') * 60),
        pace: read('basis') === 'time' ? n('pace') : 0,
        goal: read('basis') === 'reps' ? n('goal') : 0,
        handSwitch: Math.round(n('handSwitch') * 60),
        sets: resizeSets(existing || {}, count),
      });
    }
    const copy = structuredClone(w);
    copy.execution = null;
    if (editId) copy.blocks[copy.blocks.findIndex((x) => x.id === editId)] = b;
    else copy.blocks.push(b);
    w = validateWorkout(copy);
    $('wk-block').close();
    render();
    changed(true);
  } catch {
    $('wk-block-error').textContent = t('error.invalid');
    $('wk-block-error').hidden = false;
  }
}
function parseTime(raw) {
  if (!raw.trim()) return null;
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(raw.trim());
  if (!match || Number(match[1]) * 60 + Number(match[2]) > 10800) {
    const e = new Error();
    e.code = 'time';
    throw e;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}
function recordChanged(el) {
  const row = el.closest('[data-record]'),
    id = row.dataset.record,
    field = el.dataset.recordField,
    prior = recordOf(w, id),
    copy = structuredClone(w);
  let value = el.value;
  try {
    if (field === 'duration' || field === 'rest') value = parseTime(value);
    else if (!['note', 'status'].includes(field))
      value = value.trim() === '' ? null : parseNumber(value);
    const patch = { [field]: value };
    if (!['note', 'status'].includes(field) && value !== null)
      patch.status = 'done';
    updateRecord(copy, id, patch);
    w = validateWorkout(copy);
    changed();
    if (field === 'status') {
      render();
    } else {
      const main = $('wk-panel').querySelector(
        `tr[data-record="${CSS.escape(id)}"]`,
      );
      main.className = 'wk-' + recordOf(w, id).status;
      main.querySelector('[data-record-field="status"]').value = recordOf(
        w,
        id,
      ).status;
      const status = document.querySelector('[name="executionStatus"]');
      status.value = w.execution.status;
    }
  } catch (e) {
    if (field === 'duration' || field === 'rest')
      el.value = prior[field] === null ? '' : clock(L, prior[field]);
    else el.value = prior[field] === null ? '' : String(prior[field]);
    error(e);
  }
}
async function openShare(
  onlyExport = false,
  scope = mode === 'plan' ? 'plan' : 'all',
) {
  clearTimeout(saveTimer);
  await flush();
  exportOnly = onlyExport;
  $('wk-share-title').textContent = t(
    onlyExport ? 'exportTitle' : 'shareTitle',
  );
  document.querySelector(`input[name="scope"][value="${scope}"]`).checked =
    true;
  $('wk-link-area').hidden = onlyExport;
  $('wk-share').showModal();
  if (!onlyExport) refreshShare();
}
async function refreshShare() {
  const generation = ++shareGeneration,
    button = $('wk-share').querySelector('[data-action="copy-link"]');
  button.disabled = true;
  $('wk-link').value = '';
  try {
    const scope = document.querySelector('[name="scope"]:checked').value,
      url = await workoutLink(w, scope, location.href);
    if (generation !== shareGeneration) return;
    $('wk-link').value = url;
    button.disabled = false;
    $('wk-link-warning').hidden = url.length < 12000;
  } catch (e) {
    error(e);
  }
}
function download(kind) {
  try {
    const scope = document.querySelector('[name="scope"]:checked').value,
      body = kind === 'json' ? workoutJSON(w, scope) : workoutTXT(L, w, scope),
      url = URL.createObjectURL(
        new Blob([body], {
          type:
            kind === 'json'
              ? 'application/json;charset=utf-8'
              : 'text/plain;charset=utf-8',
        }),
      ),
      a = document.createElement('a');
    a.href = url;
    a.download = `vsegiri-workout-${w.date || 'session'}-${scope}.${kind}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('downloaded');
  } catch (e) {
    error(e);
  }
}
async function importFile(file) {
  if (!file) return;
  try {
    if (file.size > MAX_BYTES) {
      const e = new Error();
      e.code = 'size';
      throw e;
    }
    const next = parseWorkoutJSON(await file.text());
    next.id = newId();
    await selectWorkout(next);
    message('imported');
  } catch (e) {
    error(e);
  }
}
async function action(a, id) {
  if (['add', 'edit', 'up', 'down', 'remove'].includes(a) && isLocked(w))
    return;
  if (a === 'add' || a === 'edit') {
    if (a === 'add' && w.blocks.length >= 30) {
      message('error.limit');
      return;
    }
    openBlock(a === 'edit' ? id : null);
    return;
  }
  if (['plan', 'execution', 'review'].includes(a)) {
    mode = a;
    if (a === 'execution') ensureExecution(w);
    render();
    return;
  }
  if (['edit-copy', 'repeat'].includes(a)) {
    await addCopy(a);
    return;
  }
  if (a === 'share' || a === 'share-all' || a === 'export') {
    await openShare(a === 'export', a === 'share-all' ? 'all' : undefined);
    return;
  }
  if (a === 'json' || a === 'txt') {
    download(a);
    return;
  }
  if (a === 'close') {
    document.querySelector('dialog[open]')?.close();
    return;
  }
  if (a === 'copy-link') {
    try {
      await navigator.clipboard.writeText($('wk-link').value);
      message('copied');
    } catch {
      $('wk-link').focus();
      $('wk-link').select();
      message('copyFallback');
    }
    return;
  }
  if (a === 'import') {
    $('wk-import-file').click();
    return;
  }
  if (a === 'new' || a === 'example') {
    const next = a === 'new' ? newWorkout() : exampleWorkout();
    next.date = localDate();
    if (a === 'example') {
      next.title = t('example.title');
      next.notes = t('example.notes');
    }
    await selectWorkout(next);
    return;
  }
  if (a === 'load') {
    await flush();
    const item = await store?.load(id);
    if (item) await selectWorkout(validateWorkout(item));
    return;
  }
  if (a === 'delete') {
    if (!confirm(t('deleteSession'))) return;
    await flush();
    await store.remove(id);
    if (id === w.id) {
      w = newWorkout();
      mode = 'plan';
      $('workout').outerHTML = workoutShell(L, w);
      render();
      changed();
    } else renderSide();
    message('deleted');
    return;
  }
  if (a === 'finish') {
    if (!canFinish(w)) {
      message('error.pending');
      return;
    }
    ensureExecution(w).status = 'completed';
    mode = 'review';
    render();
    changed();
    message('finished');
    return;
  }
  const i = w.blocks.findIndex((b) => b.id === id);
  if (a === 'remove' && i >= 0) {
    const b = w.blocks[i];
    for (const k of b.type === 'note' ? [b.id] : b.sets.map((s) => s.id))
      if (w.execution) delete w.execution.records[k];
    w.blocks.splice(i, 1);
  } else if (a === 'up' && i > 0)
    [w.blocks[i - 1], w.blocks[i]] = [w.blocks[i], w.blocks[i - 1]];
  else if (a === 'down' && i >= 0 && i < w.blocks.length - 1)
    [w.blocks[i], w.blocks[i + 1]] = [w.blocks[i + 1], w.blocks[i]];
  else return;
  render();
  changed(true);
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('#workout [data-action]');
  if (!ready || !el || el.disabled) return;
  action(el.dataset.action, el.dataset.id).catch(error);
});
document.addEventListener('click', (e) => {
  const tab = e.target.closest('#workout [data-mode]');
  if (ready && tab) {
    mode = tab.dataset.mode;
    if (mode === 'execution') ensureExecution(w);
    render();
  }
});
document.addEventListener('keydown', (e) => {
  if (
    !ready ||
    !e.target.closest('.wk-tabs') ||
    !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)
  )
    return;
  e.preventDefault();
  const modes = ['plan', 'execution', 'review'],
    i = modes.indexOf(mode);
  mode =
    e.key === 'Home'
      ? 'plan'
      : e.key === 'End'
        ? 'review'
        : modes[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
  if (mode === 'execution') ensureExecution(w);
  render();
  $('wk-tab-' + mode).focus();
});
document.addEventListener('submit', (e) => {
  if (e.target.id === 'wk-block-form') saveBlock(e);
});
document.addEventListener('input', (e) => {
  if (!ready || !e.target.closest('#workout')) return;
  const el = e.target,
    n = el.name;
  if (['title', 'date', 'athlete', 'coach', 'planNotes'].includes(n)) {
    if (isLocked(w)) return;
    w[n === 'planNotes' ? 'notes' : n] = el.value;
    changed(true);
  } else if (n === 'executionNotes') {
    ensureExecution(w).notes = el.value;
    changed();
  }
});
document.addEventListener('change', (e) => {
  if (!ready || !e.target.closest('#workout')) return;
  const el = e.target;
  if (el.closest('#wk-block-form')) {
    if (el.name === 'type' || el.name === 'basis') syncBlockForm();
    return;
  }
  if (el.dataset.recordField) {
    recordChanged(el);
    return;
  }
  if (el.dataset.noteId) {
    updateRecord(w, el.dataset.noteId, {
      status: el.checked ? 'done' : 'pending',
    });
    changed();
    return;
  }
  if (el.name === 'executionDate') {
    ensureExecution(w).date = el.value;
    changed();
  } else if (el.name === 'executionStatus') {
    if (el.value === 'completed' && !canFinish(w)) {
      message('error.pending');
      el.value = w.execution?.status || 'not-started';
      return;
    }
    const copy = structuredClone(w);
    ensureExecution(copy).status = el.value;
    try {
      w = validateWorkout(copy);
      render();
      changed();
    } catch (e) {
      el.value = w.execution?.status || 'not-started';
      error(e);
    }
  } else if (el.name === 'scope' && !exportOnly) refreshShare();
  else if (el.id === 'wk-import-file') {
    importFile(el.files[0]);
    el.value = '';
  }
});
document.addEventListener('visibilitychange', () => {
  if (ready && document.visibilityState === 'hidden') {
    flush();
    updateLanguageLinks();
  }
});
window.addEventListener('hashchange', async () => {
  if (!ready || !location.hash.startsWith('#data=')) return;
  try {
    const next = await sharedCopy(await decodeWorkout(location.hash.slice(6)));
    history.replaceState(null, '', location.pathname + location.search);
    await selectWorkout(next);
    message('shared');
  } catch (e) {
    error(e);
  }
});
try {
  store = await openWorkoutStore();
  let last;
  try {
    last = localStorage.getItem('vsegiri-workout-last');
  } catch {}
  if (last) {
    const saved = await store.load(last);
    if (saved) w = validateWorkout(saved);
  }
} catch {
  store = null;
}
if (location.hash.startsWith('#data=')) {
  try {
    w = await sharedCopy(await decodeWorkout(location.hash.slice(6)));
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {
    setTimeout(() => error(e), 0);
  }
}
if (!w.date) w.date = localDate();
if (!w.title && w.blocks.some((b) => b.label === 'main'))
  w.title = t('example.title');
$('workout').outerHTML = workoutShell(L, w);
ready = true;
render();
if (!store) storageFailed();
else await queueSave();
syncLangLinks();
await updateLanguageLinks();
