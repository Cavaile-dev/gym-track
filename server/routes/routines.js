import { ensureRoutine, ownRoutine } from '../services/training.js'
import { get, run, now, transaction } from '../database.js'
import { fail, text, id } from '../validation.js'

function registerRoutinesRoutes(app) {
  // Weekly routines contain workout session templates.
  app.post('/api/routines', (req, res) => {
    ensureRoutine(req.user.id)
    if (get('SELECT COUNT(*) AS count FROM routines WHERE user_id=?', req.user.id).count >= 20)
      fail(409, 'You can save up to 20 routines.')
    const result = run(
      'INSERT INTO routines (user_id,name,is_active,created_at) VALUES (?,?,0,?)',
      req.user.id,
      text(req.body?.name, 'Routine name', 80),
      now(),
    )
    res.json({ id: Number(result.lastInsertRowid) })
  })
  app.put('/api/routines/:id', (req, res) => {
    const routine = ownRoutine(id(req.params.id), req.user.id)
    run(
      'UPDATE routines SET name=? WHERE id=?',
      text(req.body?.name, 'Routine name', 80),
      routine.id,
    )
    res.json({ ok: true })
  })
  app.post('/api/routines/:id/activate', (req, res) => {
    const routine = ownRoutine(id(req.params.id), req.user.id)
    transaction(() => {
      run('UPDATE routines SET is_active=0 WHERE user_id=?', req.user.id)
      run('UPDATE routines SET is_active=1 WHERE id=?', routine.id)
    })
    res.json({ ok: true })
  })
  app.delete('/api/routines/:id', (req, res) => {
    const routine = ownRoutine(id(req.params.id), req.user.id)
    if (get('SELECT COUNT(*) AS count FROM routines WHERE user_id=?', req.user.id).count <= 1)
      fail(409, 'Keep at least one routine.')
    if (
      get(
        "SELECT ws.id FROM workout_sessions ws JOIN templates t ON t.id=ws.template_id WHERE t.routine_id=? AND ws.status='active'",
        routine.id,
      )
    )
      fail(409, 'Finish or leave the active workout before deleting this routine.')
    transaction(() => {
      run("UPDATE templates SET archived=1,scheduled_days='[]' WHERE routine_id=?", routine.id)
      run(
        'UPDATE templates SET routine_id=(SELECT id FROM routines WHERE user_id=? AND id<>? ORDER BY id LIMIT 1) WHERE routine_id=?',
        req.user.id,
        routine.id,
        routine.id,
      )
      run('DELETE FROM routines WHERE id=?', routine.id)
      if (routine.is_active)
        run(
          'UPDATE routines SET is_active=1 WHERE id=(SELECT id FROM routines WHERE user_id=? ORDER BY id LIMIT 1)',
          req.user.id,
        )
    })
    res.json({ ok: true })
  })
}

export { registerRoutinesRoutes }
