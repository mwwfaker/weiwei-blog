import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './app/router'
import { bootReady } from './app/boot'
import './styles/index.css'

const app = createApp(App)
app.use(createPinia()).use(router)
app.mount('#app')

// 首帧画出来之后再收启动页：mount 是同步的，直接收会先白一下。
requestAnimationFrame(() => bootReady())
