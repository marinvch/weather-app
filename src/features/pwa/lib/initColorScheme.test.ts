/**
 * Covers the inline colour-scheme script in index.html — the app shell is part
 * of this feature's territory, and the script is unreachable from any module,
 * so the only way to test it is to read it off disk and run it.
 *
 * What this can prove: the script reads the keys MUI writes, stamps the
 * attribute the theme selects on, handles system/light/dark, and never throws.
 * What it cannot prove: that no flash occurs — paint timing is a browser
 * concern, and rests on the script being blocking and inline, which the last
 * case here checks structurally.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import theme from "@/shared/theme/theme";

/**
 * MUI's own init script, as it would be emitted server-side. It is the source
 * of truth for the storage keys, and it is generated from the same constants
 * `useColorScheme` writes with — so diffing against it catches a rename in a
 * MUI upgrade. (`defaultConfig` itself is not reachable: the package's
 * `exports` map only exposes the default export.)
 */
const muiInitScript = renderToStaticMarkup(
  createElement(InitColorSchemeScript)
);

const muiStorageKeys = [
  ...muiInitScript.matchAll(/localStorage\.getItem\('([^']+)'\)/g),
].map((match) => match[1]);

// Vitest runs from the project root; under jsdom `import.meta.url` is not a
// file: URL, so it cannot be used to locate the file.
const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

/** The one inline <script> in <head>; the app bundle is a module tag in <body>. */
const inlineScript = (() => {
  const match = indexHtml.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("index.html has no inline <script> in the head");
  return match[1];
})();

const runInitScript = () => {
  new Function(inlineScript)();
};

const stubMatchMedia = (prefersDark: boolean) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: prefersDark && query.includes("dark"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
};

const attribute = () =>
  document.documentElement.getAttribute("data-mui-color-scheme");

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-mui-color-scheme");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("index.html colour-scheme init script", () => {
  it("reads every storage key MUI reads", () => {
    // Sanity-check the fixture itself before trusting it.
    expect(muiStorageKeys).toEqual(
      expect.arrayContaining([
        "mui-mode",
        "mui-color-scheme-dark",
        "mui-color-scheme-light",
      ])
    );

    // A key this script does not read is a preference it cannot honour.
    muiStorageKeys.forEach((key) => {
      expect(inlineScript).toContain(`"${key}"`);
    });
  });

  it("stamps the attribute both MUI and the theme select on", () => {
    expect(muiInitScript).toContain("data-mui-color-scheme");
    expect(theme.colorSchemeSelector).toBe("data-mui-color-scheme");
    expect(inlineScript).toContain(`"${theme.colorSchemeSelector}"`);
  });

  it("applies a saved dark mode", () => {
    localStorage.setItem("mui-mode", "dark");
    stubMatchMedia(false);

    runInitScript();

    expect(attribute()).toBe("dark");
  });

  it("applies a saved light mode even when the system prefers dark", () => {
    localStorage.setItem("mui-mode", "light");
    stubMatchMedia(true);

    runInitScript();

    expect(attribute()).toBe("light");
  });

  it("resolves mode 'system' from the media query", () => {
    localStorage.setItem("mui-mode", "system");
    stubMatchMedia(true);

    runInitScript();

    expect(attribute()).toBe("dark");
  });

  it("treats a missing mode as 'system', which is MUI's defaultMode", () => {
    stubMatchMedia(false);

    runInitScript();

    expect(attribute()).toBe("light");
  });

  it("honours a renamed colour scheme", () => {
    // MUI persists the scheme names separately from the mode; a custom dark
    // scheme has to reach the attribute or the CSS selector never matches.
    localStorage.setItem("mui-mode", "dark");
    localStorage.setItem("mui-color-scheme-dark", "midnight");
    stubMatchMedia(false);

    runInitScript();

    expect(attribute()).toBe("midnight");
  });

  it("does not throw when localStorage is unavailable", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      });
    stubMatchMedia(true);

    expect(() => runInitScript()).not.toThrow();
    expect(attribute()).toBeNull();

    getItem.mockRestore();
  });

  it("is blocking and inline, ahead of the app bundle", () => {
    const scriptTag = indexHtml.slice(indexHtml.indexOf("<script>"));
    expect(scriptTag.startsWith("<script>")).toBe(true);
    // No src/defer/async/type=module: any of those would run after parse, and
    // after the first paint this exists to get ahead of.
    expect(inlineScript).not.toContain("src=");
    expect(indexHtml).not.toMatch(/<script[^>]*(defer|async)[^>]*>\s*\(function/);
    expect(indexHtml.indexOf("<script>")).toBeLessThan(
      indexHtml.indexOf("/src/main.tsx")
    );
  });
});
