import { ConfirmationDialog } from '../components/ConfirmationDialog.jsx'
import React, { useState, useEffect, useRef } from 'react'
import { api } from '../requests.js'
import { NavIcon, SessionMetaIcon } from '../components/Icons.jsx'
import { weekdays } from '../config.js'
import { ModalPresence, CloseButton } from '../components/Modal.jsx'
import { formatDate, formatKg, formatRecordDate } from '../utils/format.js'

function History({ data, setData }) {
  const [month, setMonth] = useState(localMonth())
  const [history, setHistory] = useState({ month: null, sessions: [], error: '' })
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    let active = true
    api(`/history?month=${month}`)
      .then((result) => {
        if (active) setHistory({ month, sessions: result.sessions, error: '' })
      })
      .catch((error) => {
        if (active) setHistory({ month, sessions: [], error: error.message })
      })
    return () => {
      active = false
    }
  }, [month])
  const loading = history.month !== month
  const sessions = loading ? [] : history.sessions
  const [year, monthNumber] = month.split('-').map(Number)
  const offset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, index) =>
    index < offset || index >= offset + daysInMonth ? null : index - offset + 1,
  )
  const sessionByDay = sessions.reduce((byDay, session) => {
    const day = new Date(session.finishedAt).getDate()
    ;(byDay[day] ||= []).push(session)
    return byDay
  }, {})
  const today = new Date()
  const isCurrentMonth = month === localMonth(today)
  const totalSets = sessions.reduce((sum, session) => sum + session.sets.length, 0)
  const totalVolume = sessions.reduce(
    (sum, session) => sum + session.sets.reduce((volume, set) => volume + set.weight * set.reps, 0),
    0,
  )
  const changeMonth = (next) => {
    setSelected(null)
    setMonth(next)
  }
  const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
    new Date(year, monthNumber - 1),
  )
  return (
    <section className="screen history-screen">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">YOUR TRAINING ARCHIVE</p>
          <h1>History</h1>
        </div>
        <span className="history-heading-icon">
          <NavIcon type="history" />
        </span>
      </div>
      <div className="history-content">
        <div className="history-calendar-card" aria-busy={loading}>
          <div className="month-nav">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(month, -1, changeMonth)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m14 6-6 6 6 6" />
              </svg>
            </button>
            <div>
              <strong>{monthLabel}</strong>
              <span>
                {loading
                  ? 'Loading sessions…'
                  : `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} completed`}
              </span>
            </div>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(month, 1, changeMonth)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m10 6 6 6-6 6" />
              </svg>
            </button>
          </div>
          <div className="calendar">
            <div className="calendar-days">
              {weekdays.map((day) => (
                <span key={day}>{day.slice(0, 1)}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {cells.map((day, index) => (
                <button
                  type="button"
                  className={`${day && sessionByDay[day] ? 'has-session' : ''}${day && isCurrentMonth && day === today.getDate() ? ' is-today' : ''}`}
                  key={index}
                  disabled={!day || !sessionByDay[day]}
                  aria-label={
                    day
                      ? `${monthLabel} ${day}${sessionByDay[day] ? ', workout completed, view sessions' : ', no workouts'}`
                      : undefined
                  }
                  aria-current={
                    day && isCurrentMonth && day === today.getDate() ? 'date' : undefined
                  }
                  onClick={() => setSelected(sessionByDay[day])}
                >
                  <span>{day || ''}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="calendar-legend">
            <span>
              <i className="legend-workout" />
              Workout
            </span>
            <span>
              <i className="legend-today" />
              Today
            </span>
            {!isCurrentMonth && (
              <button type="button" onClick={() => changeMonth(localMonth())}>
                This Month <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
          <div className="history-month-stats">
            <div>
              <strong>{loading ? '—' : sessions.length}</strong>
              <span>Sessions</span>
            </div>
            <div>
              <strong>{loading ? '—' : totalSets}</strong>
              <span>Sets logged</span>
            </div>
            <div>
              <strong>
                {loading ? '—' : Math.round(totalVolume).toLocaleString()} <small>kg</small>
              </strong>
              <span>Total volume</span>
            </div>
          </div>
        </div>
        <div className="history-secondary">
          {!loading && history.error && (
            <p className="form-error" role="alert">
              {history.error}
            </p>
          )}
          <ModalPresence open={Boolean(selected)} overlay={false}>
            {selected ? (
              <SessionDetail
                key={selected.map((item) => item.id).join('-')}
                session={selected[0]}
                sessions={selected}
                onClose={() => setSelected(null)}
                onDeleted={async (id) => {
                  setHistory((current) => ({
                    ...current,
                    sessions: current.sessions.filter((item) => item.id !== id),
                  }))
                  setSelected((current) => {
                    const remaining = current?.filter((item) => item.id !== id) || []
                    return remaining.length ? remaining : null
                  })
                  try {
                    setData(await api('/bootstrap'))
                  } catch (e) {
                    setHistory((current) => ({
                      ...current,
                      error: 'Session deleted. Refresh failed: ' + e.message,
                    }))
                  }
                }}
              />
            ) : (
              <div />
            )}
          </ModalPresence>
          {!selected && (
            <div className="history-list">
              <div className="insight-section-heading">
                <h2>Recent sessions</h2>
                <span>{monthLabel}</span>
              </div>
              <div className="history-session-list">
                {sessions.map((session) => (
                  <button
                    type="button"
                    className="history-row"
                    key={session.id}
                    onClick={() => setSelected([session])}
                  >
                    <span className="history-date">
                      <strong>{formatDate(session.finishedAt, { day: '2-digit' })}</strong>
                      <small>{formatDate(session.finishedAt, { weekday: 'short' })}</small>
                    </span>
                    <span className="history-session-info">
                      <strong>{session.name}</strong>
                      <span>
                        {session.sets.length} {session.sets.length === 1 ? 'set' : 'sets'}
                        <span aria-hidden="true">·</span>
                        {formatKg(
                          session.sets.reduce((sum, set) => sum + set.weight * set.reps, 0),
                        )}
                      </span>
                    </span>
                    <span className="history-row-arrow" aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
              {loading ? (
                <p className="history-loading" role="status">
                  Loading your sessions…
                </p>
              ) : (
                !history.error &&
                !sessions.length && (
                  <div className="history-empty">
                    <span>
                      <SessionMetaIcon type="calendar" />
                    </span>
                    <h3>A fresh page in your training.</h3>
                    <p>Your completed workouts will appear here.</p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function localMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(value, amount, set) {
  const date = new Date(`${value}-01T00:00:00`)
  date.setMonth(date.getMonth() + amount)
  set(localMonth(date))
}

function SessionDetail({ session, sessions = [session], onClose, onDeleted }) {
  const [expandedSessions, setExpandedSessions] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const deletingSession = deleteTarget || session
  const [exerciseHistory, setExerciseHistory] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deleteLock = useRef(false)
  const closeDelete = () => {
    if (!deleteLock.current) setDeleteOpen(false)
  }
  const grouped = sessions.map((item) => ({
    session: item,
    exercises: Object.values(
      item.sets.reduce((all, set) => {
        ;(all[set.exerciseId] ||= {
          id: set.exerciseId,
          name: set.name,
          session: item,
          sets: [],
        }).sets.push(set)
        return all
      }, {}),
    ),
  }))
  const showHistory = async (exercise) => {
    setError('')
    try {
      setExerciseHistory({
        ...exercise,
        ...(await api(
          `/exercises/${exercise.id}/history?templateId=${exercise.session.templateId}`,
        )),
      })
    } catch (e) {
      setError(e.message)
    }
  }
  const deleteSession = async () => {
    if (deleteLock.current) return
    deleteLock.current = true
    setDeleting(true)
    setDeleteError('')
    try {
      await api(`/history/${deletingSession.id}`, { method: 'DELETE' })
      setDeleteOpen(false)
      await onDeleted(deletingSession.id)
    } catch (e) {
      setDeleteError(e.message)
    } finally {
      deleteLock.current = false
      setDeleting(false)
    }
  }
  return (
    <div className="detail-card">
      <div className="detail-header">
        <div>
          <p className="eyebrow">
            {formatDate(session.finishedAt, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h2>{sessions.length > 1 ? `${sessions.length} sessions` : session.name}</h2>
        </div>
        <CloseButton onClick={onClose} disabled={deleting} />
      </div>
      {exerciseHistory ? (
        <div className="progression">
          <button className="back-link" onClick={() => setExerciseHistory(null)}>
            ← All exercises
          </button>
          <h3>{exerciseHistory.name}</h3>
          <p className="muted">{exerciseHistory.templateName}</p>
          {exerciseHistory.sessions.map((item, index) => {
            const previous = exerciseHistory.sessions[index - 1]
            const change = previous ? item.weight - previous.weight : 0
            return (
              <div className="progression-row" key={`${item.date}-${index}`}>
                <span>{formatDate(item.date)}</span>
                <strong>
                  {item.weight} kg × {item.reps}
                </strong>
                <b className={change > 0 ? 'up' : change < 0 ? 'down' : ''}>
                  {change > 0 ? '↑' : change < 0 ? '↓' : '='}
                </b>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="history-day-sessions">
          {grouped.map(({ session: item, exercises }) => {
            const expanded = Boolean(expandedSessions[item.id])
            return (
              <section
                className="history-day-session"
                aria-label={`${item.name} session`}
                key={item.id}
              >
                {sessions.length > 1 && (
                  <header className="history-session-heading">
                    <h3>{item.name}</h3>
                    <span>
                      {formatDate(item.finishedAt, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </header>
                )}
                {(expanded ? exercises : exercises.slice(0, 2)).map((exercise) => (
                  <button
                    type="button"
                    className="detail-exercise detail-button"
                    key={exercise.id}
                    onClick={() => showHistory(exercise)}
                  >
                    <strong>{exercise.name}</strong>
                    <div>
                      {exercise.sets.map((set) => (
                        <span key={set.setNumber}>
                          {set.weight} kg × {set.reps}
                        </span>
                      ))}
                    </div>
                    <small>View progression →</small>
                  </button>
                ))}
                {exercises.length > 2 && (
                  <button
                    type="button"
                    className="button secondary full history-show-all"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedSessions((current) => ({
                        ...current,
                        [item.id]: !current[item.id],
                      }))
                    }
                  >
                    {expanded ? 'Show Less' : 'Show All'}
                  </button>
                )}
                <button
                  type="button"
                  className="danger-button session-delete"
                  aria-label={`Delete session: ${item.name}`}
                  disabled={deleting}
                  onClick={() => {
                    setDeleteTarget(item)
                    setDeleteError('')
                    setDeleteOpen(true)
                  }}
                >
                  Delete session
                </button>
              </section>
            )
          })}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <ConfirmationDialog
        open={deleteOpen}
        label="Delete history session"
        title="Delete this session?"
        eyebrow="WORKOUT HISTORY"
        description={<>This workout session and all its logged sets will be permanently deleted.</>}
        className="delete-session-sheet"
        busy={deleting}
        onClose={closeDelete}
        onConfirm={deleteSession}
        confirmLabel={deleting ? 'Deleting…' : 'Delete session'}
        cancelLabel="Cancel"
        cancelClassName=""
      >
        <div className="delete-session-preview">
          <span className="exercise-icon">
            <SessionMetaIcon type="calendar" />
          </span>
          <div>
            <strong>{deletingSession.name}</strong>
            <span>
              {formatRecordDate(deletingSession.finishedAt)} · {deletingSession.sets.length}{' '}
              {deletingSession.sets.length === 1 ? 'set' : 'sets'}
            </span>
          </div>
        </div>
        {deleteError && (
          <p className="form-error" role="alert">
            {deleteError}
          </p>
        )}
      </ConfirmationDialog>
    </div>
  )
}

export { History, localMonth, shiftMonth, SessionDetail }
