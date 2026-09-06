# presets/

Drag-and-drop preset library. This folder, not the app's own preset panel,
is the easiest place to manage presets in bulk.

- **Add** a preset: drop a "Save Layout File (.json)" download in here.
- **Remove** a preset: delete its file.
- **Rename** a preset: rename its file (the filename, minus `.json`, is the
  preset's name).

## Saying more than the name

A preset can also carry a note count and a line of history — where the tuning
is out of, whose instrument it is after, a link to the source. Add these
top-level fields by hand to the saved `.json`, beside `"format"` and
`"data"`:

```json
{
  "format": "xenachord-layout",
  "description": "Vicentino's 1555 archicembalo — see [Wikipedia](https://en.wikipedia.org/wiki/Archicembalo)",
  "notes": 31,
  "data": { ... }
}
```

- `description` — shown small and dim beside the name in the preset list.
  `[label](url)` becomes a real link (http/https only).
- `notes` — the note count, shown bold before the name. Optional for a single
  keyboard, where it's read off the layout's own period; a rig has to say its
  own number, since stacked manuals of 19+19+17+17 are a 31-note instrument,
  not a 72-note one.

Neither field touches the layout — the reader ignores them.

Each downloaded layout file already carries everything: key types, widths,
scale, and — because "Save Layout File" saves the whole session — the
tuning/notation and timbre/synth settings that were active when you saved it.

After changing this folder, run from the `xenachord-designer` directory:

```
node build-presets.js
```

That regenerates `presets-shared.js`, which is the file the app actually
reads (`index.html` runs by opening a file directly, so it can't fetch()
this folder's contents itself — see the comments in `presets-shared.js`).
Commit both the folder and the regenerated `presets-shared.js`.
