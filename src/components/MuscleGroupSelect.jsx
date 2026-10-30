import React, { useId, useRef, useState, useEffect, useLayoutEffect } from 'react'
import { muscleGroups } from '../config.js'
import { MuscleIcon } from './Icons.jsx'

function MuscleGroupSelect({ value, onChange }) {
  const id = useId()
  const root = useRef(null)
  const trigger = useRef(null)
  const search = useRef({ text: '', time: 0 })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(muscleGroups.indexOf(value))
  const reveal = () => {
    setActive(muscleGroups.indexOf(value))
    setOpen(true)
  }
  const choose = (group) => {
    onChange(group)
    setOpen(false)
    trigger.current.focus()
  }

  useEffect(() => {
    if (!open) return undefined
    const dismiss = (event) => {
      if (!root.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const list = root.current.querySelector('[role="listbox"]')
    const option = list.children[active]
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight
  }, [open, active])

  const handleKey = (event) => {
    if (event.key === 'Tab') {
      setOpen(false)
      return
    }
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
      }
      return
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      if (!open) reveal()
      if (event.key === 'Home') setActive(0)
      else if (event.key === 'End') setActive(muscleGroups.length - 1)
      else if (open)
        setActive((index) =>
          Math.max(
            0,
            Math.min(muscleGroups.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)),
          ),
        )
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) choose(muscleGroups[active])
      else reveal()
      return
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now()
      const text =
        (now - search.current.time < 600 ? search.current.text : '') + event.key.toLowerCase()
      search.current = { text, time: now }
      const match = muscleGroups.findIndex((group) => group.toLowerCase().startsWith(text))
      if (match >= 0) {
        event.preventDefault()
        setActive(match)
        setOpen(true)
      }
    }
  }

  return (
    <div
      className="muscle-select label-gap"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <span className="muscle-select-label" id={`${id}-label`}>
        Muscle group
      </span>
      <button
        ref={trigger}
        type="button"
        className={`muscle-select-trigger${open ? ' is-open' : ''}`}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : reveal())}
        onKeyDown={handleKey}
      >
        <span className="muscle-select-value">
          <MuscleIcon group={value} />
          <span id={`${id}-value`}>{value}</span>
        </span>
        <svg
          className="muscle-select-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>
      <div
        className={`muscle-select-presence${open ? ' is-open' : ''}`}
        inert={!open}
        aria-hidden={!open}
      >
        <div className="muscle-select-clip">
          <ul
            className="muscle-select-options"
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-label`}
          >
            {muscleGroups.map((group, index) => (
              <li
                key={group}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={value === group}
                className={`${active === index ? 'is-active' : ''}${value === group ? ' is-selected' : ''}`}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(group)}
              >
                <span className="muscle-option-icon">
                  <MuscleIcon group={group} />
                </span>
                <span>{group}</span>
                {value === group && (
                  <svg
                    className="muscle-option-check"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export { MuscleGroupSelect }
