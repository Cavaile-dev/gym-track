import { ConfirmationDialog } from '../components/ConfirmationDialog.jsx'
import React, { useState, useRef, useId } from 'react'
import { api, post } from '../requests.js'
import { withUpdatedTemplates, sortTemplatesByDay } from '../schedules.js'
import { RoutineManager, WeekPlan, SessionDayPicker } from '../features/routines/RoutinePlanner.jsx'
import { ModalPresence, CloseButton } from '../components/Modal.jsx'
import { SessionMetaIcon } from '../components/Icons.jsx'
import { weekdays } from '../config.js'

function RoutinesPage({ data, setData }) {
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const deleting = useRef(false)
  const [viewedRoutineId, setViewedRoutineId] = useState(data.activeRoutineId)
  const [pickSessionDay, setPickSessionDay] = useState(null)
  const selectedRoutineId = data.routines.some((routine) => routine.id === viewedRoutineId)
    ? viewedRoutineId
    : data.activeRoutineId
  const routineSessions = data.templates.filter(
    (template) => template.routineId === selectedRoutineId,
  )
  const closeDelete = () => {
    if (!deleting.current) setPendingDelete(null)
  }
  const save = async (payload) => {
    payload = { ...payload, routineId: editing?.routineId || selectedRoutineId }
    const saved = editing
      ? await api(`/templates/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await post('/templates', payload)
    setData((current) => {
      const templates = editing
        ? current.templates.map((item) => (item.id === saved.id ? saved : item))
        : [...current.templates, saved]
      return withUpdatedTemplates(current, templates)
    })
    setShowForm(false)
    setEditing(null)
  }
  const remove = async () => {
    if (!pendingDelete || deleting.current) return
    deleting.current = true
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await api(`/templates/${pendingDelete.id}`, { method: 'DELETE' })
      setData((current) => {
        const templates = current.templates.filter((item) => item.id !== pendingDelete.id)
        return withUpdatedTemplates(current, templates)
      })
      setPendingDelete(null)
    } catch (e) {
      setDeleteError(e.message)
    } finally {
      deleting.current = false
      setDeleteBusy(false)
    }
  }
  const todayIndex = (new Date().getDay() + 6) % 7
  const edit = (template) => {
    setEditing(template)
    setShowForm(true)
  }
  const assignSession = async (session, day) => {
    const saved = await post(`/templates/${session.id}/schedule`, { day })
    setData((current) =>
      withUpdatedTemplates(
        current,
        current.templates.map((item) => (item.id === saved.id ? saved : item)),
      ),
    )
    setPickSessionDay(null)
  }
  return (
    <section className="screen schedule-screen">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">YOUR TRAINING SCHEDULE</p>
          <h1>Routines</h1>
        </div>
      </div>
      <p className="intro-copy">Build your weekly routine. Add one or more sessions to any day.</p>
      <RoutineManager
        data={data}
        selectedId={selectedRoutineId}
        onSelect={setViewedRoutineId}
        setData={setData}
        Modal={ModalPresence}
        CloseButton={CloseButton}
      />
      <WeekPlan sessions={routineSessions} onEdit={edit} onAdd={setPickSessionDay} />
      <div className="session-list-actions">
        <h2>Sessions</h2>
        <button className="button primary schedule-create" onClick={() => edit(null)}>
          <span aria-hidden="true">+</span> Add session
        </button>
      </div>
      <div className="template-list">
        {sortTemplatesByDay(routineSessions).map((template) => {
          const isToday = template.scheduledDays.includes(todayIndex)
          const totalSets = template.exercises.reduce(
            (sum, exercise) => sum + Number(exercise.targetSets),
            0,
          )
          return (
            <article className={`template-card${isToday ? ' is-today' : ''}`} key={template.id}>
              <div className="template-card-head">
                <h2>{template.name}</h2>
                {isToday && (
                  <span className="template-today">
                    <i aria-hidden="true" />
                    Today
                  </span>
                )}
              </div>
              <p className="template-meta">
                <span>
                  {template.exercises.length}{' '}
                  {template.exercises.length === 1 ? 'exercise' : 'exercises'}
                </span>
                <span className="dot-sep" aria-hidden="true">
                  ·
                </span>
                <span>{totalSets} sets</span>
              </p>
              {!template.scheduledDays.length && (
                <p className="template-unscheduled">No days assigned yet</p>
              )}
              <div className="exercise-preview">
                {template.exercises.slice(0, 3).map((exercise) => (
                  <div className="template-exercise" key={exercise.id}>
                    <span className="template-exercise-mark" aria-hidden="true" />
                    <span>{exercise.name}</span>
                    <small>{exercise.targetSets} sets</small>
                  </div>
                ))}
                {template.exercises.length > 3 && (
                  <p className="template-more">+{template.exercises.length - 3} more exercises</p>
                )}
              </div>
              <div className="template-actions">
                <button className="template-edit" onClick={() => edit(template)}>
                  Edit session{' '}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
                <button
                  className="template-delete"
                  aria-label={`Delete ${template.name}`}
                  title="Delete session template"
                  onClick={() => {
                    setDeleteError('')
                    setPendingDelete(template)
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
                  </svg>
                </button>
              </div>
            </article>
          )
        })}
        {!routineSessions.length && (
          <div className="blank-state schedule-empty">
            <span className="schedule-empty-icon">
              <SessionMetaIcon type="calendar" />
            </span>
            <p className="eyebrow">A LITTLE STRUCTURE. MORE PROGRESS.</p>
            <h2>Add your first session.</h2>
            <p className="muted">
              Choose exercises for a session, then assign it to one or more days.
            </p>
            <button className="button primary" onClick={() => edit(null)}>
              + Create your first session
            </button>
          </div>
        )}
      </div>
      <ModalPresence open={pickSessionDay !== null} label="Add existing session">
        <SessionDayPicker
          key={pickSessionDay}
          sessions={routineSessions}
          day={pickSessionDay}
          onAssign={assignSession}
          onClose={() => setPickSessionDay(null)}
          CloseButton={CloseButton}
        />
      </ModalPresence>
      <ModalPresence open={showForm} label="Schedule editor">
        <SessionForm
          initial={editing}
          exercises={data.exercises}
          onSave={save}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
        />
      </ModalPresence>
      <ConfirmationDialog
        open={Boolean(pendingDelete)}
        label="Delete session template"
        title="Delete this session?"
        eyebrow="YOUR TRAINING PLAN"
        description={
          <>This session will be removed from your routine. Your workout history will stay saved.</>
        }
        className="delete-schedule-sheet"
        busy={deleteBusy}
        onClose={closeDelete}
        onConfirm={remove}
        confirmLabel={deleteBusy ? 'Deleting…' : 'Delete session'}
        cancelLabel="Cancel"
        cancelClassName=""
      >
        <div className="delete-schedule-preview">
          <span className="exercise-icon">
            <SessionMetaIcon type="calendar" />
          </span>
          <div>
            <strong>{pendingDelete?.name}</strong>
            <span>
              {pendingDelete?.exercises.length}{' '}
              {pendingDelete?.exercises.length === 1 ? 'exercise' : 'exercises'} ·{' '}
              {pendingDelete?.scheduledDays.length
                ? pendingDelete.scheduledDays.map((day) => weekdays[day]).join(' / ')
                : 'No days assigned'}
            </span>
          </div>
        </div>
        {deleteError && (
          <p className="form-error" role="alert">
            {deleteError}
          </p>
        )}
      </ConfirmationDialog>
    </section>
  )
}

function SessionForm({ initial, defaultDays = [], exercises, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '')
  const [days, setDays] = useState(initial?.scheduledDays || defaultDays)
  const [selected, setSelected] = useState(initial?.exercises || [])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(null)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false)
  const exerciseResultsId = useId()
  const filtered = exercises.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) &&
      !selected.some((current) => current.id === item.id),
  )
  const reorder = (target) => {
    if (dragging === null || dragging === target) return
    const next = [...selected]
    const [item] = next.splice(dragging, 1)
    next.splice(target, 0, item)
    setSelected(next)
    setDragging(null)
  }
  const add = (exercise) => setSelected([...selected, { ...exercise, targetSets: 3 }])
  const toggleDay = (index) =>
    setDays(days.includes(index) ? days.filter((day) => day !== index) : [...days, index].sort())
  const submit = async () => {
    if (saving.current) return
    if (!name.trim() || !selected.length) return setError('Add a name and at least one exercise.')
    saving.current = true
    setBusy(true)
    setError('')
    try {
      await onSave({ name: name.trim(), scheduledDays: days, exercises: selected })
    } catch (e) {
      setError(e.message)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  return (
    <div className="modal-backdrop">
      <div className="modal sheet template-sheet">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{initial ? 'EDIT SESSION' : 'NEW SESSION'}</p>
            <h2>{initial ? 'Tune your session' : 'Create a session'}</h2>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <div className="template-form-body">
          <label>
            Session name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Push Day"
            />
          </label>
          <label className="label-gap">
            Schedule <span className="optional">choose all that apply</span>
          </label>
          <div className="day-picker">
            {weekdays.map((day, index) => (
              <button
                type="button"
                className={days.includes(index) ? 'selected' : ''}
                key={day}
                onClick={() => toggleDay(index)}
              >
                {day}
              </button>
            ))}
          </div>
          <label className="label-gap">Exercises</label>
          <div className="selected-exercises">
            {selected.map((exercise, index) => (
              <div
                className="selected-row"
                draggable
                onDragStart={() => setDragging(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => reorder(index)}
                key={exercise.id}
              >
                <span className="drag">≡</span>
                <strong>{exercise.name}</strong>
                <label>
                  <input
                    inputMode="numeric"
                    type="number"
                    min="1"
                    max="20"
                    value={exercise.targetSets}
                    onChange={(e) =>
                      setSelected(
                        selected.map((item) =>
                          item.id === exercise.id ? { ...item, targetSets: e.target.value } : item,
                        ),
                      )
                    }
                  />{' '}
                  sets
                </label>
                <button
                  className="remove-button"
                  onClick={() => setSelected(selected.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div
            className="template-exercise-picker"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setExercisePickerOpen(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && exercisePickerOpen) {
                event.stopPropagation()
                setExercisePickerOpen(false)
              }
            }}
          >
            <input
              className="search-input"
              aria-label="Search exercises"
              aria-expanded={exercisePickerOpen}
              aria-controls={exerciseResultsId}
              placeholder="Search exercises"
              value={query}
              onFocus={() => setExercisePickerOpen(true)}
              onClick={() => setExercisePickerOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value)
                setExercisePickerOpen(true)
              }}
            />
            <div
              className={`exercise-results-presence${exercisePickerOpen ? ' is-open' : ''}`}
              inert={!exercisePickerOpen}
              aria-hidden={!exercisePickerOpen}
            >
              <div className="exercise-results-clip">
                <div id={exerciseResultsId} className="exercise-results">
                  {!filtered.length && (
                    <p className="exercise-picker-empty">
                      No matching exercises. Create one below.
                    </p>
                  )}
                  {filtered.map((exercise) => (
                    <button
                      key={exercise.id}
                      onClick={() => {
                        add(exercise)
                        setQuery('')
                      }}
                    >
                      <span>{exercise.name}</span>
                      <small>{exercise.muscleGroup}</small>
                      <b>+</b>
                    </button>
                  ))}
                  <CustomExercise
                    onAdd={(exercise) => {
                      add(exercise)
                      setQuery('')
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy} onClick={submit}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CustomExercise({ onAdd }) {
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const add = async () => {
    if (saving.current || !custom.trim()) return
    saving.current = true
    setBusy(true)
    setError('')
    try {
      const item = await post('/exercises', { name: custom })
      onAdd(item)
      setCustom('')
    } catch (e) {
      setError(e.message)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  return (
    <>
      <div className="custom-add">
        <input
          disabled={busy}
          placeholder="Create custom exercise"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <button disabled={busy || !custom.trim()} onClick={add}>
          {busy ? 'Saving…' : 'Add'}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}

export { RoutinesPage, SessionForm, CustomExercise }
