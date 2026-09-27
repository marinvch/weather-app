import { describe, it, expect, vi } from "vitest";
import type { BaseQueryApi } from "@reduxjs/toolkit/query";
import { createBaseQuery, isTransientError } from "./baseQuery";

function api(): BaseQueryApi {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    abort: () => controller.abort(),
    dispatch: vi.fn(),
    getState: () => ({}),
    extra: undefined,
    endpoint: "test",
    type: "query",
  };
}

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** No waiting between attempts — the retry *policy* is under test, not the clock. */
const noBackoff = async () => {};

describe("isTransientError", () => {
  it.each([
    ["FETCH_ERROR", true],
    ["TIMEOUT_ERROR", true],
    [500, true],
    [503, true],
    [429, true],
    [400, false],
    [404, false],
    ["PARSING_ERROR", false],
  ] as const)("status %s → %s", (status, expected) => {
    expect(isTransientError({ status } as never)).toBe(expected);
  });
});

describe("createBaseQuery", () => {
  it("retries a 503 and returns the eventual success", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(503))
      .mockResolvedValueOnce(json(503))
      .mockResolvedValueOnce(json(200, { ok: true }));

    const query = createBaseQuery("https://api.example.test/v1/", {
      fetchFn,
      backoff: noBackoff,
    });
    const result = await query("forecast", api(), {});

    expect(result.data).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("gives up after the retry budget and reports the last error", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => json(503));

    const query = createBaseQuery("https://api.example.test/v1/", {
      fetchFn,
      backoff: noBackoff,
      maxRetries: 2,
    });
    const result = await query("forecast", api(), {});

    expect(result.error).toMatchObject({ status: 503 });
    // One attempt plus two retries — not RTK's default of five, which would
    // keep a skeleton on screen for most of a minute.
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("does not retry a client error", async () => {
    // A 400 means the request itself is wrong; asking again cannot fix it and
    // only spends the free-tier rate limit.
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json(400));

    const query = createBaseQuery("https://api.example.test/v1/", {
      fetchFn,
      backoff: noBackoff,
    });
    const result = await query("forecast", api(), {});

    expect(result.error).toMatchObject({ status: 400 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("times out a request that never answers", async () => {
    // Before this, a hung request left the loading skeleton up forever:
    // describeQueryError had a TIMEOUT_ERROR message that nothing could reach.
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(
      (input) =>
        new Promise((_, reject) => {
          const signal = (input as Request).signal;
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    const query = createBaseQuery("https://api.example.test/v1/", {
      fetchFn,
      backoff: noBackoff,
      timeoutMs: 20,
      maxRetries: 0,
    });
    const result = await query("forecast", api(), {});

    expect(result.error).toMatchObject({ status: "TIMEOUT_ERROR" });
  });
});
