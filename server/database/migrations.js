function migrate(db) {
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS exercises (id INTEGER PRIMARY KEY, name TEXT NOT NULL, muscle_group TEXT NOT NULL, is_custom INTEGER DEFAULT 0, created_by INTEGER, archived INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL, scheduled_days TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS template_exercises (template_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL, position INTEGER NOT NULL, target_sets INTEGER NOT NULL DEFAULT 3, PRIMARY KEY(template_id, exercise_id), FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE CASCADE, FOREIGN KEY(exercise_id) REFERENCES exercises(id));
  CREATE TABLE IF NOT EXISTS workout_sessions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, template_id INTEGER NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL DEFAULT 'active', FOREIGN KEY(user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS set_logs (id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL, set_number INTEGER NOT NULL, weight REAL NOT NULL, reps INTEGER NOT NULL, logged_at TEXT NOT NULL, FOREIGN KEY(session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE);
`)
  db.exec(`CREATE TABLE IF NOT EXISTS routines (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_routines_active ON routines(user_id) WHERE is_active=1;`)
  if (
    !db
      .prepare('PRAGMA table_info(templates)')
      .all()
      .some((column) => column.name === 'routine_id')
  )
    db.exec('ALTER TABLE templates ADD COLUMN routine_id INTEGER REFERENCES routines(id)')
  // Keep template IDs intact so existing workout history and progression stay linked.
  db.exec('BEGIN')
  try {
    for (const user of db.prepare('SELECT id FROM users').all()) {
      let routine = db
        .prepare('SELECT id FROM routines WHERE user_id=? ORDER BY is_active DESC,id LIMIT 1')
        .get(user.id)
      if (!routine)
        routine = {
          id: db
            .prepare('INSERT INTO routines (user_id,name,is_active,created_at) VALUES (?,?,1,?)')
            .run(user.id, 'My Training Week', new Date().toISOString()).lastInsertRowid,
        }
      db.prepare('UPDATE templates SET routine_id=? WHERE user_id=? AND routine_id IS NULL').run(
        routine.id,
        user.id,
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  if (
    !db
      .prepare('PRAGMA table_info(exercises)')
      .all()
      .some((column) => column.name === 'archived')
  )
    db.exec('ALTER TABLE exercises ADD COLUMN archived INTEGER NOT NULL DEFAULT 0')
  if (
    !db
      .prepare('PRAGMA table_info(templates)')
      .all()
      .some((column) => column.name === 'archived')
  )
    db.exec('ALTER TABLE templates ADD COLUMN archived INTEGER NOT NULL DEFAULT 0')

  db.exec(`
  CREATE TABLE IF NOT EXISTS set_requests (session_id INTEGER NOT NULL, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL, log_id INTEGER NOT NULL, PRIMARY KEY(session_id, request_id), FOREIGN KEY(session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_exercises_owner ON exercises(created_by, is_custom);
  CREATE INDEX IF NOT EXISTS idx_templates_owner ON templates(user_id, archived);
  CREATE INDEX IF NOT EXISTS idx_workouts_user_finished ON workout_sessions(user_id, status, finished_at);
  CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON set_logs(exercise_id, session_id);
`)
}

export { migrate }
