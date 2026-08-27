/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-to-img", "@napi-rs/canvas"],
    // pdf-to-img -> pdfjs-dist loads @napi-rs/canvas via a fully dynamic
    // `createRequire(import.meta.url)("@napi-rs/canvas")` call to get
    // DOMMatrix/ImageData/Path2D polyfills. Next's build-time file tracer
    // can't follow that construction, so on Vercel the native binary (and
    // pdfjs-dist's font/cmap data, loaded via plain fs paths, same problem)
    // silently gets left out of the deployed function — it works locally
    // only because the full node_modules tree is already on disk.
    outputFileTracingIncludes: {
      "/api/process": [
        "./node_modules/pdf-to-img/node_modules/@napi-rs/canvas/**/*",
        "./node_modules/pdf-to-img/node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
        "./node_modules/pdf-to-img/node_modules/@napi-rs/canvas-linux-x64-musl/**/*",
        "./node_modules/pdf-to-img/node_modules/pdfjs-dist/standard_fonts/**/*",
        "./node_modules/pdf-to-img/node_modules/pdfjs-dist/cmaps/**/*",
      ],
    },
  },
};

export default nextConfig;
