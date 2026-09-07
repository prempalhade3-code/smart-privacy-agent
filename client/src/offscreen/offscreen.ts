import { log } from "../logging/logger";
import { loadConfig } from "../config/settings";
import { getRunner } from "./agent-runner";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "AGENT_RUN") {
    const { tabId, config } = message.payload as { tabId: number; config?: unknown };
    getRunner()
      .start(tabId, config as import("../config/settings").ClientConfig | undefined)
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      );
    return true;
  }

  if (message?.type === "AGENT_RUN_STOP") {
    void getRunner()
      .stop()
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "GET_PIPELINE_STATUS") {
    sendResponse({ initialized: true, initError: null });
    return false;
  }

  return false;
});

log("info", "VDLM offscreen agent ready");
