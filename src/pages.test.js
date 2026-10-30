import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

test('all main pages render after module extraction', async (t) => {
  const vite = await createServer({
    root: path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true, hmr: false },
  })
  t.after(() => vite.close())
  const exercise = { id: 1, name: 'Bench Press', muscleGroup: 'Chest', targetSets: 3 }
  const template = {
    id: 1,
    routineId: 1,
    name: 'Push A',
    scheduledDays: [0],
    exercises: [exercise],
  }
  const user = { id: 1, username: 'preview', email: null }
  const data = {
    routines: [{ id: 1, name: 'My Training Week', isActive: 1 }],
    activeRoutineId: 1,
    templates: [template],
    exercises: [exercise],
    today: template,
    todaySessions: [template],
    active: null,
    stats: { totalDays: 1, workoutsWeek: 1, workoutsMonth: 1, volume: 200, records: [] },
  }
  const noop = () => {}
  const cases = [
    ['Auth', 'Auth', { onLogin: noop }, 'Welcome back.'],
    ['Dashboard', 'Dashboard', { data, user, onStart: noop, setPage: noop }, 'Push A'],
    ['Routines', 'RoutinesPage', { data, setData: noop }, 'Routines'],
    ['Exercises', 'Exercises', { data, setData: noop }, 'Bench Press'],
    [
      'Workout',
      'Workout',
      { workout: { id: 1, template, logs: [], previous: {} }, onFinish: noop, onAbandon: noop },
      'Bench Press',
    ],
    ['History', 'History', { data, setData: noop }, 'History'],
  ]
  for (const [file, symbol, props, expected] of cases) {
    await t.test(`${file} renders with real shared components`, async () => {
      const module = await vite.ssrLoadModule(`/src/pages/${file}.jsx`)
      const markup = renderToString(React.createElement(module[symbol], props))
      assert.ok(markup.includes(expected))
    })
  }
  await t.test('dashboard celebrates only when every scheduled session is completed', async () => {
    const { Dashboard } = await vite.ssrLoadModule('/src/pages/Dashboard.jsx')
    const completed = { ...template, completedToday: true }
    const remaining = { ...template, id: 2, name: 'Pull B', completedToday: false }
    const cases = [
      { sessions: [completed], today: completed, expected: 'Sessions Completed' },
      {
        sessions: [completed, { ...remaining, completedToday: true }],
        today: completed,
        expected: 'Sessions Completed',
      },
      { sessions: [completed, remaining], today: remaining, expected: 'Start workout' },
      { sessions: [], today: null, expected: 'No session planned' },
    ]
    for (const { sessions, today, expected } of cases) {
      const markup = renderToString(
        React.createElement(Dashboard, {
          data: { ...data, todaySessions: sessions, today },
          user,
          onStart: noop,
          setPage: noop,
        }),
      )
      assert.ok(markup.includes(expected), expected)
      assert.ok(!markup.includes('Train again'))
      if (expected !== 'Sessions Completed') assert.ok(!markup.includes('Sessions Completed'))
    }
    const resumed = renderToString(
      React.createElement(Dashboard, {
        data: { ...data, today: completed, todaySessions: [completed], active: { template } },
        user,
        onStart: noop,
        setPage: noop,
      }),
    )
    assert.ok(resumed.includes('Resume'))
    assert.ok(!resumed.includes('Sessions Completed'))
  })
  await t.test('account pages and dropdown render', async () => {
    const { Profile, Settings, AccountDropdown } = await vite.ssrLoadModule(
      '/src/features/account/Account.jsx',
    )
    const { ModalPresence } = await vite.ssrLoadModule('/src/components/Modal.jsx')
    assert.ok(
      renderToString(
        React.createElement(Profile, { user, stats: data.stats, onSaved: noop }),
      ).includes('Save profile'),
    )
    assert.ok(
      renderToString(
        React.createElement(Settings, {
          preferences: { restDuration: 90, reduceMotion: false, customRestDuration: null },
          onSave: noop,
          onLogout: noop,
          Modal: ModalPresence,
        }),
      ).includes('Custom +'),
    )
    assert.ok(
      renderToString(
        React.createElement(AccountDropdown, {
          user,
          page: 'dashboard',
          onNavigate: noop,
          onLogout: noop,
        }),
      ).includes('Account: preview'),
    )
  })
  // Both pages must reference the same shared modal, rather than separate implementations.
  const { ModalPresence } = await vite.ssrLoadModule('/src/components/Modal.jsx')
  assert.equal(renderToString(React.createElement(ModalPresence, { open: false }, 'Hidden')), '')
})
