import { get, run, now } from '../database.js'
import {
  publicUser,
  sessionUser,
  startSession,
  dummyHash,
  readCookie,
  hash,
  cookie,
} from '../auth.js'
import { text, fail } from '../validation.js'
import bcrypt from 'bcryptjs'

function registerAuthRoutes(app) {
  // Authentication
  app.get('/api/health', (req, res) => {
    get('SELECT 1 AS ok')
    res.json({ ok: true })
  })
  app.get('/api/session', (req, res) => res.json({ user: publicUser(sessionUser(req)) }))
  app.post('/api/auth/register', (req, res) => {
    const body = req.body ?? {}
    const username = text(body.username, 'Username', 32, 3)
    if (!/^[a-zA-Z0-9_.-]+$/.test(username))
      fail(400, 'Use letters, numbers, dots, underscores, or hyphens in your username.')
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128)
      fail(400, 'Password must contain 8â€“128 characters.')
    if (body.password !== body.confirmPassword) fail(400, 'Passwords do not match.')
    const email = body.email ? text(body.email, 'Email', 254) : null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(400, 'Enter a valid email address.')
    if (get('SELECT id FROM users WHERE lower(username)=lower(?)', username))
      fail(409, 'That username is already in use.')
    let result
    try {
      result = run(
        'INSERT INTO users (username,email,password_hash,created_at) VALUES (?,?,?,?)',
        username,
        email,
        bcrypt.hashSync(body.password, 10),
        now(),
      )
    } catch (error) {
      if (/UNIQUE constraint failed: users.username/i.test(error.message))
        fail(409, 'That username is already in use.')
      throw error
    }
    startSession(result.lastInsertRowid, res)
    res.json({ user: publicUser(get('SELECT * FROM users WHERE id=?', result.lastInsertRowid)) })
  })
  app.post('/api/auth/login', (req, res) => {
    const body = req.body ?? {}
    if (
      typeof body.username !== 'string' ||
      !body.username.trim() ||
      body.username.length > 128 ||
      typeof body.password !== 'string' ||
      body.password.length > 128
    )
      fail(401, 'Username or password is incorrect.')
    const user = get('SELECT * FROM users WHERE lower(username)=lower(?)', body.username.trim())
    const valid = bcrypt.compareSync(body.password, user?.password_hash || dummyHash)
    if (!user || !valid) fail(401, 'Username or password is incorrect.')
    startSession(user.id, res)
    res.json({ user: publicUser(user) })
  })

  app.post('/api/auth/logout', (req, res) => {
    const token = readCookie(req, 'gym_session')
    if (token) run('DELETE FROM sessions WHERE token_hash=?', hash(token))
    res.setHeader('Set-Cookie', cookie('', 0))
    res.json({ ok: true })
  })
}

export { registerAuthRoutes }
