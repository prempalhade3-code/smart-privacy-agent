import { TENSOR_CONTRACT } from "../protocol/messages";
import { acquireGpuAdapter, createGpuDevice, getTensorByteSize, loadShader } from "../webgpu/context";

const SHADER_VERSION = "0.1.0";

export class VdlmSanitizer {
  private device: GPUDevice | null = null;
  private buildBasisPipeline: GPUComputePipeline | null = null;
  private normalizePipeline: GPUComputePipeline | null = null;
  private projectPipeline: GPUComputePipeline | null = null;
  private paramsBuffer: GPUBuffer | null = null;

  async init(): Promise<void> {
    const adapter = await acquireGpuAdapter();
    const device = await createGpuDevice(adapter);
    this.device = device;
    const shaderUrl = chrome.runtime.getURL("shaders/vdlm-nullspace.wgsl");
    const module = await loadShader(device, shaderUrl);
    this.buildBasisPipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module, entryPoint: "build_private_basis" },
    });
    this.normalizePipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module, entryPoint: "normalize_basis" },
    });
    this.projectPipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module, entryPoint: "project_nullspace" },
    });
    this.paramsBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  async sanitize(
    embeddings: Float32Array,
    sensitivePatchIndices: number[],
  ): Promise<Float32Array> {
    if (!this.device || !this.buildBasisPipeline || !this.normalizePipeline || !this.projectPipeline) {
      throw new Error("VdlmSanitizer not initialized");
    }

    const { patchCount, embeddingDim } = TENSOR_CONTRACT;
    const byteSize = getTensorByteSize();
    const sensitiveCount = sensitivePatchIndices.length;

    const embedBuffer = this.device.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const sanitizedBuffer = this.device.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const basisBuffer = this.device.createBuffer({
      size: embeddingDim * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const indexBuffer = this.device.createBuffer({
      size: Math.max(4, sensitiveCount * 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(embedBuffer, 0, embeddings.buffer, embeddings.byteOffset, embeddings.byteLength);
    if (sensitiveCount > 0) {
      this.device.queue.writeBuffer(indexBuffer, 0, new Uint32Array(sensitivePatchIndices));
    }

    this.device.queue.writeBuffer(
      this.paramsBuffer!,
      0,
      new Float32Array([patchCount, embeddingDim, sensitiveCount, 0.01]),
    );

    const bindGroup = this.device.createBindGroup({
      layout: this.buildBasisPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer! } },
        { binding: 1, resource: { buffer: embedBuffer } },
        { binding: 2, resource: { buffer: indexBuffer } },
        { binding: 3, resource: { buffer: sanitizedBuffer } },
        { binding: 4, resource: { buffer: basisBuffer } },
      ],
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.buildBasisPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(embeddingDim / 64));
    pass.setPipeline(this.normalizePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.setPipeline(this.projectPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(patchCount / 64));
    pass.end();

    const readBuffer = this.device.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    encoder.copyBufferToBuffer(sanitizedBuffer, 0, readBuffer, 0, byteSize);
    this.device.queue.submit([encoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    embedBuffer.destroy();
    sanitizedBuffer.destroy();
    basisBuffer.destroy();
    indexBuffer.destroy();
    readBuffer.destroy();

    return result;
  }

  getShaderVersion(): string {
    return SHADER_VERSION;
  }

  destroy(): void {
    this.paramsBuffer?.destroy();
    this.paramsBuffer = null;
    this.device?.destroy();
    this.device = null;
  }
}
