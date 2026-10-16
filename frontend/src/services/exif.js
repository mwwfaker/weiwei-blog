/**
 * 读照片的拍摄信息（EXIF）。
 *
 * 为什么只取前面一段：EXIF 在 JPEG 头部，而一张手机照片动辄 5–10 MB。
 * 为了显示「f/1.8 1/120s ISO 100」去把整张图再下一遍不值得，所以用 Range 只取前 256 KB。
 * 取不到（服务器不支持 Range、或照片来自社交平台被抹掉元数据）就返回空 —— 这是常态，
 * 不是错误：微信、微博、Unsplash 都会把 EXIF 剥掉。
 */
import exifr from 'exifr'

/** 只取前 256 KB。够覆盖 EXIF + XMP，又不至于把整张照片拉下来。 */
const HEAD_BYTES = 256 * 1024

const round = (value, digits = 1) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Number(n.toFixed(digits))
}

/** 快门时间：1/120 比 0.008333 好读。 */
function formatShutter(seconds) {
  const s = Number(seconds)
  if (!Number.isFinite(s) || s <= 0) return ''
  if (s >= 1) return `${round(s, 1)}s`
  return `1/${Math.round(1 / s)}s`
}

function formatSize(width, height) {
  if (!width || !height) return ''
  const mp = (width * height) / 1_000_000
  return `${width} × ${height}（${mp >= 1 ? `${round(mp, 1)} MP` : '小图'}）`
}

/**
 * @param {string} url 图片地址（对象存储的签名链接）
 * @returns {Promise<Array<{label:string,value:string,href?:string}>>} 可以直接铺成一行行的键值对
 */
export async function readPhotoExif(url) {
  if (!url) return []
  let buffer
  try {
    const response = await fetch(url, { headers: { Range: `bytes=0-${HEAD_BYTES - 1}` } })
    if (!response.ok && response.status !== 206) return []
    buffer = await response.arrayBuffer()
  } catch {
    return []
  }

  let data = null
  try {
    data = await exifr.parse(buffer, { tiff: true, exif: true, gps: true, ifd0: true, interop: false, makerNote: false, userComment: false })
  } catch {
    return []
  }
  if (!data) return []

  const rows = []
  const push = (label, value, href) => { if (value) rows.push({ label, value: String(value), href }) }

  const camera = [data.Make, data.Model].filter(Boolean).join(' ').trim()
  push('相机', camera)
  push('镜头', data.LensModel || data.Lens)
  const exposure = [
    data.FNumber ? `f/${round(data.FNumber, 1)}` : '',
    formatShutter(data.ExposureTime),
    data.ISO ? `ISO ${data.ISO}` : '',
  ].filter(Boolean).join(' · ')
  push('参数', exposure)
  push('焦距', data.FocalLength ? `${round(data.FocalLength)} mm` : '')
  push('拍摄时间', data.DateTimeOriginal ? new Date(data.DateTimeOriginal).toLocaleString('zh-CN', { hour12: false }) : '')
  push('尺寸', formatSize(data.ExifImageWidth || data.ImageWidth, data.ExifImageHeight || data.ImageHeight))
  push('软件', data.Software || data.ProcessingSoftware)

  if (Number.isFinite(data.latitude) && Number.isFinite(data.longitude)) {
    push('位置', `${round(data.latitude, 5)}, ${round(data.longitude, 5)}`,
      `https://www.openstreetmap.org/?mlat=${round(data.latitude, 5)}&mlon=${round(data.longitude, 5)}#map=15/${round(data.latitude, 5)}/${round(data.longitude, 5)}`)
  }
  return rows
}
