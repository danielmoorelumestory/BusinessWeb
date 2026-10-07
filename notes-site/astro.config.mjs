import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves this site from /note; Vercel serves it from the domain root.
// Cloudflare Pages (BusinessWeb co-hosting) serves it from /note on the main site's domain.
const isVercel = process.env.VERCEL === '1';
const isCloudflare = process.env.CF_PAGES === '1';

// RSS links use this origin. On Cloudflare, set SITE_URL to the stable site address;
// CF_PAGES_URL is a per-deployment address and is only a fallback.
const site = isVercel
  ? `https://${process.env.VERCEL_URL}`
  : isCloudflare
    ? process.env.SITE_URL || process.env.CF_PAGES_URL || 'https://danielmoorelumestory.github.io'
    : 'https://danielmoorelumestory.github.io';

export default defineConfig({
  site,
  base: isVercel ? undefined : '/note',
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
