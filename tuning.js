/* =====================================================================
 *  SCALE / TUNING  —  what pitch each key carries
 * =====================================================================
 *
 * Design says how the keyboard is ARRANGED; this says what it SOUNDS.  The
 * two are kept apart on purpose: a layout is a run of 32 keys with an equave
 * measured off the first seven whites and the gaps among them, and nothing in
 * it knows a frequency.  Here that run is handed a scale — an equal division,
 * or a pitch typed onto every degree — and every key comes away with a pitch,
 * a name, and the enumeration it already had to hang them on. A key shows one
 * of the two at a time: its position while you are in Design, its pitch while
 * you are in Play, because both at once is two numbers in twenty pixels.
 *
 * AUTO AND CUSTOM ARE ONE MECHANISM, NOT TWO.  Every degree carries an
 * ENTRY — a ratio, a cents figure, or a step of some division — and the two
 * systems differ only in where the entry comes from.  Auto reads it off the
 * arrangement: degree d is step d of the division Design already implies, and
 * there is nothing to type.  Custom starts from exactly those entries and
 * lets any of them be replaced by hand.  So switching between the two is not
 * a change of tuning, it is a change of who is allowed to write on it, and a
 * Custom scale you have not edited sounds identical to Auto — which is what
 * makes editing it feel like editing rather than starting over.
 *
 * THAT IS WHY THE EDITOR IS THE KEYBOARD.  A scale typed into a box beside
 * the strip has to be read back onto the strip in your head, and the layouts
 * worth reaching for here are the ones whose degrees DON'T ascend in order.
 * Typed onto the key it will be played from, a nonsequential layout is no
 * harder to write than a sequential one.
 *
 * THE NOTATION IS NOT REIMPLEMENTED.  The spellers under ./notation are the
 * Notation app's own engines, copied across whole: the same Ups-and-Downs
 * table, the same C-anchored HEJI speller and the same Sagittal calculator,
 * drawing the same glyphs out of the same fonts at the same sizes the Tuner
 * draws them.  A name spelled here is the name that app would spell.  Which
 * of them a key is spelled with follows from WHAT WAS TYPED on it: a ratio is
 * spelled in HEJI, Sagittal or as itself, a step of a division in ups and
 * downs or as its number, and a bare cents figure as cents, because there is
 * no notation that answers all three and pretending otherwise would put a
 * name on a key that the key does not have.
 *
 * WHAT A TRANSPOSITION IS, AND WHY IT CHANGES NO NAME.  Transpose, in the
 * MIDI panel, is here rather than there, because it is a fact about the
 * instrument and not about a cable: a key sounds the same whether a finger or
 * a controller pressed it, so the shift has to live where the pitches are
 * settled.  What it does is multiply every pitch on the instrument by ONE
 * interval.  Every key keeps the degree it had and therefore keeps the name
 * it had; only the Hz move.  That is the whole of what a transposition is,
 * and it is why this is the one control in Play that cannot change a
 * spelling — the strip reads identically at +2 as it does at 0.
 *
 * AND THE INTERVAL IS CHOSEN IN KEYS, because keys are what a MIDI note
 * number counts in.  One press moves by however far `n` keys reach from 1/1,
 * and `n` defaults to Design's Notes in Scale — at which it is exactly an
 * equave, which is why the control is called one.  Set it smaller and the
 * instrument transposes by a fifth, or a step, without any of the keys
 * changing what they are.  It is NOT a rotation: a rotation slides the scale
 * along the keyboard and puts a different degree under your finger; this
 * leaves every finger on the degree it was on and moves the register.
 *
 * A rotation by a whole equave WOULD sound identical, which is exactly why
 * the two are kept apart: the rotation below is folded back into the scale on
 * every pass, precisely so that "which degree is under key 0" stays a
 * question with N answers rather than infinitely many.  So the shift is its
 * own term, added after the fold, and the two controls do not interfere:
 * rotate to choose the mode, transpose to choose the register.
 *
 * WHAT A ROTATION IS.  Not a transposition and not a re-ordering: the scale
 * keeps its degrees in their order and keeps their frequencies, and the whole
 * run slides along the keyboard, so a different degree comes to rest under
 * key 0.  Sliding by a whole scale carries you up an equave, which is why the
 * offset is read as a signed index into an infinite ascending run rather than
 * folded first — key 0 at rotation N is an equave above key 0 at rotation 0.
 *
 * The pitches this settles are held on window.XTuning.freqs, keyed by the
 * enumeration, because sounding them is Play's next job and it will want them
 * without having to ask the strip.
 */

import {
  buildJiScale, edoName, hejiName, sagittalSpellings, ratioMonzo,
} from './notation/tuner-notation.js';

const $ = (id) => document.getElementById(id);
const mod = (n, m) => ((n % m) + m) % m;

const STORE = 'xenachord.tuning.v1';

const T = {
  nominal: 1, acc: 1, oct: 4,     // 1/1 is written C natural 4 ...
  hz: 261.6256,                   // ... and sounds here
  system: 'auto',                 // 'auto' — read off Design — or 'custom'
  edoRead: 'updown',
  edoHalves: 'exclude',
  jiRead: 'heji',
  sagPrecision: 'medium',
  sagFlavour: 'revo',
  rot: 0,                         // which degree comes to rest under key 0
  scale: '1/1 9/8 5/4 4/3 3/2 5/3 15/8',   // the fill list, not the tuning
  custom: {},                     // degree -> entry, in Custom only; see customKey
  trStep: null,                   // keys one Transpose moves; null follows Design
  trStepByDevice: {},             // stacked only: device slot -> its own trStep
  midiRot: 0,                     // which key starts the next equave — see pivotEq
  midiRotByDevice: {},            // stacked only: device slot -> its own midiRot
  equaveShift: 0,                 // how many of those have been taken
};

