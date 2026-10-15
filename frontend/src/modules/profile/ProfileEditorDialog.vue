<script setup>
// 个人资料弹窗：头像上传 + 昵称 + 一句自我介绍。
import { ref } from 'vue'
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useProfileStore } from '@/stores/profile'

const profile = useProfileStore()
const avatarPicker = ref(null)

function pickAvatar(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) profile.chooseAvatar(file)
}
</script>

<template>
  <ModalShell
    close-label="关闭个人资料"
    card-class="profile-editor"
    kicker="YOUR LITTLE SPACE"
    title="个人资料"
    @close="profile.profileDialog = false"
  >
    <label class="avatar-upload">
      <img v-if="profile.profileAvatarSrc" :src="profile.profileAvatarSrc" alt="头像预览" />
      <span v-else>唯</span>
      <span>更换头像<small>点击上传</small></span>
      <input type="file" accept="image/*" hidden @change="pickAvatar" />
    </label>
    <label>怎么称呼你？<input v-model="profile.profileName" maxlength="20" /></label>
    <label>写一句自我介绍<textarea v-model="profile.profileBio" rows="3" maxlength="160"></textarea></label>
    <div class="modal-actions">
      <span>头像和资料会保存到账号数据库</span>
      <button class="button-primary" @click="profile.save()">保存资料</button>
    </div>
  </ModalShell>
</template>
