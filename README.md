# vdlm — visual-differential latent masking (hackathon prototype)

privacy-preserving browser agent for isro problem statement 26171.

**github:** https://github.com/prempalhade3-code/smart-privacy-agent

this repo is a **working demo prototype**. the full pipeline runs end-to-end, but several parts are **mocked or simplified** on purpose so you can demo without downloading huge ai models. read the "what is mocked" section before presenting to judges.

---

## what this demo actually does

```
your browser (chrome extension)              your laptop (python backend)
─────────────────────────────────            ─────────────────────────────
1. captures the visible tab locally          4. receives sanitized tensor V' only
2. scans page for sensitive field boxes      5. never gets screenshot / password text
3. webgpu "vision" + vdlm sanitization  ──►  6. mock planner picks an action
   sends V' over websocket                       (click / scroll / type)
7. executes click/scroll in the page      ◄──  8. sends action.directive back
```

**real today:** chrome extension architecture, tab capture, dom sensitivity scan, websocket protocol, tensor shape validation, stale-state checks, action execution in the browser.

**mocked today:** vision encoder (procedural webgpu, not real siglip), backend planner (keyword rules, not real llm), simplified vdlm math, no cryptographic privacy proof.

---

## what you need on your laptop

| tool | version | why |
|------|---------|-----|
| git | any recent | clone the repo |
| python | 3.10 or 3.11 recommended | backend server |
| node.js | 18+ | build the chrome extension |
| google chrome | 121+ | extension + webgpu |
| rust + wasm-pack | optional | only if you want rust wasm patch mapper; **not required for demo** |

you do **not** need gpu drivers beyond what chrome already uses for webgpu.

---

## step 1 — clone the repo

```bash
git clone https://github.com/prempalhade3-code/smart-privacy-agent.git
cd smart-privacy-agent
```

if your friend already has the folder, just:

```bash
cd smart-privacy-agent
git pull
```

---

## step 2 — start the backend (terminal 1)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # default settings are fine for demo
PYTHONPATH=. python run.py
```

you should see uvicorn running on **port 8080**.

**check it works:**

```bash
curl http://127.0.0.1:8080/health
```

expected:

```json
{"service":"vdlm-reasoning-server","status":"ok", ...}
```

```bash
curl http://127.0.0.1:8080/ready
```

expected: `"model_provider": "mock"` and `"status": "ready"`.

leave this terminal open the whole demo.

---

## step 3 — build the chrome extension (terminal 2)

```bash
cd client
npm install
npm run build
```

notes:
- `npm run build:wasm` runs automatically. if rust/wasm-pack is **not** installed, the build still succeeds — it uses a typescript patch mapper instead. that's fine for the demo.
- after build, the loadable extension folder is **`client/dist/`**

**optional — run client tests:**

```bash
npm test
```

---

## step 4 — load the extension in chrome

1. open chrome and go to `chrome://extensions`
2. turn on **developer mode** (top right toggle)
3. click **load unpacked**
4. select the folder: `smart-privacy-agent/client/dist`
5. pin **VDLM Browser Agent** to the toolbar if you want

if you rebuild later (`npm run build`), come back here and click **reload** on the extension card.

---

## step 5 — run the live demo

### 5a. open a test page

open any normal website in a tab, for example:

```
https://example.com
```

click inside that tab so it is the **active tab**.

### 5b. open the extension popup

click the vdlm icon. you will see:

- backend websocket url (leave as `ws://127.0.0.1:8080/ws/v1/session`)
- task intent (text box)
- vision mode dropdown — **leave on "mock (webgpu encoder)"**
- start / stop buttons
- status section at the bottom

### 5c. set a task and start

try these task intents:

| task intent | expected backend action |
|-------------|-------------------------|
| `Click the Learn more link` | click at dominant patch coords |
| `Scroll down the page` | scroll down ~300px |
| `Type in the search box` | type `example_input` at a patch |
| `Navigate to https://example.com` | navigate action |

click **start**.

### 5d. what you should see (expected output)

**in the popup (within a few seconds):**

```
running: yes
connected: yes
stage: processing   (cycles through capturing / processing / transmitting)
session: <some uuid>
frames: 1, 2, 3 ... (number goes up every ~1.5s)
vision: mock
```

**in the backend terminal:**

```
session_initialized ...
latent_frame_received ...
action_planned action=CLICK ...
```

(or scroll / type depending on your task intent)

**in the browser:**

- the page may scroll, or a click may fire at computed coordinates
- on example.com this is subtle — you mainly prove the **loop is alive**, not perfect ai targeting

### 5e. stop

click **stop** in the popup. `running` should go back to `no`.

---

## how to know everything is working

use this checklist:

| check | pass? |
|-------|-------|
| `curl http://127.0.0.1:8080/health` returns `"status":"ok"` | |
| extension loaded without errors in `chrome://extensions` | |
| popup shows `connected: yes` after start | |
| `frames` counter increases | |
| backend logs show `latent_frame_received` | |
| backend logs show `action_planned` | |
| no error line in popup | |

if `connected: no`:
- backend not running, or wrong port
- firewall blocking localhost

if `frames` stays at 0:
- webgpu not available — try updating chrome
- check extension errors: `chrome://extensions` → details → service worker → inspect

if backend shows `FORBIDDEN_FIELD`:
- good — security guard works; client tried to send something it shouldn't

