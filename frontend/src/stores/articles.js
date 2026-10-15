import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { request, uploadMedia } from '@/services/api'
import { importProblem, splitArticleBlocks, blocksFromText, DEFAULT_IMPORT_TAGS, detectDocumentFormat, sniffProtectedStub } from '@/services/articleImport'
import { useImportAlert } from '@/composables/useImportAlert'
import { useBulkImport } from '@/composables/useBulkImport'
import mammoth from 'mammoth/mammoth.browser'
import { isLocalId, localId } from '@/app/ids'
import { notify } from '@/app/useToast'
import { requireLogin } from '@/app/useGuard'
import { readStoredJson, writeStoredJson } from '@/services/storage'
import { demoArticles } from '@/data/seed'
import { useAuthStore } from './auth'
import { useMediaStore } from './media'

const STORAGE_KEY = 'weiwei-blog-articles-v1'

/**
 * 文章。
 *
 * 读的策略：公开列表对所有人一致，登录后再叠上自己账号里的全部文章（含私密）。
 * `mine` 决定这篇能不能编辑/删除——公开列表里也有别人的文章，没有它就会在别人的文章上
 * 出现编辑按钮。
 *
 * 本机草稿（旧版本在未登录时写的）不再自动上传：它们只留在当前浏览器，
 * 想看就点开、按「保存文章」手动发到自己的账号，不会再悄悄进到之后登录的那个账号里。
 *
 * 阅读弹窗、编辑弹窗的状态也放在这里，因为「打开文章」这个动作来自首页、归档页、
 * 文章页三处，弹窗本身挂在应用外壳上。
 */
