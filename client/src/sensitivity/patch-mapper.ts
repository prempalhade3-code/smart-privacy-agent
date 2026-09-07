import { TENSOR_CONTRACT } from "../protocol/messages";
import type { SensitiveRegion } from "../messaging/types";

export function mapRegionsToPatchesTs(
  viewportWidth: number,
  viewportHeight: number,
  regions: SensitiveRegion[],
): number[] {
  const { gridRows, gridCols } = TENSOR_CONTRACT;
  const seen = new Set<number>();
  const patchW = Math.max(1, Math.ceil(viewportWidth / gridCols));
  const patchH = Math.max(1, Math.ceil(viewportHeight / gridRows));

  for (const region of regions) {
    const px = region.x * viewportWidth;
    const py = region.y * viewportHeight;
    const pw = Math.max(1, region.width * viewportWidth);
    const ph = Math.max(1, region.height * viewportHeight);
    const colStart = Math.min(gridCols - 1, Math.floor(px / patchW));
    const colEnd = Math.min(gridCols - 1, Math.floor((px + pw) / patchW));
    const rowStart = Math.min(gridRows - 1, Math.floor(py / patchH));
    const rowEnd = Math.min(gridRows - 1, Math.floor((py + ph) / patchH));
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        seen.add(row * gridCols + col);
      }
    }
  }
  return [...seen].sort((a, b) => a - b);
}

export function patchToNormalizedCoordsTs(patchIndex: number): [number, number] {
  const { gridRows, gridCols } = TENSOR_CONTRACT;
  const row = Math.floor(patchIndex / gridCols);
  const col = patchIndex % gridCols;
  return [(col + 0.5) / gridCols, (row + 0.5) / gridRows];
}
