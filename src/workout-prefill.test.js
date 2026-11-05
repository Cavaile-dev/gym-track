import assert from 'node:assert/strict'
import test from 'node:test'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

test('workout inputs follow the matching set from the last session', async (t) => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const originals = Object.fromEntries(
    ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  )
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: true })
  window.scrollTo = () => {}
  const { createRoot } = await import('react-dom/client')
  const vite = await createServer({
    root: path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true, hmr: false },
  })
  t.after(async () => {
    await vite.close()
    dom.window.close()
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  const { Workout } = await vite.ssrLoadModule('/src/pages/Workout.jsx')
  const exercise = { id: 1, name: 'Bench Press', muscleGroup: 'Chest', targetSets: 3 }
  const sets = [12, 10, 8].map((reps, index) => ({
    exerciseId: 1,
    setNumber: index + 1,
    weight: 25,
    reps,
    finishedAt: '2026-10-28T12:00:00.000Z',
  }))
  const fixture = {
    id: 42,
    template: { id: 1, name: 'Push A', exercises: [exercise] },
    logs: [],
    previous: { 1: { ...sets[0], sets } },
  }
  async function mount(t, overrides = {}, restDuration = 0) {
    const workout = { ...fixture, ...overrides }
    let logs = [...workout.logs]
    const submitted = []
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (options.method === 'DELETE') {
        const id = Number(url.split('/').pop())
        logs = logs.filter((log) => log.id !== id)
      } else {
        const payload = JSON.parse(options.body)
        submitted.push(payload)
        logs = [
          ...logs,
          {
            ...payload,
            id: logs.length + 1,
            setNumber: logs.filter((log) => log.exerciseId === payload.exerciseId).length + 1,
            weight: Number(payload.weight),
            reps: Number(payload.reps),
          },
        ]
      }
      return new Response(JSON.stringify({ logs }), { status: 200 })
    })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    t.after(async () => {
      await act(() => root.unmount())
      container.remove()
    })
    await act(() =>
      root.render(
        React.createElement(Workout, {
          workout,
          onFinish() {},
          onAbandon() {},
          restDuration,
        }),
      ),
    )
    const input = (label) => container.querySelector(`input[aria-label="${label}"]`)
    return {
      submitted,
      expectValues(weight, reps) {
        assert.equal(input('Weight in kilograms')?.value, String(weight))
        assert.equal(input('Repetitions')?.value, String(reps))
      },
      expectHistory(reps, currentSet) {
        const rows = [...container.querySelectorAll('.previous-set')]
        assert.deepEqual(
          rows.map((row) => Number(row.textContent.match(/(\d+) reps/)[1])),
          reps,
        )
        assert.equal(container.querySelector('.previous-card-heading').textContent, 'LAST SESSION')
        const highlighted = rows.filter((row) => row.getAttribute('aria-current') === 'step')
        assert.equal(highlighted.length, currentSet === null ? 0 : 1)
        if (currentSet !== null)
          assert.equal(
            highlighted[0].querySelector('.previous-set-number').textContent,
            `Set ${currentSet}`,
          )
      },
      expectPrevious(weight, reps) {
        assert.equal(container.querySelectorAll('.previous-set[aria-current="step"]').length, 1)
        assert.match(
          container.querySelector('.previous-set[aria-current="step"]').textContent,
          new RegExp(`${weight} kg.*${reps} reps`),
        )
      },
      expectRest(seconds, duration = 90) {
        assert.equal(container.querySelector('.rest-center h1').textContent, 'Recover')
        assert.equal(container.querySelector('.rest-ring strong').textContent, String(seconds))
        assert.equal(container.querySelector('.rest-set-context .dot-sep'), null)
        assert.match(
          container.querySelector('.rest-set-context').textContent,
          /Bench Press.*Set 2 \/ 3/,
        )
        const arc = container.querySelector('.rest-ring-progress')
        assert.ok(arc)
        const expected = (1 - Math.min(1, Math.max(0, seconds / duration))) * 100
        assert.ok(Math.abs(Number(arc.style.strokeDashoffset) - expected) < 0.000001)
      },
      async change(label, value) {
        await act(() => {
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(
            input(label),
            String(value),
          )
          input(label).dispatchEvent(new window.Event('input', { bubbles: true }))
        })
      },
      async click(text) {
        const button = [...container.querySelectorAll('button')].find(
          (item) =>
            item.textContent.includes(text) || item.getAttribute('aria-label')?.includes(text),
        )
        assert.ok(button, `Missing button: ${text}`)
        await act(() => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
      },
    }
  }

  await t.test(
    'set 1, 2, and 3 prefill 12, 10, and 8 reps even after changing set 1',
    async (t) => {
      const ui = await mount(t)
      ui.expectValues(25, 12)
      await ui.click('Increase by 0.25')
      ui.expectValues(25.25, 12)
      await ui.click('Decrease by 0.25')
      await ui.click('Increase by 5')
      ui.expectValues(25, 17)
      await ui.click('Decrease by 5')
      ui.expectValues(25, 12)
      ui.expectHistory([12, 10, 8], 1)
      await ui.change('Weight in kilograms', 27.5)
      await ui.change('Repetitions', 11)
      await ui.click('Log set')
      ui.expectValues(25, 10)
      ui.expectPrevious(25, 10)
      ui.expectHistory([12, 10, 8], 2)
      await ui.click('Log set')
      ui.expectValues(25, 8)
      ui.expectPrevious(25, 8)
      ui.expectHistory([12, 10, 8], 3)
      await ui.click('Log set')
      assert.deepEqual(
        ui.submitted.map(({ weight, reps }) => [Number(weight), Number(reps)]),
        [
          [27.5, 11],
          [25, 10],
          [25, 8],
        ],
      )
      ui.expectHistory([12, 10, 8], null)
      await ui.click('Add set')
      ui.expectValues(25, 8)
      ui.expectHistory([12, 10, 8], null)
    },
  )
  await t.test(
    'resume uses the next matching historical set instead of the last current log',
    async (t) => {
      const ui = await mount(t, {
        logs: [{ id: 1, exerciseId: 1, setNumber: 1, weight: 25, reps: 8 }],
      })
      ui.expectValues(25, 10)
    },
  )
  await t.test(
    'editing restores actual logged values and saving advances to the matching set',
    async (t) => {
      const ui = await mount(t, {
        logs: [{ id: 1, exerciseId: 1, setNumber: 1, weight: 27.5, reps: 11 }],
      })
      await ui.click('Edit last set')
      ui.expectValues(27.5, 11)
      await ui.click('Log set')
      ui.expectValues(25, 10)
    },
  )
  await t.test(
    'rest timer updates the arc, adjusts seconds, and returns to the next historical set',
    async (t) => {
      const ui = await mount(t, {}, 90)
      t.mock.timers.enable({ apis: ['setInterval'] })
      await ui.click('Log set')
      ui.expectRest(90)
      await act(() => t.mock.timers.tick(1000))
      ui.expectRest(89)
      await ui.click('Reduce rest by 15 seconds')
      ui.expectRest(74)
      await ui.click('Add 15 seconds of rest')
      ui.expectRest(89)
      await ui.click('Add 15 seconds of rest')
      ui.expectRest(104)
      await ui.click('Skip rest')
      ui.expectValues(25, 10)
    },
  )
  await t.test('extra sets without history use the last actual values', async (t) => {
    const ui = await mount(t, {
      logs: [
        { id: 1, exerciseId: 1, setNumber: 1, weight: 25, reps: 12 },
        { id: 2, exerciseId: 1, setNumber: 2, weight: 25, reps: 10 },
      ],
    })
    ui.expectValues(25, 8)
    await ui.change('Weight in kilograms', 30)
    await ui.change('Repetitions', 6)
    await ui.click('Log set')
    await ui.click('Add set')
    ui.expectValues(30, 6)
  })
  await t.test(
    'switching exercises and editing across the boundary preserve per-set history',
    async (t) => {
      const shoulderSets = [
        { exerciseId: 2, setNumber: 1, weight: 40, reps: 9 },
        { exerciseId: 2, setNumber: 2, weight: 37.5, reps: 8 },
      ]
      const ui = await mount(t, {
        template: {
          ...fixture.template,
          exercises: [
            { ...exercise, targetSets: 1 },
            { id: 2, name: 'Shoulder Press', muscleGroup: 'Shoulders', targetSets: 2 },
          ],
        },
        previous: { ...fixture.previous, 2: { ...shoulderSets[0], sets: shoulderSets } },
      })
      await ui.change('Weight in kilograms', 27.5)
      await ui.change('Repetitions', 11)
      await ui.click('Log set')
      await ui.click('Next exercise')
      ui.expectValues(40, 9)
      await ui.click('Edit last set')
      ui.expectValues(27.5, 11)
      await ui.click('Log set')
      await ui.click('Next exercise')
      ui.expectValues(40, 9)
      await ui.click('Log set')
      ui.expectValues(37.5, 8)
    },
  )
  await t.test(
    'an exercise without history carries forward the current session values',
    async (t) => {
      const ui = await mount(t, { previous: {} })
      ui.expectValues('', '')
      await ui.change('Weight in kilograms', 20)
      await ui.change('Repetitions', 9)
      await ui.click('Log set')
      ui.expectValues(20, 9)
    },
  )
})