try { Object.assign(T, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) {}
/* ---- what an older session left behind ----
 * Johnston was offered once and is not any more; EDO and JI were two systems
 * and are now two ways of filling one.  A stored session comes back as the
 * nearest thing that still exists rather than as a control with nothing
 * pressed — and a JI scale comes back as the custom entries it always was,
 * written onto the degrees in the order it listed them. */
if (T.jiRead === 'johnston') T.jiRead = 'heji';
/* One rotation now where there were two — and which of the two it inherits
 * is the one the session was actually looking at. */
if (T.rot === 0) {
  const old = T.system === 'ji' ? T.jiRot : T.edoRot;
  if (old != null) T.rot = old | 0;
}
if (T.system === 'edo') T.system = 'auto';
if (T.system === 'ji') {
  T.system = 'custom';
  if (!T.custom || !Object.keys(T.custom).length) T.custom = fillFromScale({});
}
if (T.system !== 'auto' && T.system !== 'custom') T.system = 'auto';
delete T.equave;                  // the equave was an interval once; it is a count now
if (!T.custom || typeof T.custom !== 'object') T.custom = {};
if (!T.trStepByDevice || typeof T.trStepByDevice !== 'object') T.trStepByDevice = {};
if (!T.midiRotByDevice || typeof T.midiRotByDevice !== 'object') T.midiRotByDevice = {};
delete T.edoRot; delete T.jiRot;

const save = () => { try { localStorage.setItem(STORE, JSON.stringify(T)); } catch (e) {} };

const NOMINALS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const ACCS = ['♭', '♮', '♯'];

/* ---------------------------------------------------------------------
 *  The shape of the keyboard
 * ------------------------------------------------------------------ */

/**
 * How many notes there are to the equave.
 *
 * Design settles this, not the panel here — and on a rig it is Design's own
 * answer read in the RIG's steps rather than in one keyboard's. The anchor
 * device's layout repeats every `period` keys, and each of its keys moves the
 * rig `step` notes, so the repeat spans step x period notes.
 *
 * That is the whole of why a stacked rig sounds different rather than merely
 * standing differently. Stacking is an INTERCHANGE: the lower device takes
 * the even steps and the upper one the odd steps between them, so two 17-note
 * layouts standing one above the other ARE 34 notes to the equave. Without
 * the equave following the step, the interleaved numbering would fold back
 * into the design's own 17 and every key on the lower keyboard would change
 * pitch — precisely the reading the stack denies.
 *
 * Side-by-side does not come into it: a second device beside the first is a
 * CONTINUATION, 32 notes higher in the same division, and the division is
 * untouched.
 */
function equaveNotes() {
  if (typeof window.rigEquave === 'function') {
    const n = window.rigEquave() | 0;
    if (n > 1) return n;
  }
  const n = (typeof window.periodNow === 'function') ? window.periodNow() : 32;
  return (n > 1) ? n : 32;
}

/** How much finer the rig reads the anchor device's own layout — 1 when the
 *  two are the same, which is every single keyboard and every rig only set
 *  side by side. */
function stackDepth() {
  const per = anchorPeriod();
  const d = equaveNotes() / per;
  return Number.isInteger(d) && d > 1 ? d : 1;
}

/** The device the equave is read off — the lower left, on a rig; the only
 *  one there is, otherwise. */
function anchorPeriod() {
  if (typeof window.rigAnchorPeriod === 'function') {
    const n = window.rigAnchorPeriod() | 0;
    if (n > 1) return n;
  }
  const n = (typeof window.periodNow === 'function') ? window.periodNow() : 32;
  return (n > 1) ? n : 32;
}

/* ---------------------------------------------------------------------
 *  An interval, however it was written
 *
 *  One grammar, used in three places — the equave field, the fill list, and
 *  the box that opens on a key — so that what you may type does not depend on
 *  where you are typing it.  Everything reduces to CENTS, which is the only
 *  form all three notations share; what was typed is kept beside it, because
 *  it is what decides how the key is spelled and what the box says when you
 *  come back to edit it.
 * ------------------------------------------------------------------ */

/**
 * Read one interval.
 *
 * @param text  '3/2' or '3:2' (a ratio) · '702c' (cents from 1/1) ·
 *              '7\12' (step of a division of the equave; '7\' takes the
 *              keyboard's own division) · '392hz' (an absolute frequency,
 *              which is kept as the cents it comes to) · a bare integer as
 *              a ratio over 1 · a bare decimal as cents.
 * @param N     the division a bare backslash means.
 * @returns an entry, or null when it is not an interval at all.
 */
function parseInterval(text, N) {
  const s = String(text == null ? '' : text).replace(/\s+/g, '');
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d+)[/:](\d+)$/))) {
    const num = +m[1], den = +m[2];
    return (num > 0 && den > 0) ? { kind: 'ratio', num, den } : null;
  }
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)\\(\d+(?:\.\d+)?)?$/))) {
    const step = +m[1], edo = m[2] === undefined ? N : +m[2];
    return (edo > 0) ? { kind: 'edo', step, edo } : null;
  }
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)(?:cents?|c|¢)$/i))) {
    return { kind: 'cents', cents: +m[1] };
  }
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)hz$/i))) {
    const f = +m[1];
    return (f > 0) ? { kind: 'cents', cents: 1200 * Math.log2(f / T.hz) } : null;
  }
  if ((m = s.match(/^(\d+)$/))) return { kind: 'ratio', num: +m[1], den: 1 };
  if ((m = s.match(/^(-?\d+\.\d+)$/))) return { kind: 'cents', cents: +m[1] };
  return null;
}

/**
 * What an entry is worth, in cents above 1/1.
 *
 * A step of a division is a division of the OCTAVE — 7\12 is seven twelfths
 * of 2/1, which is what everyone already means by it and what the ups-and-
 * downs speller assumes when it comes to write the step down.
 */
function entryCents(e) {
  if (!e) return 0;
  if (e.kind === 'ratio') return 1200 * Math.log2(e.num / e.den);
  if (e.kind === 'cents') return e.cents;
  return e.step * 1200 / e.edo;
}

/** An entry written back out the way it would be typed. */
function entryText(e) {
  if (!e) return '';
  if (e.kind === 'ratio') return `${e.num}/${e.den}`;
  if (e.kind === 'cents') return `${num(e.cents)}c`;
  return `${num(e.step)}\\${num(e.edo)}`;
}

/** A number with no trailing zeroes — 702, not 702.0000.  Four places is
 *  what a typed interval is kept to, which is finer than anyone hears and
 *  coarse enough to round-trip through the box unchanged. */
const num = (v) => String(Math.round(v * 1e4) / 1e4);

/** The same, at the precision a KEY is read at.  A cents figure off an
 *  arbitrary frequency has as many digits as the division does, and twenty
 *  pixels of key is the wrong place for the last four of them. */
const num2 = (v) => String(Math.round(v * 100) / 100);

/* ---------------------------------------------------------------------
 *  The scale
 * ------------------------------------------------------------------ */

/** What Auto gives degree `d`: step d of the division the arrangement
 *  implies.  Custom's degrees start here too, and stay here until typed on. */
const autoEntry = (d, N) => ({ kind: 'edo', step: d, edo: N });

/** The entry degree `d` actually carries. */
function entryOf(d, N) {
  if (T.system === 'custom') {
    const e = T.custom[d];
    if (e && e.kind) return e;
  }
  return autoEntry(d, N);
}

/** True when this degree has been typed rather than read off the arrangement. */
const isTyped = (d) => T.system === 'custom' && !!(T.custom[d] && T.custom[d].kind);

/** How many degrees of the scale as it stands have been typed on. */
function typedCount() {
  const N = equaveNotes();
  let n = 0;
  for (let d = 0; d < N; d++) if (isTyped(d)) n++;
  return n;
}

