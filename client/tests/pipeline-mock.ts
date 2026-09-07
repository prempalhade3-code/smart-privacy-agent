/**
 * Deterministic pipeline mock for unit/integration testing without WebGPU.
 * Does NOT run in production — tests protocol + serialization path only.
 */
import { TENSOR_CONTRACT } from "../src/protocol/messages";
import { buildLatentFramePayload } from "../src/protocol/serializer";
import { mapRegionsToPatchesTs } from "../src/sensitivity/patch-mapper";

export function mockPipelineFrame(params: {
  frameId: string;
  stateVersion: number;
  seed?: number;
}): ReturnType<typeof buildLatentFramePayload> {
  const size = TENSOR_CONTRACT.patchCount * TENSOR_CONTRACT.embeddingDim;
  const matrix = new Float32Array(size);
  const seed = params.seed ?? 42;
  for (let i = 0; i < size; i++) {
    matrix[i] = Math.sin(i * 0.01 + seed) * 0.5;
  }
  matrix[100] = 3.0;

  const sensitive = mapRegionsToPatchesTs(1920, 1080, [
    { x: 0, y: 0, width: 0.05, height: 0.05, category: "password" },
  ]);

  return buildLatentFramePayload({
    frameId: params.frameId,
    stateVersion: params.stateVersion,
    sanitizedMatrix: matrix,
    sensitivePatchIndices: sensitive,
    viewportHash: "sha256:test",
    lastActionId: null,
  });
}
