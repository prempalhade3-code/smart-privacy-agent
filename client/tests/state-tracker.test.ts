import { describe, expect, it } from "vitest";

import type { ActionDirectivePayload } from "../src/protocol/messages";
import {
  isDirectiveStale,
  validateDirectiveSchema,
} from "../src/state/state-tracker";

describe("state and directive validation", () => {
  const directive: ActionDirectivePayload = {
    action_id: "a-1",
    action: "CLICK",
    target_id: 10,
    coords: [0.5, 0.5],
    text: null,
    scroll_delta: null,
    state_version_required: 5,
    confidence: 0.9,
    reasoning_summary: "test",
  };

  it("detects stale directives", () => {
    expect(isDirectiveStale(directive, 5)).toBe(false);
    expect(isDirectiveStale(directive, 6)).toBe(true);
  });

  it("validates directive schema", () => {
    expect(validateDirectiveSchema(directive)).toBe(true);
    expect(validateDirectiveSchema({ action: "CLICK" })).toBe(false);
    expect(
      validateDirectiveSchema({
        ...directive,
        coords: [1.5, 0.5],
      }),
    ).toBe(false);
  });
});
