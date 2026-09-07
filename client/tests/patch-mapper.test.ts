import { describe, expect, it } from "vitest";

import {
  mapRegionsToPatchesTs,
  patchToNormalizedCoordsTs,
} from "../src/sensitivity/patch-mapper";

describe("patch mapping", () => {
  it("maps normalized region to patch indices", () => {
    const indices = mapRegionsToPatchesTs(1920, 1080, [
      { x: 0, y: 0, width: 0.1, height: 0.1, category: "password" },
    ]);
    expect(indices.length).toBeGreaterThan(0);
    expect(indices[0]).toBe(0);
  });

  it("converts patch index to normalized coords", () => {
    const [x, y] = patchToNormalizedCoordsTs(0);
    expect(x).toBeCloseTo(1 / 48, 5);
    expect(y).toBeCloseTo(1 / 48, 5);
  });
});
