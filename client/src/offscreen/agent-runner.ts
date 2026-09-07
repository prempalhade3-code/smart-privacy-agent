import { loadConfig, type ClientConfig } from "../config/settings";
import { log } from "../logging/logger";
import type {
  ActionDirectivePayload,
  LatentFramePayload,
  SessionInitPayload,
} from "../protocol/messages";
import { defaultEncoderSpec } from "../protocol/messages";
import {
  parseServerMessage,
  serializeActionResult,
  serializeLatentFrame,
  serializeSessionInit,
} from "../protocol/websocket-client";
import type { AgentStatus, SensitivityScanResult } from "../messaging/types";
import { persistStatusFromOffscreen } from "../storage/agent-status";
import { decodeCaptureToImageData } from "../capture/decode";
import { buildLatentFramePayload, hashViewport } from "../protocol/serializer";
import { VisionEncoder } from "../vision/mock-gpu-encoder";
import { VdlmSanitizer } from "../vdlm/sanitizer";

type VisionEncoderLike = {
  init(): Promise<void>;
  encode(image: ImageData): Promise<Float32Array>;
};

const persistStatus = persistStatusFromOffscreen;

export class OffscreenAgentRunner {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private running = false;
  private tabId: number | null = null;
  private frameCount = 0;
  private config: ClientConfig | null = null;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionReadyWaiters: Array<(id: string) => void> = [];
  private visionEncoder: VisionEncoderLike | null = null;
  private sanitizer: VdlmSanitizer | null = null;
  private pipelineReady = false;

  async start(tabId: number, config?: ClientConfig): Promise<void> {
    this.config = config ?? (await loadConfig());
    this.tabId = tabId;
    this.running = true;
    this.frameCount = 0;
    this.sessionId = null;

    try {
      await persistStatus({
        running: true,
        tabId,
        lastError: null,
        frameCount: 0,
        sessionId: null,
        pipelineStage: "starting",
        visionMode: this.config.visionMode,
      });

      await this.ensurePipeline();
      await this.connectWebSocket();

      const viewport = await this.getViewport();
      await this.initSession(viewport);

      void this.runCycle();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.running = false;
      this.ws?.close();
      this.ws = null;
      await persistStatus({
        running: false,
        connected: false,
        pipelineStage: "error",
        lastError: msg,
        tabId: null,
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.loopTimer = null;
    this.ws?.close();
    this.ws = null;
    this.sessionId = null;
    await persistStatus({
      running: false,
      connected: false,
      sessionId: null,
      pipelineStage: "idle",
      tabId: null,
    });
  }

  private async ensurePipeline(): Promise<void> {
    if (this.pipelineReady) return;
    this.sanitizer = new VdlmSanitizer();
    await this.sanitizer.init();
    if (this.config?.visionMode === "onnx") {
      const { OnnxVisionEncoder } = await import("../vision/onnx-encoder");
      this.visionEncoder = new OnnxVisionEncoder(this.config.onnxModelUrl);
    } else {
      this.visionEncoder = new VisionEncoder();
    }
    await this.visionEncoder.init();
    this.pipelineReady = true;
  }

  private async connectWebSocket(): Promise<void> {
    if (!this.config) throw new Error("Config missing");
    await this.setStage("connecting");

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.config!.backendWsUrl);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WebSocket failed — is backend running on port 8080?"));
      ws.onclose = () => {
        if (this.running) void this.setStage("error", "WebSocket closed");
      };
      ws.onmessage = (e) => void this.onServerMessage(String(e.data));
    });

    await persistStatus({ connected: true });
  }

