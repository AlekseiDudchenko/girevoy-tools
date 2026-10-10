export const FORMAT = 'vsegiri-workout';
export const VERSION = 1;
export const newId = () => globalThis.crypto.randomUUID();
export const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const newExecution = (planId, revision, date = localDate()) => ({
  id: newId(),
  planId,
  planRevision: revision,
  date,
  status: 'not-started',
  notes: '',
  records: {},
});
export function newWorkout(date = localDate()) {
  const id = newId();
  return {
    format: FORMAT,
    schemaVersion: VERSION,
    id,
    planId: newId(),
    planRevision: 1,
    title: '',
    date,
    athlete: '',
    coach: '',
    notes: '',
    blocks: [],
    execution: null,
    updatedAt: new Date().toISOString(),
  };
}
export function exampleWorkout() {
  const w = newWorkout('');
  w.blocks = [
    {
      id: 'warmup',
      type: 'note',
      title: '',
      label: 'warmup',
      duration: 360,
      note: '',
    },
    {
      id: 'main',
      type: 'exercise',
      title: '',
      label: 'main',
      exercise: 'lc',
      basis: 'time',
      weight: 24,
      bells: 2,
      duration: 120,
      rest: 120,
      pace: 8,
      goal: 16,
      handSwitch: 0,
      note: '',
      sets: Array.from({ length: 5 }, (_, i) => ({ id: `main-set-${i + 1}` })),
    },
    {
      id: 'finisher',
      type: 'exercise',
      title: '',
      label: 'finisher',
      exercise: 'snatch',
      basis: 'time',
      weight: 16,
      bells: 1,
      duration: 240,
      rest: 0,
      pace: 16,
      goal: 64,
      handSwitch: 120,
      note: '',
      sets: [{ id: 'finisher-set-1' }],
    },
    {
      id: 'cooldown',
      type: 'note',
      title: '',
      label: 'cooldown',
      duration: 300,
      note: '',
    },
  ];
  return w;
}
export const targetReps = (b) =>
  b.basis === 'reps'
    ? b.goal
    : b.pace
      ? Math.round((b.duration * b.pace) / 60)
      : null;
export const blockSeconds = (b) =>
  b.type === 'note'
    ? b.duration
    : b.duration * b.sets.length + b.rest * Math.max(0, b.sets.length - 1);
export const exerciseSets = (w) =>
  w.blocks.filter((b) => b.type === 'exercise').flatMap((b) => b.sets);
export const recordOf = (w, id) =>
  (w.execution && Object.hasOwn(w.execution.records, id)
    ? w.execution.records[id]
    : null) || {
    status: 'pending',
    reps: null,
    duration: null,
    weight: null,
    bells: null,
    rest: null,
    note: '',
  };
export const isLocked = (w) =>
  !!w.execution &&
  (w.execution.status !== 'not-started' ||
    !!w.execution.notes ||
    Object.values(w.execution.records).some((r) => r.status !== 'pending' || !!r.note));
export function summary(w) {
  const blocks = w.blocks.filter((b) => b.type === 'exercise');
  return {
    seconds: w.blocks.reduce((a, b) => a + blockSeconds(b), 0),
    sets: exerciseSets(w).length,
    untimed: blocks.some((b) => !b.duration),
    done: exerciseSets(w).filter((s) => recordOf(w, s.id).status === 'done')
      .length,
    skipped: exerciseSets(w).filter(
      (s) => recordOf(w, s.id).status === 'skipped',
    ).length,
  };
}
export function compareBlock(w, b) {
  const rows = b.sets.map((s) => recordOf(w, s.id)),
    known = rows.filter((r) => r.status === 'done' && r.reps !== null),
    target = targetReps(b);
  return {
    target,
    planned: target === null ? null : target * b.sets.length,
    actual: known.reduce((a, r) => a + r.reps, 0),
    known: known.length,
    delta:
      target === null ? null : known.reduce((a, r) => a + r.reps - target, 0),
    changedEquipment: rows.some(
      (r) =>
        r.status === 'done' &&
        ((r.weight !== null && r.weight !== b.weight) ||
          (r.bells !== null && r.bells !== b.bells)),
    ),
  };
}
export function ensureExecution(w) {
  w.execution ||= newExecution(w.planId, w.planRevision);
  return w.execution;
}
export function updateRecord(w, id, patch) {
  if (
    !w.blocks.some((b) =>
      b.type === 'exercise' ? b.sets.some((s) => s.id === id) : b.id === id,
    )
  )
    throw new Error('record');
  const e = ensureExecution(w),
    r = { ...recordOf(w, id), ...patch };
  if (r.status !== 'done')
    Object.assign(r, {
      reps: null,
      duration: null,
      weight: null,
      bells: null,
      rest: null,
    });
  e.records[id] = r;
  if (r.status !== 'pending' && e.status === 'not-started')
    e.status = 'in-progress';
  if (r.status === 'pending' && e.status === 'completed')
    e.status = 'in-progress';
  return r;
}
export function canFinish(w) {
  return (
    exerciseSets(w).length > 0 &&
    exerciseSets(w).every((s) => recordOf(w, s.id).status !== 'pending')
  );
}
export function cloneWorkout(w, editPlan = false) {
  const copy = structuredClone(w);
  copy.id = newId();
  if (editPlan) {
    copy.planId = newId();
    copy.planRevision = 1;
  }
  copy.execution = null;
  copy.date = localDate();
  copy.updatedAt = new Date().toISOString();
  return copy;
}
export function snapshot(w, scope = 'all') {
  const copy = structuredClone(w);
  if (scope === 'plan') copy.execution = null;
  return copy;
}
export function resizeSets(block, count) {
  return Array.from(
    { length: count },
    (_, i) => block.sets?.[i] || { id: newId() },
  );
}
