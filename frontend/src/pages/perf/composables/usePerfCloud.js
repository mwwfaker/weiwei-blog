// 云端同步：读公开列表、写回自己那一份、以及「正在看的是谁」这套状态。
//
// 看：绩效数据是公开的，登录与否都从同一个公开接口读，访客看到的和账号里存的是同一份。
// 改：只有登录以后、并且正在看自己那一份的时候才允许写；写入做 800ms 防抖。
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { fromServer, loadPublicWorkspaces, saveWorkspace } from '@/services/perfApi'

export function usePerfCloud({ auth, members, entries, queues, checkHours }) {
  const workspaces = ref([])
  const activeOwnerId = ref(null)
  const syncState = ref(auth.isLoggedIn ? 'idle' : 'readonly')
  const syncMessage = ref('')

  /**
   * 正在看的是不是自己那一份。只要不是自己的一律只读——否则切换查看别人数据时，
   * 防抖保存会把别人的名单写进自己的账号。
   */
  const readOnly = computed(() => !auth.isLoggedIn || String(activeOwnerId.value ?? '') !== String(auth.user?.id ?? ''))

  const activeOwnerName = computed(() => {
    const found = workspaces.value.find((item) => String(item.ownerId) === String(activeOwnerId.value))
    if (found?.ownerName) return found.ownerName
    // 自己那一份还没建立时（公开列表里查不到自己），显示自己的昵称而不是「未命名账号」。
    if (auth.isLoggedIn && String(activeOwnerId.value) === String(auth.user?.id)) return auth.user?.displayName || '我'
    return '未命名账号'
  })

  /** 顶栏右侧那行状态字：只有没有具体消息时才退回这个默认文案。 */
  const syncLabel = computed(() => ({
    idle: '', loading: '正在读取云端数据…', saving: '正在保存到账号…', saved: '已保存到账号',
    readonly: '公开只读', error: '云端同步失败',
  }[syncState.value] ?? ''))

  let syncTimer
  let skipNextSync = false

  /**
   * 把某一份工作区套用到编辑区。
   * `adoptLocal` 为真且云端这一份还是空的、本机已经有名单时返回 false，
   * 交给调用方决定「把本机数据推上去」，而不是直接清空。
   */
  function applyWorkspace(workspace, { adoptLocal = false } = {}) {
    const parsed = fromServer(workspace, checkHours.value)
    if (adoptLocal && !parsed.members.length && members.value.length) return false
    skipNextSync = true
    if (parsed.queues.length) queues.value = parsed.queues
    members.value = parsed.members
    entries.value = parsed.entries
    return true
  }

  async function pullWorkspace() {
    syncState.value = 'loading'
    try {
      // 直接刷新在 /perf 上时会话可能还没恢复，先确认登录状态再决定读哪一份。
      if (!auth.user) await auth.restoreSession()
      workspaces.value = await loadPublicWorkspaces()
    } catch (error) {
      syncState.value = 'error'
      syncMessage.value = `云端读取失败，当前用的是本机数据：${error.message}`
      return
    }

    if (auth.isLoggedIn) {
      const mine = workspaces.value.find((item) => String(item.ownerId) === String(auth.user?.id))
      // 自己云端还没有这一份时，也要把「正在看的就是我自己」这个身份定下来。
      // 早先这里是 `?? null`：新账号在公开列表里找不到自己 → activeOwnerId 为 null →
      // readOnly 判定成「在看别人的数据」→ 整页只读（CSS 给按钮加了 pointer-events:none），
      // 于是新账号永远没法录入第一份绩效——而页面提示偏偏写着「先在员工名单里把人加进来」。
      // 未登录依然是只读，这一点没变。
      activeOwnerId.value = mine?.ownerId ?? auth.user?.id ?? null
      if (!applyWorkspace(mine, { adoptLocal: true })) {
        // 自己的云端还没有数据：把本机已有的内容推上去，而不是清空
        skipNextSync = true
        syncState.value = 'saving'
        try {
          await saveWorkspace(auth.token, { queues: queues.value, members: members.value, entries: entries.value })
          syncState.value = 'saved'
          syncMessage.value = '已把本机数据同步到账号'
        } catch (error) {
          syncState.value = 'error'
          syncMessage.value = `同步到账号失败：${error.message}`
        }
        return
      }
      syncState.value = 'saved'
      syncMessage.value = ''
      return
    }

    const first = workspaces.value[0]
    activeOwnerId.value = first?.ownerId ?? null
    applyWorkspace(first)
    syncState.value = 'readonly'
    syncMessage.value = workspaces.value.length ? `正在查看 ${activeOwnerName.value} 的数据` : '账号里还没有绩效数据。'
  }

  /** 顶部选择器切换查看对象：切到别人的那一份会自动变成只读。 */
  function selectWorkspace(ownerId) {
    const target = workspaces.value.find((item) => String(item.ownerId) === String(ownerId))
    if (!target || String(target.ownerId) === String(activeOwnerId.value)) return
    activeOwnerId.value = target.ownerId
    applyWorkspace(target)
    syncState.value = readOnly.value ? 'readonly' : 'saved'
    syncMessage.value = `正在查看 ${activeOwnerName.value} 的数据${readOnly.value ? '（只读）' : ''}`
  }

  async function pushWorkspace() {
    if (readOnly.value) return
    syncState.value = 'saving'
    try {
      await saveWorkspace(auth.token, { queues: queues.value, members: members.value, entries: entries.value })
      syncState.value = 'saved'
      syncMessage.value = ''
    } catch (error) {
      syncState.value = 'error'
      syncMessage.value = `保存到云端失败：${error.message}`
    }
  }

  watch([members, entries, queues], () => {
    // 无论是否要跳过，先把标记消费掉，免得它留到下一次真正的编辑上。
    const skipping = skipNextSync
    skipNextSync = false
    if (skipping || readOnly.value) return
    clearTimeout(syncTimer)
    syncTimer = setTimeout(pushWorkspace, 800)
  }, { deep: true })

  onMounted(() => { pullWorkspace() })
  onUnmounted(() => { clearTimeout(syncTimer) })

  return {
    workspaces,
    activeOwnerId,
    syncState,
    syncMessage,
    readOnly,
    activeOwnerName,
    syncLabel,
    pullWorkspace,
    selectWorkspace,
    pushWorkspace,
  }
}
