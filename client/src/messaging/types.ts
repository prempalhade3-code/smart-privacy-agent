/** Internal extension messaging — never carries raw screenshots or DOM secrets. */

export type MessageType =
  | "AGENT_START"
  | "AGENT_STOP"
  | "AGENT_RUN"
  | "AGENT_RUN_STOP"
  | "AGENT_STATUS"
  | "GET_STATUS"
  | "PERSIST_AGENT_STATUS"
  | "GET_PIPELINE_STATUS"
  | "RELAY_TO_TAB"
  | "CAPTURE_TAB"
  | "STATE_UPDATE"
  | "EXECUTE_ACTION"
  | "ACTION_RESULT"
  | "SCAN_SENSITIVITY"
  | "SENSITIVITY_RESULT"
  | "PROCESS_FRAME"
  | "FRAME_PROCESSED"
  | "PIPELINE_ERROR";

export interface SensitiveRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  category: string;
}

export interface SensitivityScanResult {
  regions: SensitiveRegion[];
  sensitivePatchIndices: number[];
  viewport: { width: number; height: number };
}

export interface StateUpdate {
  stateVersion: number;
  url: string;
  title: string;
}

export interface AgentStatus {
  running: boolean;
  connected: boolean;
  sessionId: string | null;
  stateVersion: number;
  frameCount: number;
  lastError: string | null;
  visionMode: string;
  processingMode: string;
  pipelineStage: string;
  tabId: number | null;
}

export interface ProcessFrameRequest {
  /** Local JPEG data URL — stays inside extension, never sent to backend */
  captureJpeg: string;
  sensitivePatchIndices: number[];
  stateVersion: number;
  frameId: string;
  viewport: { width: number; height: number };
  visionMode: string;
  onnxModelUrl: string;
  compress: boolean;
}

export interface FrameProcessedResponse {
  frameId: string;
  latentFrame: import("../protocol/messages").LatentFramePayload;
}

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as ExtensionMessage).type === "string"
  );
}
