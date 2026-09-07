import type { AgentStatus } from "../messaging/types";

const STATUS_KEY = "vdlmAgentStatus";

const DEFAULT_STATUS: AgentStatus = {
  running: false,
  connected: false,
  sessionId: null,
  stateVersion: 0,
  frameCount: 0,
  lastError: null,
  visionMode: "mock",
  processingMode: "auto",
  pipelineStage: "idle",
  tabId: null,
};

function storageLocal(): chrome.storage.LocalStorageArea {
  const local = chrome.storage?.local;
  if (!local) {
    throw new Error("Extension storage unavailable — reload the extension");
  }
  return local;
}

export async function persistStatus(status: Partial<AgentStatus>): Promise<AgentStatus> {
  const prev = (await storageLocal().get(STATUS_KEY))[STATUS_KEY] as AgentStatus | undefined;
  const next: AgentStatus = { ...DEFAULT_STATUS, ...prev, ...status };
  await storageLocal().set({ [STATUS_KEY]: next });
  return next;
}

export async function loadPersistedStatus(): Promise<AgentStatus | null> {
  const data = (await storageLocal().get(STATUS_KEY))[STATUS_KEY];
  return (data as AgentStatus) ?? null;
}

/** Offscreen documents delegate status writes to the service worker. */
export async function persistStatusFromOffscreen(status: Partial<AgentStatus>): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: "PERSIST_AGENT_STATUS",
    payload: status,
  });
  if (response?.error) {
    throw new Error(String(response.error));
  }
}
