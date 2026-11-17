# ECHOKEEPER

*The lantern remembers how you fought.*

A wave-defence game around one mechanic: **time echoes**. Defend the Great
Lantern through 12 waves. The game records your last 6 seconds of movement
and fire — press **E** and a ghost keeper replays that loop forever as a
living turret. Choreograph a chorus of your past selves, spend dew on 8
leveled upgrades, taunt three multi-phase bosses off the lantern, and hold
until dawn.

- Play: serve `game/` statically and open `game/index.html` (desktop
  Chrome, keyboard + mouse, fully offline).
- Hand in: `MAKEFUN_OUTPUT_DIR=out node main.ts` copies `game/` and
  `screenshots/` to the output directory and writes `dossier.json`.
- Validate: `node tests/logic.test.mjs`, `node tests/autopilot.mjs`,
  `node tools/playtest.mjs`, `node tools/capture.mjs`.

See REPORT.md for the full design and measured validation results.
