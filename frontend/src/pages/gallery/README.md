# 相册（生活切片）

路由 `/gallery`。照片网格 + 两级相册筛选 + 全屏看图。

## 文件

| 文件 | 位置 | 内容 |
| --- | --- | --- |
| `GalleryPage.vue` | 这里 | 标题区、「添加照片」、拼装下面几块 |
| `AlbumBar.vue` | `modules/media/` | 两级相册条：第一排一级相册，第二排当前相册的子相册 |
| `GalleryGrid.vue` | `modules/media/` | 照片网格与每张下面的操作行 |
| `GalleryViewer.vue` | `modules/media/` | 全屏看图（外壳挂载，关闭时化作尘埃） |
| `MediaEditorDialog.vue` | `modules/media/` | 照片信息编辑：名称 / 描述 / 所属相册 / 可见范围（外壳挂载） |
| `AlbumManagerDialog.vue` | `modules/media/` | 新建、改名、删除相册与子相册（外壳挂载） |

## 上传流程

浏览器 → 对象存储是**直传**：`POST /api/storage/presign-upload` 拿签名 → 传文件 →
`POST /api/media` 存元数据。Java 服务不转发文件本体。

未登录时点「添加照片」会被 `requireLogin()` 挡下并带到账号页。

**照片落到哪个相册，看的是「你现在正在看哪一本」**：停在某个相册（或它的子相册）里上传，
照片就直接进那一本；停在「全部 / 未分类」时不归相册。少了这条，每张上传完都得再手动归一次。

## 三种照片混在一个列表里

内置示例、未登录时在本机加的照片（`data:` 地址、没有对象键）、服务器上的真实记录。
只有第三种能按 id 调接口，判断走 `media.isStoredMedia(item)`。

## 相册是两级的（相册 → 子相册）

相册是**真表**（`photo_albums`），不再是照片上的一个名字：

- 照片的归属是 `albumId`，`albumName` 只是给公开照片墙显示用的副本（原因见 `services/api.js`）。
- 「未分类」= `albumId` 为空。删掉一本相册时里面的照片会回到这里，**照片不会被删**。
- 两级是数据库触发器强制的（`photo_albums_keep_two_levels`）：子相册下面不能再建子相册，
  有子相册的相册也不能再挂到别人下面。
- 选一级相册时看的是「它 + 它所有子相册」的照片；要只看它自己那一层，点第二排的某一本子相册。
- 访客看到的相册条只列「装着公开照片」的相册（RLS 与 `/api/public/photo-albums` 都按这条过滤）。
  一级相册自己没有公开照片时，它的子相册会被当成一级显示——否则那本子相册会整个消失。

## 全屏看图的关闭

关闭走的是阅读弹窗那套「先定住一拍、再化作尘埃」的动效，时序在
`composables/useDustClose.js`（和 `ReadingSheet` 共用同一份）。粒子铺在**图片原来的位置**上。

因此 **`AppShell` 里不能再给它包 `<Transition>`**：外层一包，`v-if` 会在动画开始前
就把组件摘掉，粒子一个都来不及飞。
