import { TENSOR_CONTRACT } from "../protocol/messages";
import { VisionEncoder } from "./mock-gpu-encoder";

/**
 * ONNX Runtime Web encoder for SigLIP-Base FP16.
 * Requires model URL configuration; falls back explicitly when unavailable.
 */
export class OnnxVisionEncoder {
  private session: unknown = null;
  private fallback: VisionEncoder | null = null;
  private modelUrl: string;
  private loadError: string | null = null;

  constructor(modelUrl: string) {
    this.modelUrl = modelUrl;
  }

  async init(): Promise<void> {
    if (!this.modelUrl) {
      this.loadError = "ONNX model URL not configured";
      this.fallback = new VisionEncoder();
      await this.fallback.init();
      return;
    }

    try {
      const ort = await import("onnxruntime-web/webgpu");
      this.session = await ort.InferenceSession.create(this.modelUrl, {
        executionProviders: ["webgpu", "wasm"],
      });
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : "ONNX load failed";
      this.fallback = new VisionEncoder();
      await this.fallback.init();
    }
  }

  getStatus(): { mode: "onnx" | "fallback"; error: string | null } {
    if (this.session) return { mode: "onnx", error: null };
    return { mode: "fallback", error: this.loadError };
  }

  async encode(image: ImageData): Promise<Float32Array> {
    if (this.fallback) {
      return this.fallback.encode(image);
    }

    const ort = await import("onnxruntime-web/webgpu");
    const { patchCount, embeddingDim, inputSize } = TENSOR_CONTRACT;
    const canvas = new OffscreenCanvas(inputSize, inputSize);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    const tmp = new OffscreenCanvas(image.width, image.height);
    tmp.getContext("2d")!.putImageData(image, 0, 0);
    ctx.drawImage(tmp, 0, 0, inputSize, inputSize);
    const { data } = ctx.getImageData(0, 0, inputSize, inputSize);

    const floatData = new Float32Array(inputSize * inputSize * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      floatData[j] = data[i]! / 255;
      floatData[j + 1] = data[i + 1]! / 255;
      floatData[j + 2] = data[i + 2]! / 255;
    }

    const input = new ort.Tensor("float32", floatData, [1, 3, inputSize, inputSize]);
    type OrtSession = Awaited<ReturnType<typeof ort.InferenceSession.create>>;
    type OrtTensor = InstanceType<typeof ort.Tensor>;
    const session = this.session as OrtSession;
    const feeds: Record<string, OrtTensor> = {};
    feeds[session.inputNames[0]!] = input;
    const outputs = await session.run(feeds);
    const out = outputs[session.outputNames[0]!]!.data as Float32Array;
    if (out.length !== patchCount * embeddingDim) {
      throw new Error(`Unexpected ONNX output size: ${out.length}`);
    }
    return out.slice(0, patchCount * embeddingDim);
  }

  destroy(): void {
    this.fallback?.destroy();
    this.session = null;
  }
}
