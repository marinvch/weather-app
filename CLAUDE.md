@AGENTS.md

## Verifying your work

| Check | Command | A healthy run |
|---|---|---|
| Build | `npm run build` | exits 0 and ends `✓ built in …`; the "chunks larger than 500 kB" warning on `index-*.js` (~700 kB: MUI, Emotion, the map, the shell) is known and is not a failure |
| Test | `npm run test:run` | every test passes; none skipped to get there (37 files, 638 tests on `dev` after the 2026-09-27 robustness pass) |
| Lint | `npm run lint` | no output, exit 0 |
| Typecheck | `npm run typecheck` | no output, exit 0 |

Use `npm run test:run`, not `npm test`: `npm test` is `vitest` in watch mode and does not return in
an interactive terminal.

"Done" means these ran and passed in this session, with their output shown — not that the edit
was made. A red test is information about the code; change the code until it is green, and leave
the test alone unless the task is explicitly to change what it asserts.
