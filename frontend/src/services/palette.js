/**
 * 从照片里抽一组主色（配色板）。
 *
 * 做法是最朴素的「量化 + 计数 + 挑差异最大的几个」，**不引任何依赖**：
 * 把图画到 96×96，按每通道 4 bit 分桶（4096 个桶）数一遍，按出现次数排序，
 * 再贪心挑出彼此颜色距离够远的前 N 个。对"看着像什么颜色"这件事足够好，
 * 而且全是本机计算，不花流量也不上传。
 */

const SAMPLE = 96
const BUCKET_BITS = 4
const SHIFT = 8 - BUCKET_BITS

const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`

/**
 * @param {string} url 图片地址
 * @param {number} [count] 想要几个颜色
 * @returns {Promise<string[]>} 十六进制颜色，按"占画面多少"从多到少
 */
export async function extractPalette(url, count = 5) {
  if (!url) return []
  const image = new Image()
  // 不设这个的话画布会被标成"被污染"，后面 getImageData 直接抛错
  image.crossOrigin = 'anonymous'
  image.src = url
  try {
    await image.decode()
  } catch {
    return []
  }

  const size = SAMPLE
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, size, size)

  let pixels
  try {
    pixels = context.getImageData(0, 0, size, size).data
  } catch {
    return [] // 跨域且对方没给 CORS 头 —— 那就没有配色板，不影响看图
  }

  // 分桶计数。忽略几乎透明和过暗/过亮的像素：它们大多是阴影与高光，不代表"这张照片的颜色"。
  const buckets = new Map()
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 32) continue
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const key = ((r >> SHIFT) << (BUCKET_BITS * 2)) | ((g >> SHIFT) << BUCKET_BITS) | (b >> SHIFT)
    const hit = buckets.get(key)
    if (hit) { hit.n += 1; hit.r += r; hit.g += g; hit.b += b }
    else buckets.set(key, { n: 1, r, g, b })
  }
  if (!buckets.size) return []

  const candidates = [...buckets.values()]
    .map((bucket) => ({ r: bucket.r / bucket.n, g: bucket.g / bucket.n, b: bucket.b / bucket.n, n: bucket.n }))
    .sort((a, b) => b.n - a.n)

  const distance = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)
  const picked = []
  for (const color of candidates) {
    if (picked.every((chosen) => distance(chosen, color) > 70)) picked.push(color)
    if (picked.length >= count) break
  }
  // 颜色很少的图（比如纯色块）可能凑不够，用出现最多的补上
  for (const color of candidates) {
    if (picked.length >= count) break
    if (!picked.includes(color)) picked.push(color)
  }
  return picked.map((color) => toHex(color.r, color.g, color.b))
}
