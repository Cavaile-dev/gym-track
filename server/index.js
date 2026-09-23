import express from 'express'
import bcrypt from 'bcryptjs'
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
app.use(express.json())
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })

const now = () => new Date().toISOString()
const transaction = (callback) => { db.exec('BEGIN'); try { const result = callback(); db.exec('COMMIT'); return result } catch (error) { db.exec('ROLLBACK'); throw error } }
const publicUser = (user) => user && ({ id: user.id, username: user.username, email: user.email })
const cookie = (value, maxAge = 60 * 60 * 24 * 365) => `gym_session=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`
function readCookie(req, name) {
  const raw = req.headers.cookie || ''
  return raw.split(';').map((part) => part.trim().split('=')).find(([key]) => key === name)?.[1]
}
function auth(req, res, next) {
  const token = readCookie(req, 'gym_session')
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' })
  const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hash(token), now())
  if (!row) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  req.user = row
  next()
}
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function startSession(userId, res) {
  const token = crypto.randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(hash(token), userId, new Date(Date.now() + 365 * 86400000).toISOString())
  res.setHeader('Set-Cookie', cookie(token))
}
function parseDays(value) { try { return JSON.parse(value || '[]') } catch { return [] } }
function templateShape(template) {
  const exercises = db.prepare(`SELECT te.exercise_id AS id, e.name, e.muscle_group AS muscleGroup, te.target_sets AS targetSets, te.position
    FROM template_exercises te JOIN exercises e ON e.id=te.exercise_id WHERE te.template_id=? ORDER BY te.position`).all(template.id)
  const lastPerformed = db.prepare("SELECT finished_at AS finishedAt FROM workout_sessions WHERE template_id=? AND status='finished' ORDER BY finished_at DESC LIMIT 1").get(template.id)
  return { id: template.id, name: template.name, scheduledDays: parseDays(template.scheduled_days), exercises, lastPerformed: lastPerformed?.finishedAt || null }
}
function activeShape(session) {
  if (!session) return null
  const template = templateShape(db.prepare('SELECT * FROM templates WHERE id=?').get(session.template_id))
  const logs = db.prepare(`SELECT sl.id, sl.exercise_id AS exerciseId, sl.set_number AS setNumber, sl.weight, sl.reps, sl.logged_at AS loggedAt
    FROM set_logs sl WHERE sl.session_id=? ORDER BY sl.exercise_id, sl.set_number`).all(session.id)
  const previous = Object.fromEntries(template.exercises.map((exercise) => [exercise.id, previousFor(session.user_id, exercise.id, session.started_at)]).filter(([, value]) => value))
  return { id: session.id, template, startedAt: session.started_at, logs, previous }
}
function previousFor(userId, exerciseId, before = now()) {
  return db.prepare(`SELECT sl.weight, sl.reps, ws.finished_at AS finishedAt FROM set_logs sl JOIN workout_sessions ws ON ws.id=sl.session_id
    WHERE ws.user_id=? AND sl.exercise_id=? AND ws.status='finished' AND ws.finished_at<? ORDER BY ws.finished_at DESC, sl.set_number LIMIT 1`).get(userId, exerciseId, before) || null
}
function stats(userId) {
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const weekStart = monday.toISOString()
  const monthStart = new Date(Date.now() - 30 * 86400000).toISOString()
  const workoutsWeek = db.prepare("SELECT COUNT(*) count FROM workout_sessions WHERE user_id=? AND status='finished' AND finished_at>=?").get(userId, weekStart).count
  const workoutsMonth = db.prepare("SELECT COUNT(*) count FROM workout_sessions WHERE user_id=? AND status='finished' AND finished_at>=?").get(userId, monthStart).count
  const volume = db.prepare(`SELECT COALESCE(SUM(sl.weight*sl.reps),0) volume FROM set_logs sl JOIN workout_sessions ws ON ws.id=sl.session_id WHERE ws.user_id=? AND ws.status='finished' AND ws.finished_at>=?`).get(userId, weekStart).volume
  const previousWeekStart = new Date(monday); previousWeekStart.setDate(previousWeekStart.getDate() - 7)
  const previousVolume = db.prepare(`SELECT COALESCE(SUM(sl.weight*sl.reps),0) volume FROM set_logs sl JOIN workout_sessions ws ON ws.id=sl.session_id WHERE ws.user_id=? AND ws.status='finished' AND ws.finished_at>=? AND ws.finished_at<?`).get(userId, previousWeekStart.toISOString(), weekStart).volume
  const recordSets = db.prepare(`SELECT e.id AS exerciseId, e.name, sl.weight, sl.reps, ws.finished_at AS date FROM set_logs sl JOIN exercises e ON e.id=sl.exercise_id JOIN workout_sessions ws ON ws.id=sl.session_id
    WHERE ws.user_id=? AND ws.status='finished' ORDER BY sl.weight DESC, sl.reps DESC, ws.finished_at DESC`).all(userId)
  const seenExercises = new Set()
  const records = recordSets.filter((record) => { if (seenExercises.has(record.exerciseId)) return false; seenExercises.add(record.exerciseId); return true }).slice(0, 3)
  const completedWeeks = db.prepare("SELECT finished_at AS finishedAt FROM workout_sessions WHERE user_id=? AND status='finished'").all(userId)
  const weekKeys = new Set(completedWeeks.map(({ finishedAt }) => weekKey(finishedAt)))
  let streak = 0; const cursor = new Date(monday)
  while (weekKeys.has(weekKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 7) }
  return { workoutsWeek, workoutsMonth, volume: Math.round(volume), volumeDelta: previousVolume ? Math.round(((volume - previousVolume) / previousVolume) * 100) : null, streak, records }
}
function weekKey(value) { const date = new Date(value); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date.toISOString().slice(0, 10) }

