# Keyboard Designer · Cimbalo Cromatico

A self-contained browser app for designing split-key microtonal ("cimbalo
cromatico") keyboards. **Open `index.html` in any browser** — no server, no
internet, no dependencies.

Every dimension in this app is inferred from
`Cleaning Cimbalo Designs for Automated Design/Cimbalo_Cromatico_Drafting_Sandbox_Leveling.blend`
— the spine, the sensor feet, the seven key type categories and the three
drafted layouts. Nothing here is guessed.

---

## The instrument is 32 keys. Always.

One AKM320: **spine half A + spine half B, 16 sensor feet on each, 32 feet in
total.** A design therefore has exactly 32 keys — one per foot — and the app
will not generate a 33rd, in the browser or in the Blender log. Nothing chains;
there is no multi-unit mode.

The consequence: **the white-key count is derived, not chosen.** Keys are laid
down left to right — white *i*, then slot *i*, then white *i+1* — and the run
stops the instant the 32nd note is placed. Change the pattern and the white
count moves with it:

| pattern | notes/equave | white keys | accidentals | span |
|---|---|---|---|---|
| 15-EDO | 15 | 15 | 17 | 367.9 mm |
| 17-EDO | 17 | 13 | 19 | 358.7 mm |
| 19-EDO | 19 | 12 | 20 | 368.0 mm |
| all-white | 7 | 32 | 0 | 983.8 mm |

If the 32nd note falls inside a split slot you get one half of the pair and a
warning saying so — the first note of the pair is the one kept, since that is
the one that comes next in scale order. Rotating with **Start on** moves where
the cut lands.

`FEET[i]` is the foot under `KEYS[i]`; the Python log asserts both are 32 long.

---

## Files

| file | what it is |
|---|---|
| `profiles.js` | The drafted keys themselves, as data — one profile per key type and, for whites, per neighbour context. Generated from the .blend; not hand-edited. |
| `model.js` | Everything measured out of the .blend: the datum, the spine (per half), the fixed foot relationship, the size law, the seven key types, the part colours, the three layouts, and the parametric mesh builders. |
| `core.js` | Layout engine (slot arithmetic, validity checks), mesh assembly, STL/ZIP writers, and the Blender Python log generator — which emits `model.js`'s mesh code as Python, so the Blender build and the preview are one model. Also loadable from node. |
| `index.html` | The app: drag-and-drop palette, period editor, keyboard strip, WebGL preview, export. |

The only layout controls are **size scale `s`** and **Start on** (rotation).
Everything else follows from the 32-key limit and the seven-slot template.

---

## Coordinate system

```
x : 0 at the LEFT EDGE of the leftmost white key, + toward the treble
y : 0 at the SPINE FRONT FACE (= the back face of every key), + toward the player
z : 0 at the SPINE BOTTOM FACE, + up
```

Mapping back to the .blend, exactly:

```
X_world = x + (-1403.764)
Y_world = (-134.106) - y
Z_world = z + 21.78566
```

---

## The fixed spine ↔ foot relationship

This never varies, in any layout, at any scale:

| quantity | value |
|---|---|
| foot pad | 10.40002 × 9.00005 mm (flat plane) |
| foot pitch | 11.30005 mm |
| foot centre | y = 27.37759 mm in front of the spine front face |
| foot plane | z = −1.01091 mm below the spine bottom face |
| feet per AKM320 unit | 32 (16 on half A, 16 on half B) |

Half A of the real PCB is not perfectly even (steps alternate 11.20899 /
11.39099 / 11.30018); half B is dead uniform at 11.30005. Both are stored
verbatim in `model.js`, so foot X positions are reproduced to the micron.

The spine is 9.84706 mm deep and ~7.1 mm tall, and the sandbox draws it three
ways, in six objects. **A design uses exactly one of them, and which one is not
a setting — it is the number of key colours the design places.** One slab per
colour, each key's rear tongue plugging into the layer belonging to its own
colour:

| colours placed | spine | layers | sandbox objects |
|---|---|---|---|
| white only | one type | 1 | `One type Spine - A` / `- B` |
| white + black | two type | 2 | `Two type Spine - A` / `- B` |
| **anything using gray** | three type | 3 | `Three type Spine - A` / `- B` |

**Gray always takes the full three-layer stack**, even in a design that places
no black key at all. The drafted gray tongue is z 4.08924 → 5.09074 and the
black one 5.08924 → 6.08924: they are stacked bands, not alternatives, so
reaching for gray means reaching for the bottom band of the three-layer spine
and the black band has to exist above it. A two-type spine merges those two
into a single 0 → 6.07832 slab, which is the white + black case and only that
one. The status panel names the colours it counted and the spine they chose.

The count is taken from the keys the design actually **places**, not from the
colours its template mentions — the 32-note limit can cut a slot off before its
keys are laid down, and an override on a slot the run never reaches is not part
of the instrument.

The bands, per spine type:

| spine | layer | z band (half A) | z band (half B) | tongue it takes |
|---|---|---|---|---|
| one | all | 0 → 7.10039 | −0.00006 → 7.08935 | white 6.08924 → 8.62804 |
| two | lower | 0 → 6.07832 | −0.00006 → 6.08932 | black 5.08924 → 6.08924 |
| two | upper | 6.07826 → 7.07833 | 6.08928 → 7.08936 | white 6.08924 → 8.62804 |
| three | gray | 0 → 5.08934 | −0.00006 → 5.07835 | gray 4.08924 → 5.09074 |
| three | black | 5.09072 → 6.10034 | 5.07829 → 6.08932 | black 5.08924 → 6.08924 |
| three | white | 6.07824 → 7.10034 | 6.08926 → 7.11137 | white 6.08924 → 8.62804 |

Every tongue engages its band over ~1.00 mm — its full thickness — in all three
spine types and on both halves, which is what makes the choice above the right
one rather than a convention.

Halves A and B were drafted separately and their layer bands differ by up to
0.011 mm. Both are stored verbatim (for all three spine types), so a generated
spine is a replica of the drafted one rather than an idealisation of it. Each
(half, layer) is built as its own object, matching the sandbox's own
decomposition of `<kind> type Spine - A` / `- B`.

### The channel and the mounting holes

The spine is not a plain slab, and its holes are **not rectangles**. Both
features are read straight out of `<kind> type Spine - A` / `- B`:

**The PCB channel.** The underside of each half is slotted end to end, open at
both x ends, leaving a 1.40005 mm wall at the front and the back:

| half | y band | z band |
|---|---|---|
| A | −8.44702 → −1.40005 | 0 → 2.911096 |
| B | −8.44696 → −1.39999 | 0 → 2.911096 |

That is where the AKM320 board sits. It is one continuous slot per half, not
three wide through-holes — an earlier reading of the sheet had it as the
latter, and that is now corrected.

**The 16 mounting holes** — eight per half — are **obrounds**: a 32-segment
circle cut at ±90° with the two halves held 1.0 mm apart along x and closed
with tangent lines top and bottom. Thirty-four points, rounded ends, flat
sides. There are exactly two bores in the sandbox:

| bore | radius | size | where |
|---|---|---|---|
| lower | 1.889789 | 4.779578 × 3.779578 | the layer that carries the channel, from z = 2.911096 up |
| upper | 1.619818 | 4.239636 × 3.239636 | every layer stacked above it, full height |

so the bore steps in by 0.269971 mm at the first layer seam. A one-type spine
has no seam and therefore only the lower bore, exactly as `One type Spine - A`
/ `- B` is drawn. The holes bottom out on the channel ceiling — they open
straight into it, so none of them is a blind counterbore.

Centres are stored per half **and per bore**, verbatim, because the drafted
upper bores do not sit dead on top of the lower ones; they wander by up to
0.008 mm and the app reproduces that rather than averaging it away.

---

## The size law

Read straight off the three drafted sheets. **Every horizontal dimension is
linear in the size number `s`; every vertical and front-to-back dimension is
constant.**

```
white key width  = s × 37/24     (1.5416667)
white key pitch  = white width + 1.5      (a constant 1.5 mm gap)
accidental width = s × 83/120    (0.6916667)
slot bias δ      = s / 6
```

| s | white width | white pitch | accidental width | δ |
|---|---|---|---|---|
| 15 | 23.1250 | 24.62500 | 10.37500 | 2.50000 |
| 17 | 26.2083 | 27.70833 | 11.75833 | 2.83333 |
| 19 | 29.2917 | 30.79167 | 13.14167 | 3.16667 |

`s` defaults to the EDO number but is an independent control — you can draw a
19-note layout at 15-size, or scale a 17 sheet up. Because the key count is
fixed at 32, `s` is what decides whether those 32 keys fit the A+B spine: the
**fit to spine** button sets `s` so the last white key ends exactly at
x = 373.30 mm. The status panel shows the span against the spine either way,
and warns on an overhang.

---

## Slots

Seven white keys per period, seven accidental slots between them. Slot *i*
sits between white *i* and white *i+1*, at the midpoint plus a bias of ±δ —
the classic piano grouping of three-then-two:

| slot | between | bias | group |
|---|---|---|---|
| 0 | F–G | −δ | three |
| 1 | G–A | 0 | three |
| 2 | A–B | +δ | three |
| 3 | B–C | 0 | single (diatonic semitone) |
| 4 | C–D | −δ | two |
| 5 | D–E | +δ | two |
| 6 | E–F | 0 | single (diatonic semitone) |

The three drafted defaults are just three fillings of those seven slots:

| | slot 0 | 1 | 2 | 3 | 4 | 5 | 6 | notes |
|---|---|---|---|---|---|---|---|---|
| **15** | full black | pair | pair | — | full black | pair | — | 7+1+2+2+1+2 = 15 |
| **17** | pair | pair | pair | — | pair | pair | — | 7+10 = 17 |
| **19** | pair | pair | pair | full gray | pair | pair | full gray | 7+10+2 = 19 |

The 17 and 19 sheets are drawn starting on F; the 15 sheet starts on C. The
**Start on** control rotates which white key lands on period slot 0.

---

## Undo

**⌘Z** steps back, **⇧⌘Z** (or **^Y**) steps forward — up to 100 steps, for the
session. There is no button and no history list: the keyboard on screen is what
tells you it worked, and the only thing said out loud is that there is nothing
left to undo.

A step is a *gesture*, not a redraw. A width drag or a slider rebuilds the model
several times a second, and all of it — from the pointer going down to it coming
up — undoes as one. So does a run of arrow-key nudges on the same control. A
click is its own step.

It covers the design: the arrangement, the widths, keys resized by hand, the
press blend, the scale length and the origin — everything saved under
`xenachord-designer-v2`. It does not cover the tuning, the synth or the view
(explode, part visibility), none of which an edit can lose.

---

## The keys are the drafted keys

Key geometry is not modelled analytically and never was worth modelling
analytically. Every key in the 15, 17 and 19 sheets was measured, and each key
type is stored once in `profiles.js` as a vertex/face profile in which every
vertex carries

```
x = alpha + beta * width        (x from the key's left edge)
y, z                            (invariant with scale)
```

`beta = 0` pins a feature to the left edge, `1` to the right edge, `0.5` to the
centreline. The drafted keys use exactly those three plus a quarter — the
0.65 / 0.99 / 1.0 / 1.55 mm edge detailing is edge-pinned and does **not**
scale, while the interior rides the centre. `alpha` and `beta` are least-squares
fits across every width the sheets draw the key at, so a single profile
reproduces all of them and interpolates sensibly between and beyond.

**Whites carry one profile per neighbour context.** The drafted whites rib
differently depending on which slots sit either side of them and how those
slots are biased: three internal ribs when both neighbours are occupied, two
when one is empty, and the whole rib group shifts with the left slot. The
sheets draw nine of the sixteen possible contexts; a design that asks for one
they never drew borrows the closest drafted white (occupancy first, then the
nearer bias) and the inspector says so.

The two left-handed categories are not stored at all — `Split Black First` is
the X-mirror of `Split Black Second` and `Split Gray Second` the X-mirror of
`Split Grey Second`, both verified against the sheet's own meshes at
**0.00000 mm**.

### The clearance around an accidental is part of the white key

A white key is not a slab. Its rear half is stepped back on whichever side has
an accidental beside it, and the step is what leaves the printed keys free of
each other. The step runs to the depth of the neighbour it clears — y = 54.07
beside a split pair (whose front half is 52.57 deep), y = 44.07 beside a
`Full Sized Gray` (42.57 deep) — and its X depends on that slot's bias, which
is why the whites carry one profile per neighbour context rather than one
profile. The gaps that fall out, measured surface to surface over every
overlapping (y, z):

| layout | white ↔ split pair | white ↔ full-sized gray |
|---|---|---|
| 15 | 0.875 mm | — |
| 17 | 0.892 mm | — |
| 19 | 0.908 mm | 1.146 mm |

They scale with `s`, since the step is pinned by `beta` to the key's own width.

**These steps are cut into concave faces**, and until they were triangulated
properly the preview, the STLs and the Blender build all paved straight across
them: a triangle fan is only valid on a convex polygon, and 138 of the 880
drafted faces are not convex. The fan laid down as much as 587 mm² of surface
that is not in the sheet — long triangles reaching corner to corner across a
key, which closed the clearance channel and read as a white key running full
width all the way back to the spine. `triangulateFace()` in `model.js` ear-clips
each face in its own plane instead, and the generated Blender log carries a
line-for-line transliteration of it, so the three outputs stay the same mesh.

What survives is 12.7 mm² on a handful of faces the sheet draws
self-intersecting or twisted in their own plane — the front face of
`Split Grey Second`, where vertex 27 sits 0.224 mm above the face's own top
edge, and five-sided side walls that twist along x. No triangulation can flatten
those; they are drafting artefacts, and they are listed here so they are not
mistaken for tessellation error.

## The seven Key Type Categories

Drag these from the palette into a slot. In the .blend they were pulled from
different sheets (19 and 15) and so carry different widths — here all seven
palette chips are the **same width**, and the real width comes from the size
law when the key is dropped. Chip swatch height shows the key's depth.

| category | layer | depth | peak z | role |
|---|---|---|---|---|
| Full Sized White | white | 85.0688 | 8.62804 | the white backbone |
| Full Sized Black | black | 52.5688 | 15.62804 | single full-depth accidental (15-EDO) |
| Full Sized Gray | gray | 42.5688 | 15.24484 | single mid accidental (19-EDO E♯/F♭, B♯/C♭) |
| Split Black First | black | 27.8188 | 14.94844 | rear half of a pair, left-hand detailing |
| Split Black Second | black | 27.8188 | 14.94844 | rear half of a pair, sheet default |
| Split Gray Second | gray | 52.5688 | 15.62804 | front half of a pair, left-hand detailing |
| Split Grey Second | gray | 52.5688 | 15.62804 | front half of a pair, sheet default |

A split slot takes exactly one **rear** and one **front**. A full-sized key
owns its slot alone. The app warns if you break that.

Where to drop:

* **Repeating period** panel — changes the pattern *everywhere* and clears
  per-slot overrides.
* **Keyboard strip** at the bottom — overrides just that one slot.
* Click any placed key to remove it.

---

## Viewing and inspecting the model

There is **no ground plane and no lower clamp on the camera** — you can orbit
right under the instrument and look up at the undersides, the tongues and the
foot clearance. Faces are shaded two-sided from the view direction, so nothing
goes black when you get beneath it, and back-face culling is off.

| action | control |
|---|---|
| orbit | drag (elevation runs the full −90°…+90°) |
| pan | shift-drag, middle-drag or right-drag — screen-space, so it works from any angle |
| zoom | wheel (8 mm to 20 m) |
| inspect a part | click it |
| clear the inspector | click ✕, double-click, or Esc |
| fit | `fit` button or **F** |
| straight down / straight up | **T** / **B** |
| nudge the orbit | arrow keys (shift = fine) |

View presets: `iso`, `top`, `bottom`, `front`, `back`, `left`, `right`,
`under-iso`. The readout at the top-left shows azimuth, elevation and distance,
and says so when you are below the instrument.

**Layer visibility** — the row of buttons at the bottom of the viewer switches
the white / black / gray combs (each a swatch filled with its filament), the
spine and the sensor presses on and off independently. Hiding the whites is the
quickest way to see how the accidental stems sit over their sensor feet.

**Key labels** — `numbers` / `names` beside it chooses what Design writes on
each key: its position in the arrangement (0 upward) or the note name in the
Play drawer's notation, so a layout can be arranged with its notation in view.
Play and Export always show names. The chevron at the right end of the row
folds these display settings away and leaves the keyboard standing; the grip
above the row still hides the whole editor.

**Separate combs** — the slider lifts each comb apart along Z in assembly order
(feet, spine, gray, black, white), so you can see the three-layer stack the way
it comes apart. A three-type spine's gray/black/white bands share their
colouring with the matching keys, so each band lifts together with its own
comb rather than as one lump; a one/two-type spine's bands (`all`/`lower`/
`upper`) carry more than one key colour and have no single comb to follow, so
they stay at the base spine step. The generated Python log colours those same
spine bands the same way — by the key type each band belongs to — instead of
one flat spine grey.

