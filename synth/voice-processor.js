/* =====================================================================
 *  THE VOICE — one key, one sample at a time
 * =====================================================================
 *
 * Engrave renders a whole score into an AudioBuffer before it plays any of
 * it, because a score is known in advance. A keyboard is not: the note has to
 * start when the key goes down, so the same two oscillators run live here, in
 * the audio thread, a sample at a time.
 *
 * The algorithms are not re-derived. The wavetable path reads the band-limited
 * mip tables built by ../synth/tables.js, which is render-worker.js's own
 * scheme; the filtered path is justidraw's recursion as synth.js transcribes
 * it, with the same feedback pole, the same index and the same high-frequency
 * taper. Those constants are repeated here rather than imported because an
 * AudioWorklet has no module graph to import through — so they are written out
 * once, with the source they came from named beside them.
 *
 * WHY THE ENVELOPE LIVES INSIDE THE OSCILLATOR, not on a GainNode after it.
 * In the filtered family the modulation index is driven by the output, and the
 * output is amplitude-scaled — a quiet note comes out very nearly a sine and a
 * loud one folds into a buzz. That is the whole point of the family. Put the
 * envelope on a gain stage downstream and the fold would be computed at full
 * amplitude and then turned down, so every note would be equally bright and
 * the attack would not open up. So `amp` here is the live envelope value, and
 * the timbre follows the ADSR because the physics say it does.
 *
 * WHY THE PITCH WHEEL IS ONE RATIO FOR EVERY VOICE. A controller's pitch
 * wheel belongs to the instrument, not to a note: it is told to the
 * processor as a bend in cents, and every voice's frequency is multiplied by
 * the same ratio, sample by sample. So a held chord bends as one — which on a
 * just keyboard is the point, because multiplying every pitch by one number
 * leaves every interval between them exactly what the tuning made it.
 *
 * WHY THE TIMBRE IS A POSITION, AND THE SHAPES ARE BLENDED HERE. The Timbre
 * slider moves under sounding notes — by hand, and by a controller's mod
 * wheel, which slides it a hundred times a second. Baking each position into
 * its own eleven tables, as render-worker.js does, costs ~30 ms on the main
 * thread, which would make a sweep of the wheel seconds of work with every
 * note played during it late. So the four shapes' tables come across once,
 * and a position between two of them is their crossfade, done per sample —
 * the same blend, and band-limited for the same reason: two tables limited to
 * the same harmonic count blend into one that is too. The filtered family's
 * (drive, even) is worked out here from the position as well. Either way the
 * position glides to wherever it was sent, so the slider's steps are heard as
 * a sweep rather than a ticking.
 * ------------------------------------------------------------------ */

const TWO_PI = Math.PI * 2;
const TABLE_SIZE = 2048;
const MIP_BASE_HZ = 20;
const MIP_COUNT = 11;
const INV_LOG2 = 1 / Math.log(2);

/** A pitch in cents becomes a frequency ratio as exp(cents · CENT). */
const CENT = Math.LN2 / 1200;
/**
 * How long the bend and the timbre take to arrive where they were sent.
 *
 * Both come in steps — a pitch wheel that sends seven bits moves 3 cents a
 * step across a ±200 cent bend, and the mod wheel moves the Timbre slider
 * 2.4 places a step — and a sound that jumped from each step to the next
 * would be heard as a staircase, or a tick. A glide this short smooths the
 * steps into a slide and is too quick to be heard as lag.
 */
const GLIDE_S = 0.01;

/** Where the filtered family's range starts — timbre.js FILTERED_MIN. */
const FILTERED_MIN = 1000;

/** (drive, even) at the filtered family's four stations, sine to square —
 *  timbre.js FILTERED_NODES, unchanged. */
const FILTERED_NODES = [
  { drive: 0, even: 1 },
  { drive: 0.5, even: 1 },
  { drive: 2, even: 0 },
  { drive: 2, even: 1 },
];

