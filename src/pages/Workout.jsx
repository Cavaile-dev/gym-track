import React, { useState, useRef, useEffect } from 'react'
import { createSetWriter, post, api } from '../requests.js'
import { Transition } from '../components/Transition.jsx'
import { formatKg, formatDate } from '../utils/format.js'
import { Stat } from './Dashboard.jsx'

function Workout({ workout, onFinish, onAbandon, restDuration = 90 }) {
  const [timer, setTimer] = useState(0)
  const [duration, setDuration] = useState(restDuration)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [error, setError] = useState('')
  const [logs, setLogs] = useState(workout.logs || [])
  const [exerciseIndex, setExerciseIndex] = useState(() =>
    workout.template.exercises.findIndex(
      (exercise) =>
        (workout.logs || []).filter((log) => log.exerciseId === exercise.id).length <
        exercise.targetSets,
    ) < 0
      ? 0
      : workout.template.exercises.findIndex(
          (exercise) =>
            (workout.logs || []).filter((log) => log.exerciseId === exercise.id).length <
            exercise.targetSets,
        ),
  )
  const [extraSets, setExtraSets] = useState(0)
  const [saving, setSaving] = useState(false)
  const [retrySave, setRetrySave] = useState(false)
  const mutationLock = useRef(false)
  const writer = useRef(null)
  const editPrefill = useRef(null)
  if (!writer.current)
    writer.current = createSetWriter((body) => post(`/workouts/${workout.id}/sets`, body))
  const exercise = workout.template.exercises[exerciseIndex]
  const exerciseLogs = logs.filter((log) => log.exerciseId === exercise.id)
  const targetSets = exercise.targetSets + extraSets
  const setNumber = exerciseLogs.length + 1
  const targetDone = setNumber > targetSets
  const isLast = exerciseIndex === workout.template.exercises.length - 1
  const isFinalSet = isLast && setNumber === targetSets
  const previous = workout.previous?.[exercise.id] || null
  useEffect(() => {
    const last =
      editPrefill.current || [...logs].reverse().find((log) => log.exerciseId === exercise.id)
    editPrefill.current = null
    if (last) {
      setWeight(String(last.weight))
      setReps(String(last.reps))
    } else {
      setWeight(previous ? String(previous.weight) : '')
      setReps(previous ? String(previous.reps) : '')
    }
  }, [exercise.id, workout.id])
  useEffect(() => {
    if (!timer) return
    const interval = setInterval(() => setTimer((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(interval)
  }, [timer])
  const logSet = async () => {
    if (mutationLock.current) return
    mutationLock.current = true
    setSaving(true)
    setError('')
    try {
      const next = await writer.current.submit({ exerciseId: exercise.id, weight, reps })
      setLogs(next.logs)
      setRetrySave(false)
      if (!isFinalSet) setTimer(duration)
    } catch (e) {
      setRetrySave(Boolean(writer.current.pending))
      setError(e.message)
    } finally {
      mutationLock.current = false
      setSaving(false)
    }
  }
  const undoLastSet = async () => {
    if (mutationLock.current || retrySave) return
    const lastSet = logs[logs.length - 1]
    if (!lastSet) return onAbandon(false)
    const lastExerciseIndex = workout.template.exercises.findIndex(
      (item) => item.id === lastSet.exerciseId,
    )
    if (lastExerciseIndex < 0) return setError('This exercise is no longer available.')
    mutationLock.current = true
    setSaving(true)
    setError('')
    try {
      const next = await api(`/workouts/${workout.id}/sets/${lastSet.id}`, { method: 'DELETE' })
      if (lastExerciseIndex !== exerciseIndex) {
        editPrefill.current = lastSet
        const loggedSets = logs.filter((item) => item.exerciseId === lastSet.exerciseId).length
        setExtraSets(
          Math.max(0, loggedSets - workout.template.exercises[lastExerciseIndex].targetSets),
        )
        setExerciseIndex(lastExerciseIndex)
      }
      setLogs(next.logs)
      setTimer(0)
      setWeight(String(lastSet.weight))
      setReps(String(lastSet.reps))
    } catch (e) {
      setError(e.message)
    } finally {
      mutationLock.current = false
      setSaving(false)
    }
  }
  const nextExercise = () => {
    if (isLast) onFinish('summary', { ...workout, logs })
    else {
      setExerciseIndex(exerciseIndex + 1)
      setExtraSets(0)
      setTimer(0)
    }
  }
  const totalSets = logs.length
  const totalVolume = logs.reduce((sum, log) => sum + log.weight * log.reps, 0)
  const progress =
    ((exerciseIndex + Math.min(exerciseLogs.length, targetSets) / targetSets) /
      workout.template.exercises.length) *
    100
  if (workout.summary)
    return (
      <Transition transitionKey="summary" resetScroll className="workout-transition">
        <Summary workout={{ ...workout, logs }} onFinish={onFinish} />
      </Transition>
    )
  if (timer > 0) {
    const restExercise =
      targetDone && !isLast ? workout.template.exercises[exerciseIndex + 1] : exercise
    const restTargetSets = restExercise.id === exercise.id ? targetSets : restExercise.targetSets
    const restSetNumber =
      restExercise.id === exercise.id
        ? setNumber
        : logs.filter((log) => log.exerciseId === restExercise.id).length + 1
    return (
      <Transition transitionKey="rest" resetScroll className="workout-transition">
        <RestTimer
          timer={timer}
          duration={duration}
          setTimer={setTimer}
          exercise={restExercise.name}
          setNumber={Math.min(restSetNumber, restTargetSets)}
          totalSets={restTargetSets}
        />
      </Transition>
    )
  }
  return (
    <Transition
      transitionKey={`exercise-${exercise.id}`}
      resetScroll
      className="workout-transition"
    >
      <section className="workout-screen">
        <div className="workout-top">
          <button
            className={`back-button${logs.length ? ' edit-last-set-button' : ' leave-workout-button'}`}
            disabled={saving || retrySave}
            onClick={undoLastSet}
          >
            {logs.length ? '←' : '×'} <span>{logs.length ? 'Edit last set' : 'Leave workout'}</span>
          </button>
          <span className="workout-count">
            {exerciseIndex + 1}/{workout.template.exercises.length}
          </span>
        </div>
        <div className="progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="workout-heading">
          <p className="workout-label">{workout.template.name}</p>
          <p className="eyebrow">EXERCISE {String(exerciseIndex + 1).padStart(2, '0')}</p>
          <h1>{exercise.name}</h1>
          <p className="muted">
            {exercise.muscleGroup} <span className="dot-sep">·</span> Set{' '}
            {Math.min(setNumber, targetSets)} of {targetSets}
            {targetDone ? ' complete' : ''}
          </p>
        </div>
        <div className="previous-card">
          <span className="muted">LAST SESSION · {workout.template.name}</span>
          {previous ? (
            <strong>
              {previous.weight} kg <span>×</span> {previous.reps} reps
            </strong>
          ) : (
            <strong className="previous-empty">
              No previous record <span>· New exercise</span>
            </strong>
          )}
        </div>
        {!targetDone ? (
          <div className="set-entry">
            <div className="input-row">
              <label>
                Weight{' '}
                <div className="weight-input">
                  <input
                    type="number"
                    aria-label="Weight in kilograms"
                    disabled={saving || retrySave}
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="0"
                  />
                  <span className="input-unit" aria-hidden="true">
                    KG
                  </span>
                </div>
                <QuickAdjust
                  values={['0.25', '0.50', '1']}
                  value={weight}
                  onChange={setWeight}
                  disabled={saving || retrySave}
                />
              </label>
              <label>
                Reps{' '}
                <input
                  type="number"
                  aria-label="Repetitions"
                  disabled={saving || retrySave}
                  inputMode="numeric"
                  min="0"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="0"
                />
                <QuickAdjust
                  values={['1', '2', '5']}
                  value={reps}
                  onChange={setReps}
                  disabled={saving || retrySave}
                />
              </label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="button primary full log-button" disabled={saving} onClick={logSet}>
              {saving ? 'Saving…' : retrySave ? 'Retry save' : 'Log set'} <span>↵</span>
            </button>
          </div>
        ) : (
          <div className="complete-card">
            <span className="complete-check">✓</span>
            <h2>Exercise complete</h2>
            <p className="muted">{exerciseLogs.length} sets logged. Nice work.</p>
            <button
              className="button primary full"
              disabled={saving || retrySave}
              onClick={nextExercise}
            >
              {isLast ? 'View summary' : 'Next exercise'} <span>→</span>
            </button>
            <button className="button secondary full" onClick={() => setExtraSets(extraSets + 1)}>
              + Add set
            </button>
          </div>
        )}
        {timer > 0 && (
          <div className="timer-card">
            <div
              className="timer-ring"
              style={{ '--timer-progress': `${(timer / duration) * 360}deg` }}
            >
              <strong>{timer}</strong>
              <small>SEC</small>
            </div>
            <div className="timer-copy">
              <span className="card-kicker">REST TIMER</span>
              <strong>Recover, then go.</strong>
              <div className="timer-controls">
                <button className="timer-minus" onClick={() => setTimer(Math.max(0, timer - 15))}>
                  − 15s
                </button>
                <button className="timer-plus" onClick={() => setTimer(timer + 15)}>
                  + 15s
                </button>
                <button onClick={() => setTimer(0)}>Skip</button>
              </div>
            </div>
          </div>
        )}
        <div className="workout-footer">
          <button onClick={() => setDuration(duration === 90 ? 60 : duration === 60 ? 120 : 90)}>
            Rest: {duration}s
          </button>
          <span>
            {totalSets} sets <span className="dot-sep">·</span> {formatKg(totalVolume)}
          </span>
        </div>
      </section>
    </Transition>
  )
}

function QuickAdjust({ value, values, onChange, disabled = false }) {
  const adjust = (amount) => onChange(String(Math.max(0, (Number(value) || 0) + amount)))
  return (
    <div className="quick-adjust">
      {values.map((amount) => (
        <React.Fragment key={amount}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => adjust(-Number(amount))}
            className="quick-adjust-minus"
            aria-label={`Decrease by ${amount}`}
          >
            <span aria-hidden="true">−</span>
            <span>{amount}</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => adjust(Number(amount))}
            className="quick-adjust-plus"
            aria-label={`Increase by ${amount}`}
          >
            <span aria-hidden="true">+</span>
            <span>{amount}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  )
}

function RestTimer({ timer, duration, setTimer, exercise, setNumber, totalSets }) {
  return (
    <section className="rest-screen">
      <div className="rest-center">
        <div className="rest-ring" style={{ '--timer-progress': `${(timer / duration) * 360}deg` }}>
          <strong>{timer}</strong>
          <span>seconds</span>
        </div>
        <h1>Recover.</h1>
        <p className="muted">Reset your energy. Make the next set your strongest.</p>
      </div>
      <div className="rest-actions">
        <div className="rest-details">
          <p className="eyebrow">REST TIMER</p>
          <p className="rest-set-context">
            <strong>{exercise}</strong>
            <span className="dot-sep" aria-hidden="true">
              ·
            </span>
            <span className="rest-set-progress">
              Set {setNumber} / {totalSets}
            </span>
          </p>
        </div>
        <div className="timer-controls">
          <button className="timer-minus" onClick={() => setTimer(Math.max(0, timer - 15))}>
            − 15s
          </button>
          <button className="timer-plus" onClick={() => setTimer(timer + 15)}>
            + 15s
          </button>
        </div>
        <button className="button primary full" onClick={() => setTimer(0)}>
          Skip rest <span>→</span>
        </button>
      </div>
    </section>
  )
}

function Summary({ workout, onFinish }) {
  const logs = workout.logs || []
  const volume = logs.reduce((sum, log) => sum + log.weight * log.reps, 0)
  return (
    <section className="summary-screen">
      <div className="summary-orb">✓</div>
      <p className="eyebrow">SESSION COMPLETE</p>
      <h1>Strong work.</h1>
      <p className="muted">
        {workout.template.name} <span className="dot-sep">·</span> {formatDate(new Date())}
      </p>
      <div className="summary-stats">
        <Stat label="Sets" value={logs.length} detail="logged" />
        <Stat label="Volume" value={formatKg(volume)} detail="total" />
        <Stat
          label="Exercises"
          value={new Set(logs.map((log) => log.exerciseId)).size}
          detail="completed"
        />
      </div>
      <div className="summary-note">Every set counts. This one is now part of your history.</div>
      <button className="button primary full" onClick={() => onFinish('done')}>
        Finish workout <span>→</span>
      </button>
    </section>
  )
}

export { Workout, QuickAdjust, RestTimer, Summary }
