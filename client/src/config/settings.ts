export type VisionMode = "mock" | "onnx";
export type ProcessingMode = "auto" | "mock" | "webgpu";

export interface ClientConfig {
  backendWsUrl: string;
  taskIntent: string;
  visionMode: VisionMode;
  processingMode: ProcessingMode;
  onnxModelUrl: string;
  frameIntervalMs: number;
  compressPayload: boolean;
}

export const DEFAULT_CONFIG: ClientConfig = {
  backendWsUrl: "ws://127.0.0.1:8080/ws/v1/session",
  taskIntent: "Navigate and interact with the page safely",
  visionMode: "mock",
  processingMode: "auto",
  onnxModelUrl: "",
  frameIntervalMs: 1500,
  compressPayload: false,
};

export async function loadConfig(): Promise<ClientConfig> {
  const stored = await chrome.storage.local.get("vdlmConfig");
  return { ...DEFAULT_CONFIG, ...(stored.vdlmConfig as Partial<ClientConfig> | undefined) };
}

export async function saveConfig(partial: Partial<ClientConfig>): Promise<ClientConfig> {
  const current = await loadConfig();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ vdlmConfig: next });
  return next;
}

export function resolveProcessingMode(config: ClientConfig): "mock" | "webgpu" {
  if (config.processingMode === "mock") return "mock";
  if (config.processingMode === "webgpu") return "webgpu";
  return "webgpu";
}
