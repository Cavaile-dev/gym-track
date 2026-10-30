import { muscleGroups } from '../shared/muscleGroups.js'

const logo = '/assets/logo_sqr.jpg'

const muscleGroupIcons = {
  Arms: '/assets/exercises/muscles/arms.svg?v=20261030',
  Biceps: '/assets/exercises/muscles/biceps.svg?v=20261030',
  Triceps: '/assets/exercises/muscles/triceps.svg?v=20261030',
  Forearms: '/assets/exercises/muscles/forearms.svg?v=20261030',
  Back: '/assets/exercises/muscles/back.svg',
  Lats: '/assets/exercises/muscles/lats.svg',
  'Upper Back': '/assets/exercises/muscles/upper-back.svg',
  'Lower Back': '/assets/exercises/muscles/lower-back.svg',
  Chest: '/assets/exercises/muscles/chest.svg',
  Core: '/assets/exercises/muscles/core.svg',
  Legs: '/assets/exercises/muscles/legs.svg',
  Quadriceps: '/assets/exercises/muscles/quadriceps.svg',
  Hamstrings: '/assets/exercises/muscles/hamstrings.svg',
  Glutes: '/assets/exercises/muscles/glutes.svg',
  Calves: '/assets/exercises/muscles/calves.svg',
  Adductors: '/assets/exercises/muscles/adductors.svg',
  Shoulders: '/assets/exercises/muscles/shoulders.svg',
  'Full Body': '/assets/exercises/muscles/full-body.svg',
  Other: '/assets/exercises/muscles/other.svg',
}

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const TRANSITION_MS = 300

const pageOrder = ['dashboard', 'templates', 'exercises', 'history', 'profile', 'settings']

export { logo, muscleGroupIcons, weekdays, muscleGroups, TRANSITION_MS, pageOrder }
