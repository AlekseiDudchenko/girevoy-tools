import { snapshot, targetReps, blockSeconds, recordOf } from './workout.js';
import { validateWorkout } from './workout-schema.js';
import {
  clock,
  blockTitle,
  workoutTitle,
  exerciseName,
} from './workout-view.js';
export const workoutJSON = (w, scope = 'all') =>
  JSON.stringify(validateWorkout(snapshot(w, scope)), null, 2);
export function workoutTXT(L, w, scope = 'all') {
  const copy = snapshot(w, scope),
    t = (k, args) => L.t('workout.' + k, args),
    lines = [
      workoutTitle(L, copy),
      `${t('date')}: ${copy.date || '—'}`,
      `${t('athlete')}: ${copy.athlete || '—'} | ${t('coach')}: ${copy.coach || '—'}`,
      '',
      `${t('plan')} — ${L.dec(copy.blocks.reduce((a, b) => a + blockSeconds(b), 0) / 60)} ${t('plannedMinutes')}`,
    ];
  for (const b of copy.blocks) {
    lines.push(blockTitle(L, b));
    if (b.type === 'note') lines.push('  ' + clock(L, b.duration));
    else {
      lines.push(
        `  ${exerciseName(L, b)} · ${L.num(b.bells)} × ${L.dec(b.weight)} ${t('kg')}`,
        `  ${t('sets', { n: L.num(b.sets.length) })} × ${b.basis === 'reps' ? t('reps', { n: L.num(targetReps(b)) }) : clock(L, b.duration)}${b.pace ? ' · ' + t('rate', { n: L.dec(b.pace) }) : ''}`,
        `  ${t('rest')}: ${clock(L, b.rest)}${b.handSwitch ? ' · ' + t('switch', { time: clock(L, b.handSwitch) }) : ''}`,
      );
    }
    if (b.note) lines.push('  ' + b.note);
  }
  if (copy.notes) lines.push('', t('planNotes') + ': ' + copy.notes);
  if (copy.execution) {
    const e = copy.execution;
    lines.push(
      '',
      t('execution'),
      `${t('performedDate')}: ${e.date || '—'} | ${t('status')}: ${t(e.status)}`,
    );
    for (const b of copy.blocks) {
      lines.push(blockTitle(L, b));
      for (const [i, id] of (b.type === 'note'
        ? [b.id]
        : b.sets.map((s) => s.id)
      ).entries()) {
        const r = recordOf(copy, id);
        lines.push(
          `  ${b.type === 'note' ? '' : t('set', { n: L.num(i + 1) }) + ': '}${t(r.status)}${b.type === 'exercise' && r.status === 'done' ? ` · ${r.reps === null ? '—' : t('reps', { n: L.num(r.reps) })} · ${r.duration === null ? '—' : clock(L, r.duration)} · ${L.num(r.bells ?? b.bells)} × ${L.dec(r.weight ?? b.weight)} ${t('kg')}` : ''}`,
        );
        if (r.rest !== null)
          lines.push(`    ${t('rest')}: ${clock(L, r.rest)}`);
        if (r.note) lines.push('    ' + r.note);
      }
    }
    if (e.notes) lines.push('', t('sessionNotes') + ': ' + e.notes);
  }
  return lines.join('\n');
}
