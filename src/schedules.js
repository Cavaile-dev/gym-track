export function sortTemplatesByDay(templates) {
  const firstDay = (template) => Math.min(7, ...template.scheduledDays)
  return [...templates].sort((a, b) => firstDay(a) - firstDay(b)
    || a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }))
}
