import {
  type ActionDirectivePayload,
  type ActionResultPayload,
  type ErrorPayload,
  type LatentFramePayload,
  type PlanStalePayload,
  type SessionInitPayload,
  type SessionReadyPayload,
  type WireMessage,
  buildWireMessage,
} from "./messages";

export type ServerMessage =
  | { kind: "session.ready"; message: WireMessage<SessionReadyPayload> }
  | { kind: "action.directive"; message: WireMessage<ActionDirectivePayload> }
  | { kind: "plan.stale"; message: WireMessage<PlanStalePayload> }
  | { kind: "error"; message: WireMessage<ErrorPayload> }
  | { kind: "unknown"; message: WireMessage };

export function parseServerMessage(raw: string): ServerMessage {
  const message = JSON.parse(raw) as WireMessage;
  switch (message.type) {
    case "session.ready":
      return { kind: "session.ready", message: message as unknown as WireMessage<SessionReadyPayload> };
    case "action.directive":
      return {
        kind: "action.directive",
        message: message as unknown as WireMessage<ActionDirectivePayload>,
      };
    case "plan.stale":
      return { kind: "plan.stale", message: message as unknown as WireMessage<PlanStalePayload> };
    case "error":
      return { kind: "error", message: message as unknown as WireMessage<ErrorPayload> };
    default:
      return { kind: "unknown", message };
  }
}

export function serializeSessionInit(payload: SessionInitPayload): string {
  return JSON.stringify(buildWireMessage("session.init", payload));
}

export function serializeLatentFrame(
  payload: LatentFramePayload,
  sessionId: string,
): string {
  return JSON.stringify(buildWireMessage("latent.frame", payload, sessionId));
}

export function serializeActionResult(
  payload: ActionResultPayload,
  sessionId: string,
): string {
  return JSON.stringify(buildWireMessage("action.result", payload, sessionId));
}
