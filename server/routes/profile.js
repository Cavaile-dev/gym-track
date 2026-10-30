import { text, fail } from '../validation.js'
import { get, run } from '../database.js'
import { publicUser } from '../auth.js'

function registerProfileRoutes(app) {
  // Profile changes always apply to the signed-in account.
  app.put('/api/profile', (req, res) => {
    const body = req.body ?? {}
    const username = text(body.username, 'Username', 32, 3)
    if (!/^[a-zA-Z0-9_.-]+$/.test(username))
      fail(400, 'Use letters, numbers, dots, underscores, or hyphens in your username.')
    const email = body.email ? text(body.email, 'Email', 254) : null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(400, 'Enter a valid email address.')
    if (get('SELECT id FROM users WHERE lower(username)=lower(?) AND id<>?', username, req.user.id))
      fail(409, 'That username is already in use.')
    try {
      run('UPDATE users SET username=?, email=? WHERE id=?', username, email, req.user.id)
    } catch (error) {
      if (/UNIQUE constraint failed: users.username/i.test(error.message))
        fail(409, 'That username is already in use.')
      throw error
    }
    res.json({ user: publicUser(get('SELECT * FROM users WHERE id=?', req.user.id)) })
  })
}

export { registerProfileRoutes }
