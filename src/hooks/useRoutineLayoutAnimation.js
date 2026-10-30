import { useLayoutEffect, useRef } from 'react'

// Capture layout immediately before committing a routine activation.
export function useRoutineLayoutAnimation(activeRoutineId) {
  const selector = useRef(null)
  const previousLayout = useRef(null)
  useLayoutEffect(() => {
    const before = previousLayout.current
    previousLayout.current = null
    const root = selector.current
    const reducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.reduceMotion === 'true'
    if (!before || !root?.animate || reducedMotion) return
    // Read the final layout before animating either the buttons or their children.
    const items = [...root.querySelectorAll(':scope > [data-layout-id]')].map((button) => ({
      button,
      rect: button.getBoundingClientRect(),
      name: button.querySelector('.routine-label'),
      nameRect: button.querySelector('.routine-label')?.getBoundingClientRect(),
      badge: button.querySelector('.routine-active-badge'),
      badgeRect: button.querySelector('.routine-active-badge')?.getBoundingClientRect(),
    }))
    const height = root.getBoundingClientRect().height
    const timing = { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' }
    const animations = []
    const animate = (element, frames) => animations.push(element.animate(frames, timing))
    for (const item of items) {
      const from = before.buttons.get(item.button.dataset.layoutId)
      const to = item.rect
      if (!from || !to.width || !to.height) continue
      const sx = from.rect.width / to.width
      const sy = from.rect.height / to.height
      animate(item.button, [
        {
          transform: `translate(${from.rect.left - to.left}px, ${from.rect.top - to.top}px) scale(${sx}, ${sy})`,
        },
        { transform: 'translate(0, 0) scale(1)' },
      ])
      // Counter the parent's scale so labels and the travelling badge stay readable.
      const animateChild = (element, start, end, fade = false) => {
        if (!element || !start || !end?.width || !end.height) return
        const x = (start.left - from.rect.left) / sx - (end.left - to.left)
        const y = (start.top - from.rect.top) / sy - (end.top - to.top)
        animate(element, [
          {
            transform: `translate(${x}px, ${y}px) scale(${start.width / end.width / sx}, ${start.height / end.height / sy})`,
            opacity: fade ? 0.75 : 1,
          },
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        ])
      }
      animateChild(item.name, from.nameRect, item.nameRect)
      animateChild(item.badge, before.badgeRect, item.badgeRect, true)
    }
    if (before.height !== height)
      animate(root, [{ height: `${before.height}px` }, { height: `${height}px` }])
    return () => animations.forEach((animation) => animation.cancel())
  }, [activeRoutineId])
  const captureLayout = () => {
    const root = selector.current
    if (!root) return
    previousLayout.current = {
      height: root.getBoundingClientRect().height,
      badgeRect: root.querySelector('.routine-active-badge')?.getBoundingClientRect(),
      buttons: new Map(
        [...root.querySelectorAll(':scope > [data-layout-id]')].map((button) => [
          button.dataset.layoutId,
          {
            rect: button.getBoundingClientRect(),
            nameRect: button.querySelector('.routine-label')?.getBoundingClientRect(),
          },
        ]),
      ),
    }
  }
  return { selector, captureLayout }
}
