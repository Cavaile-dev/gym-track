import { timeZone, dateContext, dayKey } from '../time.js'
import { all, get, run, now } from '../database.js'
import { fail, text, id, number } from '../validation.js'

const defaultZone = timeZone(
  process.env.APP_TIME_ZONE,
  Intl.DateTimeFormat().resolvedOptions().timeZone,
)

const zoneFor = (req) => timeZone(req.get('X-Time-Zone'), defaultZone)

function parseDays(value) {
  try {
    return JSON.parse(value || '[]')
  } catch {
    return []
  }
}

function templateShape(template) {
  if (!template) return null
  const exercises = all(
    `SELECT e.id, e.name, e.muscle_group AS muscleGroup, te.target_sets AS targetSets, te.position
    FROM template_exercises te JOIN exercises e ON e.id=te.exercise_id WHERE te.template_id=? ORDER BY te.position`,
    template.id,
  )
  const last = get(
    "SELECT MAX(finished_at) AS date FROM workout_sessions WHERE template_id=? AND user_id=? AND status='finished'",
    template.id,
    template.user_id,
  )
  return {
    id: template.id,
    routineId: template.routine_id,
    name: template.name,
    scheduledDays: parseDays(template.scheduled_days),
    exercises,
    lastPerformed: last?.date || null,
  }
}

function activeShape(session) {
  if (!session) return null
  const template = templateShape(
    get('SELECT * FROM templates WHERE id=? AND user_id=?', session.template_id, session.user_id),
  )
  const logs = all(
    'SELECT id, exercise_id AS exerciseId, set_number AS setNumber, weight, reps, logged_at AS loggedAt FROM set_logs WHERE session_id=? ORDER BY logged_at, id',
    session.id,
  )
  const previous = all(
    `SELECT exerciseId, weight, reps, finishedAt FROM (
    SELECT sl.exercise_id AS exerciseId, sl.weight, sl.reps, ws.finished_at AS finishedAt,
      ROW_NUMBER() OVER(PARTITION BY sl.exercise_id ORDER BY ws.finished_at DESC, ws.id DESC, sl.set_number ASC) AS rank
    FROM set_logs sl JOIN workout_sessions ws ON ws.id=sl.session_id
    WHERE ws.user_id=? AND ws.template_id=? AND ws.status='finished' AND ws.finished_at<?
      AND sl.exercise_id IN (SELECT exercise_id FROM template_exercises WHERE template_id=?)
  ) WHERE rank=1`,
    session.user_id,
    session.template_id,
    session.started_at,
    session.template_id,
  )
  return {
    id: session.id,
    template,
    startedAt: session.started_at,
    logs,
    previous: Object.fromEntries(previous.map((entry) => [entry.exerciseId, entry])),
  }
}

function stats(userId, zone) {
  const context = dateContext(zone)
  const earliest =
    context.monthStart < context.previousWeekStart ? context.monthStart : context.previousWeekStart
  const totals = get(
    `SELECT
    COUNT(DISTINCT CASE WHEN ws.finished_at>=? THEN ws.id END) AS workoutsWeek,
    COUNT(DISTINCT CASE WHEN ws.finished_at>=? THEN ws.id END) AS workoutsMonth,
    COALESCE(SUM(CASE WHEN ws.finished_at>=? THEN sl.weight*sl.reps ELSE 0 END),0) AS volume,
    COALESCE(SUM(CASE WHEN ws.finished_at>=? AND ws.finished_at<? THEN sl.weight*sl.reps ELSE 0 END),0) AS previousVolume
    FROM workout_sessions ws LEFT JOIN set_logs sl ON sl.session_id=ws.id
    WHERE ws.user_id=? AND ws.status='finished' AND ws.finished_at>=?`,
    context.weekStart,
    context.monthStart,
    context.weekStart,
    context.previousWeekStart,
    context.weekStart,
    userId,
    earliest,
  )
  const records = all(
    `SELECT name, weight, reps, date FROM (
    SELECT e.name, sl.weight, sl.reps, ws.finished_at AS date,
    ROW_NUMBER() OVER(PARTITION BY sl.exercise_id ORDER BY sl.weight DESC, sl.reps DESC, ws.finished_at DESC) AS rank
    FROM set_logs sl JOIN exercises e ON e.id=sl.exercise_id JOIN workout_sessions ws ON ws.id=sl.session_id
    WHERE ws.user_id=? AND ws.status='finished') WHERE rank=1 ORDER BY weight DESC, reps DESC LIMIT 3`,
    userId,
  )
  const dates = all(
    "SELECT DISTINCT finished_at AS date FROM workout_sessions WHERE user_id=? AND status='finished'",
    userId,
  )
  const totalDays = new Set(dates.map((entry) => dayKey(entry.date, zone))).size
  return {
    workoutsWeek: totals.workoutsWeek,
    workoutsMonth: totals.workoutsMonth,
    volume: Math.round(totals.volume),
    volumeDelta: totals.previousVolume
      ? Math.round(((totals.volume - totals.previousVolume) / totals.previousVolume) * 100)
      : null,
    records: records.map((record) => ({ ...record })),
    totalDays,
  }
}

