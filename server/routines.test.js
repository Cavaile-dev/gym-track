import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { DatabaseSync } from 'node:sqlite'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { withUpdatedTemplates } from '../src/schedules.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

test('weekly routines preserve existing training data and support several sessions per day', async (t) => {
  const folder = await mkdtemp(path.join(tmpdir(), 'gym-routines-test-'))
  const databasePath = path.join(folder, 'test.sqlite')
  const legacy = new DatabaseSync(databasePath)
  const stamp = new Date().toISOString()
  const day = (new Date().getUTCDay() + 6) % 7
  legacy.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE exercises (id INTEGER PRIMARY KEY, name TEXT NOT NULL, muscle_group TEXT NOT NULL, is_custom INTEGER DEFAULT 0, created_by INTEGER);
    CREATE TABLE templates (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL, scheduled_days TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL);
    CREATE TABLE template_exercises (template_id INTEGER, exercise_id INTEGER, position INTEGER, target_sets INTEGER);
    CREATE TABLE workout_sessions (id INTEGER PRIMARY KEY, user_id INTEGER, template_id INTEGER, started_at TEXT, finished_at TEXT, status TEXT);
    CREATE TABLE set_logs (id INTEGER PRIMARY KEY, session_id INTEGER, exercise_id INTEGER, set_number INTEGER, weight REAL, reps INTEGER, logged_at TEXT);
    INSERT INTO exercises VALUES (1000, 'Legacy lift', 'Chest', 1, 1);
  `)
  legacy
    .prepare('INSERT INTO users VALUES (1,?,?,?,?)')
    .run('routine_owner', null, bcrypt.hashSync('Temporary-Routine-987', 4), stamp)
  legacy
    .prepare('INSERT INTO templates VALUES (222,1,?,?,?)')
    .run('Original Push', JSON.stringify([day]), stamp)
  legacy.prepare('INSERT INTO template_exercises VALUES (222,1000,0,3)').run()
  legacy.prepare("INSERT INTO workout_sessions VALUES (333,1,222,?,?,'finished')").run(stamp, stamp)
  legacy.prepare('INSERT INTO set_logs VALUES (444,333,1000,1,25,10,?)').run(stamp)
  legacy.close()
  const socket = createServer()
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve))
  const port = socket.address().port
  await new Promise((resolve) => socket.close(resolve))
  let child
  const launch = async () => {
    child = spawn(process.execPath, ['server/index.js'], {
      cwd: root,
      env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath },
      stdio: 'ignore',
      windowsHide: true,
    })
    for (let i = 0; i < 80; i++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/session`)
        if (response.ok) return
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    throw new Error('Test server did not start')
  }
  const stop = async () => {
    if (child?.exitCode === null) {
      const exited = once(child, 'exit')
      child.kill()
      await exited
    }
  }
  t.after(async () => {
    await stop()
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        await unlink(databasePath + suffix)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    await rmdir(folder)
  })
  const client = () => {
    let cookie = ''
    return async (url, method = 'GET', body) => {
      const response = await fetch(`http://127.0.0.1:${port}/api${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Time-Zone': 'UTC', Cookie: cookie },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (response.headers.get('set-cookie'))
        cookie = response.headers.get('set-cookie').split(';')[0]
      return { status: response.status, data: await response.json() }
    }
  }
  await launch()
  const request = client()
  assert.equal(
    (
      await request('/auth/login', 'POST', {
        username: 'routine_owner',
        password: 'Temporary-Routine-987',
      })
    ).status,
    200,
  )
  let data = (await request('/bootstrap')).data
  const originalRoutine = data.activeRoutineId
  const plan = (name, routineId = originalRoutine, scheduledDays = [day]) => ({
    name,
    routineId,
    scheduledDays,
    exercises: [{ id: 1000, targetSets: 3 }],
  })

  await t.test('migration keeps old session IDs, history, and one default routine', async () => {
    assert.equal(data.routines.length, 1)
    assert.equal(data.templates[0].id, 222)
    assert.equal(data.templates[0].routineId, originalRoutine)
    assert.equal(data.todaySessions[0].completedToday, true)
    const history = await request('/exercises/1000/history?templateId=222')
    assert.equal(history.data.sessions[0].weight, 25)
    await stop()
    await launch()
    data = (await request('/bootstrap')).data
    assert.equal(data.routines.length, 1)
    assert.equal(data.activeRoutineId, originalRoutine)
  })
  let secondSession
  await t.test(
    'same-day sessions all appear, and the next unfinished session becomes the suggestion',
    async () => {
      const created = await request('/templates', 'POST', plan('Evening Core'))
      assert.equal(created.status, 200)
      secondSession = created.data.id
      data = (await request('/bootstrap')).data
      assert.equal(data.todaySessions.length, 2)
      assert.equal(data.today.id, secondSession)
      const updated = withUpdatedTemplates(
        data,
        data.templates.filter((item) => item.id !== secondSession),
      )
      // The browser helper uses the device day, so only assert routine membership here.
      assert.ok(updated.todaySessions.every((item) => item.routineId === originalRoutine))
    },
  )
  await t.test(
    'assigning an existing session adds a day without duplicates or changing its exercises/history',
    async () => {
      const extraDay = (day + 1) % 7
      const assigned = await request('/templates/222/schedule', 'POST', { day: extraDay })
      assert.equal(assigned.status, 200)
      assert.equal(assigned.data.id, 222)
      assert.deepEqual(
        assigned.data.scheduledDays,
        [day, extraDay].sort((a, b) => a - b),
      )
      assert.equal(assigned.data.exercises[0].id, 1000)
      assert.equal(assigned.data.exercises[0].targetSets, 3)
      const repeated = await request('/templates/222/schedule', 'POST', { day: extraDay })
      assert.deepEqual(repeated.data.scheduledDays, assigned.data.scheduledDays)
      assert.equal((await request('/bootstrap')).data.templates.length, 2)
      assert.equal(
        (await request('/exercises/1000/history?templateId=222')).data.sessions.length,
        1,
      )
      assert.equal((await request('/templates/222/schedule', 'POST', { day: 7 })).status, 400)
      assert.equal((await request('/templates/222/schedule', 'POST', {})).status, 400)
    },
  )
  let secondRoutine
  await t.test(
    'active routine controls dashboard without losing the other weekly plan',
    async () => {
      secondRoutine = (await request('/routines', 'POST', { name: 'Upper Lower' })).data.id
      assert.equal((await request(`/routines/${secondRoutine}/activate`, 'POST', {})).status, 200)
      data = (await request('/bootstrap')).data
      assert.equal(data.today, null)
      assert.equal(data.todaySessions.length, 0)
      assert.equal(data.templates.length, 2)
      const created = await request('/templates', 'POST', plan('Upper', secondRoutine))
      assert.equal(created.status, 200)
      data = (await request('/bootstrap')).data
      assert.deepEqual(
        data.todaySessions.map((item) => item.id),
        [created.data.id],
      )
      assert.equal(
        (await request(`/routines/${secondRoutine}`, 'PUT', { name: 'Renamed week' })).status,
        200,
      )
    },
  )
  await t.test(
    'routine ownership is enforced for reads through mutations and session assignment',
    async () => {
      const other = client()
      assert.equal(
        (
          await other('/auth/register', 'POST', {
            username: 'routine_other',
            password: 'Temporary-Routine-987',
            confirmPassword: 'Temporary-Routine-987',
          })
        ).status,
        200,
      )
      assert.equal((await other(`/routines/${originalRoutine}/activate`, 'POST', {})).status, 404)
      assert.equal(
        (await other(`/routines/${originalRoutine}`, 'PUT', { name: 'Not mine' })).status,
        404,
      )
      assert.equal((await other(`/routines/${originalRoutine}`, 'DELETE')).status, 404)
      assert.equal((await other('/templates/222/schedule', 'POST', { day })).status, 404)
      const builtin = (await other('/bootstrap')).data.exercises.find((item) => !item.isCustom)
      assert.equal(
        (
          await other('/templates', 'POST', {
            ...plan('Invalid owner'),
            exercises: [{ id: builtin.id, targetSets: 3 }],
          })
        ).status,
        404,
      )
    },
  )
  await t.test(
    'account, movement archive, set retry, and history deletion survive route extraction',
    async () => {
      const profile = await request('/profile', 'PUT', {
        username: 'routine_owner',
        email: 'owner@example.com',
      })
      assert.equal(profile.status, 200)
      assert.equal(profile.data.user.email, 'owner@example.com')
      const movement = await request('/exercises', 'POST', {
        name: 'Archive fixture',
        muscleGroup: 'Core',
      })
      assert.equal(movement.status, 200)
      const session = await request('/templates', 'POST', {
        name: 'Archive fixture',
        routineId: secondRoutine,
        scheduledDays: [],
        exercises: [{ id: movement.data.id, targetSets: 2 }],
      })
      assert.equal(session.status, 200)
      const workout = (await request('/workouts', 'POST', { templateId: session.data.id })).data
      const payload = { exerciseId: movement.data.id, weight: 10, reps: 5, requestId: randomUUID() }
      assert.equal(
        (await request(`/workouts/${workout.id}/sets`, 'POST', payload)).data.logs.length,
        1,
      )
      assert.equal(
        (await request(`/workouts/${workout.id}/sets`, 'POST', payload)).data.logs.length,
        1,
      )
      assert.equal((await request(`/workouts/${workout.id}/finish`, 'POST', {})).status, 200)
      assert.equal((await request(`/exercises/${movement.data.id}`, 'DELETE')).status, 200)
      const latest = (await request('/bootstrap')).data
      assert.ok(!latest.exercises.some((exercise) => exercise.id === movement.data.id))
      assert.ok(
        latest.templates
          .find((item) => item.id === session.data.id)
          .exercises.some((exercise) => exercise.id === movement.data.id),
      )
      const history = await request(
        `/exercises/${movement.data.id}/history?templateId=${session.data.id}`,
      )
      assert.equal(history.data.sessions.length, 1)
      const month = new Date().toISOString().slice(0, 7)
      assert.ok(
        (await request(`/history?month=${month}`)).data.sessions.some(
          (item) => item.id === workout.id,
        ),
      )
      assert.equal((await request(`/history/${workout.id}`, 'DELETE')).status, 200)
      assert.equal(
        (await request(`/exercises/${movement.data.id}/history?templateId=${session.data.id}`)).data
          .sessions.length,
        0,
      )
    },
  )
  await t.test(
    'deleting a routine is blocked during training and preserves finished history afterward',
    async () => {
      await request(`/routines/${originalRoutine}/activate`, 'POST', {})
      const workout = (await request('/workouts', 'POST', { templateId: 222 })).data
      assert.equal(
        (
          await request(`/workouts/${workout.id}/sets`, 'POST', {
            exerciseId: 1000,
            weight: 30,
            reps: 8,
            requestId: randomUUID(),
          })
        ).status,
        200,
      )
      assert.equal(
        (await request('/templates/222/schedule', 'POST', { day: (day + 2) % 7 })).status,
        200,
      )
      assert.equal((await request(`/routines/${originalRoutine}`, 'DELETE')).status, 409)
      assert.equal((await request(`/workouts/${workout.id}/finish`, 'POST', {})).status, 200)
      assert.equal((await request(`/routines/${originalRoutine}`, 'DELETE')).status, 200)
      data = (await request('/bootstrap')).data
      assert.equal(data.activeRoutineId, secondRoutine)
      assert.ok(!data.templates.some((item) => item.id === 222 || item.id === secondSession))
      assert.equal((await request('/templates/222/schedule', 'POST', { day })).status, 404)
      assert.equal(
        (await request('/exercises/1000/history?templateId=222')).data.sessions.length,
        2,
      )
      assert.equal((await request(`/routines/${secondRoutine}`, 'DELETE')).status, 409)
    },
  )
})
