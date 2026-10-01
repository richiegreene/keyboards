/* =====================================================================
 *  THE SOUNDING END
 * =====================================================================
 *
 * One AudioContext, one worklet node, and the numbers the worklet needs kept
 * up to date: where the Timbre slider stands, what the envelope is, and where
 * a controller's pitch wheel is. Everything expensive — the band-limited
 * tables — is built here on the main thread and posted across, because the
 * audio thread has 128 samples to fill and no business doing additive
 * synthesis inside them.
 *
 * The context is not created until the first touch in Play. A browser will not
 * start one without a gesture, and a page that asks for audio before anybody
 * asked to hear anything is a page that gets muted.
 * ------------------------------------------------------------------ */

import { FILTERED_MIN, familyOf } from './timbre.js';
import { shapeTablesFor } from './tables.js';

let ctx = null;
let node = null;
let ready = null;          // the promise the worklet module is loading on
let timbre = FILTERED_MIN + 200;   // filtered saw
let adsr = { a: 0.016, d: 0.067, s: 0.38, r: 0.544 };
let bend = 0;              // cents, the pitch wheel
let shapesSent = false;    // has the node been given the four shapes' tables?

/** The one context, made the first time anything asks for it. */
function context() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  /* AN iPHONE ON SILENT PLAYS NO WEB AUDIO unless the page says it is
   * playing, not decorating: the default session is the one a game's
   * sound effects use, and the ringer switch mutes it. An instrument is
   * what the switch is not meant to silence. */
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  ctx = new AC();
  ctx.addEventListener('statechange', flushOffs);
  return ctx;
}

/** Bring the audio up, once. Safe to call on every key. */
export function start() {
  if (ready) return ready;
  const c = context();
  if (!c || !c.audioWorklet) {
    ready = Promise.reject(new Error('no Web Audio'));
    ready.catch(() => {});
    return ready;
  }
  ready = c.audioWorklet.addModule('synth/voice-processor.js').then(() => {
    node = new AudioWorkletNode(ctx, 'xenachord-voice', {
      outputChannelCount: [2],
      // Configured at construction, so the first key cannot beat the first
      // message across the port — see the processor's constructor.
      processorOptions: { setup: setup() },
    });
    node.connect(ctx.destination);
    flushOffs();
  });
  return ready;
}

/**
 * Everything the worklet needs to hold, as the messages that say it — the
 * state a node is built in. A running node is kept in the same state by the
 * setters below, each sending only what it changed.
 */
function setup() {
  const msgs = [];
  if (familyOf(timbre) === 'wavetable') msgs.push(shapes());
  msgs.push({ t: 'timbre', value: timbre });
  msgs.push({ t: 'adsr', ...adsr });
  msgs.push({ t: 'bend', cents: bend });
  return msgs;
}

/**
 * The four shapes' tables, for the wavetable family. Built once and sent
 * once — and only when that family is wanted, so a keyboard that stays
 * filtered never pays the ~60 ms they take to build. Posting clones them.
 */
function shapes() {
  shapesSent = true;
  return { t: 'shapes', mips: shapeTablesFor(ctx.sampleRate) };
}

/**
 * Where the Timbre slider stands. One number however it got there — the
 * slider, a shared layout, or the mod wheel sliding it — and the worklet
 * glides there and blends whatever lies between two shapes itself, so no
 * position costs a table.
 */
export function setTimbre(v) {
  timbre = v;
  if (!node) return;
  if (!shapesSent && familyOf(v) === 'wavetable') node.port.postMessage(shapes());
  node.port.postMessage({ t: 'timbre', value: v });
}

export function setAdsr(next) {
  adsr = { ...adsr, ...next };
  if (node) node.port.postMessage({ t: 'adsr', ...adsr });
}

/**
 * Where a controller's pitch wheel has the whole instrument, in cents.
 *
 * It does not wake the audio: a wheel is not a gesture the browser will start
 * sound for, and nothing is sounding to bend yet. A wheel turned before the
 * first note is only remembered here, and the node is built already bent
 * (see setup).
 */
export function setBend(cents) {
  bend = cents;
  if (node) node.port.postMessage({ t: 'bend', cents });
}

/**
 * WAKE THE AUDIO, FROM INSIDE THE GESTURE.
 *
 * A phone lets a page start sound only from inside the handler of something
 * it counts as the user asking — and on iOS that is a finger LIFTING
 * (touchend, pointerup, click) or a key, never a finger landing. A key sounds
 * on pointerdown, so the key itself can never be what wakes the audio there;
 * this has to be called from the lifts as well (see play.js), and it has to
 * be called synchronously: resume() behind an await is resume() after the
 * gesture has ended, which is what used to leave a freshly opened phone
 * silent until a slider in the drawer had been touched.
 *
 * Cheap once awake, so it is simply called on every gesture rather than
 * unhooked: a phone that locks, takes a call or changes app puts the audio
 * back to sleep, and the next touch has to be able to wake it again.
 */
export function unlock() {
  const c = context();
  if (!c) return;
  start();
  if (c.state === 'running') return;
  c.resume().catch(() => {});
  /* older WebKit opens its output only once a source has actually started
   * inside the gesture — one silent sample is enough */
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, c.sampleRate);
    src.connect(c.destination);
    src.start(0);
  } catch (e) {}
}

/**
 * Everything the voices are told, in the order it was said.
 *
 * Before the worklet has loaded there is no node to post to, and a note-off
 * dropped there while its note-on waited for the load would leave that note
 * ringing with nothing holding it. So a message sent early waits on the same
 * promise, behind the ones sent before it.
 */
function send(msg) {
  if (node) node.port.postMessage(msg);
  else if (ready) ready.then(() => node.port.postMessage(msg)).catch(() => {});
}

/* ---- THE FIRST TAP ----
 *
 * That tap is both the thing that wakes the audio and the note it was meant
 * to play, and by the time the voices can sound the finger has usually gone:
 * a phone wakes the audio on the lift, and the worklet is still loading for
 * the first few dozen milliseconds anywhere. The note-on and note-off would
 * then reach the voices together, the envelope would release from a level it
 * never reached, and the first key pressed would be silent. So a note-off
 * that arrives before the voices can sound is held back until they can, and
 * let go a moment after: the first tap sounds as a short strike instead of
 * not at all.
 */
const FIRST_TAP_S = 0.12;
const heldOff = new Set();
let heldTimer = 0;
const sounding = () => !!node && ctx.state === 'running';

function flushOffs() {
  if (!ctx || !sounding() || !heldOff.size) return;
  clearTimeout(heldTimer);
  heldTimer = setTimeout(() => {
    for (const id of heldOff) send({ t: 'off', id });
    heldOff.clear();
  }, FIRST_TAP_S * 1000);
}

export function noteOn(id, freq, vel = 1) {
  if (!(freq > 0)) return;
  unlock();
  heldOff.delete(id);           // struck again: this press has its own release
  send({ t: 'on', id, freq, vel });
}

export function noteOff(id) {
  if (ctx && !sounding()) { heldOff.add(id); return; }
  send({ t: 'off', id });
}

export function allOff() {
  heldOff.clear();
  clearTimeout(heldTimer);
  send({ t: 'allOff' });
}
