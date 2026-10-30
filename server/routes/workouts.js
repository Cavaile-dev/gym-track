import { id, fail, number, uuidV4 } from '../validation.js'
import { get, run, now, transaction } from '../database.js'
import { activeShape, ownWorkout, requireActive } from '../services/training.js'
import { hash } from '../auth.js'

function registerWorkoutsRoutes(app) {
  // Workouts
  app.post('/api/workouts', (req, res) => {
    const templateId = id(req.body?.templateId)
    if (
      !get(
        'SELECT id FROM templates WHERE id=? AND user_id=? AND archived=0',
        templateId,
        req.user.id,
      )
    )
      fail(404, 'Schedule not found.')
    let active = get(
      "SELECT * FROM workout_sessions WHERE user_id=? AND status='active'",
      req.user.id,
    )
    if (!active) {
      const result = run(
        "INSERT INTO workout_sessions (user_id,template_id,started_at,status) VALUES (?,?,?,'active')",
        req.user.id,
        templateId,
        now(),
      )
      active = get('SELECT * FROM workout_sessions WHERE id=?', result.lastInsertRowid)
    }
    res.json(activeShape(active))
  })
  app.get('/api/workouts/:id', (req, res) => {
    const session = ownWorkout(req)
    requireActive(session)
    res.json(activeShape(session))
  })
  app.post('/api/workouts/:id/sets', (req, res) => {
    const session = ownWorkout(req)
    requireActive(session)
    const body = req.body ?? {}
    const exerciseId = id(body.exerciseId)
    const weight = number(body.weight, 'Weight', 0, 2000, false)
    const reps = number(body.reps, 'Reps', 1, 1000)
    if (typeof body.requestId !== 'string' || !uuidV4.test(body.requestId))
      fail(400, 'A valid request ID is required to save a set safely.')
    const requestId = body.requestId.toLowerCase()
    const payloadHash = hash(JSON.stringify([exerciseId, weight, reps]))
    if (
      !get(
        'SELECT 1 AS ok FROM template_exercises WHERE template_id=? AND exercise_id=?',
        session.template_id,
        exerciseId,
      )
    )
      fail(400, 'This exercise is not part of this workout.')
    transaction(() => {
      const previous = get(
        'SELECT payload_hash FROM set_requests WHERE session_id=? AND request_id=?',
        session.id,
        requestId,
      )
      if (previous) {
        if (previous.payload_hash !== payloadHash)
          fail(409, 'This request ID was already used for a different set.')
        return
      }
      if (
        get('SELECT COUNT(*) AS count FROM set_requests WHERE session_id=?', session.id).count >=
        1200
      )
        fail(409, 'This workout is no longer active or has reached its set request limit.')
      const setNumber = get(
        'SELECT COALESCE(MAX(set_number),0)+1 AS number FROM set_logs WHERE session_id=? AND exercise_id=?',
        session.id,
        exerciseId,
      ).number
      const log = run(
        'INSERT INTO set_logs (session_id,exercise_id,set_number,weight,reps,logged_at) VALUES (?,?,?,?,?,?)',
        session.id,
        exerciseId,
        setNumber,
        weight,
        reps,
        now(),
      )
      run(
        'INSERT INTO set_requests (session_id,request_id,payload_hash,log_id) VALUES (?,?,?,?)',
        session.id,
        requestId,
        payloadHash,
        log.lastInsertRowid,
      )
    })
    res.json(activeShape(session))
  })
  app.delete('/api/workouts/:id/sets/:setId', (req, res) => {
    const session = ownWorkout(req)
    requireActive(session)
    run('DELETE FROM set_logs WHERE id=? AND session_id=?', id(req.params.setId), session.id)
    res.json(activeShape(session))
  })
  app.post('/api/workouts/:id/finish', (req, res) => {
    const session = ownWorkout(req)
    if (session.status === 'finished') return res.json({ ok: true })
    requireActive(session)
    if (!get('SELECT COUNT(*) AS count FROM set_logs WHERE session_id=?', session.id).count)
      fail(400, 'Log at least one set before finishing this workout.')
    run(
      "UPDATE workout_sessions SET status='finished', finished_at=? WHERE id=? AND user_id=? AND status='active'",
      now(),
      session.id,
      req.user.id,
    )
    res.json({ ok: true })
  })
  app.post('/api/workouts/:id/abandon', (req, res) => {
    const session = ownWorkout(req)
    if (session.status === 'abandoned') return res.json({ ok: true })
    requireActive(session)
    run(
      "UPDATE workout_sessions SET status='abandoned', finished_at=? WHERE id=? AND user_id=? AND status='active'",
      now(),
      session.id,
      req.user.id,
    )
    res.json({ ok: true })
  })
}

export { registerWorkoutsRoutes }