app.get('/api/session', (req, res) => {
  const token = readCookie(req, 'gym_session')
  const user = token && db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hash(token), now())
  res.json({ user: publicUser(user) })
})
app.post('/api/auth/register', (req, res) => {
  const { username, email, password, confirmPassword } = req.body
  if (!username?.trim() || !password || password.length < 8 || password !== confirmPassword) return res.status(400).json({ error: password?.length < 8 ? 'Password must be at least 8 characters.' : password !== confirmPassword ? 'Passwords do not match.' : 'Username is required.' })
  try { const result = db.prepare('INSERT INTO users (username,email,password_hash,created_at) VALUES (?,?,?,?)').run(username.trim(), email?.trim() || null, bcrypt.hashSync(password, 10), now()); startSession(result.lastInsertRowid, res); res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid)) }) }
  catch { res.status(409).json({ error: 'That username is already in use.' }) }
})
app.post('/api/auth/login', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE lower(username)=lower(?)').get(req.body.username?.trim())
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password_hash)) return res.status(401).json({ error: 'Username or password is incorrect.' })
  startSession(user.id, res); res.json({ user: publicUser(user) })
})
app.post('/api/auth/logout', (req, res) => { const token = readCookie(req, 'gym_session'); if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)); res.setHeader('Set-Cookie', cookie('', 0)); res.json({ ok: true }) })

