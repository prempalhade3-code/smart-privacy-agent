import { describe, expect, it } from "vitest";

import { mockPipelineFrame } from "./pipeline-mock";
import { serializeLatentFrame } from "../src/protocol/websocket-client";

describe("end-to-end client payload mock", () => {
  it("produces backend-compatible latent.frame JSON", () => {
    const frame = mockPipelineFrame({ frameId: "f-00001", stateVersion: 3 });
    const wire = serializeLatentFrame(frame, "test-session");
    const parsed = JSON.parse(wire);
    expect(parsed.type).toBe("latent.frame");
    expect(parsed.session_id).toBe("test-session");
    expect(parsed.payload.tensor.shape).toEqual([576, 1152]);
    expect(parsed.payload.state_version).toBe(3);
    expect(parsed.payload.screenshot).toBeUndefined();
  });
});
