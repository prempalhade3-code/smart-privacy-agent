import { TENSOR_CONTRACT } from "../protocol/messages";

const DEFAULT_SIZE = TENSOR_CONTRACT.inputSize;

/** Decode local JPEG data URL to 224×224 ImageData (offscreen document only). */
export async function decodeCaptureToImageData(
  dataUrl: string,
  size: number = DEFAULT_SIZE,
): Promise<ImageData> {
  const dim = toCanvasSize(size);
  const blob = await fetch(dataUrl).then((r) => r.blob());
  const bitmap = await createImageBitmap(blob);

  try {
    if (bitmap.width < 1 || bitmap.height < 1) {
      throw new Error("Capture returned an empty image");
    }
    const canvas = new OffscreenCanvas(dim, dim);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    ctx.drawImage(bitmap, 0, 0, dim, dim);
    return ctx.getImageData(0, 0, dim, dim);
  } finally {
    bitmap.close();
  }
}

export function toCanvasSize(value: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Invalid canvas dimension: ${value}`);
  }
  return n;
}

export function resizeImageData(image: ImageData, size: number): ImageData {
  const target = toCanvasSize(size);
  const srcW = toCanvasSize(image.width);
  const srcH = toCanvasSize(image.height);

  if (srcW === target && srcH === target) {
    return image;
  }

  const canvas = new OffscreenCanvas(target, target);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  const tmp = new OffscreenCanvas(srcW, srcH);
  const tctx = tmp.getContext("2d");
  if (!tctx) throw new Error("2D context unavailable");
  tctx.putImageData(image, 0, 0);
  ctx.drawImage(tmp, 0, 0, target, target);
  return ctx.getImageData(0, 0, target, target);
}
