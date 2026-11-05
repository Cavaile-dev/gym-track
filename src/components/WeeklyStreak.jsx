import React, { useEffect, useRef } from 'react'

function StreakEmblem({ tier }) {
  const crowned = tier === 'year'
  const laurel = tier === 'month' || tier === 'half-year' || crowned
  return (
    <svg className="week-streak-emblem" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {laurel ? (
        <>
          {[false, true].map((mirror) => (
            <g key={String(mirror)} transform={mirror ? 'translate(64 0) scale(-1 1)' : undefined}>
              <path d="M27 54C9 48 7 28 15 13" stroke="currentColor" strokeWidth="1.3" />
              {[
                [15, 16, 20],
                [11, 24, -3],
                [11, 33, -25],
                [15, 42, -45],
                [22, 49, -62],
              ].map(([x, y, angle]) => (
                <g key={y} transform={`translate(${x} ${y}) rotate(${angle})`}>
                  <path d="M0 5C-6 1-7-4-5-7C0-5 2 0 0 5Z" fill="currentColor" />
                  <path d="M1 5C1-1 4-4 7-5C8 0 5 4 1 5Z" fill="currentColor" opacity=".75" />
                </g>
              ))}
            </g>
          ))}
          {crowned ? (
            <g fill="currentColor">
              <path d="m22 29 5 5 5-11 5 11 5-5-3 15H25Z" />
              <rect x="25" y="46" width="14" height="2" rx="1" />
              <circle cx="21" cy="27" r="2" />
              <circle cx="32" cy="21" r="2" />
              <circle cx="43" cy="27" r="2" />
            </g>
          ) : tier === 'half-year' ? (
            <path
              d="M32 39c1.5 7 3 8.5 10 10-7 1.5-8.5 3-10 10-1.5-7-3-8.5-10-10 7-1.5 8.5-3 10-10Z"
              fill="currentColor"
            />
          ) : null}
        </>
      ) : (
        <path
          d="M32 12c3 14 6 17 20 20-14 3-17 6-20 20-3-14-6-17-20-20 14-3 17-6 20-20Z"
          fill="currentColor"
          opacity={tier === 'inactive' ? '.45' : '1'}
        />
      )}
    </svg>
  )
}

export function WeeklyStreak({ weeks = 0 }) {
  const count = Number.isFinite(weeks) ? Math.max(0, Math.floor(weeks)) : 0
  const tier =
    count >= 52
      ? 'year'
      : count >= 26
        ? 'half-year'
        : count >= 4
          ? 'month'
          : count > 0
            ? 'base'
            : 'inactive'
  // Labels use four-week months until the fifty-two-week year milestone.
  const years = Math.floor(count / 52)
  const months = Math.floor(count / 4)
  const milestone =
    years > 0
      ? `${years} ${years === 1 ? 'YEAR' : 'YEARS'}`
      : months > 0
        ? `${months} ${months === 1 ? 'MONTH' : 'MONTHS'}`
        : count > 0
          ? 'BASE STREAK'
          : 'START YOUR STREAK'
  const root = useRef(null)
  const frame = useRef(null)
  const resetTilt = () => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    frame.current = null
    for (const property of [
      '--streak-tilt-x',
      '--streak-tilt-y',
      '--streak-light-x',
      '--streak-light-y',
    ])
      root.current?.style.removeProperty(property)
  }
  useEffect(
    () => () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    },
    [],
  )
  const tilt = (event) => {
    if (event.pointerType !== 'mouse') return
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.reduceMotion === 'true'
    ) {
      resetTilt()
      return
    }
    const rect = root.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null
      root.current?.style.setProperty('--streak-tilt-x', `${(0.5 - y) * 10}deg`)
      root.current?.style.setProperty('--streak-tilt-y', `${(x - 0.5) * 10}deg`)
      root.current?.style.setProperty('--streak-light-x', `${x * 100}%`)
      root.current?.style.setProperty('--streak-light-y', `${y * 100}%`)
    })
  }
  return (
    <div
      ref={root}
      className={`week-streak week-streak--${tier}`}
      title="Consecutive weeks with at least one completed workout (Monday–Sunday)"
      onPointerMove={tilt}
      onPointerLeave={resetTilt}
      onPointerCancel={resetTilt}
    >
      <span className="week-streak-aura" aria-hidden="true" />
      <div className="week-streak-card">
        {(tier === 'half-year' || tier === 'year') && (
          <span className="week-streak-orbit" aria-hidden="true" />
        )}
        <div className="week-streak-main">
          <StreakEmblem tier={tier} />
          <div className="week-streak-copy">
            <strong
              className="week-streak-value"
              aria-label={`${count} consecutive ${count === 1 ? 'week' : 'weeks'} of workouts`}
            >
              {`${count} ${count === 1 ? 'WEEK' : 'WEEKS'} STREAK`}
            </strong>
            <div className="week-streak-milestone">
              <span aria-hidden="true">✦</span>
              {milestone}
              <span aria-hidden="true">✦</span>
            </div>
          </div>
        </div>
      </div>
      {tier === 'year' && (
        <span className="week-streak-sparks" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      )}
    </div>
  )
}