app.get('/api/bootstrap', auth, (req, res) => {
  const templates = db.prepare('SELECT * FROM templates WHERE user_id=? AND archived=0 ORDER BY name').all(req.user.id).map(templateShape)
  const exercises = db.prepare('SELECT id,name,muscle_group AS muscleGroup,is_custom AS isCustom FROM exercises WHERE is_custom=0 OR created_by=? ORDER BY name').all(req.user.id)
  const day = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
  const today = templates.find((template) => template.scheduledDays.includes(day)) || null
  const active = db.prepare("SELECT * FROM workout_sessions WHERE user_id=? AND status='active' ORDER BY started_at DESC LIMIT 1").get(req.user.id)
  res.json({ templates, exercises, today, active: activeShape(active), stats: stats(req.user.id) })
})
app.post('/api/exercises', auth, (req, res) => { if (!req.body.name?.trim()) return res.status(400).json({ error: 'Exercise name is required.' }); const result = db.prepare('INSERT INTO exercises (name,muscle_group,is_custom,created_by) VALUES (?,?,1,?)').run(req.body.name.trim(), req.body.muscleGroup?.trim() || 'Other', req.user.id); res.json({ id: result.lastInsertRowid, name: req.body.name.trim(), muscleGroup: req.body.muscleGroup?.trim() || 'Other', isCustom: 1 }) })
app.delete('/api/exercises/:id', auth, (req, res) => { const exercise = db.prepare('SELECT * FROM exercises WHERE id=? AND is_custom=1 AND created_by=?').get(req.params.id, req.user.id); if (!exercise) return res.status(404).json({ error: 'Custom exercise not found.' }); const inUse = db.prepare('SELECT (SELECT COUNT(*) FROM template_exercises WHERE exercise_id=?) + (SELECT COUNT(*) FROM set_logs WHERE exercise_id=?) AS count').get(exercise.id, exercise.id).count; if (inUse) return res.status(409).json({ error: 'This exercise is already used in a schedule or workout history.' }); db.prepare('DELETE FROM exercises WHERE id=?').run(exercise.id); res.json({ ok: true }) })
app.post('/api/templates', auth, (req, res) => { const tx = transaction(() => { const result = db.prepare('INSERT INTO templates (user_id,name,scheduled_days,created_at) VALUES (?,?,?,?)').run(req.user.id, req.body.name.trim(), JSON.stringify(req.body.scheduledDays || []), now()); const insert = db.prepare('INSERT INTO template_exercises (template_id,exercise_id,position,target_sets) VALUES (?,?,?,?)'); (req.body.exercises || []).forEach((e, i) => insert.run(result.lastInsertRowid, e.id, i, Number(e.targetSets) || 3)); return templateShape(db.prepare('SELECT * FROM templates WHERE id=?').get(result.lastInsertRowid)) }); res.json(tx) })
app.put('/api/templates/:id', auth, (req, res) => { const existing = db.prepare('SELECT * FROM templates WHERE id=? AND user_id=?').get(req.params.id, req.user.id); if (!existing) return res.status(404).json({ error: 'Template not found.' }); const tx = transaction(() => { db.prepare('UPDATE templates SET name=?,scheduled_days=? WHERE id=?').run(req.body.name.trim(), JSON.stringify(req.body.scheduledDays || []), existing.id); db.prepare('DELETE FROM template_exercises WHERE template_id=?').run(existing.id); const insert = db.prepare('INSERT INTO template_exercises (template_id,exercise_id,position,target_sets) VALUES (?,?,?,?)'); (req.body.exercises || []).forEach((e, i) => insert.run(existing.id, e.id, i, Number(e.targetSets) || 3)); return templateShape(db.prepare('SELECT * FROM templates WHERE id=?').get(existing.id)) }); res.json(tx) })
app.delete('/api/templates/:id', auth, (req, res) => { db.prepare('UPDATE templates SET archived=1,scheduled_days=? WHERE id=? AND user_id=?').run('[]', req.params.id, req.user.id); res.json({ ok: true }) })