/** index = drive·((1 - even)·pout + even·pout²) — synth.js FILTERED.index. */
const filteredIndex = (pout, drive, even) =>
  drive * (pout + even * (pout * pout - pout));

/**
 * How much modulation index survives at this frequency: all of it up to sr/8,
 * where the 4th harmonic still fits under Nyquist, none by sr/4, where the 2nd
 * no longer does. A feedback oscillator cannot be band-limited the way the mip
 * tables are, so a partial too high to fold without aliasing is left as the
 * sine it already nearly is. synth.js FILTERED.taper, unchanged.
 */
function filteredTaper(freq, sr) {
  const lo = sr / 8, hi = sr / 4;
  if (freq <= lo) return 1;
  if (freq >= hi) return 0;
  const u = (freq - lo) / (hi - lo);
  return 1 - u * u * (3 - 2 * u);
}

function mipFor(freq) {
  if (!(freq > MIP_BASE_HZ)) return 0;
  const m = Math.ceil(Math.log(freq / MIP_BASE_HZ) * INV_LOG2);
  return m < 0 ? 0 : m >= MIP_COUNT ? MIP_COUNT - 1 : m;
}

/* The envelope's four stages. RELEASE runs from wherever the envelope had
 * reached, not from sustain, so a key let go during its attack falls from the
 * height it actually got to — which is what makes a staccato tap quiet. */
const ATTACK = 0, DECAY = 1, SUSTAIN = 2, RELEASE = 3, DONE = 4;

class Voice {
  constructor() { this.reset(); }

  reset() {
    this.id = null;
    this.freq = 0;
    this.vel = 1;
    this.accum = 0;     // filtered: phase in radians
    this.phase = 0;     // wavetable: phase in table samples
    this.pout = 0;      // filtered: the low-passed feedback
    this.env = 0;
    this.stage = DONE;
    this.relFrom = 0;
    this.t = 0;         // seconds into the current stage
  }

  on(id, freq, vel) {
    /* Re-struck while still sounding: the phase and the feedback are kept, so
     * a repeated key continues the same oscillator rather than clicking. The
     * envelope restarts from where it is, for the same reason. */
    const carryOn = this.id === id && this.stage !== DONE;
    if (!carryOn) { this.accum = 0; this.phase = 0; this.pout = 0; }
    this.id = id;
    this.freq = freq;
    this.vel = vel;
    this.stage = ATTACK;
    this.t = 0;
  }

  off() {
    if (this.stage === DONE || this.stage === RELEASE) return;
    this.stage = RELEASE;
    this.relFrom = this.env;
    this.t = 0;
  }

  /** Advance the envelope one sample. Linear segments — see the editor. */
  step(adsr, dt) {
    const { a, d, s, r } = adsr;
    this.t += dt;
    switch (this.stage) {
      case ATTACK:
        if (a <= 0) { this.env = 1; this.stage = DECAY; this.t = 0; break; }
        this.env = Math.min(1, this.t / a);
        if (this.env >= 1) { this.stage = DECAY; this.t = 0; }
        break;
      case DECAY:
        if (d <= 0) { this.env = s; this.stage = SUSTAIN; break; }
        this.env = 1 + (s - 1) * Math.min(1, this.t / d);
        if (this.t >= d) { this.env = s; this.stage = SUSTAIN; }
        break;
      case SUSTAIN:
        this.env = s;
        break;
      case RELEASE:
        if (r <= 0) { this.env = 0; this.stage = DONE; break; }
        this.env = this.relFrom * (1 - Math.min(1, this.t / r));
        if (this.t >= r) { this.env = 0; this.stage = DONE; }
        break;
      default:
        this.env = 0;
    }
    return this.env;
  }
}

class XenachordVoiceProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.voices = Array.from({ length: 48 }, () => new Voice());
    /* [sine, triangle, saw, square], each Float32Array[MIP_COUNT] — the
     * wavetable family's only tables. */
    this.shapes = null;
    this.filtered = null;         // which family; none until a timbre arrives
    /* The Timbre slider as a position, 0…3 from sine to square, within the
     * family: where it was last sent, and where its glide has got to. */
    this.pos = 0; this.posNow = 0;
    this.adsr = { a: 0.016, d: 0.067, s: 0.38, r: 0.544 };
    this.gain = 0.22;
    this.pole = Math.pow(0.5, 44100 / sampleRate); // synth.js FILTERED.pole
    /* The pitch wheel, in cents: where it was last sent, and where its glide
     * has got to. See bendRatio(). */
    this.bend = 0; this.bendNow = 0;
    this.glide = 1 - Math.exp(-1 / (GLIDE_S * sampleRate));
    /* One block, per sample: the bend as a frequency ratio, and the timbre as
     * each family reads it — (drive, even) for the filtered oscillator, which
     * two shapes and how far between them for the tables. */
    this.ratio = new Float64Array(128);
    this.drv = new Float64Array(128); this.evn = new Float64Array(128);
    this.lo = new Uint8Array(128); this.frc = new Float64Array(128);
    this.port.onmessage = (e) => this.handle(e.data);
    /* The node comes up already configured rather than waiting on its first
     * message: a port message is delivered on a later turn, so a note struck
     * in the same tick as the node's construction would otherwise sound with
     * whatever the defaults happened to be. Same messages, applied at once. */
    for (const m of options?.processorOptions?.setup || []) this.handle(m);
  }

  handle(m) {
    switch (m.t) {
      case 'shapes':
        this.shapes = m.mips;
        break;
      case 'timbre': {
        // Read off the slider's range exactly as timbre.js reads it, so the
        // position here is the one the slider is showing.
        const filtered = m.value >= FILTERED_MIN;
        const pos = Math.min(3, Math.max(0, (filtered ? m.value - FILTERED_MIN : m.value) / 100));
        if (!Number.isFinite(pos)) break;
        // The other family is another oscillator, not further along this
        // one: it is switched to, not glided toward.
        if (filtered !== this.filtered) { this.filtered = filtered; this.posNow = pos; }
        this.pos = pos;
        break;
      }
      case 'adsr':
        this.adsr = { a: m.a, d: m.d, s: m.s, r: m.r };
        break;
      case 'bend':
        this.bend = Number.isFinite(m.cents) ? m.cents : 0;
        break;
      case 'on': {
        // One voice per key: the same key pressed again takes its own voice
        // back rather than stacking a second copy on top of itself.
        let v = this.voices.find((q) => q.id === m.id)
             || this.voices.find((q) => q.stage === DONE);
        if (!v) v = this.voices.reduce((lo, q) => (q.env < lo.env ? q : lo));
        v.on(m.id, m.freq, m.vel ?? 1);
        break;
      }
      case 'off':
        for (const v of this.voices) if (v.id === m.id) v.off();
        break;
      case 'allOff':
        for (const v of this.voices) v.off();
        break;
    }
  }

  /**
   * The pitch wheel as one frequency ratio per sample of this block, filled
   * into this.ratio. Returns the largest, which is the frequency the block's
   * band-limiting has to allow for.
   */
  bendRatio(n) {
    if (this.ratio.length < n) this.ratio = new Float64Array(n);
    const r = this.ratio;
    // Settled — at rest, or a bend being held still: the ratio cannot change
    // across the block, so it is worked out once.
    if (this.bendNow === this.bend) {
      const k = Math.exp(this.bend * CENT);
      r.fill(k, 0, n);
      return k;
    }
    const g = this.glide;
    let max = 0;
    for (let i = 0; i < n; i++) {
      this.bendNow += (this.bend - this.bendNow) * g;
      const k = Math.exp(this.bendNow * CENT);
      r[i] = k;
      if (k > max) max = k;
    }
    /* Near enough is there: snapped, so a wheel that has come to rest drops
     * back to the path above instead of approaching it for ever. */
    if (Math.abs(this.bend - this.bendNow) < 1e-3) this.bendNow = this.bend;
    return max;
  }

  /**
   * The Timbre slider's position, per sample of this block, as the family
   * sounding reads it: (drive, even) into drv/evn, or the lower of the two
   * shapes either side and how far toward the upper into lo/frc. The same
   * reading timbre.js gives the same position, so a slider standing still
   * sounds what it always has.
   */
  morph(n) {
    if (this.frc.length < n) {
      this.drv = new Float64Array(n); this.evn = new Float64Array(n);
      this.lo = new Uint8Array(n); this.frc = new Float64Array(n);
    }
    const gliding = this.posNow !== this.pos;
    const g = this.glide;
    for (let i = 0; i < n; i++) {
      if (gliding) this.posNow += (this.pos - this.posNow) * g;
      const lo = Math.min(2, Math.floor(this.posNow));
      const frac = this.posNow - lo;
      if (this.filtered) {
        const a = FILTERED_NODES[lo], b = FILTERED_NODES[lo + 1];
        this.drv[i] = a.drive + frac * (b.drive - a.drive);
        this.evn[i] = a.even + frac * (b.even - a.even);
      } else {
        this.lo[i] = lo;
        this.frc[i] = frac;
      }
    }
    if (gliding && Math.abs(this.pos - this.posNow) < 1e-6) this.posNow = this.pos;
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const n = out[0].length;
    const sr = sampleRate;
    const dt = 1 / sr;
    const buf = out[0];
    buf.fill(0);
    /* The highest the wheel bends any pitch this block: the taper and the mip
     * level are chosen for the frequency actually sounding, so a note bent up
     * cannot carry harmonics past Nyquist that its unbent pitch kept under. */
    const rMax = this.bendRatio(n);
    this.morph(n);
    const { ratio, drv, evn, lo, frc } = this;

    for (const v of this.voices) {
      if (v.stage === DONE) continue;

      if (this.filtered) {
        const step = (TWO_PI * v.freq) / sr;
        const taper = filteredTaper(v.freq * rMax, sr);
        const pole = this.pole;
        for (let i = 0; i < n; i++) {
          const amp = v.step(this.adsr, dt) * v.vel;
          v.accum += step * ratio[i];
          if (v.accum > TWO_PI) v.accum -= TWO_PI;
          const s = amp * Math.sin(v.accum + filteredIndex(v.pout, drv[i] * taper, evn[i]));
          v.pout = pole * v.pout + (1 - pole) * s;
          buf[i] += s;
          if (v.stage === DONE) break;
        }
      } else if (this.shapes) {
        const mip = mipFor(v.freq * rMax);
        const inc = (v.freq * TABLE_SIZE) / sr;
        for (let i = 0; i < n; i++) {
          const amp = v.step(this.adsr, dt) * v.vel;
          const j = v.phase | 0;
          const f = v.phase - j;
          const j0 = j & (TABLE_SIZE - 1), j1 = (j + 1) & (TABLE_SIZE - 1);
          // The two shapes either side of the slider, crossfaded where it stands.
          const ta = this.shapes[lo[i]][mip], tb = this.shapes[lo[i] + 1][mip];
          const a = ta[j0] + frc[i] * (tb[j0] - ta[j0]);
          const b = ta[j1] + frc[i] * (tb[j1] - ta[j1]);
          buf[i] += amp * (a + f * (b - a));
          v.phase += inc * ratio[i];
          // A remainder, not a subtraction: a wide bend can carry a high key
          // past a whole table a sample, and one subtraction would let the
          // phase climb until `| 0` above overflowed.
          if (v.phase >= TABLE_SIZE) v.phase %= TABLE_SIZE;
          if (v.stage === DONE) break;
        }
      }
    }

    /* A soft knee rather than a hard ceiling: thirty-two keys held at once is
     * a chord somebody meant, and it should get quieter and thicker rather
     * than square off into distortion. */
    for (let i = 0; i < n; i++) buf[i] = Math.tanh(buf[i] * this.gain);
    for (let c = 1; c < out.length; c++) out[c].set(buf);
    return true;
  }
}

registerProcessor('xenachord-voice', XenachordVoiceProcessor);
