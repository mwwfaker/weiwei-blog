<script setup>
// 「员工名单」：一个月只填一次的固定项（姓名/邮箱/月要求工时/抽调/加班/三薪）。
// 增删改都 emit 回 PerfPage——名单是云端同步的核心数据，不能在面板里自己改。
//
// 三个重置按钮也只是 emit 意图：清哪些字段、保留什么、怎么确认，全在 PerfPage 里定，
// 这里说的「重置」只清数据，姓名/邮箱/队列归属都留着（提示文案写在 PerfPage）。
import { DEFAULT_REQUIRED_HOURS } from '@/services/perf'
import { money } from '../composables/format.js'

defineProps({
  members: { type: Array, default: () => [] },
  rowByMember: { type: Map, default: () => new Map() },
  bulkMessage: { type: String, default: '' },
})
const emit = defineEmits([
  'add-member', 'bulk-add', 'remove-member', 'apply-hours',
  'reset-member-data', 'reset-all-data', 'reset-extra-hours',
])

// 批量粘贴框是否展开、粘贴内容、统一工时的输入值，都只被这一块用，但保持由父级持有，
// 这样切走再切回来时不会把用户正在粘贴的内容丢掉。
const bulkOpen = defineModel('bulkOpen', { type: Boolean, default: false })
const bulkText = defineModel('bulkText', { type: String, default: '' })
const promptRef = defineModel('promptRef', { type: String, default: String(DEFAULT_REQUIRED_HOURS) })

function addMember() { emit('add-member') }
function bulkAdd() { emit('bulk-add') }
function removeMember(id) { emit('remove-member', id) }
function applyHoursToAll() { emit('apply-hours') }
function resetMemberData(id) { emit('reset-member-data', id) }
function resetAllData() { emit('reset-all-data') }
function resetExtraHours() { emit('reset-extra-hours') }
</script>

<template>
  <section class="perf-panel">
    <div class="perf-overview-bar">
      <button class="perf-btn primary" @click="addMember">＋ 添加一人</button>
      <button class="perf-btn" @click="bulkOpen = !bulkOpen">批量粘贴邮箱</button>
      <button class="perf-btn" @click="resetExtraHours">重置抽调/加班/三薪时长</button>
      <button class="perf-btn" @click="resetAllData">重置全部员工数据</button>
      <span class="perf-hint">这里的四项每人只需填一次，之后每月只改队列里的 AHT 与审核量。</span>
    </div>

    <div v-if="bulkOpen" class="perf-card">
      <h3>批量添加：每行一个邮箱（姓名自动取邮箱前缀）</h3>
      <textarea v-model="bulkText" rows="5" placeholder="zhangsan.1001@example.com&#10;lisi.1002@example.com"></textarea>
      <div class="perf-overview-bar">
        <button class="perf-btn primary" :disabled="!bulkText.trim()" @click="bulkAdd">添加</button>
        <span v-if="bulkMessage" class="perf-hint">{{ bulkMessage }}</span>
      </div>
    </div>

    <div v-if="!members.length" class="perf-empty">
      <h3>还没有人</h3>
      <p>点「批量粘贴邮箱」一次把小组的人贴进来，或点「添加一人」逐个加。</p>
    </div>

    <div v-else class="perf-list">
      <table class="perf-grid roster">
        <thead>
          <tr>
            <th>姓名</th><th>邮箱</th>
            <th class="num">月要求工时</th><th class="num">抽调时长</th><th class="num">加班时长</th><th class="num">三薪时长</th>
            <th class="num">月实际工时</th><th class="num">合计</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in members" :key="member.id">
            <td><input v-model="member.name" class="perf-cell" /></td>
            <td><input v-model="member.email" class="perf-cell wide" /></td>
            <td class="num"><input type="number" step="0.01" class="perf-cell" v-model.number="member.requiredHours" /></td>
            <td class="num"><input type="number" step="0.01" class="perf-cell" v-model.number="member.transferHours" /></td>
            <td class="num"><input type="number" step="0.01" class="perf-cell" v-model.number="member.overtimeHours" /></td>
            <td class="num"><input type="number" step="0.01" class="perf-cell" v-model.number="member.tripleHours" /></td>
            <td class="num muted">{{ rowByMember.get(member.id)?.result.actualHours.toFixed(2) || '0.00' }} h</td>
            <td class="num total">¥ {{ money(rowByMember.get(member.id)?.result.total || 0) }}</td>
            <td class="act">
              <button class="perf-del reset" :aria-label="`重置 ${member.name || '这个人'} 的数据`" title="重置他的数据（保留姓名/邮箱/队列归属）" @click="resetMemberData(member.id)">↺</button>
              <button class="perf-del" :aria-label="`删除 ${member.name || '这个人'}`" title="从名单里删掉这个人" @click="removeMember(member.id)">×</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="perf-overview-bar">
      <label class="perf-inline-label">把所有人的月要求工时统一设为
        <input type="number" step="0.01" class="perf-cell inline" v-model="promptRef" />
      </label>
      <button class="perf-btn" @click="applyHoursToAll">应用</button>
    </div>
  </section>
</template>