/* ---------------------------------------------------------------------
 *  A STACKED KEYBOARD, READ DEVICE BY DEVICE
 *
 *  Auto keeps the one flat reading it always had — the rig's interleaved
 *  equave, exactly as rigEquave() states it — because that reading is a fact
 *  about the GEOMETRY (how the devices interchange) and nothing about typing
 *  changes it.
 *
 *  Custom is different.  Two built controllers standing one above the other
 *  already have their own fixed, sequential numbering (see the strip's key
 *  labels), and a player typing a 31-tone scale onto them is not filling one
 *  flat list — they are filling the LOWER keyboard's own 19-key loop and the
 *  UPPER's own 17-key loop independently, by hand, degree by degree,
 *  choosing for themselves which of the two repeat a pitch and which do not.
 *  So Custom, on a stacked rig only, reads each key off its OWN device's
 *  Notes in Scale rather than the rig's combined one.  Side by side is left
 *  out of this on purpose: two columns there are a CONTINUATION of one
 *  scale, not two independent instruments, so they keep sharing the flat
 *  reading Custom always used.
 *
 *  T.custom stays one flat object regardless — customKey() is what keeps a
 *  lower keyboard's degree 3 and an upper's apart, by folding the device's
 *  own slot into the key. On every rig that is NOT stacked-and-Custom this
 *  folds away to nothing (slot 0, the only slot a plain keyboard has), so a
 *  single keyboard's saved scale reads back exactly as it always did.
 * ------------------------------------------------------------------ */

/** Whether Custom should read each key off its own device, rather than the
 *  rig's one flat equave. */
function perDeviceCustom() {
  return T.system === 'custom' &&
    typeof window.rigIsStacked === 'function' && window.rigIsStacked();
}

/** A key element's own device (by rig slot) and its place — 0-based, the
 *  same number the strip prints on it — in that device's own run of keys. */
function keyCtx(el) {
  if (!el || el.dataset.local === undefined) return null;
  return { udev: +el.dataset.udev || 0,
           uperiod: +el.dataset.uperiod || equaveNotes(),
           local: +el.dataset.local };
}

/** The same, found from a key's rig-wide note number rather than its
 *  element — for the one commit path (closeEditor) that only kept the
 *  number across the rebuild the box's Enter triggered. */
function ctxForNote(note) {
  const inner = stripInner();
  const el = inner && inner.querySelector(`[data-note="${note}"]`);
  return el ? keyCtx(el) : null;
}

/**
 * Which physical key starts the NEXT equave, counted the same way T.rot
 * counts degrees — 0 is wherever the device's own period boundary already
 * falls, which is exactly what floor(slot / period) alone assumes.
 *
 * That assumption is only sound when the written scale actually turns over
 * every `period` keys. An isomorphic keyboard built for its own equal
 * division does — but a generalized keyboard mapping a handful of physical
 * keys onto a LARGER division (19 keys carrying a 31-tone gamut, degree by
 * hand-typed degree) can turn over anywhere in the run, wherever the
 * degrees themselves wrap back down. Left at the device's own boundary,
 * the material keeps climbing right up to the edge and then drops — the
 * "Rotate MIDI Number" control moves the boundary to wherever it belongs
 * instead, per device on a stacked rig, once for the whole keyboard
 * otherwise.
 */
function midiRotFor(udev) {
  if (perDeviceCustom()) return (T.midiRotByDevice || {})[udev] | 0;
  return T.midiRot | 0;
}

/** floor(x / period), pivoted so the boundary sits at `piv` instead of at a
 *  multiple of `period` — and is exactly floor(x / period) when piv is 0,
 *  so a keyboard that never touches the control reads precisely as it
 *  always did. */
function pivotEq(x, piv, period) {
  return Math.floor((x - piv) / period) - Math.floor(-piv / period);
}

/**
 * The degree a key names, and how many times it has wrapped — its own
 * device's, when Custom is reading a stacked rig device by device; the
 * rig's flat one otherwise, and always for Auto.
 */
function keyDegree(note, ctx) {
  if (perDeviceCustom() && ctx) {
    const slot = ctx.local + T.rot;
    return { d: mod(slot, ctx.uperiod), eq: pivotEq(slot, midiRotFor(ctx.udev), ctx.uperiod),
             N: ctx.uperiod, udev: ctx.udev };
  }
  const N = equaveNotes(), slot = note + T.rot;
  return { d: mod(slot, N), eq: pivotEq(slot, midiRotFor(0), N), N, udev: 0 };
}

/** Where a degree's typed entry lives in T.custom — see the note above. */
const customKey = (d, udev) => perDeviceCustom() ? (udev * 1000 + d) : d;

/** entryOf and isTyped, addressed by the composite key customKey gives —
 *  identical to entryOf(d,N)/isTyped(d) whenever customKey(d,udev) === d,
 *  which is every reading that is not Custom-on-a-stacked-rig. */
function entryOfKey(key, d, N) {
  if (T.system === 'custom') {
    const e = T.custom[key];
    if (e && e.kind) return e;
  }
  return autoEntry(d, N);
}
const isTypedKey = (key) => T.system === 'custom' && !!(T.custom[key] && T.custom[key].kind);

/** typedCount(), for one device's own run of degrees. */
function typedCountFor(udev, N) {
  let n = 0;
  for (let d = 0; d < N; d++) if (isTypedKey(customKey(d, udev))) n++;
  return n;
}

/**
 * What key `i` carries.
 *
 * `ctx`, when given, is the key's own device and place in it (see keyCtx) —
 * what Custom reads on a stacked rig. Without it, or off Custom, or off a
 * rig that is not stacked, the rig's one flat reading is exactly what it
 * always was: `slot` walks the scale from key 0 with the rotation applied,
 * the degree is that position folded into the scale and the equave count is
 * how many times it wrapped.
 */
function pitchOf(i, ctx) {
  const { d, eq, N, udev } = keyDegree(i, ctx);
  const key = customKey(d, udev);
  const e = entryOfKey(key, d, N);
  const cents = entryCents(e);
  /* The transposition is ONE interval added to every key of a device alike
   * — its OWN device, on a stacked Custom rig, since a lower and an upper
   * keyboard pressing Transpose together still move each by its own MIDI
   * Number (see shiftCentsFor) — so it moves the pitch and touches neither
   * the degree nor the entry the name is spelled from. */
  return { deg: d, eq, entry: e, typed: isTypedKey(key), cents, edoN: N,
           hz: T.hz * Math.pow(2,
             (cents + eq * 1200 + T.equaveShift * shiftCentsFor(udev, N)) / 1200) };
}

/* ---------------------------------------------------------------------
 *  What one press of Transpose is worth
 *
 *  Counted in KEYS, because that is the unit a MIDI note number is in and
 *  the unit the player's hand is in.  `n` keys up from 1/1 is whatever the
 *  scale actually puts there — degree n of it, plus an equave for every time
 *  the count wrapped — so on an equal division it is n steps and on a typed
 *  scale it is the interval that scale really spans.  At the default, which
 *  is Design's Notes in Scale, that is exactly one equave.
 * ------------------------------------------------------------------ */

/** Keys per press.  Null, or anything out of range, follows the keyboard. */
function shiftKeys() {
  const n = T.trStep | 0;
  return (n >= 1 && n <= 128) ? n : equaveNotes();
}

/** True while the step is the one Design implies rather than one typed in. */
const shiftAuto = () => !(T.trStep >= 1 && T.trStep <= 128);

