// @ts-check
import { defineConfig } from 'astro/config';

// 纯静态站点：/ 为中文版，/en/ 为英文版（在 src/pages 下手动组织路由）
export default defineConfig({
  site: 'https://chensijie.pages.dev', // Cloudflare Pages 正式域名（用于 canonical / OG / hreflang 绝对 URL）；绑定自定义域名后改为此处即可
  build: {
    format: 'directory',
  },
});
