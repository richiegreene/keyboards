/* =====================================================================
 *  BAND-LIMITED WAVETABLES
 * =====================================================================
 *
 * Engrave's render-worker.js, on the same terms and for the same reason: a
 * naive saw or square is built from harmonics that never stop, and every one
 * above Nyquist folds back down as inharmonic noise — in this app, right into
 * the interval the keyboard was tuned to demonstrate. So each shape is
 * synthesised additively from only the harmonics that fit, at a range of
 * octave "mip" levels, and the voice picks the level that suits the frequency
 * it is sounding.
 *
 * Built on the main thread and posted to the worklet: the tables depend only
 * on the shape and the sample rate, so they are made once rather than in the
 * audio thread, which has 128 samples to fill and no business doing 44
 * additive syntheses inside them. Only the four pure shapes are built. Every
 * position between two of them is their crossfade, which the worklet does as
 * it reads (see voice-processor.js), so the slider — and the mod wheel that
 * slides it — can move anywhere without a table being built.
 * ------------------------------------------------------------------ */

const TWO_PI = Math.PI * 2;

export const TABLE_SIZE = 2048;
export const MIP_BASE_HZ = 20;
export const MIP_COUNT = 11; // 20 Hz .. ~20 kHz
/** Beyond this the tables stop improving but the build cost keeps rising. */
const MAX_HARMONICS = 256;

/** Harmonic amplitude for each shape, or 0 if that harmonic is absent. */
const SHAPES = [
  (n) => (n === 1 ? 1 : 0), // sine
  (n) => (n % 2 ? (((n - 1) / 2) % 2 ? -1 : 1) / (n * n) : 0), // triangle
  (n) => (n % 2 ? 1 : -1) / n, // sawtooth
  (n) => (n % 2 ? 1 / n : 0), // square
];

/** Highest harmonic that stays below Nyquist for this mip's top fundamental. */
function harmonicLimit(mip, sr) {
  const topHz = MIP_BASE_HZ * Math.pow(2, mip);
  return Math.max(1, Math.min(MAX_HARMONICS, Math.floor(sr / 2 / topHz)));
}

function buildShapeTable(shapeFn, harmonics) {
  const table = new Float32Array(TABLE_SIZE);
  for (let n = 1; n <= harmonics; n++) {
    const amp = shapeFn(n);
    if (amp === 0) continue;
    const step = (TWO_PI * n) / TABLE_SIZE;
    for (let i = 0; i < TABLE_SIZE; i++) table[i] += amp * Math.sin(step * i);
  }
  let max = 0;
  for (let i = 0; i < TABLE_SIZE; i++) max = Math.max(max, Math.abs(table[i]));
  if (max > 0) for (let i = 0; i < TABLE_SIZE; i++) table[i] /= max;
  return table;
}

const cache = new Map();

/**
 * Band-limited tables for each of the four shapes, one per mip level.
 *
 * Each mip level is limited to the same harmonic count in every shape, so a
 * crossfade between two shapes at the same level stays band-limited: the
 * blend the worklet makes between neighbours cannot reintroduce aliasing.
 * @returns {Float32Array[][]} [sine, triangle, saw, square], each MIP_COUNT
 *   tables of TABLE_SIZE
 */
export function shapeTablesFor(sr) {
  const hit = cache.get(sr);
  if (hit) return hit;
  const sets = SHAPES.map((shapeFn) => {
    const mips = [];
    for (let m = 0; m < MIP_COUNT; m++) mips.push(buildShapeTable(shapeFn, harmonicLimit(m, sr)));
    return mips;
  });
  cache.set(sr, sets);
  return sets;
}
