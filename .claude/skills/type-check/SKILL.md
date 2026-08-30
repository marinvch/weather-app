---
name: type-check
description: Run the TypeScript checker on this repo and keep the strict config honest. Use before claiming a change compiles, before committing, after touching src/types/weather.ts or any RTK Query response type, and when an agent is tempted to reach for `any`, `as any`, `@ts-ignore` or `@ts-expect-error`. Triggers — "does this compile", "type check", "check the types", "is the build clean", "мине ли компилацията".
---

# /type-check — keep types honest

There is no test suite here, so the type checker is the only automated verification this repo has.
It is not wired into a standalone npm script — `tsc -b` only runs as half of `npm run build` — which
makes it easy to skip.

## Steps

1. Run the checker on its own:

   ```bash
   npx tsc -b --force
   ```

   `--force` matters. Plain `tsc -b` is incremental against
   `node_modules/.tmp/tsconfig.app.tsbuildinfo`, so a second run after an unrelated change can
   report nothing and look like a pass.

2. If it is clean, also run the linter — it catches the React-hooks dependency mistakes the type
   checker cannot:

   ```bash
   npm run lint
   ```

   **`npm run lint` exits 0 on a clean tree.** There is no baseline to discount any more — the two
   long-standing `react-refresh/only-export-components` errors were in the generated shadcn
   `badge.tsx` and `button.tsx`, and those files were deleted with Tailwind. Every lint error you
   see is yours.

   Lint also enforces the architecture: `no-restricted-imports` on the `@/` alias blocks
   feature-to-feature imports and anything in `shared/` reaching up into `features/` or `app/`. It
   matches on the alias string, so a relative `../../features/marine` slips past — always import
   across directories with `@/`.

## Invariants

- **`npx tsc -b --force` exits 0 on a clean tree.** That was true as of the Cortex install; if it
  fails on code you did not touch, say so rather than working around it.
- **`tsconfig.json` is solution-style** — no `files` of its own, only references to
  `tsconfig.app.json` (src/) and `tsconfig.node.json` (vite.config.ts). This is why the command is
  `tsc -b`, not `tsc`. A new Node-side script must be added to `tsconfig.node.json`'s `include` or
  it is checked by nothing.
- **`verbatimModuleSyntax` is on**, so every type-only import must be written `import type { … }`.
  A plain `import` of a type is an error, not a style choice.
- **`noUnusedLocals` and `noUnusedParameters` are on.** A prop you accept and do not use must be
  left out of the destructure — which is why several dashboards destructure only `coordinates` and
  never bind `locationName`.
- **There is exactly one type escape in `src/`** — the Leaflet icon patch at
  `src/components/WeatherMap/WeatherMap.tsx:10-11`, with an eslint-disable and a comment saying
  why. Adding a second `as any`, `@ts-ignore` or `@ts-expect-error` needs the same treatment: a
  comment naming the library limitation that forces it. If you cannot name one, fix the type.
- **Response types live in `src/types/weather.ts`.** Do not silence a type error by declaring a
  local shape in a component — that hides the mismatch instead of recording it.

## Verify

```bash
npx tsc -b --force
npm run lint
```

`tsc -b --force` must exit 0. `npm run lint` must report **only** the two known baseline errors in
`ui/badge.tsx` and `ui/button.tsx` — not zero, and not three. `npm run build` also proves the type
half, but it additionally runs the Vite bundle, so it is the slower way to learn the same thing.
