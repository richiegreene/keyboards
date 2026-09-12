/* =========================================================================
 * Keyboard Designer — SENDING A LAYOUT TO SOMEBODY ELSE
 *
 * A design is small.  Key types by slot, four class widths, the per-key
 * adjustments, the scale, the break on the playing edge — a few hundred
 * bytes of it, and none of it is geometry: the geometry is rebuilt from
 * these numbers by core.js at the other end, exactly as it is here.  So a
 * layout can travel as TEXT, and the two places text travels are a link
 * and a small file.
 *
 * WHY A LINK AND NOT A SERVER.  The app is a folder of files that runs by
 * opening index.html.  There is nothing to upload to and nothing to keep a
 * layout in, and adding one would make the app depend on it being up.  A
 * link that CARRIES the layout in its own address depends on nothing: it
 * works from a file:// copy, from a shared drive, from a web host, and the
 * layout is still there in ten years' time if the link is.
 *
 *   https://…/index.html#kz=<payload>      one keyboard
 *   https://…/index.html#rz=<payload>      a whole rig, devices and all
 *
 * THE PAYLOAD is the design as JSON, compacted, compressed and then
 * base64url'd so it survives being pasted into a chat window, an email, a
 * spreadsheet cell.  Compaction is only renaming: the seven key types
 * become their index in TYPES and the design's long field names become one
 * or two letters.  The version tag `v` is written so a payload from an
 * older build can still be read by a newer one — nothing is dropped
 * silently.
 *
 * WHAT IS AND IS NOT CARRIED.  Everything about the keyboard: the keys,
 * the widths, the ad-hoc per-key adjustments, the sensor-press blend, the
 * scale and the bevel.  Not what the device is CALLED — `noteBase` /
 * `noteStep` are a device's relationship to the others on the desk, and a
 * layout arriving from someone else's rig must not renumber yours.  Not
 * the preset name either: a layout you were sent is yours now, not a
 * pointer into a list you may not have.
 * ========================================================================= */
