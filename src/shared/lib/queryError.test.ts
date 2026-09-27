import { describe, it, expect } from "vitest";
import { describeQueryError } from "./queryError";

describe("describeQueryError", () => {
  it("translates RTK Query's transport tags into next steps", () => {
    expect(describeQueryError({ status: "FETCH_ERROR" })).toMatch(/connection/i);
    expect(describeQueryError({ status: "TIMEOUT_ERROR" })).toMatch(/too long/i);
    expect(describeQueryError({ status: "PARSING_ERROR" })).toMatch(
      /could not read/i,
    );
  });

  it("distinguishes the HTTP statuses that mean different things to a reader", () => {
    expect(describeQueryError({ status: 404 })).toMatch(
      /no data for this location/i,
    );
    expect(describeQueryError({ status: 429 })).toMatch(/wait a minute/i);
    // A 5xx is explicitly not the reader's fault, so it says so.
    expect(describeQueryError({ status: 503 })).toMatch(/at their end/i);
    expect(describeQueryError({ status: 400 })).toMatch(/rejected the request/i);
  });

  it("falls through to a SerializedError's message", () => {
    expect(describeQueryError({ message: "Aborted" })).toBe("Aborted");
  });

  it("never returns an empty string, whatever it is handed", () => {
    // It is the thing shown when something has already gone wrong, so a blank
    // return would replace an error with a silent one.
    for (const input of [undefined, null, 0, "", {}, { message: "" }, []]) {
      expect(describeQueryError(input).length).toBeGreaterThan(0);
    }
  });
});