**Key → foot reach** — the status panel reports the widest distance from a key's
centre to the centre of its sensor foot. Large values are expected, not errors:
the two halves of a split pair share one X and still have to reach two adjacent
feet 11.3 mm apart. Nothing closes that gap at this stage — the loop pair
states it.

---

## The foot loop pairs

Both ends of the connection were already drafted, and at this stage that is all
the design states: **a pair of floating faces, with nothing between them.**

A foot is no longer a solid. It is one flat face — the drafted `-| |-` exactly
as `Feet - A` / `Feet - B` draw it, two n-gons and sixteen vertices, lying at
`FOOT.z` with no thickness, no walls and no caps. The window between the two
bars, where the sensor's rubber dome sits, is open because the drafted shape
leaves it open.

Each foot then carries a second floating face: the **pair face**, the `-| |-`
popped off its key's own underside deck, lying in that deck's plane. There is no connector, no plinth, no ramp, no tip
and no weld into the key. The key is drawn whole; nothing is cut into its
belly. Two loops describe the relationship between a key and its sensor, and
describing it is the whole of this stage.

### Where the pair face comes from

It is **not derived from the key by fitting** — it is the face popped off the
key's own underside deck, drafted in the `Raised Feet (Pair)` collection and
read back out the way every other constant in `model.js` was.

