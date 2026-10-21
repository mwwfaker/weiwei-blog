import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { readStoredJson, writeStoredJson } from '@/services/storage'
import { notify } from '@/app/useToast'
import { demoMessages } from '@/data/seed'

const MESSAGES_KEY = 'weiwei-blog-messages-v1'

/**
 * 留言板。
 *
 * 现在只保存在本机（localStorage），后端还没有对应接口——所以动作里的提示写的是
 * 「已添加到预览」，不假装已经入库。等有接口了，把 persist 换成 request 即可。
 *
 * 友链那一半已经随「朋友们」页面一起删掉了（页面上没有入口，状态也就没人读）。
 * 如果以后要做，新的落点应该是 `services/` 里加接口、这里加一段状态——
 * 别再把「只在某一个页面用到」的状态提前塞进全站 store。
 */
export const useGuestbookStore = defineStore('guestbook', () => {
  const messages = ref(readStoredJson(MESSAGES_KEY, null) || demoMessages)
  watch(messages, (value) => writeStoredJson(MESSAGES_KEY, value), { deep: true })
  const messageDraft = ref({ name: '', content: '' })

  function saveMessage() {
    if (!messageDraft.value.name.trim() || !messageDraft.value.content.trim()) return notify('请填写昵称和留言内容')
    messages.value.unshift({ ...messageDraft.value, id: Date.now(), date: new Date().toISOString().slice(0, 10) })
    messageDraft.value = { name: '', content: '' }
    notify('留言已添加到预览')
  }

  return { messages, messageDraft, saveMessage }
})
