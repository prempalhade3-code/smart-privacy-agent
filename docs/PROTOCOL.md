# VDLM WebSocket Protocol v1

Transport: WebSocket at `/ws/v1/session` (JSON envelopes).

## Message envelope

```json
{
  "type": "<message_type>",
  "protocol_version": "1.0",
  "session_id": "<uuid>",
  "timestamp_ms": 1234567890,
  "payload": { }
}
```

## Client → Server

### `session.init`

```json
{
  "type": "session.init",
  "payload": {
    "task_intent": "Click the login button and enter username",
    "encoder_spec": {
      "model_id": "siglip-base-patch16-224",
      "patch_count": 576,
      "embedding_dim": 1152,
      "dtype": "float16"
    },
    "viewport": { "width": 1920, "height": 1080 },
    "client_capabilities": ["webgpu", "onnx-runtime-web"]
  }
}
```

### `latent.frame`

Sanitized tensor `V'`. **Never** include raw screenshot bytes.

```json
{
  "type": "latent.frame",
  "payload": {
    "frame_id": "f-00042",
    "state_version": 7,
    "tensor": {
      "encoding": "base64",
      "dtype": "float16",
      "shape": [576, 1152],
      "data": "<base64>",
      "compression": "none"
    },
    "spatial_metadata": {
      "patch_grid": { "rows": 24, "cols": 24 },
      "sensitive_patch_indices": [12, 45, 102],
      "viewport_hash": "sha256:..."
    },
    "action_context": {
      "last_action_id": null,
      "pending_user_input": false
    },
    "provenance": {
      "vdlm_shader_version": "0.1.0",
      "sanitization_method": "null_space_projection",
      "attestation": null
    }
  }
}
```

### `action.result`

Client reports execution outcome for state sync.

```json
{
  "type": "action.result",
  "payload": {
    "action_id": "uuid",
    "state_version": 8,
    "status": "success",
    "error_code": null
  }
}
```

## Server → Client

### `session.ready`

```json
{
  "type": "session.ready",
  "payload": {
    "session_id": "uuid",
    "server_time_ms": 1234567890,
    "accepted_encoder_spec": { "patch_count": 576, "embedding_dim": 1152 }
  }
}
```

### `action.directive`

```json
{
  "type": "action.directive",
  "payload": {
    "action_id": "uuid",
    "action": "CLICK",
    "target_id": 42,
    "coords": [0.45, 0.62],
    "text": null,
    "scroll_delta": null,
    "state_version_required": 7,
    "confidence": 0.85,
    "reasoning_summary": "Primary button in center region"
  }
}
```

Supported `action` values: `CLICK`, `SCROLL`, `TYPE`, `WAIT`, `NAVIGATE`, `DONE`.

Coordinates are **normalized** [0, 1] relative to viewport; client re-hydrates to pixel/DOM space.

### `plan.stale`

Returned when server detects `state_version` drift (GAP 3).

```json
{
  "type": "plan.stale",
  "payload": {
    "expected_state_version": 7,
    "received_state_version": 9,
    "reason": "state_version_mismatch"
  }
}
```

### `error`

```json
{
  "type": "error",
  "payload": {
    "code": "PAYLOAD_REJECTED",
    "message": "Forbidden field: screenshot",
    "recoverable": false
  }
}
```

## Forbidden payload fields

The server rejects messages containing any of:

- `screenshot`, `image`, `png`, `jpeg`, `raw_pixels`
- `dom_html`, `password`, `credential`, `payment`
- `accessibility_tree` with text content (future: hashed node refs only)

## Tensor contract (SigLIP-Base default)

| Field | Value |
|-------|-------|
| Patches | 576 (24×24 grid) |
| Embedding dim | 1152 |
| dtype | float16 |
| Uncompressed size | ~1.27 MB |
| Target wire size | <45 KB (client-side quantization/compression/delta) |

Backend accepts full tensors for development; production clients should use compact encodings declared in `tensor.compression`.