/** What those keys come to, in cents. */
function shiftCents() {
  const K = shiftKeys(), N = equaveNotes();
  return entryCents(entryOf(mod(K, N), N)) + Math.floor(K / N) * 1200;
}

/** Keys per press, for one device's own MIDI Number — the field beside its
 *  own name on a stacked rig. Off a stacked rig this is exactly shiftKeys(),
 *  since T.trStepByDevice is never consulted there. */
function shiftKeysFor(udev, N) {
  if (!perDeviceCustom()) return shiftKeys();
  const n = (T.trStepByDevice || {})[udev] | 0;
  return (n >= 1 && n <= 128) ? n : N;
}

/** True while a device's own MIDI Number is the one its Notes in Scale
 *  implies rather than one typed into its own field. */
function shiftAutoFor(udev) {
  if (!perDeviceCustom()) return shiftAuto();
  const n = (T.trStepByDevice || {})[udev];
  return !(n >= 1 && n <= 128);
}

/** shiftCents(), for one device's own MIDI Number.  Off a stacked-Custom
 *  rig this is exactly shiftCents(), unchanged — every non-stacked keyboard
 *  and every Auto reading transposes exactly as it always did. */
function shiftCentsFor(udev, N) {
  if (!perDeviceCustom()) return shiftCents();
  const K = shiftKeysFor(udev, N), d = mod(K, N), eq = Math.floor(K / N);
  return entryCents(entryOfKey(customKey(d, udev), d, N)) + eq * 1200;
}

/* ---------------------------------------------------------------------
 *  The name that pitch is written with
 *
 *  Chosen by WHAT THE DEGREE IS, not by a global reading: the three notation
 *  groups in the panel are three answers to three different questions, and a
 *  key answers whichever one it is an instance of.  A cents figure is an
 *  instance of none of them and is written as itself, because inventing a
 *  spelling for an arbitrary interval would be a name the key does not have.
 * ------------------------------------------------------------------ */

function nameHtml(p) {
  const e = p.entry;
  if (e.kind === 'cents') return `${num2(e.cents)}<span class="tune-letter">¢</span>`;
  if (e.kind === 'edo') return edoHtml(e, p.edoN);
  if (T.jiRead === 'ratio') return `${e.num}/${e.den}`;
  const spellable = within(e.num) && within(e.den);
  if (!spellable) return `${e.num}/${e.den}`;   // outside the 89-limit
  const monzo = ratioMonzo(e.num, e.den);
  if (T.jiRead === 'heji') {
    const n = hejiName(monzo);
    return n ? `${letter(n.letter)}${n.html}` : `${e.num}/${e.den}`;
  }
  const sp = sagittalSpellings(e.num, e.den, {
    precision: T.sagPrecision,
    useEvo: T.sagFlavour === 'evo',
    useUnicode: true,      // the glyph, never the ASCII transliteration
    showEnh: false,
  })[0];
  if (!sp) return `${e.num}/${e.den}`;
  return `${letter(sp.letter)}<span class="sag-symbol">${sp.symbol}</span>`;
}

/**
 * A step of a division, written.
 *
 * A step of some other division than the keyboard's own keeps its
 * denominator, because 7 alone would not say which seven — and a step that
 * is not a whole number of a whole division has no ups-and-downs spelling at
 * all, so it stays as it was written.
 */
function edoHtml(e, N) {
  const bare = Number.isInteger(e.step) && Number.isInteger(e.edo);
  const plain = (bare && e.edo === N) ? String(e.step) : entryText(e);
  if (T.edoRead === 'step' || !bare) return plain;
  const sp = edoName(e.step, e.edo, {
    showEnh: false,
    excludeHalves: T.edoHalves === 'exclude',
  }).spellings[0];
  if (!sp || sp.base === 'n/a') return plain;
  return `<span class="edo-name">${esc(sp.base)}${esc(sp.acc)}</span>`;
}

/** Whether a whole number factors inside the table the spellers know. */
const PRIMES89 = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53,
                  59, 61, 67, 71, 73, 79, 83, 89];
function within(x) {
  let n = x;
  for (const p of PRIMES89) while (n % p === 0) n /= p;
  return n === 1;
}

