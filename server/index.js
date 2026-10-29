import express from 'express'
import bcrypt from 'bcryptjs'
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dateContext, dayKey, monthBounds, timeZone } from './time.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const databasePath = process.env.DATABASE_PATH || path.join(root, 'gym-track.sqlite')
mkdirSync(path.dirname(databasePath), { recursive: true })
const db = new DatabaseSync(databasePath)
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS exercises (id INTEGER PRIMARY KEY, name TEXT NOT NULL, muscle_group TEXT NOT NULL, is_custom INTEGER DEFAULT 0, created_by INTEGER);
  CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL, scheduled_days TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS template_exercises (template_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL, position INTEGER NOT NULL, target_sets INTEGER NOT NULL DEFAULT 3, PRIMARY KEY(template_id, exercise_id), FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE CASCADE, FOREIGN KEY(exercise_id) REFERENCES exercises(id));
  CREATE TABLE IF NOT EXISTS workout_sessions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, template_id INTEGER NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL DEFAULT 'active', FOREIGN KEY(user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS set_logs (id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL, set_number INTEGER NOT NULL, weight REAL NOT NULL, reps INTEGER NOT NULL, logged_at TEXT NOT NULL, FOREIGN KEY(session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE);
`)
if (!db.prepare('PRAGMA table_info(templates)').all().some((column) => column.name === 'archived')) db.exec('ALTER TABLE templates ADD COLUMN archived INTEGER NOT NULL DEFAULT 0')

db.exec(`
  CREATE TABLE IF NOT EXISTS set_requests (session_id INTEGER NOT NULL, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL, log_id INTEGER NOT NULL, PRIMARY KEY(session_id, request_id), FOREIGN KEY(session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_exercises_owner ON exercises(created_by, is_custom);
  CREATE INDEX IF NOT EXISTS idx_templates_owner ON templates(user_id, archived);
  CREATE INDEX IF NOT EXISTS idx_workouts_user_finished ON workout_sessions(user_id, status, finished_at);
  CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON set_logs(exercise_id, session_id);
`)

const builtInExercises = [
  // Chest
  ['Bench Press', 'Chest'], ['Incline Dumbbell Press', 'Chest'], ['Cable Fly', 'Chest'],
  ['Push-Up', 'Chest'], ['Dumbbell Bench Press', 'Chest'], ['Incline Barbell Bench Press', 'Chest'],
  ['Decline Bench Press', 'Chest'], ['Machine Chest Press', 'Chest'], ['Pec Deck Fly', 'Chest'],
  ['Dumbbell Fly', 'Chest'], ['Incline Cable Fly', 'Chest'], ['Chest Dip', 'Chest'],
  ['Close-Grip Bench Press', 'Triceps'], ['Dumbbell Pullover', 'Chest'], ['Landmine Press', 'Shoulders'],
  ['Svend Press', 'Chest'],

  // Shoulders
  ['Overhead Press', 'Shoulders'], ['Lateral Raise', 'Shoulders'], ['Seated Dumbbell Shoulder Press', 'Shoulders'],
  ['Arnold Press', 'Shoulders'], ['Front Raise', 'Shoulders'], ['Rear Delt Fly', 'Shoulders'],
  ['Reverse Pec Deck Fly', 'Shoulders'], ['Face Pull', 'Shoulders'], ['Upright Row', 'Shoulders'],
  ['Cable Lateral Raise', 'Shoulders'], ['Machine Shoulder Press', 'Shoulders'], ['Dumbbell Shrug', 'Upper Back'],
  ['Barbell Shrug', 'Upper Back'], ['Cable External Rotation', 'Shoulders'], ['Pike Push-Up', 'Shoulders'],

  // Back
  ['Barbell Row', 'Upper Back'], ['Lat Pulldown', 'Lats'], ['Deadlift', 'Full Body'],
  ['Pull-Up', 'Lats'], ['Chin-Up', 'Lats'], ['Seated Cable Row', 'Upper Back'],
  ['One-Arm Dumbbell Row', 'Lats'], ['Chest-Supported Row', 'Upper Back'], ['T-Bar Row', 'Upper Back'],
  ['Machine Row', 'Upper Back'], ['Straight-Arm Pulldown', 'Lats'], ['Inverted Row', 'Upper Back'],
  ['Good Morning', 'Hamstrings'], ['Back Extension', 'Lower Back'], ['Rack Pull', 'Lower Back'],
  ['Meadows Row', 'Lats'], ['Cable Pullover', 'Lats'],

  // Legs and glutes
  ['Squat', 'Quadriceps'], ['Leg Press', 'Quadriceps'], ['Romanian Deadlift', 'Hamstrings'],
  ['Front Squat', 'Quadriceps'], ['Goblet Squat', 'Quadriceps'], ['Hack Squat', 'Quadriceps'],
  ['Bulgarian Split Squat', 'Quadriceps'], ['Forward Lunge', 'Quadriceps'], ['Reverse Lunge', 'Glutes'],
  ['Walking Lunge', 'Quadriceps'], ['Step-Up', 'Glutes'], ['Leg Extension', 'Quadriceps'],
  ['Seated Leg Curl', 'Hamstrings'], ['Lying Leg Curl', 'Hamstrings'], ['Hip Thrust', 'Glutes'],
  ['Glute Bridge', 'Glutes'], ['Sumo Deadlift', 'Glutes'], ['Standing Calf Raise', 'Calves'],
  ['Seated Calf Raise', 'Calves'], ['Hip Abduction', 'Glutes'], ['Hip Adduction', 'Adductors'],
  ['Cable Glute Kickback', 'Glutes'],

  // Arms
  ['Bicep Curl', 'Biceps'], ['Tricep Pushdown', 'Triceps'], ['Hammer Curl', 'Biceps'],
  ['Preacher Curl', 'Biceps'], ['Incline Dumbbell Curl', 'Biceps'], ['Concentration Curl', 'Biceps'],
  ['Cable Curl', 'Biceps'], ['EZ-Bar Curl', 'Biceps'], ['Reverse Curl', 'Forearms'],
  ['Skull Crusher', 'Triceps'], ['Overhead Tricep Extension', 'Triceps'], ['Tricep Dip', 'Triceps'],
  ['Cable Overhead Tricep Extension', 'Triceps'], ['Tricep Kickback', 'Triceps'], ['Wrist Curl', 'Forearms'],
  ['Reverse Wrist Curl', 'Forearms'], ['Zottman Curl', 'Biceps'],

  // Core
  ['Plank', 'Core'], ['Side Plank', 'Core'], ['Crunch', 'Core'],
  ['Bicycle Crunch', 'Core'], ['Reverse Crunch', 'Core'], ['Hanging Knee Raise', 'Core'],
  ['Hanging Leg Raise', 'Core'], ['Cable Crunch', 'Core'], ['Ab Wheel Rollout', 'Core'],
  ['Russian Twist', 'Core'], ['Dead Bug', 'Core'], ['Bird Dog', 'Core'],
  ['Mountain Climber', 'Core'], ['Pallof Press', 'Core'], ['Cable Wood Chop', 'Core'],
  ['Hollow Body Hold', 'Core'],

  // Full-body and conditioning
  ["Farmer's Carry", 'Full Body'], ['Burpee', 'Full Body'], ['Clean and Press', 'Full Body'],
  ['Kettlebell Swing', 'Full Body'], ['Turkish Get-Up', 'Full Body'], ['Battle Rope Waves', 'Full Body'],
  ['Sled Push', 'Full Body'], ['Box Jump', 'Full Body'], ['Dumbbell Thruster', 'Full Body'],
]

const findBuiltInExercise = db.prepare('SELECT id, muscle_group FROM exercises WHERE name = ? COLLATE NOCASE AND is_custom = 0 LIMIT 1')
const findMatchingCustomExercise = db.prepare('SELECT id FROM exercises WHERE name = ? COLLATE NOCASE AND is_custom = 1 LIMIT 1')
const promoteToBuiltIn = db.prepare('UPDATE exercises SET name = ?, muscle_group = ?, is_custom = 0, created_by = NULL WHERE id = ?')
const updateBuiltInGroup = db.prepare('UPDATE exercises SET muscle_group = ? WHERE id = ?')
const insertBuiltIn = db.prepare('INSERT INTO exercises (name, muscle_group, is_custom) VALUES (?, ?, 0)')

db.exec('BEGIN')
try {
  builtInExercises.forEach(([name, muscleGroup]) => {
    const builtIn = findBuiltInExercise.get(name)
    if (builtIn) {
      if (builtIn.muscle_group !== muscleGroup) updateBuiltInGroup.run(muscleGroup, builtIn.id)
      return
    }
    const matchingCustom = findMatchingCustomExercise.get(name)
    if (matchingCustom) promoteToBuiltIn.run(name, muscleGroup, matchingCustom.id)
    else insertBuiltIn.run(name, muscleGroup)
  })
  db.exec('COMMIT')
} catch (error) {
  db.exec('ROLLBACK')
  throw error
}

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  next()
})

class HttpError extends Error { constructor(status, message) { super(message); this.status = status } }
const fail = (status, message) => { throw new HttpError(status, message) }
const get = (sql, ...params) => db.prepare(sql).get(...params) ?? null
const all = (sql, ...params) => db.prepare(sql).all(...params)
const run = (sql, ...params) => db.prepare(sql).run(...params)
const now = () => new Date().toISOString()
const transaction = (callback) => { db.exec('BEGIN'); try { const result = callback(); db.exec('COMMIT'); return result } catch (error) { db.exec('ROLLBACK'); throw error } }
const publicUser = (user) => user ? { id: user.id, username: user.username, email: user.email } : null
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')
const defaultZone = timeZone(process.env.APP_TIME_ZONE, Intl.DateTimeFormat().resolvedOptions().timeZone)
const zoneFor = (req) => timeZone(req.get('X-Time-Zone'), defaultZone)

const muscleGroups = new Set(['Chest', 'Shoulders', 'Lats', 'Upper Back', 'Lower Back', 'Biceps', 'Triceps', 'Forearms', 'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Core', 'Full Body', 'Other'])
function text(value, label, max, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u001f]/.test(value)) fail(400, `${label} must contain ${min}â€“${max} characters.`)
  return value.trim()
}
function number(value, label, min, max, integer = true) {
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '') fail(400, `${label} is required.`)
  const result = Number(value)
  if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isSafeInteger(result))) fail(400, `${label} must be between ${min} and ${max}.`)
  return result
}
const id = (value) => number(value, 'ID', 1, Number.MAX_SAFE_INTEGER)

const cookie = (value, maxAge = 60 * 60 * 24 * 365) => `gym_session=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`
function readCookie(req, name) {
  const raw = req.headers.cookie || ''
  return raw.split(';').map((part) => part.trim().split('=')).find(([key]) => key === name)?.[1]
}
function sessionUser(req) {
  const token = readCookie(req, 'gym_session')
  if (!token) return null
  return get('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', hash(token), now())
}
function auth(req, res, next) {
  const token = readCookie(req, 'gym_session')
  if (!token) fail(401, 'Please sign in to continue.')
  const user = sessionUser(req)
  if (!user) fail(401, 'Your session has expired. Please sign in again.')
  req.user = user
  next()
}
function startSession(userId, res) {
  const token = crypto.randomBytes(32).toString('hex')
  transaction(() => {
    run('DELETE FROM sessions WHERE expires_at<?', now())
    run('DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT 9)', userId, userId)
    run('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', hash(token), userId, new Date(Date.now() + 365 * 86400000).toISOString())
  })
  res.setHeader('Set-Cookie', cookie(token))
}

function parseDays(value) { try { return JSON.parse(value || '[]') } catch { return [] } }
function templateShape(template) {
  if (!template) return null
  const exercises = all(`SELECT e.id, e.name, e.muscle_group AS muscleGroup, te.target_sets AS targetSets, te.position
    FROM template_exercises te JOIN exercises e ON e.id=te.exercise_id WHERE te.template_id=? ORDER BY te.position`, template.id)
  const last = get("SELECT MAX(finished_at) AS date FROM workout_sessions WHERE template_id=? AND user_id=? AND status='finished'", template.id, template.user_id)
  return { id: template.id, name: template.name, scheduledDays: parseDays(template.scheduled_days), exercises, lastPerformed: last?.date || null }
}
function activeShape(session) {
  if (!session) return null
  const template = templateShape(get('SELECT * FROM templates WHERE id=? AND user_id=?', session.template_id, session.user_id))
  const logs = all('SELECT id, exercise_id AS exerciseId, set_number AS setNumber, weight, reps, logged_at AS loggedAt FROM set_logs WHERE session_id=? ORDER BY logged_at, id', session.id)
  const previous = all(`SELECT exerciseId, weight, reps, finishedAt FROM (
    SELECT sl.exercise_id AS exerciseId, sl.weight, sl.reps, ws.finished_at AS finishedAt,
      ROW_NUMBER() OVER(PARTITION BY sl.exercise_id ORDER BY ws.finished_at DESC, ws.id DESC, sl.set_number ASC) AS rank
    FROM set_logs sl JOIN workout_sessions ws ON ws.id=sl.session_id
    WHERE ws.user_id=? AND ws.template_id=? AND ws.status='finished' AND ws.finished_at<?
      AND sl.exercise_id IN (SELECT exercise_id FROM template_exercises WHERE template_id=?)
  ) WHERE rank=1`, session.user_id, session.template_id, session.started_at, session.template_id)
  return { id: session.id, template, startedAt: session.started_at, logs, previous: Object.fromEntries(previous.map((entry) => [entry.exerciseId, entry])) }
}
function stats(userId, zone) {
  const context = dateContext(zone)
  const earliest = context.monthStart < context.previousWeekStart ? context.monthStart : context.previousWeekStart
  const totals = get(`SELECT
    COUNT(DISTINCT CASE WHEN ws.finished_at>=? THEN ws.id END) AS workoutsWeek,
    COUNT(DISTINCT CASE WHEN ws.finished_at>=? THEN ws.id END) AS workoutsMonth,
    COALESCE(SUM(CASE WHEN ws.finished_at>=? THEN sl.weight*sl.reps ELSE 0 END),0) AS volume,
    COALESCE(SUM(CASE WHEN ws.finished_at>=? AND ws.finished_at<? THEN sl.weight*sl.reps ELSE 0 END),0) AS previousVolume
    FROM workout_sessions ws LEFT JOIN set_logs sl ON sl.session_id=ws.id
    WHERE ws.user_id=? AND ws.status='finished' AND ws.finished_at>=?`, context.weekStart, context.monthStart, context.weekStart, context.previousWeekStart, context.weekStart, userId, earliest)
  const records = all(`SELECT name, weight, reps, date FROM (
    SELECT e.name, sl.weight, sl.reps, ws.finished_at AS date,
    ROW_NUMBER() OVER(PARTITION BY sl.exercise_id ORDER BY sl.weight DESC, sl.reps DESC, ws.finished_at DESC) AS rank
    FROM set_logs sl JOIN exercises e ON e.id=sl.exercise_id JOIN workout_sessions ws ON ws.id=sl.session_id
    WHERE ws.user_id=? AND ws.status='finished') WHERE rank=1 ORDER BY weight DESC, reps DESC LIMIT 3`, userId)
  const dates = all("SELECT DISTINCT finished_at AS date FROM workout_sessions WHERE user_id=? AND status='finished'", userId)
  const totalDays = new Set(dates.map((entry) => dayKey(entry.date, zone))).size
  return {
    workoutsWeek: totals.workoutsWeek, workoutsMonth: totals.workoutsMonth, volume: Math.round(totals.volume),
    volumeDelta: totals.previousVolume ? Math.round((totals.volume - totals.previousVolume) / totals.previousVolume * 100) : null,
    records: records.map((record) => ({ ...record })), totalDays,
  }
}
function bootstrap(userId, zone) {
  const templates = all('SELECT * FROM templates WHERE user_id=? AND archived=0 ORDER BY name', userId).map(templateShape)
  const exercises = all('SELECT id, name, muscle_group AS muscleGroup, is_custom AS isCustom FROM exercises WHERE is_custom=0 OR created_by=? ORDER BY name', userId)
  const active = get("SELECT * FROM workout_sessions WHERE user_id=? AND status='active' ORDER BY started_at DESC LIMIT 1", userId)
  return { templates, exercises, today: templates.find((template) => template.scheduledDays.includes(dateContext(zone).dayIndex)) || null, active: activeShape(active), stats: stats(userId, zone) }
}

function validateTemplate(userId, body) {
  const name = text(body.name, 'Schedule name', 80)
  if (!Array.isArray(body.scheduledDays) || body.scheduledDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) fail(400, 'Choose valid scheduled days.')
  const days = [...new Set(body.scheduledDays)].sort()
  if (!Array.isArray(body.exercises) || body.exercises.length < 1 || body.exercises.length > 30) fail(400, 'Choose 1â€“30 exercises.')
  const exercises = body.exercises.map((exercise) => ({ id: id(exercise?.id), targetSets: number(exercise?.targetSets, 'Target sets', 1, 30) }))
  if (new Set(exercises.map((exercise) => exercise.id)).size !== exercises.length) fail(400, 'An exercise can only appear once in a schedule.')
  const available = all(`SELECT id FROM exercises WHERE id IN (${exercises.map(() => '?').join(',')}) AND (is_custom=0 OR created_by=?)`, ...exercises.map((exercise) => exercise.id), userId)
  if (available.length !== exercises.length) fail(400, 'One or more exercises are unavailable.')
  return { name, days, exercises }
}
function editableTemplate(templateId, userId) {
  const template = get('SELECT * FROM templates WHERE id=? AND user_id=? AND archived=0', templateId, userId)
  if (!template) fail(404, 'Schedule not found.')
  if (get("SELECT id FROM workout_sessions WHERE template_id=? AND user_id=? AND status='active'", templateId, userId)) fail(409, 'Finish or leave the active workout before changing this schedule.')
  return template
}
function ownWorkout(req) {
  const session = get('SELECT * FROM workout_sessions WHERE id=? AND user_id=?', id(req.params.id), req.user.id)
  if (!session) fail(404, 'Workout not found.')
  return session
}
const requireActive = (session) => { if (session.status !== 'active') fail(409, 'This workout is no longer active.') }
const uuidV4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

// Authentication
app.get('/api/health', (req, res) => { get('SELECT 1 AS ok'); res.json({ ok: true }) })
app.get('/api/session', (req, res) => res.json({ user: publicUser(sessionUser(req)) }))
app.post('/api/auth/register', (req, res) => {
  const body = req.body ?? {}
  const username = text(body.username, 'Username', 32, 3)
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) fail(400, 'Use letters, numbers, dots, underscores, or hyphens in your username.')
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) fail(400, 'Password must contain 8â€“128 characters.')
  if (body.password !== body.confirmPassword) fail(400, 'Passwords do not match.')
  const email = body.email ? text(body.email, 'Email', 254) : null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.')
  if (get('SELECT id FROM users WHERE lower(username)=lower(?)', username)) fail(409, 'That username is already in use.')
  let result
  try { result = run('INSERT INTO users (username,email,password_hash,created_at) VALUES (?,?,?,?)', username, email, bcrypt.hashSync(body.password, 10), now()) }
  catch (error) { if (/UNIQUE constraint failed: users.username/i.test(error.message)) fail(409, 'That username is already in use.'); throw error }
  startSession(result.lastInsertRowid, res)
  res.json({ user: publicUser(get('SELECT * FROM users WHERE id=?', result.lastInsertRowid)) })
})
app.post('/api/auth/login', (req, res) => {
  const body = req.body ?? {}
  if (typeof body.username !== 'string' || !body.username.trim() || body.username.length > 128 || typeof body.password !== 'string' || body.password.length > 128) fail(401, 'Username or password is incorrect.')
  const user = get('SELECT * FROM users WHERE lower(username)=lower(?)', body.username.trim())
  const valid = bcrypt.compareSync(body.password, user?.password_hash || dummyHash)
  if (!user || !valid) fail(401, 'Username or password is incorrect.')
  startSession(user.id, res)
  res.json({ user: publicUser(user) })
})
const dummyHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10)
app.post('/api/auth/logout', (req, res) => {
  const token = readCookie(req, 'gym_session')
  if (token) run('DELETE FROM sessions WHERE token_hash=?', hash(token))
  res.setHeader('Set-Cookie', cookie('', 0))
  res.json({ ok: true })
})

// Everything below requires a signed-in user.
app.use('/api', auth)
app.get('/api/bootstrap', (req, res) => res.json(bootstrap(req.user.id, zoneFor(req))))

// Exercises
app.post('/api/exercises', (req, res) => {
  const body = req.body ?? {}
  const name = text(body.name, 'Exercise name', 100)
  const group = body.muscleGroup || 'Other'
  if (!muscleGroups.has(group)) fail(400, 'Choose a valid muscle group.')
  if (get('SELECT COUNT(*) AS count FROM exercises WHERE created_by=?', req.user.id).count >= 200) fail(409, 'You can save up to 200 custom exercises.')
  const result = run('INSERT INTO exercises (name,muscle_group,is_custom,created_by) VALUES (?,?,1,?)', name, group, req.user.id)
  res.json({ id: result.lastInsertRowid, name, muscleGroup: group, isCustom: 1 })
})
app.delete('/api/exercises/:id', (req, res) => {
  const exerciseId = id(req.params.id)
  const exercise = get('SELECT id FROM exercises WHERE id=? AND created_by=? AND is_custom=1', exerciseId, req.user.id)
  if (!exercise) fail(404, 'Custom exercise not found.')
  const used = get('SELECT (SELECT COUNT(*) FROM template_exercises WHERE exercise_id=?) + (SELECT COUNT(*) FROM set_logs WHERE exercise_id=?) AS count', exerciseId, exerciseId)
  if (used.count) fail(409, 'This exercise is already used in a schedule or workout history.')
  run('DELETE FROM exercises WHERE id=? AND created_by=?', exerciseId, req.user.id)
  res.json({ ok: true })
})
app.get('/api/exercises/:id/history', (req, res) => {
  const exerciseId = id(req.params.id)
  const templateId = id(req.query.templateId)
  const template = get('SELECT id, name FROM templates WHERE id=? AND user_id=?', templateId, req.user.id)
  if (!template) fail(404, 'Schedule not found.')
  const exercise = get('SELECT name FROM exercises WHERE id=? AND (is_custom=0 OR created_by=?)', exerciseId, req.user.id)
  if (!exercise) fail(404, 'Exercise not found.')
  const sessions = all("SELECT ws.finished_at AS date, sl.weight, sl.reps FROM set_logs sl JOIN workout_sessions ws ON ws.id=sl.session_id WHERE ws.user_id=? AND ws.template_id=? AND sl.exercise_id=? AND ws.status='finished' ORDER BY ws.finished_at, ws.id, sl.set_number", req.user.id, templateId, exerciseId)
  res.json({ exercise: exercise.name, templateId, templateName: template.name, sessions })
})

// Schedules (templates)
function saveTemplate(req, res, existing) {
  if (!existing && get('SELECT COUNT(*) AS count FROM templates WHERE user_id=? AND archived=0', req.user.id).count >= 100) fail(409, 'You can save up to 100 schedules.')
  const payload = validateTemplate(req.user.id, req.body ?? {})
  const templateId = transaction(() => {
    let target = existing?.id
    if (target) {
      run('UPDATE templates SET name=?, scheduled_days=? WHERE id=? AND user_id=?', payload.name, JSON.stringify(payload.days), target, req.user.id)
      run('DELETE FROM template_exercises WHERE template_id=?', target)
    } else {
      target = run('INSERT INTO templates (user_id,name,scheduled_days,created_at) VALUES (?,?,?,?)', req.user.id, payload.name, JSON.stringify(payload.days), now()).lastInsertRowid
    }
    payload.exercises.forEach((exercise, position) => run('INSERT INTO template_exercises (template_id,exercise_id,position,target_sets) VALUES (?,?,?,?)', target, exercise.id, position, exercise.targetSets))
    return target
  })
  res.json(templateShape(get('SELECT * FROM templates WHERE id=? AND user_id=?', templateId, req.user.id)))
}
app.post('/api/templates', (req, res) => saveTemplate(req, res, null))
app.put('/api/templates/:id', (req, res) => saveTemplate(req, res, editableTemplate(id(req.params.id), req.user.id)))
app.delete('/api/templates/:id', (req, res) => {
  const template = editableTemplate(id(req.params.id), req.user.id)
  run("UPDATE templates SET archived=1, scheduled_days='[]' WHERE id=? AND user_id=?", template.id, req.user.id)
  res.json({ ok: true })
})

// Workouts
app.post('/api/workouts', (req, res) => {
  const templateId = id(req.body?.templateId)
  if (!get('SELECT id FROM templates WHERE id=? AND user_id=? AND archived=0', templateId, req.user.id)) fail(404, 'Schedule not found.')
  let active = get("SELECT * FROM workout_sessions WHERE user_id=? AND status='active'", req.user.id)
  if (!active) {
    const result = run("INSERT INTO workout_sessions (user_id,template_id,started_at,status) VALUES (?,?,?,'active')", req.user.id, templateId, now())
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
  if (typeof body.requestId !== 'string' || !uuidV4.test(body.requestId)) fail(400, 'A valid request ID is required to save a set safely.')
  const requestId = body.requestId.toLowerCase()
  const payloadHash = hash(JSON.stringify([exerciseId, weight, reps]))
  if (!get('SELECT 1 AS ok FROM template_exercises WHERE template_id=? AND exercise_id=?', session.template_id, exerciseId)) fail(400, 'This exercise is not part of this workout.')
  transaction(() => {
    const previous = get('SELECT payload_hash FROM set_requests WHERE session_id=? AND request_id=?', session.id, requestId)
    if (previous) {
      if (previous.payload_hash !== payloadHash) fail(409, 'This request ID was already used for a different set.')
      return
    }
    if (get('SELECT COUNT(*) AS count FROM set_requests WHERE session_id=?', session.id).count >= 1200) fail(409, 'This workout is no longer active or has reached its set request limit.')
    const setNumber = get('SELECT COALESCE(MAX(set_number),0)+1 AS number FROM set_logs WHERE session_id=? AND exercise_id=?', session.id, exerciseId).number
    const log = run('INSERT INTO set_logs (session_id,exercise_id,set_number,weight,reps,logged_at) VALUES (?,?,?,?,?,?)', session.id, exerciseId, setNumber, weight, reps, now())
    run('INSERT INTO set_requests (session_id,request_id,payload_hash,log_id) VALUES (?,?,?,?)', session.id, requestId, payloadHash, log.lastInsertRowid)
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
  if (!get('SELECT COUNT(*) AS count FROM set_logs WHERE session_id=?', session.id).count) fail(400, 'Log at least one set before finishing this workout.')
  run("UPDATE workout_sessions SET status='finished', finished_at=? WHERE id=? AND user_id=? AND status='active'", now(), session.id, req.user.id)
  res.json({ ok: true })
})
app.post('/api/workouts/:id/abandon', (req, res) => {
  const session = ownWorkout(req)
  if (session.status === 'abandoned') return res.json({ ok: true })
  requireActive(session)
  run("UPDATE workout_sessions SET status='abandoned', finished_at=? WHERE id=? AND user_id=? AND status='active'", now(), session.id, req.user.id)
  res.json({ ok: true })
})

// History
app.get('/api/history', (req, res) => {
  const zone = zoneFor(req)
  const month = typeof req.query.month === 'string' ? req.query.month : new Date().toISOString().slice(0, 7)
  const bounds = monthBounds(month, zone)
  if (!bounds) fail(400, 'Choose a valid month.')
  const sessions = all("SELECT ws.id, ws.template_id AS templateId, ws.started_at AS startedAt, ws.finished_at AS finishedAt, t.name FROM workout_sessions ws JOIN templates t ON t.id=ws.template_id WHERE ws.user_id=? AND ws.status='finished' AND ws.finished_at>=? AND ws.finished_at<? ORDER BY ws.finished_at DESC", req.user.id, ...bounds)
  const sets = all("SELECT sl.session_id AS sessionId, sl.exercise_id AS exerciseId, e.name, sl.set_number AS setNumber, sl.weight, sl.reps FROM set_logs sl JOIN exercises e ON e.id=sl.exercise_id JOIN workout_sessions ws ON ws.id=sl.session_id WHERE ws.user_id=? AND ws.status='finished' AND ws.finished_at>=? AND ws.finished_at<? ORDER BY sl.exercise_id, sl.set_number", req.user.id, ...bounds)
  const grouped = new Map()
  for (const { sessionId, ...set } of sets) { if (!grouped.has(sessionId)) grouped.set(sessionId, []); grouped.get(sessionId).push({ ...set }) }
  res.json({ sessions: sessions.map((session) => ({ ...session, sets: grouped.get(session.id) || [] })) })
})
app.delete('/api/history/:id', (req, res) => {
  const session = get("SELECT id FROM workout_sessions WHERE id=? AND user_id=? AND status='finished'", id(req.params.id), req.user.id)
  if (!session) fail(404, 'Session not found.')
  transaction(() => {
    run('DELETE FROM set_requests WHERE session_id=?', session.id)
    run('DELETE FROM set_logs WHERE session_id=?', session.id)
    run('DELETE FROM workout_sessions WHERE id=?', session.id)
  })
  res.json({ ok: true })
})

app.all('/api/*splat', () => fail(404, 'API endpoint not found.'))
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message })
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' })
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' })
  console.error('API request failed:', error)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

const dist = path.join(root, 'dist')
app.use(express.static(dist))
app.get(/.*/, (req, res) => res.sendFile(path.join(dist, 'index.html')))
const port = Number(process.env.PORT || 3000)
app.listen(port, '0.0.0.0', () => console.log(`Gym Track running on http://0.0.0.0:${port}`))
