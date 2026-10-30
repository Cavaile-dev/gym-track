export function sortTemplatesByDay(templates) {
  const firstDay = (template) => Math.min(7, ...template.scheduledDays)
  return [...templates].sort(
    (a, b) =>
      firstDay(a) - firstDay(b) ||
      a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }),
  )
}

export function withUpdatedTemplates(data, templates) {
  templates = [...templates].sort((a, b) => a.id - b.id)
  const today = new Date()
  const day = (today.getDay() + 6) % 7
  const todaySessions = sessionsForDay(templates, data.activeRoutineId, day, today)
  return {
    ...data,
    templates,
    todaySessions,
    today: todaySessions.find((template) => !template.completedToday) || todaySessions[0] || null,
  }
}

export function sessionsForDay(templates, routineId, day, today = new Date()) {
  return templates
    .filter((template) => template.routineId === routineId && template.scheduledDays.includes(day))
    .map((template) => ({
      ...template,
      completedToday: Boolean(
        template.lastPerformed &&
        new Date(template.lastPerformed).toDateString() === today.toDateString(),
      ),
    }))
}