Every one of the 32 is the same `-| |-`: a **crossbar spanning the full width
of that key's deck**, a 1 mm **stem** centred on it reaching out of each bar,
and the 2 mm dome window between them. Only two things vary, and neither is
fitted:

| | where it comes from |
|---|---|
| **x** | the key's own deck span, verbatim. The bar is as wide as the key is, whatever the layout or the size number. |
| **y** | one of three drafted profiles in `PAIR_SHAPE`, chosen by the key. |

The three profiles are the whole of it:

- **`full`** — the standard 14.0 mm reach: 5 mm stem, 1 mm bar, 2 mm window,
  1 mm bar, 5 mm stem. Every white key, and every full-width accidental.
- **`split`** — the Second half of a split pair: the same 14.0 mm reach drawn
  with slightly heavier bars and a 1.902 mm window.
- **`short`** — the First half of a split pair, 10.25 mm: its key ends at
  y 27.8189, so the front stem is 1.25 mm instead of 5 mm.

### Split pairs

The one thing a key's own geometry cannot say is where a split pair divides.
Both halves share a slot, and the deeper half's belly loop is drawn across the
whole of it, so seating both from their own bellies would put them on top of
one another. The shallower half's belly really is just its half, so it is taken
as drawn and the deeper half gets the rest of the slot, less `PAIR.split`
(0.99387 mm) of air. That is the only inference anywhere in the pairing, and it
reproduces the drafted faces to 0.006 mm.

