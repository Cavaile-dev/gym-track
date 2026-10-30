import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { migrate } from './database/migrations.js'
import { seedExercises } from './database/seed.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const databasePath = process.env.DATABASE_PATH || path.join(root, 'gym-track.sqlite')
mkdirSync(path.dirname(databasePath), { recursive: true })
const db = new DatabaseSync(databasePath)
migrate(db)
seedExercises(db)
const get = (sql, ...params) => db.prepare(sql).get(...params) ?? null

const all = (sql, ...params) => db.prepare(sql).all(...params)

const run = (sql, ...params) => db.prepare(sql).run(...params)

const transaction = (callback) => {
  db.exec('BEGIN')
  try {
    const result = callback()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

const now = () => new Date().toISOString()

export { root, db, get, all, run, transaction, now }