/** Plain text for a tooltip, where the glyph fonts cannot reach. */
function nameText(p) {
  const e = p.entry;
  const what = e.kind === 'ratio' ? `${e.num}/${e.den}`
             : e.kind === 'cents' ? `${num2(e.cents)}¢`
             : `step ${num(e.step)} of ${num(e.edo)}`;
  return `degree ${p.deg} · ${what}` +
    (p.typed ? ' (typed)' : '') +
    (p.eq ? ` · ${p.eq > 0 ? '+' : ''}${p.eq} equave` : '');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* The nominal is set in Inter beside the glyph fonts, as it is in the Tuner —
 * not in whatever the strip happens to be set in. */
const letter = (s) => `<span class="tune-letter">${esc(s)}</span>`;

/* ---------------------------------------------------------------------
 *  Writing it onto the keyboard
 * ------------------------------------------------------------------ */

/**
 * Put a name inside every key of the strip.
 *
 * Called by buildStrip, which tears the strip down and builds it again from
 * the layout — so this both labels the keys and settles the frequency table,
 * and there is exactly one place where the two can fall out of step.
 */
function label() {
  const inner = document.getElementById('stripInner');
  if (!inner) return;
  /* The rotation is folded before anything is computed off it, so what the
   * readout shows and what the keys carry can never be a pass apart. */
  T.rot = mod(T.rot, equaveNotes());
  T.midiRot = mod(T.midiRot, equaveNotes());
  if (perDeviceCustom() && typeof window.rigDevices === 'function') {
    for (const dv of window.rigDevices()) {
      if (T.midiRotByDevice && dv.slot in T.midiRotByDevice)
        T.midiRotByDevice[dv.slot] = mod(T.midiRotByDevice[dv.slot], dv.period);
    }
  }
  syncUI();
  const freqs = {};

  for (const el of inner.querySelectorAll('[data-note]')) {
    const i = +el.dataset.note;
    const p = pitchOf(i, keyCtx(el));
    freqs[i] = p.hz;
    const span = document.createElement('span');
    span.className = 'kb-tune';
    span.innerHTML = nameHtml(p);
    el.appendChild(span);
    el.dataset.deg = p.deg;
    /* The title the key already carries says what it IS; this says what it
     * sounds. Appended rather than replaced so neither answer is lost. */
    el.title = (el.title ? el.title + '  ·  ' : '') +
      `${nameText(p)} · ${p.hz.toFixed(4)} Hz`;
  }
  window.XTuning.freqs = freqs;
  window.XTuning.notesEq = equaveNotes();
  /* How many notes it takes to come back to the same pitch class.  Custom
   * keeps the arrangement's own period — a typed degree replaces a degree
   * rather than adding one — so this is one number now where it used to be
   * two, and nothing downstream has to ask which system is loaded. */
  window.XTuning.scaleNotes = equaveNotes();
  /* What one press of Transpose is worth, for MIDI's readout — it is no
   * longer always an octave, and never was always 1200 cents. */
  window.XTuning.shiftCents = shiftCents();
  window.XTuning.shiftKeys = shiftKeys();
  /* The editor was standing on a key that has just been destroyed and
   * rebuilt; it is put back on the same key, or on the one Enter asked to
   * move to.  Done here rather than by the committer because THIS is the
   * pass that made the new keys. */
  restoreEditor();
  /* Anything downstream that has to restate a pitch — MIDI's readout —
   * hears about it here rather than polling, because this is the one place
   * the table is settled. */
  window.dispatchEvent(new CustomEvent('xenachord:tuning'));
}

/**
 * Every control here comes through, and so does every rebuild of the layout.
 *
 * The strip is rebuilt rather than patched: a label lives inside the key it
 * names, and building the strip is the only thing that knows where the keys
 * are. buildStrip calls label on its way out, so this is one path, not two.
 */
function refresh() {
  save();
  if (typeof window.buildStrip === 'function') window.buildStrip();
  else label();
}

/* ---------------------------------------------------------------------
 *  Transposition
 * ------------------------------------------------------------------ */

/**
 * How far the transposition is allowed to run.
 *
 * The bound is on the DISTANCE, not on the count: four octaves either way
 * puts a 1/1 of 261 Hz between 16 Hz and 4.2 kHz, and the keyboard on top of
 * that — which is the whole of what is left to hear. Past it the control
 * would only be a way of turning the instrument off. So a press of one key
 * gets many more presses than a press of a whole equave does, and both stop
 * at the same place.
 */
const SHIFT_CENTS_LIMIT = 4800;
const shiftLimitCents = (c) => {
  const ac = Math.abs(c);
  return ac > 1 ? Math.max(1, Math.min(256, Math.round(SHIFT_CENTS_LIMIT / ac))) : 4;
};
const shiftLimit = () => shiftLimitCents(shiftCents());

/** The same, but for a stacked-Custom rig: one press moves every device by
 *  its OWN MIDI Number, so the bound is the tightest of theirs — whichever
 *  device's press would first put a pitch somewhere nobody could follow. */
function shiftLimitRig() {
  if (!perDeviceCustom()) return shiftLimit();
  const devs = typeof window.rigDevices === 'function' ? window.rigDevices() : [];
  let lim = shiftLimit();
  for (const dv of devs) lim = Math.min(lim, shiftLimitCents(shiftCentsFor(dv.slot, dv.period)));
  return lim;
}

/**
 * Move the whole instrument by whole equaves.
 *
 * Everything follows from re-labelling: the strip is rebuilt, so the pitches
 * on the keys, the frequency table Play sounds from and the tooltips are one
 * pass and cannot disagree.
 *
 * @returns the shift actually taken, which is the asked-for one clamped.
 */
function setEquaveShift(n) {
  const L = shiftLimitRig();
  const v = Math.max(-L, Math.min(L, n | 0));
  if (v !== T.equaveShift) { T.equaveShift = v; refresh(); }
  return T.equaveShift;
}

/* ---------------------------------------------------------------------
 *  Typing a pitch onto a key
 *
 *  The strip is torn down and rebuilt on every pass, so the box that opens on
 *  a key cannot survive a commit — and it does not have to.  What survives is
 *  a note number: which key the box was on, or which one Enter asked to move
 *  to.  label() puts the box back at the end of the rebuild that made the new
 *  keys, so the sequence "type, Enter, type" reads as one continuous edit
 *  even though the strip underneath it was replaced twice.
 * ------------------------------------------------------------------ */

/** Armed for typing rather than for playing. */
let armed = false;
/** The note the open box is on, and the note to re-open on after a rebuild. */
let editNote = null, pending = null;
/** True while the box is being torn down, so its own blur is not a commit. */
let closing = false;
/** The degree last typed on or clicked, and which device it was on, for the
 *  panel's readout. */
let lastDeg = null, lastUdev = 0;
/** Degrees whose line in the fill list did not parse, on the last input. */
let scaleListErrors = null;

const stripInner = () => document.getElementById('stripInner');

function setArmed(on) {
  const v = !!on && T.system === 'custom';
  if (v === armed) return;
  armed = v;
  document.body.classList.toggle('tune-edit', armed);
  /* Nothing may be left ringing under a keyboard that has stopped being an
   * instrument — the key it was pressed on is about to become a text field. */
  if (armed && window.XPlay) window.XPlay.releaseAll();
  if (!armed) closeEditor(false);
  syncUI();
}

/** Every element that draws this note — a rig draws the same degree more
 *  than once, and all of them are the same key as far as typing goes. */
const notesEls = (n) =>
  document.querySelectorAll(`#stripInner [data-note="${n}"]`);

function openEditor(note) {
  closeEditor(true);          // commit whatever was open before moving on
  const inner = stripInner();
  const el = inner && inner.querySelector(`[data-note="${note}"]`);
  if (!el) { editNote = null; return; }
  editNote = note;
  const ctx = keyCtx(el), kd = keyDegree(note, ctx);
  lastDeg = kd.d; lastUdev = kd.udev;
  for (const e of notesEls(note)) e.classList.add('editing');

  const box = document.createElement('div');
  box.className = 'kb-edit';
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.spellcheck = false;
  inp.value = entryText(entryOfKey(customKey(kd.d, kd.udev), kd.d, kd.N));
  /* WHAT THE BOX OPENED WITH.  Stepping across the keyboard opens a box on
   * every key it passes, and each of them commits on the way out — so a
   * commit of text nobody touched has to be nothing at all.  Otherwise
   * merely visiting a degree would type its Auto reading onto it, and "4 of
   * 19 typed" would be counting keys you only looked at. */
  box.dataset.was = inp.value;
  const tip = document.createElement('div');
  tip.className = 'tip';
  box.appendChild(inp);
  box.appendChild(tip);

  /* Placed off the two boxes' own rectangles rather than off the layout
   * numbers, so it lands on the key wherever the rig has put it and however
   * far the strip is scrolled. */
  const r = el.getBoundingClientRect(), ir = inner.getBoundingClientRect();
  box.style.left = (r.left - ir.left + r.width / 2) + 'px';
  box.style.top = (r.top - ir.top + Math.max(6, r.height / 2 - 20)) + 'px';
  inner.appendChild(box);

  const readout = () => {
    const p = parseInterval(inp.value, kd.N);
    if (!inp.value.trim()) { tip.className = 'tip'; tip.textContent = 'blank clears it'; return; }
    if (!p) { tip.className = 'tip bad'; tip.textContent = 'not an interval'; return; }
    tip.className = 'tip ok';
    tip.textContent = `${num2(entryCents(p))}¢`;
  };
  readout();
  inp.addEventListener('input', readout);

  inp.addEventListener('keydown', (ev) => {
    ev.stopPropagation();     // the arrow keys transpose; not in here they don't
    if (ev.key === 'Escape') { ev.preventDefault(); closeEditor(false); }
    else if (ev.key === 'Enter' || ev.key === 'Tab') {
      ev.preventDefault();
      pending = nextNote(note, ev.shiftKey ? -1 : +1);
      closeEditor(true);
    }
  });
  /* Clicking out of the key IS the commit — the gesture the panel describes,
   * and the same one that lands on the next key when that is where you
   * clicked. */
  inp.addEventListener('blur', () => { if (!closing) closeEditor(true); });

  inp.focus();
  inp.select();
}

/** Where Enter goes: the next key along, wrapping at the end of the run. */
function nextNote(note, dir) {
  const all = [...document.querySelectorAll('#stripInner [data-note]')]
    .map((e) => +e.dataset.note);
  const uniq = [...new Set(all)].sort((a, b) => a - b);
  if (!uniq.length) return null;
  const i = uniq.indexOf(note);
  if (i < 0) return uniq[0];
  return uniq[mod(i + dir, uniq.length)];
}

/**
 * Take the box down.
 *
 * @param commit  write what was typed onto the degree.  A blank box puts the
 *                degree back to its Auto reading, which is the only way to
 *                un-type one and reads as what it is: rubbing it out.
 */
function closeEditor(commit) {
  const inner = stripInner();
  const box = inner && inner.querySelector('.kb-edit');
  const note = editNote;
  editNote = null;
  for (const e of document.querySelectorAll('#stripInner .editing')) {
    e.classList.remove('editing');
  }
  if (!box) { if (pending != null) { const n = pending; pending = null; openEditor(n); } return; }
  const text = box.querySelector('input').value;
  const untouched = text === box.dataset.was;
  closing = true;
  box.remove();
  closing = false;
  if (!commit || untouched || note == null) {
    if (pending != null) { const n = pending; pending = null; openEditor(n); }
    return;
  }
  const kd = keyDegree(note, ctxForNote(note));
  const key = customKey(kd.d, kd.udev);
  const before = JSON.stringify(T.custom[key] || null);
  if (!text.trim()) delete T.custom[key];
  else {
    const p = parseInterval(text, kd.N);
    if (p) T.custom[key] = p;    // unreadable is left alone rather than lost
  }
  lastDeg = kd.d; lastUdev = kd.udev;
  if (JSON.stringify(T.custom[key] || null) !== before) refresh();
  else if (pending != null) { const n = pending; pending = null; openEditor(n); }
  else syncUI();
}

/** After a rebuild: the box goes back where it was, or where Enter sent it. */
function restoreEditor() {
  if (!armed) return;
  const n = pending != null ? pending : editNote;
  pending = null;
  if (n == null) return;
  editNote = null;               // the element it named is gone; do not commit
  openEditor(n);
}

/* ---- the strip's own pointer, while it is armed ----
 * Capture phase on #strip, beside Play's: Play stops the event reaching the
 * design handlers below and this reads the same event for the key under it.
 * Two listeners on one node both run — stopPropagation only closes the way
 * DOWN — so neither has to know about the other. */
(function bindStrip() {
  const strip = document.getElementById('strip');
  if (!strip) return;
  const noteAt = (ev) => {
    for (const el of document.elementsFromPoint(ev.clientX, ev.clientY)) {
      if (el.closest && el.closest('.kb-edit')) return undefined;
      if (el.dataset && el.dataset.note != null) return +el.dataset.note;
      if (el.id === 'strip' || el === document.body) break;
    }
    return null;
  };
  strip.addEventListener('dblclick', (ev) => {
    if (!armed) return;
    const n = noteAt(ev);
    if (n == null) return;
    ev.preventDefault(); ev.stopPropagation();
    openEditor(n);
  }, true);
  /* One click moves the box on, once it is open.  Opening it in the first
   * place stays a double-click, so an armed strip is not a minefield of
   * accidental edits — but stepping from key to key mid-edit should not cost
   * two clicks each time.
   *
   * WHETHER A BOX WAS OPEN IS DECIDED ON POINTERDOWN, not on the click:
   * pressing elsewhere takes the focus off the input, its blur commits, and
   * by the time the click arrives there is no longer an editor to have been
   * stepping away from.  Pointerdown is the last moment the answer is still
   * the true one. */
  let wasEditing = false;
  strip.addEventListener('pointerdown', (ev) => {
    wasEditing = armed && editNote != null &&
      !(ev.target.closest && ev.target.closest('.kb-edit'));
  }, true);
  strip.addEventListener('click', (ev) => {
    const was = wasEditing; wasEditing = false;
    if (!armed || !was) return;
    const n = noteAt(ev);
    if (n == null || n === editNote) return;
    ev.preventDefault(); ev.stopPropagation();
    openEditor(n);
  }, true);
}());

window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && armed && editNote == null) setArmed(false);
});

