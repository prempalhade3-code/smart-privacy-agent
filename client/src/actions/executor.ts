import type { ActionDirectivePayload } from "../protocol/messages";
import {
  isDirectiveStale,
  normalizedToClientCoords,
  validateDirectiveSchema,
} from "../state/state-tracker";

export interface ExecutionResult {
  status: "success" | "failure" | "cancelled";
  errorCode: string | null;
}

const ALLOWED_ACTIONS = new Set([
  "CLICK",
  "SCROLL",
  "TYPE",
  "WAIT",
  "NAVIGATE",
  "DONE",
]);

export async function executeDirective(
  directive: ActionDirectivePayload,
  currentStateVersion: number,
): Promise<ExecutionResult> {
  if (!validateDirectiveSchema(directive)) {
    return { status: "failure", errorCode: "INVALID_DIRECTIVE_SCHEMA" };
  }

  if (!ALLOWED_ACTIONS.has(directive.action)) {
    return { status: "failure", errorCode: "DISALLOWED_ACTION" };
  }

  if (isDirectiveStale(directive, currentStateVersion)) {
    return { status: "failure", errorCode: "STALE_STATE_VERSION" };
  }

  try {
    switch (directive.action) {
      case "CLICK":
        return await executeClick(directive);
      case "SCROLL":
        return executeScroll(directive);
      case "TYPE":
        return executeType(directive);
      case "WAIT":
        await sleep(500);
        return { status: "success", errorCode: null };
      case "NAVIGATE":
        return executeNavigate(directive);
      case "DONE":
        return { status: "success", errorCode: null };
      default:
        return { status: "failure", errorCode: "UNSUPPORTED_ACTION" };
    }
  } catch (error) {
    return {
      status: "failure",
      errorCode: error instanceof Error ? error.message : "EXECUTION_ERROR",
    };
  }
}

async function executeClick(directive: ActionDirectivePayload): Promise<ExecutionResult> {
  if (!directive.coords) {
    return { status: "failure", errorCode: "MISSING_COORDS" };
  }
  const { x, y } = normalizedToClientCoords(directive.coords);
  const target = document.elementFromPoint(x, y);
  if (!target || !isSafeElement(target)) {
    return { status: "failure", errorCode: "UNSAFE_OR_MISSING_TARGET" };
  }
  if (target instanceof HTMLElement) {
    target.focus({ preventScroll: true });
    target.click();
  }
  return { status: "success", errorCode: null };
}

function executeScroll(directive: ActionDirectivePayload): ExecutionResult {
  const delta = directive.scroll_delta ?? [0, 300];
  window.scrollBy({ left: delta[0], top: delta[1], behavior: "smooth" });
  return { status: "success", errorCode: null };
}

function executeType(directive: ActionDirectivePayload): ExecutionResult {
  if (!directive.text || !directive.coords) {
    return { status: "failure", errorCode: "MISSING_TYPE_PARAMS" };
  }
  const { x, y } = normalizedToClientCoords(directive.coords);
  const target = document.elementFromPoint(x, y);
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return { status: "failure", errorCode: "TARGET_NOT_TYPABLE" };
  }
  if (target.type === "password") {
    return { status: "failure", errorCode: "REFUSE_PASSWORD_FIELD" };
  }
  if (!isSafeElement(target)) {
    return { status: "failure", errorCode: "UNSAFE_TARGET" };
  }
  target.focus();
  target.value = directive.text;
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
  return { status: "success", errorCode: null };
}

function executeNavigate(directive: ActionDirectivePayload): ExecutionResult {
  if (!directive.text) {
    return { status: "failure", errorCode: "MISSING_URL" };
  }
  let url: URL;
  try {
    url = new URL(directive.text, window.location.href);
  } catch {
    return { status: "failure", errorCode: "INVALID_URL" };
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return { status: "failure", errorCode: "UNSAFE_URL_SCHEME" };
  }
  window.location.assign(url.toString());
  return { status: "success", errorCode: null };
}

function isSafeElement(el: Element): boolean {
  if (el.closest("script, iframe[src^='javascript:']")) return false;
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
