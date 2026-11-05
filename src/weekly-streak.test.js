import assert from 'node:assert/strict'
import test from 'node:test'
import React, { act } from 'react'
import { renderToString } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

test('weekly streak rewards advance by milestone and tilt safely with the mouse', async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>')
  const originals = Object.fromEntries(
    ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  )
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let reducedMotion = false
  window.matchMedia = () => ({ matches: reducedMotion })
  const frames = new Map()
  let frameId = 0
  window.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback)
    return frameId
  }
  window.cancelAnimationFrame = (id) => frames.delete(id)
  const flushFrames = () => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach((callback) => callback())
  }
  const { createRoot } = await import('react-dom/client')
  const vite = await createServer({
    root: path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false },
  })
  const container = document.getElementById('root')
  const root = createRoot(container)
  t.after(async () => {
    await act(() => root.unmount())
    await vite.close()
    dom.window.close()
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  const { WeeklyStreak } = await vite.ssrLoadModule('/src/components/WeeklyStreak.jsx')
  let instance = 0
  const mount = async (weeks = 52) => {
    await act(() => root.render(React.createElement(WeeklyStreak, { weeks, key: ++instance })))
    const badge = container.querySelector('.week-streak')
    badge.getBoundingClientRect = () => ({ left: 10, top: 20, width: 200, height: 100 })
    return badge
  }
  const pointer = async (badge, type, x = 210, y = 20, pointerType = 'mouse') => {
    const event = new window.MouseEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      relatedTarget: document.body,
    })
    Object.defineProperty(event, 'pointerType', { value: pointerType })
    await act(() => badge.dispatchEvent(event))
  }
  await t.test(
    'aura tiers and month/year labels progress independently with the actual week count',
    () => {
      for (const [weeks, tier, label] of [
        [0, 'inactive', 'START YOUR STREAK'],
        [1, 'base', 'BASE STREAK'],
        [3, 'base', 'BASE STREAK'],
        [4, 'month', '1 MONTH'],
        [8, 'month', '2 MONTHS'],
        [12, 'month', '3 MONTHS'],
        [25, 'month', '6 MONTHS'],
        [26, 'half-year', '6 MONTHS'],
        [48, 'half-year', '12 MONTHS'],
        [51, 'half-year', '12 MONTHS'],
        [52, 'year', '1 YEAR'],
        [53, 'year', '1 YEAR'],
        [103, 'year', '1 YEAR'],
        [104, 'year', '2 YEARS'],
        [156, 'year', '3 YEARS'],
      ]) {
        const markup = renderToString(React.createElement(WeeklyStreak, { weeks }))
        assert.ok(markup.includes(`week-streak--${tier}`), String(weeks))
        assert.ok(markup.includes(label), `${weeks}: ${label}`)
        assert.ok(markup.includes(`${weeks} ${weeks === 1 ? 'WEEK' : 'WEEKS'} STREAK`))
        assert.ok(!markup.includes('week-streak-label'))
        assert.ok(
          markup.includes(`${weeks} consecutive ${weeks === 1 ? 'week' : 'weeks'} of workouts`),
        )
        assert.equal(markup.includes('week-streak-sparks'), weeks >= 52)
      }
    },
  )
  await t.test('mouse tilt and light follow cursor position and reset on exit', async () => {
    const badge = await mount()
    await pointer(badge, 'pointermove')
    assert.equal(frames.size, 1)
    flushFrames()
    assert.equal(badge.style.getPropertyValue('--streak-tilt-x'), '5deg')
    assert.equal(badge.style.getPropertyValue('--streak-tilt-y'), '5deg')
    assert.equal(badge.style.getPropertyValue('--streak-light-x'), '100%')
    await pointer(badge, 'pointermove', 10, 120)
    flushFrames()
    assert.equal(badge.style.getPropertyValue('--streak-tilt-x'), '-5deg')
    assert.equal(badge.style.getPropertyValue('--streak-tilt-y'), '-5deg')
    await pointer(badge, 'pointerout')
    assert.equal(badge.style.getPropertyValue('--streak-tilt-x'), '')
    assert.equal(badge.style.getPropertyValue('--streak-light-x'), '')
  })
  await t.test('touch input does not tilt the badge', async () => {
    const badge = await mount()
    await pointer(badge, 'pointermove', 210, 20, 'touch')
    assert.equal(frames.size, 0)
    assert.equal(badge.style.getPropertyValue('--streak-tilt-x'), '')
  })
  await t.test('OS and app reduced motion cancel tilt and pending frames', async () => {
    const badge = await mount()
    await pointer(badge, 'pointermove')
    reducedMotion = true
    await pointer(badge, 'pointermove')
    assert.equal(frames.size, 0)
    reducedMotion = false
    await pointer(badge, 'pointermove')
    flushFrames()
    document.documentElement.dataset.reduceMotion = 'true'
    await pointer(badge, 'pointermove')
    assert.equal(badge.style.getPropertyValue('--streak-tilt-x'), '')
    assert.equal(frames.size, 0)
    delete document.documentElement.dataset.reduceMotion
  })
  await t.test('leaving or unmounting cancels pending animation work', async () => {
    const badge = await mount()
    await pointer(badge, 'pointermove')
    await pointer(badge, 'pointercancel')
    assert.equal(frames.size, 0)
    await pointer(badge, 'pointermove')
    await act(() => root.render(null))
    assert.equal(frames.size, 0)
  })
})
