<script setup>
// 文章编辑弹窗。封面上传的临时地址留在本组件里，保存时把 File 交给 store 处理。
import { ref } from 'vue'
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useArticlesStore } from '@/stores/articles'

const articles = useArticlesStore()
const coverPicker = ref(null)

function pickCover(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) articles.chooseCover(file)
}
</script>

<template>
  <ModalShell
    close-label="关闭编辑"
    card-class="diary-editor article-editor"
    :kicker="'WRITE YOUR STORY'"
    :title="articles.articleDraft.id ? '编辑文章' : '写一篇新文章'"
    @close="articles.articleDialog = false"
  >
    <label>文章标题<input v-model="articles.articleDraft.title" maxlength="120" placeholder="给这篇文章起个名字" /></label>
    <div class="form-row">
      <label>分类<input v-model="articles.articleDraft.category" placeholder="例如：旅行、生活、阅读" /></label>
      <label>发布日期<input v-model="articles.articleDraft.date" type="date" /></label>
    </div>
    <div class="cover-upload">
      <img v-if="articles.articleImage(articles.articleDraft)" :src="articles.articleImage(articles.articleDraft)" alt="文章封面预览" />
      <div v-else class="cover-placeholder">选择一张本地图片作为封面</div>
      <button type="button" class="button-secondary" @click="coverPicker?.click()">从电脑选择封面</button>
      <input ref="coverPicker" type="file" accept="image/*" hidden @change="pickCover" />
    </div>
    <label>标签<input v-model="articles.articleDraft.tags" placeholder="多个标签用逗号隔开" /></label>
    <label>摘要<textarea v-model="articles.articleDraft.excerpt" rows="2" maxlength="240" placeholder="列表页显示的简短介绍"></textarea></label>
    <label>正文<textarea v-model="articles.articleDraft.content" rows="12" placeholder="在这里写下文章…"></textarea></label>
    <label class="visibility-field">文章可见范围<select v-model="articles.articleDraft.visibility"><option value="PUBLIC">公开</option><option value="PRIVATE">仅自己可见</option></select></label>
    <div class="modal-actions">
      <span>保存到账号和数据库</span>
      <button class="button-primary" @click="articles.save()">保存文章</button>
    </div>
  </ModalShell>
</template>
