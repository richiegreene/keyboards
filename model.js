/* =========================================================================
 * Keyboard Designer — BLENDER MODEL
 *
 * Every constant in this file was measured directly out of
 *   Cleaning Cimbalo Designs for Automated Design/
 *   Cimbalo_Cromatico_Drafting_Sandbox_Leveling.blend
 * (collections: "Key Type Categories", "15/17/19 Layout", "Feet - A/B",
 *  "One/Two/Three type Spine - A/B").
 *
 * -------------------------------------------------------------------------
 * DESIGN COORDINATE SYSTEM (mm)
 *   x : 0 at the LEFT EDGE of the leftmost white key, + toward the treble
 *   y : 0 at the SPINE FRONT FACE (= the back face of every key),
 *       + toward the player.  The spine therefore occupies y < 0.
 *   z : 0 at the SPINE BOTTOM FACE, + up
 *
 * WORLD (Blender) MAPPING — exact, so the Python log round-trips:
 *   X_world = x + WORLD.x0          WORLD.x0 = -1403.764
 *   Y_world = WORLD.y0 - y          WORLD.y0 = -134.106
 *   Z_world = z + WORLD.z0          WORLD.z0 =   21.78566
 *
 * -------------------------------------------------------------------------
 * THE FIXED SPINE <-> FOOT RELATIONSHIP  (never varies, in any layout)
 *   foot pad          10.4 mm (X)  x  9.0 mm (Y),  flat plane
 *   foot pitch        11.30005 mm
 *   foot centre Y     27.37759 mm in front of the spine front face
 *   foot plane Z      1.01091 mm below the spine bottom face
 * ========================================================================= */
