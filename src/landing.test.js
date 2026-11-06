import assert from 'node:assert/strict'
import test from 'node:test'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

test('public landing, auth navigation, and existing sessions work together', async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  })
  const originals = Object.fromEntries(
    ['window', 'document', 'fetch', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  )
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.scrollTo = () => {}
  window.matchMedia = () => ({ matches: true })
  window.HTMLCanvasElement.prototype.getContext = () => null
  const user = { id: 1, username: 'alex', email: null }
  const bootstrap = {
    routines: [{ id: 1, name: 'My Training Week', isActive: 1 }],
    activeRoutineId: 1,
    templates: [],
    exercises: [],
    today: null,
    todaySessions: [],
    active: null,
    stats: {
      totalDays: 0,
      weeklyStreak: 0,
      workoutsWeek: 0,
      workoutsMonth: 0,
      volume: 0,
      records: [],
    },
  }
  let signedIn = false
  const requests = []
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET' })
    if (url === '/api/auth/login' || url === '/api/auth/register') signedIn = true
    if (url === '/api/auth/logout') signedIn = false
    return {
      ok: true,
      json: async () => (url === '/api/bootstrap' ? bootstrap : { user: signedIn ? user : null }),
    }
  }
  const { createRoot } = await import('react-dom/client')
  const vite = await createServer({
    root: path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false },
  })
  const { App } = await vite.ssrLoadModule('/src/App.jsx')
  const container = document.getElementById('root')
  let root = createRoot(container)
  const settle = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
  const mount = async () => {
    await act(() => root.render(React.createElement(App)))
    await settle()
  }
  const click = async (element) => {
    assert.ok(element, 'expected control exists')
    await act(() => element.click())
    await settle()
  }
  const navigate = async (hash) => {
    await act(() => {
      window.history.pushState(null, '', hash || '/')
      window.dispatchEvent(new window.HashChangeEvent('hashchange'))
    })
  }
  t.after(async () => {
    await act(() => root.unmount())
    await vite.close()
    dom.window.close()
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })

  await mount()
  await t.test('guests arrive on the landing and can explore without auth writes', async () => {
    assert.match(container.querySelector('h1').textContent, /Less guesswork.More progress./)
    assert.equal(container.querySelector('form'), null)
    await click(container.querySelector('[aria-label="Wed: Rest day"]'))
    assert.equal(container.querySelector('.landing-demo-session h4').textContent, 'Rest day')
    await click(document.getElementById('preview-tab-train'))
    assert.match(container.querySelector('[role="tabpanel"]').textContent, /Bench Press/)
    await act(() =>
      document
        .getElementById('preview-tab-train')
        .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    )
    assert.equal(document.activeElement.id, 'preview-tab-progress')
    assert.match(container.querySelector('[role="tabpanel"]').textContent, /PERSONAL RECORDS/)
    assert.equal(requests.filter((request) => request.method !== 'GET').length, 0)
  })
  await t.test('signup links select registration and back returns to the landing', async () => {
    await click(container.querySelector('.landing-header-cta'))
    assert.equal(window.location.hash, '#signup')
    assert.equal(container.querySelector('h1').textContent, 'Build your rhythm.')
    assert.equal(container.querySelectorAll('form input').length, 4)
    await click(container.querySelector('.auth-panel .text-button'))
    assert.equal(window.location.hash, '#login')
    assert.equal(container.querySelector('h1').textContent, 'Welcome back.')
    assert.equal(container.querySelectorAll('form input').length, 2)
    await click(container.querySelector('.auth-back'))
    assert.ok(container.querySelector('.landing-page'))
  })
  await t.test(
    'browser hash navigation preserves landing sections and direct auth links',
    async () => {
      await navigate('#features')
      assert.ok(container.querySelector('.landing-page'))
      await navigate('#signup')
      assert.equal(container.querySelector('h1').textContent, 'Build your rhythm.')
      await navigate('#login')
      assert.equal(container.querySelector('h1').textContent, 'Welcome back.')
    },
  )
  await t.test('successful login opens the dashboard and logout restores the landing', async () => {
    await act(() =>
      container
        .querySelector('form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })),
    )
    await settle()
    assert.match(container.querySelector('h1').textContent, /Hey, alex/)
    assert.equal(window.location.hash, '')
    assert.equal(container.querySelector('.landing-page'), null)
    await click(container.querySelector('.account-trigger'))
    await click(container.querySelector('.account-menu-signout'))
    assert.ok(container.querySelector('.landing-page'))
  })
  await t.test('an existing signed-in session bypasses the landing and auth forms', async () => {
    await act(() => root.unmount())
    signedIn = true
    window.history.replaceState(null, '', '/#signup')
    root = createRoot(container)
    await mount()
    assert.match(container.querySelector('h1').textContent, /Hey, alex/)
    assert.equal(container.querySelector('.landing-page'), null)
    assert.equal(container.querySelector('.auth-shell'), null)
  })
})
