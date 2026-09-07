export const PROTOCOL_VERSION = "1.0";

export const TENSOR_CONTRACT = {
  modelId: "siglip-base-patch16-224",
  patchCount: 576,
  embeddingDim: 1152,
  gridRows: 24,
  gridCols: 24,
  dtype: "float16" as const,
  inputSize: 224,
};

export type ActionType =
  | "CLICK"
  | "SCROLL"
  | "TYPE"
  | "WAIT"
  | "NAVIGATE"
  | "DONE";

export interface EncoderSpec {
  model_id: string;
  patch_count: number;
  embedding_dim: number;
  dtype: "float16" | "float32";
}

export interface Viewport {
  width: number;
  height: number;
}

export interface PatchGrid {
  rows: number;
  cols: number;
}

export interface SpatialMetadata {
  patch_grid: PatchGrid;
  sensitive_patch_indices: number[];
  viewport_hash: string | null;
}

export interface TensorPayload {
  encoding: "base64";
  dtype: "float16" | "float32";
  shape: [number, number];
  data: string;
  compression: "none" | "zlib" | "delta";
  delta_base_frame_id?: string | null;
}

export interface SanitizationProvenance {
  vdlm_shader_version: string | null;
  sanitization_method: string;
  attestation: string | null;
  attestation_scheme?: string | null;
}

export interface ActionContext {
  last_action_id: string | null;
  pending_user_input: boolean;
}

export interface LatentFramePayload {
  frame_id: string;
  state_version: number;
  tensor: TensorPayload;
  spatial_metadata: SpatialMetadata;
  action_context: ActionContext;
  provenance: SanitizationProvenance;
}

export interface SessionInitPayload {
  task_intent: string;
  encoder_spec: EncoderSpec;
  viewport: Viewport;
  client_capabilities: string[];
}

export interface ActionResultPayload {
  action_id: string;
  state_version: number;
  status: "success" | "failure" | "cancelled";
  error_code: string | null;
}

export interface ActionDirectivePayload {
  action_id: string;
  action: ActionType;
  target_id: number | null;
  coords: [number, number] | null;
  text: string | null;
  scroll_delta: [number, number] | null;
  state_version_required: number;
  confidence: number;
  reasoning_summary: string;
}

export interface SessionReadyPayload {
  session_id: string;
  server_time_ms: number;
  accepted_encoder_spec: EncoderSpec;
}

export interface PlanStalePayload {
  expected_state_version: number;
  received_state_version: number;
  reason: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown> | null;
}

export interface WireMessage<T = Record<string, unknown>> {
  type: string;
  protocol_version: string;
  session_id?: string | null;
  timestamp_ms?: number | null;
  payload: T;
}

export function buildWireMessage<T>(
  type: string,
  payload: T,
  sessionId?: string | null,
): WireMessage<T> {
  return {
    type,
    protocol_version: PROTOCOL_VERSION,
    session_id: sessionId ?? null,
    timestamp_ms: Date.now(),
    payload,
  };
}

export function defaultEncoderSpec(): EncoderSpec {
  return {
    model_id: TENSOR_CONTRACT.modelId,
    patch_count: TENSOR_CONTRACT.patchCount,
    embedding_dim: TENSOR_CONTRACT.embeddingDim,
    dtype: TENSOR_CONTRACT.dtype,
  };
}
