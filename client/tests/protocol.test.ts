import { describe, expect, it } from "vitest";

import { buildWireMessage, defaultEncoderSpec } from "../src/protocol/messages";
import {
  parseServerMessage,
  serializeSessionInit,
} from "../src/protocol/websocket-client";

describe("protocol messages", () => {
  it("serializes session.init", () => {
    const raw = serializeSessionInit({
      task_intent: "Click submit",
      encoder_spec: defaultEncoderSpec(),
      viewport: { width: 1280, height: 720 },
      client_capabilities: ["webgpu"],
    });
    const parsed = JSON.parse(raw);
    expect(parsed.type).toBe("session.init");
    expect(parsed.protocol_version).toBe("1.0");
  });

  it("parses action.directive", () => {
    const msg = buildWireMessage(
      "action.directive",
      {
        action_id: "x",
        action: "CLICK",
        coords: [0.1, 0.2],
        state_version_required: 1,
        confidence: 0.5,
        reasoning_summary: "",
      },
      "session-1",
    );
    const parsed = parseServerMessage(JSON.stringify(msg));
    expect(parsed.kind).toBe("action.directive");
  });
});
