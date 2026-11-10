import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';

// 只有一条构建线：随主站一起发布到 Cloudflare Pages，放在主站域名的 /note 下。
// site 用于生成绝对地址：优先 SITE_URL（稳定的站点地址），其次 CF_PAGES_URL（每次部署各不相同，只作兜底）。
const site = process.env.SITE_URL || process.env.CF_PAGES_URL || 'https://businessweb-c0u.pages.dev';

export default defineConfig({
  integrations: [vue()],
  site,
  base: '/note',
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
