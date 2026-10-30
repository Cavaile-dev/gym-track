import assert from 'node:assert/strict'
import test from 'node:test'
import { sessionsForDay } from './schedules.js'

test('selecting another day uses its sessions and completion on the actual workout day', () => {
  const today = new Date(2026, 9, 31, 12)
  const yesterday = new Date(2026, 9, 30, 12)
  const templates = [
    { id: 1, routineId: 10, scheduledDays: [0], lastPerformed: today.toISOString() },
    { id: 2, routineId: 10, scheduledDays: [0, 2], lastPerformed: yesterday.toISOString() },
    { id: 3, routineId: 20, scheduledDays: [0], lastPerformed: null },
    { id: 4, routineId: 10, scheduledDays: [1], lastPerformed: null },
  ]
  const monday = sessionsForDay(templates, 10, 0, today)
  assert.deepEqual(
    monday.map((session) => [session.id, session.completedToday]),
    [
      [1, true],
      [2, false],
    ],
  )
  assert.deepEqual(sessionsForDay(templates, 10, 5, today), [])
  assert.deepEqual(
    sessionsForDay(templates, 10, 2, today).map((session) => session.id),
    [2],
  )
  assert.equal(sessionsForDay(templates, 10, 1, today)[0].completedToday, false)
  assert.equal(templates[0].completedToday, undefined)
  assert.deepEqual(templates[1].scheduledDays, [0, 2])
})
