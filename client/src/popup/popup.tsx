import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { loadConfig, saveConfig } from "../config/settings";
import type { AgentStatus } from "../messaging/types";

const defaultStatus: AgentStatus = {
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

function Popup() {
  const [status, setStatus] = useState<AgentStatus>(defaultStatus);
  const [backendUrl, setBackendUrl] = useState("ws://127.0.0.1:8080/ws/v1/session");
  const [taskIntent, setTaskIntent] = useState("Click the Learn more link");
  const [visionMode, setVisionMode] = useState<"mock" | "onnx">("mock");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    if (response) setStatus({ ...defaultStatus, ...response });
  }, []);

  useEffect(() => {
    void loadConfig().then((cfg) => {
      setBackendUrl(cfg.backendWsUrl);
      setTaskIntent(cfg.taskIntent);
      setVisionMode(cfg.visionMode);
    });
    void refreshStatus();
    const id = setInterval(() => void refreshStatus(), 800);
    return () => clearInterval(id);
  }, [refreshStatus]);

  const startAgent = async () => {
    setError(null);
    setBusy(true);
    try {
      await saveConfig({ backendWsUrl: backendUrl, taskIntent, visionMode });
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab — click the webpage first");
      if (!tab.url?.startsWith("http")) {
        throw new Error("Open a normal website (e.g. https://example.com) first");
      }

      const result = await chrome.runtime.sendMessage({
        type: "AGENT_START",
        payload: { tabId: tab.id },
      });

      if (!result?.ok) throw new Error(result?.error ?? "Start failed");
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const stopAgent = async () => {
    setBusy(true);
    await chrome.runtime.sendMessage({ type: "AGENT_STOP" });
    await refreshStatus();
    setBusy(false);
  };

  return (
    <main style={styles.main}>
      <h1 style={styles.title}>VDLM Agent</h1>
      <p style={styles.sub}>Privacy-preserving visual browser agent</p>

      <label style={styles.label}>
        Backend WebSocket
        <input style={styles.input} value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} />
      </label>

      <label style={styles.label}>
        Task intent
        <input style={styles.input} value={taskIntent} onChange={(e) => setTaskIntent(e.target.value)} />
      </label>

      <label style={styles.label}>
        Vision mode
        <select
          style={styles.input}
          value={visionMode}
          onChange={(e) => setVisionMode(e.target.value as "mock" | "onnx")}
        >
          <option value="mock">Mock (WebGPU encoder)</option>
          <option value="onnx">ONNX SigLIP</option>
        </select>
      </label>

      <div style={styles.row}>
        <button
          style={styles.btnPrimary}
          onClick={() => void startAgent()}
          disabled={status.running || busy}
        >
          Start
        </button>
        <button style={styles.btn} onClick={() => void stopAgent()} disabled={!status.running || busy}>
          Stop
        </button>
      </div>

      {(error || status.lastError) && (
        <p style={styles.error}>Error: {error ?? status.lastError}</p>
      )}

      <section style={styles.status}>
        <div>Running: {status.running ? "yes" : "no"}</div>
        <div>Connected: {status.connected ? "yes" : "no"}</div>
        <div>Stage: {status.pipelineStage}</div>
        <div>Session: {status.sessionId ?? "—"}</div>
        <div>Frames: {status.frameCount}</div>
        <div>Vision: {status.visionMode}</div>
      </section>

      <p style={styles.hint}>
        1. Start backend on :8080 · 2. Reload extension · 3. Refresh example.com · 4. Click Start
      </p>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { width: 320, padding: 12, fontFamily: "system-ui, sans-serif", fontSize: 13 },
  title: { margin: "0 0 4px", fontSize: 16 },
  sub: { margin: "0 0 12px", color: "#555" },
  label: { display: "block", marginBottom: 8 },
  input: { width: "100%", marginTop: 4, boxSizing: "border-box" },
  row: { display: "flex", gap: 8, marginTop: 8 },
  btnPrimary: { flex: 1, padding: "6px 8px" },
  btn: { flex: 1, padding: "6px 8px" },
  status: { marginTop: 12, padding: 8, background: "#f5f5f5", borderRadius: 6, lineHeight: 1.5 },
  error: { color: "#b00020", marginTop: 8, fontSize: 12 },
  hint: { marginTop: 10, fontSize: 11, color: "#666" },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
