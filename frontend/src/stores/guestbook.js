import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { readStoredJson, writeStoredJson } from '@/services/storage'
import { notify } from '@/app/useToast'
import { demoFriends, demoMessages } from '@/data/seed'

const MESSAGES_KEY = 'weiwei-blog-messages-v1'
const FRIENDS_KEY = 'weiwei-blog-friends-v1'

/**
 * 留言板与友链。
 *
 * 两张表现在都只保存在本机（localStorage），后端还没有对应接口——所以动作里的提示写的是
 * 「已添加到预览」，不假装已经入库。等有接口了，把 persist 换成 request 即可。
 */
export const useGuestbookStore = defineStore('guestbook', () => {
  const messages = ref(readStoredJson(MESSAGES_KEY, null) || demoMessages)
  watch(messages, (value) => writeStoredJson(MESSAGES_KEY, value), { deep: true })
  const messageDraft = ref({ name: '', content: '' })

  const friendLinks = ref(readStoredJson(FRIENDS_KEY, null) || demoFriends)
  watch(friendLinks, (value) => writeStoredJson(FRIENDS_KEY, value), { deep: true })
  const friendDraft = ref({ name: '', url: '', note: '' })

  function saveMessage() {
    if (!messageDraft.value.name.trim() || !messageDraft.value.content.trim()) return notify('请填写昵称和留言内容')
    messages.value.unshift({ ...messageDraft.value, id: Date.now(), date: new Date().toISOString().slice(0, 10) })
    messageDraft.value = { name: '', content: '' }
    notify('留言已添加到预览')
  }

  function addFriend() {
    if (!friendDraft.value.name.trim() || !friendDraft.value.url.trim()) return notify('请填写网站名称和地址')
    friendLinks.value.unshift({ ...friendDraft.value })
    friendDraft.value = { name: '', url: '', note: '' }
    notify('友链已添加到预览')
  }

  return { messages, messageDraft, friendLinks, friendDraft, saveMessage, addFriend }
})
