const formatDate = (date, options = { month: 'short', day: 'numeric' }) =>
  new Intl.DateTimeFormat('en', options).format(new Date(date))

const formatRecordDate = (value) => {
  const date = new Date(value)
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`
}

const formatKg = (value) => `${Number(value || 0).toLocaleString()} kg`

export { formatDate, formatRecordDate, formatKg }
