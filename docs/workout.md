# Workout builder

Public pages: `/en/workout/` and `/de/workout/`. Buildless ES modules, existing
site dictionaries/styles, no backend or accounts. The builder supports timed
sets (optional pace), repetition targets, rest between sets, hand-switch cues,
preparation/recovery blocks, and coach notes. Planned reps for timed sets are
rounded to whole repetitions. No rest is counted after the final set.

## Portable format

The canonical JSON is `format: "vsegiri-workout"`, `schemaVersion: 1`.
`src/lib/workout-schema.js` is the runtime validator. JSON exports and URL
snapshots use the same model, including stable block and set IDs.

- `id`: local saved document ID; importing a file creates a new local copy.
- `planId`, `planRevision`: assignment identity and revision. Draft plan edits
  advance its revision. Starting an execution freezes the assignment.
- `title`, `date`, `athlete`, `coach`, `notes`, `blocks`: the plan.
- Exercise block: exercise (`lc`, `jerk`, `snatch`, `custom`), basis (`time`,
  `reps`), kg per kettlebell, kettlebell count, duration/rest/hand-switch in
  seconds, pace in reps/min, repetition goal, instructions, and `sets: [{id}]`.
- Note block: ID, title, duration in seconds and instructions.
- `execution`: null or a separate log with its own ID, matching plan identity
  and revision, date, status, notes and `records` keyed by stable set ID.
- Record: `pending`, `done` or `skipped`; nullable actual reps, time, equipment,
  rest after the set, and comment. Note-block completion uses the block ID.

Blank reps remain `null`, zero remains `0`, and a skipped set has no numeric
facts. Comparison computes deviations only for performed sets with recorded
reps. Changed equipment is displayed explicitly, without claiming an equivalent
score. Finishing requires every exercise set to be done or skipped.

Repeat retains the assignment identity but creates an empty execution and a new
local document. Edit-copy creates a new assignment identity and clears execution.
Returning a snapshot to a coach preserves its plan/execution lineage; automatic
merging or synchronization is not implemented.

## Persistence and sharing

IndexedDB database `vsegiri-workouts`, version 1, store `sessions`. Only the last
selected local document ID is stored in localStorage. Saves are queued and
flushed before changing documents, exporting, or deleting. Storage failure is
shown explicitly; JSON export and sharing remain available.

`#data=z.<base64url>` contains gzip-compressed UTF-8 JSON. `j.` is the uncompressed
fallback. Fragments are not included in HTTP requests. Decoding validates the
schema and limits expanded payloads to 250 KB. Links longer than 12,000 characters
suggest JSON file transfer; links are never silently truncated. Sharing choices
are plan only or plan plus execution. Old sent snapshots do not change.

Language links carry current data. Opening a snapshot imports a local copy;
identical snapshots already stored on the same device reuse the existing local
ID. The received fragment is then removed from the current address so reloading
uses the saved local document rather than repeatedly importing snapshots.

JSON can be reimported. Files from the initial interface prototype
(`version: 1`, numeric set counts) are migrated before validation. TXT is a
localized human-readable export, including set comments/rest and all recorded
facts. PDF export is deliberately disabled and labeled as a later feature.

Clearing browser data deletes local workouts. There is no cross-device automatic
sync; use a JSON backup or a snapshot link.

## Verification

`npm run check` covers format validation, assignment/fact isolation, stable set
identity, duration and rest totals, Unicode links, bounded decompression,
prototype migration, localized exports and escaped user content. Browser QA
covers editing, actual zero/skipped/equipment changes, locking, autosave/reload,
JSON download, recipients, decimal commas, language switching and both themes on
mobile. Browser tooling is authoring-only and is not a project dependency.
