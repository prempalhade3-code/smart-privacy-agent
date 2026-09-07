// VDLM null-space orthogonal projection on GPU.
// Simplified basis from sensitive patch mean direction (research prototype — not proven ZK).

struct Params {
  patchCount: u32,
  embeddingDim: u32,
  sensitiveCount: u32,
  alphaNoise: f32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> embeddings: array<f32>;
@group(0) @binding(2) var<storage, read> sensitiveIndices: array<u32>;
@group(0) @binding(3) var<storage, read_write> sanitized: array<f32>;
@group(0) @binding(4) var<storage, read_write> privBasis: array<f32>;

@compute @workgroup_size(64)
fn build_private_basis(@builtin(global_invocation_id) gid: vec3<u32>) {
  let d = gid.x;
  if (d >= params.embeddingDim) {
    return;
  }

  var acc = 0.0;
  if (params.sensitiveCount > 0u) {
    for (var i: u32 = 0u; i < params.sensitiveCount; i = i + 1u) {
      let patch = sensitiveIndices[i];
      let idx = patch * params.embeddingDim + d;
      acc = acc + embeddings[idx];
    }
    acc = acc / f32(params.sensitiveCount);
  }
  privBasis[d] = acc;
}

@compute @workgroup_size(64)
fn normalize_basis(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x > 0u) {
    return;
  }
  var norm = 0.0;
  for (var d: u32 = 0u; d < params.embeddingDim; d = d + 1u) {
    let v = privBasis[d];
    norm = norm + v * v;
  }
  norm = sqrt(max(norm, 1e-8));
  for (var d: u32 = 0u; d < params.embeddingDim; d = d + 1u) {
    privBasis[d] = privBasis[d] / norm;
  }
}

@compute @workgroup_size(64)
fn project_nullspace(@builtin(global_invocation_id) gid: vec3<u32>) {
  let patch = gid.x;
  if (patch >= params.patchCount) {
    return;
  }

  let base = patch * params.embeddingDim;
  var dotpw = 0.0;
  for (var d: u32 = 0u; d < params.embeddingDim; d = d + 1u) {
    dotpw = dotpw + embeddings[base + d] * privBasis[d];
  }

  for (var d: u32 = 0u; d < params.embeddingDim; d = d + 1u) {
    let v = embeddings[base + d];
    let w = privBasis[d];
    var orthNoise = 0.0;
    if (params.sensitiveCount > 0u) {
      let h = sin(f32(patch * 97u + d * 13u)) * cos(f32(d * 7u));
      orthNoise = h * params.alphaNoise;
    }
    sanitized[base + d] = v - dotpw * w + orthNoise;
  }
}
