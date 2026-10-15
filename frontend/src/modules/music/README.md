# `modules/music/` — 音乐相关复用件

| 文件 | 用途 | 谁在用 |
| --- | --- | --- |
| `AudioEngine.vue` | 两个 `<audio>` 元素，常驻外壳 | 外壳 |
| `MusicPlayerPanel.vue` | 唱片 + 频谱 + 进度 + 控制条 | 音乐页 |
| `MusicLibrary.vue` | 上传入口、在线直链、曲目列表 | 音乐页 |
| `ImportQueue.vue` | 内联的导入队列 | 音乐页 |
| `MusicEditorDialog.vue` | 曲目改名 / 改可见范围 | 外壳 |
| `MusicDock.vue` | 右下角音乐盒（收起是唱片，悬停向左展开） | 外壳 |
| `MusicVisualizer.vue` | 频谱画布，四种模式 | 播放器面板 |
| `LyricsPanel.vue` | 歌词栏：逐行滚动、当前句高亮、点句跳转、粘贴 LRC | **目前没挂载**（见下） |

## 音频元素为什么在外壳里

`<audio>` 一旦随页面卸载就断声，而右下角的音乐盒在任何页面都要能控制播放。
所以元素常驻外壳，`stores/music.js` 通过 `attachAudio()` 拿到引用。

`AudioEngine` 用 `watchEffect` 重新绑定引用：省电模式切换时 `<audio>` 的 `key` 会变，
Vue 换上一个干净的元素（Web Audio 的 `MediaElementAudioSourceNode` 一旦建立就和元素绑死，
同一个元素不能再建第二个）。

## 歌词栏目前没有挂载

`LyricsPanel.vue` 保留着，`ssr-smoke` 也仍然覆盖它的四个状态分支，但当前版本的播放器是单栏布局，
`.music-console` 里只放了 `MusicPlayerPanel`。要接回来只需要在音乐页的 `.music-console`
里加一列，并把 `lyricsLrc` / `lyricsParsed` / `music.currentTime` 传进去。

**不要因为「看起来没人用」就删掉它**：它是可用功能，只是暂时没接到页面上。

## 性能上的两个既定取舍

- 频谱画布按播放状态分档帧率（播放 30fps、空闲 15fps），不可见时不画；
  唱片周围那圈涟漪固定 24fps——它是慢速装饰，没必要和主频谱抢帧。
- 省电模式整块关掉音频图、粒子和频谱，音频改走浏览器原生通路。它同时是一个诊断开关：
  打开后不卡了就说明瓶颈在音频图这条通路上。
