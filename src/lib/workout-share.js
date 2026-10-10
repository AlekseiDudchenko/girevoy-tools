import { snapshot } from './workout.js';
import { MAX_BYTES, WorkoutError, parseWorkoutJSON } from './workout-schema.js';
const toBase64 = (bytes) => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};
export async function encodeWorkout(w, scope = 'all') {
  const raw = JSON.stringify(snapshot(w, scope)),
    bytes = new TextEncoder().encode(raw);
  if (bytes.length > MAX_BYTES) throw new WorkoutError('size');
  if (typeof CompressionStream === 'undefined') return 'j.' + toBase64(bytes);
  const buffer = await new Response(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();
  return 'z.' + toBase64(new Uint8Array(buffer));
}
export async function decodeWorkout(encoded) {
  if (encoded.length > 350000) throw new WorkoutError('size');
  try {
    const match = /^([jz])\.([\w-]+)$/.exec(encoded);
    if (!match) throw new WorkoutError();
    let bytes = Uint8Array.from(
      atob(match[2].replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    );
    if (match[1] === 'z') {
      if (typeof DecompressionStream === 'undefined')
        throw new WorkoutError('compression');
      const reader = new Blob([bytes])
          .stream()
          .pipeThrough(new DecompressionStream('gzip'))
          .getReader(),
        chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new WorkoutError('size');
        }
        chunks.push(value);
      }
      bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
    }
    if (bytes.length > MAX_BYTES) throw new WorkoutError('size');
    return parseWorkoutJSON(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    );
  } catch (e) {
    if (e instanceof WorkoutError) throw e;
    throw new WorkoutError();
  }
}
export async function workoutLink(w, scope, url) {
  const link = new URL(url);
  link.search = '';
  link.hash = 'data=' + (await encodeWorkout(w, scope));
  return link.href;
}
