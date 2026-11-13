import { ref } from 'vue'
import { defineStore } from 'pinia'
import { request } from '@/services/api'
import { notify } from '@/app/useToast'

/**
 * 留言板。
 *
 * 2026-11 起接进数据库（`guestbook_messages` 表）：
 * **全公开**——任何人都能读，也不需要账号就能写。所以这里的动作都不带 token。
 *
 * 以前它只存在本机 localStorage，别人写的你看不到、你写的别人也看不到；现在是真的。
 * 服务端还有一层 RLS 兜底（昵称 ≤30、内容 ≤500），前端的限长只是让错误提示来得早点。
 */
export const useGuestbookStore = defineStore('guestbook', () => {
  const messages = ref([])
  const messageDraft = ref({ name: '', content: '' })
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')

  async function load() {
    if (loading.value) return
    loading.value = true
    error.value = ''
    try {
      messages.value = await request('/api/messages')
      loaded.value = true
    } catch (e) {
      error.value = e.message || '加载失败'
    } finally {
      loading.value = false
    }
  }

  async function saveMessage() {
    const name = messageDraft.value.name.trim()
    const content = messageDraft.value.content.trim()
    if (!name || !content) return notify('请填写昵称和留言内容')
    try {
      const saved = await request('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ name, content }),
      })
      messages.value = [saved, ...messages.value]
      messageDraft.value = { name: '', content: '' }
      notify('留言已发布')
    } catch (e) {
      notify(`留言没发出去：${e.message}`)
    }
  }

  return { messages, messageDraft, loading, loaded, error, load, saveMessage }
})
