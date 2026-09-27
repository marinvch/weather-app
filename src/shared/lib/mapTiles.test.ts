import { describe, it, expect, vi } from "vitest";
import {
  BASE_LAYERS,
  DEFAULT_BASE_LAYER_ID,
  RAINVIEWER_INDEX_URL,
  SEAMARK_LAYER,
  fetchRadarFrames,
  frameOffsetLabel,
  parseRadarFrames,
} from "./mapTiles";

/** Trimmed from a real response — the shape, not a hand-written guess. */
const RAINVIEWER_INDEX = {
  version: "2.0",
  generated: 1788635127,
  host: "https://tilecache.rainviewer.com",
  radar: {
    past: [
      { time: 1788634200, path: "/v2/radar/7ac72d3e9217" },
      { time: 1788634800, path: "/v2/radar/95fb28a59bee" },
    ],
    nowcast: [{ time: 1788635400, path: "/v2/radar/nowcast_abc" }],
  },
  satellite: { infrared: [] },
};

describe("tile sources", () => {
  it("credits every source, because all three licences require it", () => {
    // A map that strips attribution is a licence breach, not a style choice.
    for (const layer of BASE_LAYERS) {
      expect(layer.attribution).not.toBe("");
    }
    expect(SEAMARK_LAYER.attribution).toMatch(/OpenSeaMap/);
    expect(BASE_LAYERS[0].attribution).toMatch(/OpenStreetMap/);
  });

  it("names a default base layer that actually exists", () => {
    expect(
      BASE_LAYERS.some((layer) => layer.id === DEFAULT_BASE_LAYER_ID),
    ).toBe(true);
  });

  it("keeps Esri's row-before-column tile order", () => {
    // Esri serves {z}/{y}/{x}. Copying OSM's {z}/{x}/{y} here returns tiles of
    // the wrong places with a 200, which is far harder to spot than a 404.
    const esri = BASE_LAYERS.find((layer) => layer.id === "satellite");
    expect(esri?.urlTemplate).toMatch(/\{z\}\/\{y\}\/\{x\}$/);
  });

  it("needs no key anywhere", () => {
    const templates = [
      ...BASE_LAYERS.map((layer) => layer.urlTemplate),
      SEAMARK_LAYER.urlTemplate,
      RAINVIEWER_INDEX_URL,
    ];
    for (const url of templates) {
      expect(url).not.toMatch(/appid|api_?key|access_?token/i);
      expect(url.startsWith("https://")).toBe(true);
    }
  });
});

describe("parseRadarFrames", () => {
  it("reads past and nowcast frames into one timeline", () => {
    const frames = parseRadarFrames(RAINVIEWER_INDEX);

    expect(frames).toHaveLength(3);
    expect(frames.map((frame) => frame.kind)).toEqual([
      "past",
      "past",
      "forecast",
    ]);
    expect(frames.map((frame) => frame.time)).toEqual([
      1788634200, 1788634800, 1788635400,
    ]);
  });

  it("builds an absolute Leaflet template from the host and the frame path", () => {
    const [first] = parseRadarFrames(RAINVIEWER_INDEX);
    expect(first.urlTemplate).toBe(
      "https://tilecache.rainviewer.com/v2/radar/7ac72d3e9217/256/{z}/{x}/{y}/2/1_1.png",
    );
  });

  it("returns nothing rather than throwing on a shape it does not know", () => {
    // Third-party JSON on a free endpoint. It has already been seen with an
    // empty nowcast array and no satellite frames at all.
    expect(parseRadarFrames(undefined)).toEqual([]);
    expect(parseRadarFrames(null)).toEqual([]);
    expect(parseRadarFrames("nope")).toEqual([]);
    expect(parseRadarFrames({})).toEqual([]);
    expect(parseRadarFrames({ host: "https://x", radar: {} })).toEqual([]);
    expect(
      parseRadarFrames({ ...RAINVIEWER_INDEX, host: "http://insecure" }),
    ).toEqual([]);
  });

  it("skips individual frames that are missing a time or a path", () => {
    const frames = parseRadarFrames({
      host: "https://tilecache.rainviewer.com",
      radar: {
        past: [
          { time: 1, path: "/ok" },
          { time: "soon", path: "/bad" },
          { time: 2 },
          { time: 3, path: "no-leading-slash" },
        ],
      },
    });
    expect(frames.map((frame) => frame.time)).toEqual([1]);
  });
});

describe("fetchRadarFrames", () => {
  it("resolves to no frames when fetch throws synchronously", async () => {
    // The test setup stubs fetch to throw, and a blocked or offline fetch can
    // too. A bare .catch() would not see a synchronous throw, and the map has
    // to keep working without the radar.
    await expect(fetchRadarFrames()).resolves.toEqual([]);
  });

  it("resolves to no frames on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    await expect(fetchRadarFrames()).resolves.toEqual([]);
  });

  it("parses a good response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(RAINVIEWER_INDEX)),
    );
    const frames = await fetchRadarFrames();
    expect(frames).toHaveLength(3);
  });
});

describe("frameOffsetLabel", () => {
  const now = 1_788_635_400_000;

  it("says where the frame sits relative to now", () => {
    expect(frameOffsetLabel(now / 1000, now)).toBe("now");
    expect(frameOffsetLabel(now / 1000 - 1800, now)).toBe("30 min ago");
    expect(frameOffsetLabel(now / 1000 + 1200, now)).toBe("in 20 min");
  });
});
