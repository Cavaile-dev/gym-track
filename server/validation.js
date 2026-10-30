import { muscleGroups as muscleGroupNames } from '../shared/muscleGroups.js'

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const fail = (status, message) => {
  throw new HttpError(status, message)
}

function text(value, label, max, min = 1) {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max ||
    /[\u0000-\u001f]/.test(value)
  )
    fail(400, `${label} must contain ${min}â€“${max} characters.`)
  return value.trim()
}

function number(value, label, min, max, integer = true) {
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '')
    fail(400, `${label} is required.`)
  const result = Number(value)
  if (
    !Number.isFinite(result) ||
    result < min ||
    result > max ||
    (integer && !Number.isSafeInteger(result))
  )
    fail(400, `${label} must be between ${min} and ${max}.`)
  return result
}

const id = (value) => number(value, 'ID', 1, Number.MAX_SAFE_INTEGER)

const muscleGroups = new Set(muscleGroupNames)

const uuidV4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

export { HttpError, fail, text, number, id, muscleGroups, uuidV4 }
