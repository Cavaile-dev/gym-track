import express from 'express'
import { registerAuthRoutes } from './routes/auth.js'
import { auth } from './auth.js'
import { bootstrap, zoneFor } from './services/training.js'
import { registerProfileRoutes } from './routes/profile.js'
import { registerExercisesRoutes } from './routes/exercises.js'
import { registerRoutinesRoutes } from './routes/routines.js'
import { registerTemplatesRoutes } from './routes/templates.js'
import { registerWorkoutsRoutes } from './routes/workouts.js'
import { registerHistoryRoutes } from './routes/history.js'
import { fail, HttpError } from './validation.js'
import path from 'node:path'
import { root } from './database.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  next()
})

registerAuthRoutes(app)
app.use('/api', auth)
app.get('/api/bootstrap', (req, res) => res.json(bootstrap(req.user.id, zoneFor(req))))
registerProfileRoutes(app)
registerExercisesRoutes(app)
registerRoutinesRoutes(app)
registerTemplatesRoutes(app)
registerWorkoutsRoutes(app)
registerHistoryRoutes(app)
app.all('/api/*splat', () => fail(404, 'API endpoint not found.'))
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message })
  if (error.type === 'entity.too.large')
    return res.status(413).json({ error: 'Request body is too large.' })
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' })
  console.error('API request failed:', error)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

const dist = path.join(root, 'dist')
app.use(express.static(dist))
app.get(/.*/, (req, res) => res.sendFile(path.join(dist, 'index.html')))

export { app }
