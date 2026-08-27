const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

/** Skip re-encoding files already comfortably under the combined upload budget. */
const SKIP_COMPRESSION_UNDER_BYTES = 1.5 * 1024 * 1024;
const TARGET_BYTES = 2.2 * 1024 * 1024;

type Attempt = { maxDimension: number; quality: number };

// First pass targets ~200 DPI for a full page (generous for handwriting OCR).
// Second pass only kicks in if the first still isn't small enough.
const ATTEMPTS: Attempt[] = [
  { maxDimension: 2400, quality: 0.85 },
  { maxDimension: 1800, quality: 0.75 },
];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not decode image: ${file.name}`));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality));
}

async function encodeAttempt(img: HTMLImageElement, attempt: Attempt): Promise<Blob | null> {
  const scale = Math.min(1, attempt.maxDimension / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);

  return canvasToBlob(canvas, attempt.quality);
}

/**
 * Re-encodes an image file client-side to keep upload payloads under Vercel's
 * serverless function request-body cap (~4.5MB combined). Skips files that are
 * already small, and never touches non-image files (PDFs pass through untouched
 * by the caller — this function only ever receives images).
 */
export async function compressImageFile(file: File): Promise<File> {
  if (!IMAGE_TYPES.has(file.type) || file.size <= SKIP_COMPRESSION_UNDER_BYTES) {
    return file;
  }

  try {
    const img = await loadImage(file);
    let best: Blob | null = null;

    for (const attempt of ATTEMPTS) {
      const blob = await encodeAttempt(img, attempt);
      if (!blob) continue;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= TARGET_BYTES) break;
    }

    if (!best || best.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([best], newName, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    // If decoding/compression fails for any reason, fall back to the original
    // file rather than blocking the upload — the size check downstream will
    // still catch it if it's too large.
    return file;
  }
}
