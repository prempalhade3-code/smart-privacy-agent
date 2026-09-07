import { TENSOR_CONTRACT } from "../protocol/messages";

export class WebGpuUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebGpuUnavailableError";
  }
}

export async function acquireGpuAdapter(): Promise<GPUAdapter> {
  if (!navigator.gpu) {
    throw new WebGpuUnavailableError("WebGPU is not available in this browser");
  }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) {
    throw new WebGpuUnavailableError("Failed to acquire WebGPU adapter");
  }
  return adapter;
}

export async function createGpuDevice(adapter: GPUAdapter): Promise<GPUDevice> {
  return adapter.requestDevice({
    requiredLimits: {
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
    },
  });
}

export async function loadShader(device: GPUDevice, url: string): Promise<GPUShaderModule> {
  const code = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Failed to load shader: ${url}`);
    return r.text();
  });
  return device.createShaderModule({ code });
}

export function imageDataToRgbaPacked(image: ImageData): Uint32Array {
  const { width, height, data } = image;
  const out = new Uint32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    out[i] =
      (data[o]! << 0) |
      (data[o + 1]! << 8) |
      (data[o + 2]! << 16) |
      (data[o + 3]! << 24);
  }
  return out;
}

export { resizeImageData } from "../capture/decode";

export function zeroMatrix(patchCount: number, embeddingDim: number): Float32Array {
  return new Float32Array(patchCount * embeddingDim);
}

export function getTensorByteSize(): number {
  return TENSOR_CONTRACT.patchCount * TENSOR_CONTRACT.embeddingDim * 4;
}
