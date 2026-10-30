import React, { useLayoutEffect, useRef, useState } from 'react'
import { api, post } from './requests.js'

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WeekPlan({ sessions, onAdd, onEdit, compact = false }) {
  const today = (new Date().getDay() + 6) % 7
  return <div className={`routine-week${compact ? ' is-compact' : ''}`}>{days.map((day, index) => {
    const planned = sessions.filter((session) => session.scheduledDays.includes(index))
    return <div className={`routine-day${index === today ? ' is-today' : ''}`} key={day}>
      <span className="routine-day-name">{day}</span>
      <div className="routine-day-sessions">{planned.length ? planned.map((session) => onEdit ? <button type="button" key={session.id} onClick={() => onEdit(session)}><strong>{session.name}</strong><span>{session.exercises.length} {session.exercises.length === 1 ? 'exercise' : 'exercises'}</span></button> : <span className="routine-session-name" key={session.id}>{session.name}</span>) : <span className="routine-rest">Rest day</span>}</div>
      {onAdd && <button type="button" className="routine-day-add" aria-label={`Add session on ${day}`} onClick={() => onAdd(index)}>+</button>}
    </div>
  })}</div>
}

export function RoutineManager({ data, selectedId, onSelect, setData, Modal, CloseButton }) {
  const [form, setForm] = useState(null)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const selector = useRef(null)
  const previousLayout = useRef(null)
  const selected = data.routines.find((routine) => routine.id === selectedId)
  useLayoutEffect(() => {
    const before = previousLayout.current
    previousLayout.current = null
    const root = selector.current
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reduceMotion === 'true'
    if (!before || !root?.animate || reducedMotion) return
    // Read the final layout before animating either the buttons or their children.
    const items = [...root.querySelectorAll(':scope > [data-layout-id]')].map((button) => ({
      button, rect: button.getBoundingClientRect(),
      name: button.querySelector('.routine-label'), nameRect: button.querySelector('.routine-label')?.getBoundingClientRect(),
      badge: button.querySelector('.routine-active-badge'), badgeRect: button.querySelector('.routine-active-badge')?.getBoundingClientRect(),
    }))
    const height = root.getBoundingClientRect().height
    const timing = { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' }
    const animations = []
    const animate = (element, frames) => animations.push(element.animate(frames, timing))
    for (const item of items) {
      const from = before.buttons.get(item.button.dataset.layoutId)
      const to = item.rect
      if (!from || !to.width || !to.height) continue
      const sx = from.rect.width / to.width
      const sy = from.rect.height / to.height
      animate(item.button, [
        { transform: `translate(${from.rect.left - to.left}px, ${from.rect.top - to.top}px) scale(${sx}, ${sy})` },
        { transform: 'translate(0, 0) scale(1)' },
      ])
      // Counter the parent's scale so labels and the travelling badge stay readable.
      const animateChild = (element, start, end, fade = false) => {
        if (!element || !start || !end?.width || !end.height) return
        const x = (start.left - from.rect.left) / sx - (end.left - to.left)
        const y = (start.top - from.rect.top) / sy - (end.top - to.top)
        animate(element, [
          { transform: `translate(${x}px, ${y}px) scale(${start.width / end.width / sx}, ${start.height / end.height / sy})`, opacity: fade ? .75 : 1 },
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        ])
      }
      animateChild(item.name, from.nameRect, item.nameRect)
      animateChild(item.badge, before.badgeRect, item.badgeRect, true)
    }
    if (before.height !== height) animate(root, [{ height: `${before.height}px` }, { height: `${height}px` }])
    return () => animations.forEach((animation) => animation.cancel())
  }, [data.activeRoutineId])
  const refresh = async () => {
    const next = await api('/bootstrap')
    const root = selector.current
    if (root && next.activeRoutineId !== data.activeRoutineId) {
      previousLayout.current = {
        height: root.getBoundingClientRect().height,
        badgeRect: root.querySelector('.routine-active-badge')?.getBoundingClientRect(),
        buttons: new Map([...root.querySelectorAll(':scope > [data-layout-id]')].map((button) => [button.dataset.layoutId, {
          rect: button.getBoundingClientRect(), nameRect: button.querySelector('.routine-label')?.getBoundingClientRect(),
        }])),
      }
    }
    setData(next)
    return next
  }
  const mutate = async (action, committed) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { const result = await action(); committed?.(result); await refresh() }
    catch (error) { setError(error.message) }
    finally { lock.current = false; setBusy(false) }
  }
  const close = () => { if (!lock.current) { setForm(null); setConfirmDelete(false) } }
  const edit = (routine) => { setError(''); setName(routine?.name || ''); setForm(routine || { id: null }) }
  return <>
    <div className={`routine-selector-row${selected && !selected.isActive ? ' has-activation' : ''}`}><div ref={selector} className="routine-selector" aria-label="Weekly routines">{data.routines.map((routine) => <div key={routine.id} data-layout-id={routine.id} className={`routine-option${routine.id === selectedId ? ' is-selected' : ''}`}>
      <button type="button" className="routine-option-select" disabled={busy} aria-pressed={routine.id === selectedId} onClick={() => { onSelect(routine.id); setError('') }}><span className="routine-label">{routine.name}</span>{Boolean(routine.isActive) && <small className="routine-active-badge">Active</small>}</button>
      {routine.id === selectedId && <div className="routine-option-tools"><button type="button" className="routine-action-icon" aria-label={`Rename ${routine.name}`} title="Rename routine" disabled={busy} onClick={() => edit(routine)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5M4 20l4-1L21 6a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></svg></button>{data.routines.length > 1 && <button type="button" className="routine-action-icon routine-remove" aria-label={`Delete ${routine.name}`} title="Delete routine" disabled={busy} onClick={() => { setError(''); setConfirmDelete(routine) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg></button>}</div>}
    </div>)}<button type="button" className="routine-create" data-layout-id="create" disabled={busy} onClick={() => edit(null)}>+ New routine</button></div>{selected && !selected.isActive && <button type="button" className="button primary compact routine-set-active" disabled={busy} onClick={() => mutate(() => post(`/routines/${selected.id}/activate`, {}))}>Set Active</button>}</div>

    {error && !form && !confirmDelete && <div className="form-error" role="alert">{error}<button type="button" className="text-button" disabled={busy} onClick={() => mutate(async () => {})}>Reload routines</button></div>}
    <Modal open={Boolean(form)} label={form?.id ? 'Rename routine' : 'New weekly routine'}><div className="modal-backdrop"><form className="modal sheet small-sheet routine-dialog" onSubmit={(event) => { event.preventDefault(); mutate(() => form.id ? api(`/routines/${form.id}`, { method: 'PUT', body: JSON.stringify({ name }) }) : post('/routines', { name }), (result) => { if (!form.id) onSelect(result.id); setForm(null) }) }}>
      <div className="modal-header"><div><p className="eyebrow">PLAN YOUR WEEK</p><h2>{form?.id ? 'Rename routine' : 'Create a routine'}</h2></div><CloseButton onClick={close} disabled={busy} /></div><input aria-label="Routine name" autoFocus required maxLength="80" disabled={busy} placeholder="Push Pull Legs" value={name} onChange={(event) => setName(event.target.value)} />{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={close}>Cancel</button><button type="submit" className="button primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</button></div>
    </form></div></Modal>
    <Modal open={Boolean(confirmDelete)} label="Delete weekly routine"><div className="modal-backdrop"><div className="modal sheet small-sheet routine-dialog"><div className="modal-header"><div><p className="eyebrow">WEEKLY ROUTINE</p><h2>Delete this routine?</h2></div><CloseButton onClick={close} disabled={busy} /></div><p className="modal-copy">Remove <strong>{confirmDelete?.name}</strong> and its planned sessions? Your workout history will stay saved.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={close}>Cancel</button><button type="button" className="button danger" disabled={busy} onClick={() => mutate(() => api(`/routines/${confirmDelete.id}`, { method: 'DELETE' }), () => { setConfirmDelete(false); if (selectedId === confirmDelete.id) onSelect(data.routines.find((routine) => routine.id !== confirmDelete.id && routine.isActive)?.id || data.routines.find((routine) => routine.id !== confirmDelete.id).id) })}>{busy ? 'Deleting…' : 'Delete routine'}</button></div></div></div></Modal>
  </>
}

export function TodaySessions({ sessions, onStart }) {
  if (sessions.length < 2) return null
  return <div className="today-sessions"><p className="eyebrow">TODAY'S SESSIONS</p>{sessions.map((session) => <button type="button" key={session.id} onClick={() => onStart(session)}><span><strong>{session.name}</strong><small>{session.completedToday ? 'Completed today · Train again' : `${session.exercises.length} ${session.exercises.length === 1 ? 'exercise' : 'exercises'}`}</small></span><span aria-hidden="true">{session.completedToday ? '✓' : '→'}</span></button>)}</div>
}

export function SessionDayPicker({ sessions, day, onAssign, onClose, CloseButton }) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const available = sessions.filter((session) => !session.scheduledDays.includes(day))
  const filtered = available.filter((session) => session.name.toLowerCase().includes(query.toLowerCase().trim()))
  const close = () => { if (!lock.current) onClose() }
  const assign = async (session) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await onAssign(session, day) }
    catch (error) { setError(error.message) }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className="modal-backdrop"><div className="modal sheet session-day-picker">
    <div className="modal-header"><div><p className="eyebrow">PLAN YOUR WEEK</p><h2>Add session to {days[day]}</h2></div><CloseButton onClick={close} disabled={busy} /></div>
    <p className="modal-copy">Choose an existing session from this routine. Its other scheduled days will stay the same.</p>
    {available.length > 0 && <input autoFocus aria-label="Search sessions" placeholder="Search sessions" value={query} disabled={busy} onChange={(event) => setQuery(event.target.value)} />}
    <div className="session-day-options">{filtered.map((session) => <button type="button" disabled={busy} key={session.id} onClick={() => assign(session)}><span><strong>{session.name}</strong><small>{session.exercises.length} {session.exercises.length === 1 ? 'exercise' : 'exercises'} · {session.scheduledDays.length ? session.scheduledDays.map((index) => days[index]).join(' / ') : 'Not scheduled'}</small></span><span aria-hidden="true">+</span></button>)}</div>
    {!filtered.length && <p className="session-picker-empty">{!sessions.length ? 'No sessions yet. Use Add session to create one first.' : !available.length ? `All sessions in this routine are already scheduled on ${days[day]}.` : 'No matching sessions found.'}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button secondary full" disabled={busy} onClick={close}>{busy ? 'Adding…' : 'Cancel'}</button></div>
  </div></div>
}
