// SigLIP-style mock vision encoder: 224x224 RGBA -> 576 x 1152 patch embeddings
// Runs on WebGPU — not a JS fallback.

struct Params {
  inputWidth: u32,
  inputHeight: u32,
  gridRows: u32,
  gridCols: u32,
  embeddingDim: u32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> pixels: array<u32>;
@group(0) @binding(2) var<storage, read_write> embeddings: array<f32>;

fn hash01(a: u32, b: u32, c: u32) -> f32 {
  var x = a * 747796405u + 2891336453u;
  x = x ^ (x >> 16u);
  x = x * 2246822519u;
  x = x ^ (x >> 13u);
  let v = f32(x & 0x00FFFFFFu) / f32(0x01000000u);
  return v * 2.0 - 1.0;
}

@compute @workgroup_size(64)
fn encode_patches(@builtin(global_invocation_id) gid: vec3<u32>) {
  let patchCount = params.gridRows * params.gridCols;
  let patchIdx = gid.x;
  if (patchIdx >= patchCount) {
    return;
  }

  let row = patchIdx / params.gridCols;
  let col = patchIdx % params.gridCols;
  let patchW = max(1u, params.inputWidth / params.gridCols);
  let patchH = max(1u, params.inputHeight / params.gridRows);

  var meanR = 0.0;
  var meanG = 0.0;
  var meanB = 0.0;
  var count = 0.0;

  let y0 = row * patchH;
  let x0 = col * patchW;
  for (var dy: u32 = 0u; dy < patchH; dy = dy + 1u) {
    for (var dx: u32 = 0u; dx < patchW; dx = dx + 1u) {
      let x = min(x0 + dx, params.inputWidth - 1u);
      let y = min(y0 + dy, params.inputHeight - 1u);
      let idx = y * params.inputWidth + x;
      let px = pixels[idx];
      meanR = meanR + f32((px >> 0u) & 0xFFu) / 255.0;
      meanG = meanG + f32((px >> 8u) & 0xFFu) / 255.0;
      meanB = meanB + f32((px >> 16u) & 0xFFu) / 255.0;
      count = count + 1.0;
    }
  }
  meanR = meanR / count;
  meanG = meanG / count;
  meanB = meanB / count;

  let base = patchIdx * params.embeddingDim;
  for (var d: u32 = 0u; d < params.embeddingDim; d = d + 1u) {
    let freq = f32(d + 1u) * 0.01;
    let spatial = sin(f32(col) * freq) + cos(f32(row) * freq);
    let color = select(meanB, meanR, d % 3u == 0u);
    let h = hash01(patchIdx, d, 17u);
    embeddings[base + d] = spatial * 0.4 + color * 0.4 + h * 0.2;
  }
}
