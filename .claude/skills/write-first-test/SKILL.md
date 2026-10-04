---
name: write-first-test
description: Set up Vitest in this repo and write the first real test, or add a test once the harness exists. Use whenever a change needs verifying and there is nothing to run — "add a test", "how do I test this", "is this covered", "set up testing", "напиши тест". Also use before fixing a bug, so the bug is reproduced by a failing test first.
---

# /write-first-test — get a real test running

The harness exists: Vitest + jsdom + Testing Library are installed, and `npm run test:run` runs the
suite once (`npm test` is watch mode and does not return). Steps 1–3 below are already done and
stay as the record of how it is set up — to add a test, start at step 4.

The runner for this repo is **Vitest**: it reads the existing `vite.config.ts`, so the React plugin,
the ES2015 target and the module resolution already match how the app actually builds. Do not
introduce Jest — it needs its own ESM and JSX pipeline against `"type": "module"`.

## Steps

1. Install the harness:

   ```bash
   npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
   ```

2. Add the `test` block to `vite.config.ts`. Import `defineConfig` from **`vitest/config`**, not
   from `vite` — Vitest 4 dropped the `/// <reference types="vitest" />` form, and using it fails
   `tsc -b` with *"'test' does not exist in type UserConfigExport"*. Use `environment: 'jsdom'`,
   `globals: true`, and `setupFiles: ['./src/test/setup.ts']`.

3. Add scripts to `package.json`: `"test": "vitest"` and `"test:run": "vitest run"`.

4. Write the test against something pure — **not** a component. The places with real logic and no
   React, each already with a test file beside it to extend:

   - `src/features/location/lib/geolocation.ts` — emergency-number lookup by country code,
     including the fallback for a country missing from `EMERGENCY_NUMBERS`.
   - `src/features/*/lib/advice.ts` — `adviseGeneral`, `adviseMarine`, `adviseMountain` and
     `adviseAgriculture` are exported pure functions from a response to an analysis. Test them
     directly rather than through the network layer.
   - `src/shared/lib/units.ts` — the metric→imperial conversions and `degreesToCardinal`;
     `src/shared/ui/WeatherCard.tsx` holds the 16-point compass derivation.

5. Only then move to components with `@testing-library/react`. The dashboard contract makes them
   testable: each takes `{ coordinates, locationName }` and owns its query, so render it inside a
   `<Provider store={…}>` with a mocked fetch.

## Invariants

- **Test files sit beside the code** as `*.test.ts` / `*.test.tsx` — `src/shared/lib/units.test.ts`
  next to `units.ts`. `src/test/` holds only `setup.ts`. Do not create a parallel `__tests__` tree.
- **Add the test glob to `tsconfig.app.json`'s reach or the checker will not see the tests** — they
  are under `src/`, so they are included today, which also means `noUnusedLocals` applies to them.
- **ESLint covers every `.ts`/`.tsx` file with no test override**, so test files are linted like
  source. Add an override block to `eslint.config.js` if testing idioms trip it. `npm run lint` is
  clean, with no baseline errors — see `/type-check`.
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

The "Running it" section of the root `AGENTS.md` lists the test commands and says what is and is
not covered. When a test covers something that paragraph lists as uncovered, update it.
