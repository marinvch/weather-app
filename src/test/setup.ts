import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount anything rendered between tests so a stale DOM cannot make the next
// test pass for the wrong reason.
afterEach(() => {
  cleanup();
});

// Open-Meteo and Nominatim are keyless, which means an un-mocked fetch in a test
// would quietly succeed against the live hosts. Fail loudly instead: each test
// that needs the network must stub fetch itself.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error(
        "Unmocked fetch in a test. Stub globalThis.fetch for this case — tests must never hit the live Open-Meteo or Nominatim hosts.",
      );
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});
