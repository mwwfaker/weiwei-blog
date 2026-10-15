# 相册（生活切片）

路由 `/gallery`。照片网格 + 相册筛选 + 全屏看图。

## 文件

| 文件 | 位置 | 内容 |
| --- | --- | --- |
| `GalleryPage.vue` | 这里 | 标题区、「添加照片」、拼装下面几块 |
| `AlbumBar.vue` | `modules/media/` | 相册胶囊 + 当前照片数 |
| `GalleryGrid.vue` | `modules/media/` | 照片网格与每张下面的操作行 |
| `GalleryViewer.vue` | `modules/media/` | 全屏看图（外壳挂载） |
| `MediaEditorDialog.vue` | `modules/media/` | 照片信息编辑（外壳挂载） |

## 上传流程

浏览器 → 对象存储是**直传**：`POST /api/storage/presign-upload` 拿签名 → 传文件 →
`POST /api/media` 存元数据。Java 服务不转发文件本体。

未登录时点「添加照片」会被 `requireLogin()` 挡下并带到账号页。

## 三种照片混在一个列表里

内置示例、未登录时在本机加的照片（`data:` 地址、没有对象键）、服务器上的真实记录。
只有第三种能按 id 调接口，判断走 `media.isStoredMedia(item)`。

## 相册名

没有独立的相册表：相册就是照片上的 `albumName` 字段（默认「日常」），
`media.albumNames` 由当前列表去重得出。