  private waitForSessionReady(): Promise<string> {
    if (this.sessionId) return Promise.resolve(this.sessionId);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("session.ready timeout")), 10000);
      this.sessionReadyWaiters.push((id) => {
        clearTimeout(t);
        resolve(id);
      });
    });
  }

  private async initSession(viewport: { width: number; height: number }): Promise<void> {
    if (!this.ws || !this.config) throw new Error("Not connected");
    await this.setStage("session_init");

    const ready = this.waitForSessionReady();
    const payload: SessionInitPayload = {
      task_intent: this.config.taskIntent,
      encoder_spec: defaultEncoderSpec(),
      viewport,
      client_capabilities: ["webgpu", "onnx-runtime-web"],
    };
    this.ws.send(serializeSessionInit(payload));

    this.sessionId = await ready;
    await persistStatus({ sessionId: this.sessionId, pipelineStage: "ready" });
    log("info", "Session ready", { sessionId: this.sessionId });
  }

  private async runCycle(): Promise<void> {
    if (!this.running || this.tabId === null || !this.config || !this.sessionId) return;

    try {
      await this.setStage("scanning");
      const sensitivity = await this.relayTab<SensitivityScanResult>({ type: "SCAN_SENSITIVITY" });
      const stateVersion = await this.relayTab<{ stateVersion: number }>({ type: "GET_STATE_VERSION" });

      await this.setStage("capturing");
      const captureJpeg = await this.requestCapture();

      this.frameCount += 1;
      const frameId = `f-${String(this.frameCount).padStart(5, "0")}`;

      await this.setStage("processing");
      const imageData = await decodeCaptureToImageData(captureJpeg);
      const embeddings = await this.visionEncoder!.encode(imageData);
      const sanitized = await this.sanitizer!.sanitize(
        embeddings,
        sensitivity.sensitivePatchIndices,
      );
      embeddings.fill(0);

      const viewportHash = await hashViewport(
        sensitivity.viewport.width,
        sensitivity.viewport.height,
        stateVersion.stateVersion,
      );

      const latentFrame = buildLatentFramePayload({
        frameId,
        stateVersion: stateVersion.stateVersion,
        sanitizedMatrix: sanitized,
        sensitivePatchIndices: sensitivity.sensitivePatchIndices,
        viewportHash,
        lastActionId: null,
        compress: this.config.compressPayload,
      });
      sanitized.fill(0);

      await this.setStage("transmitting");
      this.ws!.send(serializeLatentFrame(latentFrame, this.sessionId));

      await this.setStage("awaiting_action");
      await persistStatus({ frameCount: this.frameCount, lastError: null });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log("error", "Cycle failed", { error: msg });
      await this.setStage("error", msg);
    } finally {
      if (this.running) {
        this.loopTimer = setTimeout(() => void this.runCycle(), this.config!.frameIntervalMs);
      }
    }
  }

  private async onServerMessage(raw: string): Promise<void> {
    const parsed = parseServerMessage(raw);

    if (parsed.kind === "session.ready") {
      const id = parsed.message.payload.session_id;
      this.sessionId = id;
      this.sessionReadyWaiters.splice(0).forEach((fn) => fn(id));
      return;
    }

    if (parsed.kind === "action.directive" && this.tabId !== null) {
      await this.setStage("executing");
      const directive = parsed.message.payload;
      const result = await this.relayTab<{ stateVersion: number; status: string; errorCode: string | null }>({
        type: "EXECUTE_ACTION",
        payload: directive,
      });

      if (this.ws && this.sessionId) {
        this.ws.send(
          serializeActionResult(
            {
              action_id: directive.action_id,
              state_version: result.stateVersion,
              status: result.status as "success" | "failure" | "cancelled",
              error_code: result.errorCode,
            },
            this.sessionId,
          ),
        );
      }

      if (directive.action === "DONE") await this.stop();
      else await this.setStage("awaiting_action");
    } else if (parsed.kind === "error") {
      await this.setStage("error", parsed.message.payload.message);
    }
  }

  private async setStage(stage: string, error: string | null = null): Promise<void> {
    await persistStatus({
      pipelineStage: stage,
      lastError: error,
      connected: this.ws?.readyState === WebSocket.OPEN,
      running: this.running,
      sessionId: this.sessionId,
      frameCount: this.frameCount,
      tabId: this.tabId,
    });
  }

  private async getViewport(): Promise<{ width: number; height: number }> {
    try {
      const scan = await this.relayTab<SensitivityScanResult>({ type: "SCAN_SENSITIVITY" });
      return scan.viewport;
    } catch {
      return { width: 1280, height: 720 };
    }
  }

  private relayTab<T>(message: Record<string, unknown>): Promise<T> {
    if (this.tabId === null) {
      return Promise.reject(new Error("No target tab"));
    }
    const tabId = this.tabId;
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "RELAY_TO_TAB", payload: { tabId, message } },
        (response) => {
          const err = chrome.runtime.lastError;
          if (err) reject(new Error(err.message));
          else if (response && typeof response === "object" && "error" in response) {
            reject(new Error(String((response as { error: string }).error)));
          } else resolve(response as T);
        },
      );
    });
  }

  private requestCapture(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "CAPTURE_TAB" }, (response) => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else if (response?.error) reject(new Error(response.error));
        else resolve(response.captureJpeg as string);
      });
    });
  }
}

let runner: OffscreenAgentRunner | null = null;

export function getRunner(): OffscreenAgentRunner {
  if (!runner) runner = new OffscreenAgentRunner();
  return runner;
}
