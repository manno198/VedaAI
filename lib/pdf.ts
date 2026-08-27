import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "node:path";

/**
 * pdfjs-dist's public types don't describe `PDFDocumentProxy.canvasFactory`
 * (a Node-only runtime addition — see pdfjsDataUrl's comment), so it comes
 * back typed as an opaque object. This describes just the two methods this
 * file actually calls on it.
 */
type NodeCanvasFactory = {
  create(width: number, height: number): { canvas: { toBuffer(mimeType: "image/png"): Buffer } };
};

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
 * pdfjs-dist needs its standard_fonts/cmaps data directories for accurate
 * text rendering. pdfjs-dist is a direct (top-level) dependency of this
 * project rather than a transitive one buried inside another package, so its
 * files always land at this predictable path relative to the deployed
 * function's working directory — no runtime module resolution required to
 * find them (see the comment on rasterizePdf for why that matters).
 *
 * pdfjs-dist only checks that this string ends with "/" (a plain
 * `val.endsWith("/")`, not real URL parsing — the value is later handed
 * straight to `fs.readFile`, which accepts native Windows backslashes
 * fine); it doesn't care about the separator style anywhere else in the
 * path. `path.join` + `path.sep` fails that check on Windows, where
 * `path.sep` is "\" — caught by actually running the built output in
 * isolation locally rather than assuming the Vercel/Linux deploy (where
 * `path.sep` is already "/") would have exposed it.
 */
function pdfjsDataUrl(subdir: "standard_fonts" | "cmaps"): string {
  return path.join(process.cwd(), "node_modules", "pdfjs-dist", subdir) + "/";
}

/**
 * Rasterizes a PDF buffer to one PNG buffer per page, talking to pdfjs-dist
 * directly rather than through the `pdf-to-img` wrapper package.
 *
 * pdf-to-img internally computes its font/cmap data paths via
 * `createRequire(import.meta.url).resolve("pdfjs-dist/package.json")` — a
 * dynamically-constructed require that Next's build-time file tracer can't
 * follow, since pdfjs-dist is nested two levels down inside pdf-to-img's own
 * node_modules. On Vercel that leaves the file out of the deployed function
 * bundle regardless of `outputFileTracingIncludes` globs (confirmed: this is
 * a known, open, unresolved upstream bug — k-yle/pdf-to-img#259, matching
 * this project's exact error). Depending on pdfjs-dist directly, as an
 * ordinary top-level dependency, and computing its data-file paths via
 * `process.cwd()` instead of a runtime module resolution, sidesteps the
 * fragile lookup entirely rather than trying to out-guess the file tracer.
 *
 * pdfjs-dist's own Node canvas factory (used automatically here since no
 * custom `CanvasFactory` is passed) still does the same dynamic-require
 * pattern internally for `@napi-rs/canvas` — that one IS covered by
 * `next.config.mjs`'s `outputFileTracingIncludes`, and was verified working
 * (this is the earlier DOMMatrix/ImageData/Path2D fix).
 */
async function rasterizePdf(fileBuffer: Buffer, maxPages: number, scale: number): Promise<RasterPage[]> {
  const loadingTask = getDocument({
    data: new Uint8Array(fileBuffer),
    standardFontDataUrl: pdfjsDataUrl("standard_fonts"),
    cMapUrl: pdfjsDataUrl("cmaps"),
    cMapPacked: true,
    isEvalSupported: false,
  });

  const pdfDocument = await loadingTask.promise;
  try {
    const pages: RasterPage[] = [];
    const pageCount = Math.min(pdfDocument.numPages, maxPages);
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvasFactory = pdfDocument.canvasFactory as NodeCanvasFactory;
      const { canvas } = canvasFactory.create(viewport.width, viewport.height);
      // pdfjs-dist's public types assume a browser HTMLCanvasElement here;
      // at runtime, its own Node canvas factory (used automatically above)
      // hands back an @napi-rs/canvas Canvas instead, which it duck-types
      // against internally. This cast bridges that known type/runtime gap.
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
      pages.push({
        page: pageNum,
        buffer: canvas.toBuffer("image/png"),
        mimeType: "image/png",
        width: viewport.width,
        height: viewport.height,
      });
    }
    return pages;
  } finally {
    await pdfDocument.destroy();
  }
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
    return rasterizePdf(fileBuffer, maxPages, 2);
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

export function toDataUrl(page: RasterPage): string {
  return `data:${page.mimeType};base64,${page.buffer.toString("base64")}`;
}
