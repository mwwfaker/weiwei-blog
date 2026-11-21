<script setup>
// 唯唯公司搜寻：输入公司名 → 打开查询页 → 把三个字段粘进来 → 一键复制。
//
// 为什么是「打开页面 + 粘贴」而不是「输入即出结果」：
//   · 企业工商信息（类型 / 经营范围 / 地址）只有企查查、天眼查、爱企查、国家企业信用信息
//     公示系统这些地方有；前几家都要付费 key，公示系统有验证码。
//   · 站主要求零成本、每天上千条，那么唯一稳的路子就是「人肉过一次验证码 / 过一下页面」，
//     工具负责把「打开哪个平台、粘哪里、复制什么」做到最省事。
// 所以这里做三件事：多平台轮换打开、三个字段的粘贴框、点一下就复制。
import { computed, ref } from 'vue'
import { notify } from '@/app/useToast'

const name = ref('')
const companyType = ref('')
const scope = ref('')
const address = ref('')

/**
 * 查询入口。按「能用 + 不用登录」排的：
 *   1. 国家企业信用信息公示系统 —— 官方、最权威，但有验证码（站主可以手输）
 *   2. 爱企查 / 企查查 / 天眼查 —— 三家字段都全，轮流用可以避开单站限流
 */
const SOURCES = [
  { key: 'gsxt', label: '国家公示系统', url: (q) => `https://www.gsxt.gov.cn/index.html?keyword=${encodeURIComponent(q)}` },
  { key: 'aiqicha', label: '爱企查', url: (q) => `https://aiqicha.baidu.com/s?q=${encodeURIComponent(q)}` },
  { key: 'qcc', label: '企查查', url: (q) => `https://www.qcc.com/web/search?key=${encodeURIComponent(q)}` },
  { key: 'tianyancha', label: '天眼查', url: (q) => `https://www.tianyancha.com/search?key=${encodeURIComponent(q)}` },
]

const sourceIndex = ref(0)
const activeSource = computed(() => SOURCES[sourceIndex.value])

/** 打开当前平台；每按一次自动轮到下一家（站主要的多平台分摊限流）。 */
function search() {
  const q = name.value.trim()
  if (!q) return notify('先输入公司名称')
  window.open(activeSource.value.url(q), '_blank', 'noopener')
  sourceIndex.value = (sourceIndex.value + 1) % SOURCES.length
}

function pickSource(index) {
  sourceIndex.value = index
}

async function copy(text, label) {
  const value = String(text || '').trim()
  if (!value) return notify(`先填「${label}」`)
  try {
    await navigator.clipboard.writeText(value)
    notify(`${label} 已复制`)
  } catch {
    notify('浏览器不让复制，请手动选中（需要 HTTPS 或 localhost）')
  }
}

/** 三个字段一起清空，方便下一条。公司名保留还是清掉都行——这里一起清。 */
function reset() {
  name.value = ''
  companyType.value = ''
  scope.value = ''
  address.value = ''
}
</script>

<template>
  <section class="page-content inner-page company-page">
    <div class="company-head">
      <div class="section-kicker">COMPANY LOOKUP <span></span></div>
      <h1>唯唯公司搜寻<em>。</em></h1>
      <p>
        输入公司名称 → 打开查询页 → 把「类型 / 经营范围 / 地址」粘进下面三个框 → 点一下就复制。
        每次打开会自动轮到下一家平台，避免同一家限流。
      </p>
    </div>

    <div class="company-search">
      <input
        v-model="name"
        class="company-input"
        placeholder="公司名称，例如：杭州某某科技有限公司"
        maxlength="80"
        @keyup.enter="search"
      />
      <button class="button-primary" @click="search">查询 ↗</button>
    </div>

    <div class="company-sources">
      <button
        v-for="(item, index) in SOURCES"
        :key="item.key"
        class="company-source"
        :class="{ active: index === sourceIndex }"
        @click="pickSource(index)"
      >{{ item.label }}</button>
      <span class="company-source-hint">下一次按「查询」会打开：{{ activeSource.label }}</span>
    </div>

    <div class="company-fields">
      <div class="company-field">
        <label>公司类型 <button class="company-copy" @click="copy(companyType, '公司类型')">复制</button></label>
        <textarea v-model="companyType" rows="2" placeholder="粘到这里：有限责任公司 / 股份有限公司…"></textarea>
      </div>
      <div class="company-field">
        <label>经营范围 <button class="company-copy" @click="copy(scope, '经营范围')">复制</button></label>
        <textarea v-model="scope" rows="6" placeholder="粘到这里：一般项目／许可项目…"></textarea>
      </div>
      <div class="company-field">
        <label>公司地址 <button class="company-copy" @click="copy(address, '公司地址')">复制</button></label>
        <textarea v-model="address" rows="2" placeholder="粘到这里：省市区 + 详细地址"></textarea>
      </div>
    </div>

    <div class="company-actions">
      <button class="button-secondary" @click="reset">清空，查下一个</button>
      <span>当前公司：{{ name || '（未填）' }}</span>
    </div>
  </section>
</template>
