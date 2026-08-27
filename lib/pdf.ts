import { pdf } from "pdf-to-img";

export type RasterPage = {
  page: number;
  buffer: Buffer;
  mimeType: "image/png" | "image/jpeg";
  width: number;
  height: number;
};

const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

/** Reads a PNG/JPEG header to get pixel dimensions without extra deps. */
function readImageDimensions(buf: Buffer): { width: number; height: number } {
  // PNG: signature (8 bytes) + IHDR chunk: width/height are 4-byte BE ints at offset 16/20
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: scan markers for SOF0/SOF2 to find dimensions
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      const size = buf.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        return { width, height };
      }
      offset += 2 + size;
    }
  }
  // Fallback: unknown format, caller will rely on natural rendering size on the client.
  return { width: 0, height: 0 };
}

/**
 * Converts an uploaded document (PDF or image) into a list of rasterized
 * page images ready to send to a vision LLM.
 */
export async function rasterizeDocument(
  fileBuffer: Buffer,
  mimeType: string,
  maxPages = 20
): Promise<RasterPage[]> {
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    const { width, height } = readImageDimensions(fileBuffer);
    return [
      {
        page: 1,
        buffer: fileBuffer,
        mimeType: mimeType === "image/jpg" ? "image/jpeg" : (mimeType as "image/png" | "image/jpeg"),
        width,
        height,
      },
    ];
  }

  if (mimeType === "application/pdf") {
    const doc = await pdf(fileBuffer, { scale: 2, format: "png" });
    const pages: RasterPage[] = [];
    let pageNum = 1;
    for await (const image of doc) {
      if (pageNum > maxPages) break;
      const { width, height } = readImageDimensions(image);
      pages.push({ page: pageNum, buffer: image, mimeType: "image/png", width, height });
      pageNum++;
    }
    await doc.destroy();
    return pages;
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

export function toDataUrl(page: RasterPage): string {
  return `data:${page.mimeType};base64,${page.buffer.toString("base64")}`;
}
