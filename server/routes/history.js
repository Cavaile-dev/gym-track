import { zoneFor } from '../services/training.js'
import { monthBounds } from '../time.js'
import { fail, id } from '../validation.js'
import { all, get, transaction, run } from '../database.js'

function registerHistoryRoutes(app) {
  // History
  app.get('/api/history', (req, res) => {
    const zone = zoneFor(req)
    const month =
      typeof req.query.month === 'string' ? req.query.month : new Date().toISOString().slice(0, 7)
    const bounds = monthBounds(month, zone)
    if (!bounds) fail(400, 'Choose a valid month.')
    const sessions = all(
      "SELECT ws.id, ws.template_id AS templateId, ws.started_at AS startedAt, ws.finished_at AS finishedAt, t.name FROM workout_sessions ws JOIN templates t ON t.id=ws.template_id WHERE ws.user_id=? AND ws.status='finished' AND ws.finished_at>=? AND ws.finished_at<? ORDER BY ws.finished_at DESC",
      req.user.id,
      ...bounds,
    )
    const sets = all(
      "SELECT sl.session_id AS sessionId, sl.exercise_id AS exerciseId, e.name, sl.set_number AS setNumber, sl.weight, sl.reps FROM set_logs sl JOIN exercises e ON e.id=sl.exercise_id JOIN workout_sessions ws ON ws.id=sl.session_id WHERE ws.user_id=? AND ws.status='finished' AND ws.finished_at>=? AND ws.finished_at<? ORDER BY sl.exercise_id, sl.set_number",
      req.user.id,
      ...bounds,
    )
    const grouped = new Map()
    for (const { sessionId, ...set } of sets) {
      if (!grouped.has(sessionId)) grouped.set(sessionId, [])
      grouped.get(sessionId).push({ ...set })
    }
    res.json({
      sessions: sessions.map((session) => ({ ...session, sets: grouped.get(session.id) || [] })),
    })
  })
  app.delete('/api/history/:id', (req, res) => {
    const session = get(
      "SELECT id FROM workout_sessions WHERE id=? AND user_id=? AND status='finished'",
      id(req.params.id),
      req.user.id,
    )
    if (!session) fail(404, 'Session not found.')
    transaction(() => {
      run('DELETE FROM set_requests WHERE session_id=?', session.id)
      run('DELETE FROM set_logs WHERE session_id=?', session.id)
      run('DELETE FROM workout_sessions WHERE id=?', session.id)
    })
    res.json({ ok: true })
  })
}

export { registerHistoryRoutes }
