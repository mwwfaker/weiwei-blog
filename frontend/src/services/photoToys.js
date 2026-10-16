/**
 * 照片的小玩具：马赛克拼图、字符画。
 *
 * 都是「一张图进 → 一张图（或一段文本）出」的纯计算，所以放 services ——
 * 组件只负责摆界面和下载。
 *
 * **为什么不用现成的库**：这些效果本身只有几十行，而引一个库就要多一个境外 CDN、
 * 多一份维护；更要紧的是它们都得读像素，跨域图片会让画布"被污染"——自己写反而好控制。
 * 画布读取失败（跨域且对方没给 CORS 头）时返回 null，由调用方说一句"这张读不了"。
 */

/** 把图片画到指定尺寸的小画布上，读回像素。读不到就返回 null。 */
function samplePixels(image, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, width, height)
  try {
    return { data: context.getImageData(0, 0, width, height).data, width, height }
  } catch {
    return null // 画布被跨域图片污染 —— 这张没有玩具，但不影响看图
  }
}

/** 加载一张图（带 crossOrigin，否则画布会被污染）。 */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片没加载出来'))
    image.src = url
  })
}

/** 一张图的平均色（把图缩到 12×12 求平均）。 */
function averageColor(image) {
  const sample = samplePixels(image, 12, 12)
  if (!sample) return null
  let r = 0; let g = 0; let b = 0
  const count = sample.data.length / 4
  for (let i = 0; i < sample.data.length; i += 4) {
    r += sample.data[i]; g += sample.data[i + 1]; b += sample.data[i + 2]
  }
  return { r: r / count, g: g / count, b: b / count }
}

/* ------------------------------------------------------------------ 马赛克拼图 */

/**
 * 用一堆小图拼出目标照片。
 *
 * 做法：把目标缩到"格子数"大小 → 每个格子从素材里挑平均色最接近的那张画上去 →
 * 再在整张图上叠一层目标原图的半透明拷贝（`multiply`）。
 * 最后这层是关键：不叠的话整张会糊成色块，叠了才"既看得出原图、又看得出每张是什么"。
 *
 * @param {HTMLImageElement} image 目标照片
 * @param {Array<{image: HTMLImageElement, color: object}>} tiles 素材（已算好平均色）
 * @param {number} cols 横向格子数
 * @returns {HTMLCanvasElement|null}
 */
export function composeMosaic(image, tiles, cols = 48) {
  if (!image || !tiles?.length) return null
  const ratio = image.naturalHeight / image.naturalWidth
  const rows = Math.max(1, Math.round(cols * ratio))
  const cell = 26 // 每个格子的绘制尺寸（像素）
  const width = cols * cell
  const height = rows * cell

  const small = samplePixels(image, cols, rows)
  if (!small) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const offset = (row * cols + col) * 4
      const target = { r: small.data[offset], g: small.data[offset + 1], b: small.data[offset + 2] }
      // 挑平均色最近的一张（按人眼权重：绿最敏感、蓝最不敏感）
      let best = tiles[0]
      let bestScore = Infinity
      for (const tile of tiles) {
        if (!tile.color) continue
        const dr = (tile.color.r - target.r) * 0.9
        const dg = (tile.color.g - target.g) * 1.2
        const db = (tile.color.b - target.b) * 0.7
        const score = dr * dr + dg * dg + db * db
        if (score < bestScore) { bestScore = score; best = tile }
      }
      context.drawImage(best.image, col * cell, row * cell, cell, cell)
      // 每格再压一层目标色（multiply，低透明度）：只靠最后那层整体叠加，
      // 素材少的时候整张会糊成"两种纹理的棋盘"；逐格校色之后轮廓才清楚。
      context.globalCompositeOperation = 'multiply'
      context.globalAlpha = 0.42
      context.fillStyle = `rgb(${target.r | 0},${target.g | 0},${target.b | 0})`
      context.fillRect(col * cell, row * cell, cell, cell)
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
    }
  }

  // 再叠一层原图，把整体明暗与细节找回来
  context.globalAlpha = 0.28
  context.globalCompositeOperation = 'multiply'
  context.drawImage(image, 0, 0, width, height)
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
  return canvas
}

/** 批量算素材的平均色（并行，每张很小，几十毫秒）。 */
export async function prepareTiles(urls) {
  const loaded = await Promise.all(urls.map(async (url) => {
    try {
      const image = await loadImage(url)
      const color = averageColor(image)
      return color ? { image, color } : null
    } catch {
      return null
    }
  }))
  return loaded.filter(Boolean)
}

/* ------------------------------------------------------------------ 字符画 */

/** 从暗到亮的字符表（用起来比 "#@%*+=-:." 更有层次）。 */
const RAMP = ' .:-=+*#%@'

/**
 * 把照片变成字符画。
 *
 * **宽高比要补偿**：等宽字符的高度约是宽度的 2 倍，直接按像素行列映射会拉长一倍，
 * 所以纵向按 0.5 采样 —— 这一步不做，出来的脸都是长的。
 *
 * @returns {string|null} 可以直接显示的文本
 */
export function toAscii(image, cols = 110) {
  if (!image) return null
  const ratio = image.naturalHeight / image.naturalWidth
  const rows = Math.max(1, Math.round(cols * ratio * 0.5))
  const sample = samplePixels(image, cols, rows)
  if (!sample) return null

  const lines = []
  for (let row = 0; row < rows; row += 1) {
    let line = ''
    for (let col = 0; col < cols; col += 1) {
      const offset = (row * cols + col) * 4
      // 亮度用感知权重；alpha 为 0 的地方当白色（透明背景多半是白底）
      const alpha = sample.data[offset + 3] / 255
      const luma = (sample.data[offset] * 0.299 + sample.data[offset + 1] * 0.587 + sample.data[offset + 2] * 0.114) / 255
      const value = alpha < 0.5 ? 1 : luma
      line += RAMP[Math.min(RAMP.length - 1, Math.round((1 - value) * (RAMP.length - 1)))]
    }
    lines.push(line.replace(/\s+$/, '')) // 行尾空格留着会让复制出来的东西很难看
  }
  return lines.join('\n')
}

/** canvas / 文本 → Blob，交给组件去触发下载。 */
export function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality))
}
