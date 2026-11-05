import assert from 'node:assert/strict'
import test from 'node:test'
import { weeklyStreak } from './time.js'

const now = new Date('2026-11-05T12:00:00.000Z')
test('weekly streak counts consecutive Monday–Sunday weeks once each', () => {
  assert.equal(
    weeklyStreak(
      [
        '2026-11-05T10:00:00Z',
        '2026-11-04T10:00:00Z',
        '2026-10-29T10:00:00Z',
        '2026-10-22T10:00:00Z',
      ],
      'UTC',
      now,
    ),
    3,
  )
})
test('weekly streak survives the current week before its first workout', () => {
  assert.equal(weeklyStreak(['2026-10-29T10:00:00Z', '2026-10-22T10:00:00Z'], 'UTC', now), 2)
})
test('a whole missed week breaks the streak', () => {
  assert.equal(weeklyStreak(['2026-10-22T10:00:00Z'], 'UTC', now), 0)
  assert.equal(weeklyStreak(['2026-11-05T10:00:00Z', '2026-10-22T10:00:00Z'], 'UTC', now), 1)
  assert.equal(weeklyStreak([], 'UTC', now), 0)
})
test('weekly streak spans month and year boundaries', () => {
  assert.equal(
    weeklyStreak(
      ['2027-01-04T12:00:00Z', '2026-12-30T12:00:00Z', '2026-12-23T12:00:00Z'],
      'UTC',
      new Date('2027-01-05T12:00:00Z'),
    ),
    3,
  )
})
test('weekly streak uses the user timezone at the Monday boundary', () => {
  const dates = ['2026-11-08T18:00:00Z', '2026-11-05T10:00:00Z']
  const mondayInJakarta = new Date('2026-11-08T19:00:00Z')
  assert.equal(weeklyStreak(dates, 'Asia/Jakarta', mondayInJakarta), 2)
  assert.equal(weeklyStreak(dates, 'UTC', mondayInJakarta), 1)
})
test('weekly streak handles weeks across daylight-saving changes', () => {
  assert.equal(
    weeklyStreak(
      ['2026-11-02T12:00:00Z', '2026-10-26T12:00:00Z', '2026-10-19T12:00:00Z'],
      'America/New_York',
      now,
    ),
    3,
  )
})
