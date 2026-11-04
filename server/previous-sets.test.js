import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

test('workout history returns every set from the latest matching finished session', async (t) => {
  const folder = await mkdtemp(path.join(tmpdir(), 'gym-previous-sets-'))
  const databasePath = path.join(folder, 'test.sqlite')
  const originalPath = process.env.DATABASE_PATH
  process.env.DATABASE_PATH = databasePath
  const { db, run, get } = await import('./database.js')
  const { activeShape } = await import('./services/training.js')
  t.after(async () => {
    db.close()
    if (originalPath === undefined) delete process.env.DATABASE_PATH
    else process.env.DATABASE_PATH = originalPath
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        await unlink(databasePath + suffix)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    await rmdir(folder)
  })
  run(
    "INSERT INTO users (id,username,password_hash,created_at) VALUES (1,'history_owner','fixture','2026-01-01')",
  )
  run(
    "INSERT INTO users (id,username,password_hash,created_at) VALUES (2,'other_owner','fixture','2026-01-01')",
  )
  run("INSERT INTO exercises (id,name,muscle_group) VALUES (1000,'Bench Press','Chest')")
  for (const id of [100, 200]) {
    run("INSERT INTO templates (id,user_id,name,created_at) VALUES (?,1,'Push','2026-01-01')", id)
    run('INSERT INTO template_exercises VALUES (?,1000,0,3)', id)
  }
  const addSession = (id, userId, templateId, status, finishedAt, values) => {
    run(
      'INSERT INTO workout_sessions (id,user_id,template_id,status,started_at,finished_at) VALUES (?,?,?,?,?,?)',
      id,
      userId,
      templateId,
      status,
      finishedAt,
      finishedAt,
    )
    for (const [index, [weight, reps]] of values.entries()) {
      run(
        'INSERT INTO set_logs (session_id,exercise_id,set_number,weight,reps,logged_at) VALUES (?,1000,?,?,?,?)',
        id,
        index + 1,
        weight,
        reps,
        finishedAt,
      )
    }
  }
  addSession(1, 1, 100, 'finished', '2026-10-21T12:00:00.000Z', [
    [20, 15],
    [20, 13],
    [20, 11],
    [20, 9],
  ])
  addSession(2, 1, 100, 'finished', '2026-10-28T12:00:00.000Z', [
    [25, 12],
    [25, 10],
    [25, 8],
  ])
  addSession(3, 1, 100, 'abandoned', '2026-11-01T12:00:00.000Z', [[99, 99]])
  addSession(4, 1, 200, 'finished', '2026-11-02T12:00:00.000Z', [[88, 88]])
  addSession(5, 2, 100, 'finished', '2026-11-03T12:00:00.000Z', [[77, 77]])
  addSession(6, 1, 100, 'active', '2026-11-04T12:00:00.000Z', [[30, 6]])
  const current = () => activeShape(get('SELECT * FROM workout_sessions WHERE id=6'))
  await t.test('all matching set numbers are returned without mixing sessions or owners', () => {
    const previous = current().previous[1000]
    assert.deepEqual(
      previous.sets?.map(({ setNumber, weight, reps }) => [setNumber, weight, reps]),
      [
        [1, 25, 12],
        [2, 25, 10],
        [3, 25, 8],
      ],
    )
    assert.equal(previous.weight, 25)
    assert.equal(previous.reps, 12)
  })
  await t.test(
    'a shorter latest session does not borrow missing sets from an older session',
    () => {
      addSession(7, 1, 100, 'finished', '2026-11-03T18:00:00.000Z', [[27.5, 9]])
      assert.deepEqual(
        current().previous[1000].sets?.map(({ weight, reps }) => [weight, reps]),
        [[27.5, 9]],
      )
    },
  )
})
