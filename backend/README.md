# VDLM Backend

Cloud reasoning server for Visual-Differential Latent Masking (ISRO Problem 26171).

## Install

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Run

```bash
PYTHONPATH=. python run.py
# or
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

## Test

```bash
PYTHONPATH=. python -m pytest tests/ -v
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/ready` | Readiness + planner status |
| GET | `/v1/protocol` | Protocol contract for client integration |
| WS | `/ws/v1/session` | Sanitized latent streaming + action directives |

See `../docs/PROTOCOL.md` for WebSocket message schemas.
