import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 相对路径：这样同一份产物既能放在域名根目录，也能放在 GitHub Pages 的
  // https://<用户名>.github.io/<仓库名>/ 子路径下，不需要改配置。
  base: './',
  build: {
    // This is a single-page app whose shell renders every page from one bundle, and it embeds a
    // 29-course study plan as local data. Splitting that out would add a loading state to a page
    // that currently appears instantly, for roughly 35 kB of gzipped transfer.
    // 阈值放到 750：接入 Supabase SDK（账号 / 数据库 / 对象存储）后主包约 704 kB，
    // 其中 SDK 本身约 35 kB gzip。再往上就该真的做代码分割了。
    chunkSizeWarningLimit: 750,
  },
})
