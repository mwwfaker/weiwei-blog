const STORAGE_KEY = 'weiwei.clipboard.workspace.v1'

const makeId = () => globalThis.crypto?.randomUUID?.()
  ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`

export function createClipboardWorkspace() {
  const now = new Date().toISOString()
  return {
    activeSheetId: 'common',
    sheets: [
      { id: 'common', name: '常用', createdAt: now },
      { id: 'work', name: '工作', createdAt: now },
      { id: 'life', name: '生活', createdAt: now },
    ],
    cards: [],
  }
}

export function readClipboardWorkspace() {
  const initial = createClipboardWorkspace()
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!value || !Array.isArray(value.sheets) || !Array.isArray(value.cards)) return initial
    const sheets = value.sheets.filter((sheet) => sheet && typeof sheet.id === 'string' && typeof sheet.name === 'string')
    if (!sheets.length) return initial
    return {
      activeSheetId: sheets.some((sheet) => sheet.id === value.activeSheetId) ? value.activeSheetId : sheets[0].id,
      sheets,
      cards: value.cards.filter((card) => card && typeof card.id === 'string' && Array.isArray(card.values))
        .map((card, index) => ({
          ...card,
          position: Number.isFinite(card.position) ? card.position : index,
          values: card.values.filter((item) => typeof item === 'string'),
        })),
    }
  } catch {
    return initial
  }
}

export function writeClipboardWorkspace(workspace) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
}

export function createClipboardId() {
  return makeId()
}
