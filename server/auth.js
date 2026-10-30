import crypto from 'node:crypto'
import { get, now, transaction, run } from './database.js'
import { fail } from './validation.js'
import bcrypt from 'bcryptjs'

const publicUser = (user) =>
  user ? { id: user.id, username: user.username, email: user.email } : null

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')

const cookie = (value, maxAge = 60 * 60 * 24 * 365) =>
  `gym_session=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`

function readCookie(req, name) {
  const raw = req.headers.cookie || ''
  return raw
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1]
}

function sessionUser(req) {
  const token = readCookie(req, 'gym_session')
  if (!token) return null
  return get(
    'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',
    hash(token),
    now(),
  )
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
    run(
      'DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT 9)',
      userId,
      userId,
    )
    run(
      'INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)',
      hash(token),
      userId,
      new Date(Date.now() + 365 * 86400000).toISOString(),
    )
  })
  res.setHeader('Set-Cookie', cookie(token))
}

const dummyHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10)

export { publicUser, hash, cookie, readCookie, sessionUser, auth, startSession, dummyHash }
