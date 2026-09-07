# VDLM — Visual-Differential Latent Masking

Privacy-preserving cloud reasoning server for **ISRO Problem Statement 26171**.

This repository implements the **cloud reasoning server** half of the VDLM architecture. The browser extension (Manifest V3, Rust/WASM, ONNX Runtime Web, WebGPU) produces sanitized latent tensors `V'` on-device; this backend **never** receives raw screenshots, DOM secrets, or credentials.

## Architecture

```
[Browser Extension]                    [VDLM Backend — this repo]
  SigLIP-Base FP16 encode                  FastAPI + WebSocket
  WGSL null-space projection    ──────►   Latent validation
  Sanitized V' (<45 KB)                    Session / state sync
                                           Action planning (LLM)
                                ◄──────   Structured directives
  DOM action re-hydration                  (CLICK, SCROLL, TYPE, …)
```

See `docs/PROTOCOL.md` for wire format and `docs/ASSUMPTIONS.md` for verified vs. aspirational claims.

## Quick start

```bash
cd vdlm/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

Health: `curl http://127.0.0.1:8080/health`  
Readiness: `curl http://127.0.0.1:8080/ready`

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VDLM_MODEL_PROVIDER` | `mock` | `mock` or `llama` |
| `VDLM_LLAMA_BASE_URL` | — | OpenAI-compatible API base for LLaMA-3-70B |
| `VDLM_LLAMA_MODEL` | `meta-llama/Meta-Llama-3-70B-Instruct` | Model id |
| `VDLM_LLAMA_API_KEY` | — | API key for remote planner |
| `VDLM_MAX_PAYLOAD_BYTES` | `2097152` | Max WebSocket message size |
| `VDLM_COMPACT_PAYLOAD_TARGET_BYTES` | `45056` | Blueprint target for client payloads |
| `VDLM_LOG_LEVEL` | `INFO` | Logging level |
| `VDLM_HOST` | `0.0.0.0` | Bind host |
| `VDLM_PORT` | `8080` | Bind port |

## Testing

```bash
cd vdlm/backend
PYTHONPATH=. python -m pytest tests/ -v
```

## Client integration

The browser extension lives in `client/`. See [client/README.md](client/README.md) for build and load instructions.

```
ws://localhost:8080/ws/v1/session
```

Send `session.init`, then stream `latent.frame` messages. See `docs/PROTOCOL.md`.

## Repository layout

```
vdlm/
  backend/          Cloud reasoning server (implemented)
  client/           Browser extension placeholder
  docs/             Protocol, assumptions, engineering notes
```