(function () {
  'use strict';

  /* The drafted key profiles, read out of the 15 / 17 / 19 Layout
   * collections.  Key geometry is not modelled analytically any more — it
   * IS the drafted geometry, with x = alpha + beta * width per vertex.   */
  const KP = (typeof module !== 'undefined' && module.exports)
    ? require('./profiles.js')
    : (typeof window !== 'undefined' ? window : globalThis).XKP;

  /* ------------------------------------------------------------------ *
   * 1.  WORLD DATUM                                                     *
   * ------------------------------------------------------------------ */
  const WORLD = {
    x0: -1403.764,        // Blender X of the leftmost white key's left edge
    y0: -134.106,         // Blender Y of the spine front face / key back face
    z0: 21.78566,         // Blender Z of the spine bottom face
    file: 'Cimbalo_Cromatico_Drafting_Sandbox_Leveling.blend'
  };

  /* ------------------------------------------------------------------ *
   * 2.  SPINE  (identical in every layout)                              *
   * ------------------------------------------------------------------ */
  const SPINE = {
    yBack: -9.84706,      // rear face
    yFront: 0.0,          // front face — keys butt against this
    depth: 9.84706,
    height: 7.10039,      // z 0 .. 7.10039

    // Layer stack, PER HALF.  A "one type" spine is one solid slab; a "two
    // type" spine splits it 2 ways; a "three type" spine 3 ways.  Each key's
    // rear tongue plugs into the layer belonging to its colour.
    //
    // Halves A and B were modelled separately in the sandbox and their layer
    // bands differ by up to 0.011 mm — read verbatim out of the collections
    // "One / Two / Three type Spine - A" and "- B" so that a generated spine
    // is an exact replica of the drafted one, not an idealisation of it.
    layers: {
      one: {
        A: [{ name: 'all',   z0:  0.0,     z1: 7.10039 }],
        B: [{ name: 'all',   z0: -0.00006, z1: 7.08935 }]
      },
      two: {
        A: [{ name: 'lower', z0:  0.0,     z1: 6.07832 },
            { name: 'upper', z0:  6.07826, z1: 7.07833 }],
        B: [{ name: 'lower', z0: -0.00006, z1: 6.08932 },
            { name: 'upper', z0:  6.08928, z1: 7.08936 }]
      },
      three: {
        A: [{ name: 'gray',  z0:  0.0,     z1: 5.08934 },
            { name: 'black', z0:  5.09072, z1: 6.10034 },
            { name: 'white', z0:  6.07824, z1: 7.10034 }],
        B: [{ name: 'gray',  z0: -0.00006, z1: 5.07835 },
            { name: 'black', z0:  5.07829, z1: 6.08932 },
            { name: 'white', z0:  6.08926, z1: 7.11137 }]
      }
    },

    // One AKM320 unit = spine half A + spine half B (32 feet between them).
    // x/yBack/yFront are the measured faces of each half.
    halfA: { x0: 0.84933,   x1: 183.43233, yBack: -9.84707, yFront: 0.00000 },
    halfB: { x0: 184.72359, x1: 373.29513, yBack: -9.84695, yFront: 0.00005 },
    span: 373.29513 - 0.84933,             // A + B, end to end

    /* ---------------------------------------------------------------- *
     * THE PCB CHANNEL                                                  *
     *                                                                  *
     * The underside of each half is slotted end to end — open at both  *
     * x ends — leaving a 1.4 mm wall front and back.  This is where    *
     * the AKM320 board sits.  Its ceiling, z = 2.911096, is the same   *
     * plane the mounting holes stop on: the holes open straight down   *
     * into it, so nothing here is a blind counterbore.                 *
     *                                                                  *
     * Read off the bottom faces and the z = 2.911 ceiling faces of     *
     * "<kind> type Spine - A / - B" in the sandbox.                    *
     * ---------------------------------------------------------------- */
    channel: {
      zTop: 2.911096,
      A: { y0: -8.44702, y1: -1.40005 },   // 7.04697 across, 1.40005 walls
      B: { y0: -8.44696, y1: -1.39999 }
    },

    /* ---------------------------------------------------------------- *
     * THE 16 MOUNTING HOLES — 8 per half, and they are NOT rectangles.  *
     *                                                                  *
     * Every one of them is an obround (a stadium slot): a 32-segment    *
     * circle cut in half at +/-90 deg and the two halves held           *
     * `straight` = 1.0 mm apart along x, joined by tangent lines top    *
     * and bottom.  There are exactly two radii in the sandbox:          *
     *                                                                  *
     *   lower  r = 1.889789   ->  4.779578 x 3.779578 mm                *
     *          the layer that carries the channel, z 2.911096 .. z1     *
     *   upper  r = 1.619818   ->  4.239636 x 3.239636 mm                *
     *          every layer stacked above it, full height                *
     *                                                                  *
     * so the bore steps in by 0.269971 mm at the first layer seam.      *
     * A one-type spine has no seam and therefore only the lower bore,   *
     * exactly as "One type Spine - A / - B" is drawn.                   *
     *                                                                  *
     * Centres are stored verbatim, per half and per bore, because the   *
     * drafted upper bores do not sit dead on top of the lower ones      *
     * (they wander by up to 0.008 mm).  y is the bore centre in the     *
     * design frame; the spine front face is y = 0.                      *
     * ---------------------------------------------------------------- */
    hole: {
      seg: 32,               // segments in the full circle
      straight: 1.0,         // straight run between the two half-circles
      rLower: 1.889789,
      rUpper: 1.619818
    },
    holesLower: {
      A: [[  3.92184, -5.05901], [ 17.49740, -5.05305], [ 31.13094, -5.05294],
          [ 71.16085, -5.05298], [ 89.37692, -5.05305], [140.86996, -5.05193],
          [154.46059, -5.05292], [168.10250, -5.05390]],
      B: [[208.22091, -5.05189], [226.45358, -5.05388], [277.92104, -5.05428],
          [291.53719, -5.05230], [305.13729, -5.05288], [345.13729, -5.05289],
          [356.23727, -5.05284], [370.35348, -5.05381]]
    },
    holesUpper: {
      A: [[  3.92324, -5.05283], [ 17.49758, -5.05283], [ 31.13076, -5.05286],
          [ 71.16067, -5.05284], [ 89.36868, -5.05292], [140.87832, -5.05242],
          [154.46070, -5.05284], [168.09451, -5.05326]],
      B: [[208.22911, -5.05251], [226.44538, -5.05328], [277.92912, -5.05364],
          [291.53719, -5.05240], [305.13723, -5.05284], [345.13729, -5.05284],
          [356.23729, -5.05283], [370.34536, -5.05326]]
    }
  };

  /* ------------------------------------------------------------------ *
   * 3.  HARD LIMITS OF THE INSTRUMENT                                    *
   *                                                                     *
   * This keyboard is one AKM320: one spine half A + one spine half B,    *
   * 16 sensor feet on each, 32 feet in total.  A design therefore has    *
   * EXACTLY 32 keys — one per foot — and never more.  Nothing chains.    *
   * ------------------------------------------------------------------ */
  const NOTES = 32;          // keys in a design; also the number of feet
  const UNITS = 1;           // AKM320 units; always one
  const FEET_PER_HALF = 16;

  /* ------------------------------------------------------------------ *
   * 4.  FEET  (the sensor pushers — fixed to the spine, forever)         *
   * ------------------------------------------------------------------ */
  const FOOT = {
    pitch: 11.30005,
    w: 10.40002,
    d: 9.00005,
    yCentre: 27.37759,    // in front of the spine front face
    z: -1.01091,          // below the spine bottom face
    perUnit: 32,          // 16 on half A + 16 on half B
    t: 0.0,               // the pad IS a plane — no body, no walls, no caps
    // x of foot #0's centre, relative to the design origin
    x0: 9.79531,
    // Half A of the real PCB is not perfectly even; half B is.  These are the
    // measured centre-to-centre steps for the 32 feet of one AKM320 unit.
    stepsA: [11.208985, 11.390990, 11.300175, 11.208860, 11.390870, 11.300170,
             11.208985, 11.390870, 11.300045, 11.208985, 11.391115, 11.208985,
             11.391115, 11.299925, 11.208985],
    gapAB: 11.390990,
    stepsB: 11.300050
  };

  /* ------------------------------------------------------------------ *
   * 5.  SIZE LAW                                                        *
   *                                                                     *
   * Read straight off the three drafted layouts.  Every horizontal       *
   * dimension is linear in the layout's "scale" number s (which is the   *
   * EDO number in the 15 / 17 / 19 sheets); every vertical and           *
   * front-to-back dimension is constant.                                *
   *                                                                     *
   *      s      white width   white pitch   accidental width   delta     *
   *     15        23.1250       24.62500        10.37500       2.50000   *
   *     17        26.2083       27.70833        11.75833       2.83333   *
   *     19        29.2917       30.79167        13.14167       3.16667   *
   * ------------------------------------------------------------------ */
  const SIZE = {
    whitePerUnit: 37 / 24,     // white width      = s * 1.5416667  (37/24)
    accPerUnit:   83 / 120,    // accidental width = s * 0.6916667  (83/120)
    whiteGap:     1.5,         // white pitch      = white width + 1.5
    deltaPerUnit: 1 / 6,       // slot bias        = s / 6
    whitesPerPeriod: 7,
    ribInsetRatio: 3.5625 / 29.291626   // 0.1216216 of the white width
  };

  const whiteWidth = s => s * SIZE.whitePerUnit;
  const whitePitch = s => s * SIZE.whitePerUnit + SIZE.whiteGap;
  const accWidth   = s => s * SIZE.accPerUnit;
  const slotDelta  = s => s * SIZE.deltaPerUnit;

  /* ------------------------------------------------------------------ *
   *  FOUR WIDTH CLASSES                                                 *
   *                                                                     *
   *  The sheet gives every accidental one width, whatever it is.  A     *
   *  design may want otherwise — a full black narrower than a full      *
   *  gray, a split pair wider than either — so width is a property of   *
   *  the CLASS a key belongs to, and there are four:                    *
   *                                                                     *
   *      white   the backbone                                           *
   *      black   Full Sized Black                                       *
   *      gray    Full Sized Gray                                        *
   *      split   both halves of either split pair, which share a gap    *
   *              and therefore share a width                            *
   *                                                                     *
   *  A class carries a RATIO, not a millimetre: its width relative to   *
   *  the white's.  Only the ratios are a design decision — the absolute *
   *  size is still solved for so the 32 keys end at the spine, so       *
   *  widening one class narrows the rest rather than running off the    *
   *  end.  The defaults are the sheet's own law, where every accidental *
   *  is 83/185 of a white.                                              *
   * ------------------------------------------------------------------ */
  const WIDTH_CLASSES = ['white', 'black', 'gray', 'split'];
  const CLASS_LABEL = { white: 'White', black: 'Black Full',
                        gray: 'Gray Full', split: 'Split' };
  const ACC_RATIO = SIZE.accPerUnit / SIZE.whitePerUnit;      // 83/185
  const WIDTH_RATIO_DEFAULT = Object.freeze({
    white: 1, black: ACC_RATIO, gray: ACC_RATIO, split: ACC_RATIO
  });
  /* how narrow a class may be squeezed, and how wide it may be pushed,
   * as a ratio of the white — a key thinner than its own two 1 mm walls
   * is not a key, and one wider than the pitch cannot sit in a gap */
  /* ------------------------------------------------------------------ *
   *  HOW WIDE AN ACCIDENTAL IS ALLOWED TO BE                            *
   *                                                                     *
   *  A white makes room for the keys beside it by cutting its rear back *
   *  by (classWidth/2 − whiteGap/2 + FIT.gap) on each side.  With both  *
   *  gaps full, the rear keeps                                          *
   *                                                                     *
   *      1 − ratio + 1.2/width      of its own width,                   *
   *                                                                     *
   *  and it has to keep MIN_REAR of that, so ratio ≤ 0.86 + 1.2/width.  *
   *  Dropping the size-dependent term leaves a bound that holds at any  *
   *  scale.  Past it there is nothing left to cut: the accidental is    *
   *  simply wider than the white it stands beside, and no rear inset    *
   *  can clear it.  So this is a LIMIT, not a warning — the width bar   *
   *  stops there rather than drawing a design that cannot be built.     *
   * ------------------------------------------------------------------ */
  const WIDTH_RATIO_MIN = 0.10;     // a key thinner than its own two walls
  const WIDTH_RATIO_MAX = 2.0;      // the white's own ceiling
  const ACC_RATIO_MAX   = 0.86;     // an accidental's, relative to the white

  /** the ratios a design is asking for, defaulted and made buildable */
  function widthRatios(design) {
    const r = {}, src = (design && design.widths) || {};
    for (const c of WIDTH_CLASSES) {
      const v = +src[c];
      r[c] = isFinite(v) && v > 0
        ? Math.min(WIDTH_RATIO_MAX, Math.max(WIDTH_RATIO_MIN, v))
        : WIDTH_RATIO_DEFAULT[c];
    }
    /* an accidental is measured against the white, so the white carries the
     * ceiling with it — widen the white and the others may follow */
    const cap = r.white * ACC_RATIO_MAX;
    for (const c of WIDTH_CLASSES) if (c !== 'white') r[c] = Math.min(r[c], cap);
    return r;
  }

  /** the widest an accidental class may go, beside a white of ratio `w` */
  const accCeiling = w => w * ACC_RATIO_MAX;
  /** the narrowest the white may go, given the accidentals beside it */
  const whiteFloor = r => Math.max(WIDTH_RATIO_MIN,
    Math.max(r.black, r.gray, r.split) / ACC_RATIO_MAX);

  /* ------------------------------------------------------------------ *
   *  ONE KEY'S OWN WIDTH                                                *
   *                                                                     *
   *  The four class ratios are the keyboard's LAW: they say what a      *
   *  black is, everywhere.  A design may still say that THIS black is   *
   *  wider than the law, and `keyScale` is where it says so — one       *
   *  multiplier per key, on top of whatever its class already carries.  *
   *  A white's id is "w<index>"; a gap's is "a<index>", and a gap is    *
   *  the unit rather than the key because both halves of a split pair   *
   *  stand in one gap and therefore share one width, exactly as they    *
   *  share the `split` class.                                           *
   *                                                                     *
   *  Absent or 1 means "as the law says", so a keyboard nobody has      *
   *  hand-resized carries no keyScale at all and reads exactly as it    *
   *  did before.  The ACC_RATIO_MAX ceiling above is a statement about  *
   *  a white and the accidental beside IT, so once widths vary key by   *
   *  key it has to be applied key by key too — computeLayout does that  *
   *  against each gap's own two whites.                                 *
   * ------------------------------------------------------------------ */
  const KEY_SCALE_MIN = 0.25, KEY_SCALE_MAX = 4.0;
  const whiteScaleId = i => 'w' + i;
  const slotScaleId  = i => 'a' + i;

  /** the multiplier key `id` carries, defaulted and clamped */
  function keyScale(design, id) {
    const v = +(((design && design.keyScale) || {})[id]);
    return isFinite(v) && v > 0
      ? Math.min(KEY_SCALE_MAX, Math.max(KEY_SCALE_MIN, v)) : 1;
  }
  /** how many keys this design has resized by hand */
  function keyScaleCount(design) {
    const m = (design && design.keyScale) || {};
    return Object.keys(m).filter(k => Math.abs(keyScale(design, k) - 1) > 1e-4).length;
  }

  /** the width one class takes at size `s` */
  const classWidth = (cls, s, r) =>
    s * SIZE.whitePerUnit * ((r || WIDTH_RATIO_DEFAULT)[cls] || ACC_RATIO);

  /** which of the four a key type belongs to */
  const classOfType = n => {
    const spec = KEY_TYPES[canonType(n)];
    return spec ? spec.widthClass : 'split';
  };

  /* ------------------------------------------------------------------ *
   *  THERE IS NO SLOT BIAS ANY MORE                                     *
   *                                                                     *
   *  The sheets lean each accidental slot -delta, 0 or +delta in the     *
   *  pattern three-single-two-single: the classic piano arrangement,    *
   *  and a NOTE-NAME idea, since which slot leans which way is decided  *
   *  by a seven-name diatonic spelling this instrument has not defined. *
   *                                                                     *
   *  It also made the keyboard uneven to play.  A white's waist is the  *
   *  gap between the accidentals either side of it, and with the lean   *
   *  that came out as wP - aW - 1.2 + (biasR - biasL)*delta — two       *
   *  different widths depending on which way its neighbours happened to *
   *  lean.  Running a scale across the whites met one width, then       *
   *  another, then back.                                                *
   *                                                                     *
   *  Every gap now sits at the plain midpoint between its two whites,   *
   *  so every waist is wP - aW - 1.2 and every white is the same key.   *
   *  delta survives only as a figure in the size law.                   *
   * ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ *
   * 6.  KEY TYPE CATEGORIES                                             *
   *                                                                     *
   * The seven categories drawn in the "Key Type Categories" collection.  *
   * In the .blend they were pulled from different sheets (19 and 15) and *
   * so carry different widths; here width always comes from the size law *
   * above, so all seven are directly comparable.                        *
   *                                                                     *
   * z values are design-z (0 = spine bottom face).                       *
   *   4.08924  underside of every accidental                            *
   *   8.62804  white playing surface  ( = where side draft begins )      *
   *  14.12804  rear top edge of every accidental                        *
   * ------------------------------------------------------------------ */
  const Z = {
    accBottom:   4.08924,
    whiteTop:    8.62804,
    whiteBottom: -5.91916,
    whiteUnder:  1.71694,   // underside of the white key's mid-body
    accRearTop: 14.12804,
    grayTongue:  [4.08924, 5.09074],   // plugs into spine layer 1
    blackTongue: [5.08924, 6.08924],   // plugs into spine layer 2
    whiteTongue: [6.08924, 8.62804]    // plugs into spine layer 3
  };

  /* ------------------------------------------------------------------ *
   *  THE WHITE'S TOP RUNS STRAIGHT INTO ITS TONGUE                      *
   *                                                                     *
   *  The drafted white had 1.5387 mm of shell wall standing between its  *
   *  playing surface (Z.whiteTop) and the roof of its tongue — the one   *
   *  wall on the whole keyboard thin enough to hold the bevel back (see  *
   *  bevelRoom).  It is gone: the WHITE band of the spine and the white  *
   *  tongue that plugs into it are both raised by exactly that much, so  *
   *  the tongue's roof, the spine's top face and the key's playing top   *
   *  are one plane at Z.whiteTop, and the white gains 1.5387 mm of       *
   *  section through the joint that carries it.                          *
   *                                                                     *
   *  Z.whiteTongue already named Z.whiteTop as its top: it was the       *
   *  spine band, 1.5387 mm lower, that clipped the tongue down to it     *
   *  (see tongueLaps and spineParts).  Raising the band is what makes    *
   *  the drafted figure real.                                            *
   *                                                                     *
   *  WHITES ONLY.  Black and gray tongues are unchanged — they are       *
   *  buried bands with another colour's key stacked over them, and       *
   *  there is no top face for them to run out to.                        *
   * ------------------------------------------------------------------ */
  const WHITE_RISE = 1.5387;   // Z.whiteTop - the drafted white band top

  /* Part colours.  One table, used by the WebGL preview and written into the
   * Blender log as materials, so the two renderings read the same.        */
  const COLORS = {
    white: [1.0, 1.0, 1.0], black: [0.16, 0.16, 0.19],
    gray:  [0.55, 0.55, 0.58], spine: [0.30, 0.31, 0.36],
    press: [0.72, 0.45, 0.22]
  };

  const DRAFT = 0.1018;      // side draft above z = Z.whiteTop (5.8 degrees)
  const WALL  = 1.0;         // shell wall thickness
  const TONGUE_Y = 5.0688;   // the drafted tongue ran y 0 .. 5.0688

  /* ==================================================================== *
   *  THE KEY REACHES BACK, THE TONGUE GIVES THE LENGTH UP                *
   *                                                                      *
   *  The drafted key ends at y = TONGUE_Y and the tongue runs the whole   *
   *  way from there to the spine face.  The back now carries on           *
   *  BACK_REACH further toward the spine and the tongue loses exactly     *
   *  that much, so the spine, the tongue's own z band and everything      *
   *  forward of the back face are where they were: what changes is where  *
   *  the key stops and how much flexure is left between it and the band.  *
   *                                                                      *
   *  EACH SURFACE CARRIES ON THE WAY IT WAS ALREADY GOING.  A white's     *
   *  playing top is flat, so it reaches back flat.  An accidental's is a  *
   *  ramp — 14.128 at the back rising to its peak — so its back edge      *
   *  follows that ramp down rather than stepping off it, and the same     *
   *  goes for every other face that meets the back plane.  A face with    *
   *  nothing running forward from it (the tongue's own root) reaches back *
   *  flat, because flat is the way it was already going.                  *
   * ==================================================================== */
  const BACK_REACH = 3.0;                 // how much further back the key goes
  const BACK_Y = TONGUE_Y - BACK_REACH;   // 2.0688, where a key now ends

  /* Each accidental category is described by
   *   depth       front face y
   *   peakY/peakZ apex of the sloped playing top
   *   noseZ       top of the front face, before the nose ramp
   *   arm         optional thin rear arm (the low "Second" gray keys)
   *   layer       which spine layer the tongue plugs into
   *   mirror      X-mirror of the detailing (First vs Second handedness)
   */
  const KEY_TYPES = {
    'Full Sized White': {
      id: 'full-white', kind: 'white', layer: 'white', widthClass: 'white',
      depth: 85.0688, css: 'white',
      label: 'Full Sized White',
      blurb: 'Natural. Full depth, plays at z 8.628.'
    },
    'Full Sized Gray': {
      id: 'full-gray', kind: 'acc', layer: 'gray', mirror: false, widthClass: 'gray',
      depth: 42.5688, noseZ: Z.whiteTop,
      peakY: 42.5688 - 5.4866, peakZ: 15.24484,
      css: 'gray',
      label: 'Full Sized Gray',
      blurb: 'Single mid-height accidental. 19-EDO uses it for E#/Fb and B#/Cb.'
    },
    'Full Sized Black': {
      id: 'full-black', kind: 'acc', layer: 'black', mirror: false, widthClass: 'black',
      depth: 52.5688, noseZ: Z.whiteTop,
      peakY: 52.5688 - 4.5, peakZ: 15.62804,
      css: 'black',
      label: 'Full Sized Black',
      blurb: 'Single full-depth accidental. 15-EDO uses it in the outer slots.'
    },
    'Split Black First': {
      id: 'split-black-1', kind: 'acc', layer: 'black', mirror: true, widthClass: 'split',
      depth: 27.8188, noseZ: Z.whiteTop,
      peakY: 27.8188 - 0.2303, peakZ: 14.94844,
      css: 'black', pairRole: 'rear',
      label: 'Split Black First',
      blurb: 'Rear (short, tall) half of a split pair — left-hand detailing.'
    },
    'Split Black Second': {
      id: 'split-black-2', kind: 'acc', layer: 'black', mirror: false, widthClass: 'split',
      depth: 27.8188, noseZ: Z.whiteTop,
      peakY: 27.8188 - 0.2303, peakZ: 14.94844,
      css: 'black', pairRole: 'rear',
      label: 'Split Black Second',
      blurb: 'Rear (short, tall) half of a split pair — the sheet default.'
    },
    'Split Gray Second': {
      id: 'split-gray-2', kind: 'acc', layer: 'gray', mirror: true, widthClass: 'split',
      depth: 52.5688, noseZ: Z.whiteTop,
      peakY: 52.5688 - 4.5, peakZ: 15.62804,
      arm: { startY: 29.8188, startZ: 7.84134, endY: TONGUE_Y, endZ: 5.09074 },
      css: 'gray', pairRole: 'front', armSide: 'right',
      label: 'Split Gray Second',
      blurb: 'Front (deep, low) half of a split pair — its rear arm runs back ' +
             'on the RIGHT, so the pair reads black → gray.'
    },
    'Split Gray First': {
      id: 'split-gray-1', kind: 'acc', layer: 'gray', mirror: false, widthClass: 'split',
      depth: 52.5688, noseZ: Z.whiteTop,
      peakY: 52.5688 - 4.5, peakZ: 15.62804,
      arm: { startY: 29.8188, startZ: 7.84134, endY: TONGUE_Y, endZ: 5.09074 },
      css: 'gray', pairRole: 'front', armSide: 'left',
      label: 'Split Gray First',
      blurb: 'Front (deep, low) half of a split pair — its rear arm runs back ' +
             'on the LEFT, so the pair reads gray → black.  The sheet default.'
    }
  };
  const TYPE_ORDER = [
    'Full Sized Black', 'Full Sized Gray', 'Full Sized White',
    'Split Black First', 'Split Black Second',
    'Split Gray Second', 'Split Gray First'
  ];

  /* Designs saved before the Gray First / Grey Second rename.  A stored
   * design, a pasted template or an old Python log still names the front
   * half "Split Grey Second"; it has always been the LEFT-armed one. */
  const TYPE_ALIASES = { 'Split Grey Second': 'Split Gray First' };
  const canonType = n => TYPE_ALIASES[n] || n;

  /* ------------------------------------------------------------------ *
   *  SPLIT PAIRS ARE ONE COMPONENT                                      *
   *                                                                     *
   *  A split slot is never half filled.  The rear (short, tall, black)  *
   *  half and the front (deep, low, gray) half are cut from each other: *
   *  the gray's thin rear arm runs back down ONE side of the slot and   *
   *  the black stands in what is left, so a black without its gray is   *
   *  a key with no neighbour to be split from, and a gray without its   *
   *  black is a slot with a hole in it.  They are placed together and   *
   *  removed together, and the palette offers them as one chip.         *
   *                                                                     *
   *  The two chips are the two HANDS of that arrangement, named for     *
   *  what the rear of the slot reads left to right:                     *
   *                                                                     *
   *    Split: Gray→Black   gray arm on the left   (the 15/17/19 sheets) *
   *    Split: Black→Gray   gray arm on the right  (the mirror)          *
   * ------------------------------------------------------------------ */
  const KEY_PAIRS = {
    'Split: Gray→Black': {
      id: 'pair-gray-black', members: ['Split Gray First', 'Split Black Second'],
      label: 'Split: Gray→Black', hand: 'left',
      blurb: 'Split Gray First (front) + Split Black Second (rear).  The ' +
             'gray arm runs back on the LEFT.  Every split slot on the ' +
             'drafted 15 / 17 / 19 sheets is this pair.'
    },
    'Split: Black→Gray': {
      id: 'pair-black-gray', members: ['Split Black First', 'Split Gray Second'],
      label: 'Split: Black→Gray', hand: 'right',
      blurb: 'Split Black First (rear) + Split Gray Second (front).  The ' +
             'gray arm runs back on the RIGHT — the mirror of the sheet pair.'
    }
  };
  const PAIR_ORDER = ['Split: Gray→Black', 'Split: Black→Gray'];

  /** the pair a member type belongs to, or null for a full-sized key */
  function pairOfType(name) {
    const n = canonType(name);
    for (const k of PAIR_ORDER)
      if (KEY_PAIRS[k].members.indexOf(n) >= 0) return k;
    return null;
  }

  /** the pair a slot's contents amount to, or null if it is not a pair */
  function pairOfSlot(names) {
    if (!names || names.length !== 2) return null;
    for (const k of PAIR_ORDER) {
      const m = KEY_PAIRS[k].members;
      if (names.every(n => m.indexOf(canonType(n)) >= 0)) return k;
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   *  A GAP MAY ALSO HOLD TWO FULL-SIZED KEYS, SIDE BY SIDE             *
   *                                                                     *
   *  A split pair divides its gap FRONT TO BACK: the short black stands *
   *  at the rear and the deep gray reaches past it to the player, both  *
   *  on one centre, which is why they are cut from each other and why   *
   *  the palette offers them as one chip with a handedness.             *
   *                                                                     *
   *  TWO FULL-SIZED KEYS DIVIDE THE SAME GAP LEFT TO RIGHT.  There is   *
   *  no new key type and no new chip: these are the ordinary Full Sized *
   *  Gray and Full Sized Black the palette already drops singly, and a  *
   *  gap simply holds two of them instead of one.  Drop the second onto *
   *  a gap that already has one and it takes the lane you dropped it    *
   *  on.  They are NOT a pair in the split sense — nothing is cut from  *
   *  anything, either can be removed on its own, and each carries its   *
   *  own width, so this is a property of the GAP, not of the types.     *
   *                                                                     *
   *  THE BUFFER IS THE WHITE KEYS' OWN.  Two keys standing side by side *
   *  read as two keys, so the air between them is the air between two   *
   *  whites — SIZE.whiteGap.  The seam sits ON the gap's centre, which  *
   *  is where the two whites in front of the gap part from each other,  *
   *  so the two run down the same x and read as one line.               *
   * ------------------------------------------------------------------ */
  const LANE_BUFFER = SIZE.whiteGap;

  /* ------------------------------------------------------------------ *
   *  AND HOW FAR ANY NON-WHITE KEY STANDS OFF A WHITE                   *
   *                                                                     *
   *  HALF the white gap, everywhere: beside a split key, a Full Sized   *
   *  Black or Gray on its own, or either key of a side-by-side pair.    *
   *                                                                     *
   *  It used to be FIT.gap, 0.15 mm — the shadow line drawn between two *
   *  colours that are not going to move relative to each other.  These  *
   *  two DO move: an accidental travels down past a white's rear every  *
   *  time it is played, and a tenth of a millimetre is a scrape, not a  *
   *  clearance.  Half the white gap is the same air the whites give     *
   *  each other for the same reason, halved because only one of the two *
   *  faces is cut back for it — the accidental keeps its place in the   *
   *  pitch and the white's rear does the giving.                        *
   * ------------------------------------------------------------------ */
  const WHITE_CLEAR = SIZE.whiteGap / 2;

  /** true when this gap's contents stand side by side rather than stacked */
  function isLaneSlot(names) {
    if (!names || names.length !== 2) return false;
    return names.every(n => {
      const spec = KEY_TYPES[canonType(n)];
      return !!spec && spec.kind !== 'white' && !spec.pairRole;
    });
  }

  /**
   * Lay a gap's two members out in lanes and return the span they occupy.
   * ONE definition, used by the layout, by the clamp that squeezes an
   * over-wide pair, and by the strip — so the picture and the mesh can
   * never disagree about where a lane is.
   *
   * THE SEAM IS THE ANCHOR, NOT THE CENTRE.  It sits on the gap's own
   * centre line, where the whites in front of the gap part from each
   * other, so a wide key beside a narrow one still leaves the buffer on
   * the line it has to continue.  The span is therefore symmetric about
   * the centre only when the two keys are the same width.
   */
  function layLanes(members, cx) {
    const half = LANE_BUFFER / 2;
    const a = members[0], b = members[1];
    a.x1 = cx - half; a.x0 = a.x1 - a.w; a.cx = (a.x0 + a.x1) / 2;
    b.x0 = cx + half; b.x1 = b.x0 + b.w; b.cx = (b.x0 + b.x1) / 2;
    return { x0: a.x0, x1: b.x1, w: b.x1 - a.x0 };
  }

  /**
   * Scale a lane pair down so what it costs the two whites fits `lim`,
   * keeping the two keys in proportion.  `air` — the seam plus the two
   * clearances — is not scaled: those are fixed millimetres, not shares
   * of the pair.
   */
  function fitLaneSpan(members, cx, lim, air) {
    const solid = members.reduce((n, m) => n + m.w, 0);
    if (solid + air <= lim || solid <= 0) return layLanes(members, cx);
    const k = Math.max(0, lim - air) / solid;
    for (const m of members) m.w *= k;
    return layLanes(members, cx);
  }

  /** the id a lane's own hand-set width is stored under */
  const laneScaleId = (i, ord) => 'a' + i + '.' + ord;

  /* what the palette can drop: the three full-sized keys, then the two
   * split pairs.  A gap holding two full-sized keys side by side is made
   * by dropping them one after the other, so it needs no chip. */
  const PALETTE_ORDER = [
    'Full Sized Black', 'Split: Gray→Black',
    'Split: Black→Gray', 'Full Sized Gray'
  ];

  /* ------------------------------------------------------------------ *
   * 7.  THE THREE DRAFTED LAYOUTS                                       *
   *                                                                     *
   * Slot contents per seven-white period, read off the sheets.          *
   * null = no accidental in that slot.                                  *
   * ------------------------------------------------------------------ */
  const LAYOUTS = {
    15: {
      label: '15-EDO  (Cimbalo Cromatico [15])',
      slots: [
        ['Full Sized Black'],
        ['Split Gray First', 'Split Black Second'],
        ['Split Gray First', 'Split Black Second'],
        null,
        ['Full Sized Black'],
        ['Split Gray First', 'Split Black Second'],
        null
      ],
      notes: 15,
      // the 15 sheet is drawn starting on C, not F
      rotation: 4,
      whites: 29,
      sheetWhites: 29
    },
    17: {
      label: '17-EDO  (Cimbalo Cromatico [17])',
      slots: [
        ['Split Gray First', 'Split Black Second'],
        ['Split Gray First', 'Split Black Second'],
        ['Split Gray First', 'Split Black Second'],
        null,
        ['Split Gray First', 'Split Black Second'],
        ['Split Gray First', 'Split Black Second'],
        null
      ],
      notes: 17,
      whites: 25,
      sheetWhites: 25
    },
    19: {
      label: '19-EDO  (Cimbalo Cromatico [19])',
      slots: [
        ['Split Gray First', 'Split Black Second'],
        ['Split Gray First', 'Split Black Second'],
        ['Split Gray First', 'Split Black Second'],
        ['Full Sized Gray'],
        ['Split Gray First', 'Split Black Second'],
        ['Split Gray First', 'Split Black Second'],
        ['Full Sized Gray']
      ],
      notes: 19,
      whites: 23,
      sheetWhites: 23
    }
  };

  /* NOTE NAMES ARE NOT THIS APP'S TO GIVE.  The keyboard used to label its
   * whites F G A B C D E and its gaps F♯/G♭ and so on, which reads a
   * twelve-note diatonic spelling onto an instrument that is not one and
   * has no such spelling defined yet.  Keys are identified by their index
   * along the keyboard — the same number as the sensor foot they stand on
   * — and nothing else.                                                 */

  /* ==================================================================== *
   *  MESH PRIMITIVES                                                     *
   * ==================================================================== */
  function pushTri(t, a, b, c) {
    t.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }
  function pushQuad(t, a, b, c, d) { pushTri(t, a, b, c); pushTri(t, a, c, d); }

  function pushBox(t, x0, x1, y0, y1, z0, z1) {
    if (x1 - x0 < 1e-5 || y1 - y0 < 1e-5 || z1 - z0 < 1e-5) return;
    const p = (x, y, z) => [x, y, z];
    pushQuad(t, p(x0,y0,z0), p(x0,y1,z0), p(x1,y1,z0), p(x1,y0,z0));   // -z
    pushQuad(t, p(x0,y0,z1), p(x1,y0,z1), p(x1,y1,z1), p(x0,y1,z1));   // +z
    pushQuad(t, p(x0,y0,z0), p(x1,y0,z0), p(x1,y0,z1), p(x0,y0,z1));   // -y
    pushQuad(t, p(x1,y0,z0), p(x1,y1,z0), p(x1,y1,z1), p(x1,y0,z1));   // +x
    pushQuad(t, p(x1,y1,z0), p(x0,y1,z0), p(x0,y1,z1), p(x1,y1,z1));   // +y
    pushQuad(t, p(x0,y1,z0), p(x0,y0,z0), p(x0,y0,z1), p(x0,y1,z1));   // -x
  }

  /* Loft a ring of N points between two Y stations. Rings are given as
   * [x,z] pairs in consistent winding.  capA / capB close the ends.
   *
   * Winding matters: pushBox emits outward-facing quads, so the lofts have
   * to as well or the two halves of a key disagree about which side is the
   * outside.  For a ring wound counter-clockwise in (x, z) seen from +y the
   * quad below faces outward — and it stays outward when the caller lofts
   * back-to-front (yA < yB) or hands in a clockwise ring, which is how the
   * hollow undersides are cut.  That makes STL normals and Blender's shading
   * right; the preview shades two-sided and never noticed.               */
  function loftRing(t, ringA, yA, ringB, yB, capA, capB) {
    const n = ringA.length;
    const fwd = yA >= yB;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ai = [ringA[i][0], yA, ringA[i][1]], aj = [ringA[j][0], yA, ringA[j][1]];
      const bi = [ringB[i][0], yB, ringB[i][1]], bj = [ringB[j][0], yB, ringB[j][1]];
      if (fwd) pushQuad(t, ai, aj, bj, bi);
      else     pushQuad(t, ai, bi, bj, aj);
    }
    if (capA) fanCap(t, ringA, yA, fwd);
    if (capB) fanCap(t, ringB, yB, !fwd);
  }
  function fanCap(t, ring, y, flip) {
    for (let i = 1; i < ring.length - 1; i++) {
      const a = [ring[0][0], y, ring[0][1]];
      const b = [ring[i][0], y, ring[i][1]];
      const c = [ring[i + 1][0], y, ring[i + 1][1]];
      flip ? pushTri(t, a, c, b) : pushTri(t, a, b, c);
    }
  }

  /** a slab whose floor slopes from (yA,zA) to (yB,zB) under a flat top */
  function XM_loftPrism(t, x0, x1, yA, zA, yB, zB, zTop) {
    const ringA = [[x0, zA], [x1, zA], [x1, zTop], [x0, zTop]];
    const ringB = [[x0, zB], [x1, zB], [x1, zTop], [x0, zTop]];
    loftRing(t, ringA, yA, ringB, yB, true, true);
  }

  /* ==================================================================== *
   *  KEY GEOMETRY — instantiated from the drafted profiles               *
   *                                                                      *
   *  Every key in the 15 / 17 / 19 sheets was measured and reduced to one *
   *  profile per type (and, for whites, per neighbour context, because    *
   *  the drafted whites rib differently depending on what sits beside     *
   *  them).  Each vertex carries                                          *
   *                                                                      *
   *      x = alpha + beta * width      y, z constant                      *
   *                                                                      *
   *  so a profile spans every size scale: beta 0 pins a feature to the    *
   *  left edge, 1 to the right edge, 0.5 to the centreline.  Nothing here *
   *  is a reconstruction of the drafted shape; it is the drafted shape.   *
   * ==================================================================== */

  /* A NEIGHBOUR CONTEXT IS NULL, OR { h, d }.  `h` is half the gap's
   * width as a ratio of this white's — the whole of it plus the half gap
   * at an end, where the white stands under all of it — and `d` is the
   * depth of the deepest key in it.  Both decide the white's rear, so
   * both belong in the profile's identity.  A bare number is still read
   * as an `h` with a drafted depth, which is what the drafted contexts
   * of every non-white key type are.                                  */
  const ctxHalf  = c => c == null ? 0 : (typeof c === 'number' ? c : c.h);
  const ctxDepth = c => (c == null || typeof c === 'number')
    ? ACC_DEPTH_DRAFTED : c.d;
  const ctxKey = (lb, rb) => {
    const one = c => c == null ? 'n'
      : typeof c === 'number' ? String(c) : c.h + '@' + c.d;
    return one(lb) + '|' + one(rb);
  };

  /* ==================================================================== *
   *  THE WHITE KEY'S REAR IS DERIVED, NOT DRAFTED                        *
   *                                                                      *
   *  A white key is full width at the front, where you play it, and       *
   *  narrowed at the rear so the accidentals standing in the gaps either  *
   *  side have somewhere to be.  The sheets draw one such narrowing per   *
   *  neighbour case, and each one is drawn around a slot leaning +/- delta*
   *  away in the classic three-then-two piano arrangement.  That lean is  *
   *  a NOTE-NAME idea: it belongs to a seven-name diatonic spelling this  *
   *  instrument has not defined.  Without it every gap sits at the plain  *
   *  midpoint between its whites — and then none of the drafted rears     *
   *  fits, because every one of them was drawn around a lean.             *
   *                                                                      *
   *  So the rear is COMPUTED from where the accidentals actually are:     *
   *                                                                      *
   *      inset = accidentalWidth/2  -  whiteGap/2  +  FIT.gap             *
   *                                                                      *
   *  on each side that has an accidental, and NOTHING on a side that does *
   *  not — that side runs flush to the key's own edge.  A white with no   *
   *  accidental either side is therefore a plain rectangle in plan, which *
   *  is what a keyboard of 32 whites is made of.                          *
   *                                                                      *
   *  EVERY WHITE IS THE SAME SHAPE.  Same inset, same waist, same rear —  *
   *  so a scale run across the whites meets one width, not two.           *
   *                                                                      *
   *  IT COSTS NOTHING PER SIZE.  Accidental width and white width are     *
   *  both linear in s, so their ratio is fixed; the inset is therefore    *
   *  `alpha + beta * width` like every other drafted coordinate, and the  *
   *  four derived profiles are built once and hold at every scale.        *
   *                                                                      *
   *  THE TOPOLOGY THE SHEETS LEFT OUT.  The drafted white steps in on its *
   *  LEFT only — its rear runs flush to its right edge, shingled under    *
   *  the next key.  A rear that insets on BOTH sides needs a step on the  *
   *  right too, and the captured mesh has none: its right-hand outer and  *
   *  inner walls each run as ONE face from the rear all the way to the    *
   *  front.  twoSidedWhiteBase splits exactly those two faces at the step *
   *  planes, gives every right-hand vertex a rear twin and a front twin,  *
   *  and adds the two step faces — the mirror of what the left already    *
   *  has.  With no inset applied it reproduces the drafted key's volume   *
   *  to 0.002 mm3, which is how we know the split is geometry-neutral.    *
   * ==================================================================== */
  const STEP_Y_OUTER = 54.0688;      // where the outer wall steps out
  const STEP_Y_INNER = 55.0688;      // where the 1 mm inner wall follows
  const W_ROLE = {                   // the drafted betas, by what they are
    L_OUT: 0.337838, L_IN: 0.381081, C_L: 0.647297, C_R: 0.690541,
    R_IN:  0.956757, R_OUT: 1.0
  };
  /* the drafted beta of the front shell's LEFT inner wall — the other half
   * of the left step's corner pair, and restated as a millimetre below */
  const W_FRONT_L_IN = 0.043243;
  /* ------------------------------------------------------------------ *
   *  HOW DEEP THE WHITE IS CUT BACK                                     *
   *                                                                     *
   *  THE STEP IS THE ACCIDENTAL'S OWN FRONT, PLUS ITS CLEARANCE.  The   *
   *  two drafted planes above are 1.5 and 2.5 mm forward of 52.5688 —   *
   *  the front of a Full Sized Black, and of a Split Gray, the deepest  *
   *  things that ever stand in a gap.  Held as constants they say that  *
   *  EVERY white is cut back that far whatever stands beside it, and a  *
   *  Full Sized Gray stops 10 mm short of them: 11.5 mm of notch with   *
   *  nothing in it, bare mount where the white should have run on.  It  *
   *  is only a shadow between two whites, but at the ends of the        *
   *  keyboard the notch is the full width of the key and reads as a     *
   *  bite taken out of the deck.                                        *
   *                                                                     *
   *  So both planes follow the deepest key actually in the gap, and      *
   *  land back on the drafted numbers exactly when that key is a deep    *
   *  one.  The floor keeps the step clear of the underside ribbing,      *
   *  which ends at 35.3775 — without it a lone Split Black, 27.8188      *
   *  deep and a key that only ever stands in front of a Split Gray on    *
   *  the sheets, would put the step inside the ribs.                     *
   * ------------------------------------------------------------------ */
  const ACC_DEPTH_DRAFTED = 52.5688;                          // the deep ones
  const STEP_CLEAR_OUTER = STEP_Y_OUTER - ACC_DEPTH_DRAFTED;  // 1.5
  const STEP_CLEAR_INNER = STEP_Y_INNER - ACC_DEPTH_DRAFTED;  // 2.5
  const STEP_Y_FLOOR = 36.8775;                               // clear of the ribs
  function stepPlanes(depth) {
    const d = depth > 0 ? depth : ACC_DEPTH_DRAFTED;
    return { outer: Math.max(STEP_Y_FLOOR,     d + STEP_CLEAR_OUTER),
             inner: Math.max(STEP_Y_FLOOR + 1, d + STEP_CLEAR_INNER) };
  }

  /* ==================================================================== *
   *  THE FRONT NOSE IS CUT BACK FOR THE AKM320                           *
   *                                                                      *
   *  The drafted white ends in a leg: the underside ramps down at        *
   *  y 76.5688, runs along the key bottom to 84.0688 and turns up there  *
   *  as a full-height front wall, z -5.9192 all the way to 6.628.  So    *
   *  the very front of the key occupies the whole 14.5 mm of section,    *
   *  right where the AKM320's own body is.  Nothing about that was a     *
   *  design decision — it is simply what the sheet drew, on a mount      *
   *  that had nothing in front of the keys.                              *
   *                                                                      *
   *  THE LEG MOVES BACK AND THE NOSE GOES HOLLOW-BOTTOMED.  The leg      *
   *  keeps its shape exactly — same 5 mm foot, same 1 mm wall, same      *
   *  2.5 mm sloped rear — and slides NOSE_SHIFT toward the spine.  Its   *
   *  OUTER front wall then stops at the key's own underside instead of   *
   *  climbing to the lip, and everything in front of it becomes a solid  *
   *  wedge whose underside RAMPS AWAY from the mount: floor from         *
   *  Z.whiteUnder at the leg to NOSE_FLOOR_Z at the front face.          *
   *                                                                      *
   *  AND THE NOSE IS SOLID, NOT SHELLED — "filled in" overhang           *
   *  prevention.  The shell cavity used to carry on over the nose and    *
   *  close on a roof that ramped from NOSE_ROOF_Z at the leg up to the   *
   *  ceiling a millimetre behind the front face.  Printed playing-face   *
   *  down that roof is a long shallow lid over a pocket, and the         *
   *  horizontal ceiling strip in front of it has nothing under it at     *
   *  all.  So the cavity simply STOPS at the leg: the inner front wall   *
   *  slides back whole — its top corners with its bottom ones — and      *
   *  stands as one vertical face from the key bottom right up to the     *
   *  ceiling, and the whole nose in front of it is solid down to the     *
   *  floor ramp.  Nothing outside changes: the front face, the lip, the  *
   *  playing surface and the pocket under the nose are as they were.     *
   *                                                                      *
   *  It buys 9.9259 mm of headroom under the front face, tapering to     *
   *  nothing at the leg — an 11.9156 mm deep pocket the full width of    *
   *  the key.  The front face, the lip and the playing surface are       *
   *  untouched, so the key looks and plays the same.                     *
   *                                                                      *
   *  MEASURED, NOT INVENTED.  Every number here was read out of          *
   *  "Y adjusted White Key Face Componant.blend", where the edit was     *
   *  drafted by hand on one key.  See claude/akm320-white-key-nose.md.   *
   *                                                                      *
   *  It runs on the SOURCE profile, once, before either white base is    *
   *  built, so both the plain and the two-sided path inherit it and the  *
   *  rear derivation downstream never has to know about it.  The new     *
   *  vertices carry the same four betas the walls already use, which is  *
   *  what lets deriveWhiteProfile restate them as millimetre walls with  *
   *  no special case.                                                    *
   * ==================================================================== */
  const NOSE_LEG_RAMP = 76.5688;   // drafted: underside starts down
  const NOSE_LEG_REAR = 79.0688;   // drafted: leg bottom, rear edge
  const NOSE_LEG_IN   = 83.0688;   // drafted: leg front wall, inner
  const NOSE_LEG_OUT  = 84.0688;   // drafted: leg front wall, outer
  const NOSE_SHIFT    = 11.9156;   // how far the leg moves toward the spine
  const NOSE_ROOF_Z   = Z.whiteUnder + 0.5;   // 2.21694, where the roof starts
  const NOSE_FLOOR_Z  = 4.00674;              // the floor at the front face
  const CAVITY_Z      = Z.whiteTop - WALL;    // 7.628, the shell's ceiling

  /** splice `ins` into ring `f` on the directed edge u -> v */
  function spliceEdge(f, u, v, ins) {
    for (let k = 0; k < f.length; k++)
      if (f[k] === u && f[(k + 1) % f.length] === v)
        return f.slice(0, k + 1).concat(ins, f.slice(k + 1));
    throw new Error('akm320Nose: edge ' + u + '->' + v + ' not found');
  }

  let NOSE_SRC = null;
  /** the drafted white with its front leg cut back for the AKM320 */
  function akm320Nose(p) {
    if (NOSE_SRC) return NOSE_SRC;
    const V = [];
    for (let i = 0; i < p.nv; i++) {
      const j = i * 4;
      V.push({ a: p.v[j], b: +p.v[j + 1].toFixed(6),
               y: +p.v[j + 2].toFixed(4), z: +p.v[j + 3].toFixed(4) });
    }
    let F = [];
    for (let i = 0; i < p.f.length;) { const n = p.f[i]; F.push(p.f.slice(i + 1, i + 1 + n)); i += n + 1; }

    const near = (a, b) => Math.abs(a - b) < 1e-3;
    const find = (b, y, z) => {
      for (let i = 0; i < V.length; i++)
        if (near(V[i].b, b) && near(V[i].y, y) && near(V[i].z, z)) return i;
      throw new Error('akm320Nose: no vertex at ' + [b, y, z]);
    };
    const L_IN = W_FRONT_L_IN, R_IN = W_ROLE.R_IN;

    /* the six corners of the drafted leg's front, before anything moves */
    const outBotL = find(0, NOSE_LEG_OUT, Z.whiteBottom);
    const outBotR = find(1, NOSE_LEG_OUT, Z.whiteBottom);
    const outTopL = find(0, NOSE_LEG_OUT, Z.whiteTop - 2);   // 6.628, under the lip
    const outTopR = find(1, NOSE_LEG_OUT, Z.whiteTop - 2);
    const inBotL  = find(L_IN, NOSE_LEG_IN, Z.whiteBottom);
    const inBotR  = find(R_IN, NOSE_LEG_IN, Z.whiteBottom);
    const inTopL  = find(L_IN, NOSE_LEG_IN, CAVITY_Z);
    const inTopR  = find(R_IN, NOSE_LEG_IN, CAVITY_Z);

    /* 1. SLIDE THE LEG.  Only y moves, and only on the four drafted leg
     *    planes — the ramp start, the bottom's rear edge and the two front
     *    walls' bottom corners.  The leg's own shape is untouched.      */
    for (const v of V) {
      if (near(v.y, NOSE_LEG_RAMP) || near(v.y, NOSE_LEG_REAR)) v.y -= NOSE_SHIFT;
      else if ((v.z < 0 || near(v.z, CAVITY_Z)) &&
               (near(v.y, NOSE_LEG_IN) || near(v.y, NOSE_LEG_OUT)))
        v.y -= NOSE_SHIFT;
    }

    /* 2. THE FOUR NEW CORNERS: the leg's front wall now tops out at the
     *    underside, and the wedge in front of it gets a floor.          */
    const add = v => (V.push(v), V.length - 1);
    const legTopL  = add({ a: 0, b: 0,    y: NOSE_LEG_OUT - NOSE_SHIFT, z: Z.whiteUnder });
    const legTopR  = add({ a: 0, b: 1,    y: NOSE_LEG_OUT - NOSE_SHIFT, z: Z.whiteUnder });
    const floorL   = add({ a: 0, b: 0,    y: NOSE_LEG_OUT,              z: NOSE_FLOOR_Z });
    const floorR   = add({ a: 0, b: 1,    y: NOSE_LEG_OUT,              z: NOSE_FLOOR_Z });

    /* 3. THE FACES.  Two rings gain a corner apiece, the outer front wall
     *    is shortened, and two faces are new: the floor ramp and what is
     *    left of the outer front face under the lip.  The inner front
     *    wall keeps its ring — all four of its corners slid back with the
     *    leg, so it is the same wall, one plane further toward the spine. */
    const same = (f, set) => f.length === set.length && set.every(i => f.indexOf(i) >= 0);
    let outerFront = -1, innerFront = -1;
    F = F.map((f, k) => {
      if (same(f, [outBotL, outTopL, outTopR, outBotR])) { outerFront = k; return [outBotL, legTopL, legTopR, outBotR]; }
      if (same(f, [inTopR, inTopL, inBotL, inBotR]))     { innerFront = k; return f; }
      return f;
    });
    if (outerFront < 0 || innerFront < 0)
      throw new Error('akm320Nose: the drafted front walls are not where they were');

    /* the wedge's underside, and the front face under the lip */
    F.push([legTopL, floorL, floorR, legTopR]);
    F.push([floorL, outTopL, outTopR, floorR]);

    /* the two outer side walls follow the new outline; the inner pair need
     * nothing — their front edge is one straight drop again */
    F = F.map(f => {
      if (f.indexOf(outTopL) >= 0 && f.indexOf(outBotL) >= 0 && f.length > 4)
        return spliceEdge(f, outTopL, outBotL, [floorL, legTopL]);
      if (f.indexOf(outBotR) >= 0 && f.indexOf(outTopR) >= 0 && f.length > 4)
        return spliceEdge(f, outBotR, outTopR, [legTopR, floorR]);
      return f;
    });

    const v = [], f = [];
    for (const q of V) v.push(q.a, q.b, +q.y.toFixed(4), +q.z.toFixed(5));
    for (const r of F) { f.push(r.length); for (const i of r) f.push(i); }
    NOSE_SRC = { w0: p.w0, widths: p.widths, nv: V.length, nf: F.length, v, f, nose: true };
    return NOSE_SRC;
  }

  /* ==================================================================== *
   *  THE CAVITY REACHES BACK WITH THE KEY, AND THE RAMP IS GONE          *
   *                                                                      *
   *  Two things used to be true of the back of a white's shell, and      *
   *  neither is any more.                                                *
   *                                                                      *
   *  THE WALL WAS 4 mm THICK.  The cavity's back wall is drafted 1 mm in *
   *  front of the drafted back face, which is where the key used to end. *
   *  Then BACK_REACH carried the back 3 mm further toward the spine and  *
   *  left the wall where it was, so the key ran out in 4 mm of solid —   *
   *  four times the shell's own wall, and all of it filament spent       *
   *  behind a cavity that stopped short.  The wall follows the back      *
   *  again: it stands at BACK_Y + WALL, which is 1 mm of rear wall, and  *
   *  the underside behind the cavity gains the other 3 mm.               *
   *                                                                      *
   *  AND THE CORNER WAS RAMPED.  The ceiling used to be thickened        *
   *  toward the back on a 8.72 mm ramp landing on the wall at the        *
   *  tongue's underside, because the tongue set out over open air from a *
   *  1 mm knife edge and the first layers of the print had nothing to    *
   *  bear on.  That reasoning is spent: the tongue is 2.54 mm thick and  *
   *  runs flush into the playing surface (see THE TONGUE'S ROOF IS THE   *
   *  KEY'S OWN TOP), and the roof it starts from is 1.8 mm of solid      *
   *  rather than 1 mm (see THE SHELL'S CEILING IS DROPPED).  The corner  *
   *  is square again, which is what it was drafted as.                   *
   * ==================================================================== */
  const BACK_WALL_Y   = 6.068805;          // drafted: the cavity's back wall
  const BACK_WALL_AT  = BACK_Y + WALL;     // 3.0688, where it stands now

  const BACK_SRC = new WeakMap();
  /** the white with its cavity's back wall carried back to BACK_WALL_AT */
  function whiteBackWall(p) {
    const hit = BACK_SRC.get(p);
    if (hit) return hit;
    const v = p.v.slice();
    let moved = 0;
    for (let i = 0; i < p.nv; i++) {
      const j = i * 4 + 2;
      if (Math.abs(v[j] - BACK_WALL_Y) > 1e-3) continue;
      v[j] = +BACK_WALL_AT.toFixed(4);
      moved++;
    }
    /* the wall is four corners and nothing else stands on its plane — the
     * two inner walls' feet and the two the ceiling ends on */
    if (moved !== 4)
      throw new Error('whiteBackWall: the cavity back wall is ' + moved + ' vertices, not 4');
    const out = { w0: p.w0, widths: p.widths, nv: p.nv, nf: p.nf, v, f: p.f.slice(),
                  nose: p.nose, derived: p.derived, back: p.back, roof: p.roof,
                  backWall: true };
    BACK_SRC.set(p, out);
    return out;
  }

  /* ==================================================================== *
   *  THE TONGUE'S ROOF IS THE KEY'S OWN TOP                              *
   *                                                                      *
   *  A white was drafted with its tongue's roof 1.5387 mm below its       *
   *  playing surface, so between the two stood a strip of shell wall and  *
   *  the key met the spine with a step in it.  That strip is what held    *
   *  the bevel down (bevelRoom measured it), and it is the thinnest       *
   *  section anywhere on the key — the one place a white breaks.          *
   *                                                                      *
   *  So the roof is raised to Z.whiteTop.  The tongue keeps its           *
   *  underside, its depth and its x span; what it gains is WHITE_RISE of  *
   *  thickness, and the key's top face and the tongue's roof become one   *
   *  plane running unbroken from the player's edge to the spine, which    *
   *  has been raised to meet it.                                          *
   *                                                                      *
   *  The two rear corners of the key's back face and the two rear corners *
   *  of the tongue's roof now stand at the same point, so they are WELDED *
   *  — the back face above the tongue has no height left, and a face with *
   *  no height is not a face.  The profile is marked `flushTongue`, which *
   *  is what tells the bevel to leave the tongue's outline alone.         *
   * ==================================================================== */
  /* ==================================================================== *
   *  THE SHELL'S CEILING IS DROPPED                                      *
   *                                                                      *
   *  A white is a shell: WALL thick over a hollow, and the ceiling of     *
   *  that hollow — CAVITY_Z, one millimetre under the playing surface —   *
   *  is the FIRST layer of the print, because a white prints playing-face *
   *  down.  One millimetre is three or four layers, and everything above  *
   *  the ceiling is what the finger presses on and what the sensor press  *
   *  hangs off; everything the key does structurally, it does through it. *
   *                                                                      *
   *  So the ceiling comes down ROOF_DROP, and the wall between the roof   *
   *  and the playing face goes from WALL to WALL + ROOF_DROP — 1.4077 mm  *
   *  — which is what carries the key's bending, what the finger presses   *
   *  on, and what the tongue sets out from at the back.  It is also why   *
   *  the back corner needs no ramp any more: the first millimetre and a   *
   *  half of the print is solid where it used to be one wall thick (see   *
   *  THE CAVITY REACHES BACK WITH THE KEY).                               *
   *                                                                      *
   *  It runs AFTER the nose, which finds its corners by the drafted       *
   *  ceiling height, and it moves every vertex standing on that plane —   *
   *  the ceiling itself and the tops of the inner walls that carry it —   *
   *  so the cavity keeps its shape exactly and only gets shallower.       *
   * ==================================================================== */
  const ROOF_DROP = 0.407703;          // how far the shell's ceiling comes down

  const ROOF_SRC = new WeakMap();
  /** the white with the ceiling of its shell dropped ROOF_DROP */
  function whiteRoofDrop(p) {
    if (!(ROOF_DROP > 1e-6)) return p;
    const hit = ROOF_SRC.get(p);
    if (hit) return hit;
    const v = p.v.slice();
    let moved = 0;
    for (let i = 0; i < p.nv; i++) {
      const j = i * 4 + 3;
      if (Math.abs(v[j] - CAVITY_Z) > 1e-3) continue;
      v[j] = +(v[j] - ROOF_DROP).toFixed(5);
      moved++;
    }
    if (!moved) throw new Error('whiteRoofDrop: the shell has no ceiling at ' + CAVITY_Z);
    const out = { w0: p.w0, widths: p.widths, nv: p.nv, nf: p.nf, v, f: p.f.slice(),
                  nose: p.nose, backWall: p.backWall, derived: p.derived,
                  back: p.back, roof: true };
    ROOF_SRC.set(p, out);
    return out;
  }

  const FLUSH_SRC = new WeakMap();
  /** the white with its tongue raised flush into the playing surface */
  function whiteFlushTongue(p) {
    if (!(WHITE_RISE > 1e-6)) return p;
    const hit = FLUSH_SRC.get(p);
    if (hit) return hit;
    const V = [];
    for (let i = 0; i < p.nv; i++) {
      const j = i * 4;
      V.push({ a: p.v[j], b: p.v[j + 1], y: p.v[j + 2], z: p.v[j + 3] });
    }
    let F = [];
    for (let i = 0; i < p.f.length;) { const n = p.f[i]; F.push(p.f.slice(i + 1, i + 1 + n)); i += n + 1; }

    /* the roof is the highest thing the key has at the spine face, which is
     * the tongue and nothing else — see A TONGUE THAT READS NO SPINE */
    let roof = -Infinity;
    for (const q of V) if (q.y < 1e-3 && q.z > roof) roof = q.z;
    if (!(roof > -Infinity)) return p;
    for (const q of V)
      if (q.y < BACK_Y + 1e-3 && Math.abs(q.z - roof) < 1e-4)
        q.z = +(q.z + WHITE_RISE).toFixed(5);

    /* WELD.  Two vertices that now stand at the same (alpha, beta, y, z)
     * stand at the same point at EVERY width the profile spans, so this is
     * a merge and not an approximation. */
    const key = q => [q.a.toFixed(5), q.b.toFixed(6),
                      q.y.toFixed(4), q.z.toFixed(4)].join(',');
    const at = new Map(), map = [];
    for (let i = 0; i < V.length; i++) {
      const k = key(V[i]);
      if (at.has(k)) map.push(at.get(k));
      else { at.set(k, i); map.push(i); }
    }
    F = F.map(r => {
      const out = [];
      for (const i of r) {
        const j = map[i];
        if (!out.length || out[out.length - 1] !== j) out.push(j);
      }
      while (out.length > 1 && out[0] === out[out.length - 1]) out.pop();
      return out;
    }).filter(r => r.length >= 3);

    const v = [], f = [];
    for (const q of V) v.push(q.a, q.b, +q.y.toFixed(4), +q.z.toFixed(5));
    for (const r of F) { f.push(r.length); for (const i of r) f.push(i); }
    const out = { w0: p.w0, widths: p.widths, nv: V.length, nf: F.length, v, f,
                  nose: p.nose, backWall: p.backWall, derived: p.derived,
                  back: p.back, flushTongue: true };
    FLUSH_SRC.set(p, out);
    return out;
  }

  /** every vertex of `p` that stands on the tongue, when it runs flush */
  function onFlushTongue(p, i) {
    return !!p.flushTongue && p.v[i * 4 + 2] <= BACK_Y + 1e-3;
  }

  const REACH_SRC = new WeakMap();
  /**
   * The profile with its back carried BACK_REACH further toward the spine.
   * See THE KEY REACHES BACK.  Runs on any drafted or derived profile and
   * is cached against it, so a key type is only reworked once.
   */
  function backReach(p) {
    if (!(BACK_REACH > 1e-6)) return p;
    const hit = REACH_SRC.get(p);
    if (hit) return hit;
    const V = [];
    for (let i = 0; i < p.nv; i++) {
      const j = i * 4;
      V.push({ a: p.v[j], b: +p.v[j + 1].toFixed(6),
               y: +p.v[j + 2].toFixed(4), z: +p.v[j + 3].toFixed(5) });
    }
    const F = [];
    for (let i = 0; i < p.f.length;) { const n = p.f[i]; F.push(p.f.slice(i + 1, i + 1 + n)); i += n + 1; }
    const onBack = i => Math.abs(V[i].y - TONGUE_Y) < 1e-3;

    /* WHAT EACH BACK CORNER RUNS FORWARD TO.  Only along its OWN wall —
     * same alpha, same beta — because that is the surface whose angle is
     * being continued, and only far enough forward (RUN) that the edge is
     * a lengthwise one rather than a corner of the back itself. */
    const RUN = 1.0;
    const fwd = new Map();
    const put = (i, j) => {
      if (!onBack(i) || V[j].y < TONGUE_Y + RUN) return;
      if (Math.abs(V[i].a - V[j].a) > 1e-6 || Math.abs(V[i].b - V[j].b) > 1e-6) return;
      const q = fwd.get(i);
      if (q == null || V[j].y < V[q].y) fwd.set(i, j);
    };
    for (const f of F)
      for (let k = 0; k < f.length; k++) {
        const i = f[k], j = f[(k + 1) % f.length];
        put(i, j); put(j, i);
      }
    /* WHAT MEETS THE SPINE REACHES BACK FLAT.  Below the top of the
     * tongue's own band — the underside the key stands on and the tongue
     * root itself — every face is a mating surface against the spine, and
     * a face that leaves its plane on the way back would foul the band it
     * lies on.  The band is read off the tongue's y = 0 end, which is the
     * one place only the tongue reaches.  Above it the key is in free air
     * and each face carries on the way it was going. */
    let mate = -Infinity;
    for (const q of V) if (q.y < 1e-3 && q.z > mate) mate = q.z;
    for (let i = 0; i < V.length; i++) {
      if (!onBack(i)) continue;
      const j = fwd.get(i);
      let slope = j == null || V[i].z <= mate + 1e-4
        ? 0 : (V[j].z - V[i].z) / (V[j].y - V[i].y);
      /* a wall steeper than 45 degrees is not a ramp this back is on, it is
       * a step the search happened to reach: carry on flat instead */
      if (!(Math.abs(slope) <= 1)) slope = 0;
      V[i].y = BACK_Y;
      V[i].z = +(V[i].z - slope * BACK_REACH).toFixed(5);
    }
    const v = [], f = [];
    for (const q of V) v.push(q.a, q.b, +q.y.toFixed(4), q.z);
    for (const r of F) { f.push(r.length); for (const i of r) f.push(i); }
    const out = { w0: p.w0, widths: p.widths, nv: V.length, nf: F.length, v, f,
                  nose: p.nose, backWall: p.backWall, derived: p.derived,
                  back: true };
    REACH_SRC.set(p, out);
    return out;
  }

  /**
   * Split the two right-hand walls at the step planes so the rear can move
   * independently of the front.  Returns the profile as editable arrays
   * plus `rearSet` — every vertex index that belongs to the rear — and the
   * corners of the two step faces that have to be added.
   */
  function twoSidedWhiteBase(p, stepOuter, stepInner) {
    const stepYOf = b => (b === W_ROLE.R_OUT ? stepOuter : stepInner);
    const V = [];
    for (let i = 0; i < p.nv; i++) {
      const j = i * 4;
      V.push({ a: p.v[j], b: +p.v[j + 1].toFixed(6),
               y: +p.v[j + 2].toFixed(4), z: +p.v[j + 3].toFixed(4) });
    }
    const F = [];
    for (let i = 0; i < p.f.length;) { const n = p.f[i]; F.push(p.f.slice(i + 1, i + 1 + n)); i += n + 1; }

    const rearOf = new Map(), frontOf = new Map(), rearSet = new Set();
    const add = v => (V.push(v), V.length - 1);
    const n0 = V.length;
    for (let i = 0; i < n0; i++) {
      if (V[i].b !== W_ROLE.R_OUT && V[i].b !== W_ROLE.R_IN) continue;
      rearOf.set(i, i); rearSet.add(i);            // the original is the rear
      frontOf.set(i, add(Object.assign({}, V[i]))); // and it gains a front twin
    }
    const side = i => !rearOf.has(i) ? i
      : (V[i].y <= stepYOf(V[i].b) + 1e-6 ? rearOf.get(i) : frontOf.get(i));
    const cross = (i, j, at) => {
      const A = V[i], B = V[j], t = (at - A.y) / (B.y - A.y);
      return { a: A.a, b: A.b, y: at, z: +(A.z + (B.z - A.z) * t).toFixed(4) };
    };

    const out = [], steps = [];
    for (const f of F) {
      const bs = new Set(f.map(v => V[v].b));
      const ys = f.map(v => V[v].y);
      const b = V[f[0]].b;
      const isWall = bs.size === 1 && (bs.has(W_ROLE.R_OUT) || bs.has(W_ROLE.R_IN));
      const at = stepYOf(b);
      const crosses = Math.min.apply(null, ys) < at - 1e-6 &&
                      Math.max.apply(null, ys) > at + 1e-6;

      if (isWall && crosses) {                     // one wall becomes two
        const rear = [], front = [];
        for (let n = 0; n < f.length; n++) {
          const i = f[n], j = f[(n + 1) % f.length];
          const yi = V[i].y, yj = V[j].y;
          if (Math.abs(yi - at) < 1e-6) {           // ON the plane: both loops
            rear.push(rearOf.get(i)); front.push(frontOf.get(i));
          } else (yi < at ? rear : front).push(yi < at ? rearOf.get(i) : frontOf.get(i));
          if ((yi < at - 1e-6 && yj > at + 1e-6) || (yi > at + 1e-6 && yj < at - 1e-6)) {
            const c = cross(i, j, at);
            const r = add(Object.assign({}, c)), fr = add(Object.assign({}, c));
            rearSet.add(r);
            if (yi < at) { rear.push(r); front.push(fr); }
            else { front.push(fr); rear.push(r); }
          }
        }
        out.push(rear); out.push(front);
        steps.push({ beta: b, rear: rear.slice(-2),
                     front: [front[0], front[front.length - 1]] });
        continue;
      }

      /* every other face keeps one loop; where it walks along a right-hand
       * wall from the rear to the front it gains the step's corner, so the
       * face still closes once the rear moves in */
      const ring = [];
      for (let n = 0; n < f.length; n++) {
        const i = f[n], j = f[(n + 1) % f.length];
        ring.push(side(i));
        if (!rearOf.has(i) || !rearOf.has(j) || V[i].b !== V[j].b) continue;
        const a2 = stepYOf(V[i].b), yi = V[i].y, yj = V[j].y;
        if (Math.abs(yi - a2) < 1e-6 && yj > a2 + 1e-6) { ring.push(frontOf.get(i)); continue; }
        if (Math.abs(yj - a2) < 1e-6 && yi > a2 + 1e-6) { ring.push(frontOf.get(j)); continue; }
        if ((yi < a2 - 1e-6 && yj > a2 + 1e-6) || (yi > a2 + 1e-6 && yj < a2 - 1e-6)) {
          const c = cross(i, j, a2);
          const r = add(Object.assign({}, c)), fr = add(Object.assign({}, c));
          rearSet.add(r);
          if (yi < a2) ring.push(r, fr); else ring.push(fr, r);
        }
      }
      out.push(ring);
    }
    return { V, F: out, w0: p.w0, widths: p.widths, rearSet, steps };
  }

  /**
   * One derived white: the base with its rear placed against whatever
   * stands beside it.  `left` / `right` say whether that gap holds an
   * accidental; where it does not, that side runs flush to the key edge.
   *
   * The rear's six x roles come out as [inset, inset+wall, centre-wall/2,
   * centre+wall/2, width-inset-wall, width-inset] — the 1 mm walls keep
   * their millimetre and the centre rib stays on the centreline, because
   * the rear is symmetric by construction.
   */
  const MIN_REAR = 0.14;    // the least of its own width a rear may keep

  /* ==================================================================== *
   *  A REAR MAY STEP TWICE ON ONE SIDE                                   *
   *                                                                      *
   *  A white's rear is cut back on a side to clear what stands beside it *
   *  and steps out to full width once past it — ONE step, because until  *
   *  now one side ever faced one depth.  An END gap breaks that.  Its    *
   *  white grows out to stand under the WHOLE gap, so when that gap      *
   *  holds two keys side by side the white faces both, and their fronts  *
   *  are at different y.  One step has to clear the deeper of them, and  *
   *  the deck then stops short of the shallower one by the difference —  *
   *  ten millimetres of bare mount in front of a Gray standing beside a  *
   *  Black.  Interior gaps do not have this problem: a white there       *
   *  reaches only to its own edge, which lies between the two lanes, so  *
   *  it faces one of them and depthOf picks that one.                    *
   *                                                                      *
   *  So the rear gets a SECOND step, in front of the shallower key,      *
   *  where it comes out as far as the deeper key alone allows:           *
   *                                                                      *
   *      y < shallow + 1.5     clear of both keys                        *
   *      ... < deep + 1.5      clear of the deep one only    <- the band *
   *      y > deep + 1.5        full width, out to the end               *
   *                                                                      *
   *  IT ONLY WORKS WITH THE DEEPER KEY OUTERMOST.  The band the shallow  *
   *  key vacates has to be reachable from the rear that is already       *
   *  there.  With the deep key outside, the vacated band lies between    *
   *  the rear and the deep key and the rear simply comes out to meet it. *
   *  With the deep key INSIDE, the vacated band is on the far side of    *
   *  it — an island the rear cannot reach without cutting a slot through *
   *  itself.  computeLayout says so rather than drawing something else.  *
   *                                                                      *
   *  The split is `twoSidedWhiteBase`'s, done again at a second plane:   *
   *  every vertex on the wall gains a forward twin, faces that lie on    *
   *  the wall become two, every other face that walks along it gains the *
   *  step's corner, and the two step faces are added.  The twins carry   *
   *  SENTINEL betas so deriveWhiteProfile can give the band its own      *
   *  inset through the same `put` table every other role goes through.   *
   * ==================================================================== */
  const MID_ROLE = { L_OUT: -11, L_IN: -12, R_OUT: -21, R_IN: -22 };

  /**
   * Split the wall carried by betas `spec.outer` / `spec.inner` at a second
   * plane, tagging everything in FRONT of it with `spec.tagOuter` /
   * `spec.tagInner`.  Works on the editable (V, F, rearSet) form, appends
   * only — no vertex is renumbered — and returns the corners of the two
   * new step faces plus the map from a split vertex to its forward twin,
   * so a caller holding indices into V can follow them.
   */
  function midSplit(V, F, rearSet, spec) {
    const atOf  = b => (b === spec.outer ? spec.atOuter : spec.atInner);
    const tagOf = b => (b === spec.outer ? spec.tagOuter : spec.tagInner);
    const onWall = i => (V[i].b === spec.outer || V[i].b === spec.inner) &&
                        (!spec.only || spec.only.has(i));

    const fwdOf = new Map();
    const add = v => (V.push(v), V.length - 1);
    const n0 = V.length;
    for (let i = 0; i < n0; i++) {
      if (!onWall(i)) continue;
      const t = Object.assign({}, V[i]);
      t.b = tagOf(V[i].b);
      const k = add(t);
      fwdOf.set(i, k);
      if (rearSet.has(i)) rearSet.add(k);
    }
    /* which copy a reference to `i` means, given where it sits */
    const pick = i => !fwdOf.has(i) ? i
      : (V[i].y <= atOf(V[i].b) + 1e-6 ? i : fwdOf.get(i));
    const cross = (i, j, at) => {
      const A = V[i], B = V[j], t = (at - A.y) / (B.y - A.y);
      return { a: A.a, b: A.b, y: at, z: +(A.z + (B.z - A.z) * t).toFixed(4) };
    };

    const out = [], steps = [];
    for (const f of F) {
      const bs = new Set(f.map(v => V[v].b));
      const wall = bs.size === 1 && f.every(onWall);
      const at = wall ? atOf(V[f[0]].b) : 0;
      const ys = f.map(v => V[v].y);
      const crosses = wall && Math.min.apply(null, ys) < at - 1e-6 &&
                             Math.max.apply(null, ys) > at + 1e-6;
      if (crosses) {
        /* THE STEP'S CORNERS ARE THE CROSSINGS, NOT RING POSITIONS.  Where
         * in each of the two loops the crossing pair lands depends on
         * where the face happened to start, so they are recorded as they
         * are made.  A wall face crosses the plane exactly twice — it is
         * a wall, not a ring around the key — and those two crossings,
         * back copy and forward copy, are the step face.             */
        const back = [], fwd = [], corners = [];
        for (let n = 0; n < f.length; n++) {
          const i = f[n], j = f[(n + 1) % f.length];
          const yi = V[i].y, yj = V[j].y;
          if (Math.abs(yi - at) < 1e-6) {
            back.push(i); fwd.push(fwdOf.get(i));
            corners.push({ r: i, fr: fwdOf.get(i) });
          }
          else (yi < at ? back : fwd).push(yi < at ? i : fwdOf.get(i));
          if ((yi < at - 1e-6 && yj > at + 1e-6) || (yi > at + 1e-6 && yj < at - 1e-6)) {
            const c = cross(i, j, at);
            const r = add(Object.assign({}, c));
            const fr = add(Object.assign({}, c, { b: tagOf(V[i].b) }));
            if (rearSet.has(i)) { rearSet.add(r); rearSet.add(fr); }
            if (yi < at) { back.push(r); fwd.push(fr); }
            else { fwd.push(fr); back.push(r); }
            corners.push({ r, fr });
          }
        }
        out.push(back); out.push(fwd);
        if (corners.length === 2)
          steps.push({ beta: V[f[0]].b,
                       back: [corners[0].r,  corners[1].r],
                       fwd:  [corners[0].fr, corners[1].fr] });
        continue;
      }
      const ring = [];
      for (let n = 0; n < f.length; n++) {
        const i = f[n], j = f[(n + 1) % f.length];
        ring.push(pick(i));
        if (!fwdOf.has(i) || !fwdOf.has(j) || V[i].b !== V[j].b) continue;
        const a2 = atOf(V[i].b), yi = V[i].y, yj = V[j].y;
        if (Math.abs(yi - a2) < 1e-6 && yj > a2 + 1e-6) { ring.push(fwdOf.get(i)); continue; }
        if (Math.abs(yj - a2) < 1e-6 && yi > a2 + 1e-6) { ring.push(fwdOf.get(j)); continue; }
        if ((yi < a2 - 1e-6 && yj > a2 + 1e-6) || (yi > a2 + 1e-6 && yj < a2 - 1e-6)) {
          const c = cross(i, j, a2);
          const r = add(Object.assign({}, c));
          const fr = add(Object.assign({}, c, { b: tagOf(V[i].b) }));
          if (rearSet.has(i)) { rearSet.add(r); rearSet.add(fr); }
          if (yi < a2) ring.push(r, fr); else ring.push(fr, r);
        }
      }
      out.push(ring);
    }
    return { V, F: out, rearSet, steps, fwdOf };
  }

  /**
   * The clearance an interior gap already provides on its own, which the
   * rear inset is measured on top of.  A function, not a constant: FIT is
   * declared further down, so reading it at module load would be a use
   * before initialisation.  Exported so the layout can invert the same
   * arithmetic when it works out how far a rear has to come back.
   */
  const rearBack = () => SIZE.whiteGap / 2 - FIT.gap;

  function deriveWhiteProfile(base, halfL, halfR, stepL, mid) {
    /* `halfL` / `halfR` are HALF the neighbouring class's width as a ratio
     * of this white's, or 0 for a gap with nothing in it.  A class can be
     * widened until the two insets would meet in the middle; past that the
     * pair is scaled back together, so a rear never inverts and the two
     * sides stay in proportion to the keys that caused them.            */
    let bL = Math.max(0, halfL || 0), bR = Math.max(0, halfR || 0);
    /* NO SIDE MAY TAKE MORE THAN HALF.  The rear is inset per side but the
     * CENTRAL RIB is not: it stands on the key's own centreline whatever
     * the two insets are.  So a rear that is cut past the centreline on
     * one side leaves the rib outside the rear it is supposed to brace,
     * standing alone in the neighbour's gap.  It cannot happen to a key
     * centred in its gap — the 0.86 ceiling keeps every b under 0.43 —
     * but a key standing in ONE LANE of a gap is not centred in it, and
     * can reach that far on its own.  The layout stops it there; this is
     * the backstop, so no caller can ask for a key that has no rib.   */
    const HALF = 0.5;
    if (bL > HALF) bL = HALF;
    if (bR > HALF) bR = HALF;
    const room = 1 - MIN_REAR;
    if (bL + bR > room) { const k = room / (bL + bR); bL *= k; bR *= k; }
    const back = rearBack();                       // what the gap already gives
    const inset = b => b > 0 ? { a: -back, b } : { a: 0, b: 0 };
    const iL = inset(bL), iR = inset(bR);
    const put = {};
    put[W_ROLE.L_OUT] = { a: iL.a,        b: iL.b };
    put[W_ROLE.L_IN]  = { a: iL.a + WALL, b: iL.b };
    put[W_ROLE.C_L]   = { a: -WALL / 2,   b: 0.5 };
    put[W_ROLE.C_R]   = { a: +WALL / 2,   b: 0.5 };
    const rOut = { a: -iR.a,        b: 1 - iR.b };
    const rIn  = { a: -iR.a - WALL, b: 1 - iR.b };
    /* A SHELL WALL IS A MILLIMETRE, NOT A FRACTION.  The capture stored the
     * front's two inner faces as pure beta — 0.043243 and 0.956757 of the
     * drafted width — so they thinned and fattened with the key instead of
     * staying the 1 mm they are.  Restated here as alpha, which also makes
     * them share coordinates with the rear's walls wherever the two meet. */
    const fIn  = { a: WALL,  b: 0 };
    const fInR = { a: -WALL, b: 1 };

    /* THE LEFT STEP IS DRAFTED, THE RIGHT ONE SYNTHESISED.  The captured
     * white already steps on its left at the two planes above, cut for a
     * deep accidental; the base for the right side was split at the planes
     * THIS gap asked for.  So the left one is moved here, to the front of
     * whatever actually stands on that side — and only when something
     * does, since with no inset the step is collinear and welds away. */
    let V = base.V.map(v => Object.assign({}, v));
    let F = base.F.map(f => f.slice());
    let rearSet = base.rearSet, steps = base.steps, midSteps = [];
    /* A step is a pair of corners, not one: the INSET wall ends at the
     * plane and the FULL-WIDTH wall begins on it, so both walls have a
     * vertex there and both have to move together — moving only the inset
     * one leaves the step where it was and tears the face between them. */
    if (bL > 0 && stepL) for (const v of V) {
      if (Math.abs(v.y - STEP_Y_OUTER) < 1e-6 &&
          (v.b === W_ROLE.L_OUT || v.b === 0)) v.y = stepL.outer;
      else if (Math.abs(v.y - STEP_Y_INNER) < 1e-6 &&
          (v.b === W_ROLE.L_IN || Math.abs(v.b - W_FRONT_L_IN) < 1e-6)) v.y = stepL.inner;
    }

    /* THE SECOND STEP, IF THIS SIDE FACES TWO DEPTHS.  Done AFTER the
     * drafted step has been moved, so the band it opens ends on the step
     * that is actually there, and BEFORE the roles are resolved, so the
     * band comes through the same `put` table as everything else.     */
    let bM = 0;
    if (mid) {
      bM = Math.min(HALF, Math.max(0, mid.h || 0));
      const L = mid.side === 'L';
      const sp = midSplit(V, F, new Set(rearSet), {
        outer: L ? W_ROLE.L_OUT : W_ROLE.R_OUT,
        inner: L ? W_ROLE.L_IN  : W_ROLE.R_IN,
        atOuter: mid.at.outer, atInner: mid.at.inner,
        tagOuter: L ? MID_ROLE.L_OUT : MID_ROLE.R_OUT,
        tagInner: L ? MID_ROLE.L_IN  : MID_ROLE.R_IN,
        only: L ? null : rearSet            // the right wall's REAR half only
      });
      V = sp.V; F = sp.F; rearSet = sp.rearSet; midSteps = sp.steps;
      /* the right-hand step this base was already split at now belongs to
       * the band, not to the rear behind it */
      const f = sp.fwdOf;
      steps = steps.map(st => Object.assign({}, st,
        { rear: st.rear.map(i => f.has(i) ? f.get(i) : i) }));
      const iM = inset(bM);
      if (L) {
        put[MID_ROLE.L_OUT] = { a: iM.a,        b: iM.b };
        put[MID_ROLE.L_IN]  = { a: iM.a + WALL, b: iM.b };
      } else {
        put[MID_ROLE.R_OUT] = { a: -iM.a,        b: 1 - iM.b };
        put[MID_ROLE.R_IN]  = { a: -iM.a - WALL, b: 1 - iM.b };
      }
    }

    for (let i = 0; i < V.length; i++) {
      const v = V[i], q = put[v.b];
      if (q) { v.a = q.a; v.b = q.b; continue; }
      if (!rearSet.has(i)) {                        // a front face
        if (Math.abs(v.b - W_FRONT_L_IN) < 1e-6) { v.a = fIn.a;  v.b = fIn.b; }
        else if (Math.abs(v.b - W_ROLE.R_IN) < 1e-6) { v.a = fInR.a; v.b = fInR.b; }
        continue;
      }
      if (Math.abs(v.b - W_ROLE.R_OUT) < 1e-9) { v.a = rOut.a; v.b = rOut.b; }
      else if (Math.abs(v.b - W_ROLE.R_IN) < 1e-6) { v.a = rIn.a; v.b = rIn.b; }
    }
    /* the two right-hand step faces, wound to match the left's: the outer
     * step faces back toward the spine, the inner one forward */
    for (const st of steps)
      F.push(st.beta === W_ROLE.R_OUT
        ? [st.rear[1], st.rear[0], st.front[0], st.front[1]]
        : [st.front[0], st.front[1], st.rear[1], st.rear[0]]);
    /* AND THE SECOND STEP'S TWO, WOUND BY MEASUREMENT.  Which way round a
     * step face goes depends on which way the wall it caps happened to be
     * traversed, and that differs between the outer wall and the inner
     * one, and between the left side and the right — four cases, each
     * easy to get wrong and none of them visible until a mesh leaks.  So
     * it is not guessed: a closed mesh uses every directed edge exactly
     * once, so the ring is offered up, and if any of its directed edges
     * is already spoken for it is turned around.                      */
    if (midSteps.length) {
      const dir = new Set();
      for (const f of F)
        for (let n = 0; n < f.length; n++)
          dir.add(f[n] + '>' + f[(n + 1) % f.length]);
      for (const st of midSteps) {
        const ring = [st.back[0], st.back[1], st.fwd[1], st.fwd[0]];
        let clash = 0;
        for (let n = 0; n < ring.length; n++)
          if (dir.has(ring[n] + '>' + ring[(n + 1) % ring.length])) clash++;
        if (clash) ring.reverse();
        for (let n = 0; n < ring.length; n++)
          dir.add(ring[n] + '>' + ring[(n + 1) % ring.length]);
        F.push(ring);
      }
    }

    /* WELD.  Where a side takes no inset its rear twin lands exactly on its
     * front twin, and the wall the split opened closes again into a
     * zero-width sliver.  Welding on (alpha, beta, y, z) — which is
     * size-independent, so two vertices welded here are coincident at every
     * scale — removes the sliver and the faces that collapsed with it, and
     * the mesh comes back out as tidy as the sheet's own.               */
    const canon = new Map(), keep = [], remap = new Array(V.length);
    for (let i = 0; i < V.length; i++) {
      const k = V[i].a.toFixed(6) + ',' + V[i].b.toFixed(6) + ',' +
                V[i].y.toFixed(4) + ',' + V[i].z.toFixed(4);
      if (!canon.has(k)) { canon.set(k, keep.length); keep.push(V[i]); }
      remap[i] = canon.get(k);
    }
    const faces = [];
    for (const r of F) {
      const q = [];
      for (const i of r) { const c = remap[i]; if (q[q.length - 1] !== c) q.push(c); }
      while (q.length > 1 && q[0] === q[q.length - 1]) q.pop();
      if (new Set(q).size >= 3) faces.push(q);
    }
    const v = [], f = [];
    for (const q of keep) v.push(q.a, q.b, q.y, q.z);
    for (const r of faces) { f.push(r.length); for (const i of r) f.push(i); }
    return { w0: base.w0, widths: base.widths, nv: keep.length, nf: faces.length,
             v, f, derived: true };
  }

  /**
   * The base as captured, unsplit: the drafted topology, which already
   * steps on the LEFT and runs flush on the right.  A white that needs no
   * RIGHT inset needs no right step either, so it is derived on this — one
   * fewer seam, and the mesh comes out as tidy as the sheet's own.
   */
  function plainWhiteBase(p) {
    const V = [];
    for (let i = 0; i < p.nv; i++) {
      const j = i * 4;
      V.push({ a: p.v[j], b: +p.v[j + 1].toFixed(6),
               y: +p.v[j + 2].toFixed(4), z: +p.v[j + 3].toFixed(4) });
    }
    const F = [];
    for (let i = 0; i < p.f.length;) { const n = p.f[i]; F.push(p.f.slice(i + 1, i + 1 + n)); i += n + 1; }
    return { V, F, w0: p.w0, widths: p.widths, rearSet: new Set(), steps: [] };
  }

  let WHITE_BASE = null;
  const WHITE_BASE_2 = {};              // by the right step planes it was split at
  let DERIVED_WHITE = {}, DERIVED_WHITE_N = 0;
  /**
   * The white for a given pair of neighbours.  `cL` / `cR` are neighbour
   * contexts (see ctxKey): how much of this white's width the gap on that
   * side takes, and how deep the deepest key in it reaches.  The width
   * decides how far the rear is cut back, the depth how far forward the
   * cut runs — so a white beside a Full Sized Gray keeps the 10 mm of
   * rear a white beside a Full Sized Black has to give up.  The width is
   * a pure ratio, so one profile per (ratio, depth) pair holds at every
   * size; they are built on demand and cached by that pair.
   */
  function whiteProfile(cL, cR) {
    const halfL = ctxHalf(cL), halfR = ctxHalf(cR);
    /* each side's step follows the depth of what stands on that side */
    const stepL = stepPlanes(ctxDepth(cL)), stepR = stepPlanes(ctxDepth(cR));
    /* THE KEY IS THE WHOLE RATIO.  It used to be rounded to 1e-5 while the
     * profile was derived on the raw value, so two whites whose ratios
     * agree to 1e-5 shared whichever profile was asked for first.  That
     * was invisible while every white was the class width and every ratio
     * was therefore the same number; once whites are resized key by key it
     * made a joint's clearance depend on the order the cache filled.  The
     * key carries the full ratio instead, so a profile is only ever handed
     * back for the ratio it was actually built on.
     *
     * Dragging a key sweeps the ratio continuously and would otherwise
     * pile up an entry per frame for ever, so the cache is emptied once it
     * grows past what a keyboard can use at one time — 64 whites, two
     * sides.  Re-deriving is cheap; the profiles are pure ratios and the
     * live ones come straight back.                                    */
    /* AND A SIDE MAY FACE TWO DEPTHS.  Only an end gap can — see
     * midSplit — and only one side of a key is ever an end gap, so at most
     * one second step is ever asked for. */
    const midOf = (c, side) => {
      const m = c && c.mid;
      return m ? { side, at: stepPlanes(m.d), h: m.h } : null;
    };
    const mid = midOf(cL, 'L') || midOf(cR, 'R');
    const k = halfL + '|' + halfR + '|' + stepL.outer + '|' + stepR.outer +
              (mid ? '|' + mid.side + mid.at.outer + '@' + mid.h : '');
    if (!DERIVED_WHITE[k]) {
      if (DERIVED_WHITE_N > 512) { DERIVED_WHITE = {}; DERIVED_WHITE_N = 0; }
      const src = whiteBackWall(backReach(whiteRoofDrop(
                    akm320Nose(KP.P[KP.INDEX['Full Sized White']['n|n']]))));
      let base;
      if (halfR > 0) {
        const bk = stepR.outer + '|' + stepR.inner;
        base = WHITE_BASE_2[bk] ||
              (WHITE_BASE_2[bk] = twoSidedWhiteBase(src, stepR.outer, stepR.inner));
      } else {
        base = WHITE_BASE || (WHITE_BASE = plainWhiteBase(src));
      }
      DERIVED_WHITE[k] = deriveWhiteProfile(base, halfL, halfR, stepL, mid);
      DERIVED_WHITE_N++;
    }
    return DERIVED_WHITE[k];
  }


  /* ==================================================================== *
   *  THE PLAYING EDGE IS BROKEN, NOT LEFT SHARP                          *
   *                                                                      *
   *  Every keyboard instrument breaks the top edge of its keys.  A key    *
   *  moulded or milled to a sharp arris cuts the finger on a glissando    *
   *  and chips in use, so the trade has always run a small chamfer or     *
   *  radius round the playing surface — a few tenths on a harpsichord     *
   *  natural, up to a millimetre on a modern piano's front lip.  The      *
   *  sheets draw the keys with square arrises because that is what the    *
   *  drafting sandbox held; this puts the break back, and BEVEL is how    *
   *  far it is taken.                                                    *
   *                                                                      *
   *  WHAT IS BEVELLED, AND WHAT IS NOT.  Only the key's own playing       *
   *  surface — and on an accidental that is TWO drafted faces, the flat   *
   *  top and the diagonal nose the finger runs down towards the player.   *
   *  They are welded into one region first, so the break is taken round   *
   *  the region's outer boundary and the ridge they share is rolled       *
   *  instead: the surface falls away under the hand in one continuous     *
   *  sweep rather than as two separately rounded plates standing proud of *
   *  each other.  Everything below that boundary — the side walls with    *
   *  their draft, the front lip — keeps its drafted line.  Nothing else   *
   *  in the design is                                                     *
   *  touched: not the spine, not the feet, not the sensor press, not the  *
   *  tongues that plug into the spine, not the underside or its ribbing,  *
   *  and not the internal cavity — a key beside this one meets the same   *
   *  walls it always did, so the widths, the size solve and every         *
   *  clearance stand exactly as they were.                               *
   *                                                                      *
   *  THE BREAK IS THE SAME ALL THE WAY ROUND.  Including the arris at the *
   *  back of the key: that is still an edge of the playing surface, and   *
   *  running the chamfer out short of it would leave the wall beneath it  *
   *  tapering the whole length of the key to get back to square.  It is   *
   *  the key's own rear top corner, not the joint — the tongue below it   *
   *  and the spine it plugs into are the same as they ever were, and only *
   *  the shell wall between the two loses anything, which is what         *
   *  BEVEL_MAX is set from.                                              *
   *                                                                      *
   *  IT IS DONE ON THE PROFILE, NOT ON THE MESH.  A bevelled profile is   *
   *  still (alpha, beta, y, z) per vertex, because a chamfer on a         *
   *  rectilinear loop is a constant millimetre offset along x and y and   *
   *  therefore a shift of alpha and of y — beta never moves.  So the      *
   *  bevel spans every width the way the drafted profile does, and the    *
   *  preview, the STLs and the generated Blender log all get it from the  *
   *  one place, with nothing to keep in step.                            *
   *                                                                      *
   *  HOW FAR IT MAY BE TAKEN.  The slider reaches BEVEL_MAX, and EACH KEY *
   *  IS THEN HELD TO ITS OWN WALL — see bevelRoom.  The arris drops by    *
   *  the full radius, so the wall it runs down has to be that deep before *
   *  it meets whatever the profile does next; past that the wall inverts  *
   *  and the key is no longer a solid the slicer can read.  The white     *
   *  used to be the tight one — 1.539 mm of rear wall between its playing *
   *  surface and the roof of the mortice its tongue plugged into — but    *
   *  that wall is gone: its tongue runs flush into its top now (see THE   *
   *  TONGUE'S ROOF IS THE KEY'S OWN TOP) and its rear arris is not broken *
   *  at all, so the white is held by its front lip's 2.0 mm like anything *
   *  else, while an accidental stands 4.5 mm or more clear of anything    *
   *  under its nose.  So a full 2 mm break is real on the accidentals and *
   *  every other key takes the deepest round its own wall will carry —    *
   *  which is what a maker does by hand, finessing each key to the wood   *
   *  that is actually there — rather than every key being held down to    *
   *  the thinnest one, or the cavity being opened by a slip of the        *
   *  slider.                                                             *
   *                                                                      *
   *  IT IS A FILLET, NOT A FLAT CHAMFER.  A true quarter-circle profile —  *
   *  the shape a round-over cutter or a hand-sanded key actually leaves —  *
   *  tangent to the wall where it starts and to the playing surface where  *
   *  it ends, so there is no crease at either end of it.  It is built as   *
   *  BEVEL_SEGMENTS flat strips along that arc, which is enough to read as *
   *  round at the size this keyboard prints at and cheap enough to rebuild *
   *  on every drag of the slider.                                         *
   *                                                                      *
   *  A HARD TURN IS NOTED, NOT SMOOTHED AWAY.  The offset at a corner is   *
   *  b / sin(half the turn), so a corner tight enough to throw that well   *
   *  past the radius is one a round of that radius cannot follow — it      *
   *  pinches on a convex point and self-overlaps on a concave one.  A      *
   *  square corner is b·sqrt2 and perfectly fine; past BEVEL_HARD_TURN the *
   *  corner is counted onto the profile, and computeLayout adds up what    *
   *  this design actually uses and says so once in a warning, rather than  *
   *  rounding badly and saying nothing.                                   *
   * ==================================================================== */
  const BEVEL_MAX = 2.0;             // mm
  const BEVEL_EPS = 1e-6;
  const BEVEL_SEGMENTS = 8;          // flat strips along the quarter circle
  const BEVEL_HARD_TURN = 1.9;       // miter/radius past which it is noted
  const BEVEL_KEEP = 0.15;           // wall left standing under the deepest break

  let BEVEL = 0;
  /** how far the playing edge is broken, in mm; clamped to [0, BEVEL_MAX] */
  function setBevel(mm) {
    const b = Math.min(BEVEL_MAX, Math.max(0, +mm || 0));
    BEVEL = b;
    return BEVEL;
  }
  function getBevel() { return BEVEL; }

  /* one bevelled copy per (source profile, amount).  Profiles are handed
   * out by identity — KP.P entries and the derived-white cache — so the
   * copy hangs off the source itself and dies with it. */
  const BEVEL_CACHE = new WeakMap();

  /** ring -> Newell normal, at the instantiated points */
  function ringNormal(V, r) {
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < r.length; i++) {
      const a = V[r[i]], b = V[r[(i + 1) % r.length]];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const L = Math.hypot(nx, ny, nz) || 1;
    return [nx / L, ny / L, nz / L];
  }

  /**
   * The bevel target is every face that reaches the player-facing edge.
   * That includes the true top of a white key and the sloped / vertical
   * front faces of accidental keys, because the rounded-over break should
   * run from the front edge into the diagonal nose rather than stopping at
   * the flat upper section alone.
   */
  function topFaces(V, F) {
    let zmax = -Infinity, ymax = -Infinity;
    for (const p of V) {
      if (p[2] > zmax) zmax = p[2];
      if (p[1] > ymax) ymax = p[1];
    }
    const out = [], seen = new Set();
    const add = i => { if (!seen.has(i)) { seen.add(i); out.push(i); } };
    for (let i = 0; i < F.length; i++) {
      const r = F[i];
      if (r.length < 3) continue;
      const N = ringNormal(V, r);
      const onTop = N[2] >= 0.9 && r.some(j => V[j][2] > zmax - 1e-4);
      const onFront = N[1] > 0.5 && r.some(j => V[j][1] > ymax - 1e-4) && N[2] > 0.1;
      if (onTop || onFront) add(i);
    }
    return out;
  }

  /* what each profile's own walls will carry, measured once and kept */
  const ROOM_CACHE = new WeakMap();

  /**
   * HOW DEEP A BREAK THIS PROFILE CAN ACTUALLY TAKE.
   *
   * The arris does not stay where it was drawn: the round is tangent to
   * the wall, so the boundary of the playing surface DROPS by the full
   * radius and the wall below it gives that much up.  A wall has only so
   * much to give — a white's front lip has 2.0 mm before it reaches the
   * pocket under its nose — and a break deeper
   * than that does not cut a bigger round, it drags the arris PAST the
   * feature below and the wall doubles back on itself.  The key stays
   * edge-closed while it does, which is exactly why it is worth measuring
   * rather than trusting: the count says nothing and the solid is ruined.
   *
   * What is measured is the drop to the first vertex the profile holds
   * DIRECTLY BENEATH an arris vertex — same alpha, same beta, so the two
   * stand over one another at every width the profile spans, not just at
   * the drafted one.  A neighbour that is merely lower and off to one side
   * is no obstacle: it lies in the wall's own plane and the wall simply
   * changes shape around it, which is what an accidental's stepped
   * shoulder does under its nose.  A profile with nothing under its arris
   * at all is held at BEVEL_MAX like everything else.
   *
   * BEVEL_KEEP comes off the drop.  Taken to the drop itself the round is
   * tangent to the wall exactly where the wall ends, which leaves the two
   * meeting at nothing — a feather edge to print, and a tangency for the
   * arithmetic to fall the wrong side of.  A sliver of real wall under the
   * round costs a seventh of a millimetre and is worth having.
   */
  function bevelRoom(p) {
    const hit = ROOM_CACHE.get(p);
    if (hit != null) return hit;

    const w = p.w0 || 1;
    const V = [];
    for (let i = 0; i < p.nv; i++) {
      const j = i * 4;
      V.push([p.v[j] + p.v[j + 1] * w, p.v[j + 2], p.v[j + 3]]);
    }
    const F = [];
    for (let k = 0; k < p.f.length;) { const n = p.f[k++]; F.push(p.f.slice(k, k + n)); k += n; }

    const tops = topFaces(V, F);
    if (!tops.length) { ROOM_CACHE.set(p, BEVEL_MAX); return BEVEL_MAX; }

    /* the playing faces are welded into regions and the arris taken round
     * the region's outer boundary, the same way the break itself does it —
     * an edge in the middle of a region is not an arris and drops nothing */
    const ek = (i, j) => (i < j ? i + ':' + j : j + ':' + i);
    const uf = new Map();
    const find = x => { while (uf.get(x) !== x) { uf.set(x, uf.get(uf.get(x))); x = uf.get(x); } return x; };
    for (const fi of tops) uf.set(fi, fi);
    const heldBy = faces => {
      const m = new Map();
      for (const fi of faces) {
        const r = F[fi];
        for (let i = 0; i < r.length; i++) {
          const k = ek(r[i], r[(i + 1) % r.length]);
          const a = m.get(k);
          if (a) a.push(fi); else m.set(k, [fi]);
        }
      }
      return m;
    };
    for (const [, fs] of heldBy(tops)) {
      if (fs.length !== 2) continue;
      const a = find(fs[0]), c = find(fs[1]);
      if (a !== c) uf.set(a, c);
    }
    const regions = new Map();
    for (const fi of tops) {
      const rt = find(fi);
      const a = regions.get(rt);
      if (a) a.push(fi); else regions.set(rt, [fi]);
    }
    const arris = new Set();
    for (const [, faces] of regions) {
      const eF = heldBy(faces);
      for (const fi of faces) {
        const r = F[fi];
        for (let i = 0; i < r.length; i++) {
          const u = r[i], v = r[(i + 1) % r.length];
          if (eF.get(ek(u, v)).length === 1) { arris.add(u); arris.add(v); }
        }
      }
    }

    const over = (a, c) =>                       // c stands directly under a
      Math.abs(p.v[a * 4]     - p.v[c * 4])     < 1e-4 &&
      Math.abs(p.v[a * 4 + 1] - p.v[c * 4 + 1]) < 1e-6 &&
      Math.abs(p.v[a * 4 + 2] - p.v[c * 4 + 2]) < 1e-4;

    let room = BEVEL_MAX;
    for (const r of F)
      for (let i = 0; i < r.length; i++) {
        const u = r[i], v = r[(i + 1) % r.length];
        for (const [a, c] of [[u, v], [v, u]]) {
          if (!arris.has(a)) continue;
          /* a stretch of boundary the break is held off does not measure
             the wall it stands on — see THE TONGUE IS NOT BROKEN */
          if (onFlushTongue(p, a)) continue;
          const d = V[a][2] - V[c][2];
          if (d > BEVEL_EPS && over(a, c)) {
            const r = Math.max(0, d - BEVEL_KEEP);
            if (r < room) room = r;
          }
        }
      }
    ROOM_CACHE.set(p, room);
    return room;
  }

  /**
   * Break the playing edge of one profile by `b` mm.
   *
   * The playing face's boundary loop is INSET by b in its own plane and
   * the original loop is DROPPED by b, so the surface keeps its height and
   * its walls keep their line; the round-over is built as BEVEL_SEGMENTS
   * flat strips swept along a quarter circle between the two, the same way
   * all the way round the loop — the rear arris, where the key stands
   * against the spine, included.
   */
  function bevelProfile(p, b) {
    /* HELD TO THIS KEY'S OWN WALL.  The ask is the same for every key on
     * the keyboard; what it comes out at is not, because the wall under
     * the arris is not.  Clamping here rather than at the slider means the
     * preview, the STLs and the log all read the break off the profile
     * that was actually built, and the cache is keyed on what was cut. */
    if (!(b > BEVEL_EPS)) return p;
    b = Math.min(b, bevelRoom(p));
    if (!(b > BEVEL_EPS)) return p;
    let per = BEVEL_CACHE.get(p);
    if (!per) BEVEL_CACHE.set(p, per = new Map());
    const key = b.toFixed(4);
    const hit = per.get(key);
    if (hit) return hit;

    /* work at the drafted width: the loop is rectilinear, so the offsets
     * come out as constants in mm and hold at every other width */
    const w = p.w0 || 1;
    const V = [];
    for (let i = 0; i < p.nv; i++) {
      const j = i * 4;
      V.push([p.v[j] + p.v[j + 1] * w, p.v[j + 2], p.v[j + 3]]);
    }
    const F = [];
    for (let k = 0; k < p.f.length;) { const n = p.f[k++]; F.push(p.f.slice(k, k + n)); k += n; }

    /* ---- A VERTEX THAT IS ON NOBODY'S CORNER IS DROPPED FIRST ----
     *
     * The drafted keys carry vertices that stand in the MIDDLE of a
     * straight edge — a step that welded out, a seam the sheet left behind
     * — and are collinear in every face that holds them.  They are free
     * while nothing else changes, because the ear clipper meets them as
     * zero-area ears and drops them, and the faces either side of the run
     * drop the same one.  They stop being free the moment a NEW face is
     * built along that run: the chamfer keeps the vertex, one wall keeps
     * it, the other drops it, and the two no longer meet on the same edge.
     *
     * So they come out before anything else.  A vertex is removed only
     * where EVERY ring holding it has it collinear with its neighbours in
     * that ring, which makes the removal exactly geometry-neutral — the
     * same solid, one fewer way to describe it.
     * -------------------------------------------------------------- */
    {
      const flat = new Array(p.nv).fill(true), held = new Array(p.nv).fill(false);
      for (const r of F) {
        if (r.length < 3) continue;
        for (let k = 0; k < r.length; k++) {
          const P = V[r[k]], A = V[r[(k + r.length - 1) % r.length]],
                B = V[r[(k + 1) % r.length]];
          held[r[k]] = true;
          const u = [P[0] - A[0], P[1] - A[1], P[2] - A[2]];
          const v2 = [B[0] - P[0], B[1] - P[1], B[2] - P[2]];
          const cx = u[1] * v2[2] - u[2] * v2[1], cy = u[2] * v2[0] - u[0] * v2[2],
                cz = u[0] * v2[1] - u[1] * v2[0];
          const lu = Math.hypot(u[0], u[1], u[2]), lv = Math.hypot(v2[0], v2[1], v2[2]);
          if (!(lu > 1e-7 && lv > 1e-7 &&
                Math.hypot(cx, cy, cz) / (lu * lv) < 1e-6)) flat[r[k]] = false;
        }
      }
      for (let i = 0; i < F.length; i++) {
        const r = F[i].filter(j => !(held[j] && flat[j]));
        if (r.length >= 3) F[i] = r;
      }
    }

    const tops = topFaces(V, F);
    if (!tops.length) { per.set(key, p); return p; }

    /* mutable copies — alpha/beta/y/z per vertex, rings as arrays */
    const nv = [];
    for (let i = 0; i < p.nv; i++) {
      const j = i * 4;
      nv.push({ a: p.v[j], b: p.v[j + 1], y: p.v[j + 2], z: p.v[j + 3] });
    }
    const nf = F.map(r => r.slice());
    /* corners this profile carries that the round cannot follow.  Counted
     * onto the profile rather than into a running total, so it survives
     * the cache: a design that reuses a profile is asking about the same
     * corners each time it does. */
    let hard = 0;

    /* A NEW VERTEX, OFFSET FROM ONE THAT IS ALREADY THERE.  The offset goes
     * into alpha, which is millimetres outright, and beta — the part of x
     * that is a fraction of the key's width — is inherited unchanged.  So
     * the new point tracks its source across every width the profile spans
     * and the break stays the same size on a narrow key as on a wide one.
     * V is grown alongside, because everything below reads the mesh as it
     * now stands rather than as it was drafted. */
    const addFrom = (src, dx, y, z) => {
      const q = { a: nv[src].a + dx, b: nv[src].b, y, z };
      nv.push(q);
      V.push([q.a + q.b * w, y, z]);
      return nv.length - 1;
    };
    const ekey = (i, j) => (i < j ? i + ':' + j : j + ':' + i);
    /* ---- THE TONGUE IS NOT BROKEN ----
     *
     * A white's playing top now runs on into the roof of its tongue as one
     * flat plane (see THE TONGUE'S ROOF IS THE KEY'S OWN TOP), so the
     * tongue's own outline has become part of the boundary of the surface
     * the break is taken round.  It must not be: the tongue is a plug, and
     * a plug with a rounded-over rim is a plug that rattles in its mortice
     * — and the arris the round drops belongs to a flange 2.5 mm thick,
     * which a 2 mm break would eat most of the way through.
     *
     * So every boundary edge that lies wholly on the tongue is held out of
     * the break.  What is left is an open chain running from one side of
     * the tongue, round the player's edge, and back to the other, and it
     * is broken exactly as a closed loop is, with a flat cap at each end
     * standing in the plane where the tongue begins.  The result is what
     * was asked for: the key's top face meets the tongue and the spine
     * dead flush, with no groove between them.
     */
    const noBreak = (u, v2) => onFlushTongue(p, u) && onFlushTongue(p, v2);
    const sub = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
    const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    const cross = (a, c) => [a[1] * c[2] - a[2] * c[1],
                             a[2] * c[0] - a[0] * c[2],
                             a[0] * c[1] - a[1] * c[0]];
    const unit = a => {
      const L = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / L, a[1] / L, a[2] / L];
    };
    const centroid = r => {
      const c = [0, 0, 0];
      for (const i of r) { c[0] += V[i][0]; c[1] += V[i][1]; c[2] += V[i][2]; }
      return [c[0] / r.length, c[1] / r.length, c[2] / r.length];
    };
    /** the faces of a ring, by the edges only one of a set of faces holds */
    const edgeFaces = faces => {
      const m = new Map();
      for (const fi of faces) {
        const r = nf[fi];
        for (let i = 0; i < r.length; i++) {
          const k = ekey(r[i], r[(i + 1) % r.length]);
          const a = m.get(k);
          if (a) a.push(fi); else m.set(k, [fi]);
        }
      }
      return m;
    };

    /* ---- THE PLAYING SURFACE IS ONE REGION, NOT A PILE OF FACES ----
     *
     * An accidental's playing surface is drafted as two faces: the flat top
     * and the diagonal nose the finger slides down towards the player.  They
     * are one surface, and rounding each of them separately is what makes
     * the key bulge: every face gets its own rim, so the two rims meet back
     * to back along the ridge they share and stand proud of it, and the key
     * reads as a stack of rounded plates rather than one shape falling away
     * under the hand.  So the faces that reach the playing edge are welded
     * into regions first — anything sharing an edge is one surface — and it
     * is the REGION's outer boundary that is broken.  An edge in the middle
     * of a region is not an arris and gets no chamfer.
     * -------------------------------------------------------------- */
    const uf = new Map();
    const find = x => { while (uf.get(x) !== x) { uf.set(x, uf.get(uf.get(x))); x = uf.get(x); } return x; };
    for (const fi of tops) uf.set(fi, fi);
    for (const [, fs] of edgeFaces(tops)) {
      if (fs.length !== 2) continue;
      const a = find(fs[0]), c = find(fs[1]);
      if (a !== c) uf.set(a, c);
    }
    const regions = new Map();
    for (const fi of tops) {
      const rt = find(fi);
      const a = regions.get(rt);
      if (a) a.push(fi); else regions.set(rt, [fi]);
    }

    /* ---- AND THE RIDGE INSIDE IT IS ROLLED, NOT LEFT SHARP ----
     *
     * Welding the faces together stops the bulge, but on its own it leaves
     * the ridge between top and nose a hard arris in the middle of the
     * playing surface — the very edge the finger crosses on its way to the
     * player.  A real key has no such crease: the top rolls over into the
     * slope in one continuous surface.  So every interior edge of a region
     * that actually turns, and turns OUTWARD, is replaced by a quarter-round
     * of the same radius the arris gets: each face is trimmed back by r
     * along its own plane, and CREASE_SEGMENTS strips are swept round the
     * arc that is tangent to both.  It takes material off the ridge and adds
     * none, so the key's silhouette, its widths and every clearance are the
     * same as they were drafted.
     *
     * At the two ends the ridge runs out onto the region's boundary, where
     * the side wall stands.  The wall's own ring gets the arc's points
     * spliced in where the ridge vertex used to be, so the wall follows the
     * roll instead of tearing away from it, and the boundary loop that the
     * chamfer below walks then runs over the arc as a matter of course —
     * one loop, no seam, and the same vertex count on both sides of every
     * edge.  A ridge that branches, closes on itself, dies inside the
     * surface, or is held by a face outside the region is left alone rather
     * than rolled badly.
     * -------------------------------------------------------------- */
    const CREASE_MIN = 0.25;                 // rad of turn worth rolling
    const CREASE_SEGMENTS = BEVEL_SEGMENTS;

    /** roll one ordered ridge between faces fa and fb; true if it was done */
    function rollChain(chain, fa, fb, faces) {
      const n = chain.length;
      const na = ringNormal(V, nf[fa]), nb = ringNormal(V, nf[fb]);
      /* nothing outside the two faces may hold a vertex in the middle of the
       * ridge, and both ends must be held by something (the wall) that can
       * take the arc; otherwise the roll would open a hole */
      const endFaces = [[], []];
      for (let fi = 0; fi < nf.length; fi++) {
        if (fi === fa || fi === fb) continue;
        const r = nf[fi];
        for (let i = 0; i < n; i++) {
          if (r.indexOf(chain[i]) < 0) continue;
          if (i > 0 && i < n - 1) return false;
          endFaces[i === 0 ? 0 : 1].push(fi);
        }
      }
      if (!endFaces[0].length || !endFaces[1].length) return false;

      const cA = centroid(nf[fa]), cB = centroid(nf[fb]);
      const dA = [], dB = [];
      for (let i = 0; i < n; i++) {
        const P = V[chain[i]];
        const t = unit(sub(V[chain[Math.min(n - 1, i + 1)]], V[chain[Math.max(0, i - 1)]]));
        let a = unit(cross(na, t)), c = unit(cross(nb, t));
        if (dot(a, sub(cA, P)) < 0) a = [-a[0], -a[1], -a[2]];
        if (dot(c, sub(cB, P)) < 0) c = [-c[0], -c[1], -c[2]];
        dA.push(a); dB.push(c);
      }

      /* the roll is the arris radius, held back from eating either face */
      let r = b;
      for (let i = 0; i < n; i++) {
        let ea = 0, eb = 0;
        for (const q of nf[fa]) ea = Math.max(ea, dot(dA[i], sub(V[q], V[chain[i]])));
        for (const q of nf[fb]) eb = Math.max(eb, dot(dB[i], sub(V[q], V[chain[i]])));
        r = Math.min(r, 0.45 * ea, 0.45 * eb);
      }
      if (!(r > BEVEL_EPS)) return false;

      /* THE ARC.  Tangent to fa at P + r·dA and to fb at P + r·dB, centred
       * where those two tangents' normals cross: C = P + t(dA + dB) with
       * t = r / (1 + dA·dB), which is the one point at equal distance from
       * both tangent points along each face's own normal. */
      const arc = [];
      for (let i = 0; i < n; i++) {
        const P = V[chain[i]], a = dA[i], c = dB[i];
        const cs = dot(a, c);
        if (cs <= -0.999) return false;
        const t = r / (1 + cs);
        const C = [P[0] + t * (a[0] + c[0]), P[1] + t * (a[1] + c[1]), P[2] + t * (a[2] + c[2])];
        const u0 = sub([P[0] + r * a[0], P[1] + r * a[1], P[2] + r * a[2]], C);
        const u1 = sub([P[0] + r * c[0], P[1] + r * c[1], P[2] + r * c[2]], C);
        const R = Math.hypot(u0[0], u0[1], u0[2]);
        if (!(R > BEVEL_EPS)) return false;
        const ang = Math.acos(Math.max(-1, Math.min(1, dot(u0, u1) / (R * R))));
        const e1 = unit(u0);
        const pr = dot(u1, e1);
        const e2 = unit(sub(u1, [e1[0] * pr, e1[1] * pr, e1[2] * pr]));
        const row = [];
        for (let k = 0; k <= CREASE_SEGMENTS; k++) {
          const th = ang * k / CREASE_SEGMENTS, co = Math.cos(th), si = Math.sin(th);
          const x = C[0] + R * (co * e1[0] + si * e2[0]);
          const y = C[1] + R * (co * e1[1] + si * e2[1]);
          const z = C[2] + R * (co * e1[2] + si * e2[2]);
          row.push(addFrom(chain[i], x - P[0], y, z));
        }
        arc.push(row);
      }

      const quads = [];
      for (let i = 0; i + 1 < n; i++)
        for (let k = 0; k < CREASE_SEGMENTS; k++)
          quads.push([arc[i][k], arc[i][k + 1], arc[i + 1][k + 1], arc[i + 1][k]]);
      if (!quads.length) return false;
      const up = [na[0] + nb[0], na[1] + nb[1], na[2] + nb[2]];
      if (dot(ringNormal(V, quads[0]), up) < 0) for (const q of quads) q.reverse();

      /* the two faces give the ridge up and stop at their tangent lines */
      const at = new Map();
      for (let i = 0; i < n; i++) at.set(chain[i], i);
      nf[fa] = nf[fa].map(q => (at.has(q) ? arc[at.get(q)][0] : q));
      nf[fb] = nf[fb].map(q => (at.has(q) ? arc[at.get(q)][CREASE_SEGMENTS] : q));

      /* and the wall at each end follows the arc across */
      const faSet = new Set(nf[fa]);
      for (let e = 0; e < 2; e++) {
        const i0 = e === 0 ? 0 : n - 1, vtx = chain[i0], row = arc[i0];
        for (const fi of endFaces[e]) {
          const ring = nf[fi], k = ring.indexOf(vtx);
          if (k < 0) continue;
          const before = ring[(k + ring.length - 1) % ring.length];
          const seq = faSet.has(before) ? row.slice() : row.slice().reverse();
          nf[fi] = ring.slice(0, k).concat(seq, ring.slice(k + 1));
        }
      }

      const base = nf.length;
      for (const q of quads) { nf.push(q); faces.push(nf.length - 1); }
      return base >= 0;
    }

    /** roll every ridge inside one region */
    function rollCreases(faces) {
      const FN = new Map();
      for (const fi of faces) FN.set(fi, ringNormal(V, nf[fi]));
      const cos0 = Math.cos(CREASE_MIN);
      const byPair = new Map();
      for (const [k, fs] of edgeFaces(faces)) {
        if (fs.length !== 2) continue;
        const na = FN.get(fs[0]), nb = FN.get(fs[1]);
        if (dot(na, nb) > cos0) continue;
        const ends = k.split(':').map(Number);
        /* orient the edge the way the first face winds it; a ridge (as
         * against a valley) is then the turn that goes outward */
        let a = ends[0], c = ends[1];
        const r = nf[fs[0]];
        let fwd = false;
        for (let i = 0; i < r.length; i++)
          if (r[i] === a && r[(i + 1) % r.length] === c) { fwd = true; break; }
        if (!fwd) { a = ends[1]; c = ends[0]; }
        if (dot(cross(na, nb), sub(V[c], V[a])) <= 0) continue;   // a valley
        const pk = ekey(fs[0], fs[1]);
        const g = byPair.get(pk);
        if (g) g.push([a, c, fs[0], fs[1]]);
        else byPair.set(pk, [[a, c, fs[0], fs[1]]]);
      }
      for (const [, es] of byPair) {
        const nxt = new Map(), prv = new Map();
        let bad = false;
        for (const e of es) {
          if (nxt.has(e[0]) || prv.has(e[1])) { bad = true; break; }
          nxt.set(e[0], e[1]); prv.set(e[1], e[0]);
        }
        if (bad) continue;
        let start = null;
        for (const e of es) if (!prv.has(e[0])) { start = e[0]; break; }
        if (start === null) continue;                 // a closed ring of ridges
        const chain = [start];
        while (nxt.has(chain[chain.length - 1])) chain.push(nxt.get(chain[chain.length - 1]));
        if (chain.length !== es.length + 1) continue;  // it branched
        rollChain(chain, es[0][2], es[0][3], faces);
      }
    }

    for (const [, faces] of regions) {
      rollCreases(faces);

      /* ---- THE REGION'S OWN BOUNDARY ----
       *
       * The arris is every edge only one face of the region holds.  Taken in
       * the direction its face winds it, those edges chain straight into the
       * loop, already wound the way the surface is. */
      const eF = edgeFaces(faces);
      const nxt = new Map(), owner = new Map();
      for (const fi of faces) {
        const r = nf[fi];
        for (let i = 0; i < r.length; i++) {
          const u = r[i], v2 = r[(i + 1) % r.length];
          if (eF.get(ekey(u, v2)).length !== 1) continue;
          if (noBreak(u, v2)) continue;          // the tongue keeps its arris
          nxt.set(u, v2); owner.set(u, fi);
        }
      }
      const prv = new Map();
      for (const [u, v2] of nxt) prv.set(v2, u);
      const loops = [], seen2 = new Set();
      const walk = s => {
        const chain = [];
        let cur = s;
        while (nxt.has(cur) && !seen2.has(cur)) { seen2.add(cur); chain.push(cur); cur = nxt.get(cur); }
        return { chain, end: cur };
      };
      /* AN ARRIS THAT IS HELD OFF PART OF THE BOUNDARY IS A CHAIN, NOT A
       * LOOP.  The white's tongue keeps its square outline (see THE TONGUE
       * IS NOT BROKEN), so the boundary comes away as an open run with two
       * ends standing on geometry that does not move.  Those are walked
       * first, each from the vertex nothing runs into; whatever is left is
       * a closed loop and is broken all the way round as it always was. */
      for (const s of nxt.keys()) {
        if (prv.has(s) || seen2.has(s)) continue;
        const w2 = walk(s);
        if (w2.chain.length >= 2) loops.push({ ring: w2.chain.concat([w2.end]), closed: false });
      }
      for (const s of nxt.keys()) {
        if (seen2.has(s)) continue;
        const w2 = walk(s);
        if (w2.end === s && w2.chain.length >= 3) loops.push({ ring: w2.chain, closed: true });
      }

      for (const { ring, closed } of loops) {
        /* THE ARRIS IS ITS CORNERS, NOT ITS VERTICES.  A drafted loop carries
         * vertices that lie flat on a straight run — welded-out steps, seams
         * a neighbouring wall still needs — and offsetting one of those gives
         * a point collinear with its neighbours, which the ear clipper drops
         * as a zero-area ear while the chamfer beside it keeps.  That is a
         * T-junction, and a T-junction is a hole.  So the offset is worked
         * out on the CORNERS alone; the flat vertices stay on the arris,
         * where the walls still find them, and the chamfer face beside them
         * simply runs the whole straight segment.
         *
         * The test is in THREE dimensions, not in plan.  A region's boundary
         * runs down the side of the key from the top face onto the nose, and
         * those two runs are the same line seen from above — flat in plan
         * and a hard turn in fact.  Judged in plan the turn would be missed
         * and the inset surface would cut straight from the back of the key
         * to its lip, taking the nose with it.                             */
        const corner = [];
        for (let i = 0; i < ring.length; i++) {
          /* a chain's two ends anchor the round against the geometry it
           * runs out onto, so they carry an offset whether they turn or not */
          if (!closed && (i === 0 || i === ring.length - 1)) { corner.push(i); continue; }
          const P = V[ring[i]], A = V[ring[(i + ring.length - 1) % ring.length]],
                B = V[ring[(i + 1) % ring.length]];
          const u = sub(P, A), v2 = sub(B, P);
          const lu = Math.hypot(u[0], u[1], u[2]), lv = Math.hypot(v2[0], v2[1], v2[2]);
          const cr = cross(u, v2);
          if (lu > 1e-7 && lv > 1e-7 &&
              Math.hypot(cr[0], cr[1], cr[2]) / (lu * lv) > 1e-6) corner.push(i);
        }
        const m = corner.length;
        if (m < 3) continue;

        /* per corner: the full-displacement miter offset (dx, dy), same
         * direction the flat chamfer used — the round runs along it rather
         * than along each edge's own normal, so the two walls either side of
         * a corner still meet the fillet on a clean line.  levels[k][c] is
         * that corner's vertex at arc step k (0 = the dropped arris itself,
         * BEVEL_SEGMENTS = fully inset, on the surface). */
        const mdx = new Array(m), mdy = new Array(m),
              gxs = new Array(m), gys = new Array(m);
        for (let c = 0; c < m; c++) {
          const i = corner[c];
          const cp = closed ? (c + m - 1) % m : Math.max(0, c - 1);
          const cn = closed ? (c + 1) % m : Math.min(m - 1, c + 1);
          const P = V[ring[i]], A = V[ring[corner[cp]]], B = V[ring[corner[cn]]];
          /* inward normals of the two edges meeting here.  The loop is wound
           * CCW seen from above (it is up-facing), so the interior lies to
           * the LEFT of each edge and (-dy, dx) points into it.  At the end
           * of an open chain there is only one edge, and the round takes its
           * normal square — it is running out onto a wall, not turning. */
          let e1 = [P[0] - A[0], P[1] - A[1]], e2 = [B[0] - P[0], B[1] - P[1]];
          if (!closed && c === 0) e1 = e2;
          if (!closed && c === m - 1) e2 = e1;
          const l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
          const n1 = [-e1[1] / l1, e1[0] / l1], n2 = [-e2[1] / l2, e2[0] / l2];
          const det = n1[0] * n2[1] - n1[1] * n2[0];
          if (Math.abs(det) < 1e-9) { mdx[c] = b * n1[0]; mdy[c] = b * n1[1]; }
          else { mdx[c] = b * (n2[1] - n1[1]) / det; mdy[c] = b * (n1[0] - n2[0]) / det; }
          /* the inset rides the plane of the region face this corner leaves
           * along, so it stays ON the playing surface however that surface
           * is sloped — flat at the back of the key, tilted on the roll,
           * steeper again down the nose. */
          const NF = ringNormal(V, nf[owner.get(ring[i]) != null
                                       ? owner.get(ring[i])
                                       : owner.get(ring[corner[cp]])]);
          gxs[c] = NF[2] !== 0 ? -NF[0] / NF[2] : 0;
          gys[c] = NF[2] !== 0 ? -NF[1] / NF[2] : 0;
          /* NOTING A HARD TURN.  The miter is b / sin(half the turn), so a
           * corner tight enough to throw the offset well past the radius is
           * one a round of that radius cannot follow: the fillet pinches on
           * a convex point and self-overlaps on a concave one.  A square
           * corner is b·sqrt2 and perfectly fine; past BEVEL_HARD_TURN it is
           * tallied rather than silently rounded as though it were gentle. */
          if (Math.hypot(mdx[c], mdy[c]) > BEVEL_HARD_TURN * b) hard++;
        }

        /* ---- THE ROUND ITSELF ----
         *
         * In (u = inward from the drafted silhouette, v = down from the top
         * plane), the drafted arris is the sharp corner at (0, 0).  A
         * round-over of radius b is the quarter circle centred on (b, b):
         *
         *     u = b(1 - cos t)      v = b(1 - sin t)      t: 0 -> pi/2
         *
         * tangent to the wall at (0, b) and to the playing surface at
         * (b, 0), so it meets both with no crease at either end.  Its
         * midpoint is (0.293b, 0.293b) — INSIDE the flat chamfer's u + v = b,
         * because a round-over takes less material off the corner than a
         * chamfer of the same setback does.  Getting that wrong is what makes
         * a "round" come out looking like a chamfer: use sin for both and
         * u + v = b for every t, which is the straight line exactly.
         */
        /* THE ENDS OF A CHAIN KEEP THEIR VERTEX AND GAIN A DROPPED TWIN.
         * The arris drops by the full radius, but the two ends stand on the
         * tongue's outline, which does not move — so the vertex itself stays
         * where the tongue's walls hold it and a copy of it, dropped, is
         * what the round starts from.  The wall between the two follows it
         * across, and the quarter-round's flat end cap closes the gap. */
        const dropOf = new Map();
        if (!closed)
          for (const i of [0, ring.length - 1]) {
            const q = ring[i];
            dropOf.set(q, addFrom(q, 0, nv[q].y, V[q][2] - b));
          }
        const chainEnds = closed ? [] : [ring[0], ring[ring.length - 1]];
        const at0 = q => (dropOf.has(q) ? dropOf.get(q) : q);

        const levels = [];               // levels[k][c] -> vertex index
        levels[0] = corner.map(i => at0(ring[i]));   // t = 0: the arris, pre-drop
        for (let k = 1; k <= BEVEL_SEGMENTS; k++) {
          const t = (k / BEVEL_SEGMENTS) * (Math.PI / 2);
          const u = 1 - Math.cos(t), drop = b * (1 - Math.sin(t));
          levels[k] = corner.map((i, c) => {
            const dx = mdx[c] * u, dy = mdy[c] * u;
            return addFrom(ring[i], dx, nv[ring[i]].y + dy,
                           V[ring[i]][2] + gxs[c] * dx + gys[c] * dy - drop);
          });
        }

        /* THE SURFACE STOPS AT THE INSET LOOP.  Every face of the region
         * gives its boundary corners up to their inset copies; a vertex flat
         * on the arris is dropped outright, because on the inset line it is
         * collinear with its neighbours and leaving it out is exact. */
        const insetOf = new Map(), endInset = new Map();
        for (let c = 0; c < m; c++) {
          const q = ring[corner[c]];
          if (chainEnds.indexOf(q) >= 0) endInset.set(q, levels[BEVEL_SEGMENTS][c]);
          else insetOf.set(q, levels[BEVEL_SEGMENTS][c]);
        }
        const onArris = new Set(ring.filter(q => chainEnds.indexOf(q) < 0));
        /* AND ONLY THE FACE THE BREAK RUNS OFF gives anything up at an end.
         * A chain end is shared with the part of the surface that is NOT
         * broken — the tongue's roof — and that face keeps its corner
         * exactly where it is, or the two would part company along the edge
         * they share. */
        const endFace = new Map();
        if (!closed) {
          endFace.set(ring[0], owner.get(ring[0]));
          endFace.set(ring[ring.length - 1], owner.get(ring[ring.length - 2]));
        }
        for (const fi of faces) {
          const r = nf[fi];
          if (!r.some(q => onArris.has(q) || endInset.has(q))) continue;
          const out = [];
          for (const q of r) {
            /* an end of the chain is still the surface's own corner — the
             * tongue is bounded by it — so the face KEEPS it and gains the
             * inset point beside it, on the side the break runs off to */
            if (endInset.has(q) && endFace.get(q) !== fi) out.push(q);
            else if (q === ring[0] && endInset.has(q)) { out.push(q, endInset.get(q)); }
            else if (q === ring[ring.length - 1] && endInset.has(q)) { out.push(endInset.get(q), q); }
            else if (insetOf.has(q)) out.push(insetOf.get(q));
            else if (!onArris.has(q)) out.push(q);
          }
          if (out.length >= 3) nf[fi] = out;
        }

        /* THE WALL AT EACH END FOLLOWS THE DROP.  Every face outside the
         * region that holds a chain end next to the first broken edge takes
         * the dropped twin in between, so the wall meets the round's cap on
         * the same edge rather than tearing away from it. */
        if (!closed) {
          const region = new Set(faces);
          const ends = [[ring[0], ring[1]], [ring[ring.length - 1], ring[ring.length - 2]]];
          for (const [q, nb] of ends) {
            const d = dropOf.get(q);
            for (let fi = 0; fi < nf.length; fi++) {
              if (region.has(fi)) continue;
              const r = nf[fi], k = r.indexOf(q);
              if (k < 0) continue;
              const nx = r[(k + 1) % r.length], pv = r[(k + r.length - 1) % r.length];
              if (nx === nb) nf[fi] = r.slice(0, k + 1).concat([d], r.slice(k + 1));
              else if (pv === nb) nf[fi] = r.slice(0, k).concat([d], r.slice(k));
            }
          }
        }

        /* t = 0 is (u 0, v b): the arris keeps its line and drops the full
         * radius, which is where the round leaves the wall tangentially.
         * A chain's ends do not drop — their twins already stand there. */
        for (let i = 0; i < ring.length; i++) {
          const q = ring[i];
          if (dropOf.has(q)) continue;
          nv[q].z -= b; V[q][2] -= b;
        }

        for (let c = 0; c < (closed ? m : m - 1); c++) {
          const d = closed ? (c + 1) % m : c + 1;
          /* level 0 -> level 1 runs the WHOLE segment of arris between two
           * corners, any vertex still standing on it included, and closes on
           * level 1's single edge.  It is fanned from level 1's corner
           * rather than from the arris, because a fan from the arris would
           * lay its first triangle along the arris itself, where collinear
           * points make it zero-area and it is dropped — and a dropped
           * triangle is a hole. */
          const path = [];
          for (let i = corner[c]; ; i = (i + 1) % ring.length) {
            path.push(at0(ring[i]));
            if (i === corner[d]) break;
          }
          for (let k = 0; k + 1 < path.length; k++)
            nf.push([path[k], path[k + 1], levels[1][c]]);
          nf.push([path[path.length - 1], levels[1][d], levels[1][c]]);

          /* every strip after that is a plain quad between two corner-only
           * rings — the round's remaining facets */
          for (let k = 1; k < BEVEL_SEGMENTS; k++)
            nf.push([levels[k][c], levels[k][d], levels[k + 1][d], levels[k + 1][c]]);
        }

        /* ---- AND THE ROUND IS CAPPED WHERE IT RUNS OUT ----
         *
         * At each end of an open chain the quarter-round stops on the plane
         * the tongue begins in.  What closes it there is the section itself:
         * the vertex, its dropped twin, and the arc between them — a flat
         * face in that plane, and the only new outline the break adds.   */
        if (!closed) {
          for (const e of [0, m - 1]) {
            const q = ring[corner[e]];
            const cap = [q, dropOf.get(q)];
            for (let k = 1; k <= BEVEL_SEGMENTS; k++) cap.push(levels[k][e]);
            /* the cap faces the way the round runs — the material it closes
             * is behind it, along the chain */
            const outw = sub(V[ring[e === 0 ? 1 : ring.length - 2]], V[q]);
            if (dot(ringNormal(V, cap), outw) < 0) cap.reverse();
            nf.push(cap);
          }
        }
      }
    }

    const v = [], f = [];
    for (const q of nv) v.push(q.a, q.b, q.y, q.z);
    for (const r of nf) { f.push(r.length); for (const i of r) f.push(i); }
    const out = { w0: p.w0, widths: p.widths, nv: nv.length, nf: nf.length,
                  v, f, derived: p.derived, bevel: b, hardTurns: hard };
    per.set(key, out);
    return out;
  }

  /** the profile for a key type in a given neighbour context */

  function profileFor(type, lb, rb) {
    let mirror = false, t = type;
    if (KP.MIRROR[t]) { mirror = true; t = KP.MIRROR[t]; }
    const table = KP.INDEX[t];
    if (!table) throw new Error('no drafted profile for key type: ' + type);
    const want = ctxKey(lb, rb);
    /* THE BEVEL IS THE LAST THING DONE TO A PROFILE.  It runs here rather
     * than in buildKey so that everything downstream — the WebGL preview,
     * the STLs, the polygon reader and the generated Blender log, which
     * writes this very table — is looking at the same broken edge, with
     * nothing to keep in step.  It adds no vertex outside the drafted
     * silhouette, so keyExtent and the size solve are untouched.      */
    const bev = p => bevelProfile(p, BEVEL);
    /* a white is never picked from the sheet any more — it is derived from
     * what actually stands beside it.  See whiteProfile above.          */
    if (t === 'Full Sized White')
      return { p: bev(whiteFlushTongue(whiteProfile(lb, rb))), mirror, exact: true };
    if (table[want] != null) return { p: bev(backReach(KP.P[table[want]])), mirror, exact: true };
    /* The sheets draw nine of the sixteen possible neighbour contexts.  For
     * one they never drew, borrow the drafted white whose context is
     * closest — occupancy first, then the nearer slot bias.               */
    let best = null, bestScore = Infinity;
    for (const k of Object.keys(table)) {
      const parts = k.split('|');
      const al = parts[0] === 'n' ? null : +parts[0];
      const bl = parts[1] === 'n' ? null : +parts[1];
      let sc = ((al === null) === (lb === null) ? 0 : 10) +
               ((bl === null) === (rb === null) ? 0 : 10);
      if (al !== null && lb !== null) sc += Math.abs(al - lb);
      if (bl !== null && rb !== null) sc += Math.abs(bl - rb);
      if (sc < bestScore) { bestScore = sc; best = table[k]; }
    }
    return { p: bev(backReach(KP.P[best])), mirror, exact: false };
  }

  /** the profile's vertex positions at width w, left edge at xLeft */
  function profilePoints(p, mirror, w, xLeft) {
    const v = p.v, n = p.nv, out = new Array(n);
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      let x = v[j] + v[j + 1] * w;
      if (mirror) x = w - x;
      out[i] = [xLeft + x, v[j + 2], v[j + 3]];
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   *  FACE TRIANGULATION — ear clipping, NOT a fan                        *
   *                                                                     *
   *  The drafted faces are n-gons and a great many of them are CONCAVE:  *
   *  the step a white key takes around its neighbouring accidentals is   *
   *  cut into the key's own top, underside and shoulder faces, so those  *
   *  polygons have reflex corners by construction.  A triangle fan from  *
   *  vertex 0 is only valid on a convex polygon; run it on these and it  *
   *  lays triangles straight across the notch, which is exactly the      *
   *  "wall connecting two corners" artefact — and on a white key it      *
   *  paves over the very clearance the key is cut back to provide, so    *
   *  the white reads as full width all the way to the spine.            *
   *                                                                     *
   *  Ear clipping in the face's own plane reproduces the drafted outline *
   *  instead.  The algorithm is deterministic and is duplicated verbatim *
   *  in the generated Blender log, so the browser, the STLs and the      *
   *  Blender build stay the same mesh.                                   *
   * ------------------------------------------------------------------ */
  const TRI_EPS = 1e-9;

  /** signed area of (a, b, c) in the projected plane */
  function tri2(a, b, c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }

  /** strictly inside — a point exactly on an edge does not block the ear */
  function inTri2(p, a, b, c) {
    return tri2(a, b, p) > TRI_EPS &&
           tri2(b, c, p) > TRI_EPS &&
           tri2(c, a, p) > TRI_EPS;
  }

  /**
   * Triangulate one face.
   *   V     3-D vertex positions
   *   ring  vertex indices, in the drafted winding
   * Returns index triples wound to match the face's own normal.
   */
  function triangulateFace(V, ring) {
    const m = ring.length, out = [];
    if (m < 3) return out;
    if (m === 3) return [[ring[0], ring[1], ring[2]]];

    /* Newell normal — robust for the near-planar drafted faces */
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < m; i++) {
      const a = V[ring[i]], b = V[ring[(i + 1) % m]];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);

    /* drop the dominant axis; the remaining pair is cyclic, so the sign of
     * the 2-D signed area is the sign of that axis' normal component */
    let pick, sign;
    if (az >= ax && az >= ay)      { pick = p => [p[0], p[1]]; sign = nz; }
    else if (ay >= ax)             { pick = p => [p[2], p[0]]; sign = ny; }
    else                           { pick = p => [p[1], p[2]]; sign = nx; }

    const P = ring.map(i => pick(V[i]));          // 2-D, indexed by ring slot
    const flip = sign < 0;                        // make the working loop CCW
    let poly = [];
    for (let i = 0; i < m; i++) poly.push(flip ? m - 1 - i : i);

    const emit = (i0, i1, i2) => out.push(flip
      ? [ring[i2], ring[i1], ring[i0]]
      : [ring[i0], ring[i1], ring[i2]]);

    let guard = 4 * m * m + 16;
    while (poly.length > 3 && guard-- > 0) {
      let clipped = false;
      for (let i = 0; i < poly.length; i++) {
        const n = poly.length;
        const i0 = poly[i], i1 = poly[(i + 1) % n], i2 = poly[(i + 2) % n];
        const a = P[i0], b = P[i1], c = P[i2];
        if (tri2(a, b, c) <= TRI_EPS) continue;   // reflex or degenerate
        let blocked = false;
        for (let j = 0; j < n; j++) {
          const q = poly[j];
          if (q === i0 || q === i1 || q === i2) continue;
          if (inTri2(P[q], a, b, c)) { blocked = true; break; }
        }
        if (blocked) continue;
        emit(i0, i1, i2);
        poly.splice((i + 1) % n, 1);
        clipped = true;
        break;
      }
      if (clipped) continue;
      /* No ear this pass — the drafted polygon is degenerate here (collinear
       * run) or self-intersecting in its own plane, which a few sheet faces
       * are.  Clip the least-bad corner anyway and EMIT it: a zero-area
       * triangle costs nothing and keeps every boundary edge paired, so the
       * key stays watertight for the slicer.                              */
      let bi = 0, bs = -Infinity;
      for (let i = 0; i < poly.length; i++) {
        const n = poly.length;
        const s = tri2(P[poly[i]], P[poly[(i + 1) % n]], P[poly[(i + 2) % n]]);
        if (s > bs) { bs = s; bi = i; }
      }
      const n = poly.length;
      emit(poly[bi], poly[(bi + 1) % n], poly[(bi + 2) % n]);
      poly.splice((bi + 1) % n, 1);
    }
    if (poly.length === 3) emit(poly[0], poly[1], poly[2]);
    else for (let i = 1; i + 1 < poly.length; i++) emit(poly[0], poly[i], poly[i + 1]);
    return out;
  }

  /* ------------------------------------------------------------------ *
   *  CUTTING A LOOP INTO A DRAFTED FACE                                 *
   *                                                                     *
   *  Kept for the seats argument, which nothing passes any more: a pair *
   *  face is a floating loop lying in the deck plane, not a weld, so    *
   *  loop, so the two share solid along that loop.  Two coplanar faces   *
   *  pressed together are exactly what a boolean union gets wrong, and   *
   *  what used to leave connectors behind as loose parts.               *
   * ------------------------------------------------------------------ */
  /** XY signed area (twice) of an index ring — sign is the winding */
  function ringArea2(V, idx) {
    let s = 0;
    for (let i = 0; i < idx.length; i++) {
      const a = V[idx[i]], b = V[idx[(i + 1) % idx.length]];
      s += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return s;
  }

  /** do ab and cd properly cross?  touching at a shared endpoint does not */
  function segCross(a, b, c, d) {
    const s1 = tri2(a, b, c), s2 = tri2(a, b, d);
    const s3 = tri2(c, d, a), s4 = tri2(c, d, b);
    return ((s1 > TRI_EPS && s2 < -TRI_EPS) || (s1 < -TRI_EPS && s2 > TRI_EPS)) &&
           ((s3 > TRI_EPS && s4 < -TRI_EPS) || (s3 < -TRI_EPS && s4 > TRI_EPS));
  }

  /** is p inside the XY polygon `poly` (array of 3-D points)? */
  function pointInPoly2(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) &&
          p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])
        inside = !inside;
    }
    return inside;
  }

  /**
   * Triangulate one face with loops cut out of it.  Each hole is folded
   * into the outer loop along the shortest cut edge that crosses nothing,
   * leaving one simple ring for the existing ear-clipper — the same fan
   * the drafted example's deck is built from.  `V` is extended in place
   * with the hole vertices, so `ring`'s indices stay valid.
   */
  function triangulateFaceWithHoles(V, ring, holes) {
    let outer = ring.slice();
    const oSign = Math.sign(ringArea2(V, outer)) || 1;
    for (const hole of holes) {
      const start = V.length;
      const hi = hole.map((q, i) => { V.push([q[0], q[1], q[2]]); return start + i; });
      if (Math.sign(ringArea2(V, hi)) === oSign) hi.reverse();   // holes run against
      const edges = [];
      const addEdges = idx => {
        for (let i = 0; i < idx.length; i++)
          edges.push([idx[i], idx[(i + 1) % idx.length]]);
      };
      addEdges(outer); addEdges(hi);
      let best = null;
      for (let i = 0; i < outer.length; i++)
        for (let j = 0; j < hi.length; j++) {
          const a = V[outer[i]], b = V[hi[j]];
          const d = (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]);
          if (best && d >= best.d) continue;
          let blocked = false;
          for (const e of edges) {
            if (e[0] === outer[i] || e[1] === outer[i] ||
                e[0] === hi[j] || e[1] === hi[j]) continue;
            if (segCross(a, b, V[e[0]], V[e[1]])) { blocked = true; break; }
          }
          if (!blocked) best = { i, j, d };
        }
      if (!best) best = { i: 0, j: 0 };
      const merged = outer.slice(0, best.i + 1);
      for (let k = 0; k <= hi.length; k++) merged.push(hi[(best.j + k) % hi.length]);
      merged.push(outer[best.i]);
      outer = merged.concat(outer.slice(best.i + 1));
    }
    return triangulateFace(V, outer);
  }

  /** is this face the down-facing deck plane one seat's loop lies in? */
  function faceHoldsSeat(P, seat) {
    let z0 = Infinity, z1 = -Infinity;
    for (const p of P) { if (p[2] < z0) z0 = p[2]; if (p[2] > z1) z1 = p[2]; }
    if (z1 - z0 > 1e-4 || Math.abs(z0 - seat.z) > 1e-4) return false;
    for (const q of seat.ring) if (!pointInPoly2(q, P)) return false;
    return true;
  }

  /**
   * One key, as a triangle soup.
   *   cx     centre x            w   width (from the size law)
   *   type   key type name
   *   lb/rb  bias of the occupied slot to the left / right, or null
   *   seats  kept for callers that still pass it; the pair face is a
   *          floating loop now, so nothing is cut into the deck
   *   armAt  what the sensor press offers this key (see pressArms), so
   *          the key's own arms can slide along their bars to meet it —
   *          see THE KEY'S OWN ARMS.  Null leaves the boss as drafted.
   */
  /* ------------------------------------------------------------------ *
   *  T-JUNCTIONS                                                        *
   *                                                                     *
   *  A drafted key does not always meet itself vertex to vertex.  On the *
   *  sheet, a belly runs the full width of the key as ONE edge while the *
   *  three faces below it break the same line at two points — the face   *
   *  is right, the neighbours are right, and there is no gap you could   *
   *  measure — but the long edge is used once and the short ones are     *
   *  used once each, so nothing pairs.  That is a T-junction, and to a   *
   *  slicer it is a hole: it draws the model red, calls it not           *
   *  watertight, and where a wall should have carried on it stitches a   *
   *  guess instead.                                                      *
   *                                                                     *
   *  IT IS FIXED BY SPLITTING, NOT BY MOVING.  The long edge is cut at   *
   *  the points its neighbours already break it at and the triangle it   *
   *  belonged to is fanned from the corner opposite, so every edge in    *
   *  the key ends up used exactly twice.  Not one vertex moves and not   *
   *  one face changes shape — the surface is the drafted surface, said   *
   *  in a way that closes.                                              *
   *                                                                     *
   *  Only the OPEN edges are looked at, and only vertices that already   *
   *  sit on one are candidates to split them, so a key that meets itself *
   *  properly costs one pass over its own triangles and nothing else.   *
   * ------------------------------------------------------------------ */
  const WELD_TOL = 1e-5;

  /** undirected edges used exactly once, as "vi|vj" over a rounded index */
  function openEdgeSet(t, key) {
    const n = new Map();
    for (let i = 0; i < t.length; i += 9) {
      const v = [key(t, i), key(t, i + 3), key(t, i + 6)];
      for (let j = 0; j < 3; j++) {
        const a = v[j], b = v[(j + 1) % 3];
        if (a === b) continue;
        const u = a < b ? a + '|' + b : b + '|' + a;
        n.set(u, (n.get(u) || 0) + 1);
      }
    }
    const out = new Set();
    for (const [u, c] of n) if (c === 1) out.add(u);
    return out;
  }

  /**
   * A deterministic 32-bit digest of a triangle soup, quantised to a
   * nanometre.  The Blender log carries one of these per object and
   * recomputes it as it builds, so the two builders cannot drift apart
   * without saying so — see PARITY in pythonLog.
   */
  function meshChecksum(tris) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < tris.length; i++)
      h = (Math.imul(h, 31) + Math.round(tris[i] * 1e6)) >>> 0;
    return h;
  }

  function weldTJunctions(t) {
    const K = v => Math.round(v / WELD_TOL);
    const key = (a, i) => K(a[i]) + ',' + K(a[i + 1]) + ',' + K(a[i + 2]);
    for (let pass = 0; pass < 6; pass++) {
      const open = openEdgeSet(t, key);
      if (!open.size) break;
      /* the only points that can split an open edge are points already
       * standing on one — the far side of the same T */
      const cand = new Map();
      for (let i = 0; i < t.length; i += 9)
        for (let j = 0; j < 3; j++) {
          const k = key(t, i + j * 3);
          if (!cand.has(k)) cand.set(k, [t[i + j*3], t[i + j*3 + 1], t[i + j*3 + 2]]);
        }
      const onOpen = new Set();
      for (const u of open) { const p = u.split('|'); onOpen.add(p[0]); onOpen.add(p[1]); }
      const pts = [];
      for (const k of onOpen) if (cand.has(k)) pts.push({ k, p: cand.get(k) });

      const out = [];
      let changed = false;
      for (let i = 0; i < t.length; i += 9) {
        const V = [[t[i], t[i+1], t[i+2]], [t[i+3], t[i+4], t[i+5]],
                   [t[i+6], t[i+7], t[i+8]]];
        const KK = [key(t, i), key(t, i + 3), key(t, i + 6)];
        let best = null;
        for (let e = 0; e < 3; e++) {
          const a = V[e], b = V[(e + 1) % 3];
          const ka = KK[e], kb = KK[(e + 1) % 3];
          const u = ka < kb ? ka + '|' + kb : kb + '|' + ka;
          if (!open.has(u)) continue;
          const dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2];
          const L2 = dx*dx + dy*dy + dz*dz;
          if (L2 < WELD_TOL * WELD_TOL) continue;
          const hit = [];
          for (const q of pts) {
            if (q.k === ka || q.k === kb) continue;
            const px = q.p[0]-a[0], py = q.p[1]-a[1], pz = q.p[2]-a[2];
            const s = (px*dx + py*dy + pz*dz) / L2;
            if (!(s > 1e-9 && s < 1 - 1e-9)) continue;
            const ex = px - s*dx, ey = py - s*dy, ez = pz - s*dz;
            if (ex*ex + ey*ey + ez*ez > WELD_TOL * WELD_TOL) continue;
            hit.push({ s, p: q.p });
          }
          if (hit.length && (!best || hit.length > best.hit.length))
            best = { e, hit };
        }
        if (!best) { for (let j = 0; j < 9; j++) out.push(t[i + j]); continue; }
        changed = true;
        /* fan from the corner OPPOSITE the edge being split: every piece
         * keeps the parent's winding and none of them is degenerate */
        best.hit.sort((x, y) => x.s - y.s);
        const a = V[best.e], b = V[(best.e + 1) % 3], c = V[(best.e + 2) % 3];
        const chain = [a].concat(best.hit.map(h => h.p), [b]);
        for (let j = 0; j < chain.length - 1; j++)
          out.push(chain[j][0], chain[j][1], chain[j][2],
                   chain[j+1][0], chain[j+1][1], chain[j+1][2],
                   c[0], c[1], c[2]);
      }
      t = out;
      if (!changed) break;
    }
    return t;
  }

  /* ==================================================================== *
   *  A TONGUE THAT READS NO SPINE IS NOT A TONGUE                        *
   *                                                                      *
   *  A key hangs off the spine half its own colour's band is on, and the *
   *  two halves are 1.29 mm apart with nothing bridging them.  A key      *
   *  standing over the seam still gets its full drafted tongue, so the    *
   *  part of it past its own half's end hangs in that air — and then over *
   *  the OTHER half, whose band is a different piece it must never touch. *
   *  The same is true at the two outer ends of the instrument.            *
   *                                                                      *
   *  So the tongue is cut off flush at its half's edge.  Every key type   *
   *  draws it as the same thing — an axis-aligned box behind the key's    *
   *  back face, y 0 .. BACK_Y, over the colour's own TONGUE_Z band, and   *
   *  the ONLY thing any key has behind that face — so the cut is exact:   *
   *  the box is rebuilt over the span that is left, and the back face is  *
   *  closed across the span the tongue no longer passes through.          *
   * ==================================================================== */
  /**
   * Clip a key's tongue to `span` ({x0, x1}) in x.  `t` is the key's
   * triangle soup; returns it with the overhang gone, still closed.
   */
  function clipTongueX(t, span) {
    if (!span) return t;
    const EPS = 1e-4;
    /* the tongue is everything BEHIND the back face; its own section is
     * read off the y = 0 end, which is the one place nothing else reaches */
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, any = false;
    const keep = [];
    for (let i = 0; i < t.length; i += 9) {
      let behind = false;
      for (let k = 0; k < 3; k++) if (t[i + k * 3 + 1] < BACK_Y - EPS) behind = true;
      if (!behind) { for (let j = 0; j < 9; j++) keep.push(t[i + j]); continue; }
      any = true;
      for (let k = 0; k < 3; k++) {
        if (t[i + k * 3 + 1] > EPS) continue;         // the y = 0 end only
        const x = t[i + k * 3], z = t[i + k * 3 + 2];
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
    }
    if (!any || !(x1 - x0 > EPS) || !(z1 - z0 > EPS)) return t;
    const a = Math.max(x0, span.x0), b = Math.min(x1, span.x1);
    if (a - x0 < EPS && x1 - b < EPS) return t;        // nothing overhangs
    const T = BACK_Y;
    /* the tongue, rebuilt over what is left — an OPEN prism, because the
     * back face it grows out of is still the key's own */
    if (b - a > EPS) {
      pushQuad(keep, [b, 0, z1], [a, 0, z1], [a, 0, z0], [b, 0, z0]);   // y = 0 cap
      pushQuad(keep, [b, 0, z0], [a, 0, z0], [a, T, z0], [b, T, z0]);   // floor
      pushQuad(keep, [a, 0, z1], [b, 0, z1], [b, T, z1], [a, T, z1]);   // roof
      pushQuad(keep, [b, T, z1], [b, 0, z1], [b, 0, z0], [b, T, z0]);   // +x wall
      pushQuad(keep, [a, 0, z0], [a, 0, z1], [a, T, z1], [a, T, z0]);   // -x wall
    }
    /* and the back face closes over every millimetre the tongue used to
     * pass through and no longer does — which is the whole of it when the
     * key reaches no spine at all */
    const patch = (p, q) => {
      if (q - p > EPS)
        pushQuad(keep, [q, T, z1], [p, T, z1], [p, T, z0], [q, T, z0]);
    };
    if (b - a > EPS) { patch(x0, a); patch(b, x1); } else patch(x0, x1);
    return keep;
  }

  function buildKey(cx, w, type, lb, rb, seats, armAt, laps, span) {
    const q = profileFor(type, lb, rb);
    const V = profilePoints(q.p, q.mirror, w, cx - w / 2);
    if (armAt != null) {
      const A = armLines(q.p);
      const P = armPlace(V, A, armAt);
      if (P) {
        for (const i of A.a) V[i][0] = P[0];
        for (const i of A.b) V[i][0] = P[1];
      }
    }
    const f = q.p.f, t = [];
    /* DEGENERATE TRIANGLES ARE DROPPED, NOT EMITTED.  A drafted face can
     * collapse to a line once a profile is rectified — the plain white's
     * step wall does exactly that, because a rectangle has no step — and a
     * zero-area triangle is not a surface: it contributes a directed edge
     * twice and breaks the watertight test that a printable part has to
     * pass.  Dropping it leaves the two faces that met at the wall meeting
     * each other, which is what a rectified key actually is.            */
    const emit = tris => {
      for (const tri of tris) {
        const a = V[tri[0]], b = V[tri[1]], c = V[tri[2]];
        const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
        const vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
        const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
        if (nx*nx + ny*ny + nz*nz < 1e-18) continue;      // zero area
        t.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      }
    };
    /* index the faces so a seat can claim a whole coplanar REGION of them —
     * a belly is a dozen fragments, and the loop is cut into the merged
     * outline, never into whichever fragment it happens to start in */
    const faces = [];
    for (let k = 0; k < f.length;) {
      const m = f[k++];
      const ring = f.slice(k, k + m); k += m;
      if (q.mirror) ring.reverse();          // mirroring flips face winding
      faces.push(ring);
    }
    /* a key's two bars land on the SAME belly, so the seats are grouped by
     * their plane and cut in together — one merge, one triangulation, both
     * loops as holes */
    const claimed = new Set();
    const byZ = new Map();
    for (const sea of (seats || [])) {
      const kz = Math.round(sea.z * 1e4);
      (byZ.get(kz) || (byZ.set(kz, []), byZ.get(kz))).push(sea);
    }
    for (const group0 of byZ.values()) {
      const z = group0[0].z, group = [];
      for (let i = 0; i < faces.length; i++) {
        const P = faces[i].map(j => V[j]);
        let z0 = Infinity, z1 = -Infinity;
        for (const p of P) { if (p[2] < z0) z0 = p[2]; if (p[2] > z1) z1 = p[2]; }
        if (z1 - z0 > 1e-4 || Math.abs(z0 - z) > 1e-4) continue;
        if (polyArea2(P) >= 0) continue;               // down-facing only
        group.push(i);
      }
      if (!group.length) continue;
      const loops = mergeCoplanar(group.map(i => faces[i].map(j => V[j])));
      const outers = loops.filter(R => polyArea2(R) < 0);
      const holes  = loops.filter(R => polyArea2(R) >= 0);
      const fit = new Map();                           // outer loop -> its seats
      for (const sea of group0) {
        const R = outers.filter(o => sea.ring.every(p => pointInPoly2(p, o)))
                        .sort((a, b) => polyArea2(a) - polyArea2(b))[0];
        if (R) (fit.get(R) || (fit.set(R, []), fit.get(R))).push(sea);
      }
      if (!fit.size) continue;                         // seats hang off the belly
      for (const i of group) claimed.add(i);
      const lift = R => R.map(pt => [pt[0], pt[1], z]);
      for (const R of outers) {
        const idx = lift(R).map(pt => (V.push(pt), V.length - 1));
        const cut = (fit.get(R) || []).map(sea => sea.ring);
        const own = holes.filter(h => h.every(p => pointInPoly2(p, R))).map(lift);
        emit(triangulateFaceWithHoles(V, idx, own.concat(cut)));
      }
    }
    for (let i = 0; i < faces.length; i++)
      if (!claimed.has(i)) emit(triangulateFace(V, faces[i]));
    /* THE LAP INTO THE SPINE.  Part of the key, not of the band: it is the
     * key's tongue carrying on through the spine face.  See THE TONGUE
     * DOES NOT STOP AT THE SPINE FACE. */
    /* THE TONGUE IS CUT BEFORE THE LAP IS ADDED.  The lap is already the
     * half's own — tongueLaps clips it — and it lives behind the back face
     * too, so cutting after it would read it as part of the tongue. */
    const cut = clipTongueX(t, span);
    for (const L of (laps || []))
      pushBox(cut, L.x0, L.x1, L.y0, L.y1, L.z0, L.z1);
    /* and said in a way that closes — see T-JUNCTIONS above */
    return weldTJunctions(cut);
  }

  /** the same key as the drafted polygons, un-triangulated (for Blender) */
  function keyPolygons(cx, w, type, lb, rb) {
    const q = profileFor(type, lb, rb);
    const V = profilePoints(q.p, q.mirror, w, cx - w / 2);
    const f = q.p.f, out = [];
    for (let k = 0; k < f.length;) {
      const m = f[k++];
      const ring = f.slice(k, k + m); k += m;
      if (q.mirror) ring.reverse();
      out.push(ring.map(i => V[i]));
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   *  THE KEY'S BELLY IS NOT ONE FACE                                    *
   *                                                                     *
   *  A drafted key's underside comes off the sheet as a dozen coplanar   *
   *  faces meeting on shared edges — so "the deck" is a REGION, not a    *
   *  polygon, and seating a pair face on it and reading its extent      *
   *  into it have to work on the merged outline rather than on whichever *
   *  fragment happened to be biggest.                                    *
   *                                                                     *
   *  Merging is exact and cheap here: the key is edge-manifold, so every *
   *  seam between two coplanar faces appears twice, once in each         *
   *  direction.  Cancel those and what is left is the region's own       *
   *  boundary, which chains straight into loops.                        *
   * ------------------------------------------------------------------ */
  const MERGE_Q = 1e5;

  /**
   * Merge a set of coplanar polygons into their boundary loops (XY, wound
   * as the input was).
   *
   * Cancel every edge that also appears reversed — those are the seams
   * between two fragments — and walk what is left.  The walk cannot just
   * follow "any unused edge out": a belly pinches, and a pinch vertex has
   * several edges out, so following the wrong one splices two unrelated
   * parts of the boundary into one nonsense loop.  At each vertex it
   * therefore takes the next edge CLOCKWISE from the one it arrived on,
   * which is the standard planar-subdivision face walk and separates the
   * loops correctly at every pinch.
   */
  function mergeCoplanar(polys) {
    const key = p => Math.round(p[0] * MERGE_Q) + ',' + Math.round(p[1] * MERGE_Q);
    const pos = new Map(), cnt = new Map();
    for (const P of polys)
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        const ka = key(a), kb = key(b);
        if (ka === kb) continue;
        pos.set(ka, a); pos.set(kb, b);
        const e = ka + '>' + kb;
        cnt.set(e, (cnt.get(e) || 0) + 1);
      }
    /* surviving directed edges, grouped by tail, each with its heading */
    const out = new Map();
    for (const [e, c] of cnt) {
      const i = e.indexOf('>'), a = e.slice(0, i), b = e.slice(i + 1);
      const n = c - (cnt.get(b + '>' + a) || 0);          // seams cancel
      if (n <= 0) continue;
      const pa = pos.get(a), pb = pos.get(b);
      const l = out.get(a) || (out.set(a, []), out.get(a));
      for (let k = 0; k < n; k++)
        l.push({ to: b, ang: Math.atan2(pb[1] - pa[1], pb[0] - pa[0]), used: false });
    }
    const TAU = Math.PI * 2;
    const loops = [];
    for (const [start, list] of out)
      for (const first of list) {
        if (first.used) continue;
        first.used = true;
        const loop = [start];
        let from = start, edge = first, guard = 0;
        while (guard++ < 8192) {
          loop.push(edge.to);
          if (edge.to === start) break;
          const cands = out.get(edge.to);
          if (!cands) break;
          const back = edge.ang + Math.PI;
          let pick = null, bestA = Infinity;
          for (const c of cands) {
            if (c.used) continue;
            let d = (back - c.ang) % TAU;               // clockwise from the
            if (d <= 1e-9) d += TAU;                    // edge we came in on
            if (d < bestA) { bestA = d; pick = c; }
          }
          if (!pick) break;
          pick.used = true;
          from = edge.to; edge = pick;
        }
        if (loop.length >= 4 && loop[loop.length - 1] === start)
          loops.push(loop.slice(0, -1).map(k => pos.get(k)));
      }
    return loops;
  }

  /** XY signed area (twice) of a point ring */
  function polyArea2(R) {
    let s = 0;
    for (let i = 0; i < R.length; i++) {
      const a = R[i], b = R[(i + 1) % R.length];
      s += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return s;
  }

  /**
   * The key's down-facing planar regions, merged, lowest first.  The
   * lowest one is the belly a pair face lies in; `loops` are its
   * merged boundaries, `polys` the drafted fragments they replace.
   */
  function keyDecks(cx, w, type, lb, rb) {
    const groups = new Map();
    for (const P of keyPolygons(cx, w, type, lb, rb)) {
      let z0 = Infinity, z1 = -Infinity;
      for (const p of P) { if (p[2] < z0) z0 = p[2]; if (p[2] > z1) z1 = p[2]; }
      if (z1 - z0 > 1e-4) continue;
      if (polyArea2(P) >= 0) continue;                    // down-facing only
      const kz = Math.round(z0 * 1e4);
      const g = groups.get(kz) || (groups.set(kz, { z: z0, polys: [] }), groups.get(kz));
      g.polys.push(P);
    }
    const out = [];
    for (const g of groups.values())
      out.push({ z: g.z, polys: g.polys, loops: mergeCoplanar(g.polys) });
    out.sort((a, b) => a.z - b.z);
    return out;
  }

  /** the key's true extent, straight off the profile */
  function keyExtent(cx, w, type, lb, rb) {
    const q = profileFor(type, lb, rb);
    const V = profilePoints(q.p, q.mirror, w, cx - w / 2);
    const r = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
    for (const p of V) {
      r[0] = Math.min(r[0], p[0]); r[1] = Math.max(r[1], p[0]);
      r[2] = Math.min(r[2], p[1]); r[3] = Math.max(r[3], p[1]);
      r[4] = Math.min(r[4], p[2]); r[5] = Math.max(r[5], p[2]);
    }
    return { x0: r[0], x1: r[1], y0: r[2], y1: r[3], z0: r[4], z1: r[5] };
  }

  /* ==================================================================== *
   *  SPINE + FEET GEOMETRY                                               *
   * ==================================================================== */
  function rectWithHoles(x0, x1, y0, y1, holes, emit) {
    if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4) return;
    let h = null;
    for (const c of holes) {
      const a = Math.max(x0, c.x0), b = Math.min(x1, c.x1);
      const p = Math.max(y0, c.y0), q = Math.min(y1, c.y1);
      if (b - a > 1e-4 && q - p > 1e-4) { h = { x0: a, x1: b, y0: p, y1: q }; break; }
    }
    if (!h) { emit(x0, x1, y0, y1); return; }
    rectWithHoles(x0, h.x0, y0, y1, holes, emit);
    rectWithHoles(h.x1, x1, y0, y1, holes, emit);
    rectWithHoles(h.x0, h.x1, y0, h.y0, holes, emit);
    rectWithHoles(h.x0, h.x1, h.y1, y1, holes, emit);
  }

  /* ------------------------------------------------------------------ *
   *  THE MOUNTING HOLES ARE OBROUNDS                                    *
   *                                                                     *
   *  A 32-segment circle split at +/-90 deg, the halves held `straight`  *
   *  apart along x and closed with tangent lines: 34 points, CCW.  The   *
   *  sandbox draws exactly this, to 0.0001 mm.                          *
   * ------------------------------------------------------------------ */
  /**
   * The unit obround: [halfSign, cos, sin] per point, CCW, computed once so
   * that the Python log can carry these doubles verbatim and Blender never
   * has to re-run a trig function the browser already ran.
   *   point = [cx + halfSign * straight / 2 + r * cos, cy + r * sin]
   */
  const HOLE_UNIT = (function (n) {
    const q = n / 4, out = [];
    for (let k = -q; k <= q; k++) {          // right half, -90 .. +90
      const a = 2 * Math.PI * k / n;
      out.push([+1, Math.cos(a), Math.sin(a)]);
    }
    for (let k = q; k <= 3 * q; k++) {       // left half, +90 .. +270
      const a = 2 * Math.PI * k / n;
      out.push([-1, Math.cos(a), Math.sin(a)]);
    }
    return out;
  })(SPINE.hole.seg);

  function obroundRing(cx, cy, r, straight, unit) {
    return (unit || HOLE_UNIT).map(u =>
      [cx + u[0] * straight / 2 + r * u[1], cy + r * u[2]]);
  }

  /**
   * The 8 mounting holes of one spine half, as rings plus their bounding
   * boxes.  `upper` picks the narrower bore that every layer above the
   * channel-carrying one is drawn with.
   */
  function spineHoles(half, upper) {
    const tbl = upper ? SPINE.holesUpper[half] : SPINE.holesLower[half];
    const r = upper ? SPINE.hole.rUpper : SPINE.hole.rLower;
    const s = SPINE.hole.straight;
    return tbl.map(([cx, cy]) => ({
      cx, cy, r, ring: obroundRing(cx, cy, r, s),
      x0: cx - s / 2 - r, x1: cx + s / 2 + r,
      y0: cy - r,         y1: cy + r
    }));
  }

  /** where a ring point lands on the hole's bounding box, on the centre ray */
  function holeBoxPoint(h, p) {
    const dx = p[0] - h.cx, dy = p[1] - h.cy;
    const sx = dx > 0 ? (h.x1 - h.cx) / dx : dx < 0 ? (h.x0 - h.cx) / dx : Infinity;
    const sy = dy > 0 ? (h.y1 - h.cy) / dy : dy < 0 ? (h.y0 - h.cy) / dy : Infinity;
    const s = Math.min(sx, sy);
    // side index, CCW: 0 = +x, 1 = +y, 2 = -x, 3 = -y
    const side = sx <= sy ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
    return { p: [h.cx + dx * s, h.cy + dy * s], side };
  }

  /**
   * Fill the gap between a hole's bounding box and its obround ring, as a
   * cap at height z.  `up` is +1 for a face that looks up, -1 for one that
   * looks down.  This is what turns the rectangular decomposition below
   * into a rounded hole.
   */
  function pushHoleAnnulus(t, h, z, up) {
    const C = [[h.x1, h.y1], [h.x0, h.y1], [h.x0, h.y0], [h.x1, h.y0]];
    const tri = (a, b, c) => {
      // the ring touches its own bounding box at four points, so a few of
      // these come out with no area at all — drop them rather than ship
      // slivers into the STL
      const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(cr) < 1e-12) return;
      if (up > 0) pushTri(t, [a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z]);
      else        pushTri(t, [a[0], a[1], z], [c[0], c[1], z], [b[0], b[1], z]);
    };
    const n = h.ring.length;
    for (let i = 0; i < n; i++) {
      const a = h.ring[i], b = h.ring[(i + 1) % n];
      const pa = holeBoxPoint(h, a), pb = holeBoxPoint(h, b);
      const path = [pa.p];
      for (let s = pa.side; s !== pb.side; s = (s + 1) % 4) path.push(C[s]);
      path.push(pb.p);
      for (let j = 0; j < path.length - 1; j++) tri(a, path[j], path[j + 1]);
      tri(a, path[path.length - 1], b);
    }
  }

  /**
   * THE ANNULUS'S OWN OUTER EDGE, in the order the fan above walks it.
   *
   * The fan runs from the ring out to the hole's bounding box, so its outer
   * boundary is that box — but walked through every point a ring vertex
   * projects onto, plus the four corners, rather than as four plain sides.
   * Anything that has to MEET that boundary has to meet it at those same
   * points or it leaves a seam, so the walk is written once, here, and both
   * the wall below and the cap above take it from the same place.
   */
  function holeBoxLoop(h) {
    const C = [[h.x1, h.y1], [h.x0, h.y1], [h.x0, h.y0], [h.x1, h.y0]];
    const out = [];
    const put = (p) => {
      const q = out[out.length - 1];
      if (!q || Math.abs(q[0] - p[0]) > 1e-9 || Math.abs(q[1] - p[1]) > 1e-9)
        out.push(p);
    };
    const n = h.ring.length;
    for (let i = 0; i < n; i++) {
      const pa = holeBoxPoint(h, h.ring[i]);
      const pb = holeBoxPoint(h, h.ring[(i + 1) % n]);
      put(pa.p);
      for (let s = pa.side; s !== pb.side; s = (s + 1) % 4) put(C[s]);
      put(pb.p);
    }
    /* the walk closes on itself; drop the repeat so the wall does not build
     * a zero-width quad at the seam */
    while (out.length > 1) {
      const a = out[0], b = out[out.length - 1];
      if (Math.abs(a[0] - b[0]) > 1e-9 || Math.abs(a[1] - b[1]) > 1e-9) break;
      out.pop();
    }
    return out;
  }

  /**
   * WHAT MAKES THE WASHER A SOLID RATHER THAN TWO LOOSE LIDS.
   *
   * A slab with a hole in it is built here as rectangles around the hole's
   * bounding box plus a fan filling box-minus-ring.  The fan was a pair of
   * bare CAPS — a lid at z1 and a lid at z0 with the bore wall between
   * them — so its outer edge went nowhere: 1216 open edges per spine, all
   * of them ringing the eight mounting holes, which is exactly the ring of
   * red a slicer draws round them and the reason it calls the model not
   * watertight.  The two lids are the same loop at two heights; skinning
   * between them closes the washer, and the piece becomes a solid like
   * every other piece of the slab.
   *
   * The skin stands INSIDE the material — the rectangles around the hole
   * are right up against it — so it adds no surface a print can see.  It
   * is there so that every edge in the file belongs to a closed body,
   * which is what lets the slicer union the lot into one outline per layer
   * instead of stitching guesses.
   */
  function pushHoleOuterWall(t, h, z0, z1) {
    const loop = holeBoxLoop(h);
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      /* the ring is wound CCW seen from +z and the fan follows it, so this
       * winding puts the skin's normals outward, away from the bore */
      pushQuad(t, [a[0], a[1], z0], [b[0], b[1], z0],
                  [b[0], b[1], z1], [a[0], a[1], z1]);
    }
  }

  /** the inside wall of one hole, z0 .. z1, normals pointing into the bore */
  function pushHoleWall(t, h, z0, z1) {
    const n = h.ring.length;
    for (let i = 0; i < n; i++) {
      const a = h.ring[i], b = h.ring[(i + 1) % n];
      pushQuad(t, [a[0], a[1], z0], [a[0], a[1], z1],
                  [b[0], b[1], z1], [b[0], b[1], z0]);
    }
  }

  /**
   * One slab of spine: the rectangle x0..x1 by y0..y1, from z0 to z1, with
   * the given obround holes bored through it.  The bulk is decomposed into
   * boxes around the holes' bounding boxes (rectWithHoles), then each hole
   * gets its annulus caps and its bore wall.
   */
  /**
   * A slab.  NOT watertight on its own: rectWithHoles subdivides
   * recursively, so neighbouring sub-rectangles meet at T-junctions rather
   * than edge to edge, and the obround annulus does not close against them
   * either — 608 boundary edges per spine part.  A union of the comb closes
   * it (the black comb comes out with none), but the raw spine STL is not
   * solid on its own.  Capping each slab as one polygon-with-holes is the
   * fix and is the outstanding item here; tiling the sub-rectangle caps was
   * tried and is worse (808), because the T-junctions then show up as
   * cracks instead of as doubled walls.
   */
  function pushSpineSlab(t, x0, x1, y0, y1, z0, z1, holes) {
    /* ONLY THE BORES THIS RECTANGLE ACTUALLY CONTAINS.  A slab drawn in
     * more than one x segment — see THE RIBBON CABLE — asks for the whole
     * half's bore list each time, and a washer built for a bore that is
     * not in this rectangle is a second copy of a body already there. */
    holes = (holes || []).filter(h =>
      Math.min(x1, h.x1) - Math.max(x0, h.x0) > 1e-4 &&
      Math.min(y1, h.y1) - Math.max(y0, h.y0) > 1e-4);
    rectWithHoles(x0, x1, y0, y1, holes,
      (a, b, c, d) => pushBox(t, a, b, c, d, z0, z1));
    /* EACH HOLE'S WASHER IS A CLOSED BODY: lid, floor, the bore wall
     * between them on the inside, and the skin that shuts its outer edge.
     * Built as four faces of one solid rather than as three loose surfaces
     * — see pushHoleOuterWall for what that was costing. */
    for (const h of holes) {
      pushHoleAnnulus(t, h, z1, +1);
      pushHoleAnnulus(t, h, z0, -1);
      pushHoleWall(t, h, z0, z1);
      pushHoleOuterWall(t, h, z0, z1);
    }
  }

  // Spine band colours are pinned to COLORS.gray / .black / .white — the
  // exact same swatches the keys and the sensor presses render in, so a
  // spine band and the key/press sitting on it read as one material.
  const SPINE_LAYER_COLORS = {
    /* A ONE-TYPE SPINE CARRIES ONE COLOUR OF KEY, AND THAT COLOUR IS
     * WHITE.  spineKindForColours only ever returns 'one' when the design
     * places no gray and no black — a keyboard of plain whites — so its
     * single slab prints in the white filament with them, not in black. */
    one:   { all:   { srgb: COLORS.white, linear: [0.8900, 0.8900, 0.8481],
                      material: null } },
    two:   { lower: { srgb: COLORS.black, linear: [0.0220, 0.0220, 0.0301],
                      material: 'Material.003' },
             upper: { srgb: COLORS.white, linear: [0.8900, 0.8900, 0.8481],
                      material: null } },
    three: { gray:  { srgb: COLORS.gray,  linear: [0.2634, 0.2634, 0.2954],
                      material: 'Material.002' },
             black: { srgb: COLORS.black, linear: [0.0220, 0.0220, 0.0301],
                      material: 'Material.003' },
             white: { srgb: COLORS.white, linear: [0.8900, 0.8900, 0.8481],
                      material: null } }
  };

  /** the drafted colour of one spine layer; `space` is 'srgb' (default)
   *  or 'linear'.  Falls back to the flat spine grey if unknown.        */
  function spineLayerColor(spine, layerName, space) {
    const k = SPINE_LAYER_COLORS[spineKindOf(spine)];
    const e = k && k[layerName];
    return e ? e[space === 'linear' ? 'linear' : 'srgb'] : COLORS.spine;
  }

  /* WHICH FILAMENT A SPINE BAND PRINTS IN.  The bands are drafted as
   * layers of one spine, but a printed keyboard has no "spine part": every
   * band is printed in the colour of the keys that plug into it, and it is
   * exported fused to them.  This is that mapping, said once — the layer
   * names of the three-type spine already ARE colours, the two-type spine
   * calls them lower/upper, and the one-type spine's single slab carries
   * the white keys (see SPINE_LAYER_COLORS above).                      */
  const SPINE_LAYER_PART = {
    one:   { all: 'white' },
    two:   { lower: 'black', upper: 'white' },
    three: { gray: 'gray', black: 'black', white: 'white' }
  };

  /** the key colour one spine layer prints in: 'white' | 'black' | 'gray' */
  function spineLayerPart(spine, layerName) {
    const k = SPINE_LAYER_PART[spineKindOf(spine)];
    return (k && k[layerName]) || 'white';
  }

  /** the material the drafting sandbox gives that layer, or null */
  function spineLayerMaterial(spine, layerName) {
    const k = SPINE_LAYER_COLORS[spineKindOf(spine)];
    return k && k[layerName] ? k[layerName].material : null;
  }

  /** the drafted spine for a set (or array) of key colours */
  function spineKindForColours(used) {
    const s = (used instanceof Set) ? used : new Set(used || []);
    if (s.has('gray')) return 'three';
    if (s.has('black')) return 'two';
    return 'one';
  }

  /** how many layers that spine is drawn in */
  const spineLayerCount = kind => SPINE.layers[kind].A.length;

  /** accepts a kind ('one'/'two'/'three') or a plain layer count */
  const spineKindOf = n => (typeof n === 'string')
    ? n
    : (SPINE_KIND_BY_LAYERS[n] || (n >= 3 ? 'three' : n === 2 ? 'two' : 'one'));

  /** the x span of one spine half, by name — what a tongue on it may reach */
  function spineHalfSpan(hn) {
    for (const [n, h] of spineHalves()) if (n === hn) return { x0: h.x0, x1: h.x1 };
    return null;
  }

  /** the halves of the one and only spine, in build order */
  const spineHalves = () => [['A', SPINE.halfA], ['B', SPINE.halfB]];

  /**
   * The one and only spine, as one part per (half, layer) — the same
   * decomposition the drafting sandbox uses, so each generated part has a
   * one-to-one counterpart in "<kind> type Spine - A / - B".
   * `spine` is a kind name or a layer count.
   */
  /**
   * The drafted bands, pushed apart so that no two of them share solid.
   * Half A drafts black 5.09072..6.10034 and white 6.07824..7.10034 — they
   * genuinely overlap.  Each band above the first is lifted to clear the one
   * below it by FIT.gap; the band below keeps its drafted top, so the datum
   * a key's tongue reads against does not move.
   */
  function spineBands(kind, hn) {
    const src = SPINE.layers[kind][hn];
    const out = [];
    let prevTop = -Infinity;
    for (const L of src) {
      /* THE WHITE BAND IS TALLER THAN IT WAS DRAFTED.  Its top face — and
       * only its top face — is lifted WHITE_RISE, which puts it level with
       * the white keys' playing surface and lets their tongues carry the
       * full section up to it.  See THE WHITE'S TOP RUNS STRAIGHT INTO ITS
       * TONGUE.  The rise goes onto the DRAFTED top as well, because that
       * is what the boss and the lap are clipped to. */
      const rise = spineLayerPart(kind, L.name) === 'white' ? WHITE_RISE : 0;
      const top = L.z1 + rise;
      const z0 = Math.max(L.z0, prevTop + FIT.gap);
      const z1 = Math.max(top, z0 + 0.2);
      out.push({ name: L.name, z0, z1, z0Drafted: L.z0, z1Drafted: top });
      prevTop = z1;
    }
    return out;
  }

  /* ==================================================================== *
   *  THE RIBBON CABLE COMES OUT OF THE BACK OF HALF A                    *
   *                                                                      *
   *  The AKM320's PCB runs down the channel in the bottom band, and its  *
   *  ribbon has to leave the instrument somewhere.  The channel's back    *
   *  wall is 1.40005 mm of solid and every band above it is solid to the  *
   *  back edge, so as drafted there is nowhere for it to go.              *
   *                                                                      *
   *  So one rectangle is taken out of half A's BACK EDGE — the full       *
   *  height of the stack, so the notch reads the same in every band and   *
   *  every colour of filament, and RIBBON.depth deep, which is more than  *
   *  the channel's back wall: the channel opens straight out of the back  *
   *  over that span rather than into a blind pocket.                      *
   *                                                                      *
   *  HALF A ONLY.  Half B's back edge is untouched — one exit, on the     *
   *  side the cable is on.                                               *
   *                                                                      *
   *  WHERE IT IS.  The right edge sits on sensor 6's centreline and it    *
   *  runs one ribbon back from there: 25.4 mm, a 20-way 0.05 in cable.    *
   *  That lands it in the longest hole-free stretch half A has — its      *
   *  mounting bores are at x 31.13 and 71.16, and the notch clears both.  *
   * ==================================================================== */
  const RIBBON = { half: 'A', x0: 42.4, x1: 67.8, depth: 1.8 };

  /**
   * The x segments a half's slab is drawn in, and the back edge each one
   * stands on: three where the ribbon notch bites into it, one otherwise.
   */
  function backSegments(hn, half) {
    const whole = [{ x0: half.x0, x1: half.x1, yBack: half.yBack }];
    if (hn !== RIBBON.half) return whole;
    const a = Math.max(half.x0, RIBBON.x0), b = Math.min(half.x1, RIBBON.x1);
    if (b - a <= 1e-4) return whole;
    const out = [];
    if (a - half.x0 > 1e-4) out.push({ x0: half.x0, x1: a, yBack: half.yBack });
    out.push({ x0: a, x1: b, yBack: half.yBack + RIBBON.depth });
    if (half.x1 - b > 1e-4) out.push({ x0: b, x1: half.x1, yBack: half.yBack });
    return out;
  }

  /**
   * One spine.  `keySpans` is optional: [{ layer, x0, x1 }] for every key in
   * the design.  Given it, each band grows a FIT.engage boss forward over
   * the x span of the keys that share its colour, so key and band become one
   * solid when the comb is unioned.  Bands of other colours stay at y = 0
   * and so keep clear of those keys.
   */
  function spineParts(spine, keySpans) {
    const kind = spineKindOf(spine);
    const zc = SPINE.channel.zTop;
    const parts = [];
    for (const [hn, half] of spineHalves()) {
      const ch = SPINE.channel[hn];
      const layers = spineBands(kind, hn);
      /* THE BAND'S FRONT FACE IS THE DRAFTED ONE — y = 0, where every key
       * back stands.  It used to be recessed by FIT.gap to keep a key of
       * another colour off a coplanar face, but the whole comb is affixed
       * and unified when it is printed, so the recess bought nothing and
       * left a 0.15 mm slot behind every key that did not share the band's
       * colour.  Flush here; the boss still reaches FIT.engage past it into
       * the keys that do share the colour, so those overlap rather than
       * merely touch. */
      const yF = half.yFront;
      layers.forEach((L, i) => {
        const tris = [];
        /* every band steps back the same way, so the ribbon notch reads
         * as one rectangle through the whole stack — see THE RIBBON CABLE */
        const segs = backSegments(hn, half);
        if (i === 0) {
          /* The bottom layer carries the PCB channel.  Below the ceiling it
           * is two strips, front and back; above it, the full section with
           * the wide bore.  The channel runs out through both x ends — and
           * out of the BACK too, where the notch has taken the back strip
           * away entirely.                                               */
          for (const g of segs) {
            if (ch.y0 - g.yBack > 1e-4)
              pushBox(tris, g.x0, g.x1, g.yBack, ch.y0, L.z0, zc);
            pushSpineSlab(tris, g.x0, g.x1, g.yBack, yF,
                          zc, L.z1, spineHoles(hn, false));
          }
          pushBox(tris, half.x0, half.x1, ch.y1, yF, L.z0, zc);
        } else {
          for (const g of segs)
            pushSpineSlab(tris, g.x0, g.x1, g.yBack, yF,
                          L.z0, L.z1, spineHoles(hn, true));
        }
        /* the boss: FIT.engage of this band, carried forward into every key
         * of its own colour that stands on this half — and the gusset that
         * turns that meeting from a butt into a joint.  See THE TONGUE
         * ROOT IS THE WHOLE JOINT.
         *
         * Both are taken over the TONGUE's own z, which is the drafted
         * band clipped to the tongue rather than the separated band: the
         * FIT.gap that holds this band off the one below it is a rule
         * about the bands, which share the y < 0 side, and the boss and
         * the gusset are in front of that plane where no other colour
         * reaches.  Clipping them to the pushed band cost 0.15 mm off a
         * joint only 1 mm tall.  Bossing the band's FULL height would run
         * into the key of the colour stacked next to it, which is the
         * whole reason the tongues are banded in the first place. */
        /* MATCHED BY FILAMENT, NOT BY THE BAND'S DRAFTED NAME.  A key's
         * `layer` is its colour; a band is called after the sheet it came
         * off, which on a one- or two-colour spine is 'all' / 'lower' /
         * 'upper'.  Comparing the two directly meant those spines never
         * matched a single key and got NO boss at all — every key on them
         * met the spine as a bare coplanar face. */
        const part = spineLayerPart(kind, L.name);
        if (keySpans) for (const k of keySpans) {
          if (k.layer !== part) continue;
          /* AND ON THE HALF THE KEY IS ACTUALLY ON.  A key over the seam is
           * drafted wider than its own half, and asking every half whether
           * that span reaches it put a boss on the half the key does NOT
           * belong to — a tab standing off the far side of the gap with no
           * tongue over it, which is exactly what the tongue clip took
           * away.  See A TONGUE THAT READS NO SPINE IS NOT A TONGUE. */
          if (k.half && k.half !== hn) continue;
          const a = Math.max(k.x0, half.x0), b = Math.min(k.x1, half.x1);
          if (b - a <= 1e-4) continue;
          const T = TONGUE_Z[part] || [L.z0Drafted, L.z1Drafted];
          const z0 = Math.max(L.z0Drafted, T[0]), z1 = Math.min(L.z1Drafted, T[1]);
          if (z1 - z0 <= 1e-4) continue;
          pushBox(tris, a, b, yF, half.yFront + FIT.engage, z0, z1);
        }
        /* THE 1.29 mm BETWEEN THE HALVES IS LEFT OPEN.  Half A ends at
         * 183.43233 and half B begins at 184.72359, and that gap is drafted,
         * not incidental: it is the clearance the two AKM320 halves want.
         * Nothing bridges it, so half A stops square at its own x1. */
        parts.push({
          name: 'Spine_' + hn + '_' + L.name, half: hn, layer: L.name,
          x0: half.x0, x1: half.x1, yBack: half.yBack, yFront: half.yFront,
          z0: L.z0, z1: L.z1, tris
        });
      });
    }
    return parts;
  }

  /** the spine's design-frame z extent for a given kind or layer count */
  function spineZRange(spine) {
    const kind = spineKindOf(spine);
    let z0 = Infinity, z1 = -Infinity;
    for (const [hn] of spineHalves()) {
      /* through spineBands, so the white band's rise is in the extent */
      const ls = spineBands(kind, hn);
      z0 = Math.min(z0, ls[0].z0);
      z1 = Math.max(z1, ls[ls.length - 1].z1);
    }
    return [z0, z1];
  }

  /** Build the one and only spine: half A + half B, for a kind or count */
  function buildSpine(spine, keySpans) {
    const out = {};
    for (const p of spineParts(spine)) out[p.name] = p.tris;
    return out;
  }

  /** X centres of the 32 feet — 16 on half A, 16 on half B. Always 32. */
  function footCentres() {
    const out = [];
    let x = FOOT.x0;
    out.push(x);
    for (let i = 0; i < FEET_PER_HALF - 1; i++) { x += FOOT.stepsA[i]; out.push(x); }
    x += FOOT.gapAB; out.push(x);
    for (let i = 0; i < FEET_PER_HALF - 1; i++) { x += FOOT.stepsB; out.push(x); }
    return out;
  }

  /* ------------------------------------------------------------------ *
   *  THE FOOT IS NOT AN OBJECT.  IT IS THE BOTTOM OF THE PRESS.         *
   *                                                                     *
   *  There used to be a part per sensor foot: the drafted pad face and   *
   *  the key's pairing face, both zero-thickness loops, floating with    *
   *  nothing between them.  They are gone.  A face with no volume is     *
   *  not a thing a printer can make, so no STL ever carried one, and     *
   *  emitting them left the Blender scene holding 32 objects the         *
   *  exports did not have — the two renderings were not of the same      *
   *  instrument.  The preview had already stopped drawing them, because  *
   *  every pad face is coincident with the bottom cap of its own press   *
   *  and the two z-fought.                                              *
   *                                                                     *
   *  The two loops themselves are very much alive; they are just not     *
   *  parts any more.  pairFaces still returns them and buildPress still  *
   *  builds the solid BETWEEN them, so                                   *
   *                                                                     *
   *    PAD FACE    the drafted "-| |-" exactly as "Feet - A" / "Feet -   *
   *                B" draw it, flat at z = FOOT.z — the face the sensor  *
   *                sees — is now the press's bottom cap, and             *
   *    PAIR FACE   the SAME 16 vertices, same order, same winding, in    *
   *                the plane of the key's own underside deck, is its     *
   *                top.                                                 *
   *                                                                     *
   *  Nothing about either loop moved.  See PAIR FACE / seatTransform     *
   *  below for how the second one is fitted to the key's belly.          *
   * ------------------------------------------------------------------ */


  /* ==================================================================== *
   *  FOOT LOOP PAIRS  —  sensor foot "-| |-"  ->  the SAME "-| |-"        *
   *                      lying in the key's underside deck                *
   *                                                                      *
   *  KEYS[i] belongs to FEET[i], but the two are not over one another: a  *
   *  split pair shares one x and still has to reach two feet 11.3 mm      *
   *  apart.  The loop pair STATES that relationship; it does not close    *
   *  it.  Nothing is built between the two loops.                        *
   *                                                                      *
   *    PAD FACE    the drafted ring itself, flat at the sensor pad — the  *
   *                shape "Feet - A" / "Feet - B" actually draw, vertex    *
   *                for vertex, so the face that presses the sensor is     *
   *                the drafted one.                                      *
   *    PAIR FACE   the same 8 vertices in the same order and winding,     *
   *                lying in the key's own underside deck plane.          *
   *                                                                      *
   *  Both are FLOATING FACES: no thickness, no walls, no caps, no band    *
   *  between them and no weld into the key.  The 1 mm stem and the 2 mm   *
   *  dome window survive the move, because both loops are the drafted     *
   *  shape rather than a bounding box of it.                             *
   *                                                                      *
   *  WHAT THE PAIR FACE IS ALLOWED TO DO.  Its stems reach PAIR.stem      *
   *  past the drafted pad first; the seat then fits it to the key's own   *
   *  belly, shrinking only in x and snapping to the deck edge in y.  So   *
   *  a stem with nowhere to go is SHORTENED at that end alone, and the    *
   *  shape is never re-centred or scaled.  See stemExtend and seatAxis.   *
   * ==================================================================== */
  /* ==================================================================== *
   *  PRINT FIT                                                           *
   *                                                                      *
   *  The instrument comes off the bed as THREE objects — one per filament *
   *  colour — and each one has to be a single closed solid.  Two rules    *
   *  follow, and both are enforced here rather than left to the slicer:   *
   *                                                                      *
   *    CONNECT   a key must genuinely overlap the spine band of its OWN   *
   *              colour, not merely touch it.  The drafted key backs and  *
   *              the spine front face are both at y = 0, so a union of    *
   *              coplanar faces is exactly the case a boolean solver gets *
   *              wrong.  Each band therefore grows a BOSS of FIT.engage   *
   *              forward, over the x span of every key of its colour.     *
   *                                                                      *
   *              THE BANDS THEMSELVES STAY ON y = 0.  The parts are       *
   *              affixed into one object anyway, so a band held back off  *
   *              the drafted plane only opened a slot behind the keys of  *
   *              every other colour.  FIT.gap is a Z rule now, not a Y    *
   *              one: it separates the stacked bands, nothing else.       *
   *                                                                      *
   *    CLEAR     nothing of one colour may interfere with another.  The   *
   *              drafted spine bands overlap each other slightly (half A  *
   *              has black topping out at 6.10034 and white starting at   *
   *              6.07824 — 0.0221 mm of solid in common, 11.35 mm3 of it),*
   *              which is invisible on the sheet and fatal to a print.    *
   *              Bands are pushed apart to leave FIT.gap.                 *
   * ==================================================================== */
  /* which z band each colour's tongue occupies — see Z above */
  /* keyed by FILAMENT.  A band names itself after the drafted layer it is
   * ('all', 'lower', 'upper', 'gray', 'black', 'white'); spineLayerPart
   * turns that into the colour whose tongues plug into it, which is what
   * decides the z the tongue actually occupies. */
  const TONGUE_Z = { gray: Z.grayTongue, black: Z.blackTongue,
                     white: Z.whiteTongue };

  /* ------------------------------------------------------------------ *
   *  THE TONGUE ROOT IS THE WHOLE JOINT, AND IT WAS A BUTT JOINT        *
   *                                                                     *
   *  A key hangs off the spine by ONE thing: the tongue, a flange about *
   *  a millimetre thick in z and TONGUE_Y deep in y, and everything     *
   *  above and below it in z belongs to another colour's band.  So the  *
   *  bonded section is that flange and nothing else — for a white key   *
   *  z 6.089 .. 7.100, which at a 0.2 mm layer is FIVE LAYERS out of    *
   *  the seventy the key is printed in.                                 *
   *                                                                     *
   *  Worse, it met the spine as a square butt: the tongue's top and     *
   *  bottom faces ran into the band's front plane at ninety degrees,    *
   *  with air on both sides.  A slicer has nothing to wrap there — the  *
   *  outline steps from the band straight up the tongue — and the sharp *
   *  re-entrant corner is exactly where the bending moment peaks, so    *
   *  the joint both READS as two bodies touching and BREAKS as one.     *
   *                                                                     *
   *  FIT.fillet puts a 45-degree gusset in that corner, under the       *
   *  tongue, over the key's own back span.  It is the band's own        *
   *  filament, so it costs no clearance: the gusset lives in FRONT of   *
   *  the spine face (y > 0), where the other colours' bands never go,   *
   *  and its x span is the key's, which every other key clears by the   *
   *  drafted 0.75 mm.  The joint goes from 1.0 mm of z to 1.6 mm, the   *
   *  corner becomes a ramp the slicer has to follow round instead of a  *
   *  step it can wall off, and the root gains section exactly where the *
   *  moment peaks — while the flange's own thickness, which is what     *
   *  lets the key bend at all, is untouched.  pushRootFillet says why   *
   *  it is the underside and not both sides.                            *
   * ------------------------------------------------------------------ */
  const FIT = {
    engage: 0.4,     // how far a band reaches into its own keys, to fuse
    gap:    0.15,    // clearance between anything of different colours
    fillet: 0.6,     // 45-degree gusset above and below each tongue root
    lap:    2.0      // how far the tongue carries ON past the spine face
  };

  /* ------------------------------------------------------------------ *
   *  THE TONGUE DOES NOT STOP AT THE SPINE FACE, IT GOES THROUGH IT     *
   *                                                                     *
   *  The drafted tongue ends flush on y = 0, the plane the band's front  *
   *  face is in, and the band grows FIT.engage forward to meet it.  So   *
   *  the two solids do overlap — but everything about the meeting is     *
   *  still pinned to that one plane, and a union asked to resolve two    *
   *  bodies whose faces are exactly coincident is being asked the one    *
   *  question a boolean solver gets wrong.                              *
   *                                                                     *
   *  FIT.lap carries the tongue's own section straight on THROUGH the    *
   *  face and FIT.lap mm into the band, so the key's solid crosses into  *
   *  the spine's rather than arriving at it.  The lap is the key's own   *
   *  filament, and it is clipped to the z its own band occupies — the    *
   *  SEPARATED z, not the drafted one, because past y = 0 it is in the   *
   *  stack where FIT.gap between colours applies.  Within that slot the  *
   *  band is the only thing there: the mounting bores start at y =       *
   *  -3.162 and the PCB channel is under z = 2.911, both of which the    *
   *  lap clears.                                                        *
   *                                                                     *
   *  It adds no outline: every millimetre of it is inside a band that    *
   *  prints in the same filament, so no slice through the part changes   *
   *  shape.  What it changes is the KIND of contact the joint is.        *
   * ------------------------------------------------------------------ */
  /**
   * Where a key's tongue laps into the spine, as boxes in design mm — one
   * per spine half the key's back span reaches, which is normally one and
   * is two only for a key straddling the A/B seam.  `span` is keyBackSpan.
   */
  function tongueLaps(spine, layer, span, only) {
    const kind = spineKindOf(spine);
    const T = TONGUE_Z[layer];
    if (!T || !span || !(FIT.lap > 1e-4)) return [];
    const out = [];
    for (const [hn, half] of spineHalves()) {
      /* the key's OWN half, when the caller knows it: a key over the seam
       * reaches the other one, and a lap there is a filament of a key that
       * does not belong to that piece */
      if (only && only !== hn) continue;
      const x0 = Math.max(span.x0, half.x0), x1 = Math.min(span.x1, half.x1);
      if (x1 - x0 <= 1e-4) continue;
      for (const b of spineBands(kind, hn)) {
        if (spineLayerPart(kind, b.name) !== layer) continue;
        const z0 = Math.max(b.z0, T[0]), z1 = Math.min(b.z1, T[1]);
        if (z1 - z0 <= 1e-4) continue;
        /* forward to FIT.engage so the lap overlaps the tongue's own solid
         * as well, rather than butting it on y = 0 and moving the
         * coincident face one step along */
        out.push({ x0, x1, y0: half.yFront - FIT.lap,
                   y1: half.yFront + FIT.engage, z0, z1 });
      }
    }
    return out;
  }

  /**
   * A closed prism, a section in (y, z) swept along x.  `poly` is [y, z]
   * pairs wound CCW in that plane, so the x1 cap faces +x.
   */
  function pushXPrism(t, x0, x1, poly) {
    if (x1 - x0 < 1e-5 || poly.length < 3) return;
    const m = poly.length;
    for (let k = 0; k < m; k++) {
      const j = (k + 1) % m, a = poly[k], b = poly[j];
      pushQuad(t, [x0, a[0], a[1]], [x0, b[0], b[1]],
                  [x1, b[0], b[1]], [x1, a[0], a[1]]);
    }
    const V = poly.map(p => [p[0], p[1], 0]);
    const idx = poly.map((_, k) => k);
    for (const f of triangulateFace(V, idx)) {
      const A = poly[f[0]], B = poly[f[1]], C = poly[f[2]];
      pushTri(t, [x1, A[0], A[1]], [x1, B[0], B[1]], [x1, C[0], C[1]]);
      pushTri(t, [x0, A[0], A[1]], [x0, C[0], C[1]], [x0, B[0], B[1]]);
    }
  }

  /**
   * The gusset at a tongue root: a 45-degree ramp off the band's front
   * face onto the underside of the tongue, over the x span the key
   * presents at the spine (keyBackSpan).  `t0`/`t1` are the tongue's OWN z
   * extent — the drafted band clipped to the tongue — not the band's,
   * which is pushed up by FIT.gap and would leave the ramp hanging a tenth
   * of a millimetre off the flange it is meant to carry.
   *
   * UNDER THE TONGUE, NOT OVER IT, and that is a printing answer rather
   * than a structural one.  Every part goes on the bed playing-face down
   * (see bedAngle), so print z runs DOWN through design z: the ramp below
   * t0 starts at its full width against the flange the layer before and
   * narrows away, which needs no support at all, while the mirror of it
   * above t1 would start as a knife edge in open air — a 21 mm thread
   * laid over nothing, since the key's own back is TONGUE_Y forward of
   * there — and only reach full width three layers later.  One good ramp
   * beats two when the second one has to be printed in the air.
   *
   * `yG` is where the ramp's back face stands.  On the bottom band that is
   * the spine face itself, and the ramp fuses to the band it fillets.  On
   * any band above it the ramp hangs below its own band's z, so the plane
   * it would lie flat against belongs to the colour STACKED UNDER this one
   * — a separately printed part this key has to move in front of — and the
   * caller stands it off by FIT.gap instead.  See CLEAR.
   */
  /* NOTHING BUILDS THIS ANY MORE.  The tongue root used to carry a fillet
   * — a diagonal gusset run along the spine face under every tongue — and
   * it is gone: the joint is the boss and the lap, and the gusset only put
   * a visible ramp on a face that should read flush.  Kept because it is
   * exported, so a page written against the old API still loads. */
  function pushRootFillet(t, x0, x1, yG, t0, t1, r) {
    if (!(r > 1e-4) || x1 - x0 < 1e-5 || t1 - t0 < 1e-5) return;
    pushXPrism(t, x0, x1, [[yG, t0], [yG, t0 - r], [yG + r, t0]]);
  }

  /* ------------------------------------------------------------------ *
   *  THE FOOT IS NOT A RECTANGLE                                        *
   *                                                                     *
   *  "Feet - A" / "Feet - B" draw all 32 feet as ONE shape, and it is    *
   *  the "-| |-": two mirrored T's, each a full-width CROSSBAR with a    *
   *  1.0 mm central STEM reaching out to the pad edge, with a 1.99978 mm *
   *  window between the two bars.  16 vertices, 2 n-gon faces, flat at   *
   *  z = FOOT.z.  Stored verbatim as (x from the pad's left edge, y from *
   *  the pad's BACK edge) in design y, so y grows toward the player.     *
   * ------------------------------------------------------------------ */
  const FOOT_SHAPE = {
    v: [[10.400028, 6.501869], [10.400028, 5.499901], [10.400028, 3.500008],
        [10.400024, 2.500008], [0.000000, 2.500008], [0.000004, 3.500008],
        [0.000004, 5.499901], [0.000004, 6.501869], [5.700024, 0.000000],
        [4.700024, 0.000000], [5.700027, 9.000046], [4.700027, 9.000046],
        [4.700027, 6.501869], [5.700027, 6.501869], [5.700024, 2.499992],
        [4.700024, 2.499992]],
    f: [[7, 6, 1, 0, 13, 10, 11, 12],      // bar + stem, toward the player
        [5, 4, 15, 9, 8, 14, 3, 2]]        // bar + stem, toward the spine
  };

  /** the drafted foot outline, in design coordinates, for the foot at cx */
  function footOutline(cx) {
    const x0 = cx - FOOT.w / 2, y0 = FOOT.yCentre - FOOT.d / 2;
    const V = FOOT_SHAPE.v.map(p => [x0 + p[0], y0 + p[1]]);
    return FOOT_SHAPE.f.map(ring => ring.map(i => V[i]));
  }

  /**
   * The "-| |-" is drawn as two separate bar+stem rings (see FOOT_SHAPE.f)
   * with an empty window between them for the dome.  A connector that fills
   * that window solid for any part of its height — even one meant to step
   * in to the true shape only at the very tip — walls off the dome's own
   * clearance where the dome has to sit.  So the pair
   * face is built as two independent loops, one per ring, each confined
   * to its own ring's y band; the window between them is never filled.
   */
  function footIslands(cx) {
    return footOutline(cx).map(ring => {
      let y0 = Infinity, y1 = -Infinity;
      for (const p of ring) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
      return { ring, y0, y1 };
    });
  }

  const PAIR = {
    travel: 2.0,     // AKM320 rubber-dome travel
    margin: 0.5,     // air on top of the travel
    stem:   1.0,     // width of the "-| |-" stem, drafted
    split:  0.99387  // the gap between the two halves of a split pair
  };

  /* ------------------------------------------------------------------ *
   *  THE RAISED FOOT PAIR IS DRAFTED, NOT DERIVED                       *
   *                                                                     *
   *  Read verbatim out of the "Raised Feet (Pair)" collection: the face *
   *  popped off each key's own underside deck.  Every one of the 32 is  *
   *  the same "-| |-" — a CROSSBAR spanning the full width of that      *
   *  key's deck, a 1 mm central STEM reaching out of each bar, and the  *
   *  2 mm dome window between them — and every one of them uses one of  *
   *  exactly TWO y profiles.  So the profile is stored, like            *
   *  FOOT_SHAPE, rather than fitted.                                    *
   *                                                                     *
   *  Each profile is six design-y values, back to front:                *
   *    y0  back stem tip                                                *
   *    y1  back bar, back edge      y2  back bar, front edge            *
   *    y3  front bar, back edge     y4  front bar, front edge           *
   *    y5  front stem tip                                               *
   *                                                                     *
   *    full   the standard 14.0 mm shape: 5 mm stem, 1 mm bar, 2 mm     *
   *           window, 1 mm bar, 5 mm stem.  Used by every white key,    *
   *           by both full-width accidentals and by the Second half of  *
   *           a split pair — anything whose deck reaches y 35.3776.     *
   *    split  the Second half of a split pair: the same 14.0 mm reach,  *
   *           but drawn with slightly heavier bars and a 1.902 mm       *
   *           window rather than 1/2/1.                                 *
   *    short  the 10.25 mm shape the First half of a split pair gets:   *
   *           its key ends at y 27.8189, so the front stem is 1.25 mm.  *
   * ------------------------------------------------------------------ */
  const PAIR_SHAPE = {
    full:  [21.3777, 26.3777, 27.3777, 29.3776, 30.3776, 35.3776],
    split: [21.3777, 26.3777, 27.4659, 29.3682, 30.4147, 35.3776],
    short: [17.5688, 22.5669, 23.5688, 25.5687, 26.5687, 27.8189]
  };

  /**
   * `snap` picks which of the two rules this axis obeys.
   *
   *   false (x)  SHRINK ONLY.  The ring keeps its drafted width and makes
   *              the LEAST move that lands it on the deck; it is pulled in
   *              only when the deck cannot hold it.  In x the outermost
   *              coordinates are the crossbar ends, and the bar is drafted
   *              at the pad's true width, so widening it would mean the
   *              pair face no longer describes the pad.
   *   true  (y)  SNAP TO THE DECK.  The outermost coordinate at each end
   *              goes to the deck's own edge, out as well as in.  In y the
   *              outermost coordinates are the stem tips, and a stem is
   *              exactly the part that is meant to reach — so the pair
   *              face spans the key's belly instead of perching in the
   *              middle of it, and a stem that has nowhere to go is
   *              shortened rather than the whole shape being re-centred.
   *
   * Either way every INTERIOR coordinate merely rides along on the same
   * translation: the 1 mm stem keeps its 1 mm in x, and the bar thickness
   * and the 2 mm dome window keep theirs in y.
   */
  function seatAxis(ring, k, lo, hi, snap) {
    let r0 = Infinity, r1 = -Infinity;
    for (const p of ring) { if (p[k] < r0) r0 = p[k]; if (p[k] > r1) r1 = p[k]; }
    let a0 = lo, a1 = hi;
    if (!snap) {                                    // x insets, y does not
      a0 = lo + PAIR.bite; a1 = hi - PAIR.bite;
    }
    if (a1 - a0 < PAIR.minSeat) {                   // deck too narrow to inset
      const c = (lo + hi) / 2, h = Math.max(PAIR.minSeat, hi - lo) / 2;
      a0 = c - h; a1 = c + h;
    }
    if (snap) {
      /* A STEM REACHES PAIR.stem, AND NEVER FURTHER.  The window the tips
       * snap to is capped at the extended ring's own span, so a deep belly
       * cannot drag the stems out across the whole key — it just leaves
       * them at full length.  Where the belly is shallower than that, the
       * cap does nothing and one tip is shortened to the deck edge, which
       * is the whole point of snapping in y. */
      if (a1 - a0 > r1 - r0) {
        const w = r1 - r0;
        a0 = Math.min(Math.max(r0, a0), a1 - w); a1 = a0 + w;
      }
      const d = (a0 + a1) / 2 - (r0 + r1) / 2;
      return v => Math.abs(v - r0) < SEAT_EPS ? a0
                : Math.abs(v - r1) < SEAT_EPS ? a1
                : v + d;
    }
    const span = Math.min(r1 - r0, a1 - a0);        // shrink only, never grow
    /* the LEAST move that lands it, not a re-centring: a belly can run the
     * whole depth of the key, and centring in it would drag the seat off
     * the sensor entirely.  Where the ring already fits, it does not move
     * at all. */
    const t0 = Math.min(Math.max(r0, a0), a1 - span), t1 = t0 + span;
    const d = (t0 + t1) / 2 - (r0 + r1) / 2;
    return v => Math.abs(v - r0) < SEAT_EPS ? t0
              : Math.abs(v - r1) < SEAT_EPS ? t1
              : v + d;
  }

  /**
   * THE STEMS REACH FIRST, THE SEAT FITS SECOND.
   *
   * The drafted "-| |-" is 9 mm deep, which is the sensor pad's depth, not
   * the key's.  Before it is seated, both stem tips are pushed PAIR.stem
   * further out in y, so the pair face has something to lose when the deck
   * is short.  seatTransform then does the fitting, and because it is a
   * least-move shrink it takes that length back off ONE end — the end that
   * actually runs off the deck — instead of re-centring the whole shape.
   * That is why a key like the split black keeps a full-length stem on one
   * side and a clipped one on the other.
   *
   * x is never extended: in x the outermost coordinates are the crossbar
   * ends, and the bar is drafted at the pad's true width.
   */
  function stemExtend(rings) {
    let y0 = Infinity, y1 = -Infinity;
    for (const r of rings) for (const p of r) {
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    return ring => ring.map(p => [p[0],
      Math.abs(p[1] - y0) < SEAT_EPS ? y0 - PAIR.stem :
      Math.abs(p[1] - y1) < SEAT_EPS ? y1 + PAIR.stem : p[1]]);
  }

  /**
   * The seat transform for one whole "-| |-".  It is built from BOTH bars
   * at once and then applied to each of them, so the 2 mm dome window and
   * the offset between the bars survive the move: seat each bar on its own
   * and they would both centre on the same land and close the window.
   */
  function seatTransform(rings, land) {
    const all = [].concat.apply([], rings);
    const fx = seatAxis(all, 0, land.x0, land.x1, false);
    const fy = seatAxis(all, 1, land.y0, land.y1, true);
    return ring => ring.map(p => [fx(p[0]), fy(p[1])]);
  }

  /** the drafted ring, moved onto `land` — see seatAxis */
  function seatRing(ring, land) { return seatTransform([ring], land)(ring); }

  /** the x span a key presents at the spine face — where its band must boss */
  function keyBackSpan(cx, w, type, lb, rb) {
    let x0 = Infinity, x1 = -Infinity;
    for (const P of keyPolygons(cx, w, type, lb, rb)) {
      const Q = clipToBand(P, 0, 0.5);
      if (!Q) continue;
      for (const p of Q) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; }
    }
    return isFinite(x0) ? { x0, x1 } : null;
  }

  /**
   * What the key offers directly over its sensor pad: the x span it covers
   * there, the highest down-facing plane (the deck the plinth can sit under)
   * and the top of the key (the ceiling on how high the ramp may reach).
   */
  /** Sutherland-Hodgman clip of a 3-D polygon against a y slab */
  function clipToBand(P, y0, y1) {
    const cut = (poly, keep, at) => {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const ka = keep(a), kb = keep(b);
        if (ka) out.push(a);
        if (ka !== kb) {
          const t = (at - a[1]) / (b[1] - a[1]);
          out.push([a[0] + (b[0] - a[0]) * t, at, a[2] + (b[2] - a[2]) * t]);
        }
      }
      return out;
    };
    let q = cut(P, p => p[1] >= y0 - 1e-9, y0);
    if (q.length < 3) return null;
    q = cut(q, p => p[1] <= y1 + 1e-9, y1);
    return q.length >= 3 ? q : null;
  }

  /**
   * What the key offers directly over a y band (the whole pad, or just one
   * "-| |-" island's band): the x and y it covers there, the highest
   * down-facing plane (the deck the connector can sit under) and the top of
   * the key (the ceiling on how high the ramp goes).
   */
  function keyPadSection(cx, w, type, lb, rb, padY0, padY1) {
    let x0 = Infinity, x1 = -Infinity, ky0 = Infinity, ky1 = -Infinity;
    let zTop = -Infinity, zDeck = -Infinity, deck = null;
    for (const P of keyPolygons(cx, w, type, lb, rb)) {
      const Q = clipToBand(P, padY0, padY1);
      if (!Q) continue;
      let lz = Infinity, hz = -Infinity, qx0 = Infinity, qx1 = -Infinity;
      for (const p of Q) {
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
        if (p[1] < ky0) ky0 = p[1]; if (p[1] > ky1) ky1 = p[1];
        if (p[2] > zTop) zTop = p[2];
        if (p[2] < lz) lz = p[2]; if (p[2] > hz) hz = p[2];
        if (p[0] < qx0) qx0 = p[0]; if (p[0] > qx1) qx1 = p[0];
      }
      if (hz - lz > 1e-4) continue;
      let nz = 0;
      for (let i = 0; i < Q.length; i++) {
        const a = Q[i], b = Q[(i + 1) % Q.length];
        nz += (a[0] - b[0]) * (a[1] + b[1]);
      }
      if (nz >= 0) continue;                        // down-facing only
      if (lz > zDeck) zDeck = lz;                   // the deepest pocket
    }
    if (!isFinite(zTop)) return null;
    /* THE LAND.  What a pair face actually lies in: the key's own
     * belly — the LOWEST down-facing region, merged out of the drafted
     * fragments (keyDecks), and of that region the biggest loop reaching
     * across this band.  A connector climbing from the sensor meets that
     * one first, and it is the only surface wide enough to seat the
     * drafted "-| |-" on. */
    for (const g of keyDecks(cx, w, type, lb, rb)) {
      let best = null;
      for (const R of g.loops) {
        const a = polyArea2(R);
        if (a >= 0) continue;                       // a hole in the belly
        let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
        for (const p of R) {
          if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0];
          if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1];
        }
        if (by1 < padY0 - 1e-6 || by0 > padY1 + 1e-6) continue;
        if (!best || -a > best.area)
          best = { x0: bx0, x1: bx1, y0: by0, y1: by1, z: g.z,
                   area: -a, loop: R };
      }
      if (best) { deck = best; break; }
    }
    return { x0, x1, y0: ky0, y1: ky1, padY0, padY1, deck,
             zTop, zDeck: isFinite(zDeck) ? zDeck : zTop };
  }

  /**
   * The lowest down-facing surface a key presents, per x, inside a y band.
   * This is what a neighbour's connector could actually hit — a bounding
   * box is useless here, because the two halves of a split pair share an x
   * span and an overlapping y span and only differ in z.
   */
  function keyUnderProfile(cx, w, type, lb, rb, yb0, yb1, x0, step, n) {
    const out = new Array(n).fill(Infinity);
    for (const P of keyPolygons(cx, w, type, lb, rb)) {
      const Q = clipToBand(P, yb0, yb1);
      if (!Q) continue;
      let lz = Infinity, hz = -Infinity, qx0 = Infinity, qx1 = -Infinity;
      for (const p of Q) {
        if (p[2] < lz) lz = p[2]; if (p[2] > hz) hz = p[2];
        if (p[0] < qx0) qx0 = p[0]; if (p[0] > qx1) qx1 = p[0];
      }
      if (hz - lz > 1e-4) continue;
      let nz = 0;
      for (let i = 0; i < Q.length; i++) {
        const a = Q[i], b = Q[(i + 1) % Q.length];
        nz += (a[0] - b[0]) * (a[1] + b[1]);
      }
      if (nz >= 0) continue;                        // want down-facing only
      const i0 = Math.max(0, Math.ceil((qx0 - x0) / step));
      const i1 = Math.min(n - 1, Math.floor((qx1 - x0) / step));
      for (let i = i0; i <= i1; i++) if (lz < out[i]) out[i] = lz;
    }
    return out;
  }

  /**
   * THE LAND: the x span of the key's own underside deck.
   *
   * That is all the pair face takes from the key — the popped faces in
   * "Raised Feet (Pair)" are each exactly as wide as the deck they came
   * off, and their y comes from PAIR_SHAPE rather than from the key.
   *
   * The one thing the drafted belly cannot tell us is where a SPLIT PAIR
   * divides.  Both halves share one slot, and the deeper half's belly loop
   * is drawn across the whole of it, so the two would come out on top of
   * one another.  `sib` is the other half's land when there is one: this
   * half then takes the rest of the slot, less PAIR.split of air.
   */
  function pairLand(cx, w, type, lb, rb, sib) {
    const K = keyPadSection(cx, w, type, lb, rb,
                            FOOT.yCentre - FOOT.d / 2, FOOT.yCentre + FOOT.d / 2);
    if (K == null) return null;
    const deck = K.deck
      ? { x0: K.deck.x0, x1: K.deck.x1, y1: K.deck.y1, z: K.deck.z, seated: true }
      : { x0: K.x0, x1: K.x1, y1: K.y1, z: K.zDeck, seated: false };
    if (sib && sib.x1 - sib.x0 < (deck.x1 - deck.x0) * 0.75) {
      /* the sibling holds one end of the slot; take the other */
      if (sib.x0 - deck.x0 > deck.x1 - sib.x1) deck.x1 = sib.x0 - PAIR.split;
      else                                     deck.x0 = sib.x1 + PAIR.split;
      deck.trimmed = true;      // this is the Second half — see PAIR_SHAPE
    }
    return deck;
  }

  /**
   * THE PAIR RING IS THE PAD RING, VERTEX FOR VERTEX.
   *
   * Rather than draw the popped shape independently, map the drafted pad
   * ring onto the pair's coordinates by ROLE: each x is one of the four
   * the "-| |-" uses (bar end, stem edge, stem edge, bar end) and each y
   * is one of three (the bar's inner edge, its outer edge, the stem tip).
   * The result is the same 8 points in the same order and the same winding
   * as the pad ring it belongs to, which is what lets the two loft into a
   * closed solid with nothing to match up: vertex i bridges to vertex i.
   */
  function mapRingToPair(ring, lx0, lx1, sc, s1, inner, outer, tip) {
    /* CLUSTER, do not round.  The drafted pad carries a few ten-thousandths
     * of noise — 5.700024 against 5.700027 on one stem edge — and a fixed
     * rounding can split one role in two.  Group within a tenth of a
     * millimetre instead: far below the smallest real feature here (the
     * 1 mm stem) and far above the noise. */
    const TOL = 0.1;
    const cluster = vals => {
      const out = [];
      for (const v of vals.slice().sort((p, q) => p - q))
        if (!out.length || v - out[out.length - 1] > TOL) out.push(v);
      return out;
    };
    const nearest = (v, cs) => {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < cs.length; i++) {
        const d = Math.abs(v - cs[i]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    };
    const xs = cluster(ring.map(p => p[0]));
    const ys = cluster(ring.map(p => p[1]));
    const X = [lx0, sc, s1, lx1];
    /* which drafted y is which: the bar edge nearer the pad's centre is
     * the inner one, the far extreme is the stem tip, and what is left is
     * the outer edge the stem leaves from. */
    const byNear = ys.slice().sort((p, q) =>
      Math.abs(p - FOOT.yCentre) - Math.abs(q - FOOT.yCentre));
    const Y = new Map();
    Y.set(byNear[0], inner); Y.set(byNear[1], outer); Y.set(byNear[2], tip);
    return ring.map(p => [X[nearest(p[0], xs)], Y.get(ys[nearest(p[1], ys)])]);
  }

  /**
   * The pairing faces for one key: the popped "-| |-", rebuilt.
   *
   * Two flat loops, one per bar, in the plane of the key's own underside
   * deck.  The crossbar spans the land; the stem is PAIR.stem wide and
   * centred on it; the y values are the drafted profile, so the bar
   * thickness, the 2 mm dome window and the stem reach are the ones the
   * sheet draws rather than anything fitted here.
   *
   * A key whose deck stops short of the full profile's front stem gets the
   * short profile; the Second half of a split pair gets its own.  Each
   * ring comes back in its pad ring's order — see mapRingToPair.
   */
  /* ------------------------------------------------------------------ *
   *  X COMPENSATION CLEARANCE                                           *
   *                                                                     *
   *  The raised key foot is drafted at the width of the KEY's belly, and *
   *  the sensor foot is drafted at the width of the AKM320 PAD.  Those   *
   *  are two different widths, so on most keys the raised loop overhangs *
   *  the pad loop at one end or both — and a press lofted between them   *
   *  then leans out over its neighbour's slot instead of standing over   *
   *  its own sensor.                                                     *
   *                                                                      *
   *  THE RULE.  Neither end of the raised key foot may sit outside the   *
   *  sensor foot in x.  Where the raised loop's X-MOST vertices are      *
   *  greater in x than the sensor foot's, they are forced to equal the   *
   *  sensor foot's; where its X-LEAST vertices are lesser, likewise.     *
   *  Verbatim, as drafted by hand in "X compensation clearance.blend".   *
   *                                                                      *
   *  ONLY THE EXTREMES MOVE.  The two crossbar ends are the only         *
   *  vertices touched: the 1 mm stem keeps its width AND its x, so the   *
   *  press is never re-centred and the dome window never shifts.  The    *
   *  bar is pulled in around a stem that stays where the key put it.     *
   *                                                                      *
   *  THE STEM IS RESCUED, NOT SEVERED.  On the 15 and 17 sheets a key    *
   *  can sit far enough off its foot that the clamped bar no longer      *
   *  reaches the stem at all.  The stem is then slid — rigidly, both     *
   *  edges together, by the LEAST distance — back inside the clamped     *
   *  bar, so it keeps its 1 mm width and the dome window keeps its own.  *
   *  Nothing on the 19 sheet needs this, which is why the hand-drafted   *
   *  file shows no example of it.                                        *
   *                                                                      *
   *  WHEN IT IS NOT APPLIED.  A raised loop can miss its pad entirely —  *
   *  the last Split Black Second of the 19 sheet reaches a foot 11.3 mm  *
   *  away and clears the pad completely.  With less than a stem's width  *
   *  of overlap there is nothing to stand a bar on, so the clamp is      *
   *  skipped and the drafted loop stands: a zero-width or inverted bar   *
   *  is worse than an overhang.  That key is a LAYOUT problem, not a     *
   *  clearance one, and pairAudit still reports the overhang.           *
   * ------------------------------------------------------------------ */
  const PAIR_X_EPS = 1e-6;
  /* the least shoulder a clamped crossbar keeps either side of its stem —
   * without it a rescued stem can land exactly on the bar end and collapse
   * the loop into a degenerate, unprintable face */
  const PAIR_X_SHOULDER = 0.2;

  /**
   * Clamp the x extremes of a raised "-| |-" (both bars together, so the
   * pair keeps one common bar span) into the sensor pad's own x span.
   * Mutates the rings in place and returns the span it settled on, or null
   * when the clamp was skipped — see the guard above.
   */
  function clampPairToPadX(rings, pad) {
    let p0 = Infinity, p1 = -Infinity;
    for (const r of pad) for (const q of r) {
      if (q[0] < p0) p0 = q[0]; if (q[0] > p1) p1 = q[0];
    }
    let r0 = Infinity, r1 = -Infinity;
    for (const r of rings) for (const q of r) {
      if (q[0] < r0) r0 = q[0]; if (q[0] > r1) r1 = q[0];
    }
    const a0 = Math.max(r0, p0), a1 = Math.min(r1, p1);
    /* a bar has to be wide enough to carry its stem with a shoulder either
     * side; anything less is a degenerate loop, not a press */
    if (a1 - a0 < PAIR.stem + 2 * PAIR_X_SHOULDER) return null;
    /* the stem is every interior x of the ring — it does not move unless
     * the clamped bar would leave it behind, and then only as far as it
     * must, rigidly, so the 1 mm stays 1 mm */
    let s0 = Infinity, s1 = -Infinity;
    for (const r of rings) for (const q of r) {
      if (q[0] - r0 > PAIR_X_EPS && r1 - q[0] > PAIR_X_EPS) {
        if (q[0] < s0) s0 = q[0]; if (q[0] > s1) s1 = q[0];
      }
    }
    let shift = 0;
    if (isFinite(s0)) {
      const b0 = a0 + PAIR_X_SHOULDER, b1 = a1 - PAIR_X_SHOULDER;
      if (s0 < b0) shift = b0 - s0;
      else if (s1 > b1) shift = b1 - s1;
    }
    for (const r of rings) for (const q of r) {
      if (Math.abs(q[0] - r0) < PAIR_X_EPS) q[0] = a0;
      else if (Math.abs(q[0] - r1) < PAIR_X_EPS) q[0] = a1;
      else q[0] += shift;
    }
    return { x0: a0, x1: a1, stemShift: shift };
  }

  function pairFaces(cx, w, type, lb, rb, footX, sib) {
    const land = pairLand(cx, w, type, lb, rb, sib);
    if (land == null) return null;
    const P = land.y1 < PAIR_SHAPE.full[5] - 1e-3 ? PAIR_SHAPE.short
            : land.trimmed                        ? PAIR_SHAPE.split
                                                  : PAIR_SHAPE.full;
    const x0 = land.x0, x1 = land.x1;
    const sc = (x0 + x1) / 2 - PAIR.stem / 2, s1 = sc + PAIR.stem;
    const pad = footOutline(footX);
    /* pad ring 0 reaches toward the player, ring 1 toward the spine — the
     * front half of the drafted profile and the back half respectively */
    const rings = [
      mapRingToPair(pad[0], x0, x1, sc, s1, P[3], P[4], P[5]),
      mapRingToPair(pad[1], x0, x1, sc, s1, P[2], P[1], P[0])
    ];
    /* X compensation clearance — the raised loop never overhangs the pad */
    const clamp = clampPairToPadX(rings, pad);
    return [
      { z: land.z, seated: land.seated, clamp, ring: rings[0] },
      { z: land.z, seated: land.seated, clamp, ring: rings[1] }
    ];
  }

  /* ==================================================================== *
   *  THE SENSOR PRESS  —  the loop pair, closed into a solid              *
   *                                                                      *
   *  One prism per bar of the "-| |-": the drafted pad ring at the        *
   *  bottom, its pair ring in the key's deck plane at the top, ONE quad   *
   *  band between them vertex i to vertex i, and BOTH ends capped.  Each  *
   *  bar is therefore a closed watertight solid — every directed edge     *
   *  used exactly once — and the face that presses the sensor is the      *
   *  drafted pad ring itself rather than an approximation of it.          *
   *                                                                      *
   *  TWO PRISMS, NOT ONE.  The window between the bars is where the       *
   *  rubber dome sits.  Lofting the pair as one ring would close it;      *
   *  lofting each bar on its own leaves it open at every height, which is *
   *  why the pad is drafted as two n-gons rather than one to begin with.  *
   *                                                                      *
   *  Nothing is stepped and nothing is squared off.  The 1 mm stem and    *
   *  the 2 mm window survive the whole climb, because both loops are the  *
   *  drafted shape rather than a bounding box of it.                      *
   * ==================================================================== */

  /**
   * A closed prism between two equal-length rings, `bot` at z0 and `top`
   * at z1.  Both are normalised to CCW together, so vertex i still bridges
   * to vertex i; the caps are then wound to CLOSE the walls rather than by
   * convention, which is what makes the result watertight instead of a
   * shell with two lids facing the wrong way.
   */
  function pushPrism(t, bot, top, z0, z1) {
    let B = bot, T = top;
    if (polyArea2(B) < 0) { B = B.slice().reverse(); T = T.slice().reverse(); }
    const m = B.length;
    for (let k = 0; k < m; k++) {
      const j = (k + 1) % m;
      pushQuad(t, [B[k][0], B[k][1], z0], [B[j][0], B[j][1], z0],
                  [T[j][0], T[j][1], z1], [T[k][0], T[k][1], z1]);
    }
    const V = B.map(p => [p[0], p[1], 0]);
    const idx = B.map((_, k) => k);
    for (const tri of triangulateFace(V, idx)) {
      const i = tri[0], j = tri[1], k = tri[2];
      pushTri(t, [B[i][0], B[i][1], z0], [B[k][0], B[k][1], z0],
                 [B[j][0], B[j][1], z0]);                       // down-facing
      pushTri(t, [T[i][0], T[i][1], z1], [T[j][0], T[j][1], z1],
                 [T[k][0], T[k][1], z1]);                       // up-facing
    }
  }

  /**
   * One key's sensor press: two closed prisms, one per bar of the
   * "-| |-", from the drafted pad up to the key's own deck plane.
   */
  function buildPress(cx, w, type, lb, rb, footX, sib) {
    const faces = pairFaces(cx, w, type, lb, rb, footX, sib);
    if (faces == null) return [];
    const pad = footOutline(footX);
    const t = [];
    for (let i = 0; i < faces.length; i++)
      pushPrism(t, pad[i], faces[i].ring, FOOT.z, faces[i].z);
    return t;
  }

  /** one press part per key, named and coloured to match its key */
  function pressParts(keys) {
    const out = [];
    for (const k of (keys || [])) {
      const tris = buildPress(k.cx, k.w, k.type, k.lb, k.rb, k.foot, k.sib);
      if (!tris.length) continue;
      out.push({ name: 'Press_' + String(k.index).padStart(2, '0'),
                 index: k.index, layer: k.layer, foot: k.foot, tris });
    }
    return out;
  }

  /**
   * Is a triangle soup closed?  Every DIRECTED edge has to appear exactly
   * once and its opposite exactly once.  A bare undirected count would
   * pass a cap wound the wrong way; this does not.
   */
  /**
   * TWO DIFFERENT THINGS GET CALLED "NOT WATERTIGHT", and only one of them
   * is a fault.
   *
   *   OPEN     an edge used by ONE face.  A hole in the surface: there is
   *            no inside and no outside there, a slicer's cross-section
   *            will not close, and it stitches a guess across the gap.
   *            This is a defect and there should be none.
   *
   *   INTERNAL an edge used by more than two.  Two closed bodies meeting
   *            exactly along it — the rectangles a slab is built from, a
   *            washer against the block around it.  Every face still has
   *            an inside and an outside; the layer is closed either way,
   *            and the slicer unions the pieces into one outline.  A
   *            strict "every edge exactly twice" checker calls this
   *            non-manifold, and for a print it is not a fault.
   *
   * `closed` is therefore about OPEN edges alone, and the internal count
   * is reported beside it rather than folded into a single verdict.
   */
  function isWatertight(tris) {
    const k4 = v => Math.round(v * 1e4);
    const vk = (t, i) => k4(t[i]) + ',' + k4(t[i+1]) + ',' + k4(t[i+2]);
    const und = new Map(), dir = new Map();
    for (let i = 0; i < tris.length; i += 9) {
      const v = [vk(tris, i), vk(tris, i + 3), vk(tris, i + 6)];
      for (let k = 0; k < 3; k++) {
        const a = v[k], b = v[(k + 1) % 3];
        if (a === b) continue;                       // degenerate
        const u = a < b ? a + '|' + b : b + '|' + a;
        und.set(u, (und.get(u) || 0) + 1);
        const d = a + '>' + b;
        dir.set(d, (dir.get(d) || 0) + 1);
      }
    }
    let open = 0, internal = 0;
    for (const n of und.values()) { if (n === 1) open++; else if (n > 2) internal++; }
    /* and every edge has to be walked the same number of times each way,
     * or two faces that share it disagree about which side is out */
    let flipped = 0;
    for (const [e, n] of dir) {
      const p = e.split('>');
      if ((dir.get(p[1] + '>' + p[0]) || 0) !== n) flipped++;
    }
    return { closed: open === 0 && flipped === 0, openEdges: open,
             internalEdges: internal, flippedEdges: flipped,
             badEdges: open + flipped, edges: und.size };
  }

  /** signed volume of a closed soup — positive when the normals face out */
  function meshVolume(tris) {
    let v = 0;
    for (let i = 0; i < tris.length; i += 9)
      v += (tris[i]   * (tris[i+4] * tris[i+8] - tris[i+7] * tris[i+5])
          - tris[i+1] * (tris[i+3] * tris[i+8] - tris[i+6] * tris[i+5])
          + tris[i+2] * (tris[i+3] * tris[i+7] - tris[i+6] * tris[i+4])) / 6;
    return v;
  }

  /* ==================================================================== *
   *  THE KEY'S OWN ARMS  —  the two stems of the drafted underside boss   *
   *                                                                      *
   *  Every drafted key carries the "-| |-" on its underside: two BARS    *
   *  spanning the key's belly, and reaching out of them in y, two 1 mm   *
   *  STEMS — the arms.  They are what the sensor press meets: the press  *
   *  climbs off the pad and closes on the same "-| |-" in the key's own  *
   *  deck plane, so the two shapes have to stand over one another.       *
   *                                                                      *
   *  THE ARMS ARE DRAFTED ON THE KEY, THE PRESS STANDS ON THE SENSOR.    *
   *  The sheet draws each pair of arms where the key it belongs to was   *
   *  drawn over its own sensor — on the centreline of a full key, on a   *
   *  quarter of the slot for a split half.  Change the layout and the    *
   *  key is no longer over that sensor: the press follows the pad, the   *
   *  drafted arms stay with the key, and the two miss each other by as   *
   *  much as half a key.                                                 *
   *                                                                      *
   *  So the arms are PLACED ON THEIR OWN BARS, at the press's stems and  *
   *  at the drafted PAIR.stem width whatever the key's width, and        *
   *  nothing else about the key moves.  Only vertices lying on the two   *
   *  stem lines are shifted, and only in x: the bars keep their span,    *
   *  the walls keep theirs, and every face the stems part — a bar wall,  *
   *  the belly n-gon they are cut out of — is parted at a different x    *
   *  rather than reshaped.  A stem stops ARM_SHOULDER short of the end   *
   *  of its bar, so it always lands on material at both ends.            *
   * ==================================================================== */
  const ARM_EPS = 0.01;       // the sheets carry a thou or two of noise
  const ARM_TOL = 0.15;       // how near PAIR.stem a candidate pair must sit
  const ARM_SHOULDER = 0.2;   // bar material kept outboard of a stem
  const ARM_CACHE = new WeakMap();

  /** which PAIR_SHAPE the boss on this profile was drafted to, if any */
  function armShapeOf(p) {
    for (const k of ['full', 'split', 'short']) {
      const S = PAIR_SHAPE[k];
      let ok = true;
      for (const y of S) {
        let hit = false;
        for (let i = 0; i < p.nv && !hit; i++)
          if (Math.abs(p.v[i * 4 + 2] - y) < ARM_EPS) hit = true;
        if (!hit) { ok = false; break; }
      }
      if (ok) return S;
    }
    return null;
  }

  /**
   * The two stem lines of a profile's underside boss, found once per
   * profile object and cached.
   *
   * A stem line is an (alpha, beta) pair — a whole x line of the drafted
   * key, so every vertex on it moves together and the stem keeps its
   * width at every key width.  The two are recognised at the boss's own
   * y tips: the only pair of lines PAIR.stem apart that shows at BOTH
   * tips and touches neither edge of the key.  A key's outer walls are
   * also a millimetre thick, which is why the edges are ruled out.
   */
  function armLines(p) {
    if (ARM_CACHE.has(p)) return ARM_CACHE.get(p);
    const A = findArmLines(p);
    ARM_CACHE.set(p, A);
    return A;
  }

  function findArmLines(p) {
    const S = armShapeOf(p);
    if (!S) return null;
    const w = p.w0;
    const X = i => p.v[i * 4] + p.v[i * 4 + 1] * w;
    const lineKey = i =>
      Math.round(p.v[i * 4] * 1e4) + ':' + Math.round(p.v[i * 4 + 1] * 1e4);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < p.nv; i++) {
      const x = X(i); if (x < lo) lo = x; if (x > hi) hi = x;
    }
    const linesAt = y => {
      const m = new Map();
      for (let i = 0; i < p.nv; i++) {
        if (Math.abs(p.v[i * 4 + 2] - y) > ARM_EPS) continue;
        const k = lineKey(i), z = p.v[i * 4 + 3];
        if (!m.has(k)) m.set(k, { key: k, x: X(i), z });
        else if (z < m.get(k).z) m.get(k).z = z;
      }
      return Array.from(m.values()).sort((a, b) => a.x - b.x);
    };
    const tipA = linesAt(S[0]), tipB = linesAt(S[5]);
    const at = (L, k) => L.some(e => e.key === k);
    /* A WALL IS ALSO A MILLIMETRE THICK.  What tells the two apart is z:
     * an arm STANDS ON the boss's deck, and a wall carries on down past
     * it, so of the candidate pairs the arms are the pair that starts
     * highest.  (On an accidental there is only ever the one pair.)   */
    let pair = null, pairZ = -Infinity;
    for (let i = 0; i + 1 < tipA.length; i++) {
      const a = tipA[i], b = tipA[i + 1];
      if (Math.abs((b.x - a.x) - PAIR.stem) > ARM_TOL) continue;
      if (a.x < lo + ARM_EPS || b.x > hi - ARM_EPS) continue;   // the key's own edge
      if (!at(tipB, a.key) || !at(tipB, b.key)) continue;
      const z = Math.min(a.z, b.z);
      if (z > pairZ) { pairZ = z; pair = [a.key, b.key]; }
    }
    if (!pair) return null;
    /* every vertex on either stem line, inside the boss's own y band, kept
     * line by line: a stem is set to PAIR.stem wide, not merely moved, so
     * its two edges are placed rather than translated together */
    const a = [], b = [];
    let deck = Infinity;
    for (let i = 0; i < p.nv; i++) {
      const k = lineKey(i), y = p.v[i * 4 + 2];
      if (k !== pair[0] && k !== pair[1]) continue;
      if (y < S[0] - ARM_EPS || y > S[5] + ARM_EPS) continue;
      (k === pair[0] ? a : b).push(i);
      if (p.v[i * 4 + 3] < deck) deck = p.v[i * 4 + 3];
    }
    if (!a.length || !b.length) return null;
    const idx = a.concat(b);
    let top = -Infinity;
    for (const i of idx) if (p.v[i * 4 + 3] > top) top = p.v[i * 4 + 3];
    /* HOW FAR THE ARMS MAY SLIDE: the bars they stand on.  A bar is what
     * the boss raises off the deck ALONG ONE OF ITS TWO ROWS — not the
     * dome window between them, and not the key's own walls, which cross
     * the same rows and stand far higher than the boss does.  So the two
     * vertices at the bars' ends are the widest the boss itself reaches,
     * off the deck and no higher than its own arms, and they are read at
     * the key's width like any other. */
    let barLo = null, barHi = null, xLo = Infinity, xHi = -Infinity;
    for (let i = 0; i < p.nv; i++) {
      const y = p.v[i * 4 + 2], z = p.v[i * 4 + 3], x = X(i);
      const row = (y > S[1] - ARM_EPS && y < S[2] + ARM_EPS) ||
                  (y > S[3] - ARM_EPS && y < S[4] + ARM_EPS);
      if (!row) continue;
      if (z < deck + ARM_EPS || z > top + ARM_EPS) continue;
      if (x < xLo) { xLo = x; barLo = i; }
      if (x > xHi) { xHi = x; barHi = i; }
    }
    if (barLo == null || barHi == null) return null;
    return { a, b, idx, bar: [barLo, barHi], shape: S, deck };
  }

  /** the arms as instantiated: the stem span and the bar span they ride */
  function armSpan(V, A) {
    let x0 = Infinity, x1 = -Infinity;
    for (const i of A.idx) {
      const x = V[i][0]; if (x < x0) x0 = x; if (x > x1) x1 = x;
    }
    const a = V[A.bar[0]][0], b = V[A.bar[1]][0];
    return { x0, x1, lo: Math.min(a, b), hi: Math.max(a, b) };
  }

  /**
   * WHERE THIS KEY'S ARMS GO: the x of each of the two stem lines, as
   * A.a and A.b are ordered.  Null when there is nowhere to put them.
   *
   *   `at`   what the press offers: the x its own stems stand at, and the
   *          span of the bars they reach out of (see pressArms).
   *
   * AN ARM IS PAIR.stem WIDE, WHATEVER THE KEY IS.  The sheets draft some
   * of them against the key's width — a full gray's stems are a fraction
   * of its width, not a millimetre off its centreline — so a rescaled key
   * grew or shrank its arms while the press's stem stayed the millimetre
   * the sensor pad draws.  The two edges are therefore PLACED, at the
   * drafted width, rather than the drafted pair being translated: the arm
   * matches the press's stem at every key width.
   *
   * The arms go to the press's stems, and stay ON THE BAR at both ends —
   * their own, always, and the press's too whenever the two bars overlap
   * enough to hold them.  Where the key barely reaches over its sensor at
   * all the second is impossible; the arms then go as far along their own
   * bar as they can, which is the most contact an x shift can buy, and
   * the pair audit is what reports a press that thin.
   */
  function armPlace(V, A, at) {
    if (A == null || at == null) return null;
    const s = armSpan(V, A);
    const half = PAIR.stem / 2;
    let lo = s.lo + ARM_SHOULDER + half, hi = s.hi - ARM_SHOULDER - half;
    if (hi < lo) return null;                    // the bars cannot hold a stem
    if (at.bar) {
      const blo = Math.max(lo, at.bar[0] + ARM_SHOULDER + half);
      const bhi = Math.min(hi, at.bar[1] - ARM_SHOULDER - half);
      if (bhi >= blo) { lo = blo; hi = bhi; }
    }
    const c = Math.min(Math.max(at.x, lo), hi);
    /* which line is which in the world depends on whether the profile is
     * mirrored, so ask the instantiated points rather than the sheet */
    return V[A.a[0]][0] <= V[A.b[0]][0] ? [c - half, c + half]
                                        : [c + half, c - half];
  }

  /**
   * What the press offers this key's arms: the x its own stems stand at
   * and the span of its bars, read off the pair ring — the "-| |-" the
   * press closes onto in the key's deck plane.  Null when there is no
   * press.
   */
  function pressArms(cx, w, type, lb, rb, footX, sib) {
    const faces = pairFaces(cx, w, type, lb, rb, footX, sib);
    if (faces == null) return null;
    let r0 = Infinity, r1 = -Infinity;
    for (const f of faces) for (const q of f.ring) {
      if (q[0] < r0) r0 = q[0]; if (q[0] > r1) r1 = q[0];
    }
    let s0 = Infinity, s1 = -Infinity;
    for (const f of faces) for (const q of f.ring)
      if (q[0] - r0 > PAIR_X_EPS && r1 - q[0] > PAIR_X_EPS) {
        if (q[0] < s0) s0 = q[0]; if (q[0] > s1) s1 = q[0];
      }
    return { x: isFinite(s0) ? (s0 + s1) / 2 : (r0 + r1) / 2, bar: [r0, r1] };
  }

  /** the same two x values, for the generated Blender log */
  function armPlaceFor(cx, w, type, lb, rb, footX, sib) {
    const q = profileFor(type, lb, rb);
    const A = armLines(q.p);
    if (A == null) return null;
    const at = pressArms(cx, w, type, lb, rb, footX, sib);
    if (at == null) return null;
    return armPlace(profilePoints(q.p, q.mirror, w, cx - w / 2), A, at);
  }

  /** the pair face's plan, for the audit */
  function pairPlan(cx, w, type, lb, rb, footX, sib) {
    const faces = pairFaces(cx, w, type, lb, rb, footX, sib);
    if (faces == null) return null;
    const ext = (R, k) => {
      let a = Infinity, b = -Infinity;
      for (const q of R) { if (q[k] < a) a = q[k]; if (q[k] > b) b = q[k]; }
      return [a, b];
    };
    const islands = faces.map(f => ({
      top: f.ring, zPad: FOOT.z, zDeck: f.z, rise: f.z - FOOT.z,
      topX: ext(f.ring, 0), topY: ext(f.ring, 1), seated: f.seated,
      ok: f.z - FOOT.z >= PAIR.travel + PAIR.margin - 1e-9
    }));
    return {
      islands, zDeck: faces[0].z,
      seated: islands.every(p => p.seated),
      ok: islands.every(p => p.ok)
    };
  }

  /**
   * What the pairing actually achieves, measured rather than assumed.
   * With nothing built between the loops there is no ramp and no slope to
   * audit; what is left is the relationship itself:
   *
   *   seated        every pair face found a real down-facing deck on its
   *                 key to lie in, rather than falling back to a bounding
   *                 box of the key's section
   *   minRise       the least air between a pad face and its own pair
   *                 face — the dome has to travel through it, so it must
   *                 beat PAIR.travel + PAIR.margin
   *   minGap        narrowest air in x between two different keys' pair
   *                 faces, compared bar-to-bar (same island index), since
   *                 islands of a different index sit at disjoint y bands
   *   overForeign   least air above a sensor pad that is not its own
   *   watertight    every press came out a closed solid, right way out
   *   pressVolume   how much filament the 32 presses add, in mm3
   */
  function pairAudit(keys) {
    /* the press is the deliverable now, so audit the solid, not just the
     * loops: every one has to come out closed and right way out, or it is
     * not a part a slicer can do anything with. */
    let leaky = null, inverted = null, volume = 0;
    for (const k of keys) {
      const tris = buildPress(k.cx, k.w, k.type, k.lb, k.rb, k.foot, k.sib);
      if (!tris.length) continue;
      if (leaky == null && !isWatertight(tris).closed) leaky = k.index;
      const v = meshVolume(tris);
      if (inverted == null && v <= 0) inverted = k.index;
      volume += v;
    }
    const plans = keys.map(k => ({
      k, p: pairPlan(k.cx, k.w, k.type, k.lb, k.rb, k.foot, k.sib)
    })).filter(o => o.p);

    let minRise = Infinity, riseAt = null;
    let minGap = Infinity, gapAt = null;
    let overForeign = Infinity;

    for (const { k, p } of plans)
      for (const isl of p.islands)
        if (isl.rise < minRise) { minRise = isl.rise; riseAt = k.index; }

    /* pair faces of two different keys, bar for bar, in the same plane */
    for (let i = 0; i < plans.length; i++)
      for (let j = i + 1; j < plans.length; j++) {
        const A = plans[i], B = plans[j];
        for (let n = 0; n < Math.min(A.p.islands.length, B.p.islands.length); n++) {
          const a = A.p.islands[n], b = B.p.islands[n];
          if (Math.abs(a.zDeck - b.zDeck) > 1e-4) continue;
          if (a.topY[1] < b.topY[0] - 1e-9 || b.topY[1] < a.topY[0] - 1e-9) continue;
          const gap = a.topX[0] > b.topX[1] ? a.topX[0] - b.topX[1]
                    : b.topX[0] > a.topX[1] ? b.topX[0] - a.topX[1]
                    : -Math.min(a.topX[1] - b.topX[0], b.topX[1] - a.topX[0]);
          if (gap < minGap) { minGap = gap; gapAt = [A.k.index, B.k.index]; }
        }
      }

    /* a pair face must not hang over a sensor pad that is not its own */
    const feet = footCentres();
    for (const { k, p } of plans)
      for (const isl of p.islands)
        for (const fx of feet) {
          if (Math.abs(fx - k.foot) < 1e-6) continue;
          if (isl.topX[1] < fx - FOOT.w / 2 || isl.topX[0] > fx + FOOT.w / 2) continue;
          const air = isl.zDeck - FOOT.z;
          if (air < overForeign) overForeign = air;
        }

    /* X COMPENSATION CLEARANCE, measured.  After clampPairToPadX every
     * raised loop should sit inside its own pad in x.  What is left over
     * is a key that misses its foot so badly the clamp had to stand down —
     * a layout fault, and it is named here rather than left silent. */
    let xOver = 0; const xOverAt = [];
    for (const k of keys) {
      const faces = pairFaces(k.cx, k.w, k.type, k.lb, k.rb, k.foot, k.sib);
      if (!faces) continue;
      let p0 = Infinity, p1 = -Infinity, r0 = Infinity, r1 = -Infinity;
      for (const r of footOutline(k.foot)) for (const q of r) {
        if (q[0] < p0) p0 = q[0]; if (q[0] > p1) p1 = q[0];
      }
      for (const f of faces) for (const q of f.ring) {
        if (q[0] < r0) r0 = q[0]; if (q[0] > r1) r1 = q[0];
      }
      const d = Math.max(p0 - r0, r1 - p1, 0);
      if (d > 1e-4) { xOverAt.push(k.index); if (d > xOver) xOver = d; }
    }

    const unseated = plans.find(o => !o.p.seated);
    return {
      keys: plans.length,
      xClear: xOverAt.length === 0,
      xOverhang: xOver, xOverhangAt: xOverAt,
      watertight: leaky == null && inverted == null,
      leakyAt: leaky, invertedAt: inverted,
      pressVolume: volume,
      seated: plans.every(o => o.p.seated),
      unseatedAt: unseated ? unseated.k.index : null,
      minRise: isFinite(minRise) ? minRise : null, riseAt,
      minGap: isFinite(minGap) ? minGap : null, gapAt,
      overForeign: isFinite(overForeign) ? overForeign : null,
      clearsTravel: (!isFinite(minRise) || minRise >= PAIR.travel + PAIR.margin)
                 && (!isFinite(overForeign) || overForeign >= PAIR.travel)
    };
  }

  /* ==================================================================== *
   *  MORE THAN ONE OF THEM                                               *
   *                                                                      *
   *  The instrument is one AKM320 and that is not going to change: 32     *
   *  keys, 32 feet, one spine.  What CAN change is how many of them you   *
   *  are sitting at.  The archicembalo answered a register too small for  *
   *  the tuning by growing a second manual, and two of these answer it    *
   *  the same way — set side by side the second carries on where the      *
   *  first stopped, stacked it sits over the first like an upper manual.  *
   *                                                                      *
   *  THE TWO ARE NOT ALTERNATIVES.  Side-by-side and stacked are separate *
   *  questions — how wide, and how deep — so both can be answered at      *
   *  once, and four units stand in a 2 x 2 rig.  "single" is simply       *
   *  neither being answered.                                             *
   *                                                                      *
   *  NOTHING IS FLUSH.  Each unit is its own MIDI device with its own     *
   *  spine, its own board and its own case; they are set NEAR each other, *
   *  never joined.  So a rig is drawn with the air between the units      *
   *  actually in it — gapX along x, and a stacked unit lifted clear by    *
   *  half a white key's length — and never as one long keyboard.  A       *
   *  reading that hid the seam would be a lie about what you can build.   *
   *                                                                      *
   *  WHAT A UNIT'S KEYS ARE CALLED.  This is the whole point of the rig,  *
   *  and it is one line: `rigNote`.  A unit's key i is not key i of the   *
   *  rig — the rig is read as ONE run of notes distributed across the     *
   *  devices, so                                                         *
   *                                                                      *
   *      note(unit, i) = rows * (i + 32 * col) + row                      *
   *                                                                      *
   *  Along x that is plain continuation: the right-hand unit picks up 32  *
   *  notes above the left, extending the register.                       *
   *                                                                      *
   *  Up the stack it is INTERLEAVING, which is the interesting one.  With *
   *  two rows every step of the lower unit is doubled and the upper unit  *
   *  falls in the odd steps between them, so two 17-note layouts stacked  *
   *  read as one 34-note scale: the lower keyboard's 1 has become 2       *
   *  because the upper keyboard's 0 is being read as 1.  Neither layout   *
   *  was edited to make that happen — the same two designs, stood one     *
   *  above the other, ARE the finer division.                            *
   * ==================================================================== */

  const RIG = {
    /* Clear air along x between two units.  Wide enough to read as two
     * instruments at a glance at any zoom the strip offers, narrow enough
     * that the right-hand unit is still plainly a continuation of the
     * left rather than a second keyboard across the room. */
    gapX: 20.0,
    /* A stacked unit is an upper MANUAL, and a manual you cannot reach past
     * is not one: it stands over the spine of the keyboard below — set back
     * by exactly one white key, so its front edge lands on that spine's
     * front face, y = 0, the datum every other measurement here is taken
     * from — and lifted by half a white key's length.
     *
     * Half a white is the lift because it is the only distance on the
     * instrument that reads as a manual rather than as a shelf: enough to
     * get a hand under, and taken from the keyboard's own dimensions rather
     * than invented.  Set the two to 0 and the upper unit sits dead on top
     * of the lower one, which hides it completely from above and is not a
     * rig anybody could play. */
    dy: -85.0688,
    dz: 85.0688 / 2
  };

  /** {side, stack} — anything else a saved design carries is ignored. */
  function rigConfig(cfg) {
    const c = cfg || {};
    return { side: !!c.side, stack: !!c.stack };
  }
  const rigCols = cfg => (rigConfig(cfg).side ? 2 : 1);
  const rigRows = cfg => (rigConfig(cfg).stack ? 2 : 1);
  const rigCount = cfg => rigCols(cfg) * rigRows(cfg);

  /**
   * How far apart two units stand along x, centre of case to centre of case.
   *
   * Measured over the WIDER of the key run and the spine, not over the spine
   * alone: 32 keys can hang up to ~10 mm off the end of half B, and a pitch
   * that ignored the overhang would have the two units' keys overlapping in
   * the air even though their spines cleared.
   */
  function rigPitchX(L, cfg) {
    const x1 = Math.max(L && L.keyX1 != null ? L.keyX1 : -Infinity, SPINE.halfB.x1);
    /* FLUSH IS A WAY OF LOOKING, NOT A WAY OF BUILDING.  Closed up, the two
     * devices stand SIZE.whiteGap apart — the same 1.5 mm of air that stands
     * between any two adjacent whites — so the last key of the left device
     * and the first key of the right are spaced exactly as neighbours on one
     * keyboard are, and the pair reads as a single continuous keybed rather
     * than as two cases pushed together.
     *
     * Not 0.  Two keys touching is not what the run does anywhere else on the
     * instrument, so a zero join would read as a seam precisely where the
     * point is that there should not be one.
     *
     * Nothing else changes: they are still two AKM320s with two spines, and
     * RIG.gapX is what that costs whenever it is put back. */
    return (x1 - SPINE.halfA.x0) + ((cfg && cfg.flush) ? SIZE.whiteGap : RIG.gapX);
  }

  /**
   * The units of a rig, bottom row first and left to right within a row, so
   * unit 0 is always the one the design is actually being edited on.
   *
   * dx/dy/dz translate a unit's geometry out of the single-unit design frame
   * into the rig.  Nothing else is transformed: every unit is the same
   * keyboard, drawn again somewhere else.
   */
  function rigUnits(L, cfg) {
    const rows = rigRows(cfg), cols = rigCols(cfg), px = rigPitchX(L, cfg);
    const out = [];
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++)
        out.push({
          index: out.length, slot: rigSlot(col, row), row, col, rows, cols,
          primary: row === 0 && col === 0,
          dx: col * px, dy: row * RIG.dy, dz: row * RIG.dz
        });
    return out;
  }

  /* WHERE A DEVICE'S OWN DESIGN IS KEPT.  Not the position in the list —
   * that shifts the moment a toggle changes the rig's shape, and the
   * keyboard you spent an hour on would come back as a different one.  The
   * slot is the corner it stands in, so a device keeps its layout through
   * every toggle: turn stacking off and on again and the upper manual is
   * still the upper manual. */
  const rigSlot = (col, row) => col + 2 * row;
  const rigSlotCol = slot => slot & 1;
  const rigSlotRow = slot => (slot >> 1) & 1;
  /** The four corners, in the order the rig lists them. */
  const RIG_SLOTS = [0, 1, 2, 3];

  /* ------------------------------------------------------------------ *
   *  WHAT A UNIT'S KEYS ARE CALLED — the default, and the override        *
   *                                                                      *
   *  Every mapping here is the same shape, and there is only one:         *
   *                                                                      *
   *      note(i) = base + step * i                                        *
   *                                                                      *
   *  `step` is how far one key of this device moves the rig, and `base`   *
   *  is what its key 0 is called.  The two defaults are the two readings  *
   *  the geometry already implies:                                        *
   *                                                                      *
   *    step = rows.  One row and a key is one note — the plain reading.   *
   *      Two rows and every key of every device counts double, which is   *
   *      what leaves the odd notes free for the device above to fall      *
   *      into.  This is the INTERCHANGE: stacking does not add register,  *
   *      it divides the register already there more finely.               *
   *                                                                      *
   *    base = rows * 32 * col + row.  Along x, 32 notes per column, so    *
   *      the right-hand device CONTINUES the left in register — times     *
   *      rows, so the continuation is stated in the rig's own steps and   *
   *      not in the lower device's.  Up the stack, + row, which is the    *
   *      one-note lift that lands the upper device between the lower      *
   *      device's steps.                                                  *
   *                                                                      *
   *  A device may state either number for itself instead, on its own      *
   *  design as `noteBase` / `noteStep`.  That is the whole of the         *
   *  override: two integers, in the same terms the default is written in, *
   *  so a hand-set rig is the same kind of object as an automatic one and *
   *  nothing downstream has to know which it is looking at.               *
   * ------------------------------------------------------------------ */

  /** How far one key of this device moves the rig. Never 0 — that would
   *  give all 32 keys of the device the same note. */
  function rigStep(u, d) {
    const s = d && d.noteStep;
    return (Number.isFinite(s) && (s | 0) !== 0) ? (s | 0) : u.rows;
  }

  /** What this device's key 0 is called in the rig. */
  function rigBase(u, d) {
    const b = d && d.noteBase;
    return Number.isFinite(b) ? (b | 0) : u.rows * NOTES * u.col + u.row;
  }

  /** Whether either number has been stated by hand rather than read off. */
  function rigNoteAuto(u, d) {
    return !(d && (Number.isFinite(d.noteBase) || Number.isFinite(d.noteStep)));
  }

  /** The note unit `u`'s key `i` carries — see above. */
  function rigNote(u, i, d) {
    return rigBase(u, d) + rigStep(u, d) * i;
  }

  /** What to call a unit out loud. */
  function rigLabel(u) {
    if (u.rows === 1 && u.cols === 1) return 'the keyboard';
    const v = u.rows > 1 ? (u.row ? 'upper' : 'lower') : '';
    const h = u.cols > 1 ? (u.col ? 'right' : 'left') : '';
    return (v && h) ? `${v} ${h}` : (v || h);
  }

  /* ==================================================================== *
   *  EXPORT                                                              *
   * ==================================================================== */
  const api = {
    WORLD, SPINE, FOOT, SIZE, Z, COLORS, DRAFT, WALL, TONGUE_Y,
    BACK_REACH, BACK_Y, backReach,
    NOTES, UNITS, FEET_PER_HALF,
    RIG, rigConfig, rigCols, rigRows, rigCount, rigPitchX, rigUnits,
    rigNote, rigLabel, rigSlot, rigSlotCol, rigSlotRow, RIG_SLOTS,
    rigStep, rigBase, rigNoteAuto,
    KEY_TYPES, TYPE_ORDER, LAYOUTS,
    whiteProfile, twoSidedWhiteBase, deriveWhiteProfile, akm320Nose, whiteBackWall,
    whiteFlushTongue, onFlushTongue, WHITE_RISE, whiteRoofDrop, ROOF_DROP,
    NOSE_SHIFT, NOSE_LEG_RAMP, NOSE_LEG_REAR, NOSE_LEG_IN, NOSE_LEG_OUT,
    NOSE_ROOF_Z, NOSE_FLOOR_Z,
    KEY_PAIRS, PAIR_ORDER, PALETTE_ORDER, TYPE_ALIASES,
    canonType, pairOfType, pairOfSlot,
    isLaneSlot, layLanes, fitLaneSpan, laneScaleId,
    LANE_BUFFER, WHITE_CLEAR, rearBack,
    midSplit, MID_ROLE,
    MIN_REAR,
    whiteWidth, whitePitch, accWidth, slotDelta,
    WIDTH_CLASSES, CLASS_LABEL, WIDTH_RATIO_DEFAULT, ACC_RATIO,
    WIDTH_RATIO_MIN, WIDTH_RATIO_MAX, ACC_RATIO_MAX, accCeiling, whiteFloor,
    KEY_SCALE_MIN, KEY_SCALE_MAX, whiteScaleId, slotScaleId,
    keyScale, keyScaleCount,
    widthRatios, classWidth, classOfType,
    pushTri, pushQuad, pushBox, pushXPrism, pushRootFillet, rectWithHoles,
    ctxKey, profileFor, profilePoints, buildKey, keyPolygons,
    bevelProfile, bevelRoom, setBevel, getBevel, BEVEL_MAX, topFaces,
    triangulateFace, triangulateFaceWithHoles, pointInPoly2, faceHoldsSeat,
    keyDecks, mergeCoplanar, polyArea2, keyExtent,
    buildSpine,
    PAIR, FOOT_SHAPE,
    /* --- shims, so a page written against the old attaching-element API
     * keeps loading.  There are no attaching elements any more: the
     * builders return nothing and BRIDGE/bridgeAudit are PAIR/pairAudit
     * under their old names.  Prefer the PAIR names in new code. --- */
    BRIDGE: PAIR, bridgeAudit: pairAudit,
    bridgeSeats: () => [], buildBridge: () => [], footOutline, footIslands,
    keyBackSpan, keyPadSection, weldTJunctions, meshChecksum,
    pairPlan, pairFaces, pairLand, pairAudit, PAIR_SHAPE,
    mapRingToPair, buildPress, pressParts, pushPrism, isWatertight, meshVolume,
    armLines, armSpan, armPlace, armPlaceFor, pressArms, ARM_SHOULDER,
    spineKindOf, spineKindForColours, spineLayerCount,
    SPINE_LAYER_COLORS, spineLayerColor, spineLayerMaterial,
    SPINE_LAYER_PART, spineLayerPart,
    spineHalves, spineParts, spineBands, spineZRange, tongueLaps,
    RIBBON, spineHalfSpan, clipTongueX,
    FIT,
    footCentres, obroundRing, spineHoles, holeBoxPoint, HOLE_UNIT,
    pushHoleAnnulus, pushHoleWall, pushHoleOuterWall, holeBoxLoop, pushSpineSlab,
    toWorld: (x, y, z) => [x + WORLD.x0, WORLD.y0 - y, z + WORLD.z0]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (typeof window !== 'undefined' ? window : globalThis).XM = api;
})();
