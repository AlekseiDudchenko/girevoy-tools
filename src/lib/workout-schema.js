import { FORMAT, VERSION, exerciseSets } from './workout.js';
export const MAX_BYTES = 250000;
export class WorkoutError extends Error {
  constructor(code = 'invalid') {
    super(code);
    this.code = code;
  }
}
const fail = () => {
  throw new WorkoutError();
};
const text = (x, max = 4000) => {
  if (typeof x !== 'string' || x.length > max) fail();
  return x;
};
const id = (x) => {
  if (
    typeof x !== 'string' ||
    ['__proto__', 'constructor', 'prototype'].includes(x) ||
    !/^[\w-]{1,100}$/.test(x)
  )
    fail();
  return x;
};
const num = (x, min, max, integer = false) => {
  if (
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    x < min ||
    x > max ||
    (integer && !Number.isInteger(x))
  )
    fail();
  return x;
};
const date = (x) => {
  text(x, 10);
  if (x === '') return x;
  const d = new Date(x + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(x) ||
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== x
  )
    fail();
  return x;
};
const nullable = (x, ...args) => (x === null ? null : num(x, ...args));
export function validateWorkout(v) {
  if (!v || v.format !== FORMAT) fail();
  if (v.schemaVersion !== VERSION) throw new WorkoutError('version');
  if (!Array.isArray(v.blocks) || v.blocks.length > 30) fail();
  const w = {
    format: FORMAT,
    schemaVersion: VERSION,
    id: id(v.id),
    planId: id(v.planId),
    planRevision: num(v.planRevision, 1, 100000, true),
    title: text(v.title, 120),
    date: date(v.date),
    athlete: text(v.athlete, 100),
    coach: text(v.coach, 100),
    notes: text(v.notes),
    blocks: [],
    execution: null,
    updatedAt: text(v.updatedAt, 100),
  };
  const ids = new Set();
  const unique = (x) => {
    id(x);
    if (ids.has(x)) fail();
    ids.add(x);
    return x;
  };
  for (const x of v.blocks) {
    if (!x || !['note', 'exercise'].includes(x.type)) fail();
    const b = {
      id: unique(x.id),
      type: x.type,
      title: text(x.title, 120),
      label: text(x.label || '', 30),
      duration: num(x.duration, 0, 10800, true),
      note: text(x.note, 2000),
    };
    if (!['', 'warmup', 'main', 'finisher', 'cooldown'].includes(b.label))
      fail();
    if (b.type === 'exercise') {
      if (
        !['lc', 'jerk', 'snatch', 'custom'].includes(x.exercise) ||
        !['time', 'reps'].includes(x.basis) ||
        !Array.isArray(x.sets) ||
        x.sets.length < 1 ||
        x.sets.length > 30
      )
        fail();
      Object.assign(b, {
        exercise: x.exercise,
        basis: x.basis,
        weight: num(x.weight, 1, 100),
        bells: num(x.bells, 1, 2, true),
        rest: num(x.rest, 0, 3600, true),
        pace: num(x.pace, 0, 100),
        goal: num(x.goal, 0, 5000, true),
        handSwitch: num(x.handSwitch, 0, 10800, true),
        sets: x.sets.map((s) => ({ id: unique(s.id) })),
      });
      if (
        (b.basis === 'time' && !b.duration) ||
        (b.basis === 'reps' && !b.goal) ||
        (b.handSwitch && b.handSwitch >= b.duration)
      )
        fail();
    }
    w.blocks.push(b);
  }
  if (v.execution !== null) {
    const e = v.execution;
    if (
      !e ||
      !['not-started', 'in-progress', 'completed'].includes(e.status) ||
      !e.records ||
      typeof e.records !== 'object' ||
      Array.isArray(e.records) ||
      e.planId !== w.planId ||
      e.planRevision !== w.planRevision
    )
      fail();
    w.execution = {
      id: id(e.id),
      planId: w.planId,
      planRevision: w.planRevision,
      date: date(e.date),
      status: e.status,
      notes: text(e.notes),
      records: {},
    };
    const allowed = new Set(
      w.blocks.flatMap((b) =>
        b.type === 'note' ? [b.id] : b.sets.map((s) => s.id),
      ),
    );
    for (const [k, r] of Object.entries(e.records)) {
      if (
        !allowed.has(k) ||
        !r ||
        !['pending', 'done', 'skipped'].includes(r.status)
      )
        fail();
      const record = {
        status: r.status,
        reps: nullable(r.reps, 0, 5000, true),
        duration: nullable(r.duration, 0, 10800, true),
        weight: nullable(r.weight, 1, 100),
        bells: nullable(r.bells, 1, 2, true),
        rest: nullable(r.rest, 0, 3600, true),
        note: text(r.note, 2000),
      };
      if (
        record.status !== 'done' &&
        ['reps', 'duration', 'weight', 'bells', 'rest'].some(
          (f) => record[f] !== null,
        )
      )
        fail();
      w.execution.records[k] = record;
    }
    if (
      e.status === 'not-started' &&
      Object.values(w.execution.records).some((r) => r.status !== 'pending')
    )
      fail();
    if (
      e.status === 'completed' &&
      (exerciseSets(w).length === 0 ||
        exerciseSets(w).some(
          (s) =>
            !w.execution.records[s.id] ||
            w.execution.records[s.id].status === 'pending',
        ))
    )
      fail();
  }
  return w;
}
// Import files exported by the interface prototype before the stable schema.
export function migratePrototype(v) {
  if (v?.format !== FORMAT || v.version !== 1 || v.schemaVersion !== undefined)
    return v;
  if (!Array.isArray(v.blocks) || v.blocks.length > 30) fail();
  const records = {};
  const blocks = v.blocks.map((x) => {
    if (!x || !['note', 'series'].includes(x.type)) fail();
    const b = {
      ...x,
      label: '',
      type: x.type === 'series' ? 'exercise' : 'note',
    };
    if (x.type === 'series') {
      const count = num(x.sets, 1, 30, true);
      b.exercise = x.exercise === 'long-cycle' ? 'lc' : x.exercise;
      b.sets = Array.from({ length: count }, (_, i) => ({
        id: `${id(x.id)}-set-${i + 1}`,
      }));
    }
    for (let i = 0; i < (b.type === 'note' ? 1 : b.sets.length); i++) {
      const r = v.execution?.records?.[`${x.id}:${i}`];
      if (r) {
        const k = b.type === 'note' ? b.id : b.sets[i].id;
        records[k] = { ...r, rest: r.rest ?? null, note: r.note || '' };
      }
    }
    return b;
  });
  return {
    ...v,
    schemaVersion: VERSION,
    planId: v.id,
    planRevision: 1,
    blocks,
    execution: v.execution
      ? {
          ...v.execution,
          id: 'prototype-execution-' + id(v.id),
          planId: v.id,
          planRevision: 1,
          records,
        }
      : null,
  };
}
export function parseWorkoutJSON(raw) {
  if (new TextEncoder().encode(raw).length > MAX_BYTES)
    throw new WorkoutError('size');
  try {
    return validateWorkout(migratePrototype(JSON.parse(raw)));
  } catch (e) {
    if (e instanceof WorkoutError) throw e;
    throw new WorkoutError();
  }
}
