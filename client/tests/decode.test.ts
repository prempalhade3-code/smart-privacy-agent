import { describe, expect, it } from "vitest";

import { toCanvasSize } from "../src/capture/decode";

describe("canvas dimensions", () => {
  it("coerces valid sizes", () => {
    expect(toCanvasSize(224)).toBe(224);
    expect(toCanvasSize(224.7)).toBe(224);
  });

  it("rejects invalid sizes", () => {
    expect(() => toCanvasSize(0)).toThrow();
    expect(() => toCanvasSize(NaN)).toThrow();
  });
});
