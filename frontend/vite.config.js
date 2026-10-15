import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // 全项目统一用 `@/` 指向 frontend/src。深层页面（pages/<page>/components/…）
    // 如果写相对路径会出现 `../../../..`，改目录时会整片失效。
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // 相对路径：这样同一份产物既能放在域名根目录，也能放在 GitHub Pages 的
  // https://<用户名>.github.io/<仓库名>/ 子路径下，不需要改配置。
  base: './',
  build: {
    // 主包体量：接入 Supabase SDK（账号 / 数据库 / 对象存储）后约 704 kB，
    // 其中 SDK 本身约 35 kB gzip。学习路线与绩效计算器已改成按需加载，不进首屏包。
    // 阈值放到 750，再往上就该继续做代码分割了。
    chunkSizeWarningLimit: 750,
  },
})
