# presets/

Drag-and-drop preset library. This folder, not the app's own preset panel,
is the easiest place to manage presets in bulk.

- **Add** a preset: drop a "Save Layout File (.json)" download in here.
- **Remove** a preset: delete its file.
- **Rename** a preset: rename its file (the filename, minus `.json`, is the
  preset's name).

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
