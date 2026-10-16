/**
 * 浏览器端深度估计：Depth Anything V2 small（ONNX）**跑在访客自己的电脑上**。
 *
 * 为什么放在浏览器里而不是服务器：这个项目是纯静态站（GitHub Pages + Supabase），
 * 没有能跑 Python/GPU 的后端。放浏览器里意味着零服务器成本、照片不出本机。
 * 代价是一次性下载模型（量化版 18~26 MB，之后走浏览器缓存）。
 *
 * 和 `services/` 的区别：这里不做接口调用，只做「画布进 → 深度图出」的计算，
 * 但计算本身依赖浏览器（WASM / WebGPU），所以跟着 media 模块走而不是 services。
 *
 * ⚠️ 踩过的坑（别再踩第二次）：**必须关掉 onnxruntime-web 的多线程**。
 * 线程版需要 SharedArrayBuffer，而站点没有发 COOP/COEP 响应头，此时推理会
 * **永远不返回、也不报错** —— 症状看起来像"模型太大跑不动"，实际是无声死锁。
 * 设 `numThreads = 1` + `proxy = false` 后立刻正常。
 */

const MODEL = 'onnx-community/depth-anything-v2-small'
/**
 * 模型从哪取。默认 HuggingFace；国内网络或想自托管时，用构建变量换掉：
 *   VITE_DEPTH_MODEL_HOST=https://hf-mirror.com
 *   VITE_DEPTH_MODEL_HOST=https://<项目>.supabase.co/storage/v1/object/public/weiwei-assets
 * （两种都要保持 `<host>/<model>/resolve/main/<文件>` 这种目录形状）
 */
const MODEL_HOST = String(import.meta.env?.VITE_DEPTH_MODEL_HOST || '').trim()

/** 模型按后端各缓存一份：第二张照片就不用再等下载了。 */
const pipelines = new Map()

const WASM_BACKEND = { device: 'wasm', dtype: 'quantized', label: 'WASM', size: '约 26 MB', note: '没有 WebGPU，用 CPU 算' }
const WEBGPU_BACKEND = { device: 'webgpu', dtype: 'q4f16', label: 'WebGPU', size: '约 18 MB', note: '用显卡算，很快' }

/**
 * 到底用哪个后端。
 *
 * **必须先自己问一次有没有可用的 GPU 适配器**，不能只看 `navigator.gpu` 是否存在：
 * 无头浏览器、老驱动、关掉硬件加速的机器上 `navigator.gpu` 照样存在，但适配器拿不到。
 * 而一旦让 onnxruntime 去试 WebGPU 并失败，**整个运行时会留在坏状态里**，
 * 之后连 WASM 都报 "no available backend found" —— 实测踩过，回退都救不回来。
 */
export async function pickDepthBackend() {
  if (typeof navigator !== 'undefined' && navigator.gpu?.requestAdapter) {
    try {
      const adapter = await navigator.gpu.requestAdapter()
      if (adapter) return WEBGPU_BACKEND
    } catch { /* 拿不到适配器就当没有 WebGPU */ }
  }
  return WASM_BACKEND
}

function getPipeline(backend, onProgress) {
  const key = `${backend.device}:${backend.dtype}`
  if (!pipelines.has(key)) {
    const promise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      const ort = env.backends?.onnx?.wasm
      if (ort) { ort.numThreads = 1; ort.proxy = false } // 见文件头：不关会静默挂死
      if (MODEL_HOST) {
        env.remoteHost = MODEL_HOST
        env.remotePathTemplate = '{model}/resolve/main/'
      }
      return pipeline('depth-estimation', MODEL, {
        device: backend.device,
        dtype: backend.dtype,
        progress_callback: onProgress,
      })
    })()
    // 失败就从缓存里摘掉：否则一次网络抖动会让这一页永久"加载不了"。
    promise.catch(() => pipelines.delete(key))
    pipelines.set(key, promise)
  }
  return pipelines.get(key)
}

/** 把模型的输出（RawImage）读成 0~1 的灰度数组，1 表示离镜头近。 */
function toGray(raw) {
  const { width, height, data } = raw
  const gray = new Float32Array(width * height)
  // depth-estimation 的输出是单通道（data.length === w*h）；万一换成 RGBA 也认。
  const stride = data.length === width * height ? 1 : 4
  for (let i = 0; i < gray.length; i += 1) gray[i] = data[i * stride] / 255
  return { width, height, gray }
}

async function runOn(backend, canvas, onProgress) {
  const pipe = await getPipeline(backend, onProgress)
  const result = await pipe(canvas)
  if (!result?.depth) throw new Error('深度模型没有返回结果')
  return { depth: toGray(result.depth), backend }
}

/**
 * 算一张画布的深度图。
 * @param {HTMLCanvasElement} canvas 已经画好像素的画布（必须 CORS 干净，否则读像素会抛错）
 * @param {(event:object)=>void} [onProgress] 模型下载进度回调
 * @returns {Promise<{depth:{width:number,height:number,gray:Float32Array},backend:object}>}
 */
export async function estimateDepth(canvas, onProgress) {
  const preferred = await pickDepthBackend()
  try {
    return await runOn(preferred, canvas, onProgress)
  } catch (error) {
    // 保险带：适配器探得到、真建会话时仍可能失败。这时退回 CPU 再试一次。
    // （注意：如果 WebGPU 已经把运行时搞坏了，这一步也救不回来 —— 所以真正的防线是上面的探测。）
    if (preferred.device === 'wasm') throw error
    return runOn(WASM_BACKEND, canvas, onProgress)
  }
}
