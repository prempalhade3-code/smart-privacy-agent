import type { ActionDirectivePayload } from "../protocol/messages";

export class StateTracker {
  private version = 0;
  private mutationObserver: MutationObserver | null = null;
  private onChange: ((version: number) => void) | null = null;

  start(onChange?: (version: number) => void): void {
    this.onChange = onChange ?? null;
    this.version = 1;
    this.mutationObserver = new MutationObserver(() => this.bump("dom_mutation"));
    this.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    window.addEventListener("popstate", this.onPopState);
    window.addEventListener("hashchange", this.onHashChange);
  }

  stop(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    window.removeEventListener("popstate", this.onPopState);
    window.removeEventListener("hashchange", this.onHashChange);
  }

  getVersion(): number {
    return this.version;
  }

  bump(reason: string): number {
    this.version += 1;
    this.onChange?.(this.version);
    return this.version;
  }

  private onPopState = (): void => {
    this.bump("popstate");
  };

  private onHashChange = (): void => {
    this.bump("hashchange");
  };
}

export function isDirectiveStale(
  directive: ActionDirectivePayload,
  currentStateVersion: number,
): boolean {
  return currentStateVersion !== directive.state_version_required;
}

export function validateDirectiveSchema(
  payload: unknown,
): payload is ActionDirectivePayload {
  if (!payload || typeof payload !== "object") return false;
  const d = payload as Record<string, unknown>;
  const actions = ["CLICK", "SCROLL", "TYPE", "WAIT", "NAVIGATE", "DONE"];
  if (typeof d.action_id !== "string" || !actions.includes(String(d.action))) {
    return false;
  }
  if (typeof d.state_version_required !== "number") return false;
  if (typeof d.confidence !== "number") return false;
  if (d.coords !== null && d.coords !== undefined) {
    if (!Array.isArray(d.coords) || d.coords.length !== 2) return false;
    for (const c of d.coords) {
      if (typeof c !== "number" || c < 0 || c > 1) return false;
    }
  }
  return true;
}

export function normalizedToClientCoords(
  coords: [number, number],
): { x: number; y: number } {
  return {
    x: coords[0] * window.innerWidth,
    y: coords[1] * window.innerHeight,
  };
}
