<script setup>
// 写 / 改日记的弹窗。字段与日记的存储字段一一对应，可见范围的默认值来自 profile store。
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useDiariesStore } from '@/stores/diaries'

const diaries = useDiariesStore()
</script>

<template>
  <ModalShell
    close-label="关闭日记编辑"
    card-class="diary-editor"
    kicker="WRITE IT DOWN"
    :title="diaries.draft.id ? '改写这一页' : '写一篇日记'"
    @close="diaries.diaryDialog = false"
  >
    <label>标题<input v-model="diaries.draft.title" maxlength="80" placeholder="给今天起个名字…" /></label>
    <div class="form-row">
      <label>日期<input v-model="diaries.draft.date" type="date" /></label>
      <label>心情<select v-model="diaries.draft.mood"><option>平静</option><option>开心</option><option>期待</option><option>疲惫</option><option>难过</option></select></label>
      <label>天气<select v-model="diaries.draft.weather"><option>☀️</option><option>☁️</option><option>🌦</option><option>🌧</option><option>❄️</option></select></label>
    </div>
    <label class="visibility-field">
      谁可以看到这篇日记？
      <select v-model="diaries.draft.visibility"><option value="PRIVATE">◌ 仅自己可见</option><option value="PUBLIC">◉ 公开给访客</option></select>
      <small>默认仅自己可见。设为公开后，访客可以阅读这篇内容。</small>
    </label>
    <label>标签<input v-model="diaries.draft.tags" placeholder="用逗号分隔，例如：日常，散步" /></label>
    <label>日记内容<textarea v-model="diaries.draft.content" rows="8" placeholder="今天发生了什么？有什么想留下来的？"></textarea></label>
    <div class="modal-actions">
      <span>写给未来某天的自己 ♡</span>
      <button class="button-primary" @click="diaries.save()">保存日记 &nbsp;↗</button>
    </div>
  </ModalShell>
</template>
