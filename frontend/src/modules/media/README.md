# `modules/media/` — 相册相关复用件

| 文件 | 用途 |
| --- | --- |
| `AlbumBar.vue` | 相册分类条：左边一排相册胶囊，右边当前筛选出的照片数。 |
| `GalleryGrid.vue` | 照片网格。每张下面的操作行只在「已登录 + 是自己的照片」时出现。 |
| `GalleryViewer.vue` | 全屏看图，点空白或右上角关闭；本人照片可以直接在这里删。 |
| `MediaEditorDialog.vue` | 照片信息编辑：名称、所属相册、可见范围。 |

## 「本地草稿」和「真实记录」

`galleryItems` 里混着三种东西：内置示例、未登录时在本机加的照片（`data:` 地址、没有对象键）、
以及服务器上的真实记录。只有第三种能按 id 调接口。

判断走 `useMediaStore().isStoredMedia(item)`（有 `key` 且不是 `local`）。
少了这个判断，一张示例照片可能发出 `PUT /api/media/1`，静默改掉一张无关的真实照片。
