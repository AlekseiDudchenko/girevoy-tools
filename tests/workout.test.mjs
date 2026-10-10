import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  exampleWorkout,
  cloneWorkout,
  targetReps,
  summary,
  updateRecord,
  recordOf,
  compareBlock,
  resizeSets,
  snapshot,
  isLocked,
  canFinish,
} from '../src/lib/workout.js';
import {
  validateWorkout,
  parseWorkoutJSON,
  MAX_BYTES,
} from '../src/lib/workout-schema.js';
import {
  encodeWorkout,
  decodeWorkout,
  workoutLink,
} from '../src/lib/workout-share.js';
import { workoutJSON, workoutTXT } from '../src/lib/workout-export.js';
import {
  planView,
  executionView,
  reviewView,
} from '../src/lib/workout-view.js';
import { locale } from '../src/i18n/index.js';

test('five timed sets have four rests, example duration is 33 minutes, reps stay per exercise', () => {
  const w = exampleWorkout();
  assert.equal(summary(w).seconds, 1980);
  assert.equal(summary(w).sets, 6);
  assert.equal(targetReps(w.blocks[1]), 16);
  assert.equal(targetReps(w.blocks[2]), 64);
  const b = { ...w.blocks[1], basis: 'reps', goal: 20, duration: 0 };
  assert.equal(targetReps(b), 20);
  assert.equal(targetReps({ ...b, basis: 'time', pace: 0 }), null);
});
test('zero, pending, skipped and missing reps remain distinct; comparison excludes unknown sets', () => {
  const w = exampleWorkout(),
    b = w.blocks[1];
  updateRecord(w, b.sets[0].id, { status: 'done', reps: 0 });
  updateRecord(w, b.sets[1].id, { status: 'skipped' });
  updateRecord(w, b.sets[2].id, { status: 'done', duration: 120, weight: 20 });
  assert.equal(recordOf(w, b.sets[3].id).status, 'pending');
  const c = compareBlock(w, b);
  assert.equal(c.known, 1);
  assert.equal(c.actual, 0);
  assert.equal(c.delta, -16);
  assert.equal(c.changedEquipment, true);
  assert.equal(summary(w).done, 2);
  assert.equal(summary(w).skipped, 1);
  assert.equal(isLocked(w), true);
  assert.equal(canFinish(w), false);
  validateWorkout(w);
});
test('set identity survives reordering and resizing; repeated log preserves plan lineage', () => {
  const w = exampleWorkout(),
    b = w.blocks[1],
    set = b.sets[0].id;
  updateRecord(w, set, { status: 'done', reps: 15 });
  w.blocks.reverse();
  assert.equal(recordOf(w, set).reps, 15);
  assert.equal(resizeSets(b, 7)[0].id, set);
  const repeated = cloneWorkout(w);
  assert.equal(repeated.planId, w.planId);
  assert.notEqual(repeated.id, w.id);
  assert.equal(repeated.execution, null);
  const edited = cloneWorkout(w, true);
  assert.notEqual(edited.planId, w.planId);
  assert.deepEqual(edited.blocks, w.blocks);
});
test('plan-only export is a snapshot and never clears original execution', () => {
  const w = exampleWorkout();
  updateRecord(w, w.blocks[1].sets[0].id, { status: 'done', reps: 16 });
  const plan = JSON.parse(workoutJSON(w, 'plan'));
  assert.equal(plan.execution, null);
  assert.equal(w.execution.records[w.blocks[1].sets[0].id].reps, 16);
  assert.deepEqual(parseWorkoutJSON(workoutJSON(w)), w);
  assert.equal(snapshot(w, 'plan').execution, null);
});
test('compressed and uncompressed Unicode links round trip with equipment, rest and notes', async () => {
  const w = exampleWorkout();
  w.athlete = 'Алексей — Weiß';
  w.notes = '<img src=x onerror=alert(1)>';
  updateRecord(w, w.blocks[1].sets[0].id, {
    status: 'done',
    reps: 15,
    weight: 20,
    bells: 1,
    rest: 135,
    note: 'Легко',
  });
  assert.deepEqual(await decodeWorkout(await encodeWorkout(w)), w);
  assert.deepEqual(
    await decodeWorkout(
      'j.' + Buffer.from(JSON.stringify(w)).toString('base64url'),
    ),
    w,
  );
  const url = await workoutLink(
    w,
    'plan',
    'https://tools.vsegiri.com/en/workout/?ignored=1#old',
  );
  assert.equal(new URL(url).search, '');
  assert.equal(
    (await decodeWorkout(new URL(url).hash.slice(6))).execution,
    null,
  );
});
test('schema rejects version mismatch, invalid dates, duplicate IDs, orphan facts and incomplete completed logs', () => {
  const w = exampleWorkout();
  for (const mutate of [
    (x) => (x.schemaVersion = 2),
    (x) => (x.date = '2026-02-30'),
    (x) => (x.blocks[1].sets[1].id = x.blocks[1].sets[0].id),
    (x) => (x.blocks[1].sets = []),
    (x) => (x.blocks[1].weight = -1),
  ]) {
    const copy = structuredClone(w);
    mutate(copy);
    assert.throws(() => validateWorkout(copy));
  }
  updateRecord(w, w.blocks[1].sets[0].id, { status: 'done', reps: 16 });
  const copy = structuredClone(w);
  copy.execution.records.orphan =
    copy.execution.records[w.blocks[1].sets[0].id];
  assert.throws(() => validateWorkout(copy));
  w.execution.status = 'completed';
  assert.throws(() => validateWorkout(w));
  assert.throws(
    () => parseWorkoutJSON(' '.repeat(MAX_BYTES + 1)),
    (e) => e.code === 'size',
  );
});
test('oversized expanded gzip payload and malformed links fail without fallback to new data', async () => {
  const data = new Uint8Array(MAX_BYTES + 1);
  const gz = await new Response(
    new Blob([data]).stream().pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();
  await assert.rejects(
    decodeWorkout('z.' + Buffer.from(gz).toString('base64url')),
    (e) => e.code === 'size',
  );
  await assert.rejects(decodeWorkout('z.invalid'));
});
test('TXT and all views are localized; user text cannot become HTML', () => {
  const w = exampleWorkout();
  w.blocks[1].title = '<script>alert(1)</script>';
  w.notes = 'A & B';
  updateRecord(w, w.blocks[1].sets[0].id, {
    status: 'done',
    reps: 0,
    duration: 105,
    weight: 20,
  });
  for (const lang of ['en', 'de']) {
    const L = locale(lang);
    for (const view of [planView, executionView, reviewView]) {
      const html = view(L, w);
      assert(!html.includes('<script>alert(1)</script>'));
      assert(html.includes('&lt;script&gt;'));
      assert(!/\{\w+\}/.test(html));
    }
    const txt = workoutTXT(L, w);
    assert(txt.includes('1:45'));
    assert(txt.includes('20 kg'));
    assert(txt.includes(L.t('workout.pending')));
    assert(
      !workoutTXT(L, w, 'plan').includes(
        '\n' + L.t('workout.execution') + '\n',
      ),
    );
  }
});
test('prototype JSON files migrate to stable set IDs while keeping plan and facts', () => {
  const legacy = {
    format: 'vsegiri-workout',
    version: 1,
    id: 'legacy',
    title: 'Example',
    date: '2026-10-10',
    athlete: '',
    coach: '',
    notes: '',
    updatedAt: '',
    blocks: [
      {
        id: 'main',
        type: 'series',
        title: 'Main',
        exercise: 'long-cycle',
        basis: 'time',
        weight: 24,
        bells: 2,
        sets: 2,
        duration: 120,
        rest: 120,
        pace: 8,
        goal: 16,
        handSwitch: 0,
        note: '',
      },
    ],
    execution: {
      status: 'in-progress',
      date: '2026-10-10',
      notes: '',
      records: {
        'main:0': {
          status: 'done',
          reps: 15,
          duration: 120,
          weight: 24,
          bells: 2,
        },
      },
    },
  };
  const migrated = parseWorkoutJSON(JSON.stringify(legacy));
  assert.equal(migrated.blocks[0].exercise, 'lc');
  assert.equal(migrated.execution.records['main-set-1'].reps, 15);
  assert.equal(migrated.execution.planId, migrated.planId);
});
