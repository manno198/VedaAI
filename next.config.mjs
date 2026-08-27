/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-to-img", "@napi-rs/canvas"],
    // pdf-to-img and pdfjs-dist both resolve files (pdfjs-dist/package.json,
    // @napi-rs/canvas, its native binary, pdfjs-dist's font/cmap data) via
    // `createRequire(import.meta.url).resolve(...)` — a dynamically
    // constructed require that Next's build-time file tracer can't follow.
    // On Vercel, which only ships a traced subset of node_modules per
    // function, that leaves pieces of this dependency tree silently missing
    // at runtime (this has already bitten twice, at two different files, so
    // rather than patch each opaque require one at a time, the whole
    // pdf-to-img tree — including its nested pdfjs-dist and @napi-rs/canvas
    // — is force-included). It works locally only because the full
    // node_modules tree is already on disk, untraced.
    outputFileTracingIncludes: {
      "/api/process": ["./node_modules/pdf-to-img/**/*"],
    },
  },
};

export default nextConfig;