/* ---------------------------------------------------------------------
 *  Filling every degree at once
 * ------------------------------------------------------------------ */

/** The fill list, folded into one equave and sorted, as the Tuner builds it.
 *  A declaration rather than a const: the migration above runs before this
 *  point in the file and calls it. */
function scaleDegrees() { return buildJiScale('custom', { custom: T.scale }); }

/**
 * Write the fill list onto the degrees, from 0 up.
 *
 * The old JI system was exactly this and nothing else — a list of ratios laid
 * along the keyboard in order — so it survives as a button rather than as a
 * mode, and what it writes can then be edited a key at a time.
 */
function fillFromScale(into) {
  const out = into || {};
  const ds = scaleDegrees();
  ds.forEach((d, i) => { out[i] = { kind: 'ratio', num: d.num, den: d.den }; });
  return out;
}

/* ---------------------------------------------------------------------
 *  Controls
 * ------------------------------------------------------------------ */

/** A segmented button group: pressing one turns the others off. */
function seg(id, key, after) {
  const box = $(id);
  if (!box) return;
  for (const b of box.querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.v === T[key]);
    b.onclick = () => {
      T[key] = b.dataset.v;
      for (const o of box.querySelectorAll('button')) o.classList.toggle('on', o === b);
      if (after) after();
      refresh();
    };
  }
}

