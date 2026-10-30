import { builtInExercises } from './exercises.js'

function seedExercises(db) {
  const findBuiltInExercise = db.prepare(
    'SELECT id, muscle_group FROM exercises WHERE name = ? COLLATE NOCASE AND is_custom = 0 LIMIT 1',
  )
  const findMatchingCustomExercise = db.prepare(
    'SELECT id FROM exercises WHERE name = ? COLLATE NOCASE AND is_custom = 1 AND archived = 0 LIMIT 1',
  )
  const promoteToBuiltIn = db.prepare(
    'UPDATE exercises SET name = ?, muscle_group = ?, is_custom = 0, created_by = NULL WHERE id = ?',
  )
  const updateBuiltInGroup = db.prepare('UPDATE exercises SET muscle_group = ? WHERE id = ?')
  const insertBuiltIn = db.prepare(
    'INSERT INTO exercises (name, muscle_group, is_custom) VALUES (?, ?, 0)',
  )

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
}

export { seedExercises }