(function () {
  'use strict';

  const V = 1;

  /* the seven drafted key types, in a fixed order.  APPEND ONLY — an index
   * is what a link says, so moving one would re-read every link ever made. */
  const TYPES = [
    'Full Sized White', 'Full Sized Gray', 'Full Sized Black',
    'Split Black First', 'Split Black Second',
    'Split Gray Second', 'Split Gray First'
  ];
  const XMref = () => (typeof window !== 'undefined' ? window : globalThis).XM;

  /* design field -> short name.  Only fields that MEAN something to the
   * layout: `template` is rebuilt by migrate(), `preset` and the numbering
   * are deliberately left behind (see the header). */
  const FIELDS = [
    ['rotation',   'r'],
    ['slots',      'sl'],
    ['period',     'p'],
    ['scale',      'sc'],
    ['autoScale',  'a'],
    ['origin',     'o'],
    ['widths',     'w'],
    ['keyScale',   'k'],
    ['laneScale',  'l'],
    ['pressBase',  'pb'],
    ['pressBlend', 'pt'],
    ['bevel',      'b']
  ];

  /* ---- base64url over UTF-8, both directions ---- */
  function b64u(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(str) {
    const s = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '='.repeat((4 - s.length % 4) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const packText = (obj) => b64u(new TextEncoder().encode(JSON.stringify(obj)));
  const unpackText = (str) => JSON.parse(new TextDecoder().decode(unb64u(str)));

  /* ---- a design, compacted ---- */
  function packSlots(slots) {
    if (!slots) return undefined;
    const out = {};
    for (const k of Object.keys(slots)) {
      const names = slots[k];
      if (!names || !names.length) continue;
      const codes = names.map(n => TYPES.indexOf(XMref().canonType(n)));
      if (codes.some(c => c < 0)) continue;      // a type this build cannot draw
      out[k] = codes;
    }
    return out;
  }
  function unpackSlots(sl) {
    const out = {};
    if (!sl) return out;
    for (const k of Object.keys(sl)) {
      const codes = sl[k];
      if (!Array.isArray(codes) || !codes.length) continue;
      const names = codes.map(c => TYPES[c | 0]).filter(Boolean);
      if (names.length) out[k] = names;
    }
    return out;
  }

  /* WHAT A DESIGN DOES NOT NEED TO SAY.  These three are exactly what an
   * ABSENT field already means at the other end — migrate() fills in
   * autoScale, and `origin` and `rotation` are read as "centre" and 0
   * wherever they are missing — so writing them down says nothing twice.
   *
   * `bevel` is deliberately NOT in this list.  Absent bevel means "this
   * design has nothing to say about the playing edge" and the caller
   * decides what that silence is (see carryBevel in index.html), which is
   * not the same as a bevel of 2 written down. */
  const SILENT = { r: 0, a: true, o: 'centre' };

  /** one keyboard -> the object a payload is made of */
  function packDesign(d) {
    const out = { v: V };
    for (const [long, short] of FIELDS) {
      let val = d[long];
      if (val === undefined || val === null) continue;
      if (long === 'slots') val = packSlots(val);
      if (val === undefined) continue;
      if (typeof val === 'object' && !Object.keys(val).length) continue;
      if (SILENT[short] === val) continue;
      out[short] = val;
    }
    return out;
  }

  /** ... and back.  Anything the payload does not carry is simply absent,
   *  which is what the app's own migrate() is for. */
  function unpackDesign(o) {
    if (!o || typeof o !== 'object') return null;
    const d = {};
    for (const [long, short] of FIELDS) {
      if (o[short] === undefined) continue;
      d[long] = (long === 'slots') ? unpackSlots(o[short]) : o[short];
    }
    if (!d.slots) d.slots = {};
    d.template = [null, null, null, null, null, null, null];
    return d;
  }

  /** a rig -> payload.  The shape of the desk travels with the keyboards on
   *  it, so a stacked pair opens as a stacked pair. */
  function packRig(rig) {
    const units = {};
    for (const slot of Object.keys(rig.units || {}))
      if (rig.units[slot]) units[slot] = packDesign(rig.units[slot]);
    return { v: V, side: !!rig.side, stack: !!rig.stack, sel: rig.sel | 0, u: units };
  }
  function unpackRig(o) {
    if (!o || typeof o !== 'object' || !o.u) return null;
    const units = {};
    for (const slot of Object.keys(o.u)) {
      const d = unpackDesign(o.u[slot]);
      if (d) units[slot] = d;
    }
    if (!units[0]) return null;
    return { side: !!o.side, stack: !!o.stack, sel: o.sel | 0, units };
  }

  /* ---- AND WHAT THE KEYBOARD SOUNDS LIKE ---------------------------
   *
   * A LAYOUT WITHOUT ITS TUNING IS A PICTURE OF AN INSTRUMENT.  A 17-note
   * arrangement is 17 keys until somebody says what the 17 degrees sound,
   * and on a microtonal keyboard that is not a preference sitting beside
   * the design — it is half of what was designed.  So the whole of Play
   * travels with it, in one `x` section beside the keyboard:
   *
   *   t   Scale/Tuning — where 1/1 is written and what it sounds at, Auto
   *       or Custom, the reading conventions, the rotation, the fill list,
   *       every degree typed onto the strip, and the transposition.
   *   s   the synth — timbre and the ADSR envelope.
   *   m   how a controller is laid on the keys — the MIDI note that plays
   *       key 0, and whether velocity is taken.
   *
   * WHAT IS DELIBERATELY LEFT OUT is in midi.js: whether this browser has
   * been let at the MIDI ports (a consent, which is not transferable and
   * certainly not by opening a link) and which port it was listening to (a
   * socket on the machine it was saved on).  Nothing else about Play is
   * per-machine, so nothing else is withheld.
   *
   * The three sections are read back by the modules that own them —
   * XTuning.adopt, XPlay.adopt, XMidi.adopt — each of which normalises
   * what it is handed, because a payload is exactly as untrusted as a
   * stored session and gets the same repairs.
   */
  function playNow() {
    const W = (typeof window !== 'undefined') ? window : globalThis;
    const x = {};
    if (W.XTuning && W.XTuning.settings) x.t = W.XTuning.settings;
    if (W.XPlay && W.XPlay.settings) x.s = W.XPlay.settings;
    if (W.XMidi && W.XMidi.shared) x.m = W.XMidi.shared();
    return Object.keys(x).length ? JSON.parse(JSON.stringify(x)) : null;
  }

  /** hand each section to the module that owns it; returns what was taken */
  function applyPlay(x) {
    if (!x || typeof x !== 'object') return [];
    const W = (typeof window !== 'undefined') ? window : globalThis;
    const took = [];
    if (x.t && W.XTuning && W.XTuning.adopt && W.XTuning.adopt(x.t)) took.push('tuning');
    if (x.s && W.XPlay && W.XPlay.adopt && W.XPlay.adopt(x.s)) took.push('sound');
    if (x.m && W.XMidi && W.XMidi.adopt && W.XMidi.adopt(x.m)) took.push('MIDI');
    return took;
  }

  /* A TYPED DEGREE, WRITTEN SHORT.  tuning.js holds a Custom degree as one
   * of three named shapes; a payload holds the same three as small arrays,
   * which is a third of the characters for the same three facts.  Objects
   * are still READ, so a link or a file written before this opens.  A kind
   * this build does not know is passed through untouched rather than
   * dropped — a newer app's link should lose nothing on the way back. */
  function packEntry(e) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return e;
    if (e.kind === 'ratio') return [0, e.num, e.den];
    if (e.kind === 'edo')   return [1, e.step, e.edo];
    if (e.kind === 'cents') return [2, e.cents];
    return e;
  }
  function unpackEntry(a) {
    if (!Array.isArray(a)) return a;
    if (a[0] === 0) return { kind: 'ratio', num: a[1], den: a[2] };
    if (a[0] === 1) return { kind: 'edo',   step: a[1], edo: a[2] };
    if (a[0] === 2) return { kind: 'cents', cents: a[1] };
    return null;
  }
  function mapCustom(x, f) {
    if (!x || !x.t || !x.t.custom || typeof x.t.custom !== 'object') return x || null;
    const custom = {};
    for (const k of Object.keys(x.t.custom)) {
      const e = f(x.t.custom[k]);
      if (e) custom[k] = e;
    }
    return Object.assign({}, x, { t: Object.assign({}, x.t, { custom }) });
  }
  const packPlay   = x => mapCustom(x, packEntry);
  const unpackPlay = x => mapCustom(x, unpackEntry);

  /* HOW FINELY A NUMBER IS WRITTEN DOWN.  Four decimal places, and this is
   * the one place where something is actually thrown away rather than
   * renamed, so it is worth being plain about what: a key scale of
   * 0.773419 becomes 0.7734, which is four ten-thousandths of a millimetre
   * on a 130mm key — an order below what any printer resolves — and an
   * envelope of 0.3400562110173516 stops claiming it was ever measured
   * that finely.  Integers are left alone. */
  const DP = 10000;
  const rounded = (o) => JSON.parse(JSON.stringify(o, (k, v) =>
    (typeof v === 'number' && Number.isFinite(v) && !Number.isInteger(v))
      ? Math.round(v * DP) / DP : v));

  /* ---- SHORTER THAN THAT: THE PAYLOAD COMPRESSED ----------------------
   *
   * A link has to fit where links are pasted, and the tightest of those is
   * a chat window — Discord refuses a message over 2000 characters, and a
   * rig of four devices carrying a 57-degree custom tuning used to pack to
   * 6200.  Nothing about the layout has to go to fix that: the payload was
   * simply REPEATING itself.  Fifty-seven degrees of a 31-tone scale are
   * fifty-seven near-identical entries, and a hundred key widths all begin
   * "0.9".  That is what DEFLATE is for, and every current browser has it
   * built in as CompressionStream, so the bytes are compressed before they
   * are base64'd: the four-device rig lands at about 1150 characters and
   * an ordinary one-keyboard layout under 300.
   *
   * A compressed payload announces itself with its own key — `kz=` / `rz=`
   * beside the plain `k=` / `r=` — for two reasons in both directions.  A
   * link written before this still reads exactly as it did, and a browser
   * too old for CompressionStream still WRITES a link, just a long one.
   */
  const STREAMS = typeof CompressionStream === 'function'
               && typeof DecompressionStream === 'function';

  function through(bytes, xform) {
    const src = new ReadableStream({
      start(c) { c.enqueue(bytes); c.close(); }
    });
    return new Response(src.pipeThrough(xform)).arrayBuffer()
      .then(buf => new Uint8Array(buf));
  }

  /** the payload text, and the key suffix that says how it was written */
  async function squeeze(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (STREAMS) {
      try {
        const z = await through(bytes, new CompressionStream('deflate-raw'));
        /* only if it actually helped — a very small layout can deflate to
         * more bytes than it started with, and then the plain form wins */
        if (z.length < bytes.length) return ['z', b64u(z)];
      } catch (e) { /* fall through and write it long */ }
    }
    return ['', b64u(bytes)];
  }
  async function unsqueeze(how, str) {
    const bytes = unb64u(str);
    const raw = how === 'z'
      ? await through(bytes, new DecompressionStream('deflate-raw'))
      : bytes;
    return JSON.parse(new TextDecoder().decode(raw));
  }

  /* ---- what goes in an address bar ----
   * `x` is optional at both ends: a payload without it is a keyboard on
   * its own, which is what every link written before Play travelled is,
   * and it opens as one rather than as an error. */
  const withPlay = (obj, x) =>
    rounded(x ? Object.assign(obj, { x: packPlay(x) }) : obj);
  const encodeDesign = (d, x) => packText(withPlay(packDesign(d), x));
  const decodeDesign = s => unpackDesign(unpackText(s));
  const encodeRig = (r, x) => packText(withPlay(packRig(r), x));
  const decodeRig = s => unpackRig(unpackText(s));

  /** The link for a design or a rig: the page's own address, its query and
   *  hash replaced.  `many` decides which of the two forms it takes, and
   *  Play rides along in both.  Compressing is asynchronous — that is what
   *  the platform gives — so this is a promise for a link. */
  async function linkFor(what, many, x) {
    const base = location.href.split('#')[0];
    const play = x === undefined ? playNow() : x;
    const body = withPlay(many ? packRig(what) : packDesign(what), play);
    const [how, text] = await squeeze(body);
    return base + '#' + (many ? 'r' : 'k') + how + '=' + text;
  }

  /**
   * What the address bar is asking for, if anything.  Resolves to
   *   { kind: 'design'|'rig', value, play }  or null,
   * and never rejects: a truncated or mangled link is a link that did not
   * arrive, which the caller says out loud rather than dying on.
   */
  async function fromHash(hash) {
    const h = (hash || (typeof location !== 'undefined' ? location.hash : '') || '')
      .replace(/^#/, '');
    if (!h) return null;
    const m = /(?:^|&)([kr])(z?)=([A-Za-z0-9_-]+)/.exec(h);
    if (!m) return null;
    try {
      const o = await unsqueeze(m[2], m[3]);
      const play = unpackPlay(o.x);
      return m[1] === 'k'
        ? { kind: 'design', value: unpackDesign(o), play }
        : { kind: 'rig', value: unpackRig(o), play };
    } catch (e) { return null; }
  }

  /* ---- the same layout as a file ----
   * Readable JSON rather than the packed form: a file has no length to
   * fight, and one that can be opened and read is one that can be checked,
   * diffed and kept.  It carries the packed object too, so a file and a
   * link are the same thing said twice — the SAME packed object, down to
   * the short degrees and the four decimal places, so that a file and the
   * link it was saved beside cannot drift apart.
   */
  function fileFor(what, many, name, x) {
    const play = x === undefined ? playNow() : x;
    return JSON.stringify({
      format: 'xenachord-layout', version: V,
      kind: many ? 'rig' : 'keyboard',
      name: name || null,
      saved: new Date().toISOString().slice(0, 19).replace('T', ' '),
      data: withPlay(many ? packRig(what) : packDesign(what), play)
    }, null, 2);
  }

  /** read one back; returns { kind, value } or null */
  function fromFile(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { return null; }
    if (!o || typeof o !== 'object') return null;
    /* a bare design, a packed payload or the wrapper — all three are
     * layouts somebody meant to send, so all three are read */
    const body = o.data || o;
    const play = unpackPlay(body.x);
    if (body.u) {
      const r = unpackRig(body);
      return r ? { kind: 'rig', value: r, play } : null;
    }
    /* `v` is what a packed design always writes, and it is the test that
     * still holds now that a rotation of 0 is left unsaid */
    if (body.v !== undefined || body.sl !== undefined || body.r !== undefined) {
      const d = unpackDesign(body);
      return d ? { kind: 'design', value: d, play } : null;
    }
    if (body.slots || body.template)
      return { kind: 'design', value: body, play }; // a raw design, as presets are
    return null;
  }

  const api = { V, TYPES, encodeDesign, decodeDesign, encodeRig, decodeRig,
                packDesign, unpackDesign, packRig, unpackRig,
                packPlay, unpackPlay, squeeze, unsqueeze,
                playNow, applyPlay,
                linkFor, fromHash, fileFor, fromFile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (typeof window !== 'undefined' ? window : globalThis).XShare = api;
})();
