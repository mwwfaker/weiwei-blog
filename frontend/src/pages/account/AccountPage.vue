<script setup>
// 登录 / 注册页。表单状态只属于这一页，所以留在组件里；账号动作走 auth store，
// 「登录后重读全站内容」走 library store。
import { ref } from 'vue'
import { go } from '@/app/usePageNav'
import { notify } from '@/app/useToast'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'

const auth = useAuthStore()
const library = useLibraryStore()

const authMode = ref('login')
const authForm = ref({ email: '', password: '', displayName: '' })

function switchMode() {
  authMode.value = authMode.value === 'login' ? 'register' : 'login'
  auth.error = ''
}

// Only report success once the account is really usable. `restoreSession` clears the token when
// /api/account/me fails, so on failure this must say so instead of navigating as if signed in.
async function authenticate() {
  auth.error = ''
  try {
    const user = authMode.value === 'login'
      ? await auth.login(authForm.value.email, authForm.value.password)
      : await auth.register(authForm.value.email, authForm.value.password, authForm.value.displayName)
    const usable = await library.completeLogin(user.displayName)
    if (!usable) return
    go('admin')
    notify('账号验证成功')
  } catch { /* auth.error already carries the reason and is shown in the form. */ }
}
</script>

<template>
  <section class="page-content inner-page account-page">
    <div class="account-card">
      <div class="account-visual">
        <span>唯</span>
        <strong>你的故事<br />有自己的位置。</strong>
        <small>WEIWEI GARDEN · MEMBER SPACE</small>
      </div>

      <form class="account-form" @submit.prevent="authenticate">
        <div class="section-kicker">{{ authMode === 'login' ? 'WELCOME BACK' : 'CREATE YOUR SPACE' }} <span></span></div>
        <h1>{{ authMode === 'login' ? '欢迎回来' : '创建账号' }}</h1>
        <p>登录后可以跨设备保存日记、管理公开范围和上传媒体。</p>

        <label v-if="authMode === 'register'">昵称<input v-model="authForm.displayName" autocomplete="name" required /></label>
        <label>邮箱<input v-model="authForm.email" type="email" autocomplete="email" required /></label>
        <label>
          密码
          <input
            v-model="authForm.password"
            type="password"
            :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'"
            :minlength="authMode === 'register' ? 10 : 1"
            required
          />
          <small v-if="authMode === 'register'">至少 10 个字符</small>
        </label>

        <p v-if="auth.error" class="error-message">
          {{ auth.error.includes('localhost') || auth.error.includes('fetch') ? '账号服务暂时连接不上，请检查网络后重试。' : auth.error }}
        </p>

        <button class="button-primary account-submit" :disabled="auth.busy">
          {{ auth.busy ? '正在验证…' : authMode === 'login' ? '登录账号 ↗' : '创建账号 ↗' }}
        </button>
        <button class="button-text account-switch" type="button" @click="switchMode">
          {{ authMode === 'login' ? '还没有账号？创建一个' : '已有账号？返回登录' }}
        </button>
        <small class="account-note">密码经过加密后保存。创建账号后，你可以逐篇决定哪些日记公开。</small>
      </form>
    </div>
  </section>
</template>
