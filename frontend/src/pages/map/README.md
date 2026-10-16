# 足迹

路由 `/map`。把**有拍摄地点**的照片铺到地图上，按时间连成一条线。

## 数据从哪来

| 界面元素 | 来源 |
| --- | --- |
| 地图上的点与连线 | `media.geoPhotos`（有 `latitude`/`longitude` 的照片，按拍摄时间排序） |
| 气泡里的缩略图与日期 | 照片自己的 `thumb` / `takenAt` |
| 点标记打开大图 | 写 `media.galleryPreview`（外壳里的全屏看图会接住） |

地点的来源是**上传时的 EXIF**：`services/photoUpload.js` 从原文件里读 `GPSLatitude/Longitude`
存进 `media_assets.latitude/longitude`。没有 GPS 的照片不会出现在这里 —— 这是常态
（微信、微博保存的图，截图，都没有），不是错误。

## 文件

| 文件 | 内容 |
| --- | --- |
| `MapPage.vue` | 页面本体：编排（拉 Leaflet、铺点、连线），不写业务逻辑 |
| `map.css` | 本页专属样式，由组件 `import './map.css'` 按需加载 |

## 需要注意的地方

- **Leaflet 与它的 CSS 都是动态 import 的**：不进主包，也不用把地图样式塞进
  `styles/index.css`（那样每个页面都会多下几十 KB）。这是仓库里第二个「按需加载的页面样式」，
  第一个是 `pages/perf/perf.css`。
- **地图瓦片用的是 OpenStreetMap 的公共服务**（免费、不要 key）。国内可能慢或取不到；
  取不到时 `tileerror` 会把提示写出来，而**标记点是自己画的、不依赖瓦片**，所以功能不崩。
  如果以后要换国内底图，只改 `tileLayer(...)` 那一行。
- **先画线、再铺点**：反过来的话虚线会压在标记点上面，点标记的点击会被线拦掉（实测踩到过）。
  线还设了 `interactive: false` —— 它只是"走过哪里"的示意，不该参与交互。
- **点标记只开气泡，看图要再点气泡里的缩略图。** 早先是点标记直接开全屏看图，
  结果气泡刚冒出来就被大图盖住 —— 等于白做。全屏看图走 `media.galleryPreview`，由外壳接住。
- **照片名称要转义**：它会拼进气泡的 HTML 字符串里（`escapeHtml`）。名字是用户自己写的，
  不转义就是一个注入点。
- 单张照片不连线（`route.length > 1` 才画 polyline）—— 一个点连成线只会画出个点。

## 待办

- [ ] 大量照片时可以聚合（clustering），现在是一个点一个标记
- [ ] 按相册/年份筛选足迹
