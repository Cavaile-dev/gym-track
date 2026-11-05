import assert from 'node:assert/strict'
import test from 'node:test'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

test('history date includes all sessions, expands exercises, and preserves session actions', async (t) => {
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
  window.requestAnimationFrame = () => 1
  window.cancelAnimationFrame = () => {}
  window.matchMedia = () => ({ matches: true })
  const { createRoot } = await import('react-dom/client')
  const vite = await createServer({
    root: path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true, hmr: false },
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
  const today = new Date()
  const stamp = (day, hour) =>
    new Date(today.getFullYear(), today.getMonth(), day, hour).toISOString()
  const set = (exerciseId, name, reps) => ({ exerciseId, name, setNumber: 1, weight: 25, reps })
  const sessions = [
    {
      id: 30,
      templateId: 30,
      name: 'Leg',
      finishedAt: stamp(6, 12),
      sets: [set(3, 'Squat', 8), set(4, 'Calf Raise', 15)],
    },
    {
      id: 20,
      templateId: 20,
      name: 'Pull',
      finishedAt: stamp(5, 18),
      sets: [set(1, 'Bench Press', 12), set(2, 'Row', 10), set(5, 'Pull Up', 6)],
    },
    {
      id: 10,
      templateId: 10,
      name: 'Push',
      finishedAt: stamp(5, 9),
      sets: [set(1, 'Bench Press', 5), set(6, 'Triceps Extension', 10), set(7, 'Push Up', 15)],
    },
  ]
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    requests.push([url, options.method || 'GET'])
    let result
    if (url.startsWith('/api/history?')) result = { sessions }
    else if (url.startsWith('/api/exercises/')) result = { templateName: 'Push', sessions: [] }
    else if (url === '/api/bootstrap') result = {}
    else if (options.method === 'DELETE') result = { ok: true }
    else throw new Error(`Unexpected request: ${url}`)
    return new Response(JSON.stringify(result), { status: 200 })
  })
  const { History } = await vite.ssrLoadModule('/src/pages/History.jsx')
  await act(() => root.render(React.createElement(History, { data: {}, setData() {} })))
  const click = async (button) => {
    assert.ok(button, 'Expected a button')
    await act(() => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
  }
  const namedButton = (text) =>
    [...container.querySelectorAll('button')].find((button) => button.textContent.trim() === text)
  const dayButton = (day) =>
    [...container.querySelectorAll('.calendar-grid button')].find(
      (button) => button.textContent.trim() === String(day),
    )
  const exercises = () => [...container.querySelectorAll('.detail-exercise')]
  const card = (name) => container.querySelector(`section[aria-label="${name} session"]`)
  const cardExercises = (name) => [...card(name).querySelectorAll('.detail-exercise')]
  const toggle = (name) => card(name).querySelector('.history-show-all')
  await click(dayButton(5))
  assert.equal(container.querySelector('.detail-header h2').textContent, '2 sessions')
  assert.equal(container.querySelectorAll('.history-day-session').length, 2)
  assert.equal(card('Pull').querySelector('h3').textContent, 'Pull')
  assert.equal(card('Push').querySelector('h3').textContent, 'Push')
  assert.deepEqual(
    cardExercises('Pull').map((button) => button.querySelector('strong').textContent),
    ['Bench Press', 'Row'],
  )
  assert.deepEqual(
    cardExercises('Push').map((button) => button.querySelector('strong').textContent),
    ['Bench Press', 'Triceps Extension'],
  )
  assert.match(cardExercises('Push')[0].textContent, /25 kg × 5/)
  await click(toggle('Pull'))
  assert.equal(cardExercises('Pull').length, 3)
  assert.equal(cardExercises('Push').length, 2)
  assert.equal(toggle('Push').getAttribute('aria-expanded'), 'false')
  await click(toggle('Push'))
  assert.equal(cardExercises('Push').length, 3)
  await click(toggle('Pull'))
  assert.equal(cardExercises('Pull').length, 2)
  assert.equal(cardExercises('Push').length, 3)
  await click(cardExercises('Push')[0])
  assert.ok(requests.some(([url]) => url === '/api/exercises/1/history?templateId=10'))
  await click(namedButton('← All exercises'))
  assert.equal(cardExercises('Pull').length, 2)
  assert.equal(cardExercises('Push').length, 3)
  await click(dayButton(6))
  assert.equal(container.querySelector('.detail-header h2').textContent, 'Leg')
  assert.equal(exercises().length, 2)
  assert.equal(namedButton('Show All'), undefined)
  await click(dayButton(5))
  assert.equal(cardExercises('Pull').length, 2)
  assert.equal(cardExercises('Push').length, 2)
  assert.equal(toggle('Push').getAttribute('aria-expanded'), 'false')
  await click(card('Pull').querySelector('.session-delete'))
  assert.equal(document.querySelector('.delete-session-preview strong').textContent, 'Pull')
  await click(document.querySelector('.delete-session-sheet .button.danger'))
  assert.ok(requests.some(([url, method]) => url === '/api/history/20' && method === 'DELETE'))
  assert.equal(container.querySelector('.detail-header h2').textContent, 'Push')
  assert.equal(container.querySelectorAll('.history-day-session').length, 1)
  assert.equal(card('Pull'), null)
  assert.equal(exercises().length, 2)
  assert.match(exercises()[0].textContent, /25 kg × 5/)
  await click(toggle('Push'))
  assert.equal(exercises().length, 3)
})
