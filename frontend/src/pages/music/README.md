# 音乐收藏

路由 `/music`。播放器 + 导入队列 + 曲库。

## 文件

这一页自己只有一个文件 `MusicPage.vue`（编排）。所有板块都在
`src/modules/music/` 下，因为外壳也要用其中几个：

| 板块 | 谁在用 |
| --- | --- |
| `MusicPlayerPanel.vue` | 只在这一页 |
| `MusicLibrary.vue` | 只在这一页 |
| `ImportQueue.vue` | 只在这一页 |
| `MusicDock.vue`（右下角音乐盒） | 外壳，任何页面 |
| `AudioEngine.vue`（两个 `<audio>`） | 外壳，常驻 |

## 标题栏的「添加音乐」怎么接到曲库里

`MusicLibrary` 用 `defineExpose({ openUploadPicker })` 把打开文件选择框的动作暴露出来，
音乐页拿到组件引用后调用它。这样「上传本地音乐」只有一处 `requireLogin()` 和一个 `<input type="file">`。

## 省电开关

「完整动效 / 省电模式」由 `music.setLowPower()` 控制，同时影响三件事：
音频图（不建）、粒子背景（不渲染）、频谱（不渲染）。
它同时是诊断开关：打开后不卡了，说明瓶颈在音频图这条通路上。

代价是切换时 `<audio>` 元素会被换掉（Web Audio 的 source node 和元素绑死，无法断开），
所以提示语里会说「重新选一首歌即可」。

## 上传为什么要在后台跑

上传 + 入库可能十几秒。这一页用的是**内联队列**（`ImportQueue`），不是模态框：
关掉某一行不会中断任务，失败的那一行会留着让你看到。

上传期间会先暂停播放——两个一起抢带宽时实测进度会一直卡在「上传中」。

## 歌词栏没有挂在这一页

`modules/music/LyricsPanel.vue` 保留且仍被渲染测试覆盖，但当前 `.music-console` 是单栏，
只放了播放器面板。要接回来在 `.music-console` 里加一列即可。
