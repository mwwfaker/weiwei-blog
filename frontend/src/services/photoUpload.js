/**
 * 上传照片时的两件「本机预处理」：读拍摄信息、生成缩略图。
 *
 * 为什么在上传前做：
 *   · **拍摄时间/地点**在文件里（EXIF），文件一旦传上去，再想读就得把图下回来 —— 本机读是免费的。
 *   · **缩略图**必须在这里生成：网格里现在加载的是原图，一张手机照片 3–5 MB，二十张的相册
 *     一次要下上百 MB。上传时顺手做一张 ~30 KB 的小图，相册打开会快一个数量级。
 *
 * 这是**浏览器专属**的（`createImageBitmap` / canvas / File），别拿它进对拍脚本。
 * 读不出来一律返回 null —— 截图、社交平台保存的图本来就没有 EXIF，这是常态不是错误。
 */
import exifr from 'exifr'

/** 缩略图长边。640 够铺满网格里的卡片，也够相册盒子的四宫格。 */
const THUMB_MAX = 640
/** WebP 在这个质量下，640px 的照片通常 25–45 KB。 */
const THUMB_QUALITY = 0.72

const round = (value, digits = 6) => (Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null)

/**
 * 读出拍摄时间与地点。
 * @param {File|Blob} file
 * @returns {Promise<{takenAt:string|null, latitude:number|null, longitude:number|null}>}
 */
export async function readPhotoMeta(file) {
  const empty = { takenAt: null, latitude: null, longitude: null }
  if (!file) return empty
  let data = null
  try {
    data = await exifr.parse(file, { tiff: true, exif: true, gps: true, ifd0: true, interop: false, makerNote: false })
  } catch {
    return empty
  }
  if (!data) return empty
  const when = data.DateTimeOriginal || data.CreateDate || data.ModifyDate
  return {
    takenAt: when ? new Date(when).toISOString() : null,
    latitude: round(data.latitude),
    longitude: round(data.longitude),
  }
}

/**
 * 生成缩略图。浏览器不支持 WebP 时会拿到 PNG（大一些，但能用）。
 * @param {File|Blob} file
 * @returns {Promise<Blob|null>}
 */
export async function makeThumbnail(file) {
  if (!file || typeof createImageBitmap !== 'function') return null
  let bitmap = null
  try {
    bitmap = await createImageBitmap(file)
    const scale = Math.min(1, THUMB_MAX / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    context.drawImage(bitmap, 0, 0, width, height)
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob || null), 'image/webp', THUMB_QUALITY)
    })
  } catch {
    // 生成失败就当作没有缩略图：前端会回退到原图，功能不受影响。
    return null
  } finally {
    bitmap?.close?.()
  }
}
