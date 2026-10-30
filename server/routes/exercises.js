import { text, muscleGroups, fail, id } from '../validation.js'
import { get, run, all } from '../database.js'

function registerExercisesRoutes(app) {
  // Exercises
  app.post('/api/exercises', (req, res) => {
    const body = req.body ?? {}
    const name = text(body.name, 'Exercise name', 100)
    const group = body.muscleGroup || 'Other'
    if (!muscleGroups.has(group)) fail(400, 'Choose a valid muscle group.')
    if (
      get(
        'SELECT COUNT(*) AS count FROM exercises WHERE created_by=? AND is_custom=1 AND archived=0',
        req.user.id,
      ).count >= 200
    )
      fail(409, 'You can save up to 200 active custom exercises.')
    const result = run(
      'INSERT INTO exercises (name,muscle_group,is_custom,created_by) VALUES (?,?,1,?)',
      name,
      group,
      req.user.id,
    )
    res.json({ id: result.lastInsertRowid, name, muscleGroup: group, isCustom: 1 })
  })
  app.delete('/api/exercises/:id', (req, res) => {
    const exerciseId = id(req.params.id)
    const exercise = get(
      'SELECT id FROM exercises WHERE id=? AND created_by=? AND is_custom=1',
      exerciseId,
      req.user.id,
    )
    if (!exercise) fail(404, 'Custom exercise not found.')
    run(
      'UPDATE exercises SET archived=1 WHERE id=? AND created_by=? AND is_custom=1',
      exerciseId,
      req.user.id,
    )
    res.json({ ok: true })
  })
  app.get('/api/exercises/:id/history', (req, res) => {
    const exerciseId = id(req.params.id)
    const templateId = id(req.query.templateId)
    const template = get(
      'SELECT id, name FROM templates WHERE id=? AND user_id=?',
      templateId,
      req.user.id,
    )
    if (!template) fail(404, 'Schedule not found.')
    const exercise = get(
      'SELECT name FROM exercises WHERE id=? AND (is_custom=0 OR created_by=?)',
      exerciseId,
      req.user.id,
    )
    if (!exercise) fail(404, 'Exercise not found.')
    const sessions = all(
      "SELECT ws.finished_at AS date, sl.weight, sl.reps FROM set_logs sl JOIN workout_sessions ws ON ws.id=sl.session_id WHERE ws.user_id=? AND ws.template_id=? AND sl.exercise_id=? AND ws.status='finished' ORDER BY ws.finished_at, ws.id, sl.set_number",
      req.user.id,
      templateId,
      exerciseId,
    )
    res.json({ exercise: exercise.name, templateId, templateName: template.name, sessions })
  })
}

export { registerExercisesRoutes }
