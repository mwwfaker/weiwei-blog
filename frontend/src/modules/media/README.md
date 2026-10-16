# `modules/media/` — 相册相关复用件

| 文件 | 用途 |
| --- | --- |
| `AlbumBar.vue` | 两级相册条：第一排一级相册（含「全部 / 未分类」），第二排当前相册的子相册。 |
| `GalleryGrid.vue` | 照片网格。每张下面的操作行只在「已登录 + 是自己的照片」时出现。 |
| `GalleryViewer.vue` | 全屏看图，点空白或右上角关闭；本人照片可以直接在这里删。关闭时化作尘埃。 |
| `MediaEditorDialog.vue` | 照片信息编辑：名称、描述、所属相册、可见范围。 |
| `AlbumManagerDialog.vue` | 相册管理：新建一级相册 / 子相册、改名、删除。 |

## 「本地草稿」和「真实记录」

`galleryItems` 里混着三种东西：内置示例、未登录时在本机加的照片（`data:` 地址、没有对象键）、
以及服务器上的真实记录。只有第三种能按 id 调接口。

判断走 `useMediaStore().isStoredMedia(item)`（有 `key` 且不是 `local`）。
少了这个判断，一张示例照片可能发出 `PUT /api/media/1`，静默改掉一张无关的真实照片。

## 相册 id 一律当字符串

`albumId`、`selectedAlbum`、`albumCounts` 的键都是字符串。相册 id 会在 `<select>` 的
`value`、筛选键、接口参数之间来回走，类型一旦一边是数字一边是字符串，
`'12' === 12` 这种比较会让筛选**静默地少一批照片**——不报错，只是照片不见了。

## 相册名为什么在照片上还留一份

照片同时带 `albumId`（真归属）和 `albumName`（显示副本）。相册表对访客基本不可见
（只放行「装着公开照片」的那些，见 `supabase/schema.sql` 的 RLS），而公开照片墙要显示
相册名。所以**改动归属的地方两列必须一起写**：只写 `album_id` 会让照片挂着旧名字，
相册改名后也一样（`services/api.js` 的 PUT 会顺手更新副本）。

## 关闭动效是共用件

`GalleryViewer` 的退场和 `modules/modal/ReadingSheet.vue` 用的是同一份
`composables/useDustClose.js`（时长常量、量位置、量不到时的兜底、等粒子飞完再 `emit('close')`）。
粒子层是 `modules/modal/DustBurst.vue`。

改动效时**不要只改一边**：时长各写一份，症状就是「粒子还在飞，组件已经被摘掉了」，
而且只在自己那处看得见。全屏看图的 `AppShell` 外层也不要再包 `<Transition>`。
