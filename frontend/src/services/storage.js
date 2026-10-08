// Safe localStorage access. Storage is read during setup, so a single corrupt value would otherwise
// throw before mount and leave a blank page; and writes can exceed the quota because signed-out
// previews store images as data: URLs.
export function readStoredJson(key, fallback) {
  try {
    // Guarded so the module is still importable outside a browser (render tests, SSR).
    if (typeof localStorage === 'undefined') return fallback
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed == null ? fallback : parsed
  } catch {
    return fallback
  }
}

export function writeStoredJson(key, value) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota exceeded or storage blocked */
  }
}

export function readStoredText(key, fallback = '') {
  try {
    if (typeof localStorage === 'undefined') return fallback
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

export function writeStoredText(key, value) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, String(value))
  } catch {
    /* quota exceeded or storage blocked */
  }
}
