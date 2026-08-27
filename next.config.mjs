/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
    // pdfjs-dist's own Node canvas factory resolves @napi-rs/canvas (and its
    // platform-specific native binary) via a dynamically-constructed
    // `createRequire(import.meta.url).resolve(...)` call, invisible to
    // Next's build-time file tracer. On Vercel that silently leaves the
    // native binary out of the deployed function bundle even though it's
    // present at build time — confirmed via this project's own trace
    // manifest (.next/server/app/api/process/route.js.nft.json). Both
    // pdfjs-dist and @napi-rs/canvas are now direct (not nested) project
    // dependencies specifically so these globs are simple, unambiguous
    // top-level paths rather than reaching two levels into another
    // package's own node_modules.
    outputFileTracingIncludes: {
      "/api/process": [
        "./node_modules/pdfjs-dist/**/*",
        "./node_modules/@napi-rs/canvas/**/*",
        "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
        "./node_modules/@napi-rs/canvas-linux-x64-musl/**/*",
      ],
    },
  },
};

export default nextConfig;
