import { ConfirmationDialog } from '../components/ConfirmationDialog.jsx'
import React, { useState, useRef } from 'react'
import { api, post } from '../requests.js'
import { MuscleIcon, NavIcon } from '../components/Icons.jsx'
import { ModalPresence, CloseButton } from '../components/Modal.jsx'
import { MuscleGroupSelect } from '../components/MuscleGroupSelect.jsx'

function Exercises({ data, setData }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deleteLock = useRef(false)
  const closeDelete = () => {
    if (!deleteLock.current) setPendingDelete(null)
  }
  const groups = ['All', ...new Set(data.exercises.map((exercise) => exercise.muscleGroup))]
  const filtered = data.exercises.filter(
    (exercise) =>
      (group === 'All' || exercise.muscleGroup === group) &&
      `${exercise.name} ${exercise.muscleGroup}`.toLowerCase().includes(query.toLowerCase()),
  )
  const remove = async () => {
    if (!pendingDelete || deleteLock.current) return
    deleteLock.current = true
    setDeleting(true)
    setDeleteError('')
    try {
      await api(`/exercises/${pendingDelete.id}`, { method: 'DELETE' })
      setData((current) => ({
        ...current,
        exercises: current.exercises.filter((item) => item.id !== pendingDelete.id),
      }))
      setPendingDelete(null)
    } catch (error) {
      setDeleteError(error.message)
    } finally {
      deleteLock.current = false
      setDeleting(false)
    }
  }
  return (
    <section className="screen exercises-screen">
      <div className="screen-heading library-heading">
        <div className="library-heading-title">
          <p className="eyebrow">MOVEMENT LIBRARY</p>
          <h1>Exercises</h1>
        </div>
        <div className="library-search-wrap">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            className="library-search"
            aria-label="Search exercises"
            placeholder="Search exercises or muscle groups"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button className="button primary library-add" onClick={() => setShowForm(true)}>
          <span aria-hidden="true">+</span> Add custom
        </button>
      </div>
      <p className="intro-copy">Find your movement. Build your next session.</p>
      <div className="library-filters" aria-label="Filter by muscle group">
        {(showAllGroups ? groups : groups.slice(0, 5)).map((item) => (
          <button
            type="button"
            key={item}
            className={group === item ? 'is-active' : ''}
            aria-pressed={group === item}
            onClick={() => setGroup(item)}
          >
            {item}
          </button>
        ))}
        {groups.length > 5 && (
          <button
            type="button"
            className="library-filter-toggle"
            aria-expanded={showAllGroups}
            onClick={() => setShowAllGroups((current) => !current)}
          >
            {showAllGroups ? 'Show Less −' : 'Show All +'}
          </button>
        )}
      </div>
      <div className="exercise-library">
        {filtered.map((exercise) => (
          <div className="library-row" key={exercise.id}>
            <span className="exercise-icon">
              <MuscleIcon group={exercise.muscleGroup} />
            </span>
            <div>
              <strong>{exercise.name}</strong>
              <small>{exercise.muscleGroup}</small>
            </div>
            {exercise.isCustom ? (
              <>
                <em>Custom</em>
                <button
                  className="library-delete"
                  aria-label={`Archive ${exercise.name}`}
                  title="Archive movement"
                  onClick={() => {
                    setDeleteError('')
                    setPendingDelete(exercise)
                  }}
                >
                  ×
                </button>
              </>
            ) : (
              <span className="built-in-label">Built-in</span>
            )}
          </div>
        ))}
      </div>
      {!filtered.length && (
        <div className="library-empty">
          <NavIcon type="exercise" />
          <h2>No movements found</h2>
          <p>Try another name or muscle group.</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setQuery('')
              setGroup('All')
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <ModalPresence open={showForm} label="Add custom movement">
        <CustomExerciseModal
          onSave={(exercise) => {
            setData({ ...data, exercises: [...data.exercises, exercise] })
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      </ModalPresence>
      <ConfirmationDialog
        open={Boolean(pendingDelete)}
        label="Archive custom movement"
        title="Archive this movement?"
        eyebrow="MOVEMENT LIBRARY"
        description={
          <>
            This movement will be removed from your library. Existing schedules and workout history
            will be kept.
          </>
        }
        className="delete-movement-sheet"
        busy={deleting}
        onClose={closeDelete}
        onConfirm={remove}
        confirmLabel={deleting ? 'Archiving…' : 'Archive movement'}
        cancelLabel="Cancel"
        cancelClassName=""
      >
        <div className="delete-movement-preview">
          <span className="exercise-icon">
            <MuscleIcon group={pendingDelete?.muscleGroup} />
          </span>
          <div>
            <strong>{pendingDelete?.name}</strong>
            <span>{pendingDelete?.muscleGroup}</span>
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

function CustomExerciseModal({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('Other')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!name.trim()) return setError('Movement name is required.')
    setBusy(true)
    try {
      const exercise = await post('/exercises', { name, muscleGroup })
      onSave(exercise)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="modal-backdrop">
      <div className="modal sheet small-sheet">
        <div className="modal-header">
          <div>
            <p className="eyebrow">EXERCISE LIBRARY</p>
            <h2>Add custom movement</h2>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <p className="modal-copy">Save a movement once, then reuse it in any template.</p>
        <label>
          Movement name
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Bench Press"
          />
        </label>
        <MuscleGroupSelect value={muscleGroup} onChange={setMuscleGroup} />
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy} onClick={save}>
            {busy ? 'Saving...' : 'Save movement'}
          </button>
        </div>
      </div>
    </div>
  )
}

export { Exercises, CustomExerciseModal }
