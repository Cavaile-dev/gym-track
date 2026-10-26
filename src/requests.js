export async function api(url, options = {}) {
  let response
  try {
    response = await fetch(`/api${url}`, { ...options, headers: { 'Content-Type': 'application/json', 'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone, ...options.headers } })
  } catch {
    throw new Error('Connection lost. Check your connection and try again.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    const error = new Error(data?.error || 'The service is unavailable. Please try again.')
    error.status = response.status
    throw error
  }
  return data
}
export const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body) })

// A retry keeps its operation ID, including when the response was lost after commit.
export function createSetWriter(send, makeId = () => crypto.randomUUID()) {
  let pending = null
  let flight = null
  return {
    get pending() { return pending },
    submit(payload) {
      if (flight) return flight
      const signature = JSON.stringify([payload.exerciseId, Number(payload.weight), Number(payload.reps)])
      if (pending && pending.signature !== signature) return Promise.reject(new Error('Retry the pending set before changing its values.'))
      if (!pending) pending = { signature, body: { ...payload, requestId: makeId() } }
      flight = Promise.resolve().then(() => send(pending.body)).then(result => {
        pending = null
        return result
      }).catch(error => {
        if (error.status >= 400 && error.status < 500) pending = null
        throw error
      }).finally(() => { flight = null })
      return flight
    },
  }
}

// Mutation success is applied before refreshing; retries only repeat the read.
export async function mutateAndRefresh(mutate, committed, refresh) {
  await mutate()
  committed()
  return refresh()
}
