---
name: write-first-test
description: Set up Vitest in this repo and write the first real test, or add a test once the harness exists. Use whenever a change needs verifying and there is nothing to run — "add a test", "how do I test this", "is this covered", "set up testing", "напиши тест". Also use before fixing a bug, so the bug is reproduced by a failing test first.
---

# /write-first-test — get a real test running

This repo has **zero test files and no test runner installed**. `npm test` does not exist. Every
change here is currently verified only by `tsc -b` and by loading the page — which is why this skill
exists and why it should stop being needed after it runs once.

The runner for this repo is **Vitest**: it reads the existing `vite.config.ts`, so the React plugin,
the ES2015 target and the module resolution already match how the app actually builds. Do not
introduce Jest — it needs its own ESM and JSX pipeline against `"type": "module"`.

## Steps

1. Install the harness:

   ```bash
   npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
   ```

2. Add the `test` block to `vite.config.ts` (it is a `defineConfig` from `vite`, so add
   `/// <reference types="vitest" />` at the top of the file), with `environment: 'jsdom'`,
   `globals: true`, and a setup file importing `@testing-library/jest-dom`.

3. Add scripts to `package.json`: `"test": "vitest"` and `"test:run": "vitest run"`.

4. Write the first test against something pure — **not** a component. The highest-value targets, in
   order, are the places with real logic and no React:

   - `src/utils/geolocation.ts` — emergency-number lookup by country code, including the fallback
     for a country missing from `EMERGENCY_NUMBERS`.
   - `src/store/api/weatherApi.ts` — `generateGeneralAnalysis` / `generateMountainAnalysis` are pure
     functions from a `WeatherResponse` to an analysis. They are **not exported**; export them (or
     move them to a sibling module) as part of writing the test rather than testing through the
     network layer.
   - `src/components/WeatherCard/WeatherCard.tsx` — the metric→imperial conversions and the
     16-point compass derivation.

5. Only then move to components with `@testing-library/react`. The dashboard contract makes them
   testable: each takes `{ coordinates, locationName }` and owns its query, so render it inside a
   `<Provider store={…}>` with a mocked fetch.

## Invariants

- **Test files sit beside the code** as `*.test.ts` / `*.test.tsx`, matching the one-folder-per-
  component layout already in `src/components/`. Do not create a parallel `__tests__` tree.
- **Add the test glob to `tsconfig.app.json`'s reach or the checker will not see the tests** — they
  are under `src/`, so they are included today, which also means `noUnusedLocals` applies to them.
- **ESLint covers every `.ts`/`.tsx` file with no test override**, so test files are linted like
  source. Add an override block to `eslint.config.js` if testing idioms trip it. Note the tree
  already has two baseline lint errors (`ui/badge.tsx`, `ui/button.tsx`) — see `/type-check`.
- **Mock the network, never hit Open-Meteo in a test.** The APIs are keyless and would work, which
  is exactly the trap: a test that silently depends on a live third-party host is not a test.
- **A bug fix starts with a failing test that reproduces it**, then the fix. That ordering is the
  whole reason to have the harness.

## Verify

```bash
npx vitest run
```

It must exit 0 and report at least one passing test. Then confirm the harness did not break the
existing checks:

```bash
npx tsc -b --force && npm run lint
```

Once `npm test` exists and passes, update the "Running it" section of the root `AGENTS.md` — it
currently states there is no test command, and that line must stop being true.