Rebuilt from these rules, all 32 pair faces match the drafted collection: same
bounds, same stems, same deck plane, and the largest area error anywhere is
0.04 mm² out of about 50 — drafting noise, not a difference in shape.

---

## The sensor press

The loop pair states the relationship; the **press** is that relationship
closed into a part. One prism per bar of the `-| |-`: the drafted pad ring at
the bottom, its pair ring in the key's deck plane at the top, a single quad
band between them vertex for vertex, and both ends capped.

Each pair ring is built by mapping the pad ring onto the pair's coordinates
**by role** rather than drawn independently — every x is one of the four the
shape uses (bar end, stem edge, stem edge, bar end) and every y is one of three
(bar inner edge, bar outer edge, stem tip). So the pair ring comes out as the
same eight points in the same order and the same winding as the pad ring it
belongs to, and the loft has nothing to match up: vertex *i* bridges to vertex
*i*. Nothing is stepped and nothing is squared off, so the 1 mm stem and the
2 mm dome window survive the whole climb.

**Two prisms, not one.** The window between the bars is where the rubber dome
sits. Lofting the pair as a single ring would close it; lofting each bar on its
own leaves it open at every height — which is why the pad is drafted as two
n-gons rather than one to begin with.

**Watertight, and checked as such.** `isWatertight` requires every *directed*
edge to appear exactly once and its opposite exactly once; a bare undirected
edge count would pass a cap wound the wrong way, and this does not. `meshVolume`
then confirms the normals face out rather than in. All 32 presses close in all
three presets, none inverted, and they add about 4390 mm³ of filament in the
19-EDO layout. The face that presses the sensor is the drafted pad ring itself,
not an approximation of it.

### Colour

