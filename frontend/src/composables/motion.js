// Motion helpers shared by the page shell and the study section.
//
// `vReveal` adds the hidden state from JavaScript rather than from CSS, so if the script never runs
// the content stays visible instead of being stuck at opacity 0.
import { onMounted, onUnmounted, ref } from 'vue'

const REVEAL_CLASS = 'reveal'
const VISIBLE_CLASS = 'is-visible'

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const vReveal = {
  mounted(el, binding) {
    const options = binding.value || {}
    // No IntersectionObserver (or the user asked for less motion): show immediately.
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      el.classList.add(REVEAL_CLASS, VISIBLE_CLASS)
      return
    }
    el.classList.add(REVEAL_CLASS)
    if (options.delay) el.style.setProperty('--reveal-delay', `${options.delay}ms`)
    if (options.variant) el.dataset.revealVariant = options.variant

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add(VISIBLE_CLASS)
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 })

    observer.observe(el)
    el.__revealObserver = observer
  },
  unmounted(el) {
    el.__revealObserver?.disconnect()
    delete el.__revealObserver
  },
}

/**
 * Animates a number from 0 to `target` once `start` becomes true. Uses requestAnimationFrame, and
 * falls back to the final value when the API is unavailable.
 */
export function useCountUp(target, { duration = 1100, start = ref(true) } = {}) {
  const resolve = () => (typeof target === 'function' ? Number(target()) || 0 : Number(target) || 0)
  // Starts at the real value so a non-animated render (SSR, render tests) and any failure to get a
  // frame never shows a wrong number; onMounted resets it to 0 and animates up.
  const value = ref(resolve())
  let frame = 0

  const run = () => {
    const end = resolve()
    if (typeof requestAnimationFrame === 'undefined') { value.value = end; return }
    const started = performance.now()
    const step = (now) => {
      const progress = Math.min(1, (now - started) / duration)
      // easeOutCubic
      const eased = 1 - (1 - progress) ** 3
      value.value = Math.round(end * eased)
      if (progress < 1) frame = requestAnimationFrame(step)
      else value.value = end
    }
    value.value = 0
    frame = requestAnimationFrame(step)
  }

  onMounted(() => { if (start.value) run() })
  onUnmounted(() => { if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(frame) })

  return { value, run }
}

export const motion = { vReveal, useCountUp, prefersReducedMotion }