export const useArticlesStore = defineStore('articles', () => {
  const auth = useAuthStore()
  const media = useMediaStore()
  /** 文件打不开时的提示窗（全站共用一个，见 composables/useImportAlert.js）。 */
  const { raise } = useImportAlert()

  const articles = ref(readStoredJson(STORAGE_KEY, null) || demoArticles)
  watch(articles, (value) => writeStoredJson(STORAGE_KEY, value), { deep: true })

  const categoryFilter = ref('')
  const tagFilter = ref('')
  // 文章页自己的搜索词。原来和日记页共用同一个 ref，在文章页搜「海边」再切到日记页
  // 会发现筛选条件还留着——两个页面的搜索本来就是两回事。
  const search = ref('')

  const selectedArticle = ref(null)
  const articleDialog = ref(false)
  const articleDraft = ref(emptyDraft())

  /**
   * 批量导入文章。流程和日记导入**共用** composables/useBulkImport.js，
   * 解析规则在 services/articleImport.js（纯函数，能离线对拍）。
   *
   * 和日记不同的两点：文章没有「日期头」这种天然分界，靠**文档里最浅那一级标题**切；
   * 另外文章多了分类和标签，所以统一设置里也多这两项。
   */
  const bulkImport = useBulkImport({
    label: '导入文章',
    doneMessage: (count) => `已导入 ${count} 篇文章`,
    save: async (entry) => {
      const saved = await request('/api/articles', {
        token: auth.token,
        method: 'POST',
        body: JSON.stringify(articlePayload({
          ...entry,
          visibility: entry.visibility || bulkImport.visibility.value,
          tags: entry.tags || DEFAULT_IMPORT_TAGS,
        })),
      })
      return { ...mapArticle(saved), mine: true }
    },
  })
  const {
    review: importReview, dialog: importDialog, visibility: importVisibility,
    importing, saved: importSaved,
  } = bulkImport
  /** 统一分类 / 统一标签：一次写进所有草稿，之后可以逐条改。 */
  const importCategory = ref('日常片段')
  const importTags = ref([...DEFAULT_IMPORT_TAGS])

  const categoryNames = computed(() => [...new Set(articles.value.map((article) => article.category))])
  const tagNames = computed(() => [...new Set(articles.value.flatMap((article) => article.tags || []))])
  const visibleArticles = computed(() => articles.value.filter((article) => (!categoryFilter.value || article.category === categoryFilter.value)
    && (!tagFilter.value || article.tags?.includes(tagFilter.value))))

  // coverUrl holds either an absolute image URL or a `media:<id>` reference into this account's media
  // library. A reference is used on purpose: media links are short-lived signed URLs, so persisting
  // the link itself would expire. `mapArticle` reads the same field back. A data: URL only exists in
  // the signed-out preview and can run to hundreds of KB against a 1000-char column, so it is dropped.
  function articlePayload(article) {
    const cover = String(article.image || '')
    return {
      title: article.title,
      category: article.category,
      visibility: article.visibility || 'PUBLIC',
      tags: (article.tags || []).join(','),
      excerpt: article.excerpt || '',
      content: article.content || article.excerpt || '',
      coverUrl: cover.startsWith('data:') ? '' : cover,
      articleDate: String(article.date || new Date().toISOString().slice(0, 10)).replaceAll('.', '-'),
    }
  }

  function mapArticle(article) {
    return {
      id: article.id,
      title: article.title,
      category: article.category,
      visibility: article.visibility,
      tags: article.tags ? article.tags.split(/[，,\s]+/).filter(Boolean) : [],
      excerpt: article.excerpt,
      content: article.content,
      image: article.coverUrl || '',
      date: article.articleDate?.replaceAll('-', '.'),
      read: '文章',
    }
  }

  /** 封面既可能是绝对地址，也可能是 `media:<id>` 引用；解析成当前有效的地址。 */
  function articleImage(article) {
    return media.mediaImage(article.image)
  }

  // The date input is type="date", which requires YYYY-MM-DD; articles are displayed as YYYY.MM.DD.
  function toIsoDate(value) {
    return String(value || new Date().toISOString().slice(0, 10)).replaceAll('.', '-')
  }

  function emptyDraft() {
    return { id: null, title: '', date: new Date().toISOString().slice(0, 10), category: '日常片段', tags: '日常', excerpt: '', content: '', image: '', visibility: 'PUBLIC' }
  }

  async function refresh() {
    let own = null
    if (auth.isLoggedIn) {
      try { own = (await request('/api/articles', { token: auth.token })).map((article) => ({ ...mapArticle(article), mine: true })) }
      catch (error) { notify(`自己的文章读取失败：${error.message}`) }
    } else {
      own = [] // 没登录就没有「自己的文章」，公开文章在下面同一份列表里
    }
    try {
      const publicArticles = (await request('/api/public/articles')).map((article) => ({ ...mapArticle(article), mine: false }))
      const localDrafts = articles.value.filter((article) => isLocalId(article.id)).map((article) => ({ ...article, mine: false, local: true }))
      const ownIds = new Set((own || []).map((article) => article.id))
      // 自己的记录优先：同 id 的公开条目丢掉，避免同一篇文章出现两次。
      articles.value = own === null
        ? [...localDrafts, ...publicArticles]
        : [...localDrafts, ...own, ...publicArticles.filter((article) => !ownIds.has(article.id))]
    } catch { /* 接口不可达时保留本机内容，本机预览照常可用。 */ }
  }

  function open(article) {
    selectedArticle.value = article
  }

  function create() {
    if (!requireLogin('写文章')) return
    articleDraft.value = emptyDraft()
    articleDialog.value = true
  }

  function edit(article) {
    if (!requireLogin('编辑文章')) return
    if (!article.mine) return notify('这不是你自己的文章，只能阅读')
    articleDraft.value = { ...article, date: toIsoDate(article.date), tags: (article.tags || []).join('，') }
    selectedArticle.value = null
    articleDialog.value = true
  }

  async function chooseCover(file) {
    if (!file) return
    if (!requireLogin('上传封面')) return
    try {
      const uploaded = await uploadMedia(file, auth.token)
      const saved = await request('/api/media', {
        token: auth.token,
        method: 'POST',
        body: JSON.stringify({
          kind: 'IMAGE',
          title: `${articleDraft.value.title || '文章'}封面`,
          objectKey: uploaded.key,
          contentType: uploaded.contentType,
          visibility: articleDraft.value.visibility || 'PUBLIC',
          albumName: '文章封面',
        }),
      })
      media.galleryItems.unshift({ ...media.mapMedia(saved), mine: true })
      articleDraft.value.image = `media:${saved.id}`
    } catch (error) { notify(`封面上传失败：${error.message}`) }
  }

  async function save() {
    if (!requireLogin('保存文章')) return
    if (!articleDraft.value.title.trim() || !articleDraft.value.content.trim()) return notify('请填写文章标题和正文')
    const record = {
      ...articleDraft.value,
      id: articleDraft.value.id || localId(),
      tags: String(articleDraft.value.tags || '').split(/[，,\s]+/).filter(Boolean),
      read: '新文章',
    }
    let index = articles.value.findIndex((item) => item.id === record.id)
    // 本机草稿（旧版本留下的）在服务器上没有对应记录，要 POST 而不是 PUT 一个不存在的路径。
    const isUpdate = !isLocalId(articleDraft.value.id) && Boolean(articleDraft.value.id)
    try {
      // 封面被复用成公开文章的一部分时，它自己也得是公开的，否则读者会看到裂图。
      const coverId = /^media:(\d+)$/.exec(record.image || '')?.[1]
      const cover = coverId ? media.galleryItems.find((item) => String(item.id) === coverId) : null
      if (cover && cover.mine && cover.visibility !== record.visibility) {
        const updatedCover = await request(`/api/media/${cover.id}`, {
          token: auth.token,
          method: 'PUT',
          body: JSON.stringify({ visibility: record.visibility, title: cover.caption, albumName: cover.albumName }),
        })
        Object.assign(cover, media.mapMedia(updatedCover))
      }
      const saved = await request(isUpdate ? `/api/articles/${articleDraft.value.id}` : '/api/articles', {
        token: auth.token,
        method: isUpdate ? 'PUT' : 'POST',
        body: JSON.stringify(articlePayload(record)),
      })
      Object.assign(record, mapArticle(saved), { mine: true })
      index = articles.value.findIndex((item) => item.id === record.id)
    } catch (error) { return notify(`文章未保存：${error.message}`) }
    if (index >= 0) articles.value[index] = record
    else articles.value.unshift(record)
    articleDialog.value = false
    notify(index >= 0 ? '文章已保存到数据库' : '文章已发布到数据库')
  }

  async function remove(id) {
    const article = articles.value.find((item) => item.id === id)
    if (!article?.mine) return notify('这不是你自己的文章，只能阅读')
    if (!isLocalId(id)) {
      try { await request(`/api/articles/${id}`, { token: auth.token, method: 'DELETE' }) }
      catch (error) { return notify(`文章未删除：${error.message}`) }
    }
    articles.value = articles.value.filter((item) => item.id !== id)
    selectedArticle.value = null
    notify('文章已删除')
  }

  /**
   * Word 导出的 HTML → 块。
   *
   * 这一步必须留在浏览器侧（DOMParser 在 Node 里没有），所以 services/articleImport.js
   * 只收块、不碰 HTML——那样它才能被离线自检脚本直接 import。
   *
   * 只扫 body 的**直接子元素**，不递归 querySelectorAll：`<blockquote><p>…</p></blockquote>`
   * 这类嵌套会让同一段文字被数两次，导进去就是重复段落。
   */
  function blocksFromHtml(html) {
    if (typeof DOMParser === 'undefined') return []
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
    const blocks = []
    /**
     * 取文本时**保留换行**：
     *   · `<br>` 要变成 \n——Word 里用 Shift+Enter 断行很常见，丢掉它目录会被挤成一行；
     *   · 空白只压空格和制表符，**不能把 \n 也压掉**（`\s+` 会），否则上一条白做。
     */
    const textOf = (element) => {
      const clone = element.cloneNode(true)
      for (const br of clone.querySelectorAll('br')) br.replaceWith('\n')
      return clone.textContent
    }
    const push = (text, headingLevel) => {
      const clean = String(text || '').replace(/[^\S\n]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
      if (!clean) return
      if (headingLevel) blocks.push({ type: 'heading', level: headingLevel, text: clean })
      else blocks.push({ type: 'paragraph', text: clean })
    }
    for (const element of doc.body.children) {
      const tag = element.tagName
      const heading = /^H([1-6])$/.exec(tag)
      if (heading) { push(textOf(element), Number(heading[1])); continue }
      if (tag === 'UL' || tag === 'OL') {
        for (const item of element.children) push(textOf(item))
        continue
      }
      if (tag === 'TABLE') {
        for (const row of element.querySelectorAll('tr')) {
          const cells = [...row.children].map((cell) => textOf(cell).replace(/\s+/g, ' ').trim()).filter(Boolean)
          if (cells.length) push(cells.join('　'))
        }
        continue
      }
      push(textOf(element))
    }
    return blocks
  }

  /**
   * 解析 .docx / .txt / .md 为待确认的文章草稿，真正入库在 confirmImport。
   * 返回条数；0 表示没读到内容（提示已经发出去）。
   */
  async function parseImportFiles(files) {
    if (!requireLogin('导入文章')) return 0
    const drafts = []
    for (const file of files) {
      try {
        const extension = file.name.toLowerCase().split('.').pop()
        const fallbackTitle = file.name.replace(/\.(txt|md|docx)$/i, '')
        let blocks = []
        if (extension === 'docx') {
          const buffer = await file.arrayBuffer()
          const bytes = new Uint8Array(buffer)
          // 先认 WPS 私密文档，再认文件头。顺序不能反：这种文件同时也是老式 .doc，
          // 先报「另存为 .docx」的话，用户照做正好会把加密正文毁掉。
          // 这两种情况都弹提示窗说清「为什么 + 怎么办」，不是一闪而过的 toast。
          if (sniffProtectedStub(bytes)) { raise(importProblem('protected-stub', file.name)); continue }
          const format = detectDocumentFormat(bytes.subarray(0, 8))
          if (format !== 'docx') { raise(importProblem(format, file.name)); continue }
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
          blocks = blocksFromHtml(result.value)
        } else if (extension === 'txt' || extension === 'md' || extension === 'markdown') {
          blocks = blocksFromText(await file.text())
        } else { notify(`已跳过不支持的文件：${file.name}`); continue }
        for (const article of splitArticleBlocks(blocks, fallbackTitle)) {
          drafts.push({
            ...article,
            id: localId(),
            date: new Date().toISOString().slice(0, 10),
            category: importCategory.value || '日常片段',
            tags: [...importTags.value],
            visibility: importVisibility.value,
            image: '',
            source: file.name,
          })
        }
      } catch (error) { raise(importProblem('unreadable', file.name, error)) }
    }
    if (!drafts.length) { notify('没有读到内容。请选择 DOCX、TXT 或 Markdown 文件'); return 0 }
    bulkImport.setReview(drafts)
    return drafts.length
  }

  /** 统一设置三项：可见范围、分类、标签。一次写进所有草稿，之后再逐条微调。 */
  const applyImportVisibility = (value) => bulkImport.applyVisibility(value)
  const applyImportCategory = (value) => { importCategory.value = value; bulkImport.applyField('category', value) }
  const applyImportTags = (value) => { importTags.value = [...value]; bulkImport.applyField('tags', [...value]) }
  const dropImportDraft = (id) => bulkImport.drop(id)
  const toggleImportVisibility = (entry) => bulkImport.toggleVisibility(entry)

  async function confirmImport() {
    const { saved } = await bulkImport.confirm()
    if (saved.length) articles.value = [...saved, ...articles.value]
  }

  return {
    articles, categoryFilter, tagFilter, search, selectedArticle, articleDialog, articleDraft,
    importReview, importDialog, importVisibility, importCategory, importTags, importing, importSaved,
    categoryNames, tagNames, visibleArticles,
    articlePayload, mapArticle, articleImage, emptyDraft,
    refresh, open, create, edit, save, remove, chooseCover,
    parseImportFiles, applyImportVisibility, applyImportCategory, applyImportTags,
    dropImportDraft, toggleImportVisibility, confirmImport,
  }
})