/** What the controls say, brought back into step with what T holds. */
function syncUI() {
  const custom = T.system === 'custom';
  const N = equaveNotes();

  $('t-ref').textContent = NOMINALS[T.nominal] + ACCS[T.acc] + T.oct;

  /* The transposition is set from the MIDI panel and from the arrow keys, so
   * it can be moved without this fieldset being looked at — and it changes
   * what every number above it is worth. It says so here, where 1/1 is
   * defined, rather than only where it was pressed. */
  const K = shiftKeys();
  const tr = $('t-transpose');
  tr.style.display = 'none';

  for (const b of $('t-system-seg').querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.v === T.system);
  }
  $('t-auto').style.display = custom ? 'none' : '';
  $('t-custom').style.display = custom ? '' : 'none';
  $('t-not-ji').style.display = custom ? '' : 'none';
  $('t-sag').style.display = (custom && T.jiRead === 'sagittal') ? '' : 'none';
  // The halves are a question about ups-and-downs spelling; a bare step
  // number has no accidental for the answer to land on, and neither has a
  // division of something other than the octave.
  $('t-edo-halves').style.display = (T.edoRead === 'updown') ? '' : 'none';

  /* ---- Auto ---- */
  $('t-edo-n').textContent = N;
  /* Where the number came from, when it is no longer just Design's own: the
   * stack doubled it, and that is worth saying beside it. */
  const rows = stackDepth(), base = N / rows;
  /* On a rig, WHOSE Notes in Scale — because it is the anchor device's, and
   * editing another device's period must not look like it did nothing. */
  const who = (typeof window.rigAnchorLabel === 'function') ? window.rigAnchorLabel() : '';
  $('t-edo-who').textContent = who ? ` (${who})` : '';
  $('t-edo-rig').innerHTML = rows > 1
    ? `, <b>${base}</b> &times; <b>${rows}</b> interchanged keyboards` : '';

  /* ---- Custom ---- */
  const btn = $('t-cus-edit');
  btn.classList.toggle('on', armed);
  btn.textContent = armed ? '✓ Done editing' : '✎ Edit Keys on the Strip';
  btn.style.borderColor = armed ? 'var(--ok)' : '';
  btn.style.color = armed ? 'var(--ok)' : '';
  const perDev = perDeviceCustom();
  const devices = perDev && typeof window.rigDevices === 'function' ? window.rigDevices() : null;
  if (custom) {
    if (devices && devices.length > 1) {
      $('t-cus-read').innerHTML = devices.map(dv => {
        const t = typedCountFor(dv.slot, dv.period);
        return `<b>${dv.label}</b>: <b>${t}</b> of <b>${dv.period}</b> typed`;
      }).join(' &nbsp;&middot;&nbsp; ') +
        ' &mdash; each keyboard loops its own Notes in Scale independently';
    } else {
      const t = typedCount();
      $('t-cus-read').innerHTML = t
        ? `<b>${t}</b> of <b>${N}</b> degree${N === 1 ? '' : 's'} typed &mdash; ` +
          `the rest read as <b>${N}</b> equal steps of the equave`
        : `all <b>${N}</b> degrees still read as <b>${N}</b> equal steps &mdash; ` +
          `edit any of them and only those change`;
    }
    const sel = $('t-cus-sel');
    const dv = devices && devices.find((x) => x.slot === lastUdev);
    const ownN = dv ? dv.period : N;
    if (lastDeg != null && lastDeg < ownN) {
      const key = customKey(lastDeg, lastUdev);
      const e = entryOfKey(key, lastDeg, ownN);
      sel.innerHTML = (dv ? `<b>${dv.label}</b> ` : '') +
        `degree <b>${lastDeg}</b>: <b>${esc(entryText(e))}</b>` +
        (e.kind === 'cents' ? ''
          : ` &middot; <b>${num2(entryCents(e))}</b>&cent;`) +
        (isTypedKey(key) ? '' : ' <span style="opacity:.7">(auto)</span>');
    } else sel.innerHTML = '';
    /* The list IS the keyboard, one line per degree — but a stacked rig's
     * keyboards loop through different counts of their own degrees, so
     * there is no one flat list any more; typing stays on the strip. */
    $('t-scale-wrap').style.display = perDev ? 'none' : '';
    if (!perDev) {
      /* This is only rewritten while the box does not have focus — mid-edit,
       * the keys already follow the input handler below, and overwriting
       * the value out from under a keystroke would fight the cursor. */
      const st2 = $('t-scale');
      if (document.activeElement !== st2) {
        st2.value = Array.from({ length: N }, (_, d) => entryText(entryOf(d, N))).join('\n');
      }
      $('t-scale-read').innerHTML = scaleListErrors
        ? `<span style="color:var(--warn)">line${scaleListErrors.length === 1 ? '' : 's'} ` +
          `${scaleListErrors.map((d) => d + 1).join(', ')}: not an interval &mdash; ` +
          `left as ${scaleListErrors.length === 1 ? 'it was' : 'they were'}</span>`
        : '';
    }
  }

  /* ---- rotation, and what one press of Transpose is worth ---- */
  $('t-rot-v').textContent = T.rot;
  const stacked = typeof window.rigIsStacked === 'function' && window.rigIsStacked();
  $('m-tr-step-row').style.display = stacked ? 'none' : '';
  $('m-tr-step-rig').style.display = stacked ? '' : 'none';
  if (!stacked) {
    const st = $('m-tr-step');
    if (document.activeElement !== st) st.value = shiftAuto() ? '' : String(K);
    st.placeholder = String(N);
  } else {
    const rigDevs = (typeof window.rigDevices === 'function' ? window.rigDevices() : [])
      .slice().sort((a, b) => a.slot - b.slot);
    /* Upper first, lower second, whatever the two devices' slots are — the
     * fields are named by height, not by number. */
    const upper = rigDevs.find((d) => /upper/.test(d.label)) || rigDevs[rigDevs.length - 1];
    const lower = rigDevs.find((d) => /lower/.test(d.label)) || rigDevs[0];
    for (const [dv, inputId] of
         [[upper, 'm-tr-step-upper'], [lower, 'm-tr-step-lower']]) {
      if (!dv) continue;
      const inp = $(inputId);
      if (document.activeElement !== inp) {
        inp.value = shiftAutoFor(dv.slot) ? '' : String(shiftKeysFor(dv.slot, dv.period));
      }
      inp.placeholder = String(dv.period);
    }
  }

  /* ---- Rotate MIDI Number — where the octave itself turns over ---- */
  $('m-mrot-row').style.display = stacked ? 'none' : '';
  $('m-mrot-rig').style.display = stacked ? '' : 'none';
  if (!stacked) {
    $('m-mrot-v').textContent = mod(T.midiRot, N);
  } else {
    const rigDevs = (typeof window.rigDevices === 'function' ? window.rigDevices() : [])
      .slice().sort((a, b) => a.slot - b.slot);
    const upper = rigDevs.find((d) => /upper/.test(d.label)) || rigDevs[rigDevs.length - 1];
    const lower = rigDevs.find((d) => /lower/.test(d.label)) || rigDevs[0];
    for (const [dv, vid] of [[upper, 'm-mrot-upper-v'], [lower, 'm-mrot-lower-v']]) {
      if (!dv) continue;
      $(vid).textContent = mod((T.midiRotByDevice || {})[dv.slot] | 0, dv.period);
    }
  }
}