A press prints **as part of its key, in its key's filament**, so it carries the
key's colour rather than one of its own: its triangles go into that colour's
mesh in the preview and in the per-colour STL, and the Blender log gives each
`Press_nn` object its key's material in the `Sensor Press` collection. The two
loops themselves stay with the foot, in the `Foot_x_nn` object inside `Feet`.

### Which foot a key drives

`KEYS[i]` belongs to `FEET[i]`, and for a split pair that pairing used to be
decided by nothing at all. Both halves share the slot's x centre, and the old
comparator returned the same value for both of them — an inconsistent sort, so
the pair came out one way in one layout and the other way in another. In 19-EDO
it came out **crossed**: the gray half sits to the LEFT of the black half in the
drafted slot, yet the black half was taking the left-hand foot, so the two
connectors had to pass through one another (1012 mm³ of shared solid in one
pair alone).

The tie-break is now the key's **drafted span at the spine**, not its slot
centre and not its pair role. Each half is drawn at its own x inside the slot,
and which one is on the left flips with the pair's handedness — "First" is the
mirror of "Second" — so reading the geometry gets it right for either variant
without assuming one. Where a layout uses *Split Black First*, black stands to
the left and takes the leftmost of the pair's two feet; where it uses *Split
Black Second*, gray does.

### Three objects, and what it takes

The instrument comes off the bed as **three objects, one per filament**, each a
single closed solid. `FIT` in `model.js` carries the two numbers that makes
that possible.

**`FIT.gap` — clearance between colours.** The drafted spine bands overlap each
other. Half A draws black topping out at 6.10034 and white starting at 6.07824;
half B is worse, 284.8 mm³ of solid shared between gray and black. Invisible on
the sheet, fatal to a print. Bands are now pushed apart to leave `FIT.gap`, and
each band's front face is recessed by the same amount so that a key of another
colour never lies coincident with it — coplanar faces are exactly what leaves a
boolean union non-manifold.

**`FIT.engage` — overlap within a colour.** A key has to genuinely share solid
with the spine band of its own colour, not merely touch it. Each band grows a
**boss** of `FIT.engage` forward, over the x span of every key of its colour and
across only the z its tongue occupies. A connector likewise pushes `FIT.engage`
past its key's underside rather than stopping on it, and its `"-| |-"` tip
overlaps its own plinth. Each band also carries a **coupler** across the 1.3 mm
gap the two AKM320 halves are drafted apart, so a comb is one object and not
two.

Unioned in Blender, the 19-EDO preset now gives **white: 1 shell** (from 26
input objects, 77 before these changes), **black: 2**, **gray: 4**.

### What is still open

Measured in Blender with exact booleans, against the 19-EDO preset:

| was | now |
|---|---|
| 48 cross-colour interferences, ~1200 mm³ | 6 interferences, 18.9 mm³ |

Everything that remains is one thing: **an accidental's connector clips the
neighbouring white key it passes under.** That is not a routing mistake — the
accidental's sensor foot genuinely sits under the white key's body, so a
connector has to pass through the white key's envelope. It needs a relief
pocket cut in the neighbouring key, sized `travel + margin`, which means the
app has to emit the pocket and the Blender log has to subtract it. Until then
those six pairs share solid.

Two smaller items behind it:

* Three gray connectors and one black do not fuse into their comb, leaving 34-
  and 130-face loose shells after the union.
* The spine slab is not watertight on its own — 608 boundary edges per part.
  `rectWithHoles` subdivides recursively, so neighbouring sub-rectangles meet
  at T-junctions, and the obround annulus does not close against them.
  Capping each slab as one polygon-with-holes is the fix; tiling the
  sub-rectangle caps was tried and is worse. A union of the comb closes it (the
  black comb comes out with no open edges at all), so this bites the raw spine
  STL rather than the printed comb.

---

## Export

Export is its own mode on the left rail, beneath Design and Play, because it
asks a different question from either: not what the instrument is, but who
gets it.

### Print — one file per colour, laid out for the bed

* **STL per colour** — `white`, `black`, `gray`. A file is everything that
  prints in that filament, **fused**: the keys, the sensor press under each of
  them, and the spine band their tongues plug into. Nothing is exported as a
  component of its own — there is no `spine.stl` and no press file, because
  neither is ever printed on its own, and the band's boss already reaches
  `FIT.engage` into the keys that share its colour, so the pieces overlap into
  one solid rather than merely touching.
* Beveling, the ad-hoc widths and the sensor-press solve are all in the mesh
  the button writes.
* A colour the design does not use is not an empty file — the button greys out
  and the zip leaves it out.
* **Save STL files for all colours (.zip)** — the colours this keyboard uses
  plus the Python log. On a rig, one folder per *distinct* keyboard.
* Face winding is consistent across every primitive, so exported normals point
  outward — slicers and Blender both read the solids the right way round.

**Every export is folded and turned for a printer, not left as the app draws
it.** A keyboard laid out as it is played is the wrong shape *and* the wrong
way up for a bed, and there is no reason to hand out a file that is either.

**Wrong shape → folded in two.** Laid out as it is played the instrument is
373 × 95 mm, which no common bed will take. But the AKM320 is *already* two
halves — spine half A with its 16 sensor feet, half B with the other 16, and a
drafted 1.29 mm of air between them that nothing bridges — so the export folds
it at that seam. Everything standing on half B (its keys, their presses, its
spine bands) moves as one by exactly the drafted distance between the two spine
halves in x, and back in y until it clears half A by 6 mm. The result is about
**197 × 196 mm**, which drops onto a 220 mm square with room around it. A key
takes the half its *foot* is on (`ref.half`), which is the physical answer
rather than an x comparison that would have to decide about a key overhanging
the seam.

