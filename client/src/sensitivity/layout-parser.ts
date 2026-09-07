import { TENSOR_CONTRACT } from "../protocol/messages";
import type { SensitiveRegion } from "../messaging/types";
import { mapRegionsToPatchesTs, patchToNormalizedCoordsTs } from "./patch-mapper";

export interface LayoutParser {
  mapRegionsToPatches(
    viewportWidth: number,
    viewportHeight: number,
    regions: SensitiveRegion[],
  ): number[];
  patchToNormalizedCoords(patchIndex: number): [number, number];
}

/** TypeScript patch mapper (default). WASM is optional — enable after `npm run build:wasm`. */
export async function initLayoutParser(): Promise<LayoutParser> {
  return {
    mapRegionsToPatches(viewportWidth, viewportHeight, regions) {
      return mapRegionsToPatchesTs(viewportWidth, viewportHeight, regions);
    },
    patchToNormalizedCoords(patchIndex) {
      return patchToNormalizedCoordsTs(patchIndex);
    },
  };
}

export { TENSOR_CONTRACT };
