import { gzipSync } from "fflate";

import { TENSOR_CONTRACT, type LatentFramePayload, type TensorPayload } from "./messages";

const FORBIDDEN_KEYS =
  /screenshot|raw_pixels?|image_data|dom_html|password|credential|payment/i;

export function assertOutboundPayloadSafe(obj: unknown, path = ""): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === "object") {
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => assertOutboundPayloadSafe(item, `${path}[${i}]`));
      return;
    }
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const keyPath = path ? `${path}.${key}` : key;
      if (FORBIDDEN_KEYS.test(key)) {
        throw new Error(`Forbidden outbound field: ${key}`);
      }
      assertOutboundPayloadSafe(value, keyPath);
    }
  }
}

export function float32ToFloat16Buffer(matrix: Float32Array): ArrayBuffer {
  const out = new Uint16Array(matrix.length);
  for (let i = 0; i < matrix.length; i++) {
    out[i] = float32ToFloat16(matrix[i]!);
  }
  return out.buffer;
}

function float32ToFloat16(value: number): number {
  const floatView = new Float32Array(1);
  const intView = new Int32Array(floatView.buffer);
  floatView[0] = value;
  const bits = intView[0]!;
  const sign = (bits >> 16) & 0x8000;
  let exponent = ((bits >> 23) & 0xff) - 127 + 15;
  let mantissa = bits & 0x7fffff;

  if (exponent <= 0) {
    if (exponent < -10) return sign;
    mantissa = (mantissa | 0x800000) >> (1 - exponent);
    return sign | (mantissa >> 13);
  }
  if (exponent >= 31) return sign | 0x7c00;
  return sign | (exponent << 10) | (mantissa >> 13);
}

export function encodeTensorPayload(
  matrix: Float32Array,
  options?: { compress?: boolean },
): TensorPayload {
  const { patchCount, embeddingDim } = TENSOR_CONTRACT;
  if (matrix.length !== patchCount * embeddingDim) {
    throw new Error(
      `Tensor size mismatch: expected ${patchCount * embeddingDim}, got ${matrix.length}`,
    );
  }

  const fp16 = new Uint8Array(float32ToFloat16Buffer(matrix));
  let bytes: Uint8Array = fp16;
  let compression: TensorPayload["compression"] = "none";

  if (options?.compress) {
    bytes = gzipSync(fp16);
    compression = "zlib";
  }

  const base64 = uint8ToBase64(bytes);
  return {
    encoding: "base64",
    dtype: "float16",
    shape: [patchCount, embeddingDim],
    data: base64,
    compression,
  };
}

export function buildLatentFramePayload(params: {
  frameId: string;
  stateVersion: number;
  sanitizedMatrix: Float32Array;
  sensitivePatchIndices: number[];
  viewportHash: string;
  lastActionId: string | null;
  compress?: boolean;
}): LatentFramePayload {
  const payload: LatentFramePayload = {
    frame_id: params.frameId,
    state_version: params.stateVersion,
    tensor: encodeTensorPayload(params.sanitizedMatrix, {
      compress: params.compress ?? false,
    }),
    spatial_metadata: {
      patch_grid: {
        rows: TENSOR_CONTRACT.gridRows,
        cols: TENSOR_CONTRACT.gridCols,
      },
      sensitive_patch_indices: [...params.sensitivePatchIndices].sort((a, b) => a - b),
      viewport_hash: params.viewportHash,
    },
    action_context: {
      last_action_id: params.lastActionId,
      pending_user_input: false,
    },
    provenance: {
      vdlm_shader_version: "0.1.0",
      sanitization_method: "null_space_projection",
      attestation: null,
    },
  };
  assertOutboundPayloadSafe(payload);
  return payload;
}

export async function hashViewport(width: number, height: number, stateVersion: number): Promise<string> {
  const data = new TextEncoder().encode(`${width}x${height}@v${stateVersion}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex.slice(0, 16)}`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function decodeBase64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
