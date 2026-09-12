/* =========================================================================
 * Keyboard Designer — DESIGN CORE
 *
 * Layout engine, mesh assembly, STL / ZIP export and the Blender Python log.
 * All geometry and sizing comes from model.js (XM), which is measured out of
 * Cimbalo_Cromatico_Drafting_Sandbox_Leveling.blend.
 *
 * THE INSTRUMENT IS FIXED AT 32 KEYS.  One AKM320: spine half A + half B,
 * 16 sensor feet on each, 32 feet in total, one key per foot, never more.
 * The white-key count is therefore DERIVED from the pattern, not chosen.
 *
 * A design is:
 *   scale      the size number s — every width is linear in it
 *   rotation   which of the seven period slots white #0 starts on
 *   template   7 entries, each null or an array of key-type names
 *   overrides  per-absolute-slot replacements  { slotIndex: names|null }
 * ========================================================================= */
(function () {
  'use strict';
  const XM = (typeof module !== 'undefined' && module.exports)
    ? require('./model.js')
    : (typeof window !== 'undefined' ? window : globalThis).XM;

  /* ------------------------------------------------------------------ *
   *  LAYOUT                                                             *
   * ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ *
   *  A DESIGN IS 32 KEYS, NOT A REPEATING PERIOD                        *
   *                                                                     *
   *  There is no pattern to edit any more.  A design is the cleared     *
   *  keyboard — 32 identical white keys, narrow enough that all 32 fit  *
   *  inside the A + B spine — plus whatever the user has since dropped  *
   *  into the gaps BETWEEN them, gap by gap, in `slots`.                *
   *                                                                     *
   *  Because the instrument is one AKM320 the note count never moves:   *
   *  dropping a pair into a gap adds two notes, so two whites fall off  *
   *  the right-hand end, and every remaining key widens to take up the  *
   *  slack.  That is the whole interaction — insert, and the keyboard   *
   *  re-proportions itself around what you inserted.                    *
   *                                                                     *
   *  `template` survives only as an all-null array so the layout walker *
   *  below keeps one code path; nothing writes to it.                   *
   * ------------------------------------------------------------------ */
  const EMPTY_TEMPLATE = () => [null, null, null, null, null, null, null];

  /** the cleared keyboard: 32 parallel whites, auto-sized to the spine */
  function clearedDesign(rotation) {
    return {
      rotation: ((rotation | 0) % 7 + 7) % 7,
      template: EMPTY_TEMPLATE(),
      slots: {},
      autoScale: true,
      scale: null,
      preset: null
    };
  }

  /**
   * A drafted sheet, STAMPED OUT.  The 15 / 17 / 19 layouts are written as
   * a seven-slot period; here that period is expanded into the individual
   * gaps it fills across the whole 32-note keyboard, so the result is an
   * ordinary hand-editable design with no pattern behind it.
   */
  function presetDesign(edo) {
    const L = XM.LAYOUTS[edo];
    if (!L) throw new Error('no drafted layout for ' + edo);
    const d = clearedDesign(L.rotation || 0);
    /* walk the same way computeLayout does, so the expansion stops where
     * the 32nd note does and no gap is written that the sheet never reaches */
    const rot = d.rotation;
    let placed = 0;
    for (let i = 0; placed < XM.NOTES; i++) {
      placed++;                                   // white i
      if (placed >= XM.NOTES) break;
      const names = L.slots[(i + rot) % 7];
      if (!names || !names.length) continue;
      const keep = names.slice(0, XM.NOTES - placed).map(XM.canonType);
      if (!keep.length) break;
      d.slots[i] = keep;
      placed += keep.length;
    }
    d.preset = String(edo);
    return d;
  }

  /**
   * THE SIZE IS NOT A CHOICE.  Every horizontal dimension is linear in s,
   * and the one thing s has to satisfy is that the 32 keys end exactly at
   * the end of spine half B.  So s is solved for, not typed: whenever the
   * design changes, the keys re-proportion themselves to the spine they
   * are standing on.  A design may still pin `scale` and set
   * `autoScale: false` to work deliberately off-spine.
   */
  /** the break the design asks for, in mm, inside what the slider allows;
   *  each key is then held to its own wall — see XM.bevelRoom */
  function bevelOf(design) {
    const b = +(design && design.bevel) || 0;
    return Math.min(XM.BEVEL_MAX, Math.max(0, b));
  }

  function scaleOf(design) {
    if (design.autoScale === false && design.scale) return design.scale;
    return fitScale(design);
  }

  /** the true x reach of every key as it will actually be built */
  function keyboardExtent(whites, slots) {
    let x0 = Infinity, x1 = -Infinity;
    const eat = e => { if (e.x0 < x0) x0 = e.x0; if (e.x1 > x1) x1 = e.x1; };
    for (const w of whites)
      eat(XM.keyExtent(w.cx, w.w, w.type, w.ctxL, w.ctxR));
    for (const sl of slots) for (const m of sl.members)
      eat(XM.keyExtent(m.cx, m.w, m.type, null, null));
    return isFinite(x0) ? { x0, x1 } : { x0: 0, x1: 0 };
  }

  /** slide the whole keyboard along x — keys only; the feet never move */
  function shiftLayout(whites, slots, notes, dx) {
    for (const w of whites) {
      w.x0 += dx; w.x1 += dx; w.cx += dx;
      if (w.shL != null) w.shL += dx;
      if (w.shR != null) w.shR += dx;
    }
    for (const sl of slots) {
      sl.cx += dx; sl.x0 += dx; sl.x1 += dx;
      for (const m of sl.members) { m.cx += dx; m.x0 += dx; m.x1 += dx; }
    }
    for (const n of (notes || [])) n.cx += dx;
  }

  /**
   * SOLVE THE SIZE AGAINST THE SPINE.
   *
   * Every x in the design is `alpha + beta * s`, so the keyboard's measured
   * extent is affine in s and two probes pin it exactly.  The target is the
   * spine's own length — half A's left edge to half B's right edge — so the
   * keys come out flush with the spine at both ends instead of being sized
   * on white pitch, which ignores both the last gap's accidental and the
   * rear tails that reach outside their own pitch.
   */
  function fitScale(design) {
    const target = XM.SPINE.halfB.x1 - XM.SPINE.halfA.x0;
    const span = s => { const L = layoutSpan(design, s); return L.x1 - L.x0; };
    const s1 = 12, s2 = 24;
    const w1 = span(s1), w2 = span(s2);
    const b = (w2 - w1) / (s2 - s1);
    if (!isFinite(b) || Math.abs(b) < 1e-9) return design.scale || 19;
    const a = w1 - b * s1;
    let s = Math.max(1, (target - a) / b);

    /* TWO PROBES PIN IT ONLY WHILE ONE KEY STAYS THE EXTREME ONE.
     *
     * Every x is affine in s, so the extent is a MAXIMUM of affine
     * functions — one per key — and that is only itself affine while the
     * same key is winning it.  For every keyboard the sheets draw, it is:
     * the two probes and the solve are exact, and the loop below sees the
     * answer is already right and returns it untouched.
     *
     * Put a lone Split Black in an end gap on a cleared 32-white keyboard
     * and it stops being true.  That key is shallow and narrow, the white
     * beside it grows out over it, and which of the two reaches furthest
     * swaps over somewhere between the probes and the answer — so the
     * solve landed on the wrong straight line and the keyboard came out
     * 0.8 mm long.  Where that happens the secant below walks onto the
     * right one; it costs one extra layout on the designs that never
     * needed it, and it does not move their answer by a bit.          */
    for (let it = 0; it < 40 && Math.abs(span(s) - target) > 1e-9; it++) {
      const t = s * 1.001 + 1e-3;
      const ws = span(s), k = (span(t) - ws) / (t - s);
      if (!isFinite(k) || Math.abs(k) < 1e-9) break;
      const next = Math.max(1, s + (target - ws) / k);
      if (!isFinite(next)) break;
      const done = Math.abs(next - s) < 1e-12;
      s = next;
      if (done) break;
    }
    return s;
  }

  /** how many notes one seven-white period holds */
  function notesPerPeriod(template) {
    return XM.SIZE.whitesPerPeriod +
      template.reduce((n, s) => n + (s ? s.length : 0), 0);
  }

  /** the layer stack a design needs: white + whichever accidental layers are used */
  function layerCount(template, overrides) {
    return XM.spineLayerCount(
      XM.spineKindForColours(templateColours(template, overrides)));
  }

  /** the colours a template *asks* for — a quick answer for the palette UI.
   *  The spine a design actually gets is decided by the keys it places, in
   *  computeLayout below, because the 32-note limit can cut a slot off. */
  function templateColours(template, overrides) {
    const used = new Set(['white']);
    const scan = s => { if (s) for (const n of s) {
      const spec = XM.KEY_TYPES[XM.canonType(n)];
      if (spec) used.add(spec.layer);
    } };
    (template || []).forEach(scan);
    Object.values(overrides || {}).forEach(scan);
    return used;
  }

  /** the colours a whole design places — the same scan over its own slots */
  function designColours(design) {
    return templateColours(design.template, design.slots || design.overrides);
  }

  /**
   * What sits in the gap after white `i`, canonical and de-aliased.
   * `slots` is the live map; `overrides` and `template` are read as a
   * fallback so a design saved before the rebuild still opens.
   */
  function slotAt(design, i, rot) {
    const src = design.slots || design.overrides || {};
    let names = Object.prototype.hasOwnProperty.call(src, i) ? src[i] : undefined;
    /* gap -1 is the one before white 0.  A seven-slot template describes a
     * repeating period BETWEEN whites and has nothing to say about it, so
     * the fallback is skipped rather than wrapped round to slot 6. */
    if (names === undefined && i >= 0 && design.template)
      names = design.template[(i + rot) % 7];
    if (!names) return null;
    const out = names.map(XM.canonType).filter(n => XM.KEY_TYPES[n]);
    return out.length ? out : null;
  }

  /** the keyboard's measured span at a given s — the probe fitScale uses */
  function layoutSpan(design, s) {
    const L = computeLayout(design, s);
    return { x0: 0, x1: L.width };
  }

  function computeLayout(design, forceS) {
    const s = forceS != null ? forceS : scaleOf(design);
    /* WIDTH IS A PROPERTY OF THE CLASS.  Each of the four carries a ratio
     * of the white's width; the white's own ratio scales the pitch with
     * it, so widening one class narrows the others once the size solve
     * refits the whole thing to the spine.                             */
    const ratios = XM.widthRatios(design);
    const cw = c => XM.classWidth(c, s, ratios);
    const wW = cw('white'), wP = wW + XM.SIZE.whiteGap;
    const aW = cw('split'), delta = XM.slotDelta(s);
    /* HOW FAR THE PLAYING EDGE IS BROKEN, at these widths.  The bevel is a
     * property of the design and it is set HERE, once, because everything
     * downstream reads it off the profile — the preview, the STLs and the
     * Blender log alike.  It is held under a share of the narrowest class
     * so that a thin split key keeps a playing surface between its two
     * chamfers; the break costs the keyboard nothing else, because it adds
     * no vertex outside the drafted silhouette and so leaves every width,
     * every clearance and the size solve itself exactly as they were.
     *
     * This is the ASK.  What each key is finally cut at is its own wall's
     * business — model.js holds every profile to what it can carry without
     * the wall under its arris doubling back (bevelRoom) — so the range the
     * keyboard actually came out at is read back off the built profiles
     * below rather than assumed from the number set here. */
    const bevel = XM.setBevel(Math.min(bevelOf(design),
      0.35 * Math.min(cw('white'), cw('black'), cw('gray'), cw('split'))));
    const warnings = [];
    const rot = ((design.rotation | 0) % 7 + 7) % 7;

    /* ------------------------------------------------------------------
     * The instrument is one AKM320: 32 sensor feet, therefore EXACTLY 32
     * keys.  White keys are not a free parameter — they fall out of the
     * pattern.  Lay notes down left to right (white i, then slot i, then
     * white i+1, ...) and stop the moment the 32nd note is placed.
     *
     * That order is already sorted in x: a slot centre is
     *   white_i.cx + pitch/2 + bias·δ,
     * and |bias·δ| ≤ s/6 < pitch/2, so every slot lands strictly between
     * its two whites.
     * ------------------------------------------------------------------ */
    const NOTES = XM.NOTES;
    const whites = [], slots = [];
    let placed = 0, cut = null;

    /* ------------------------------------------------------------------ *
     *  WHAT A GAP OCCUPIES, AND WHAT IT KEEPS FROM THE WHITES             *
     *                                                                     *
     *  `x0`/`x1` are the gap's real outer edges — not `cx +/- w/2`, which  *
     *  stopped being the same thing the moment two keys of different      *
     *  widths could stand in one gap on a seam anchored to its centre.     *
     *                                                                     *
     *  `clear` is the air the gap keeps from the white rears either side —  *
     *  half a white gap, the same for every gap, because every one of      *
     *  them holds a key that travels past those rears when it is played.   *
     *  Two keys standing side by side in one gap keep a WHOLE white gap    *
     *  from each other, since neither of them is let into anything: see    *
     *  LANE_BUFFER and WHITE_CLEAR in model.js.                            *
     * ------------------------------------------------------------------ */
    const gapOf = (i, period, cx, names, members, lanes, end) => {
      const clear = XM.WHITE_CLEAR;
      let x0, x1, w;
      if (lanes) { const s = XM.layLanes(members, cx); x0 = s.x0; x1 = s.x1; w = s.w; }
      else {
        w = members.reduce((m, k) => Math.max(m, k.w), 0) || aW;
        x0 = cx - w / 2; x1 = cx + w / 2;
      }
      return { i, period, cx, x0, x1, w, clear, lanes,
               names: names && names.length ? names.slice() : null, members,
               truncated: members.length < (names || []).length,
               end: !!end, placed: true };
    };

    /* ---- A KEYBOARD MAY BEGIN ON AN ACCIDENTAL ----
     * Gap -1 is the gap BEFORE white 0.  Like the gap after the last white
     * it has a white on one side only, and its keys are notes like any
     * others — so they are counted here, before the whites are laid down,
     * and the 32-note limit takes whites off the right-hand end to pay for
     * them exactly as it does for a gap in the middle.  The geometry waits
     * until white 0 exists to be measured from.  At least one white has to
     * survive for the gap to stand beside, hence NOTES - 1.           */
    const leadWanted = (slotAt(design, -1, rot) || []).slice(0, NOTES - 1);
    placed += leadWanted.length;

    /* THE PITCH IS STILL A PITCH, PLUS WHAT RESIZING HAS PUSHED.  Every
     * white used to sit at i * wP because every white was the same width;
     * a design may now say that THIS white is wider than the law, so each
     * one sits at i * wP plus the drift its resized predecessors have
     * accumulated.  Written this way rather than as a running cursor so a
     * keyboard nobody has resized keeps drift at exactly zero and lands on
     * i * wP to the last bit — the drafted profiles are looked up on the
     * key's own numbers, and a one-ulp wobble in x is not free.        */
    let drift = 0;
    for (let i = 0; placed < NOTES; i++) {
      const wp = (i + rot) % 7;
      const ww = wW * XM.keyScale(design, XM.whiteScaleId(i));
      const x0 = i * wP + drift;
      whites.push({
        i, x0, x1: x0 + ww, cx: x0 + ww / 2, w: ww,
        period: wp, type: 'Full Sized White'
      });
      drift += ww - wW;
      placed++;
      if (placed >= NOTES) break;

      const p = (i + rot) % 7;
      const names = slotAt(design, i, rot);
      const wanted = names || [];
      const laneHere = XM.isLaneSlot(names);
      if (!wanted.length) {
        slots.push(gapOf(i, p, whites[i].cx + (whites[i].w + XM.SIZE.whiteGap) / 2,
                         names, [], false));
        continue;
      }

      /* the plain midpoint between its two whites — no lean, see model.js.
       * Measured off this white's own width rather than the class pitch,
       * so it stays the midpoint when the whites are not all one size. */
      const cx = whites[i].cx + (whites[i].w + XM.SIZE.whiteGap) / 2;
      const members = [];
      for (let k = 0; k < wanted.length && placed < NOTES; k++) {
        const spec = XM.KEY_TYPES[wanted[k]];
        if (!spec) throw new Error('unknown key type: ' + wanted[k]);
        /* BOTH HALVES OF A SPLIT SHARE THE GAP, so they share its width
         * and therefore its hand-set multiplier.  TWO KEYS IN LANES DO
         * NOT: they are two keys that happen to share a gap, so each
         * carries its own multiplier ON TOP of the gap's — the gap grip
         * scales the pair, the lane grip scales one lane, exactly as a
         * class ratio and a per-key scale compose everywhere else. */
        const mw = cw(spec.widthClass) * XM.keyScale(design, XM.slotScaleId(i))
                 * (laneHere ? XM.keyScale(design, XM.laneScaleId(i, k)) : 1);
        members.push({
          type: wanted[k], spec, cx, w: mw, cls: spec.widthClass,
          x0: cx - mw / 2, x1: cx + mw / 2, slot: i, ord: k
        });
        placed++;
      }
      if (members.length < wanted.length) cut = { slot: i, kept: members.length, wanted: wanted.length };
      /* Only a WHOLE pair stands in lanes — if the 32-note limit cut the
       * gap off after one key, what is left is a single key on the centre. */
      const lanes = laneHere && members.length === wanted.length;
      slots.push(gapOf(i, p, cx, names, members, lanes));
    }
    /* ---- THE TWO END GAPS ----
     * Every gap between two whites is already here, the empty ones
     * included, because an empty gap is where the next key gets dropped.
     * The ends are gaps too — one before white 0, one after the last white
     * — and they are the only two the walk cannot produce, so they are put
     * in by hand.  Until something is dropped into them they are the two
     * empty targets at the ends of the strip; once something is, the
     * keyboard begins or finishes on an accidental.                   */
    const endGap = (i, cx, names, wanted) => {
      const members = [];
      for (let k = 0; k < wanted.length; k++) {
        const spec = XM.KEY_TYPES[wanted[k]];
        if (!spec) throw new Error('unknown key type: ' + wanted[k]);
        const mw = cw(spec.widthClass) * XM.keyScale(design, XM.slotScaleId(i))
                 * (XM.isLaneSlot(names) ? XM.keyScale(design, XM.laneScaleId(i, k)) : 1);
        members.push({
          type: wanted[k], spec, cx, w: mw, cls: spec.widthClass,
          x0: cx - mw / 2, x1: cx + mw / 2, slot: i, ord: k
        });
      }
      const lanes = XM.isLaneSlot(names) && members.length === wanted.length;
      return gapOf(i, ((i % 7) + 7 + rot) % 7, cx, names, members, lanes, true);
    };
    if (whites.length) {
      const w0 = whites[0], wL = whites[whites.length - 1];
      slots.unshift(endGap(-1, w0.x0 - XM.SIZE.whiteGap / 2,
                           leadWanted, leadWanted));
      if (!slots.some(sl => sl.i === wL.i))
        slots.push(endGap(wL.i, wL.cx + (wL.w + XM.SIZE.whiteGap) / 2, null, []));
      else slots[slots.length - 1].end = true;
    }
    /* gap index -> gap.  It used to be enough that `slots[i]` WAS gap i,
     * which stopped being true the moment a gap could sit before white 0. */
    const slotOf = new Map(slots.map(sl => [sl.i, sl]));

    /* ---- the accidental ceiling, applied gap by gap ----
     * ACC_RATIO_MAX says an accidental may not be wider than 0.86x the
     * white it stands beside: past that the white has no rear left to cut
     * away for it, and no inset can clear it.  widthRatios enforces that
     * for the CLASS against the class white; once a design resizes single
     * keys the statement has to be made about the two whites this gap
     * actually stands between, and the narrower of them is the binding
     * one.  This is a limit, not a warning — the gap simply stops there.
     *
     * AN END GAP IS PAID FOR BY ONE WHITE ALONE.  An interior gap is
     * straddled, so each of its two whites gives up half of it and the
     * 0.86 ceiling is what makes those two halves add up to the whole rear
     * a white can spare.  At an end there is no second white: the one
     * beside it stands under the entire accidental and gives up its full
     * width plus the half gap, so the same "half the rear per gap" law
     * solves to a lower ceiling.  See endRatio below for where the
     * (a + g/2) / W it is solving comes from.                         */
    const ROOM = XM.ACC_RATIO_MAX / 2;      // what one gap may take of a rear
    const back = XM.rearBack();             // what the white gap already gives
    for (const sl of slots) {
      if (!sl.members.length) continue;
      const a = whites[sl.i], b = whites[sl.i + 1];
      let lim;
      if (a && b) lim = XM.ACC_RATIO_MAX * Math.min(a.w, b.w);
      else {
        const w = (a || b).w, g = XM.SIZE.whiteGap;
        lim = (ROOM * w + g * (ROOM - 1) / 2) / (1 - ROOM / 2);
      }
      /* THE CEILING IS ON THE GAP, NOT ON THE KEY.  What it bounds is how
       * much rear the whites give up, and that is the gap's whole width
       * PLUS the air it keeps from them — 0.75 mm a side rather than the
       * shadow line the ceiling was first written against.  For two keys
       * in lanes the seam between them is in that bill too.  Clamping the
       * lanes one at a time would let two keys each pass the test and
       * still, together, take more rear than exists, so they are squeezed
       * in proportion and `squeezed` says from what.                  */
      if (isFinite(lim) && lim > 0) {
        if (sl.lanes) {
          const air = XM.LANE_BUFFER + 2 * (sl.clear - XM.FIT.gap);
          /* NO LANE MAY REACH PAST ITS WHITE'S CENTRELINE.  A key centred
           * in its gap never can — the 0.86 ceiling puts its far edge at
           * 0.43 of a white from the gap centre, and the white's centre
           * is half a white plus half the white gap away.  A key standing
           * in ONE LANE starts from the seam instead, so a wide one can
           * cross the centreline of the white it overhangs, where that
           * white's central rib is pinned.  Solving the rear inset for
           * h = 1/2 gives each lane its own ceiling.  An END gap needs
           * none: its white gives up at most ROOM = 0.43, which is inside
           * the half by construction.                                 */
          if (a && b) {
            const cap = q => Math.max(0, 0.5 * q.w - back - sl.clear);
            const caps = [cap(a), cap(b)];
            for (let k = 0; k < sl.members.length; k++)
              if (sl.members[k].w > caps[k] + 1e-9) {
                sl.capped = true; sl.members[k].w = caps[k];
              }
          }
          const solid0 = sl.members.reduce((n, m) => n + m.w, 0);
          let want = solid0;
          if (a && b) {
            if (solid0 + air > lim + 1e-9) want = Math.max(0, lim - air);
          } else {
            /* AN END GAP IS PAID FOR BY ONE WHITE THAT GROWS TO COVER IT,
             * so how much rear it costs depends on how wide it is — the
             * closed form the single-key path uses is written for a gap
             * symmetric about its centre keeping FIT.gap, and a lane pair
             * is neither.  Solved by bisection on the same condition
             * instead, which needs no algebra to be right: lay the lanes,
             * grow the white, read h, halve the interval.            */
            const w = (a || b), fixed = sl.i === -1 ? w.x1 : w.x0;
            const hAt = t => {
              const k = solid0 > 0 ? t / solid0 : 0;
              const ws = sl.members.map(m => m.w * k);
              const span = ws.reduce((n, v) => n + v, 0) + XM.LANE_BUFFER;
              const x0 = sl.cx - XM.LANE_BUFFER / 2 - ws[0];
              const x1 = x0 + span;
              const grown = sl.i === -1 ? fixed - Math.min(x0, w.x0)
                                        : Math.max(x1, w.x1) - fixed;
              return (span + back + sl.clear) / grown;
            };
            if (hAt(solid0) > ROOM) {
              let lo = 0, hi = solid0;
              for (let n = 0; n < 60; n++) {
                const mid = (lo + hi) / 2;
                if (hAt(mid) > ROOM) hi = mid; else lo = mid;
              }
              want = lo;
            }
          }
          if (sl.capped || want < solid0 - 1e-9) {
            if (want < solid0 - 1e-9) sl.squeezed = sl.w;
            const sp = XM.fitLaneSpan(sl.members, sl.cx, want + air, air);
            sl.x0 = sp.x0; sl.x1 = sp.x1; sl.w = sp.w;
          }
        } else {
          /* the same accounting for a gap holding one key, or two on one
           * centre: what it costs the whites is its width PLUS the air it
           * keeps from them, which is no longer the shadow line it was */
          const solo = Math.max(0, lim - 2 * (sl.clear - XM.FIT.gap));
          for (const m of sl.members) if (m.w > solo) {
            m.w = solo; m.x0 = m.cx - solo / 2; m.x1 = m.cx + solo / 2;
          }
        }
      }
      if (!sl.lanes) {
        sl.w = sl.members.reduce((n, k) => Math.max(n, k.w), 0) || aW;
        sl.x0 = sl.cx - sl.w / 2; sl.x1 = sl.cx + sl.w / 2;
      }
    }

    /* ---- THE WHITE BESIDE AN END GAP REACHES OUT UNDER IT ----
     * An accidental between two whites has their two fronts meeting
     * beneath it, so the keyboard reads as continuous deck with the
     * accidental standing on it.  One at an END has nothing on its outer
     * side, and the keyboard finishes on a key with bare mount beside it.
     *
     * The accidental keeps its place in the pitch — moving it would break
     * the spacing it shares with every other accidental — and the WHITE
     * grows outward to its outer edge instead, which is precisely the job
     * the two whites either side of an interior gap do between them.  The
     * white's x on the inner side does not move, so nothing else in the
     * row shifts; the size solve refits the small amount it added.    */
    for (const sl of slots) {
      if (!sl.members.length) continue;
      const w = sl.i === -1 ? whites[0]
              : sl.i === whites.length - 1 ? whites[sl.i] : null;
      if (!w) continue;
      /* out to the gap's REAL outer edge.  It used to be written as a
       * grow of whiteGap/2 + w/2 from the white's own edge, which is the
       * same number only while the gap is symmetric about its centre —
       * and a lane pair of two different widths is not. */
      if (sl.i === -1) { w.x0 = Math.min(w.x0, sl.x0); w.endL = true; }
      else             { w.x1 = Math.max(w.x1, sl.x1); w.endR = true; }
      w.w = w.x1 - w.x0; w.cx = (w.x0 + w.x1) / 2;
    }

    /* ---- neighbour context + the clearance the accidentals cut out ----
     * A white's rear is derived from what actually stands beside it: the
     * context is HALF the neighbouring gap's width AS A RATIO OF THIS
     * WHITE'S OWN WIDTH, or null for an empty gap.  With one accidental
     * width that was the same number everywhere; now a white beside a wide
     * split and a narrow black is cut back further on the split side.
     *
     * IT IS THIS WHITE'S WIDTH THE RATIO IS AGAINST, NOT THE CLASS'S.
     * deriveWhiteProfile places the rear edge at (1 - half) * w, so the
     * inset it cuts is `half * w` — measured on the key being built.  Take
     * the ratio against the class white instead and the two only agree
     * while every white IS the class width: a white widened by hand gets
     * an inset scaled up with it and pulls its rear away from the
     * accidental, leaving the gap open; a narrowed one gets too little and
     * its rear runs into the accidental's side.  Against its own width the
     * inset lands on the accidental's edge less the air that gap keeps, at
     * any size.                                                         */
    /* THE CONTEXT IS A WIDTH AND A DEPTH.  How much of this white's width
     * the gap takes decides how far its rear is cut back; how deep the
     * deepest key in that gap reaches decides how far FORWARD the cut
     * runs.  Passing only the width made every white give up its rear all
     * the way to the drafted plane, which is the front of a deep
     * accidental — so a white beside a Full Sized Gray, 10 mm shallower,
     * was cut back past where the gray ends and left bare mount showing
     * in front of it.  See stepPlanes in model.js.                    */
    /* HOW FAR FORWARD THE CUT RUNS IS A QUESTION ABOUT THIS WHITE.
     *
     * The step plane clears the key standing beside the white, so the
     * depth that sets it is the depth of what the white's full-width
     * front would actually run into.  While every gap held one key, or
     * two on one centre, that was simply the deepest thing in the gap:
     * a split pair's gray and black both overhang both whites.
     *
     * Two keys in LANES do not.  A white faces the lane on its own side,
     * and the far lane may stand entirely past the white's own edge — so
     * taking the gap's deepest key cut the white back to the BLACK's
     * front even on the side where only the shallower GRAY stands, and
     * left an 11.5 mm notch of bare mount in front of the gray, which is
     * the very thing STEP_Y_FLOOR exists to avoid elsewhere.
     *
     * So the depth is measured over the members this white can actually
     * reach: those whose x overlaps the white's own span, plus the air
     * that gap keeps, either side.  A far lane that clears the white's
     * edge does not hold its step back; one that does not clear it still
     * does.  For every gap that is not in lanes every member overlaps, so
     * this is the old maximum exactly and no drafted layout moves.    */
    const depthOf = (sl, w) => sl.members.reduce((d, k) =>
      (!w || (k.x0 - sl.clear < w.x1 && k.x1 + sl.clear > w.x0))
        ? Math.max(d, k.spec.depth) : d, 0);
    /* ONE FORMULA, NOT THREE.  deriveWhiteProfile places the rear edge at
     * `back + (1 - h) * w` from the key's own edge, where
     * `back = whiteGap/2 - FIT.gap` is the clearance an interior gap
     * already provides on its own.  So instead of a ratio per situation —
     * half the gap for an interior white, the whole of it plus half the
     * white gap for an end one — INVERT that placement against where the
     * rear actually has to land: the gap's own edge, less the air that
     * gap keeps.  Solved for h it is
     *
     *     h = (whiteEdge - gapEdge + back + clear) / whiteWidth
     *
     * which reproduces the old halfRatio and endRatio EXACTLY where they
     * applied, and keeps working where neither did: a gap whose two keys
     * are different widths, so it is not symmetric about its centre, and
     * a gap that keeps half a white gap from the rears instead of the
     * shadow line the drafted whites were captured with.              */
    const hFacing = (sl, w, side) => (side < 0
        ? (sl.x1 - w.x0)          // the gap is on this white's LEFT
        : (w.x1 - sl.x0))         // ... or on its RIGHT
      + back + sl.clear;
    /* AND WHERE ONE WHITE FACES TWO DEPTHS, THE BAND BETWEEN THEM.  Only
     * an END gap can put a white in that position: everywhere else the
     * white reaches to its own edge, which with a 1.5 mm seam lands
     * exactly on the near lane's inner edge, so the far lane is out of
     * its way and depthOf answers with the one it actually faces.  At an
     * end the white grows out under BOTH, and the band the shallower key
     * vacates is reachable only when the DEEPER key is the outer one —
     * otherwise it is an island behind the deep key and the rear cannot
     * get to it.  computeLayout warns rather than drawing a lie.      */
    const midOf = (sl, w, side) => {
      if (!sl || !sl.lanes || !(side < 0 ? w.endL : w.endR)) return null;
      const outer = side < 0 ? sl.members[0] : sl.members[1];
      const inner = side < 0 ? sl.members[1] : sl.members[0];
      if (outer.spec.depth <= inner.spec.depth + 1e-9) return null;
      const band = { x0: outer.x0, x1: outer.x1, clear: sl.clear };
      return { d: inner.spec.depth, h: hFacing(band, w, side) / w.w };
    };
    const ctxOf = (sl, w, side) => (sl && sl.members.length)
      ? { h: hFacing(sl, w, side) / w.w, d: depthOf(sl, w),
          mid: midOf(sl, w, side) }
      : null;
    for (const w of whites) {
      const gl = slotOf.get(w.i - 1), gr = slotOf.get(w.i);
      w.ctxL = ctxOf(gl, w, -1);
      w.ctxR = ctxOf(gr, w, +1);
      w.profileExact = XM.profileFor(w.type, w.ctxL, w.ctxR).exact;
      w.shL = w.x0;
      w.shR = w.x1;
      if (gl && gl.members.length) w.shL = Math.max(w.shL, gl.x1 + back);
      if (gr && gr.members.length) w.shR = Math.min(w.shR, gr.x0 - back);
      if (w.shR - w.shL < 6) warnings.push(
        `White ${w.i}: mid-section only ${(w.shR - w.shL).toFixed(2)} mm wide.`);
    }

    /* ---- validity checks ---- */
    for (const sl of slots) {
      if (sl.members.length > 2) warnings.push(
        `Gap ${sl.i} holds ${sl.members.length} keys — a gap takes at most two.`);
      /* A GAP HOLDING TWO KEYS IS ONE OF EXACTLY TWO ARRANGEMENTS.  Split
       * — one rear and one front, cut from each other on a shared centre.
       * Or lanes — two full-sized keys side by side, which need no roles
       * at all because nothing is cut from anything.  Anything else is two
       * keys trying to stand in the same place.                       */
      if (sl.lanes) {
        /* AT AN END, THE DEEPER KEY HAS TO BE THE OUTER ONE.  One white
         * grows out under the whole of an end gap, so it faces both keys
         * and its rear steps in front of the deeper.  The band the
         * shallower key vacates is then reachable only if it lies between
         * that rear and the deeper key — which it does when the deeper
         * key is outside it, and does not when the deeper key is in the
         * way.  See midSplit in model.js. */
        if (sl.end) {
          const outer = sl.i === -1 ? sl.members[0] : sl.members[1];
          const inner = sl.i === -1 ? sl.members[1] : sl.members[0];
          if (outer.spec.depth < inner.spec.depth - 1e-9) warnings.push(
            `Gap ${sl.i} is at the end of the keyboard and puts the shallower ` +
            `${outer.type} on the outside. The deck cannot reach the ` +
            `${(inner.spec.depth - outer.spec.depth).toFixed(2)} mm the ${outer.type} ` +
            `leaves in front of it — it would have to cut through the ` +
            `${inner.type} to get there. Swap them so the deeper key is outermost.`);
        }
        if (sl.squeezed) {
          const wa = whites[sl.i], wb = whites[sl.i + 1], ww = Math.min(
            wa ? wa.w : Infinity, wb ? wb.w : Infinity);
          warnings.push(
            `Gap ${sl.i}: side by side, the two keys want ` +
            `${sl.squeezed.toFixed(2)} mm across but the whites beside them can ` +
            `spare ${sl.w.toFixed(2)} mm, so they were narrowed in proportion to ` +
            `${sl.members[0].w.toFixed(2)} and ${sl.members[1].w.toFixed(2)} mm. ` +
            `A side-by-side gap spends ` +
            `${(XM.LANE_BUFFER + 2 * (sl.clear - XM.FIT.gap)).toFixed(2)} mm on air — ` +
            `the ${XM.LANE_BUFFER.toFixed(2)} mm seam between the two keys, and ` +
            `${sl.clear.toFixed(2)} mm from each of them to the white rear beside ` +
            `it — so set the Black and Gray class widths to about ` +
            `${(100 * sl.members[0].w / ww).toFixed(0)}% of a white to keep them ` +
            `at full width here.`);
        }
        continue;
      }
      const rears = sl.members.filter(m => m.spec.pairRole === 'rear').length;
      const fronts = sl.members.filter(m => m.spec.pairRole === 'front').length;
      if (rears > 1) warnings.push(`Gap ${sl.i} has ${rears} rear keys — they would collide.`);
      if (fronts > 1) warnings.push(`Gap ${sl.i} has ${fronts} front keys — they would collide.`);
      if (sl.members.length === 2 && (rears !== 1 || fronts !== 1)) warnings.push(
        `Gap ${sl.i} stacks two keys of the same depth — a split slot takes one rear (Split Black) and one front (Split Gray), and a side-by-side gap takes one Full Sized Gray and one Full Sized Black.`);
      if (sl.members.length > 1 && sl.members.some(m => !m.spec.pairRole)) warnings.push(
        `Gap ${sl.i} mixes a full-sized key with a split key.`);
    }

    /* ---- sensors: exactly 32, one per key, no chaining ----
     * NOTES PER EQUAVE is now MEASURED, not declared.  With the repeating
     * period gone there is no pattern to count; an equave is simply the
     * span of the first seven whites and the gaps among them, and the
     * notes actually standing there are the answer.  For a design that
     * happens to be periodic this is the old number exactly. */
    const notesEq = XM.SIZE.whitesPerPeriod + slots
      .filter(sl => sl.i < XM.SIZE.whitesPerPeriod)
      .reduce((n, sl) => n + sl.members.length, 0);
    const total = whites.length + slots.reduce((n, sl) => n + sl.members.length, 0);
    const feet = XM.footCentres();

    if (cut) warnings.push(
      `The 32-note limit lands inside gap ${cut.slot}: ` +
      `${cut.kept} of ${cut.wanted} keys placed. Change the pattern or the rotation if you want a whole slot there.`);

    /* ---- one note per foot, left to right ---- */
    const notes = [];
    const leadSlot = slotOf.get(-1);
    if (leadSlot) for (const m of leadSlot.members)
      notes.push({ kind: 'acc', ref: m, cx: m.cx, type: m.type });
    for (const w of whites) {
      notes.push({ kind: 'white', ref: w, cx: w.cx, type: w.type });
      const sl = slotOf.get(w.i);
      if (sl) for (const m of sl.members) notes.push({ kind: 'acc', ref: m, cx: m.cx, type: m.type });
    }
    /* Left to right — and when two keys share an x, the order has to be
     * decided, not left to the sort.  A split pair IS two keys on one slot
     * centre, and `(a.kind === 'white' ? -1 : 1)` returned 1 for both of
     * them: an inconsistent comparator, so the pair came out one way in one
     * layout and the other way in another, purely on sort internals.  That
     * decided which sensor each half drove, and in 19-EDO it drove them
     * crossed — the gray half sits to the LEFT of the black half in the
     * drafted slot, yet the black half was taking the left-hand foot, so
     * the two connectors had to pass through one another.
     *
     * The slot centre cannot break the tie because both halves share it.
     * The drafted profile can: each half is drawn at its own x inside the
     * slot, and which one is on the left flips with the pair's handedness
     * ("First" is the mirror of "Second").  So the tie-break is the key's
     * own drafted centre, which reads that handedness straight off the
     * sheet instead of assuming it.  A white still precedes an accidental
     * on the same x.                                                     */
    const drafted = new Map();
    const draftedCx = (n) => {
      const key = n.type + '|' + n.cx + '|' + (n.kind === 'white' ? 'w' : 'a');
      if (!drafted.has(key)) {
        const r = n.ref, white = n.kind === 'white';
        const w = r.w || (white ? wW : aW);
        const lb = white ? r.ctxL : null, rb = white ? r.ctxR : null;
        /* the span the key presents AT THE SPINE, not its overall extent —
         * the two halves of a pair share an overall extent (each is drawn
         * across the whole slot at some y) and differ only in where their
         * material actually stands, which is what the feet must follow */
        const b = XM.keyBackSpan(r.cx, w, n.type, lb, rb);
        const e = b || XM.keyExtent(r.cx, w, n.type, lb, rb);
        drafted.set(key, (e.x0 + e.x1) / 2);
      }
      return drafted.get(key);
    };
    notes.sort((a, b) => a.cx - b.cx ||
                         (a.kind === 'white' ? -1 : 1) - (b.kind === 'white' ? -1 : 1) ||
                         draftedCx(a) - draftedCx(b));
    let footDrift = 0, footDriftAt = null;
    notes.forEach((n, k) => {
      n.index = k;
      n.foot = feet[k];
      n.degree = k % notesEq;
      n.equave = Math.floor(k / notesEq);
      n.ref.noteIndex = k;
      n.ref.foot = n.foot;
      n.ref.degree = n.degree;
      n.ref.half = k < XM.FEET_PER_HALF ? 'A' : 'B';
      const d = Math.abs(n.cx - n.foot);
      if (d > footDrift) { footDrift = d; footDriftAt = k; }
    });

    /* ------------------------------------------------------------------
     * NO KEY MAY REACH PAST THE SPINE IT STANDS ON.
     *
     * The white PITCH is not the keyboard's extent.  A drafted key's rear
     * weaves past its neighbours' slots and can reach several millimetres
     * outside its own pitch, and the accidental in the last gap sits to
     * the right of the last white — so a keyboard sized on pitch alone
     * runs off the end of spine half B by up to 10 mm, and starts left of
     * where half A begins.
     *
     * The extent is therefore MEASURED over every key, exactly as it will
     * be built, and it is that extent the size solve fits and the offset
     * seats.  x0Offset then slides the whole keyboard so its leftmost
     * point lands on the front-left corner of the spine.
     * ------------------------------------------------------------------ */
    const ext = keyboardExtent(whites, slots);
    const x0Offset = XM.SPINE.halfA.x0 - ext.x0;
    if (Math.abs(x0Offset) > 1e-9) shiftLayout(whites, slots, notes, x0Offset);
    ext.x0 += x0Offset; ext.x1 += x0Offset;

    const width = ext.x1 - ext.x0;
    const overhang = ext.x1 - XM.SPINE.halfB.x1;
    if (overhang > 0.05) warnings.push(
      `The 32 keys reach ${ext.x1.toFixed(2)} mm but spine half B ends at ` +
      `${XM.SPINE.halfB.x1.toFixed(2)} mm — ${overhang.toFixed(2)} mm hangs off the end.`);
    /* NOTE: a large key-to-foot X offset is expected, not an error.  The two
     * halves of a split pair share one X and still have to reach two adjacent
     * feet 11.3 mm apart.  Nothing closes that gap at this stage — the loop
     * pair states it.  The figure is reported as a statistic. */

    /* ---- which of the six drafted spines this design needs ----
     * One slab per key colour actually PLACED — not per colour the template
     * mentions, because the 32-note limit can cut a slot off before its keys
     * are laid down, and an override on a slot the run never reaches is not
     * part of the instrument.  Gray takes the full three-layer stack: its
     * tongue is the bottom band and black's sits above it, so a design that
     * uses gray at all needs the three-type spine.  See spineKindForColours
     * in model.js.                                                        */
    const colours = new Set(['white']);
    for (const sl of slots) for (const m of sl.members) colours.add(m.spec.layer);
    const spineKind = XM.spineKindForColours(colours);
    const layers = XM.spineLayerCount(spineKind);
    const spineColours = ['gray', 'black', 'white'].filter(c => colours.has(c));

    const L = {
      design, whites, slots, notes, feet, warnings,
      s, autoScale: design.autoScale !== false,
      nUnits: XM.UNITS, wW, wP, aW, delta, notesEq, total,
      ratios, classW: Object.fromEntries(XM.WIDTH_CLASSES.map(c => [c, cw(c)])),
      layers, spineKind, colours, spineColours,
      width, overhang, footDrift, footDriftAt, cut,
      keyX0: ext.x0, keyX1: ext.x1, x0Offset
    };

    /* ---- foot pairing: the two loops have to describe a relationship the
     * instrument can actually hold.  Measured, not assumed — see pairAudit.
     * Nothing is built between them at this stage, so there is no ramp and
     * no overhang to warn about; what matters is that every pair face
     * found a real deck, that the dome still has its travel, and that no
     * two pair faces collide. */
    L.bevel = bevel;             // the break asked for, at these widths
                                 // (L.bevelCut, below, is what was cut)
    /* A ROUND CANNOT FOLLOW A SHARP CORNER EXACTLY.  Where the playing
     * surface's own outline turns sharply — the notch a white key cuts
     * around a neighbouring accidental is the one that actually occurs —
     * the round-over leaves a touch of material either proud or short right
     * at the point.  Said once here rather than silently rounded as if
     * every corner were gentle. */
    let hardTurns = 0, hardKeys = 0;
    /* WHAT THE KEYS WERE ACTUALLY CUT AT, read off the profiles that were
     * built.  A white asked for more than its rear wall carries comes back
     * rounded less than an accidental beside it, and the two ends of that
     * are worth saying rather than reporting the ask as though it were the
     * cut. */
    let cutLo = Infinity, cutHi = 0;
    if (bevel > 0) for (const n of notes) {
      const q = n.kind === 'white'
        ? XM.profileFor(n.type, n.ref.ctxL, n.ref.ctxR)
        : XM.profileFor(n.type, null, null);
      if (q.p.hardTurns) { hardTurns += q.p.hardTurns; hardKeys++; }
      const at = q.p.bevel || 0;
      if (at < cutLo) cutLo = at;
      if (at > cutHi) cutHi = at;
    }
    L.bevelCut = bevel > 0 && isFinite(cutLo) ? { lo: cutLo, hi: cutHi } : null;
    if (hardTurns > 0) warnings.push(
      `The playing edge is rounded at ${cutHi.toFixed(2)} mm, and ${hardTurns} corner` +
      `${hardTurns === 1 ? '' : 's'} on ${hardKeys} key${hardKeys === 1 ? '' : 's'} ` +
      `turn${hardTurns === 1 ? 's' : ''} too tightly for a round that size to follow — ` +
      `the fillet pinches on an outside point and doubles back on an inside one. ` +
      `A smaller break clears it.`);
    const pAudit = XM.pairAudit(pairKeys(L));
    L.pairAudit = pAudit;
    L.bridgeAudit = pAudit;      // old name, same object — see model.js shims
    if (!pAudit.seated) warnings.push(
      `The pair face for key ${pAudit.unseatedAt} found no flat underside on its key to lie in — ` +
      `it falls back to the bounding box of the key's section over the pad, which is not a real surface.`);
    if (pAudit.minGap != null && pAudit.minGap <= 0) warnings.push(
      `Two pair faces overlap by ${(-pAudit.minGap).toFixed(2)} mm` +
      (pAudit.gapAt ? ` (keys ${pAudit.gapAt[0]} and ${pAudit.gapAt[1]})` : '') +
      ` — they share a plane and must not both be drawn as they are.`);
    if (!pAudit.watertight) warnings.push(
      `The sensor press for key ${pAudit.leakyAt != null ? pAudit.leakyAt : pAudit.invertedAt} ` +
      `did not close into a solid — it cannot be sliced as drawn.`);
    if (!pAudit.clearsTravel) warnings.push(
      `A pair face sits ${(pAudit.minRise != null ? pAudit.minRise : pAudit.overForeign).toFixed(2)} mm ` +
      `above a sensor pad — under the ${XM.PAIR.travel + XM.PAIR.margin} mm the dome needs to travel and settle.`);

    return L;
  }

  /** how many white keys the 32-note limit yields for this pattern */
  function whiteCount(design) {
    const rot = ((design.rotation | 0) % 7 + 7) % 7;
    let placed = 0, last = 0;
    for (let i = 0; placed < XM.NOTES; i++) {
      last = i; placed++;
      if (placed >= XM.NOTES) break;
      const names = slotAt(design, i, rot);
      placed += Math.min((names || []).length, XM.NOTES - placed);
    }
    return last + 1;
  }
  /** width(s) = 1.5·(n−1) + (37/24)·s·n  — linear, so solvable in closed form */
  function widthAt(design, s) {
    const n = whiteCount(design);
    return (n - 1) * XM.whitePitch(s) + XM.whiteWidth(s);
  }
  /** the size scale s at which the 32 keys just reach the end of the A+B spine */
  function suggestScale(design, s) {
    const n = whiteCount(design);
    const b = XM.SIZE.whitePerUnit * n;
    const a = XM.SIZE.whiteGap * (n - 1);
    if (Math.abs(b) < 1e-9) return s;
    return Math.max(1, (XM.SPINE.halfB.x1 - a) / b);
  }

  /* ------------------------------------------------------------------ *
   *  BOUNDS + WORLD ORIGIN                                              *
   * ------------------------------------------------------------------ */
  /** bounding box of the whole instrument — keys, spine and feet — in design mm */
  function bounds(L) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity,
        z0 = Infinity, z1 = -Infinity;
    const grow = (a, b, c, d, e, g) => {
      x0 = Math.min(x0, a); x1 = Math.max(x1, b);
      y0 = Math.min(y0, c); y1 = Math.max(y1, d);
      z0 = Math.min(z0, e); z1 = Math.max(z1, g);
    };
    for (const w of L.whites) {
      const e = XM.keyExtent(w.cx, w.w, w.type, w.ctxL, w.ctxR);
      grow(e.x0, e.x1, e.y0, e.y1, e.z0, e.z1);
    }
    for (const sl of L.slots) for (const m of sl.members) {
      const e = XM.keyExtent(m.cx, m.w, m.type, null, null);
      grow(e.x0, e.x1, e.y0, e.y1, e.z0, e.z1);
    }
    for (const [hn, half] of XM.spineHalves()) {
      const ls = XM.spineBands(L.spineKind, hn);
      grow(half.x0, half.x1, half.yBack, half.yFront,
           ls[0].z0, ls[ls.length - 1].z1);
    }
    grow(L.feet[0] - XM.FOOT.w / 2, L.feet[L.feet.length - 1] + XM.FOOT.w / 2,
         XM.FOOT.yCentre - XM.FOOT.d / 2, XM.FOOT.yCentre + XM.FOOT.d / 2,
         XM.FOOT.z - 0.05, XM.FOOT.z + 0.05);
    return { x0, x1, y0, y1, z0, z1,
             cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, cz: (z0 + z1) / 2,
             w: x1 - x0, d: y1 - y0, h: z1 - z0 };
  }

  /* Where the design frame lands in Blender's world.
   *   X_world = x + off.x0
   *   Y_world = off.y0 - y
   *   Z_world = z + off.z0                                              */
  const ORIGIN_MODES = {
    centre: 'model centre at the world origin (0, 0, 0)',
    spine:  'X centred on 0; Y = 0 at the spine front face; Z = 0 at the spine bottom face',
    sheet:  'the drafting sandbox world position (round-trips into the Leveling .blend)'
  };
  function worldOffset(L, mode) {
    const b = bounds(L);
    if (mode === 'sheet')
      return { x0: XM.WORLD.x0, y0: XM.WORLD.y0, z0: XM.WORLD.z0, mode: 'sheet', b };
    if (mode === 'spine')
      return { x0: -b.cx, y0: 0, z0: 0, mode: 'spine', b };
    // default: the whole instrument's bounding box is centred on (0, 0, 0)
    return { x0: -b.cx, y0: b.cy, z0: -b.cz, mode: 'centre', b };
  }

  /* ------------------------------------------------------------------ *
   *  MESHES                                                             *
   * ------------------------------------------------------------------ */
  /**
   * The boss/gusset spans, resolved per half and band, for the Python
   * builder.  Each is the TONGUE's own z — the DRAFTED band clipped to the
   * tongue of the colour that band prints in, not the band as separated by
   * FIT.gap: that gap is a rule about the bands, which share the y < 0
   * side, and both the boss and the gusset stand in front of the spine
   * face where no other colour reaches.  See THE TONGUE ROOT IS THE WHOLE
   * JOINT in model.js.
   */
  function spineBossSpans(L) {
    const T = { gray: XM.Z.grayTongue, black: XM.Z.blackTongue,
                white: XM.Z.whiteTongue };
    const out = [];
    for (const [hn, half] of XM.spineHalves())
      for (const band of XM.spineBands(L.spineKind, hn)) {
        /* by FILAMENT: a key's layer is its colour, a band's name is the
         * sheet it came off ('all' / 'lower' / 'upper' / the colours) */
        const part = XM.spineLayerPart(L.spineKind, band.name);
        const t = T[part];
        if (!t) continue;
        for (const k of keySpans(L)) {
          if (k.layer !== part) continue;
          if (k.half && k.half !== hn) continue;
          const a = Math.max(k.x0, half.x0), b = Math.min(k.x1, half.x1);
          const z0 = Math.max(band.z0Drafted, t[0]);
          const z1 = Math.min(band.z1Drafted, t[1]);
          if (b - a > 1e-4 && z1 - z0 > 1e-4)
            out.push({ layer: band.name, x0: a, x1: b, z0, z1 });
        }
      }
    return out;
  }

  /** where each key meets the spine, so its own band can boss forward */
  function keySpans(L) {
    const out = [];
    for (const k of pairKeys(L)) {
      const s = XM.keyBackSpan(k.cx, k.w, k.type, k.lb, k.rb);
      if (s) out.push({ layer: k.layer, half: k.half,
                        x0: s.x0, x1: s.x1, index: k.index });
    }
    return out;
  }

  /** the 32 keys in note order, each carrying the foot it is paired with */
  function pairKeys(L) {
    const out = L.notes.map(n => {
      const r = n.ref, white = n.kind === 'white';
      return {
        index: n.index, type: n.type,
        layer: XM.KEY_TYPES[n.type].layer,
        cx: r.cx, w: r.w || (white ? L.wW : L.aW),
        lb: white ? r.ctxL : null, rb: white ? r.ctxR : null,
        half: r.half, foot: r.foot
      };
    }).filter(k => k.foot != null);

    /* SPLIT PAIRS.  Two keys on one slot share an x centre, and the deeper
     * one's belly is drawn across the whole slot — so neither can be told
     * where it ends by its own geometry alone.  Hand each the OTHER's land
     * (the shallower one, whose belly really is just its half) so it can
     * take the rest of the slot.  See pairLand in model.js. */
    const byX = new Map();
    for (const k of out) {
      const key = Math.round(k.cx * 1e4);
      (byX.get(key) || byX.set(key, []).get(key)).push(k);
    }
    for (const group of byX.values()) {
      if (group.length < 2) continue;
      const lands = group.map(k =>
        XM.pairLand(k.cx, k.w, k.type, k.lb, k.rb, null));
      const width = lands.map(l => (l ? l.x1 - l.x0 : Infinity));
      const narrow = width.indexOf(Math.min.apply(null, width));
      group.forEach((k, i) => { if (i !== narrow) k.sib = lands[narrow]; });
    }
    return out;
  }

  /**
   * What the sensor press offers each key's own arms, keyed by the key.
   * A key is drawn from L.whites / L.slots but is paired with its foot in
   * pairKeys, and the arms cannot be placed without the foot — so the one
   * is looked up from the other.  Type and centre together name a key: the
   * two halves of a split pair share a centre and never a type.
   */
  function armTargets(bkeys) {
    const m = new Map();
    for (const k of bkeys) {
      const at = XM.pressArms(k.cx, k.w, k.type, k.lb, k.rb, k.foot, k.sib);
      if (at) m.set(k.type + '@' + Math.round(k.cx * 1e4), at);
    }
    return m;
  }
  const armKey = (type, cx) => type + '@' + Math.round(cx * 1e4);

  /**
   * Where each key's tongue laps into the spine — see THE TONGUE DOES NOT
   * STOP AT THE SPINE FACE in model.js.  Keyed like armTargets so the key
   * builders can look their own up.
   */
  function lapTargets(L, bkeys) {
    const m = new Map();
    for (const k of bkeys) {
      const s = XM.keyBackSpan(k.cx, k.w, k.type, k.lb, k.rb);
      const lap = s ? XM.tongueLaps(L.spineKind, k.layer, s, k.half) : [];
      if (lap.length) m.set(armKey(k.type, k.cx), lap);
    }
    return m;
  }

  /* ------------------------------------------------------------------ *
   *  WHICH HALF OF THE INSTRUMENT A PIECE BELONGS TO                    *
   *                                                                     *
   *  The AKM320 is already two halves: spine half A with its 16 sensor  *
   *  feet, spine half B with its other 16, and a drafted 1.29 mm of air *
   *  between them that nothing bridges.  So the keyboard has a seam of  *
   *  its own, and every piece of it — a key, the press under that key,  *
   *  a spine band — falls on one side of that seam or the other.  A key *
   *  takes the half its FOOT is on (`ref.half`, set in computeLayout),  *
   *  which is the physical answer rather than an x comparison that      *
   *  would have to decide what to do with a key overhanging the seam.   *
   *                                                                     *
   *  Recorded as index SPANS into the flat per-colour arrays rather     *
   *  than as a second copy of the geometry: the preview wants those     *
   *  arrays whole and a keyboard is a hundred thousand floats.          *
   * ------------------------------------------------------------------ */
  function spanner(out) {
    const spans = { keys: {}, press: {}, spine: {} };
    out.spans = spans;
    /** run `body`, then record which half everything it appended is on */
    return function mark(src, part, half, body) {
      const arr = out[part] || (out[part] = []);
      const i0 = arr.length;
      body(arr);
      if (arr.length > i0)
        (spans[src][part] = spans[src][part] || [])
          .push({ half: half === 'B' ? 'B' : 'A', i0, i1: arr.length });
    };
  }

  /* HOW FAR APART THE TWO ROWS STAND, once the keyboard is laid out for a
   * bed rather than for a player.  Measured off the build — a keyboard's
   * depth is its deepest key, which the design decides — plus a gap wide
   * enough for a brim and for the two rows to be told apart by eye. */
  const ROW_GAP = 6;                       // mm of clear bed between rows

  function buildMeshes(L) {
    const out = { white: [], black: [], gray: [] };
    const mark = spanner(out);
    /* Keys are drawn whole.  Nothing is cut into their undersides any more:
     * the pair face is a floating loop lying in the deck plane, not a weld,
     * so the key's own triangulation is left exactly as drafted — save for
     * the two arms of its underside "-| |-", which slide along their own
     * bars to stand on the sensor press.  See THE KEY'S OWN ARMS. */
    const bkeys = pairKeys(L);
    const arms = armTargets(bkeys);
    const laps = lapTargets(L, bkeys);
    /* A KEY'S TONGUE IS CLIPPED TO ITS OWN HALF.  The key belongs to one
     * spine half; the tongue may be drafted wider than that half reaches,
     * and past its edge there is no band to plug into.  See A TONGUE THAT
     * READS NO SPINE IS NOT A TONGUE. */
    for (const w of L.whites)
      mark('keys', 'white', w.half, arr =>
        arr.push(...XM.buildKey(w.cx, w.w, w.type, w.ctxL, w.ctxR, null,
                                arms.get(armKey(w.type, w.cx)),
                                laps.get(armKey(w.type, w.cx)),
                                XM.spineHalfSpan(w.half))));
    for (const sl of L.slots) {
      for (const m of sl.members)
        mark('keys', m.spec.layer, m.half, arr =>
          arr.push(...XM.buildKey(m.cx, m.w, m.type, null, null, null,
                                  arms.get(armKey(m.type, m.cx)),
                                  laps.get(armKey(m.type, m.cx)),
                                  XM.spineHalfSpan(m.half))));
    }
    /* The spine is the drafted one for this design's colour count — the
     * "<kind> type Spine - A / - B" pair.  Keep it whole for the STL, and
     * also keyed by layer so the preview can paint each band with the
     * colour that layer has in the drafting sandbox.                    */
    const spine = XM.spineParts(L.spineKind, keySpans(L));
    out.spine = [];
    out.spineLayers = {};
    /* AND KEYED BY THE FILAMENT IT PRINTS IN.  A band is not a part of its
     * own: it prints in the colour of the keys whose tongues plug into it,
     * fused to them, so the export asks for it by colour (see printMesh).
     * The preview still draws the spine as its own toggle, out of
     * out.spine / out.spineLayers, which is why both are kept. */
    out.spineByPart = { white: [], black: [], gray: [] };
    for (const p of spine) {
      out.spine.push(...p.tris);
      (out.spineLayers[p.layer] = out.spineLayers[p.layer] || []).push(...p.tris);
      const part = XM.spineLayerPart(L.spineKind, p.layer);
      const arr = out.spineByPart[part] = out.spineByPart[part] || [];
      const i0 = arr.length;
      arr.push(...p.tris);
      (out.spans.spine[part] = out.spans.spine[part] || [])
        .push({ half: p.half, i0, i1: arr.length });
    }
    /* NO FEET.  A foot used to be an object of its own — the pad face and
     * the key's pairing face, two floating loops with nothing between them
     * — but a face with no volume cannot go in an STL, so the exports never
     * carried one and the Blender scene held 32 objects they did not.  The
     * two loops are still built; they are the ends of the press below. */
    /* THE SENSOR PRESS.  Each key's loop pair, closed into a watertight
     * solid.  It prints as part of its key, in its key's filament — but it
     * is kept OUT of the key colour's mesh here and merged only at export
     * (pressLayers), so the preview can draw it once, in its own colour,
     * under its own toggle.  Merging it in twice would z-fight. */
    out.press = [];
    out.pressLayers = { white: [], black: [], gray: [] };
    for (const p of XM.pressParts(bkeys)) {
      out.press.push(...p.tris);
      const arr = out.pressLayers[p.layer] = out.pressLayers[p.layer] || [];
      const i0 = arr.length;
      arr.push(...p.tris);
      /* a press stands on ONE sensor pad, so it is on the half that pad is
       * on — the note index is the foot number, and the feet are 16 and 16 */
      (out.spans.press[p.layer] = out.spans.press[p.layer] || [])
        .push({ half: p.index < XM.FEET_PER_HALF ? 'A' : 'B', i0, i1: arr.length });
    }

    /* HOW DEEP THE WHOLE BUILD IS, for the two-row bed layout.  Read off
     * what was actually built rather than off the class depths: the
     * deepest thing in the design decides it, and a design of nothing but
     * whites is shallower than one carrying full-sized grays. */
    let y0 = Infinity, y1 = -Infinity;
    for (const part of ['white', 'black', 'gray'])
      for (const src of [out[part], out.pressLayers[part], out.spineByPart[part]])
        for (let i = 1; src && i < src.length; i += 3) {
          if (src[i] < y0) y0 = src[i];
          if (src[i] > y1) y1 = src[i];
        }
    out.rowPitch = isFinite(y0) ? (y1 - y0) + ROW_GAP : 0;
    return out;
  }

  /* ------------------------------------------------------------------ *
   *  WHICH FACE THE PART LIES ON                                        *
   *                                                                     *
   *  The one you want to come out well: the playing surface.  Printed   *
   *  the way the app draws it, a key's top is the LAST thing the        *
   *  printer lays down — stepped over the curve of the sides, supported *
   *  by nothing, and carrying every seam.  Turned over it is the FIRST  *
   *  thing, ironed flat against the glass, and the parts that come out  *
   *  rough are the tongue and the underside, which nobody touches.      *
   *                                                                     *
   *  A WHITE IS A HALF TURN.  Its playing surface is one flat plane at  *
   *  z = 8.628, so 180 degrees about x puts it on the bed exactly.      *
   *                                                                     *
   *  AN ACCIDENTAL IS NOT.  Black and gray tops are RAKED — they rise   *
   *  about two degrees from the spine to the peak before the nose ramps *
   *  away — so a half turn leaves them resting on one edge, rocking,    *
   *  and printing the surface that matters as a 2 degree overhang off a *
   *  line of contact.  The turn is therefore a half turn LESS THE RAKE, *
   *  and it is that raked plane that lands flat on the glass.           *
   *                                                                     *
   *  THE RAKE IS MEASURED, NOT DECLARED.  It comes off the profiles     *
   *  that were actually built — the largest upward-facing plane among   *
   *  the topmost surfaces of that colour's KEYS, which is the surface   *
   *  that will touch the bed once it is turned over.  So it is right    *
   *  for whatever the design placed, it is unmoved by the bevel (which  *
   *  trims the top's edges without tilting it), and a colour holding    *
   *  two types whose rakes differ by a tenth of a degree is laid on the *
   *  area-weighted mean of the two rather than on either.               *
   *                                                                     *
   *  THE SPINE BAND GOES WITH IT.  The band is fused to its keys and    *
   *  prints as one solid with them, so it takes the same turn and ends  *
   *  up two degrees off level.  That is the right way round: the        *
   *  playing surface is the one that has to be flat, and the band's own *
   *  faces are glued, not touched.                                      *
   * ------------------------------------------------------------------ */
  function bedTilt(tris) {
    const f = [];
    for (let i = 0; i < tris.length; i += 9) {
      const ux = tris[i+3] - tris[i], uy = tris[i+4] - tris[i+1], uz = tris[i+5] - tris[i+2];
      const vx = tris[i+6] - tris[i], vy = tris[i+7] - tris[i+1], vz = tris[i+8] - tris[i+2];
      const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
      const L = Math.hypot(nx, ny, nz);
      if (!L || nz / L < 0.9) continue;          // not an upward face
      f.push({ a: L / 2, ny: ny / L, nz: nz / L,
               z: (tris[i+2] + tris[i+5] + tris[i+8]) / 3 });
    }
    if (!f.length) return 0;
    /* WHAT WILL TOUCH THE BED IS WHAT IS HIGHEST NOW.  A split gray's rear
     * arm is upward-facing and very nearly parallel to its playing top, and
     * it is ten millimetres below it — turned over it is ten millimetres in
     * the air, so it has no business deciding how the part lies. */
    let zTop = -Infinity;
    for (const q of f) if (q.z > zTop) zTop = q.z;
    /* grouped by rake rather than averaged: a bevel puts a fan of shallow
     * strips around the top's edges, and their areas would drag a plain
     * mean off the plane they are a rounding of */
    const g = new Map();
    for (const q of f) {
      if (q.z < zTop - TOP_BAND) continue;
      const k = q.ny.toFixed(3), e = g.get(k) || { a: 0, ny: 0, nz: 0 };
      e.a += q.a; e.ny += q.ny * q.a; e.nz += q.nz * q.a;
      g.set(k, e);
    }
    if (!g.size) return 0;
    const groups = [...g.values()].sort((a, b) => b.a - a.a);
    const lead = Math.atan2(-groups[0].ny, groups[0].nz);
    let ay = 0, az = 0;
    for (const e of groups) {
      /* one colour, two key types, two rakes a tenth of a degree apart:
       * both are playing surfaces and the part is laid between them */
      if (Math.abs(Math.atan2(-e.ny, e.nz) - lead) > TOP_SPREAD) continue;
      ay += e.ny; az += e.nz;
    }
    return Math.atan2(-ay, az);
  }
  const TOP_BAND = 2.0;                    // mm below the highest face
  const TOP_SPREAD = 0.5 * Math.PI / 180;  // rakes this close are one surface

  /** how far a colour turns to lie on its playing surface, in radians */
  function bedAngle(meshes, part) {
    return Math.PI - bedTilt(meshes[part] || []);
  }

  /* ------------------------------------------------------------------ *
   *  EACH ACCIDENTAL ROW LIES ON ITS OWN FACE                           *
   *                                                                     *
   *  The build is turned onto the WHITE deck (see ONE BED FRAME), which *
   *  is right for the whites and wrong for the accidentals: black and   *
   *  gray tops are raked about two degrees off that deck, so in the     *
   *  shared frame they leave the printer resting on an edge and the     *
   *  playing surface prints as a shallow overhang.                      *
   *                                                                     *
   *  So the two folded rows of a black or gray file are each given the  *
   *  small extra turn that lays THAT row's key tops on the glass —      *
   *  measured on that row's own keys, independently, because the two    *
   *  halves are drafted apart and their rakes need not agree.  The      *
   *  turn is taken about a line through the row's own middle, so the    *
   *  row stays where the fold put it in x and y and only lies down.     *
   *                                                                     *
   *  THE WHITE FILE IS UNTOUCHED: it is the deck, already flat, and it  *
   *  is the datum the accidental rows are measured from.  The two       *
   *  accidental files therefore no longer sit in register with the      *
   *  white one on the bed — that is the point, and they are three       *
   *  separate prints that are assembled afterwards through the spine.   *
   * ------------------------------------------------------------------ */
  function halfTilt(meshes, part, half) {
    const sp = ((meshes.spans || {}).keys || {})[part] || [];
    const src = meshes[part] || [];
    const tris = [];
    for (const s of sp) {
      if (s.half !== half) continue;
      for (let i = s.i0; i < s.i1; i++) tris.push(src[i]);
    }
    return tris.length ? bedTilt(tris) : null;
  }

  /* ------------------------------------------------------------------ *
   *  ONE BED FRAME FOR THE WHOLE INSTRUMENT                             *
   *                                                                     *
   *  The three colours are three files, but they are ONE keyboard: the  *
   *  white band, the black band and the gray band are courses of the    *
   *  same spine, bolted through the same holes, with the same ribbon    *
   *  notch cut through all of them.  So they are turned, folded and set *
   *  down TOGETHER, in a frame measured over the whole build — open all *
   *  three in a slicer and they land as the instrument, in register.    *
   *                                                                     *
   *  Measured per colour instead, each file got its own turn and its    *
   *  own drop to the origin: white lies on its flat tops at 180 deg and *
   *  the raked blacks and grays at about 178, so the three came out     *
   *  two degrees apart and each shoved into the same corner.  Every     *
   *  feature the colours SHARE then disagreed — the notch stood in a    *
   *  different place in each file and no bolt hole lined up with its    *
   *  own hole in the band above it.                                     *
   *                                                                     *
   *  THE TURN IS THE DECK'S.  No one frame lays every colour flat: the  *
   *  accidentals are drafted with a 2-degree rake, so their tops and    *
   *  the white tops are not parallel and never can be.  The instrument  *
   *  is turned onto its WHITE deck — the plane it is measured from      *
   *  everywhere else, and three quarters of the playing surface — and   *
   *  the accidentals keep their rake, standing off the bed exactly as   *
   *  they stand off the deck in the hand.                               *
   *                                                                     *
   *  NOT bedTilt OVER EVERY KEY AT ONCE, which reads the highest 2 mm   *
   *  and finds only the accidentals there: they stand about 5 mm proud  *
   *  of the whites, so the whole instrument would be turned onto their  *
   *  rake and the white file — the big one — would print on a slope.    *
   * ------------------------------------------------------------------ */
  const BED_FRAMES = new WeakMap();
  function bedFrame(meshes) {
    let f = BED_FRAMES.get(meshes);
    if (f) return f;
    const parts = ['white', 'black', 'gray'];
    const srcOf = (part, name) =>
      name === 'keys' ? meshes[part]
        : name === 'press' ? (meshes.pressLayers || {})[part]
          : (meshes.spineByPart || {})[part];
    /* the turn: the deck's own, taken once and handed to all three files.
     * White if this design has any — it always does — and otherwise the
     * colour with the most key surface to lie on. */
    const deck = (meshes.white || []).length
      ? 'white'
      : parts.map(p => [p, (meshes[p] || []).length])
             .sort((a, b) => b[1] - a[1])[0][0];
    const th = Math.PI - bedTilt(meshes[deck] || []);
    const c = Math.cos(th), sn = Math.sin(th);

    const spans = meshes.spans || { keys: {}, press: {}, spine: {} };
    const runs = [];
    for (const p of parts)
      for (const nm of ['keys', 'press', 'spine']) {
        const src = srcOf(p, nm);
        if (!src || !src.length) continue;
        for (const s of (spans[nm] && spans[nm][p]) || [])
          runs.push({ src, i0: s.i0, i1: s.i1, half: s.half });
      }
    /* how far back half B goes — measured on the turned rows of the WHOLE
     * build, so the two rows are one fold and not three */
    let aHi = -Infinity, bLo = Infinity;
    for (const r of runs)
      for (let i = r.i0; i < r.i1; i += 3) {
        const ty = r.src[i + 1] * c - r.src[i + 2] * sn;
        if (r.half === 'B') { if (ty < bLo) bLo = ty; }
        else if (ty > aHi) aHi = ty;
      }
    const dx = rowShiftX();
    const dy = (isFinite(aHi) && isFinite(bLo)) ? aHi + ROW_GAP - bLo : 0;
    /* and the drop onto the bed, also over the whole build: the assembly
     * is set down at the origin, not each colour on top of the others */
    let x0 = Infinity, y0 = Infinity, z0 = Infinity;
    for (const r of runs) {
      const ox = r.half === 'B' ? dx : 0, oy = r.half === 'B' ? dy : 0;
      for (let i = r.i0; i < r.i1; i += 3) {
        const X = r.src[i] + ox;
        const Y = r.src[i + 1] * c - r.src[i + 2] * sn + oy;
        const Z = r.src[i + 1] * sn + r.src[i + 2] * c;
        if (X < x0) x0 = X; if (Y < y0) y0 = Y; if (Z < z0) z0 = Z;
      }
    }
    f = { th, tilt: Math.PI - th, c, sn, dx, dy,
          x0: isFinite(x0) ? x0 : 0,
          y0: isFinite(y0) ? y0 : 0,
          z0: isFinite(z0) ? z0 : 0 };
    BED_FRAMES.set(meshes, f);
    return f;
  }

  /* ------------------------------------------------------------------ *
   *  TWO ROWS, BECAUSE A PRINT BED IS NOT A KEYBOARD                    *
   *                                                                     *
   *  Laid out as it is played, a 32-key keyboard is some 373 mm across  *
   *  and 95 mm deep — a shape almost no bed has, and one that will not  *
   *  fit the common 220 or 256 mm square at all.  Folded at the seam    *
   *  the instrument already has, it is 184 x 196: two rows, each half   *
   *  the length, and it drops onto a small square bed with room around  *
   *  it.                                                                *
   *                                                                     *
   *  NOTHING IS CUT.  Half B is MOVED, whole — every key, press and     *
   *  spine band that stands on it — by exactly the drafted distance     *
   *  between the two spine halves in x, so the two rows keep the same   *
   *  datum and read as the two halves they are, and back in y until it  *
   *  clears half A by ROW_GAP.  Both rows take the same turn onto their *
   *  playing surface, so both lie on the glass and neither is propped   *
   *  up by the other.                                                   *
   *                                                                     *
   *  THE FOLD IS DONE AFTER THE TURN, in the bed's own frame.  Folded   *
   *  first, the row offset would be turned with everything else and     *
   *  half B would come out three and a half millimetres off the bed —   *
   *  a keyboard-shaped step nothing would print on.                     *
   * ------------------------------------------------------------------ */
  const rowShiftX = () => -(XM.SPINE.halfB.x0 - XM.SPINE.halfA.x0);

  /**
   * ONE COLOUR'S MESH AS IT PRINTS.  Not "the keys" — everything that
   * leaves the printer in that filament, fused: the keys, the sensor press
   * under each of them, and the spine band their tongues plug into.  That
   * is one object on the bed and one object in the slicer, so it is one
   * STL; the preview is the place where a press or a spine band is a thing
   * of its own, and it keeps them apart under their own toggles.
   *
   * The three colours partition the whole instrument between them — every
   * band belongs to exactly one of them (spineLayerPart) — so nothing is
   * printed twice and nothing is left out.
   */
  function printMesh(meshes, part, opts) {
    const bed = !!(opts && (opts.bed || opts.rows));
    const spans = meshes.spans || { keys: {}, press: {}, spine: {} };
    const srcs = [['keys', meshes[part]],
                  ['press', (meshes.pressLayers || {})[part]],
                  ['spine', (meshes.spineByPart || {})[part]]];
    const out = [];
    /* copied a float at a time rather than with push(...src): a colour is
     * a hundred thousand of them and that many arguments is past what a
     * call frame will take */
    const copy = (src, i0, i1, fn) => {
      for (let i = i0; i < i1; i += 3) fn(src[i], src[i + 1], src[i + 2]);
    };
    const flat = () => {
      for (const [, src] of srcs)
        if (src && src.length)
          copy(src, 0, src.length, (x, y, z) => out.push(x, y, z));
    };
    if (!bed) { flat(); return out; }

    /* THE PIECES OF THIS COLOUR, EACH WITH THE HALF IT STANDS ON.  A build
     * from before the spans existed has nothing to fold along, so it is
     * written out as it is rather than guessed at. */
    const runs = [];
    for (const [name, src] of srcs) {
      if (!src || !src.length) continue;
      const sp = spans[name] && spans[name][part];
      if (!sp || !sp.length) { flat(); return out; }
      for (const s of sp) runs.push({ src, i0: s.i0, i1: s.i1, half: s.half });
    }
    if (!runs.length) return out;

    /* THE FRAME IS THE WHOLE INSTRUMENT'S, not this colour's — one turn,
     * one fold, one drop, shared by all three files so that the spine they
     * share comes out of them in one piece.  See ONE BED FRAME FOR THE
     * WHOLE INSTRUMENT. */
    const F = bedFrame(meshes);
    const c = F.c, sn = F.sn;
    /* the build's turn, then — for an accidental — each row's own small
     * extra turn onto its key tops.  See EACH ACCIDENTAL ROW LIES ON ITS
     * OWN FACE.  Δ is the difference between the deck's rake and this
     * row's, so a row already parallel to the deck gets nothing. */
    const extra = {};
    if (part !== 'white') {
      for (const half of ['A', 'B']) {
        const t = halfTilt(meshes, part, half);
        const d = (t === null) ? 0 : (F.tilt - t);
        extra[half] = { d, c: Math.cos(d), sn: Math.sin(d), py: 0, pz: 0 };
      }
      /* the line each row turns about: the middle of that row's own
       * footprint in the bed frame, on the bed, so the row lies down
       * where it already stands instead of swinging across the plate */
      const rng = {};
      for (const r of runs) {
        const oy = r.half === 'B' ? F.dy : 0;
        const g = rng[r.half] = rng[r.half] || { y0: Infinity, y1: -Infinity };
        for (let i = r.i0; i < r.i1; i += 3) {
          const Y = r.src[i + 1] * c - r.src[i + 2] * sn + oy - F.y0;
          if (Y < g.y0) g.y0 = Y;
          if (Y > g.y1) g.y1 = Y;
        }
      }
      for (const half of ['A', 'B'])
        if (rng[half] && isFinite(rng[half].y0))
          extra[half].py = (rng[half].y0 + rng[half].y1) / 2;
    }
    const place = (X, Y, Z, half) => {
      const e = extra[half];
      if (!e || !e.d) return [X, Y, Z];
      const dy = Y - e.py, dz = Z - e.pz;
      return [X, e.py + dy * e.c - dz * e.sn, e.pz + dy * e.sn + dz * e.c];
    };
    /* AND SET DOWN ON THE BED.  Turned about x through the origin the part
     * ends up under it; a slicer would drop it anyway, but a file that says
     * where it sits can be opened and measured without one.  The drop is
     * the build's, so a colour that happens not to reach the bed's front-
     * left corner does not get shoved into it — except in z, where a row
     * that has just been turned onto its own face is dropped back onto the
     * plate, because nothing else will do it for it. */
    let zLow = Infinity;
    const pts = [];
    for (const r of runs) {
      const ox = r.half === 'B' ? F.dx : 0, oy = r.half === 'B' ? F.dy : 0;
      copy(r.src, r.i0, r.i1, (x, y, z) => {
        const P = place(x + ox - F.x0,
                        y * c - z * sn + oy - F.y0,
                        y * sn + z * c - F.z0, r.half);
        if (P[2] < zLow) zLow = P[2];
        pts.push(P[0], P[1], P[2]);
      });
    }
    const turned = Object.values(extra).some(e => e.d);
    const drop = (turned && isFinite(zLow)) ? zLow : 0;
    for (let i = 0; i < pts.length; i += 3)
      out.push(pts[i], pts[i + 1], pts[i + 2] - drop);
    return out;
  }

  /** the colours this build actually has something to print in */
  function printParts(meshes) {
    return ['white', 'black', 'gray'].filter(p =>
      (meshes[p] || []).length ||
      ((meshes.pressLayers || {})[p] || []).length ||
      ((meshes.spineByPart || {})[p] || []).length);
  }

  /**
   * IS WHAT LEAVES HERE ACTUALLY A SOLID?  Asked of the file as it will be
   * written — turned, folded and all — because that is the thing a slicer
   * opens, and a part that reads as closed in the app frame and open in the
   * bed frame would be a lie told in the one place it matters.
   */
  function printAudit(meshes, opts) {
    const out = {};
    for (const p of printParts(meshes))
      out[p] = XM.isWatertight(printMesh(meshes, p, opts));
    return out;
  }

  /** the footprint an exported part lands in, so the UI can say it */
  function printBounds(meshes, part, opts) {
    const t = printMesh(meshes, part, opts);
    if (!t.length) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < t.length; i += 3) {
      if (t[i] < x0) x0 = t[i];
      if (t[i] > x1) x1 = t[i];
      if (t[i + 1] < y0) y0 = t[i + 1];
      if (t[i + 1] > y1) y1 = t[i + 1];
    }
    return { x0, x1, y0, y1, w: x1 - x0, d: y1 - y0 };
  }

  /* ------------------------------------------------------------------ *
   *  BINARY STL                                                         *
   * ------------------------------------------------------------------ */
  function toSTL(tris, name) {
    const n = tris.length / 9;
    const buf = new ArrayBuffer(84 + n * 50);
    const dv = new DataView(buf);
    const h = 'Keyboard Designer - ' + (name || 'part');
    for (let i = 0; i < Math.min(79, h.length); i++) dv.setUint8(i, h.charCodeAt(i));
    dv.setUint32(80, n, true);
    let o = 84;
    for (let t = 0; t < n; t++) {
      const i9 = t * 9;
      // mirror on X, swapping b/c to keep winding (and normals) outward-facing
      const ax = -tris[i9],   ay = tris[i9+1],   az = tris[i9+2];
      const bx = -tris[i9+6], by = tris[i9+7],   bz = tris[i9+8];
      const cx = -tris[i9+3], cy = tris[i9+4],   cz = tris[i9+5];
      const ux = bx-ax, uy = by-ay, uz = bz-az;
      const vx = cx-ax, vy = cy-ay, vz = cz-az;
      let nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx/len, true); dv.setFloat32(o+4, ny/len, true); dv.setFloat32(o+8, nz/len, true);
      dv.setFloat32(o+12, ax, true); dv.setFloat32(o+16, ay, true); dv.setFloat32(o+20, az, true);
      dv.setFloat32(o+24, bx, true); dv.setFloat32(o+28, by, true); dv.setFloat32(o+32, bz, true);
      dv.setFloat32(o+36, cx, true); dv.setFloat32(o+40, cy, true); dv.setFloat32(o+44, cz, true);
      dv.setUint16(o+48, 0, true);
      o += 50;
    }
    return buf;
  }

  /* ------------------------------------------------------------------ *
   *  STORE-ONLY ZIP                                                     *
   * ------------------------------------------------------------------ */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();
  function crc32(b) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function makeZip(files) {
    const enc = new TextEncoder(), locals = [], centrals = [];
    let off = 0;
    for (const f of files) {
      const nb = enc.encode(f.name);
      const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
      const crc = crc32(data);
      const local = new Uint8Array(30 + nb.length + data.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
      lv.setUint16(26, nb.length, true);
      local.set(nb, 30); local.set(data, 30 + nb.length);
      locals.push(local);
      const cent = new Uint8Array(46 + nb.length);
      const cv = new DataView(cent.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
      cv.setUint16(28, nb.length, true); cv.setUint32(42, off, true);
      cent.set(nb, 46);
      centrals.push(cent);
      off += local.length;
    }
    const cs = centrals.reduce((a, c) => a + c.length, 0);
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, cs, true); ev.setUint32(16, off, true);
    const bytes = new Uint8Array(off + cs + 22);
    let p = 0;
    for (const l of locals) { bytes.set(l, p); p += l.length; }
    for (const c of centrals) { bytes.set(c, p); p += c.length; }
    bytes.set(end, p);
    return bytes.buffer;
  }

  /* ------------------------------------------------------------------ *
   *  BLENDER PYTHON LOG                                                 *
   *                                                                     *
   *  A complete, runnable bpy script:  a readable data header first,     *
   *  then a builder that reproduces the design in Blender.  If the       *
   *  "Key Type Categories" collection is present it duplicates those     *
   *  real meshes (exact geometry); otherwise it drops proxy boxes.       *
   * ------------------------------------------------------------------ */
  const f = (v, n) => Number(v).toFixed(n == null ? 5 : n);

  /* Every number the generated builder computes with goes through pn().
   * String(v) is JavaScript's shortest decimal that round-trips to the very
   * same double, so Python's float() reads back the identical bits — which
   * is what makes the Blender build and the WebGL preview the same model
   * rather than two models that agree to a few decimals.  Display-only
   * columns still use f(); geometry never does.                           */
  const pn = v => {
    if (v == null) return 'None';
    if (!isFinite(v)) return String(v);
    const s = String(v);
    return /[.e]/.test(s) ? s : s + '.0';
  };

  function pythonLog(L, opts) {
    const d = L.design;
    const O = worldOffset(L, (opts && opts.origin) || 'centre');
    const W = O, b = O.b;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const out = [];
    const p = (...a) => out.push(a.join(''));
    const seen = usedProfiles(L);      // tags every note with its profile key

    p('# =========================================================================');
    p('# KEYBOARD DESIGNER — DESIGN LOG');
    p('# generated ', now, '  (paste into Blender\'s Text Editor and Run Script)');
    p('#');
    p('# WORLD PLACEMENT: ', ORIGIN_MODES[O.mode]);
    p('#   the built keyboard spans');
    p('#     X  ', f(b.x0 + O.x0, 4), ' .. ', f(b.x1 + O.x0, 4), '   (', f(b.w, 4), ' mm)');
    p('#     Y  ', f(O.y0 - b.y1, 4), ' .. ', f(O.y0 - b.y0, 4), '   (', f(b.d, 4), ' mm)');
    p('#     Z  ', f(b.z0 + O.z0, 4), ' .. ', f(b.z1 + O.z0, 4), '   (', f(b.h, 4), ' mm)');
    p('#   centre ', f(b.cx + O.x0, 4), ', ', f(O.y0 - b.cy, 4), ', ', f(b.cz + O.z0, 4));
    p('#');
    p('# Design frame (x/y/z below) -> Blender world:');
    p('#   X_world = x + ', pn(O.x0), '     x = 0 at the leftmost white key\'s left edge');
    p('#   Y_world = ', pn(O.y0), ' - y     y = 0 at the spine front face, + toward the player');
    p('#   Z_world = z + ', pn(O.z0), '     z = 0 at the spine bottom face');
    p('#   (set ORIGIN below to \'sheet\' to get the drafting sandbox position instead)');
    p('#');
    p('# FIXED SPINE <-> FOOT RELATIONSHIP (never varies)');
    p('#   foot pad        ', f(XM.FOOT.w, 3), ' x ', f(XM.FOOT.d, 3), ' mm');
    p('#   foot pitch      ', f(XM.FOOT.pitch, 5), ' mm');
    p('#   foot centre     y = ', f(XM.FOOT.yCentre, 5), ' mm in front of the spine front face');
    p('#   foot plane      z = ', f(XM.FOOT.z, 5), ' mm below the spine bottom face');
    p('# =========================================================================');
    p('');
    p('DESIGN = {');
    p('    "scale":        ', f(L.s), ',      # every width is linear in this',
      L.autoScale ? ' — solved against the spine' : ' — pinned by hand');
    p('    "notes_equave": ', L.notesEq, ',');
    p('    "whites":       ', L.whites.length, ',            # derived, not a free parameter');
    p('    "rotation":     ', ((d.rotation | 0) % 7 + 7) % 7, ',            # white #0 sits on period slot this index');
    p('    "total_keys":   ', L.total, ',            # ALWAYS 32 — one per sensor foot');
    p('    "akm320_units": 1,            # always one: spine half A + half B');
    /* THE PLAYING EDGE.  The chamfer is already IN the profile table below —
     * it is cut on the profile, not on the mesh — so this line is here to be
     * read rather than to be used.  0 is the drafted square arris. */
    p('    "bevel":        ', f(L.bevel || 0, 4),
      ',       # mm the playing edge is broken by, round the playing surface and over the ridge into the nose');
    /* WHAT EACH KEY TOOK.  The ask is one number; the cut is not, because a
     * key is held to the wall under its own arris — a white's rear wall
     * carries less than an accidental's nose does.  Written out when the
     * two ends differ, so the log says what the profiles below are. */
    if (L.bevelCut && L.bevelCut.lo < L.bevelCut.hi - 5e-4)
      p('    "bevel_cut":    [', f(L.bevelCut.lo, 4), ', ', f(L.bevelCut.hi, 4),
        '],  # mm actually cut: the least and the most, held to each key\'s own wall');
    /* ---- more than one of them on the desk ----
     * A rig does not change a single part: it is N of the SAME printed
     * keyboard, so everything below still describes one unit and one set of
     * STLs makes any of them.  What it adds is where the other units stand
     * and how the run of notes is read across them — written down here
     * because the .py is the design's own record, and a log that said
     * nothing about it would be describing a different instrument from the
     * one on screen. */
    /* ---- the rig this keyboard is one device of ----
     * The log describes ONE device — its keys, its spine, its presses —
     * because one device is what gets printed.  What it adds here is the desk that
     * device stands on: where the others are, and what each one's keys are
     * called in the run the rig is read as.  The devices may be different
     * keyboards, so the offsets and the numbering are stated for all of them
     * while the geometry below is stated for this one. */
    const rigU = (opts && opts.rig) || null;
    if (rigU && rigU.length > 1) {
      const me = rigU.find(u => u.slot === (opts.slot | 0)) || rigU[0];
      p('    "rig_units":    ', rigU.length, ',            # ',
        opts.shape || '', ' — this file is the ', XM.rigLabel(me), ' device');
      p('    "rig_note":     "base + step*i",   # what a device\'s key i is',
        ' called in the run the rig is read as');
      p('    "rig_devices":  [   # (dx, dy, dz) mm in the design frame, col, row, base, step');
      for (const u of rigU)
        p('        (', pn(u.dx), ', ', pn(u.dy), ', ', pn(u.dz), ', ',
          u.col, ', ', u.row, ', ', u.base, ', ', u.step, '),   # ',
          XM.rigLabel(u), u.slot === me.slot ? '  <- this one' : '',
          u.auto ? '' : '  (numbering set by hand)');
      p('    ],');
    }
    p('    "key_colours":  ', L.spineColours.length, ',            # ',
      L.spineColours.join(' + '));
    p('    "spine_type":   "', L.spineKind, ' type",   # ', L.layers,
      ' layer', L.layers === 1 ? '' : 's', ' — one per key colour',
      L.colours.has('gray')
        ? '; gray always takes all three' : '');
    p('    "white_width":  ', f(L.wW), ',');
    p('    "white_pitch":  ', f(L.wP), ',');
    p('    "acc_width":    ', f(L.aW), ',');
    for (const c of XM.WIDTH_CLASSES)
      p('    "width_', c, '":  ', f(L.classW[c]), ',      # ratio ',
        f(L.ratios[c], 5), ' of a white');
    p('    "slot_delta":   ', f(L.delta), ',');
    if (XM.keyScaleCount(d)) {
      const ks = Object.keys(d.keyScale).sort();
      p('    # keys resized by hand, on top of their class: "w<i>" a white,');
      p('    # "a<i>" the gap after white i (both halves of a split share it)');
      p('    "key_scales":   {', ks.map(k =>
        '"' + k + '": ' + f(XM.keyScale(d, k), 5)).join(', '), '},');
    }
    p('}');
    p('');
    p('# --- world placement -----------------------------------------------------');
    p('WORLD_X0 = ', pn(O.x0), '      # X_world = x + WORLD_X0');
    p('WORLD_Y0 = ', pn(O.y0), '      # Y_world = WORLD_Y0 - y');
    p('WORLD_Z0 = ', pn(O.z0), '      # Z_world = z + WORLD_Z0');
    p('ORIGIN   = "', O.mode, '"        # ', ORIGIN_MODES[O.mode]);
    p('');
    p('# --- what stands in each gap ---------------------------------------------');
    p('# There is no repeating pattern behind this and no lean on any gap: each');
    p('# one sits at the plain midpoint between its two whites, so every white');
    p('# key is the same key and every waist is the same width.');
    p('# Gap i is the gap AFTER white i. The two END gaps have a white on one');
    p('# side only -- gap -1 comes before white 0, and the gap after the last');
    p('# white finishes the keyboard -- and the white beside an end gap is');
    p('# widened outward to its far edge, so it stands under the whole of it.');
    p('GAPS = {');
    for (const k of Object.keys(L.design.slots || {}).sort((a, b) => a - b)) {
      const t = (L.design.slots || {})[k];
      if (!t || !t.length) continue;
      p('    ', k, ': [', t.map(n => '"' + n + '"').join(', '), '],');
    }
    p('}');
    p('');

    /* --- key table ---------------------------------------------------- */
    p('# --- the 32 keys, left to right, one per sensor foot -------------------');
    p('# (name, type, x_centre, width, depth, profile,');
    p('#  world_x, world_y_back, world_z_bottom, foot_x, arm_x, lap, half)');
    p('# "profile" names the drafted key this one is instantiated from.  For a');
    p('# white it carries the neighbour context "<leftBias>|<rightBias>" ("n" =');
    p('# that slot is empty), because the drafted whites rib differently');
    p('# depending on what sits beside them.');
    p('# KEYS is always exactly 32 entries long. KEYS[i] belongs to FEET[i].');
    p('# `lap` is where that key\'s tongue carries on THROUGH the spine face and');
    p('# into its own band — (x0, x1, y0, y1, z0, z1) boxes, normally one, two');
    p('# only for a key straddling the A/B seam.  See build_key.');
    p('# `half` is the spine half the key hangs off — the half its FOOT is on.');
    p('# Its tongue is cut off flush at that half\'s x edge: past there the');
    p('# tongue is over the 1.29 mm of air between the halves, or over the');
    p('# OTHER half, which is a separate piece it must never touch.  See A');
    p('# TONGUE THAT READS NO SPINE IS NOT A TONGUE in model.js.');
    p('# "arm_x" places the two arms of the key\'s underside "-| |-" on their');
    p('# own bars, in x: one value per stem line ("arm_a"/"arm_b" in the profile');
    p('# below), so the pair lands on the stems of the sensor press standing');
    p('# under it and is ', pn(XM.PAIR.stem), ' mm wide whatever this key\'s width is.');
    p('# The arms are drafted where the key was drawn over its own sensor, and');
    p('# some are drafted as a fraction of the key rather than a millimetre off');
    p('# its centreline — neither survives a change of layout.  Nothing else of');
    p('# the key moves — see THE KEY\'S OWN ARMS in model.js.');
    p('KEYS = [');
    /* the object name each key is given, so PARITY below can be written
     * against the very names build() will hand to make_mesh_object */
    const objName = new Map();
    /* the sibling land a split half needs before its press — and so its
     * arms — can be placed; pairKeys is where that pairing is worked out */
    const armSib = new Map();
    for (const k of pairKeys(L)) armSib.set(k.index, k.sib);
    for (const n of L.notes) {
      const r = n.ref;
      const spec = XM.KEY_TYPES[n.type];
      const white = spec.kind === 'white';
      const w = r.w || (white ? L.wW : L.aW);
      const e = XM.keyExtent(r.cx, w, n.type, white ? r.ctxL : null, white ? r.ctxR : null);
      const nm = 'K' + String(n.index).padStart(2, '0') + '_' +
        (n.kind === 'white' ? 'W' + r.i
                            : 'A' + r.slot + '_' + (r.ord + 1));
      objName.set(n.type + '@' + Math.round(r.cx * 1e4), nm);
      const lb = white ? r.ctxL : null, rb = white ? r.ctxR : null;
      const bs = XM.keyBackSpan(r.cx, w, n.type, lb, rb);
      const lap = bs ? XM.tongueLaps(L.spineKind, spec.layer, bs, r.half) : [];
      p('    ("', nm, '", "', n.type, '", ',
        pn(r.cx), ', ', pn(w), ', ', f(e.y1 - e.y0), ', "', n.profileKey, '", ',
        f(r.cx + W.x0, 4), ', ', f(W.y0, 4), ', ', f(e.z0 + W.z0), ', ',
        r.foot == null ? 'None' : f(r.foot + W.x0, 4), ', ',
        (function (P) {
          return P ? '(' + pn(P[0]) + ', ' + pn(P[1]) + ')' : 'None';
        })(r.foot == null ? null
           : XM.armPlaceFor(r.cx, w, n.type, lb, rb, r.foot, armSib.get(n.index))),
        ', [', lap.map(q => '(' + [q.x0, q.x1, q.y0, q.y1, q.z0, q.z1]
                                    .map(pn).join(', ') + ')').join(', '), '], "',
        r.half === 'B' ? 'B' : 'A', '"),');
    }
    p(']');
    p('');

    /* --- spine + feet ------------------------------------------------- */
    p('# --- spine --------------------------------------------------------------');
    p('# This design places ', L.spineColours.length, ' key colour',
      L.spineColours.length === 1 ? '' : 's', ' (', L.spineColours.join(', '),
      '), so it takes the');
    p('# ', L.spineKind, '-type spine: one slab per colour, each key\'s rear tongue');
    p('# plugging into the layer belonging to its own colour.  Gray always takes');
    p('# all three layers — its tongue is the bottom band and black\'s sits above');
    p('# it, so the two are stacked rather than alternatives.');
    p('# Halves A and B were drafted separately and their layer bands differ by');
    p('# up to 0.011 mm, so each half carries its own faces and its own stack —');
    p('# read verbatim out of "', L.spineKind, ' type Spine - A" / "- B".');
    p('SPINE = {');
    p('    "y_back": ', pn(XM.SPINE.yBack), ', "y_front": ', pn(XM.SPINE.yFront),
      ',   # nominal; per-half faces below');
    p('    "halves": [   # (half, x0, x1, y_back, y_front, layers)');
    p('                  # 16 sensor feet each, and only ever these two');
    for (const [hn, half] of XM.spineHalves()) {
      p('        ("', hn, '", ', pn(half.x0), ', ', pn(half.x1), ', ',
        pn(half.yBack), ', ', pn(half.yFront), ', [');
      /* the SEPARATED bands, not the raw drafted ones: half A drafts black
       * topping out at 6.10034 and white starting at 6.07824, and half B is
       * worse — 284.8 mm3 of solid shared between gray and black.  Invisible
       * on the sheet, fatal to a print. */
      for (const lay of XM.spineBands(L.spineKind, hn))
        p('            ("', lay.name, '", ', pn(lay.z0), ', ', pn(lay.z1),
          '),   # drafted ', f(lay.z0Drafted, 5), ' .. ', f(lay.z1Drafted, 5));
      p('        ]),');
    }
    p('    ],');
    p('    # Where each band reaches FORWARD into the keys of its own colour,');
    p('    # so that a comb unions into one solid instead of two coplanar');
    p('    # faces a boolean solver cannot join.  (layer, x0, x1, z0, z1) —');
    p('    # z is the TONGUE\'s own, the drafted band clipped to it.');
    p('    #');
    p('    # "fillet" is the 45-degree gusset that USED to be laid in the');
    p('    # corner where a tongue meets the spine.  Nothing builds it now —');
    p('    # not model.js, not this file: the joint is the boss and the lap,');
    p('    # and the ramp only put a visible edge on a face meant to read');
    p('    # flush.  The number is kept on record, and so is the shape, in');
    p('    # push_root_fillet below.');
    p('    "boss_depth": ', pn(XM.FIT.engage), ',');
    p('    "fillet": ', pn(XM.FIT.fillet), ',');
    p('    "gap":    ', pn(XM.FIT.gap), ',   # clearance between colours');
    p('    "boss": [');
    for (const b of spineBossSpans(L))
      p('        ("', b.layer, '", ', pn(b.x0), ', ', pn(b.x1), ', ',
        pn(b.z0), ', ', pn(b.z1), '),');
    p('    ],');
    p('    # the PCB channel: a full-length slot in the underside of each');
    p('    # half, open at both x ends, ceiling at z = ', pn(XM.SPINE.channel.zTop));
    p('    "channel": {   # half -> (y_back_edge, y_front_edge)');
    for (const [hn] of XM.spineHalves())
      p('        "', hn, '": (', pn(XM.SPINE.channel[hn].y0), ', ',
        pn(XM.SPINE.channel[hn].y1), '),');
    p('    },');
    p('    "channel_z": ', pn(XM.SPINE.channel.zTop), ',');
    p('    # THE RIBBON CABLE COMES OUT OF THE BACK OF HALF A.  One rectangle');
    p('    # is taken out of that half\'s back edge, the full height of the');
    p('    # stack so the notch reads the same in every band, and deeper than');
    p('    # the channel\'s back wall so the channel opens straight out of the');
    p('    # back rather than into a blind pocket.  Half B is untouched: one');
    p('    # exit, on the side the cable is on.  (half, x0, x1, depth)');
    p('    "ribbon": ("', XM.RIBBON.half, '", ', pn(XM.RIBBON.x0), ', ',
      pn(XM.RIBBON.x1), ', ', pn(XM.RIBBON.depth), '),');
    p('    # 8 obround mounting holes per half — NOT rectangles.  The bottom');
    p('    # layer takes the wide bore, every layer above it the narrow one.');
    p('    "hole_r": (', pn(XM.SPINE.hole.rLower), ', ', pn(XM.SPINE.hole.rUpper), '),');
    p('    "hole_straight": ', pn(XM.SPINE.hole.straight), ',');
    p('    "hole_seg": ', XM.SPINE.hole.seg, ',');
    p('    # unit ring: (which half-circle, cos, sin), CCW — the browser\'s own doubles');
    p('    "hole_unit": [');
    for (const u of XM.HOLE_UNIT)
      p('        (', u[0], ', ', pn(u[1]), ', ', pn(u[2]), '),');
    p('    ],');
    for (const [tbl, nm] of [[XM.SPINE.holesLower, 'holes_lower'],
                             [XM.SPINE.holesUpper, 'holes_upper']]) {
      p('    "', nm, '": {');
      for (const [hn] of XM.spineHalves())
        p('        "', hn, '": [',
          tbl[hn].map(c => '(' + pn(c[0]) + ', ' + pn(c[1]) + ')').join(', '), '],');
      p('    },');
    }
    p('}');
    p('');
    p('# --- the 32 sensor feet (16 on half A, 16 on half B) --------------------');
    p('FEET = [');
    const fc = L.feet;
    for (let i = 0; i < fc.length; i += 8)
      p('    ', fc.slice(i, i + 8).map(v => pn(v)).join(', '), ',');
    p(']');
    p('assert len(KEYS) == 32, "this keyboard has exactly 32 keys"');
    p('assert len(FEET) == 32, "one AKM320: 16 feet on half A, 16 on half B"');
    p('');

    /* --- foot loop pairs ---------------------------------------------- */
    const bkeys = pairKeys(L);
    const audit = XM.pairAudit(bkeys);
    p('# --- FOOT LOOP PAIRS ----------------------------------------------------');
    p('# The two loops that state the relationship between a key and ITS OWN');
    p('# sensor foot (KEYS[i] -> FEET[i]).  They are NOT objects: a loop has no');
    p('# volume, so nothing here builds one on its own and no STL could carry');
    p('# it.  They are the two ends of the sensor press, which is the solid');
    p('# built between them — see build_press.');
    p('#');
    p('#   PAD FACE    the drafted "-| |-" exactly as "Feet - A" / "Feet - B"');
    p('#               draw it, flat at z = ', pn(XM.FOOT.z),
      '.  Two n-gons, 16 vertices,');
    p('#               the window between the bars left open for the dome.');
    p('#   PAIR FACE   the face popped off the key\'s own underside deck, in');
    p('#               the "Raised Feet (Pair)" collection: the SAME "-| |-",');
    p('#               with its CROSSBAR spanning the full width of that key\'s');
    p('#               deck, a ', pn(XM.PAIR.stem),
      ' mm stem centred on it, and the 2 mm dome');
    p('#               window between the bars.  The y values are drafted, not');
    p('#               fitted — three profiles cover all 32 keys (see');
    p('#               PAIR_SHAPE in model.js): the full 14.0 mm reach, the');
    p('#               Second half of a split pair, and the 10.25 mm short');
    p('#               shape the First half gets because its key ends sooner.');
    p('#               A split pair divides its slot with ', pn(XM.PAIR.split),
      ' mm of air.');
    p('#   X CLEAR     the raised loop never overhangs its own sensor pad in x.');
    p('#               Where the key\'s belly is wider than the pad, or offset');
    p('#               from it, the crossbar ENDS are pulled back to the pad\'s');
    p('#               own x extremes; the stem keeps its width and its place,');
    p('#               and only slides when the clamped bar would leave it');
    p('#               behind.  Drafted by hand in "X compensation clearance');
    p('#               .blend" and generalised here — so a press stands over');
    p('#               its own sensor instead of leaning into the next slot.');
    p('#   PRESS       the two loops closed into a solid: one prism per bar,');
    p('#               a single quad band from the pad ring to the pair ring');
    p('#               vertex for vertex, capped at BOTH ends.  Watertight,');
    p('#               and the window between the bars is never filled, so');
    p('#               the dome keeps its clearance the whole way up.  A');
    p('#               press prints as part of its key, in its key\'s');
    p('#               filament, so it carries the key\'s colour.');
    p('#');
    p('# MEASURED, not assumed — this design, as built:');
    p('#   every pair face lies in a real deck     ', audit.seated ? 'YES' :
      'NO  (key ' + audit.unseatedAt + ')');
    p('#   every raised loop inside its own pad    ', audit.xClear ? 'YES' :
      'NO  (' + f(audit.xOverhang, 3) + ' mm over, keys ' +
      audit.xOverhangAt.join(', ') + ' — those keys sit off their feet)');
    p('#   least air from a pad to its pair face   ', f(audit.minRise, 3),
      ' mm  (key ', audit.riseAt, ')');
    p('#   narrowest air between two pair faces    ', f(audit.minGap, 3), ' mm');
    p('#   every press closes into a solid         ',
      audit.watertight ? 'YES' :
      'NO  (key ' + (audit.leakyAt != null ? audit.leakyAt : audit.invertedAt) + ')');
    p('#   filament the 32 presses add             ', f(audit.pressVolume, 1), ' mm3');
    p('#   least air over a foreign sensor pad     ',
      audit.overForeign == null ? 'n/a' : f(audit.overForeign, 3), ' mm',
      audit.clearsTravel ? '   (clears travel + margin)'
                         : '   *** BELOW travel + margin ***');
    p('PAIR = {');
    p('    "travel": ', pn(XM.PAIR.travel), ',   # AKM320 rubber-dome travel');
    p('    "margin": ', pn(XM.PAIR.margin), ',   # air on top of the travel');
    p('    "stem":   ', pn(XM.PAIR.stem), ',   # width of the "-| |-" stem, drafted');
    p('    "split":  ', pn(XM.PAIR.split), ',   # air between the halves of a split pair');
    p('}');
    p('');
    p('# (name, key colour, foot_x, [(z, ring), (z, ring)])');
    p('# One entry per key.  `ring` is that bar\'s pair face, index-matched to');
    p('# FOOT_SHAPE_F / foot_outline(), and `z` is the key deck plane it lies');
    p('# in.  The colour is the key\'s: a pair face belongs to its key, even');
    p('# though it is drawn with the foot.');
    p('PAIRS = [');
    for (const k of bkeys) {
      const faces = XM.pairFaces(k.cx, k.w, k.type, k.lb, k.rb, k.foot, k.sib);
      if (!faces) continue;
      p('    ("Pair_', String(k.index).padStart(2, '0'), '", "', k.layer, '", ',
        pn(k.foot), ', [');
      for (const fc of faces)
        p('        (', pn(fc.z), ', [',
          fc.ring.map(v => '(' + pn(v[0]) + ', ' + pn(v[1]) + ')').join(', '), ']),');
      p('    ]),');
    }
    p(']');
    p('assert len(PAIRS) == 32, "one loop pair per key"');
    p('');

    /* ---- PARITY -----------------------------------------------------
     * This file and the browser build the same objects out of the same
     * numbers, and the STLs are those same objects folded at the spine
     * seam and turned face-down for a bed — nothing else differs.  That
     * only stays true if the two builders stay in step, and they are two
     * separate bodies of code, so it is checked rather than trusted: one
     * digest per object, computed on the browser's own triangles and
     * recomputed here as each object is made.  Drift is caught at build
     * time, by name, instead of in a slicer. */
    p('# --- PARITY -------------------------------------------------------------');
    p('# One checksum per object, over the browser\'s own triangles, quantised');
    p('# to a nanometre.  make_mesh_object recomputes each as it builds and');
    p('# stops on a mismatch: this file and the WebGL preview are meant to');
    p('# produce the same meshes, and the exported STLs are those same meshes');
    p('# folded at the spine seam and laid face-down on a bed.  If model.js and');
    p('# this builder ever drift apart, the build says so here.');
    p('PARITY = {');
    for (const [nm, tris] of parityObjects(L, objName))
      p('    "', nm, '": ', XM.meshChecksum(tris), ',');
    p('}');
    p('');

    if (L.warnings.length) {
      p('# --- warnings on this design -------------------------------------------');
      for (const w of L.warnings) p('#   ! ', w);
      p('');
    }

    /* --- builder ------------------------------------------------------ */
    p(builderSource(L, seen));
    return out.join('\n');
  }
  /* ------------------------------------------------------------------ *
   *  THE GENERATED BUILDER                                              *
   *                                                                     *
   *  The Python below is a line-for-line port of the mesh code in        *
   *  model.js — the same code the WebGL preview runs.  Every constant    *
   *  is injected from XM rather than retyped, and every number goes      *
   *  through pn(), so Blender evaluates the identical doubles the        *
   *  browser did.  Run the log and you get the preview: same parts,      *
   *  same vertices, same faces.                                         *
   * ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ *
   *  THE GENERATED BUILDER                                              *
   *                                                                     *
   *  The Python below runs the same code the WebGL preview runs: the     *
   *  drafted key profiles instantiated at this design's widths, plus the *
   *  spine and feet.  Every number is written at full double precision,  *
   *  and the profile table is copied verbatim from profiles.js, so       *
   *  Blender evaluates the identical doubles the browser did.           *
   * ------------------------------------------------------------------ */

  /**
   * EVERY OBJECT THE BLENDER BUILD MAKES, named as build() will name it and
   * built exactly as buildMeshes builds it for the STLs — the keys with
   * their arms placed, the spine with its bosses and root gussets, and the
   * sensor presses.  Used only to write PARITY; the meshes themselves are
   * thrown away.
   */
  function parityObjects(L, objName) {
    const out = [];
    const bkeys = pairKeys(L);
    const arms = armTargets(bkeys);
    const laps = lapTargets(L, bkeys);
    const key = k => objName.get(k.type + '@' + Math.round(k.cx * 1e4));
    /* WITH THE TONGUE CLIPPED TO ITS OWN HALF, exactly as buildMeshes does
     * it — see A TONGUE THAT READS NO SPINE IS NOT A TONGUE in model.js.
     * Left off, this wrote a checksum for a key nothing builds: the STLs
     * carry the clipped key and the Blender scene would have carried the
     * overhang, and the parity check would have blessed the pair. */
    for (const w of L.whites)
      out.push([key(w), XM.buildKey(w.cx, w.w, w.type, w.ctxL, w.ctxR, null,
                                    arms.get(armKey(w.type, w.cx)),
                                    laps.get(armKey(w.type, w.cx)),
                                    XM.spineHalfSpan(w.half))]);
    for (const sl of L.slots)
      for (const m of sl.members)
        out.push([key(m), XM.buildKey(m.cx, m.w, m.type, null, null, null,
                                      arms.get(armKey(m.type, m.cx)),
                                      laps.get(armKey(m.type, m.cx)),
                                      XM.spineHalfSpan(m.half))]);
    for (const p of XM.spineParts(L.spineKind, keySpans(L)))
      out.push([p.name, p.tris]);
    for (const p of XM.pressParts(bkeys)) out.push([p.name, p.tris]);
    return out.filter(e => e[0]);
  }

  /** the profiles this design actually uses, keyed for the Python table */
  function usedProfiles(L) {
    const seen = new Map();
    const idOf = (type, lb, rb) => {
      const key = type + '|' + XM.ctxKey(lb, rb);
      if (!seen.has(key))
        seen.set(key, { key, type, q: XM.profileFor(type, lb, rb) });
      return key;
    };
    for (const n of L.notes) {
      const r = n.ref;
      n.profileKey = n.kind === 'white'
        ? idOf(n.type, r.ctxL, r.ctxR)
        : idOf(n.type, null, null);
    }
    return seen;
  }

  function pyProfiles(seen) {
    const rows = [];
    for (const { key, q } of seen.values()) {
      rows.push('    "' + key + '": {');
      rows.push('        "nv": ' + q.p.nv + ', "mirror": ' + (q.mirror ? 'True' : 'False') + ',');
      rows.push('        "v": [' + Array.from(q.p.v).map(pn).join(',') + '],');
      rows.push('        "f": [' + Array.from(q.p.f).join(',') + '],');
      const A = XM.armLines(q.p);
      rows.push('        "arm_a": [' + (A ? A.a.join(',') : '') + '],');
      rows.push('        "arm_b": [' + (A ? A.b.join(',') : '') + '],');
      rows.push('    },');
    }
    return 'KEY_PROFILES = {\n' + rows.join('\n') + '\n}';
  }

  function pyLayers() {
    const rows = XM.TYPE_ORDER.map(n =>
      '    "' + n + '": "' + XM.KEY_TYPES[n].layer + '",');
    return 'KEY_LAYER = {\n' + rows.join('\n') + '\n}';
  }

  function pyColours() {
    const rows = Object.keys(XM.COLORS).map(k =>
      '    "' + k + '": (' + XM.COLORS[k].map(pn).join(', ') + '),');
    /* the spine bands are not one colour: each layer carries the material
     * its object has in the drafting sandbox.  Linear base colours, i.e.
     * exactly what Blender stores.                                       */
    const S = XM.SPINE_LAYER_COLORS;
    const srows = Object.keys(S).map(kind =>
      '    "' + kind + '": {\n' + Object.keys(S[kind]).map(lay =>
        '        "' + lay + '": (' + S[kind][lay].linear.map(pn).join(', ') +
        '),   # ' + (S[kind][lay].material || 'no material — Blender default')
      ).join('\n') + '\n    },');
    return 'COLOURS = {\n' + rows.join('\n') + '\n}\n\n' +
      '# base colour of every layer of "<kind> type Spine - A / - B"\n' +
      'SPINE_LAYER_COLOURS = {\n' + srows.join('\n') + '\n}';
  }

  function builderSource(L, seen) {
    return `# =========================================================================
# BUILDER — the designer's own geometry, as Python
#
# Key meshes are not modelled here and they are not modelled in the browser
# either: they ARE the drafted keys out of the 15 / 17 / 19 Layout
# collections, stored per vertex as
#
#     x = alpha + beta * width          y, z constant
#
# and instantiated at this design's widths.  Whites carry one profile per
# neighbour context, because the drafted whites rib differently depending on
# which slots sit either side of them.  Only the profiles this design uses
# are written out.
#
# Run this in Blender and you get the WebGL preview: the same parts, the same
# vertices, the same faces, in the same places — and the same objects the
# exported STLs carry, every one of them, checked object by object against
# the browser's own checksums (see PARITY above).  An STL differs from this
# scene ONLY in where the parts stand: it is folded at the spine seam into
# two rows and turned playing-face down for a print bed, and it is merged
# into one mesh per filament colour.  Nothing about the geometry changes in
# the move, and there is nothing in the one that is not in the other.
#
# There is no "Feet" collection.  A sensor foot is not an object: its pad
# face and the key's pairing loop have no thickness and no volume, so no
# STL could carry them.  Both loops are still here as the two ends of the
# sensor press, which is the solid built between them.
#
# Set USE_BLEND_CATEGORIES = True to duplicate the sandbox's own objects
# instead.  That only works inside the drafting .blend, and it is no longer
# more accurate than building from the profiles — it is the same geometry.
# =========================================================================
import math

import bpy
from mathutils import Vector

TARGET_COLLECTION    = "Keyboard Generated"
ROOT_EMPTY           = "Keyboard Root"
CATEGORY_COLLECTION  = "Key Type Categories"
USE_BLEND_CATEGORIES = False

# The drafting sandbox datum.  Used only by the USE_BLEND_CATEGORIES path,
# to lift the sheet's geometry onto whatever origin this log was cut for.
SHEET_X0, SHEET_Y0, SHEET_Z0 = ${pn(XM.WORLD.x0)}, ${pn(XM.WORLD.y0)}, ${pn(XM.WORLD.z0)}

FOOT_W, FOOT_D   = ${pn(XM.FOOT.w)}, ${pn(XM.FOOT.d)}
FOOT_YC, FOOT_Z  = ${pn(XM.FOOT.yCentre)}, ${pn(XM.FOOT.z)}
FIT_ENGAGE       = ${pn(XM.FIT.engage)}   # overlap that makes a comb one solid
FIT_LAP          = ${pn(XM.FIT.lap)}   # how far a tongue carries on past the spine face
FIT_GAP          = ${pn(XM.FIT.gap)}   # clearance between the stacked bands
BACK_Y           = ${pn(XM.BACK_Y)}   # where a key ends; its tongue is all that is behind

# THE FOOT IS NOT A RECTANGLE.  "Feet - A" / "Feet - B" draw all 32 feet as
# one shape and it is the "-| |-": two mirrored T's, each a full-width
# crossbar with a 1.0 mm central stem reaching out to the pad edge.  16
# vertices, 2 n-gon faces, verbatim, as (x from the pad's left edge, y from
# the pad's BACK edge) in design y.
FOOT_SHAPE_V = [${XM.FOOT_SHAPE.v.map(p => '(' + pn(p[0]) + ', ' + pn(p[1]) + ')').join(', ')}]
FOOT_SHAPE_F = [${XM.FOOT_SHAPE.f.map(r => '(' + r.join(', ') + ')').join(', ')}]
# The mounting holes are obrounds and the spine underside is channelled;
# both live in SPINE above, read verbatim out of the drafting sandbox.

${pyLayers()}

${pyColours()}

LAYER_PART = {"white": "Keys - White", "black": "Keys - Black", "gray": "Keys - Gray"}

# --- the drafted key profiles used by this design ------------------------
# "v" is [alpha, beta, y, z] per vertex; "f" is [n, i0..in-1] face runs.
${pyProfiles(seen)}


# =========================================================================
# FACE TRIANGULATION — ear clipping, NOT a fan
#
# The drafted faces are n-gons and many of them are CONCAVE: the step a
# white key takes around its neighbouring accidentals is cut into the key's
# own top, underside and shoulder faces, so those polygons have reflex
# corners by construction.  A fan from vertex 0 is only valid on a convex
# polygon; on these it lays triangles straight across the notch — a wall
# joining two corners that nothing joins in the sheet, and on a white key
# it paves over the very clearance the key is cut back to provide.
#
# This is a literal transliteration of triangulateFace() in model.js, so
# the Blender build, the WebGL preview and the exported STLs stay the same
# mesh, triangle for triangle.
# =========================================================================
TRI_EPS = 1e-9


def _tri2(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _in_tri2(p, a, b, c):
    # strictly inside — a point exactly on an edge does not block the ear
    return (_tri2(a, b, p) > TRI_EPS and
            _tri2(b, c, p) > TRI_EPS and
            _tri2(c, a, p) > TRI_EPS)


def triangulate_face(V, ring):
    """ring is a list of indices into V; returns index triples wound to
    match the face's own (Newell) normal."""
    m = len(ring)
    if m < 3:
        return []
    if m == 3:
        return [(ring[0], ring[1], ring[2])]

    nx = ny = nz = 0.0
    for i in range(m):
        a = V[ring[i]]
        b = V[ring[(i + 1) % m]]
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    ax, ay, az = abs(nx), abs(ny), abs(nz)

    # drop the dominant axis; the remaining pair is cyclic, so the sign of
    # the 2-D signed area is the sign of that axis' normal component
    if az >= ax and az >= ay:
        pick = lambda p: (p[0], p[1]); sign = nz
    elif ay >= ax:
        pick = lambda p: (p[2], p[0]); sign = ny
    else:
        pick = lambda p: (p[1], p[2]); sign = nx

    P = [pick(V[i]) for i in ring]
    flip = sign < 0.0
    poly = [(m - 1 - i) if flip else i for i in range(m)]
    out = []

    def emit(i0, i1, i2):
        if flip:
            out.append((ring[i2], ring[i1], ring[i0]))
        else:
            out.append((ring[i0], ring[i1], ring[i2]))

    guard = 4 * m * m + 16
    while len(poly) > 3 and guard > 0:
        guard -= 1
        clipped = False
        for i in range(len(poly)):
            n = len(poly)
            i0, i1, i2 = poly[i], poly[(i + 1) % n], poly[(i + 2) % n]
            a, b, c = P[i0], P[i1], P[i2]
            if _tri2(a, b, c) <= TRI_EPS:
                continue                       # reflex or degenerate
            blocked = False
            for j in range(n):
                q = poly[j]
                if q == i0 or q == i1 or q == i2:
                    continue
                if _in_tri2(P[q], a, b, c):
                    blocked = True
                    break
            if blocked:
                continue
            emit(i0, i1, i2)
            del poly[(i + 1) % n]
            clipped = True
            break
        if clipped:
            continue
        # No ear this pass — the drafted polygon is degenerate here (a
        # collinear run) or self-intersecting in its own plane, which a few
        # sheet faces are.  Clip the least-bad corner anyway and EMIT it: a
        # zero-area triangle costs nothing and keeps every boundary edge
        # paired, so the key stays watertight for the slicer.
        bi, bs = 0, -1e300
        for i in range(len(poly)):
            n = len(poly)
            s = _tri2(P[poly[i]], P[poly[(i + 1) % n]], P[poly[(i + 2) % n]])
            if s > bs:
                bs, bi = s, i
        n = len(poly)
        emit(poly[bi], poly[(bi + 1) % n], poly[(bi + 2) % n])
        del poly[(bi + 1) % n]
    if len(poly) == 3:
        emit(poly[0], poly[1], poly[2])
    else:
        for i in range(1, len(poly) - 1):
            emit(poly[0], poly[i], poly[i + 1])
    return out


# =========================================================================
# KEY GEOMETRY — a drafted profile, instantiated
# =========================================================================
# =========================================================================
# T-JUNCTIONS
#
# A drafted profile's faces do not all share their corners: one face's edge
# can run past the corner of the face next to it, so the two meet along a
# T rather than along a shared edge.  Triangulated as they are, that leaves
# an edge used once on one side and twice on the other -- an open edge, and
# a slicer will not call the part closed.  The fix is to split the long
# edge at the point standing on it, which is what weld_t_junctions does.
#
# This is model.js's weldTJunctions, line for line, INCLUDING the quantised
# point key: Math.round is floor(v + 0.5), not Python's banker's round, and
# the edge key is compared as a STRING, so the two builders walk the open
# edges in the same order and split them into the same triangles.
# =========================================================================
WELD_TOL = 1e-5


def _weld_key(p):
    return "%d,%d,%d" % (math.floor(p[0] / WELD_TOL + 0.5),
                         math.floor(p[1] / WELD_TOL + 0.5),
                         math.floor(p[2] / WELD_TOL + 0.5))


def open_edge_set(t):
    """the directed edges used exactly once by the triangle soup t"""
    n = {}
    for i in range(0, len(t), 3):
        v = (_weld_key(t[i]), _weld_key(t[i + 1]), _weld_key(t[i + 2]))
        for j in range(3):
            a, b = v[j], v[(j + 1) % 3]
            if a == b:
                continue
            u = (a + "|" + b) if a < b else (b + "|" + a)
            n[u] = n.get(u, 0) + 1
    return [u for u, c in n.items() if c == 1]


def weld_t_junctions(t):
    for _ in range(6):
        opened = open_edge_set(t)
        if not opened:
            break
        open_set = set(opened)
        # the only points that can split an open edge are points already
        # standing on one -- the far side of the same T
        cand = {}
        for i in range(0, len(t), 3):
            for j in range(3):
                k = _weld_key(t[i + j])
                if k not in cand:
                    cand[k] = t[i + j]
        on_open = {}
        for u in opened:
            a, b = u.split("|")
            on_open[a] = True
            on_open[b] = True
        pts = [(k, cand[k]) for k in on_open if k in cand]

        out = []
        changed = False
        for i in range(0, len(t), 3):
            V = (t[i], t[i + 1], t[i + 2])
            KK = (_weld_key(V[0]), _weld_key(V[1]), _weld_key(V[2]))
            best = None
            for e in range(3):
                a, b = V[e], V[(e + 1) % 3]
                ka, kb = KK[e], KK[(e + 1) % 3]
                u = (ka + "|" + kb) if ka < kb else (kb + "|" + ka)
                if u not in open_set:
                    continue
                dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
                l2 = dx * dx + dy * dy + dz * dz
                if l2 < WELD_TOL * WELD_TOL:
                    continue
                hit = []
                for (qk, qp) in pts:
                    if qk == ka or qk == kb:
                        continue
                    px, py, pz = qp[0] - a[0], qp[1] - a[1], qp[2] - a[2]
                    sp = (px * dx + py * dy + pz * dz) / l2
                    if not (sp > 1e-9 and sp < 1.0 - 1e-9):
                        continue
                    ex, ey, ez = px - sp * dx, py - sp * dy, pz - sp * dz
                    if ex * ex + ey * ey + ez * ez > WELD_TOL * WELD_TOL:
                        continue
                    hit.append((sp, qp))
                if hit and (best is None or len(hit) > len(best[1])):
                    best = (e, hit)
            if best is None:
                out.append(V[0]); out.append(V[1]); out.append(V[2])
                continue
            changed = True
            e, hit = best
            # fan from the corner OPPOSITE the edge being split: every piece
            # keeps the parent's winding and none of them is degenerate
            hit.sort(key=lambda h: h[0])
            a, b, c = V[e], V[(e + 1) % 3], V[(e + 2) % 3]
            chain = [a] + [h[1] for h in hit] + [b]
            for j in range(len(chain) - 1):
                out.append(chain[j]); out.append(chain[j + 1]); out.append(c)
        t = out
        if not changed:
            break
    return t


# =========================================================================
# A TONGUE THAT READS NO SPINE IS NOT A TONGUE
#
# A key hangs off the spine half its own colour's band is on, and the two
# halves are 1.29 mm apart with nothing bridging them.  A key standing over
# the seam still gets its full drafted tongue, so the part of it past its own
# half's end hangs in that air -- and then over the OTHER half, whose band is
# a different piece it must never touch.  The same is true at the two outer
# ends of the instrument.
#
# So the tongue is cut off flush at its half's edge.  Every key type draws it
# as the same thing -- an axis-aligned box behind the key's back face,
# y 0 .. BACK_Y, over the colour's own tongue band, and the ONLY thing any
# key has behind that face -- so the cut is exact: the box is rebuilt over
# the span that is left, and the back face is closed across the span the
# tongue no longer passes through.  No boolean solver is involved, here or in
# the browser: the shape being cut is known, so the cut is drawn.
# =========================================================================
def spine_half_span(half):
    """the x span of one spine half, by name -- what a tongue on it may reach"""
    for (hname, hx0, hx1, hy_back, hy_front, layers) in SPINE["halves"]:
        if hname == half:
            return (hx0, hx1)
    return None


def clip_tongue_x(t, span):
    """Clip a key's tongue to span (x0, x1) in x.  t is the key's triangle
    soup as (x, y, z) points, three to a triangle; returns it with the
    overhang gone, still closed."""
    if not span:
        return t
    eps = 1e-4
    # the tongue is everything BEHIND the back face; its own section is read
    # off the y = 0 end, which is the one place nothing else reaches
    x0, x1 = float("inf"), float("-inf")
    z0, z1 = float("inf"), float("-inf")
    any_behind = False
    keep = []
    for i in range(0, len(t), 3):
        tri = t[i:i + 3]
        if not any(p[1] < BACK_Y - eps for p in tri):
            keep.extend(tri)
            continue
        any_behind = True
        for p in tri:
            if p[1] > eps:
                continue                          # the y = 0 end only
            x0, x1 = min(x0, p[0]), max(x1, p[0])
            z0, z1 = min(z0, p[2]), max(z1, p[2])
    if not any_behind or not x1 - x0 > eps or not z1 - z0 > eps:
        return t
    a, b = max(x0, span[0]), min(x1, span[1])
    if a - x0 < eps and x1 - b < eps:
        return t                                  # nothing overhangs
    T = BACK_Y
    # the tongue, rebuilt over what is left -- an OPEN prism, because the
    # back face it grows out of is still the key's own
    if b - a > eps:
        push_quad(keep, (b, 0.0, z1), (a, 0.0, z1), (a, 0.0, z0), (b, 0.0, z0))
        push_quad(keep, (b, 0.0, z0), (a, 0.0, z0), (a, T, z0), (b, T, z0))
        push_quad(keep, (a, 0.0, z1), (b, 0.0, z1), (b, T, z1), (a, T, z1))
        push_quad(keep, (b, T, z1), (b, 0.0, z1), (b, 0.0, z0), (b, T, z0))
        push_quad(keep, (a, 0.0, z0), (a, 0.0, z1), (a, T, z1), (a, T, z0))

    # and the back face closes over every millimetre the tongue used to pass
    # through and no longer does -- which is the whole of it when the key
    # reaches no spine at all
    def patch(p, q):
        if q - p > eps:
            push_quad(keep, (q, T, z1), (p, T, z1), (p, T, z0), (q, T, z0))

    if b - a > eps:
        patch(x0, a)
        patch(b, x1)
    else:
        patch(x0, x1)
    return keep


def build_key(cx, w, prof, arm_x=None, laps=(), span=None):
    """A drafted profile instantiated at this key's width, with the two arms
    of its underside "-| |-" placed at arm_x -- one x per stem line -- so they
    stand on the sensor press, the drafted stem width whatever this key's width
    is.  Only the vertices on the two stem lines move, and only in x; see THE
    KEY'S OWN ARMS in model.js.

    laps are the boxes that carry this key's tongue on THROUGH the spine's
    front face and into the band it belongs to, so the key's solid crosses
    into the spine's instead of arriving at it on a coincident plane.  They
    are part of the KEY, in the key's own filament.

    span is the x reach of the spine half this key hangs off; the tongue is
    cut off flush there -- see clip_tongue_x."""
    v, n, mirror = prof["v"], prof["nv"], prof["mirror"]
    x_left = cx - w / 2.0
    V = [None] * n
    for i in range(n):
        j = i * 4
        x = v[j] + v[j + 1] * w
        if mirror:
            x = w - x
        V[i] = (x_left + x, v[j + 2], v[j + 3])
    if arm_x:
        for (line, x) in zip(("arm_a", "arm_b"), arm_x):
            for i in prof.get(line, ()):
                V[i] = (x, V[i][1], V[i][2])
    t = []

    def emit(tris):
        # DEGENERATE TRIANGLES ARE DROPPED, NOT EMITTED.  A drafted face can
        # collapse to a line once a profile is rectified -- the plain white's
        # step wall does exactly that, because a rectangle has no step -- and
        # a zero-area triangle is not a surface: it contributes a directed
        # edge twice and breaks the watertight test a printable part has to
        # pass.  Dropping it leaves the two faces that met at the wall
        # meeting each other, which is what a rectified key actually is.
        for (ia, ib, ic) in tris:
            a, b, c = V[ia], V[ib], V[ic]
            ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
            vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
            nx = uy * vz - uz * vy
            ny = uz * vx - ux * vz
            nz = ux * vy - uy * vx
            if nx * nx + ny * ny + nz * nz < 1e-18:
                continue                        # zero area
            t.append(a)
            t.append(b)
            t.append(c)

    f = prof["f"]
    k = 0
    while k < len(f):
        m = f[k]
        k += 1
        ring = list(f[k:k + m])
        k += m
        if mirror:
            ring = ring[::-1]          # mirroring flips face winding
        emit(triangulate_face(V, ring))
    # THE TONGUE IS CUT BEFORE THE LAP IS ADDED.  The lap is already the
    # half's own -- it is clipped where it is worked out -- and it lives
    # behind the back face too, so cutting after it would read it as part of
    # the tongue.
    cut = clip_tongue_x(t, span)
    # the lap into the spine -- part of the key, not of the band
    for (lx0, lx1, ly0, ly1, lz0, lz1) in laps:
        push_box(cut, lx0, lx1, ly0, ly1, lz0, lz1)
    # and said in a way that closes -- see T-JUNCTIONS above
    return weld_t_junctions(cut)


# =========================================================================
# SPINE + FEET GEOMETRY
# =========================================================================
def push_tri(t, a, b, c):
    t.append(a); t.append(b); t.append(c)


def push_quad(t, a, b, c, d):
    push_tri(t, a, b, c); push_tri(t, a, c, d)


def push_box(t, x0, x1, y0, y1, z0, z1):
    if x1 - x0 < 1e-5 or y1 - y0 < 1e-5 or z1 - z0 < 1e-5:
        return
    p = lambda x, y, z: (x, y, z)
    push_quad(t, p(x0,y0,z0), p(x0,y1,z0), p(x1,y1,z0), p(x1,y0,z0))   # -z
    push_quad(t, p(x0,y0,z1), p(x1,y0,z1), p(x1,y1,z1), p(x0,y1,z1))   # +z
    push_quad(t, p(x0,y0,z0), p(x1,y0,z0), p(x1,y0,z1), p(x0,y0,z1))   # -y
    push_quad(t, p(x1,y0,z0), p(x1,y1,z0), p(x1,y1,z1), p(x1,y0,z1))   # +x
    push_quad(t, p(x1,y1,z0), p(x0,y1,z0), p(x0,y1,z1), p(x1,y1,z1))   # +y
    push_quad(t, p(x0,y1,z0), p(x0,y0,z0), p(x0,y0,z1), p(x0,y1,z1))   # -x


def rect_with_holes(x0, x1, y0, y1, holes, emit):
    if x1 - x0 < 1e-4 or y1 - y0 < 1e-4:
        return
    hit = None
    for c in holes:
        a, b = max(x0, c[0]), min(x1, c[1])
        p, q = max(y0, c[2]), min(y1, c[3])
        if b - a > 1e-4 and q - p > 1e-4:
            hit = (a, b, p, q)
            break
    if hit is None:
        emit(x0, x1, y0, y1)
        return
    rect_with_holes(x0, hit[0], y0, y1, holes, emit)
    rect_with_holes(hit[1], x1, y0, y1, holes, emit)
    rect_with_holes(hit[0], hit[1], y0, hit[2], holes, emit)
    rect_with_holes(hit[0], hit[1], hit[3], y1, holes, emit)


# The unit obround: (which half-circle, cos, sin) per point, CCW.  These are
# the browser's own doubles, so no trig is re-run here and Blender lands on
# the identical vertices.
HOLE_UNIT = SPINE["hole_unit"]


def obround_ring(cx, cy, r, straight):
    """The drafted mounting hole: a 32-segment circle cut at +/-90 deg, the
    two halves held *straight* mm apart along x, closed with tangent lines
    top and bottom.  Rounded ends, flat sides — 34 points."""
    return [(cx + h * straight / 2.0 + r * cu, cy + r * su)
            for (h, cu, su) in HOLE_UNIT]


def spine_holes(half, upper):
    tbl = SPINE["holes_upper" if upper else "holes_lower"][half]
    r = SPINE["hole_r"][1 if upper else 0]
    s = SPINE["hole_straight"]
    out = []
    for (cx, cy) in tbl:
        out.append(dict(cx=cx, cy=cy, ring=obround_ring(cx, cy, r, s),
                        x0=cx - s / 2.0 - r, x1=cx + s / 2.0 + r,
                        y0=cy - r, y1=cy + r))
    return out


def hole_box_point(h, p):
    dx, dy = p[0] - h["cx"], p[1] - h["cy"]
    sx = (h["x1"] - h["cx"]) / dx if dx > 0 else ((h["x0"] - h["cx"]) / dx if dx < 0 else float("inf"))
    sy = (h["y1"] - h["cy"]) / dy if dy > 0 else ((h["y0"] - h["cy"]) / dy if dy < 0 else float("inf"))
    s = min(sx, sy)
    side = (0 if dx > 0 else 2) if sx <= sy else (1 if dy > 0 else 3)
    return (h["cx"] + dx * s, h["cy"] + dy * s), side


def push_hole_annulus(t, h, z, up):
    """the gap between a hole's bounding box and its obround ring"""
    C = [(h["x1"], h["y1"]), (h["x0"], h["y1"]), (h["x0"], h["y0"]), (h["x1"], h["y0"])]
    def tri(a, b, c):
        # the ring touches its own bounding box at four points, so a few of
        # these come out with no area at all — drop them rather than ship
        # slivers into the STL
        cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        if abs(cr) < 1e-12:
            return
        if up > 0:
            push_tri(t, (a[0], a[1], z), (b[0], b[1], z), (c[0], c[1], z))
        else:
            push_tri(t, (a[0], a[1], z), (c[0], c[1], z), (b[0], b[1], z))
    ring = h["ring"]
    n = len(ring)
    for i in range(n):
        a, b = ring[i], ring[(i + 1) % n]
        pa, sa = hole_box_point(h, a)
        pb, sb = hole_box_point(h, b)
        path = [pa]
        s = sa
        while s != sb:
            path.append(C[s])
            s = (s + 1) % 4
        path.append(pb)
        for j in range(len(path) - 1):
            tri(a, path[j], path[j + 1])
        tri(a, path[-1], b)


def hole_box_loop(h):
    """The hole's bounding box walked as ONE ring, in the order the annulus
    fans it: every point where the obround touches the box, plus the box
    corners between them.  It is the outer edge of the washer the annulus
    lays, and push_hole_outer_wall shuts it."""
    C = [(h["x1"], h["y1"]), (h["x0"], h["y1"]),
         (h["x0"], h["y0"]), (h["x1"], h["y0"])]
    out = []

    def put(p):
        if (not out or abs(out[-1][0] - p[0]) > 1e-9
                    or abs(out[-1][1] - p[1]) > 1e-9):
            out.append(p)

    ring = h["ring"]
    n = len(ring)
    for i in range(n):
        pa, sa = hole_box_point(h, ring[i])
        pb, sb = hole_box_point(h, ring[(i + 1) % n])
        put(pa)
        s = sa
        while s != sb:
            put(C[s])
            s = (s + 1) % 4
        put(pb)
    # the walk closes on itself; drop the repeat so the wall does not build
    # a zero-width quad at the seam
    while len(out) > 1:
        a, b = out[0], out[-1]
        if abs(a[0] - b[0]) > 1e-9 or abs(a[1] - b[1]) > 1e-9:
            break
        out.pop()
    return out


def push_hole_outer_wall(t, h, z0, z1):
    loop = hole_box_loop(h)
    n = len(loop)
    for i in range(n):
        a, b = loop[i], loop[(i + 1) % n]
        # the ring is wound CCW seen from +z and the fan follows it, so this
        # winding puts the skin's normals outward, away from the bore
        push_quad(t, (a[0], a[1], z0), (b[0], b[1], z0),
                     (b[0], b[1], z1), (a[0], a[1], z1))


def push_hole_wall(t, h, z0, z1):
    ring = h["ring"]
    n = len(ring)
    for i in range(n):
        a, b = ring[i], ring[(i + 1) % n]
        push_quad(t, (a[0], a[1], z0), (a[0], a[1], z1),
                     (b[0], b[1], z1), (b[0], b[1], z0))


def push_spine_slab(t, x0, x1, y0, y1, z0, z1, holes):
    """EACH HOLE'S WASHER IS A CLOSED BODY: lid, floor, the bore wall between
    them on the inside, and the skin that shuts its outer edge.  Built as
    four faces of one solid rather than as three loose surfaces — see
    push_hole_outer_wall for what that was costing.

    ONLY THE BORES THIS RECTANGLE ACTUALLY CONTAINS.  A slab drawn in more
    than one x segment -- see the ribbon notch -- asks for the whole half's
    bore list each time, and a washer built for a bore that is not in this
    rectangle is a second copy of a body already there."""
    holes = [h for h in (holes or [])
             if min(x1, h["x1"]) - max(x0, h["x0"]) > 1e-4
             and min(y1, h["y1"]) - max(y0, h["y0"]) > 1e-4]
    rect_with_holes(x0, x1, y0, y1,
                    [(h["x0"], h["x1"], h["y0"], h["y1"]) for h in holes],
                    lambda a, b, c, d: push_box(t, a, b, c, d, z0, z1))
    for h in holes:
        push_hole_annulus(t, h, z1, +1)
        push_hole_annulus(t, h, z0, -1)
        push_hole_wall(t, h, z0, z1)
        push_hole_outer_wall(t, h, z0, z1)


def push_x_prism(t, x0, x1, poly):
    """A closed prism: a section in (y, z), wound CCW there, swept along x."""
    if x1 - x0 < 1e-5 or len(poly) < 3:
        return
    m = len(poly)
    for k in range(m):
        a, b = poly[k], poly[(k + 1) % m]
        push_quad(t, (x0, a[0], a[1]), (x0, b[0], b[1]),
                     (x1, b[0], b[1]), (x1, a[0], a[1]))
    a, b, c = poly[0], poly[1], poly[2]      # the gusset sections are triangles
    push_tri(t, (x1, a[0], a[1]), (x1, b[0], b[1]), (x1, c[0], c[1]))
    push_tri(t, (x0, a[0], a[1]), (x0, c[0], c[1]), (x0, b[0], b[1]))


def push_root_fillet(t, x0, x1, y_g, t0, t1, r):
    """NOTHING BUILDS THIS ANY MORE -- kept only so the shape is on record,
    exactly as model.js keeps pushRootFillet.  The joint is the boss and the
    lap; the gusset only put a visible ramp on a face that should read flush.

    The gusset at a tongue root: a 45-degree ramp off the band's front
    face onto the UNDERSIDE of the tongue, over the x span the key presents
    at the spine.  t0/t1 are the TONGUE's own z.  Under and not over,
    because the parts print playing-face down: this ramp starts full width
    against the flange and narrows away, needing no support, where its
    mirror above the tongue would begin as a thread in open air.  y_g is
    the spine face on the bottom band, which the ramp fuses into, and the
    spine face plus the inter-colour gap on any band above it, whose ramp
    hangs down in front of the colour stacked underneath.
    """
    if r <= 1e-4 or x1 - x0 < 1e-5 or t1 - t0 < 1e-5:
        return
    push_x_prism(t, x0, x1, [(y_g, t0), (y_g, t0 - r), (y_g + r, t0)])


def back_segments(half, x0, x1, y_back):
    """The x segments a half's slab is drawn in, and the back edge each one
    stands on: three where the ribbon notch bites into it, one otherwise.
    Every band steps back the same way, so the notch reads as one rectangle
    through the whole stack -- see "ribbon" in SPINE."""
    whole = [(x0, x1, y_back)]
    rhalf, rx0, rx1, rdepth = SPINE["ribbon"]
    if half != rhalf:
        return whole
    a, b = max(x0, rx0), min(x1, rx1)
    if b - a <= 1e-4:
        return whole
    out = []
    if a - x0 > 1e-4:
        out.append((x0, a, y_back))
    out.append((a, b, y_back + rdepth))
    if x1 - b > 1e-4:
        out.append((b, x1, y_back))
    return out


def build_spine_slab(half, x0, x1, y_back, y_front, z0, z1, bottom):
    """One (half, layer).  The bottom layer carries the PCB channel: below
    the ceiling it is two strips, front and back; above it, the full section
    with the wide bore.  Every layer above takes the narrow bore.

    The back edge is not one straight line: the ribbon notch takes a bite out
    of half A, so the slab is drawn segment by segment (back_segments).  The
    channel's back strip is drawn only where the notch has not already taken
    it away, which is what opens the channel out of the back."""
    t = []
    segs = back_segments(half, x0, x1, y_back)
    if bottom:
        zc = SPINE["channel_z"]
        cy0, cy1 = SPINE["channel"][half]
        for (gx0, gx1, gy_back) in segs:
            if cy0 - gy_back > 1e-4:
                push_box(t, gx0, gx1, gy_back, cy0, z0, zc)
            push_spine_slab(t, gx0, gx1, gy_back, y_front, zc, z1,
                            spine_holes(half, False))
        push_box(t, x0, x1, cy1, y_front, z0, zc)
    else:
        for (gx0, gx1, gy_back) in segs:
            push_spine_slab(t, gx0, gx1, gy_back, y_front, z0, z1,
                            spine_holes(half, True))
    return t


def foot_outline(cx):
    """the drafted "-| |-", in design coordinates, for the foot at cx"""
    x0 = cx - FOOT_W / 2.0
    y0 = FOOT_YC - FOOT_D / 2.0
    V = [(x0 + p[0], y0 + p[1]) for p in FOOT_SHAPE_V]
    return [[V[i] for i in ring] for ring in FOOT_SHAPE_F]


def poly_area2(ring):
    """twice the signed area of a 2-D ring — positive when it winds CCW"""
    a = 0.0
    for i in range(len(ring)):
        p, q = ring[i], ring[(i + 1) % len(ring)]
        a += p[0] * q[1] - q[0] * p[1]
    return a


def push_prism(t, bot, top, z0, z1):
    """A closed prism between two equal-length rings.  Both are normalised
    to CCW together so vertex i still bridges to vertex i, and the caps are
    wound to close the walls rather than by convention."""
    B, T = list(bot), list(top)
    if poly_area2(B) < 0.0:
        B.reverse(); T.reverse()
    m = len(B)
    for k in range(m):
        j = (k + 1) % m
        push_quad(t, (B[k][0], B[k][1], z0), (B[j][0], B[j][1], z0),
                     (T[j][0], T[j][1], z1), (T[k][0], T[k][1], z1))
    V = [(p[0], p[1], 0.0) for p in B]
    for tri in triangulate_face(V, list(range(m))):
        i, j, k = tri
        push_tri(t, (B[i][0], B[i][1], z0), (B[k][0], B[k][1], z0),
                    (B[j][0], B[j][1], z0))
        push_tri(t, (T[i][0], T[i][1], z1), (T[j][0], T[j][1], z1),
                    (T[k][0], T[k][1], z1))


def build_press(foot_x, rings):
    """one key's sensor press: two closed prisms, one per bar of the "-| |-",
    from the drafted pad up to the key's own deck plane"""
    t = []
    for pad, (z, ring) in zip(foot_outline(foot_x), rings):
        push_prism(t, pad, ring, FOOT_Z, z)
    return t


def to_world(x, y, z):
    return (x + WORLD_X0, WORLD_Y0 - y, z + WORLD_Z0)


def new_collection(name, parent):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c


def get_material(key):
    rgb = COLOURS[key]
    name = "Keyboard " + key
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        if getattr(m, "node_tree", None) is None:
            try:
                m.use_nodes = True      # removed in Blender 6; nodes are implicit
            except Exception:
                pass
        bsdf = m.node_tree.nodes.get("Principled BSDF") if m.node_tree else None
        if bsdf is not None:
            bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
            if "Roughness" in bsdf.inputs:
                bsdf.inputs["Roughness"].default_value = 0.45
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1.0)
    return m


def get_spine_material(kind, layer_name):
    """Colour a spine band the same way the drafting sandbox and the WebGL
    preview do: by the key type it carries, not by a flat "spine" grey. A
    three-type spine's gray/black/white bands take that colour's own
    material; a one/two-type spine's "all"/"lower"/"upper" bands carry more
    than one key colour, so they fall back to SPINE_LAYER_COLOURS' own entry
    for that band (still not the flat spine grey)."""
    rgb = SPINE_LAYER_COLOURS.get(kind, {}).get(layer_name, COLOURS.get("spine", (0.3, 0.3, 0.3)))
    name = "Keyboard Spine %s %s" % (kind, layer_name)
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        if getattr(m, "node_tree", None) is None:
            try:
                m.use_nodes = True      # removed in Blender 6; nodes are implicit
            except Exception:
                pass
        bsdf = m.node_tree.nodes.get("Principled BSDF") if m.node_tree else None
        if bsdf is not None:
            bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
            if "Roughness" in bsdf.inputs:
                bsdf.inputs["Roughness"].default_value = 0.45
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1.0)
    return m


def mesh_checksum(tris):
    """model.js's meshChecksum: a 32-bit digest of the triangle soup,
    quantised to a nanometre, in design coordinates and in build order."""
    h = 2166136261
    for v in tris:
        for c in v:
            h = (h * 31 + math.floor(c * 1e6 + 0.5)) & 0xFFFFFFFF
    return h


def check_parity(name, tris):
    """Stop the build if this object is not the one the browser built.  See
    PARITY: the exported STLs are these same objects, folded at the spine
    seam and turned face-down for the bed, so a mesh that differs here is a
    mesh that differs there."""
    want = PARITY.get(name)
    if want is None:
        return
    got = mesh_checksum(tris)
    if got != want:
        raise RuntimeError(
            "Keyboard Designer: %s is not the mesh the browser built "
            "(checksum %d, expected %d).  model.js and this generated "
            "builder have drifted apart; the STLs and this scene would "
            "not be the same objects." % (name, got, want))


def make_mesh_object(name, tris, coll, mat):
    """tris is the flat triangle soup the browser hands to WebGL, in design
    coordinates.  design -> world flips Y, which mirrors handedness, so each
    face is emitted reversed to keep its normal pointing outward."""
    check_parity(name, tris)
    verts, faces, index = [], [], {}
    for i in range(0, len(tris), 3):
        face = []
        for k in (0, 2, 1):
            p = to_world(*tris[i + k])
            key = (round(p[0], 6), round(p[1], 6), round(p[2], 6))
            j = index.get(key)
            if j is None:
                j = len(verts)
                index[key] = j
                verts.append(p)
            face.append(j)
        if len(set(face)) == 3:
            faces.append(tuple(face))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate(verbose=False)
    me.update()
    if mat is not None:
        me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def make_root(coll):
    # An empty at the world origin.  Everything is parented to it, so the
    # keyboard as a whole is driven from (0, 0, 0).
    root = bpy.data.objects.new(ROOT_EMPTY, None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 25.0
    root.location = (0.0, 0.0, 0.0)
    coll.objects.link(root)
    return root


# ---- the optional "duplicate the sandbox's own objects" path ------------
def world_bbox(ob):
    ws = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return (min(v.x for v in ws), max(v.x for v in ws),
            min(v.y for v in ws), max(v.y for v in ws),
            min(v.z for v in ws), max(v.z for v in ws))


def find_category(type_name):
    """Categories are named e.g. 'Full Sized Black (from 15)'."""
    col = bpy.data.collections.get(CATEGORY_COLLECTION)
    if col is None:
        return None
    for ob in col.objects:
        if ob.name.split("(from")[0].strip() == type_name:
            return ob
    return None


def place_from_category(src, name, x_centre, width, coll):
    ob = src.copy()
    ob.data = src.data.copy()
    ob.name = name
    coll.objects.link(ob)
    x0, x1, y0, y1, z0, z1 = world_bbox(src)
    src_w = x1 - x0
    if src_w > 1e-9 and abs(width - src_w) > 1e-9:
        ob.scale = (ob.scale.x * (width / src_w), ob.scale.y, ob.scale.z)
    bpy.context.view_layer.update()
    nx0, nx1, ny0, ny1, nz0, nz1 = world_bbox(ob)
    ob.location.x += (x_centre + WORLD_X0) - (nx0 + nx1) / 2.0
    ob.location.y += WORLD_Y0 - ny1          # back face onto the spine front
    ob.location.z += WORLD_Z0 - SHEET_Z0     # spine bottom face onto z = 0
    return ob


def copy_sheet_collection(src_name, dst_coll):
    """Duplicate a sandbox collection wholesale onto this log's origin."""
    col = bpy.data.collections.get(src_name)
    if col is None:
        return 0
    dx, dy, dz = WORLD_X0 - SHEET_X0, WORLD_Y0 - SHEET_Y0, WORLD_Z0 - SHEET_Z0
    n = 0
    for src in col.objects:
        ob = src.copy()
        if src.data is not None:
            ob.data = src.data.copy()
        dst_coll.objects.link(ob)
        ob.location = (ob.location.x + dx, ob.location.y + dy, ob.location.z + dz)
        n += 1
    return n


# =========================================================================
def build():
    scene = bpy.context.scene.collection
    root_coll = new_collection(TARGET_COLLECTION, scene)
    part = {}
    for nm in ("Keys - White", "Keys - Black", "Keys - Gray", "Spine",
               "Sensor Press"):
        part[nm] = new_collection(nm, root_coll)
    root = make_root(root_coll)
    mats = dict((k, get_material(k)) for k in COLOURS)

    keys_from_sheet = 0
    for (name, ktype, cx, width, depth, profile,
         wx, wy, wz, foot, arm_x, lap, half) in KEYS:
        coll = part[LAYER_PART[KEY_LAYER[ktype]]]
        if USE_BLEND_CATEGORIES:
            src = find_category(ktype)
            if src is not None:
                place_from_category(src, name, cx, width, coll)
                keys_from_sheet += 1
                continue
        make_mesh_object(name,
                         build_key(cx, width, KEY_PROFILES[profile], arm_x, lap,
                                   spine_half_span(half)),
                         coll, mats[KEY_LAYER[ktype]])

    spine_from_sheet = 0
    if USE_BLEND_CATEGORIES:
        kind = DESIGN["spine_type"].split()[0].capitalize()
        spine_from_sheet = (copy_sheet_collection(kind + " type Spine - A", part["Spine"]) +
                            copy_sheet_collection(kind + " type Spine - B", part["Spine"]))

    if not spine_from_sheet:
        # colour each band by the key type it belongs to (see
        # get_spine_material) rather than a single flat spine colour, so a
        # generated spine matches the drafting sandbox and the WebGL preview
        # band for band.
        spine_kind = DESIGN["spine_type"].split()[0].lower()
        spine_mats = {}
        for (hname, hx0, hx1, hy_back, hy_front, layers) in SPINE["halves"]:
            for li, (lname, lz0, lz1) in enumerate(layers):
                # the band's front face is the drafted one, y = 0, flush
                # with every key back — the comb is affixed into one object,
                # so holding the band off that plane only opened a slot
                # behind the keys of the other colours.  The 1.29 mm between
                # half A and half B is left open: that gap is drafted
                # clearance, not something to bridge.
                tris = build_spine_slab(hname, hx0, hx1, hy_back,
                                        hy_front, lz0, lz1, li == 0)

                # carry this band forward into the keys of its own colour.
                # NO GUSSET.  The tongue root used to carry a 45-degree ramp
                # along the spine face under every tongue; it is gone from
                # model.js -- the joint is the boss and the lap, and the ramp
                # only put a visible edge on a face meant to read flush.
                for (blayer, bx0, bx1, bz0, bz1) in SPINE["boss"]:
                    if blayer != lname:
                        continue
                    a, b = max(bx0, hx0), min(bx1, hx1)
                    if b - a <= 1e-4:
                        continue
                    push_box(tris, a, b, hy_front,
                             hy_front + SPINE["boss_depth"], bz0, bz1)
                if lname not in spine_mats:
                    spine_mats[lname] = get_spine_material(spine_kind, lname)
                make_mesh_object("Spine_%s_%s" % (hname, lname), tris,
                                 part["Spine"], spine_mats[lname])

    for name, colour, foot_x, rings in PAIRS:
        # a press carries its KEY's material — same filament, same part
        make_mesh_object(name.replace("Pair_", "Press_"),
                         build_press(foot_x, rings),
                         part["Sensor Press"], mats[colour])

    # parent everything to the root empty at (0, 0, 0), in place
    bpy.context.view_layer.update()
    inv = root.matrix_world.inverted()
    objects = [ob for c in [root_coll] + list(root_coll.children) for ob in c.objects]
    for ob in objects:
        if ob is root:
            continue
        ob.parent = root
        ob.matrix_parent_inverse = inv
    bpy.context.view_layer.update()

    # report where it actually landed
    meshes = [ob for ob in objects if ob.type == "MESH"]
    pts = [ob.matrix_world @ Vector(c) for ob in meshes for c in ob.bound_box]
    print("Keyboard Designer: %d keys, %d spine parts, %d presses  (%s)"
          % (len(KEYS), len(part["Spine"].objects),
             len(part["Sensor Press"].objects),
             "sandbox objects" if USE_BLEND_CATEGORIES else
             "drafted profiles — identical to the browser preview and to "
             "the exported STLs"))
    if pts:
        bx = (min(p.x for p in pts), max(p.x for p in pts))
        by = (min(p.y for p in pts), max(p.y for p in pts))
        bz = (min(p.z for p in pts), max(p.z for p in pts))
        print("Keyboard Designer bbox  X %9.4f .. %9.4f   Y %9.4f .. %9.4f   Z %9.4f .. %9.4f"
              % (bx[0], bx[1], by[0], by[1], bz[0], bz[1]))
        print("Keyboard Designer centre %.4f, %.4f, %.4f   (origin mode: %s)"
              % ((bx[0] + bx[1]) / 2.0, (by[0] + by[1]) / 2.0,
                 (bz[0] + bz[1]) / 2.0, ORIGIN))


if __name__ == "__main__":
    build()`;
  }

  /* ------------------------------------------------------------------ *
   *  PLAIN-TEXT SUMMARY (used in the UI status panel)                   *
   * ------------------------------------------------------------------ */
  function summary(L) {
    const counts = {};
    for (const n of L.notes) counts[n.type] = (counts[n.type] || 0) + 1;
    return { counts, notesEq: L.notesEq, total: L.total, width: L.width };
  }

  const api = {
    presetDesign, clearedDesign, scaleOf, slotAt, designColours,
    computeLayout, pairKeys, printMesh, printParts, printBounds, printAudit, bedAngle, halfTilt,
    buildMeshes, toSTL, makeZip,
    pythonLog, summary, notesPerPeriod, layerCount, templateColours,
    whiteCount, widthAt, suggestScale,
    bounds, worldOffset, ORIGIN_MODES, bevelOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (typeof window !== 'undefined' ? window : globalThis).XD = api;
})();
