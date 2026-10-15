<script setup>
// 日记页：一个页面里两个视图（我的 / 公开），
// 编辑与阅读弹窗挂在应用外壳上，这里只管列表和导入入口。
import { computed, ref } from 'vue'
import DiaryCard from '@/modules/diary/DiaryCard.vue'
import EmptyState from '@/modules/page/EmptyState.vue'
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import PageFooter from '@/modules/page/PageFooter.vue'
import { useAuthStore } from '@/stores/auth'
import { useDiariesStore } from '@/stores/diaries'
import { useProfileStore } from '@/stores/profile'
import DiaryToolbar from './components/DiaryToolbar.vue'

const diaries = useDiariesStore()
const profile = useProfileStore()
const auth = useAuthStore()

const importPicker = ref(null)

const header = computed(() => (diaries.showMyDiary
  ? { kicker: 'LITTLE MOMENTS, KEPT FOREVER', title: '我的日记', mark: '✳', subtitle: '每一页，都是好好生活过的证据。' }
  : { kicker: 'LET THE LITTLE MOMENTS BE SEEN', title: '公开日记', mark: '◎', subtitle: '这里收集所有人设为公开的日记。' }))

const footerNote = computed(() => (diaries.showMyDiary
  ? '你的故事，都值得好好珍藏。'
  : '把平凡的日子，慢慢过成喜欢的样子。'))

async function onImportPicked(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (files.length) await diaries.parseImportFiles(files)
}
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      :kicker="header.kicker"
      :title="header.title"
      :mark="header.mark"
      :subtitle="header.subtitle"
    >
      <div v-if="diaries.showMyDiary" class="diary-actions">
        <button class="button-secondary" @click="importPicker?.click()">⇧ &nbsp;导入日记</button>
        <input
          ref="importPicker"
          type="file"
          accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          hidden
          @change="onImportPicked"
        />
        <button class="button-secondary" @click="diaries.exportAll()">⇩ &nbsp;导出全部</button>
        <button class="button-primary" @click="diaries.openNew()">＋ &nbsp;写日记</button>
      </div>
      <span v-else class="privacy-pill">{{ profile.siteVisibility === 'PUBLIC' ? '◉ 博客公开' : '◌ 博客仅自己可见' }}</span>
    </InnerPageHeader>

    <DiaryToolbar />

    <div v-if="diaries.showMyDiary" class="diary-list">
      <DiaryCard
        v-for="entry in diaries.filteredDiaries"
        :key="entry.id"
        :entry="entry"
        show-actions
        show-visibility
        @open="diaries.selectedDiary = $event"
        @edit="diaries.openEdit"
        @toggle-visibility="diaries.changeVisibility"
        @export="diaries.exportOne"
        @remove="diaries.remove"
      />
      <EmptyState
        v-if="!diaries.filteredDiaries.length"
        title="还没有找到这篇日记"
        text="试试别的关键词，或者写下一段新的回忆。"
        action-label="写日记"
        @action="diaries.openNew()"
      />
    </div>

    <div v-else class="diary-list">
      <DiaryCard
        v-for="entry in diaries.publicDiaries"
        :key="entry.id"
        :entry="entry"
        @open="diaries.selectedDiary = $event"
      />
      <EmptyState
        v-if="!diaries.publicDiaries.length"
        icon="◎"
        title="还没有公开日记"
        :text="auth.isLoggedIn ? '编辑一篇日记，把可见范围改成“公开”，就会显示在这里。' : '还没有人公开日记。'"
        :action-label="auth.isLoggedIn ? '管理我的日记' : ''"
        variant="secondary"
        @action="diaries.diaryTab = 'mine'"
      />
    </div>

    <PageFooter :name="profile.profileName" :note="footerNote" />
  </section>
</template>