---

## repo folder map

```
smart-privacy-agent/
├── README.md                 ← you are here
├── backend/                  ← python fastapi websocket server
│   ├── run.py                ← start with: PYTHONPATH=. python run.py
│   ├── app/models/mock_planner.py   ← keyword mock ai (default)
│   └── tests/                ← pytest suite
├── client/                   ← chrome mv3 extension
│   ├── dist/                 ← load THIS folder in chrome (after npm run build)
│   ├── src/
│   │   ├── background/       ← orchestration + websocket
│   │   ├── content/          ← dom scan + action execution
│   │   ├── offscreen/        ← webgpu vision + vdlm shaders
│   │   └── popup/            ← ui
│   └── public/shaders/       ← wgsl compute shaders
└── docs/
    ├── PROTOCOL.md           ← websocket message format
    └── ASSUMPTIONS.md        ← research claims vs what code actually proves
```

---

## what is real vs mocked (be honest in the demo)

### real (actually implemented)

- chrome manifest v3 extension with offscreen document
- visible tab capture stays on device — **raw screenshot is not sent to backend**
- dom scanner finds password/input field **bounding boxes** (geometry only, not text values)
- webgpu compute shaders run locally (vision encode + vdlm projection shaders)
- sanitized tensor `V'` sent as fp16 base64 over websocket
- backend rejects forbidden fields (screenshot, dom html, credentials)
- session uuid, frame ids, state_version sync
- stale plan detection when page state drifts
- structured actions: click, scroll, type, navigate, done
- content script executes actions in the real page

### mocked or simplified (do not claim these are production-ready)

| part | what the demo actually does |
|------|----------------------------|
| **vision encoder** | procedural webgpu shader generates patch embeddings from pixel statistics — **not** real siglip-base onnx inference |
| **onnx / siglip mode** | optional in popup dropdown; without a downloaded model it falls back to mock and logs an error |
| **vdlm sanitization** | simplified rank-1 style gpu projection — **not** full svd null-space from the research paper |
| **backend planner** | `VDLM_MODEL_PROVIDER=mock` — keyword rules (`scroll` → scroll, `click` → click at dominant patch). **not** llama-3-70b reasoning |
| **llama provider** | code stub exists (`llama_planner.py`) but needs a separate openai-compatible api server + api key |
| **payload size** | sends full ~1.3 mb tensor json — **not** the blueprint `<45 kb` target |
| **privacy guarantees** | no zero-knowledge proof, no cryptographic attestation, no adversarial inversion testing |
| **wasm patch mapper** | rust source is in repo but wasm binary is **not** prebuilt — demo uses typescript fallback unless you run `npm run build:wasm` with rust installed |

---

## what is left to do (future work)

these are the main gaps between this prototype and the full research blueprint:

1. replace mock webgpu encoder with **real siglip-base fp16 onnx** (onnx runtime web + webgpu)
2. replace keyword mock planner with **visual grounding** or llama/vlm that uses page information
3. stronger **null-space sanitization** (multi-basis / svd, not rank-1 mean)
4. ship prebuilt **rust wasm** patch mapper in the default path
5. **compress payloads** toward 45 kb and measure on the wire
6. controlled demo page with buttons + sensitive fields (not just example.com)
7. **feature inversion evaluation** harness
8. latency benchmarks (350 ms target)
9. cryptographic provenance / attestation (research hardening)

---

## configuration (usually you can ignore this)

backend `.env`:

| variable | default | meaning |
|----------|---------|---------|
| `VDLM_MODEL_PROVIDER` | `mock` | keep as mock for hackathon demo |
| `VDLM_PORT` | `8080` | websocket + http port |

client popup settings are saved in chrome storage automatically when you click start.

---

## running tests (optional)

**backend:**

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest tests/ -v
```

expect all tests to pass.

**client:**

```bash
cd client
npm test
```

---

## troubleshooting

**`pip install` fails on torch (too big / slow)**  
use python 3.10 or 3.11. on slow networks torch download takes time — wait or use a machine with better internet.

**`npm run build` fails on typescript errors**  
make sure you pulled latest main and ran `npm install` inside `client/`.

**popup says "no active tab"**  
click on the website tab first, then open the popup and hit start.

**popup says "open a normal website"**  
chrome blocks capture on `chrome://` pages. use `https://example.com` or any https site.

**webgpu errors in console**  
update chrome. try `chrome://gpu` and check webgpu status.

**backend connection refused**  
terminal 1 must be running. check port 8080 is not used by another app.

---

## quick demo script for judges (2 minutes)

1. show backend terminal already running on :8080
2. show extension loaded in chrome
3. open https://example.com
4. open popup → task: `Scroll down the page` → vision: mock → **start**
5. point at popup: `connected: yes`, frames counting up
6. point at backend logs: `latent_frame_received`, `action_planned`
7. page scrolls (or click task if scroll is hard to see)
8. say clearly: *"architecture is real — capture and sanitization stay in the browser, only latent tensors cross the wire. vision and planning are simplified mocks for this prototype; production would use siglip + a real reasoning model."*
9. click **stop**

---

## more docs

- websocket message format: [docs/PROTOCOL.md](docs/PROTOCOL.md)
- research claims vs verified behavior: [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md)
- client-only details: [client/README.md](client/README.md)
- backend-only details: [backend/README.md](backend/README.md)
