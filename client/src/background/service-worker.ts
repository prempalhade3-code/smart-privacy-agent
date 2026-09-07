import { loadConfig } from "../config/settings";
import { captureTabJpeg } from "../capture/tab-capture";
import { loadPersistedStatus, persistStatus } from "../storage/agent-status";
import { log } from "../logging/logger";
import type { AgentStatus, ExtensionMessage } from "../messaging/types";

const OFFSCREEN_URL = "src/offscreen/offscreen.html";

function offscreenReasons(): chrome.offscreen.Reason[] {
  const reasonEnum = chrome.offscreen.Reason as Record<string, chrome.offscreen.Reason>;
  if (reasonEnum.WEB_GPU) {
    return [reasonEnum.WEB_GPU, chrome.offscreen.Reason.BLOBS];
  }
  return [chrome.offscreen.Reason.BLOBS];
}

async function waitForOffscreenReady(timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_PIPELINE_STATUS" });
      if (response?.initialized) return;
    } catch {
      // offscreen still loading
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Offscreen agent did not start — reload the extension in chrome://extensions");
}

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) {
    await waitForOffscreenReady(2000);
    return;
  }
  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL(OFFSCREEN_URL),
    reasons: offscreenReasons(),
    justification: "VDLM WebGPU vision encode and agent loop",
  });
  await waitForOffscreenReady();
}

async function sendToOffscreen<T>(message: ExtensionMessage, retries = 3): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await ensureOffscreen();
      const response = await chrome.runtime.sendMessage(message);
      return response as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error("Offscreen agent unreachable");
}

async function ensureContentScript(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url ?? "";
  if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
    throw new Error("Open a normal website (https://example.com) first");
  }

  const ping = (): Promise<boolean> =>
    new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: "PING" }, () => resolve(!chrome.runtime.lastError));
    });

  if (await ping()) return;

  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js;
  if (!files?.length) throw new Error("Rebuild and reload the extension");

  await chrome.scripting.executeScript({ target: { tabId }, files: [...files] });
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (!(await ping())) throw new Error("Refresh the page (Cmd+R) and try again");
}

async function relayToTab(tabId: number, message: Record<string, unknown>): Promise<unknown> {
  await ensureContentScript(tabId);
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(response);
    });
  });
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  switch (message.type) {
    case "AGENT_START": {
      void (async () => {
        try {
          const tabId = (message.payload as { tabId: number }).tabId;
          const config = await loadConfig();
          await ensureContentScript(tabId);
          await persistStatus({
            running: true,
            tabId,
            pipelineStage: "starting",
            lastError: null,
          });

          const result = await sendToOffscreen<{ ok?: boolean; error?: string }>({
            type: "AGENT_RUN",
            payload: { tabId, config },
          });

          if (!result?.ok) throw new Error(result?.error ?? "Failed to start offscreen agent");
          sendResponse({ ok: true, status: await loadPersistedStatus() });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          await persistStatus({ running: false, pipelineStage: "error", lastError: msg });
          sendResponse({ ok: false, error: msg });
        }
      })();
      return true;
    }

    case "AGENT_STOP":
      void (async () => {
        try {
          await sendToOffscreen({ type: "AGENT_RUN_STOP" });
        } catch {
          // offscreen may already be closed
        }
        await persistStatus({
          running: false,
          connected: false,
          pipelineStage: "idle",
          sessionId: null,
          tabId: null,
        });
        sendResponse({ ok: true });
      })();
      return true;

    case "GET_STATUS":
      void loadPersistedStatus().then((status) => {
        sendResponse(status ?? { running: false, connected: false, pipelineStage: "idle" });
      });
      return true;

    case "PERSIST_AGENT_STATUS":
      void persistStatus((message.payload ?? {}) as Partial<AgentStatus>)
        .then((status) => sendResponse({ ok: true, status }))
        .catch((error) =>
          sendResponse({ error: error instanceof Error ? error.message : String(error) }),
        );
      return true;

    case "RELAY_TO_TAB":
      void (async () => {
        try {
          const { tabId, message: tabMessage } = message.payload as {
            tabId: number;
            message: Record<string, unknown>;
          };
          const response = await relayToTab(tabId, tabMessage);
          sendResponse(response);
        } catch (error) {
          sendResponse({ error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return true;

    case "CAPTURE_TAB":
      void captureTabJpeg()
        .then((captureJpeg) => sendResponse({ captureJpeg }))
        .catch((error) =>
          sendResponse({ error: error instanceof Error ? error.message : String(error) }),
        );
      return true;

    default:
      return false;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  log("info", "VDLM extension installed");
});

log("info", "VDLM service worker ready");

export type { AgentStatus };
