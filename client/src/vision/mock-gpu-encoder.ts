import { TENSOR_CONTRACT } from "../protocol/messages";
import {
  acquireGpuAdapter,
  createGpuDevice,
  getTensorByteSize,
  imageDataToRgbaPacked,
  loadShader,
  resizeImageData,
} from "../webgpu/context";

export class VisionEncoder {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private paramsBuffer: GPUBuffer | null = null;

  async init(): Promise<void> {
    const adapter = await acquireGpuAdapter();
    const device = await createGpuDevice(adapter);
    this.device = device;
    const shaderUrl = chrome.runtime.getURL("shaders/vision-encode.wgsl");
    const module = await loadShader(device, shaderUrl);
    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module, entryPoint: "encode_patches" },
    });
    this.paramsBuffer = device.createBuffer({
      size: 20,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  async encode(image: ImageData): Promise<Float32Array> {
    if (!this.device || !this.pipeline || !this.paramsBuffer) {
      throw new Error("VisionEncoder not initialized");
    }

    const resized = resizeImageData(image, TENSOR_CONTRACT.inputSize);
    const pixels = imageDataToRgbaPacked(resized);
    const { patchCount, embeddingDim, gridRows, gridCols } = TENSOR_CONTRACT;
    const byteSize = getTensorByteSize();

    const pixelBuffer = this.device.createBuffer({
      size: pixels.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const embedBuffer = this.device.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(
      this.paramsBuffer,
      0,
      new Uint32Array([
        resized.width,
        resized.height,
        gridRows,
        gridCols,
        embeddingDim,
      ]),
    );
    this.device.queue.writeBuffer(pixelBuffer, 0, pixels.buffer, pixels.byteOffset, pixels.byteLength);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: pixelBuffer } },
        { binding: 2, resource: { buffer: embedBuffer } },
      ],
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(patchCount / 64));
    pass.end();

    const readBuffer = this.device.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    encoder.copyBufferToBuffer(embedBuffer, 0, readBuffer, 0, byteSize);
    this.device.queue.submit([encoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    pixelBuffer.destroy();
    embedBuffer.destroy();
    readBuffer.destroy();

    return result;
  }

  destroy(): void {
    this.paramsBuffer?.destroy();
    this.paramsBuffer = null;
    this.device?.destroy();
    this.device = null;
    this.pipeline = null;
  }
}
