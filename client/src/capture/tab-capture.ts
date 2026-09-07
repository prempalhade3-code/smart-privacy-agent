/** Local tab capture — JPEG stays inside the extension, never sent to the backend. */

export async function captureTabJpeg(): Promise<string> {
  const win = await chrome.windows.getCurrent();
  const windowId = win.id;
  if (windowId === undefined) {
    throw new Error("No active browser window for capture");
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: "jpeg",
    quality: 75,
  });

  if (!dataUrl.startsWith("data:image")) {
    throw new Error("Tab capture failed — click the page tab first, then Start");
  }

  return dataUrl;
}