function ensureRoutine(userId) {
  let routine = get(
    'SELECT * FROM routines WHERE user_id=? ORDER BY is_active DESC,id LIMIT 1',
    userId,
  )
  if (!routine) {
    const result = run(
      'INSERT INTO routines (user_id,name,is_active,created_at) VALUES (?,?,1,?)',
      userId,
      'My Training Week',
      now(),
    )
    routine = get('SELECT * FROM routines WHERE id=?', result.lastInsertRowid)
  }
  run(
    'UPDATE templates SET routine_id=? WHERE user_id=? AND routine_id IS NULL',
    routine.id,
    userId,
  )
  return routine
}

function ownRoutine(routineId, userId) {
  const routine = get('SELECT * FROM routines WHERE id=? AND user_id=?', routineId, userId)
  if (!routine) fail(404, 'Routine not found.')
  return routine
}

function bootstrap(userId, zone) {
  const activeRoutine = ensureRoutine(userId)
  const routines = all(
    'SELECT id,name,is_active AS isActive FROM routines WHERE user_id=? ORDER BY id',
    userId,
  )
  const templates = all(
    'SELECT * FROM templates WHERE user_id=? AND archived=0 ORDER BY id',
    userId,
  ).map(templateShape)
  const exercises = all(
    'SELECT id, name, muscle_group AS muscleGroup, is_custom AS isCustom FROM exercises WHERE archived=0 AND (is_custom=0 OR created_by=?) ORDER BY name',
    userId,
  )
  const active = get(
    "SELECT * FROM workout_sessions WHERE user_id=? AND status='active' ORDER BY started_at DESC LIMIT 1",
    userId,
  )
  const todaySessions = templates
    .filter(
      (template) =>
        template.routineId === activeRoutine.id &&
        template.scheduledDays.includes(dateContext(zone).dayIndex),
    )
    .map((template) => ({
      ...template,
      completedToday: Boolean(
        template.lastPerformed && dayKey(template.lastPerformed, zone) === dayKey(new Date(), zone),
      ),
    }))
  return {
    routines,
    activeRoutineId: activeRoutine.id,
    templates,
    exercises,
    todaySessions,
    today: todaySessions.find((template) => !template.completedToday) || todaySessions[0] || null,
    active: activeShape(active),
    stats: stats(userId, zone),
  }
}

function validateTemplate(userId, body, existingTemplateId = null) {
  const name = text(body.name, 'Schedule name', 80)
  if (
    !Array.isArray(body.scheduledDays) ||
    body.scheduledDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    fail(400, 'Choose valid scheduled days.')
  const days = [...new Set(body.scheduledDays)].sort()
  if (!Array.isArray(body.exercises) || body.exercises.length < 1 || body.exercises.length > 30)
    fail(400, 'Choose 1â€“30 exercises.')
  const exercises = body.exercises.map((exercise) => ({
    id: id(exercise?.id),
    targetSets: number(exercise?.targetSets, 'Target sets', 1, 30),
  }))
  if (new Set(exercises.map((exercise) => exercise.id)).size !== exercises.length)
    fail(400, 'An exercise can only appear once in a schedule.')
  const available = all(
    `SELECT id FROM exercises WHERE id IN (${exercises.map(() => '?').join(',')}) AND (is_custom=0 OR created_by=?) AND (archived=0 OR id IN (SELECT exercise_id FROM template_exercises WHERE template_id=?))`,
    ...exercises.map((exercise) => exercise.id),
    userId,
    existingTemplateId,
  )
  if (available.length !== exercises.length) fail(400, 'One or more exercises are unavailable.')
  return { name, days, exercises }
}

function editableTemplate(templateId, userId) {
  const template = get(
    'SELECT * FROM templates WHERE id=? AND user_id=? AND archived=0',
    templateId,
    userId,
  )
  if (!template) fail(404, 'Schedule not found.')
  if (
    get(
      "SELECT id FROM workout_sessions WHERE template_id=? AND user_id=? AND status='active'",
      templateId,
      userId,
    )
  )
    fail(409, 'Finish or leave the active workout before changing this schedule.')
  return template
}

function ownWorkout(req) {
  const session = get(
    'SELECT * FROM workout_sessions WHERE id=? AND user_id=?',
    id(req.params.id),
    req.user.id,
  )
  if (!session) fail(404, 'Workout not found.')
  return session
}

const requireActive = (session) => {
  if (session.status !== 'active') fail(409, 'This workout is no longer active.')
}

export {
  defaultZone,
  zoneFor,
  parseDays,
  templateShape,
  activeShape,
  stats,
  ensureRoutine,
  ownRoutine,
  bootstrap,
  validateTemplate,
  editableTemplate,
  ownWorkout,
  requireActive,
}
