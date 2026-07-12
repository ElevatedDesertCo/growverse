# incoming/ : drop character models here

Drop KayKit-style character `.glb` files into this folder, then run:

```
npm run rig:ingest
```

For each `.glb`, the ingest tool will:

1. **Validate** it against the shared `Rig_Medium` skeleton (must match the 23 bones).
   KayKit character packs already use this rig, so they pass with no rework.
2. **Bake** the full clean KayKit clip set onto it (so it animates identically to the
   default classes, exactly like the Combat Mech).
3. **Place** it under `public/models/chars/kaykit/<name>.glb`.
4. **Register** it in the game's visual manifest (`custom_<name>` body) by regenerating
   `src/render/characters/custom_bodies.generated.ts`, and refresh the media manifest.

After that the body is a first-class engine asset. The ingest prints the one-line snippet
to put each character in the world as an NPC, a mob, or a player skin (that last step is a
design choice, so it stays manual). Anything that fails validation is reported and skipped,
not placed.

The `.glb` files you drop here are staging inputs and are gitignored; the committed copies
live under `public/models/chars/kaykit/`.

See `docs/design/custom-character-pipeline.md` for the full pipeline.
