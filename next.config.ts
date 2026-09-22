import type { NextConfig } from 'next';

// Deployed as a GitHub Pages *project* site (https://cm-exe.github.io/mewlang/),
// not a user/org root site — so every asset and route must be served under
// the /mewlang prefix, not the domain root. `basePath` is Next's built-in
// mechanism for this: it automatically prefixes Next's own asset pipeline
// (/_next/...) and next/link navigation. It does NOT retroactively fix a
// hardcoded absolute path like <a href="/foo"> or <link rel="icon" href="/x">
// — those have to either be genuinely relative, use next/link, or be built
// from this same basePath value (see scripts/migrate-pages.ts and
// app/favicon.ico, which uses Next's file-convention icon instead of a
// hardcoded metadata path for exactly this reason).
//
// Only applied in production builds so `npm run dev` still serves at
// http://localhost:3000/ with no prefix.
const basePath = process.env.NODE_ENV === 'production' ? '/mewlang' : '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
