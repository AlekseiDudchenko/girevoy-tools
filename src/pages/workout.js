import { esc } from '../html.js';
import { exampleWorkout } from '../lib/workout.js';
import { workoutShell } from '../lib/workout-view.js';
export default {
  slug: 'workout/',
  key: 'workout',
  scripts: ['/workout.js'],
  body(L) {
    return `<h1>${esc(L.t('workout.title'))}</h1><p class="lead">${esc(L.t('workout.lead'))}</p><noscript><p class="note">${esc(L.t('workout.noscript'))}</p></noscript>${workoutShell(L, exampleWorkout())}`;
  },
};