function bind() {
  for (const [id, key, cast] of [
    ['t-nominal', 'nominal', Number], ['t-acc', 'acc', Number],
    ['t-oct', 'oct', Number], ['t-sag-precision', 'sagPrecision', String],
  ]) {
    const el = $(id);
    el.value = String(T[key]);
    el.onchange = () => { T[key] = cast(el.value); refresh(); };
  }

  const hz = $('t-hz');
  hz.value = T.hz;
  hz.oninput = () => {
    const v = parseFloat(hz.value);
    if (isFinite(v) && v > 0) { T.hz = v; refresh(); }
  };

  /* The fill list IS the keyboard: each line is one degree, in order, so
   * editing a line writes straight onto the key it names — there is no
   * separate "write onto the keys" step any more, and none of the ratio-list
   * folding the old JI system did, because the list is not an arbitrary
   * scale to fold, it is the degrees themselves. */
  const scale = $('t-scale');
  scale.oninput = () => {
    const N = equaveNotes();
    const lines = scale.value.split('\n');
    const errors = [];
    for (let d = 0; d < N; d++) {
      const line = lines[d] === undefined ? '' : lines[d];
      if (!line.trim()) { delete T.custom[d]; continue; }
      const p = parseInterval(line, N);
      if (p) T.custom[d] = p;
      else errors.push(d);          // unreadable is left alone rather than lost
    }
    scaleListErrors = errors.length ? errors : null;
    refresh();
  };

  /* Blank follows Design's Notes in Scale — which is what "equave" means
   * here, and what it goes back to when you rub the number out. */
  const st = $('m-tr-step');
  st.value = shiftAuto() ? '' : String(shiftKeys());
  st.oninput = () => {
    const v = parseInt(st.value, 10);
    T.trStep = (Number.isFinite(v) && v >= 1 && v <= 128) ? v : null;
    /* The distance one press covers has changed, so a shift taken at the old
     * size may now be past the end of what can be heard. */
    const L = shiftLimitRig();
    T.equaveShift = Math.max(-L, Math.min(L, T.equaveShift));
    refresh();
  };

  /* ---- the same, per device, on a stacked rig ---- */
  const findDevice = (upper) => {
    const devs = typeof window.rigDevices === 'function' ? window.rigDevices() : [];
    return devs.find((d) => (upper ? /upper/ : /lower/).test(d.label)) ||
      (upper ? devs[devs.length - 1] : devs[0]);
  };
  const bindDeviceStep = (inputId, upper) => {
    const inp = $(inputId);
    inp.oninput = () => {
      const dv = findDevice(upper);
      if (!dv) return;
      const v = parseInt(inp.value, 10);
      T.trStepByDevice = T.trStepByDevice || {};
      if (Number.isFinite(v) && v >= 1 && v <= 128) T.trStepByDevice[dv.slot] = v;
      else delete T.trStepByDevice[dv.slot];
      const L = shiftLimitRig();
      T.equaveShift = Math.max(-L, Math.min(L, T.equaveShift));
      refresh();
    };
  };
  bindDeviceStep('m-tr-step-upper', true);
  bindDeviceStep('m-tr-step-lower', false);

  /* ---- Rotate MIDI Number — where the octave itself turns over ---- */
  const mrot = (id, span) => { $(id).onclick = () => { T.midiRot += span; refresh(); }; };
  mrot('m-mrot-dn', -1);
  mrot('m-mrot-up', +1);
  const mrotDevice = (prefix, upper, span) => {
    $(prefix).onclick = () => {
      const dv = findDevice(upper);
      if (!dv) return;
      T.midiRotByDevice = T.midiRotByDevice || {};
      T.midiRotByDevice[dv.slot] = ((T.midiRotByDevice[dv.slot] | 0) + span);
      refresh();
    };
  };
  mrotDevice('m-mrot-upper-dn', true, -1);
  mrotDevice('m-mrot-upper-up', true, +1);
  mrotDevice('m-mrot-lower-dn', false, -1);
  mrotDevice('m-mrot-lower-up', false, +1);

  /* Leaving Custom puts the editor away: the strip in Auto has nothing to
   * type on, and an armed keyboard that will not take a keystroke would be
   * worse than no arming at all. */
  seg('t-system-seg', 'system', () => { if (T.system !== 'custom') setArmed(false); });
  seg('t-edo-seg', 'edoRead');
  seg('t-edo-halves', 'edoHalves');
  seg('t-ji-seg', 'jiRead');
  seg('t-sag-flavour', 'sagFlavour');

  $('t-cus-edit').onclick = () => setArmed(!armed);
  $('t-cus-reset').onclick = () => {
    closeEditor(false);
    T.custom = {}; lastDeg = null; scaleListErrors = null; refresh();
  };

  const rot = (id, span) => { $(id).onclick = () => { T.rot += span; refresh(); }; };
  rot('t-rot-dn', -1);
  rot('t-rot-up', +1);
}

/* ---------------------------------------------------------------------
 *  A TUNING THAT ARRIVED FROM SOMEWHERE ELSE
 *
 *  Export's share link and layout file carry the tuning with the keyboard,
 *  because a scale is not a setting that happens to be on beside a layout —
 *  it is half of what a microtonal keyboard IS.  A 17-note arrangement sent
 *  without what its 17 degrees sound is a picture of an instrument.
 *
 *  ONLY THE FIELDS T ALREADY HAS ARE TAKEN.  The default object above is
 *  the whole vocabulary, so a payload from a newer build cannot write a key
 *  this one does not understand, and every value that lands is put through
 *  the same normalising an older stored session goes through.
 * ------------------------------------------------------------------ */
function adopt(next) {
  if (!next || typeof next !== 'object') return false;
  for (const k of Object.keys(T)) if (k in next) T[k] = next[k];

  /* the same repairs a session off disk gets — a shared tuning is exactly
   * as untrusted as a stored one, and for the same reason */
  if (!isFinite(+T.hz) || +T.hz <= 0) T.hz = 261.6256;
  T.hz = +T.hz;
  T.nominal = Math.max(0, Math.min(6, T.nominal | 0));
  T.acc = Math.max(0, Math.min(2, T.acc | 0));
  T.oct = Math.max(-4, Math.min(7, T.oct | 0));
  if (T.system !== 'auto' && T.system !== 'custom') T.system = 'auto';
  if (!T.custom || typeof T.custom !== 'object') T.custom = {};
  if (!T.trStepByDevice || typeof T.trStepByDevice !== 'object') T.trStepByDevice = {};
  if (!T.midiRotByDevice || typeof T.midiRotByDevice !== 'object') T.midiRotByDevice = {};
  T.rot |= 0;
  T.midiRot |= 0;
  T.trStep = Number.isFinite(+T.trStep) && +T.trStep >= 1 && +T.trStep <= 128
    ? (+T.trStep | 0) : null;
  T.equaveShift = Math.max(-shiftLimit(), Math.min(shiftLimit(), T.equaveShift | 0));

  /* nothing may be left ringing at a pitch that has just stopped existing,
   * and the Custom editor must not stay armed over a scale it did not open */
  window.XPlay?.releaseAll?.();
  setArmed(false);
  bind();            // the controls come back into step with T
  refresh();         // ... and the strip, the freq table and localStorage
  return true;
}

window.XTuning = {
  label, refresh, adopt, setEquaveShift, shiftLimit,
  /** Play asks this before it sounds anything, and the mode switch calls the
   *  setter on its way out of Play. */
  editing: () => armed,
  disarmEdit: () => setArmed(false),
  settings: T, freqs: {}, notesEq: 32, scaleNotes: 32,
  shiftCents: 1200, shiftKeys: 32,
};
bind();
/* The module is deferred, so the layout is already standing by the time it
 * runs and the strip has been built once without any names on it. */
refresh();
