import React, { useRef, useState, useLayoutEffect, useEffect } from 'react'
import { TRANSITION_MS } from '../config.js'
import { createPortal } from 'react-dom'

function ModalPresence({ open, overlay = true, label = 'Dialog', children }) {
  const presenceRoot = useRef(null)
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const latestOpenContent = useRef(children)
  const returnFocus = useRef(null)

  if (open) latestOpenContent.current = children

  useLayoutEffect(() => {
    if (open && !mounted) returnFocus.current = document.activeElement
  }, [open, mounted])

  useLayoutEffect(() => {
    if (!mounted || !overlay) return undefined
    const appRoot = document.getElementById('root')
    const previousInert = appRoot.inert
    const previousOverflow = document.body.style.overflow
    appRoot.inert = true
    document.body.style.overflow = 'hidden'
    return () => {
      appRoot.inert = previousInert
      document.body.style.overflow = previousOverflow
      if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true })
    }
  }, [mounted, overlay])

  useEffect(() => {
    if (!mounted || !overlay || !open) return undefined
    const element = presenceRoot.current
    if (!element.contains(document.activeElement)) {
      const initialFocus = element.querySelector('input') || element.querySelector('button')
      initialFocus?.focus({ preventScroll: true })
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        element.querySelector('.close-button')?.click()
      }
      if (event.key !== 'Tab') return
      const controls = [
        ...element.querySelectorAll('button, input, select, [tabindex="0"]'),
      ].filter(
        (control) =>
          !control.disabled && !control.closest('[inert]') && control.getClientRects().length,
      )
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mounted, overlay, open])

  useEffect(() => {
    let frame
    let timeout
    if (open) {
      setMounted(true)
      // Paint the closed position before starting the entrance transition.
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => setVisible(true))
      })
    } else if (mounted) {
      setVisible(false)
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      timeout = window.setTimeout(() => setMounted(false), reducedMotion ? 0 : TRANSITION_MS)
    }
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      if (timeout) window.clearTimeout(timeout)
    }
  }, [open])

  if (!mounted) return null
  const content = open ? children : latestOpenContent.current
  const presence = (
    <div
      ref={presenceRoot}
      className={`modal-presence${open && visible ? ' is-open' : ''}`}
      style={{ '--modal-duration': `${TRANSITION_MS}ms` }}
      role={overlay ? 'dialog' : undefined}
      aria-modal={overlay || undefined}
      aria-label={overlay ? label : undefined}
      inert={!open}
      aria-hidden={!open || undefined}
    >
      {content}
    </div>
  )
  return overlay ? createPortal(presence, document.body) : presence
}

function CloseButton({ onClick, label = 'Close popup', disabled = false }) {
  return (
    <button
      type="button"
      className="close-button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </button>
  )
}

export { ModalPresence, CloseButton }