**Wrong way up → turned onto the playing face.** The surface that has to come
out well is the one you play on, and printed upright it is the *last* thing
laid down: stepped over the curve of the sides, supported by nothing, carrying
every seam. Turned over it is the first thing, ironed flat against the glass,
and what comes out rough is the tongue and the underside, which nobody touches.

* A **white** turns a clean 180°: its playing surface is one flat plane at
  z = 8.628, so a half turn puts it on the bed exactly.
* A **black or gray** does not. Their tops are *raked* — they rise about 2°
  from the spine to the peak before the nose ramps away — so a plain half turn
  leaves them resting on one edge, rocking, printing the surface that matters
  as a 2° overhang off a line of contact. The turn is a half turn *less the
  rake*, and the raked plane lands flat.

  Measured, not declared: `XD.bedAngle` reads the rake off the profiles that
  were actually built — the largest upward-facing plane among the topmost
  surfaces of that colour's keys, which is the surface that will touch the bed
  once turned. So it is right for whatever the design placed, it is unmoved by
  the bevel (which trims the top's edges without tilting it), a split gray's
  rear arm is correctly ignored (parallel, but 10 mm above the playing top and
  so 10 mm in the air once turned), and a colour holding two types whose rakes
  differ by a tenth of a degree is laid on the area-weighted mean of the two.

  On a bevel-free 32-key design the difference is the whole point: a plain
  180° flip gives black and gray **0 mm²** of bed contact within 0.1 mm — they
  are balanced on an edge — where the measured turn gives 403 mm² and 319 mm².
  (Deepening the bevel trims the contact patch, because a rounded-over edge is
  by definition less flat top; at 2 mm on narrow accidentals it is down to
  about a quarter of that.)

The spine band takes the same turn as its keys, since it is fused to them and
prints as one solid — so it ends up about 2° off level in the black and gray
files. That is the right way round: the playing surface is the one that has to
be flat, and the band's faces are glued, not touched. The fold is applied
*after* the turn, in the bed's own frame; folded first, the row offset would be
turned with everything else and half B would come out 3.5 mm off the bed.

### Closed, so the walls run through

An exported colour is several closed bodies that overlap: each key, the sensor
press under it, and the spine band whose boss reaches `FIT.engage` = 0.4 mm into
the keys of its own colour. A slicer cuts each layer into closed outlines and
unions them, so overlapping bodies come out as **one** outline per region and
the wall lines carry straight through the joint between key and band. That only
works if every body actually closes. Two defects used to stop it, and both are
fixed:

* **The mounting holes left the surface open.** A slab with a hole is built as
  rectangles around the hole's bounding box plus a fan filling box-minus-ring.
  The fan was a pair of bare *caps* — a lid at z1, a floor at z0, the bore wall
  between them — so its outer edge went nowhere: **1216 open edges per spine**,
  all of them ringing the eight screw holes. That is exactly the ring of red a
  slicer draws around them, and the reason it called the model not watertight.
  `pushHoleOuterWall` skins between the two lids along `holeBoxLoop` — the same
  walk the fan itself takes, so it meets it point for point — and the washer
  becomes a solid like every other piece. The skin stands inside the material
  and adds no surface a print can see.

* **The keys had T-junctions.** A drafted key does not always meet itself vertex
  to vertex: a belly runs the full width as *one* edge while the three faces
  below it break the same line at two points. No gap you could measure, but the
  long edge is used once and the short ones once each, so nothing pairs — and to
  a slicer a T-junction is a hole. `weldTJunctions` splits the long edge at the
  points its neighbours already break it at and fans the triangle from the
  opposite corner. Not one vertex moves and not one face changes shape. It looks
  only at open edges, and only at vertices already sitting on one, so a key that
  meets itself properly costs one pass and nothing else.

`XD.printAudit` checks the file **as it will be written** — turned, folded and
all — and the Export panel says the result. Every colour of every design tested
comes out `closed: true, openEdges: 0, flippedEdges: 0`; slicing all 234 layers
of a mixed 32-key design gives closed loops with **zero dangling ends**, so
there is nothing left for a slicer to stitch. The spine slab's volume matches
its analytic value (box minus eight obrounds) to 3 × 10⁻¹¹ mm³, so closing the
washer changed the geometry not at all.

`isWatertight` now separates the two things that get called "not watertight":

| | | |
|---|---|---|
| **open** | an edge used by one face | a hole in the surface — a defect, and there are none |
| **internal** | an edge used by more than two | two closed bodies meeting exactly along it, e.g. the rectangles a slab is built from |

About 256 internal edges per colour remain, all inside the spine slab where its
sub-blocks abut. Every face there still has an inside and an outside, each layer
closes either way, and the slicer unions the pieces — so it does not affect the
print. A checker that insists on *every edge exactly twice* (trimesh, and so the
Mesh Tools plugin) will still call that non-manifold; removing it would mean
triangulating the slab's caps as one conformal polygon-with-holes, which buys
nothing a print can see.

### Share this layout

A design is a few hundred bytes — key types by slot, the four class widths, the
ad-hoc adjustments, the scale and the bevel — and the geometry is rebuilt from
those numbers at the other end by the same `core.js` that built it here. So a
layout travels as text, and needs nothing to be up to travel:

* **Copy Share Link** — the layout packed into the page's own address, as
  `index.html#k=…` for one keyboard or `#r=…` for a whole rig, devices and the
  shape they stand in. Paste it into a message; whoever opens it gets the
  keyboard. Typically 150–900 characters. The address bar is set to the same
  link, so refreshing the page brings the keyboard back.
* **Save Layout File (.json)** — the same layout as a small readable file, for
  where a long link is awkward. **Open Layout File…** reads one back, and also
  reads a raw design of the kind `presets-shared.js` holds.
* **Play travels with it.** On a microtonal keyboard the tuning is not a
  setting that happens to be on beside the design — it is half of what was
  designed, and a 17-note arrangement sent without what its 17 degrees sound
  is a picture of an instrument. So the payload carries a `x` section beside
  the keyboard: `t` all of Scale/Tuning (where 1/1 is written and what it
  sounds at, Auto or Custom, the reading conventions, the rotation, the fill
  list, every degree typed onto the strip, the transposition), `s` the synth
  (timbre and ADSR), `m` how a controller is laid on the keys (the MIDI note
  that plays key 0, and whether velocity is taken). Each section is read back
  by the module that owns it — `XTuning.adopt`, `XPlay.adopt`, `XMidi.adopt`
  — which normalises it exactly as it normalises a stored session.
* What is carried: everything about the keyboard, and everything about playing
  it. What is not: what a device is *called* (`noteBase` / `noteStep` belong to
  the desk it stands on, so a layout you are sent never renumbers yours), the
  preset name, and two things from the MIDI panel — whether this browser has
  been let at the MIDI ports (a consent, not transferable) and which port it
  was listening to (a socket on the machine it was saved on).
* An arriving layout goes through the same rebuild every other edit does, so
  ⌘Z brings back what was there before it. Opening a link on a browser that
  already has work saved asks first.

### Keep it here

* **Save to Presets** — the layout, widths, scale **and bevel** into Design's
  Layout Presets menu. A preset states its own edge break, 0 included; one
  saved before presets carried the edge keeps whatever is on screen rather than
  flattening it to square.
* **Copy Python Log** — puts a complete, runnable Blender script on the
  clipboard. See below.
* **Save design log (.py)** — the same thing as a file.

### Where it lands in Blender

The **Blender world origin** dropdown in the Export panel decides where the
generated keyboard sits. Default is **model centre at 0, 0, 0**: the bounding
box of the whole instrument — 32 keys, both spine halves and all 32 feet — is
centred on the world origin.

| mode | X | Y | Z |
|---|---|---|---|
| **model centre** (default) | −186.65 … 186.65 | −47.46 … 47.46 | −10.77 … 10.77 |
| spine datum | −186.65 … 186.65 | −85.07 … 9.85 | −5.92 … 15.63 |
| drafting sandbox | −1403.76 … −1030.47 | −219.17 … −124.26 | 15.87 … 37.41 |

(figures for the 19-EDO default; the span follows the size scale)

*Model centre* is the one to use for new work. *Spine datum* centres X but keeps
Y = 0 on the spine front face and Z = 0 on the spine bottom face, which is handy
when you are measuring against the spine. *Drafting sandbox* reproduces the
original world position, so the build lands exactly on top of the 15/17/19
layouts inside `Cimbalo_Cromatico_Drafting_Sandbox_Leveling.blend`.

Whichever mode, the builder creates an empty called **Keyboard Root** at
(0, 0, 0) and parents every generated object to it, so the whole keyboard moves,
rotates and scales from the origin as one. On finishing it prints the bounding
box and centre it actually achieved, so you can check at a glance.

The exported STLs are unaffected — they stay in design coordinates (x from the
leftmost white key's left edge, z from the spine bottom face), which is what the
print workflow expects.

### The Python log

Paste it into Blender's Text Editor and press *Run Script*. Structure:

1. A readable header — the world placement it will build at (with the resulting
   bounding box), the design-frame datum, and the fixed spine↔foot relationship.
2. `DESIGN` — scale, notes per equave, derived white count, rotation, key count
   (always 32), AKM320 units (always 1), the key-colour count and the spine type
   it selected, and all four derived widths.
3. `TEMPLATE` — the seven-slot period, annotated with slot name, bias and group.
4. `KEYS` — the 32 keys, left to right: name (prefixed `K00`…`K31` by foot
   index), type, x centre, width, depth, the drafted profile it is instantiated
   from (for a white, including its neighbour context), world X, world Y (back
   face), world Z (bottom face), and the X of the sensor foot it sits over.
   `KEY_PROFILES` below carries those profiles, and only those.
5. `SPINE` and `FEET` — halves A and B, layers, the PCB channel, the two
   obround bores and their 16 centres, the 32 foot X
   values. Two asserts guarantee `len(KEYS) == len(FEET) == 32`.
6. Any warnings on the design, as comments.
7. `WORLD_X0 / WORLD_Y0 / WORLD_Z0 / ORIGIN` — the world placement, editable in
   place if you want to nudge it.
8. `build()` — the same code the WebGL preview runs: the drafted profiles
   instantiated at this design's widths. There are no proxy boxes, no
   stand-ins and no analytic approximation of a key.

   Output goes into a new collection, `Keyboard Generated`, split into
   `Keys - White` / `Keys - Black` / `Keys - Gray` / `Spine` / `Feet` and
   parented to a `Keyboard Root` empty at the origin: one object per key
   (named for its sensor foot), one per spine half and layer, one per foot.
   Materials carry the preview's own colours.

**The Blender build and the browser preview are the same model.** Every number
the builder computes with is written out at full double precision, so Python
reads back the exact bits the browser used. Vertex for vertex, face for face,
part for part, the two agree to **0.000000 mm** — verified across all three
presets, all three origin modes, all seven rotations, fractional size scales,
one- / two- / three-layer spines and per-slot overrides.

`USE_BLEND_CATEGORIES = True` at the top of the builder swaps the parametric
keys, spine and feet for the hand-modelled originals in the drafting sandbox
(`Key Type Categories`, `<kind> type Spine - A/B`, `Feet - A/B`), lifted onto
whatever origin the log was cut for. That is only meaningful inside the sandbox
.blend, and the interior detailing then no longer matches the preview — the
outer envelope, the layout and the datum are identical either way. Duplicated
categories are scaled in X only, which matches the size law for the outer
envelope; the 0.65 / 1.0 / 1.544 mm edge detailing stretches with it, so re-cut
those by hand before printing.

So the loop is: design here → copy the log → run it in a fresh Blender session
→ adjust → tell me what changed.

---

## Accuracy against the drafting sandbox

All three drafted layouts are reproduced from the size law alone (the sheets
run to 59–61 keys; the app generates the first 32 of each, which is the whole
instrument):

| layout | max white-centre error | max slot-centre error |
|---|---|---|
| 15 | 0.00036 mm | 0.00045 mm |
| 17 | 0.00240 mm | 0.00240 mm |
| 19 | 0.00033 mm | 0.00029 mm |

The 17 residual is drift in the sheet itself — its white keys are spaced
27.7081–27.7090 rather than a clean 27.708333, and that accumulates over 24
keys. The app uses the exact value.

**Surface accuracy, key by key.** Not bounding boxes — the real thing: for every
drafted key, the distance from each of its vertices to the generated surface and
from each generated vertex to the drafted surface, worst of the two.

| layout | keys compared | worst surface deviation |
|---|---|---|
| 15 | 30 | **0.126 mm** |
| 17 | 32 | **0.007 mm** |
| 19 | 32 | **0.003 mm** |

All of it inside 0.2 mm; two of the three layouts are inside 0.01 mm.

The 0.126 mm is not an approximation error — it is a disagreement between the
sheets themselves. The 15 sheet's `Split Black Second` is missing an edge loop
that the 17 and 19 ones have, at y = 22.57, z = 5.77. One profile cannot have
that loop and not have it; the profile keeps it, so the 15 layout differs there
by the height of the loop. Every other key in every layout is inside 0.02 mm.

(The 15 sheet is also missing the split pair in its slot 1 — two keys the
pattern calls for that were never drawn. The generator places them; they are
reported as unmatched rather than silently paired with a neighbour.)

**Spine and feet.** Not bounding boxes either — surface distance, measured in
Blender against `One / Two / Three type Spine - A`/`- B` and `Feet - A`/`- B`,
for every one of the three spine types:

| | worst drafted vertex → generated surface |
|---|---|
| half A | **0.011 mm** |
| half B | **0.000133 mm** |
| feet | 0.00002 mm |

Half B's 0.000133 mm is the sheet's own storage precision — the sandbox sits
~1400 mm from the world origin, where a float32 vertex coordinate steps in
0.00012 mm. Half A's 0.011 mm is the levelling: its layer faces are very
slightly tilted, and `model.js` stores one z per face. Built on the origin, as
the default `model centre` mode does, the generated model is the more exact of
the two.

Going the other way, a generated boundary vertex is at most **0.047 mm** from
the drafted surface, and every one of those sits on an obround's tangent line.
The sandbox's own rings omit one of the two tangent vertices — on the left in
some objects and on the right in others — so the drafted hole is a hair
narrower there, inconsistently. The app draws the symmetric obround.

(For the record: modelling the holes as axis-aligned rectangles, which is what
this app did before, put the worst drafted vertex **3.394 mm** off the
generated surface.)

`USE_BLEND_CATEGORIES = True` in the log still duplicates the sandbox's own
objects, but it is no longer more accurate than building from the profiles —
within the numbers above, it is the same geometry.

### Mesh integrity

Checked by pairing every edge across the 32 keys of the 19 layout: 5 948
triangles, **0 degenerate, 0 boundary edges, 0 non-manifold edges, 0 reversed
windings**. Every key is a closed solid, which is what the slicer wants. The
feet are clean too (384 triangles, closed).

**The spine is not, and that is a separate outstanding bug.** Each slab carries
**608 boundary edges and 32 non-manifold edges — 76 and 4 per mounting hole.**
`pushSpineSlab` decomposes the slab into closed boxes around each hole's
bounding box and then fills between that box and the obround with
`pushHoleAnnulus`, and the two tessellations do not share vertices along the
bounding box: the annulus subdivides each side at its ring projections while
the box wall is one quad. The doubled interior walls between adjacent boxes are
what the non-manifold count is. Nothing about it is visible in the shaded
preview, and slicers generally repair it, but the spine STL is not watertight
and the box seams show as spurious edges in Blender's wireframe. Fixing it means
capping each slab as one polygon with holes rather than as a pile of boxes.

---

## What this is not

This is a drafting and layout tool that is now most of the way to a printable
design, but it is not there yet. The foot loop pairs are generated and state
the key-to-sensor relationship exactly, and each one closes into a watertight
sensor press; the three combs separate cleanly by
filament and union into one, two and four shells; and cross-colour interference
is down from about 1200 mm³ to 18.9 mm³. What is left is listed under “What is
still open” above, and the head of that list — turning each loop pair into
something that actually carries the key's travel down to its foot — has to be
solved before anything goes on a bed.
