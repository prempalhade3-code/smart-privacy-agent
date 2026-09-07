# Engineering Notes

## Blueprint inconsistencies acknowledged

1. **Payload size vs. tensor size**: SigLIP-Base FP16 `576×1152` is ~1.27 MB uncompressed. The blueprint's "<45 KB" target implies client-side compression, delta frames (ReVision-style), or quantization. The backend validates shape after decode regardless of wire compression.

2. **"Text-only LLM" on spatial latents**: LLaMA-3-70B-Instruct is text-only; interpreting raw 576×1152 vision embeddings requires either (a) a learned projection head trained on sanitized latents, or (b) a VLM decoder. This implementation passes a **derived spatial summary** (patch statistics + grid features) to the text planner as an interim bridge, with a clear interface for a future VLM decoder module.

3. **SVD in WGSL**: Client-side null-space projection is specified for WebGPU; server never performs VDLM sanitization.

## Module boundaries

```
app/
  config/          Settings from environment
  schemas/         Pydantic wire + domain models
  validation/      Latent + action schema validation
  tensor/          Serialize/deserialize, shape contracts
  security/        Forbidden payload detection
  session/         Browser state, version sync
  planning/        Reasoning pipeline orchestration
  models/          Replaceable planner providers
  transport/       WebSocket handler + protocol
  observability/   Structured logging
  api/             HTTP routes (health, readiness)
```

## Future client integration

The browser extension will:

1. Capture tab frame locally (never sent to server)
2. Run SigLIP-Base via ONNX Runtime Web (WebGPU EP)
3. Apply WGSL null-space shader → `V'`
4. Stream `latent.frame` over WebSocket
5. Receive `action.directive` and dispatch DOM events

No backend redesign required if protocol v1 is followed.
