import { describe, expect, it } from "vitest";

import { TENSOR_CONTRACT } from "../src/protocol/messages";
import {
  assertOutboundPayloadSafe,
  buildLatentFramePayload,
  encodeTensorPayload,
} from "../src/protocol/serializer";

describe("tensor serialization", () => {
  it("encodes float32 matrix to fp16 base64", () => {
    const size = TENSOR_CONTRACT.patchCount * TENSOR_CONTRACT.embeddingDim;
    const matrix = new Float32Array(size);
    matrix[0] = 1.0;
    matrix[100] = 3.0;
    const payload = encodeTensorPayload(matrix);
    expect(payload.shape).toEqual([576, 1152]);
    expect(payload.dtype).toBe("float16");
    expect(payload.data.length).toBeGreaterThan(0);
  });

  it("builds latent frame without forbidden fields", () => {
    const size = TENSOR_CONTRACT.patchCount * TENSOR_CONTRACT.embeddingDim;
    const matrix = new Float32Array(size);
    const frame = buildLatentFramePayload({
      frameId: "f-00001",
      stateVersion: 2,
      sanitizedMatrix: matrix,
      sensitivePatchIndices: [10, 20],
      viewportHash: "sha256:abc",
      lastActionId: null,
    });
    expect(() => assertOutboundPayloadSafe(frame)).not.toThrow();
    expect(frame.spatial_metadata.sensitive_patch_indices).toEqual([10, 20]);
  });

  it("rejects forbidden outbound fields", () => {
    expect(() => assertOutboundPayloadSafe({ screenshot: "x" })).toThrow();
  });
});