app.post('/api/workouts', auth, (req, res) => { const template = db.prepare('SELECT * FROM templates WHERE id=? AND user_id=?').get(req.body.templateId, req.user.id); if (!template) return res.status(404).json({ error: 'Template not found.' }); const active = db.prepare("SELECT * FROM workout_sessions WHERE user_id=? AND status='active'").get(req.user.id); if (active) return res.json(activeShape(active)); const result = db.prepare('INSERT INTO workout_sessions (user_id,template_id,started_at,status) VALUES (?,?,?,?)').run(req.user.id, template.id, now(), 'active'); res.json(activeShape(db.prepare('SELECT * FROM workout_sessions WHERE id=?').get(result.lastInsertRowid))) })
app.get('/api/workouts/:id', auth, (req, res) => { const session = db.prepare('SELECT * FROM workout_sessions WHERE id=? AND user_id=?').get(req.params.id, req.user.id); res.json(activeShape(session)) })
app.post('/api/workouts/:id/sets', auth, (req, res) => { const session = db.prepare("SELECT * FROM workout_sessions WHERE id=? AND user_id=? AND status='active'").get(req.params.id, req.user.id); if (!session || !req.body.exerciseId || req.body.weight === '' || !req.body.reps) return res.status(400).json({ error: 'Enter weight and reps to log this set.' }); const result = db.prepare('SELECT COALESCE(MAX(set_number),0)+1 number FROM set_logs WHERE session_id=? AND exercise_id=?').get(session.id, req.body.exerciseId); db.prepare('INSERT INTO set_logs (session_id,exercise_id,set_number,weight,reps,logged_at) VALUES (?,?,?,?,?,?)').run(session.id, req.body.exerciseId, result.number, Number(req.body.weight), Number(req.body.reps), now()); res.json(activeShape(session)) })
app.delete('/api/workouts/:id/sets/:setId', auth, (req, res) => { const session = db.prepare("SELECT * FROM workout_sessions WHERE id=? AND user_id=? AND status='active'").get(req.params.id, req.user.id); const set = session && db.prepare('SELECT id FROM set_logs WHERE id=? AND session_id=?').get(req.params.setId, session.id); if (!set) return res.status(404).json({ error: 'Set not found.' }); db.prepare('DELETE FROM set_logs WHERE id=?').run(set.id); res.json(activeShape(session)) })
app.post('/api/workouts/:id/finish', auth, (req, res) => { const session = db.prepare("SELECT * FROM workout_sessions WHERE id=? AND user_id=? AND status='active'").get(req.params.id, req.user.id); if (!session) return res.status(404).json({ error: 'Workout not found.' }); db.prepare("UPDATE workout_sessions SET status='finished',finished_at=? WHERE id=?").run(now(), session.id); res.json({ ok: true }) })
app.post('/api/workouts/:id/abandon', auth, (req, res) => { db.prepare("UPDATE workout_sessions SET status='abandoned',finished_at=? WHERE id=? AND user_id=? AND status='active'").run(now(), req.params.id, req.user.id); res.json({ ok: true }) })

app.get('/api/history', auth, (req, res) => { const month = /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : now().slice(0, 7); const sessions = db.prepare("SELECT ws.id,ws.started_at AS startedAt,ws.finished_at AS finishedAt,t.name FROM workout_sessions ws JOIN templates t ON t.id=ws.template_id WHERE ws.user_id=? AND ws.status='finished' AND strftime('%Y-%m',ws.finished_at)=? ORDER BY ws.finished_at DESC").all(req.user.id, month).map((session) => ({ ...session, sets: db.prepare('SELECT sl.exercise_id AS exerciseId,e.name,sl.set_number AS setNumber,sl.weight,sl.reps FROM set_logs sl JOIN exercises e ON e.id=sl.exercise_id WHERE sl.session_id=? ORDER BY sl.exercise_id,sl.set_number').all(session.id) })); res.json({ sessions }) })
app.delete('/api/history/:id', auth, (req, res) => { const session = db.prepare("SELECT id FROM workout_sessions WHERE id=? AND user_id=? AND status='finished'").get(req.params.id, req.user.id); if (!session) return res.status(404).json({ error: 'Session not found.' }); transaction(() => { db.prepare('DELETE FROM set_logs WHERE session_id=?').run(session.id); db.prepare('DELETE FROM workout_sessions WHERE id=?').run(session.id) }); res.json({ ok: true }) })
app.get('/api/exercises/:id/history', auth, (req, res) => { const rows = db.prepare("SELECT ws.finished_at AS date,sl.weight,sl.reps,e.name FROM set_logs sl JOIN workout_sessions ws ON ws.id=sl.session_id JOIN exercises e ON e.id=sl.exercise_id WHERE ws.user_id=? AND sl.exercise_id=? AND ws.status='finished' ORDER BY ws.finished_at").all(req.user.id, req.params.id); res.json({ exercise: rows[0]?.name || 'Exercise', sessions: rows }) })

const dist = path.join(root, 'dist')
app.use(express.static(dist))
app.get(/.*/, (req, res) => res.sendFile(path.join(dist, 'index.html')))
const port = Number(process.env.PORT || 3000)
app.listen(port, '0.0.0.0', () => console.log(`Gym Track running on http://0.0.0.0:${port}`))
