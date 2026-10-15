// 主题（深色 / 浅色）通过 provide/inject 往下传：
// 只有应用外壳知道 @vueuse 的 useDark 实例，音乐页的频谱和粒子背景只需要「现在是深色吗」。
import { inject, ref } from 'vue'

export const THEME_KEY = Symbol('weiwei:theme')

export function useIsDark() {
  // 渲染测试里没有外壳，给一个深色默认值，不要抛错。
  return inject(THEME_KEY, ref(true))
}
