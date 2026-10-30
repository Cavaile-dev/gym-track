import { get, transaction, run, now } from '../database.js'
import { fail, id, number } from '../validation.js'
import {
  validateTemplate,
  ensureRoutine,
  ownRoutine,
  templateShape,
  editableTemplate,
  parseDays,
} from '../services/training.js'

function registerTemplatesRoutes(app) {
  // Schedules (templates)
  function saveTemplate(req, res, existing) {
    if (
      !existing &&
      get('SELECT COUNT(*) AS count FROM templates WHERE user_id=? AND archived=0', req.user.id)
        .count >= 100
    )
      fail(409, 'You can save up to 100 schedules.')
    const payload = validateTemplate(req.user.id, req.body ?? {}, existing?.id ?? null)
    const routineId =
      req.body?.routineId === undefined
        ? (existing?.routine_id ?? ensureRoutine(req.user.id).id)
        : id(req.body.routineId)
    ownRoutine(routineId, req.user.id)
    const templateId = transaction(() => {
      let target = existing?.id
      if (target) {
        run(
          'UPDATE templates SET name=?, scheduled_days=?, routine_id=? WHERE id=? AND user_id=?',
          payload.name,
          JSON.stringify(payload.days),
          routineId,
          target,
          req.user.id,
        )
        run('DELETE FROM template_exercises WHERE template_id=?', target)
      } else {
        target = run(
          'INSERT INTO templates (user_id,name,scheduled_days,created_at,routine_id) VALUES (?,?,?,?,?)',
          req.user.id,
          payload.name,
          JSON.stringify(payload.days),
          now(),
          routineId,
        ).lastInsertRowid
      }
      payload.exercises.forEach((exercise, position) =>
        run(
          'INSERT INTO template_exercises (template_id,exercise_id,position,target_sets) VALUES (?,?,?,?)',
          target,
          exercise.id,
          position,
          exercise.targetSets,
        ),
      )
      return target
    })
    res.json(
      templateShape(
        get('SELECT * FROM templates WHERE id=? AND user_id=?', templateId, req.user.id),
      ),
    )
  }
  app.post('/api/templates', (req, res) => saveTemplate(req, res, null))
  app.put('/api/templates/:id', (req, res) =>
    saveTemplate(req, res, editableTemplate(id(req.params.id), req.user.id)),
  )
  // Assign an existing session without rebuilding its exercises or changing workout data.
  app.post('/api/templates/:id/schedule', (req, res) => {
    const templateId = id(req.params.id)
    const day = number(req.body?.day, 'Day', 0, 6)
    const template = get(
      'SELECT * FROM templates WHERE id=? AND user_id=? AND archived=0',
      templateId,
      req.user.id,
    )
    if (!template) fail(404, 'Session not found.')
    const days = [...new Set([...parseDays(template.scheduled_days), day])].sort((a, b) => a - b)
    run(
      'UPDATE templates SET scheduled_days=? WHERE id=? AND user_id=?',
      JSON.stringify(days),
      templateId,
      req.user.id,
    )
    res.json(
      templateShape(
        get('SELECT * FROM templates WHERE id=? AND user_id=?', templateId, req.user.id),
      ),
    )
  })
  app.delete('/api/templates/:id', (req, res) => {
    const template = editableTemplate(id(req.params.id), req.user.id)
    run(
      "UPDATE templates SET archived=1, scheduled_days='[]' WHERE id=? AND user_id=?",
      template.id,
      req.user.id,
    )
    res.json({ ok: true })
  })
}

export { registerTemplatesRoutes }
