# VDLM Browser Client

Manifest V3 Chrome Extension implementing the on-device visual perception layer for **ISRO Problem Statement 26171**.

## Pipeline

```
Page capture (local) → DOM sensitivity scan → WASM patch mapping
  → WebGPU vision encode → WebGPU VDLM null-space projection
  → FP16 tensor serialize → WebSocket (sanitized V' only)
  → action.directive → state validation → DOM execution
```

Raw screenshots, DOM HTML, and credentials **never** cross the network boundary.

## Prerequisites

- Node.js 18+
- Chrome 121+ with WebGPU enabled
- Rust + `wasm-pack` (for layout parser WASM)
- VDLM backend running at `ws://127.0.0.1:8080/ws/v1/session`

## Build

```bash
cd vdlm/client
npm install
npm run build:wasm   # requires wasm-pack
npm run build
```

Load unpacked extension from `vdlm/client/dist/` in `chrome://extensions`.

## Development

```bash
npm run dev          # Vite dev server + HMR for popup
npm test             # Unit tests (serializer, protocol, patch mapping, state)
```

Start backend:

```bash
cd ../backend && PYTHONPATH=. python run.py
```

## Configuration (popup)

| Setting | Default | Description |
|---------|---------|-------------|
| Backend WebSocket | `ws://127.0.0.1:8080/ws/v1/session` | Reasoning server |
| Task intent | (text) | Sent in `session.init` |
| Vision mode | `mock` | `mock` = WebGPU procedural encoder; `onnx` = SigLIP via ONNX Runtime Web |

## Permissions

- `activeTab`, `tabs` — capture visible tab locally
- `offscreen` — WebGPU processing document
- `storage` — config persistence
- `host_permissions` — backend WebSocket (localhost)

## Architecture modules

| Module | Role |
|--------|------|
| `background/` | Service worker orchestration, WebSocket, capture scheduling |
| `content/` | Sensitivity scan, state tracking, action execution |
| `offscreen/` | WebGPU vision + VDLM sanitization |
| `wasm/` | Rust patch-index mapping |
| `public/shaders/` | WGSL compute shaders |
| `protocol/` | Backend wire format (matches `docs/PROTOCOL.md`) |

## Privacy assumptions

See `../docs/ASSUMPTIONS.md`. This client does **not** claim proven zero-knowledge privacy or guaranteed non-invertibility. The VDLM shader applies an orthogonal projection prototype on GPU; cryptographic attestation is reserved in `provenance.attestation`.

## End-to-end test

1. Start backend (`python run.py`)
2. Build and load extension
3. Open any http(s) page
4. Open popup → set task intent → **Start**
5. Verify popup shows `Connected: yes`, frames incrementing
6. Backend logs `action_planned`; page receives click/scroll actions

## ONNX SigLIP mode

Set vision mode to `onnx` and configure `onnxModelUrl` in storage (future options page) or extend popup. Without a model URL, ONNX mode **explicitly falls back** to the WebGPU mock encoder and logs the error.
