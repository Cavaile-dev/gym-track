import React, { useRef, useState, useLayoutEffect } from 'react'
import { TRANSITION_MS } from '../config.js'

function Transition({ transitionKey, className = '', order, resetScroll = false, children }) {
  const root = useRef(null)
  const previousChildren = useRef(children)
  const [scene, setScene] = useState({ key: transitionKey, id: 0, exiting: null, direction: 1 })

  // Keep the outgoing layer's identity so its components are not mounted twice.
  if (scene.key !== transitionKey) {
    setScene({
      key: transitionKey,
      id: scene.id + 1,
      exiting: { id: scene.id, children: previousChildren.current },
      direction: order && order.indexOf(transitionKey) < order.indexOf(scene.key) ? -1 : 1,
    })
  }

  useLayoutEffect(() => {
    if (!scene.exiting) return undefined
    if (resetScroll) window.scrollTo({ top: 0, behavior: 'instant' })
    const element = root.current
    const outgoing = element.querySelector(':scope > .transition-exit')
    const current = element.querySelector(':scope > .transition-current')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setScene((value) => ({ ...value, exiting: null }))
      return undefined
    }

    // Animate the container too when the next page is shorter or taller.
    element.style.height = `${outgoing.offsetHeight}px`
    let timeout
    const frame = window.requestAnimationFrame(() => {
      element.style.height = `${current.offsetHeight}px`
      timeout = window.setTimeout(() => {
        element.style.height = ''
        setScene((value) => ({ ...value, exiting: null }))
      }, TRANSITION_MS)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
      element.style.height = ''
    }
  }, [scene.id])

  useLayoutEffect(() => {
    previousChildren.current = children
  }, [children])

  return (
    <div
      ref={root}
      className={`${className} transition-root${scene.exiting ? ' transitioning' : ''}`}
      style={{
        '--transition-direction': scene.direction,
        '--transition-duration': `${TRANSITION_MS}ms`,
      }}
    >
      {scene.exiting && (
        <div
          key={scene.exiting.id}
          className="transition-layer transition-exit"
          aria-hidden="true"
          inert
        >
          {scene.exiting.children}
        </div>
      )}
      <div key={scene.id} className="transition-layer transition-current">
        {children}
      </div>
    </div>
  )
}

export { Transition }
