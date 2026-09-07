import { executeDirective } from "../actions/executor";
import { initLayoutParser } from "../sensitivity/layout-parser";
import { getViewportSize, scanSensitiveRegions } from "../sensitivity/dom-scanner";
import { StateTracker } from "../state/state-tracker";
import type { ActionDirectivePayload } from "../protocol/messages";

const stateTracker = new StateTracker();
let parserReady: ReturnType<typeof initLayoutParser> | null = null;

function getParser() {
  if (!parserReady) parserReady = initLayoutParser();
  return parserReady;
}

stateTracker.start();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "PING":
      sendResponse({ ok: true });
      return false;

    case "SCAN_SENSITIVITY":
      void (async () => {
        const parser = await getParser();
        const regions = scanSensitiveRegions();
        const viewport = getViewportSize();
        const sensitivePatchIndices = parser.mapRegionsToPatches(
          viewport.width,
          viewport.height,
          regions,
        );
        sendResponse({ regions, sensitivePatchIndices, viewport });
      })();
      return true;

    case "GET_STATE_VERSION":
      sendResponse({ stateVersion: stateTracker.getVersion() });
      return false;

    case "EXECUTE_ACTION":
      void (async () => {
        const directive = message.payload as ActionDirectivePayload;
        const result = await executeDirective(directive, stateTracker.getVersion());
        if (result.status === "success") {
          stateTracker.bump("post_action");
        }
        sendResponse({
          ...result,
          stateVersion: stateTracker.getVersion(),
        });
      })();
      return true;

    default:
      return false;
  }
});
