import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { sortTemplatesByDay, withUpdatedTemplates } from './schedules.js'
import { RoutineManager, WeekPlan, TodaySessions, SessionDayPicker } from './Routines.jsx'
import { AccountDropdown, Profile, Settings } from './Account.jsx'
import { defaultPreferences, readPreferences, savePreferences } from './accountPreferences.js'
import { api, post, createSetWriter, mutateAndRefresh } from './requests.js'
import './styles.css'
import './responsive.css'

const logo = '/assets/logo_sqr.jpg'
const muscleGroupIcons = {
  'Arms': '/assets/exercises/muscles/arms.svg?v=20261030',
  'Biceps': '/assets/exercises/muscles/biceps.svg?v=20261030',
  'Triceps': '/assets/exercises/muscles/triceps.svg?v=20261030',
  'Forearms': '/assets/exercises/muscles/forearms.svg?v=20261030',
  'Back': '/assets/exercises/muscles/back.svg',
  'Lats': '/assets/exercises/muscles/lats.svg',
  'Upper Back': '/assets/exercises/muscles/upper-back.svg',
  'Lower Back': '/assets/exercises/muscles/lower-back.svg',
  'Chest': '/assets/exercises/muscles/chest.svg',
  'Core': '/assets/exercises/muscles/core.svg',
  'Legs': '/assets/exercises/muscles/legs.svg',
  'Quadriceps': '/assets/exercises/muscles/quadriceps.svg',
  'Hamstrings': '/assets/exercises/muscles/hamstrings.svg',
  'Glutes': '/assets/exercises/muscles/glutes.svg',
  'Calves': '/assets/exercises/muscles/calves.svg',
  'Adductors': '/assets/exercises/muscles/adductors.svg',
  'Shoulders': '/assets/exercises/muscles/shoulders.svg',
  'Full Body': '/assets/exercises/muscles/full-body.svg',
  'Other': '/assets/exercises/muscles/other.svg',
}

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const muscleGroups = ['Chest', 'Shoulders', 'Lats', 'Upper Back', 'Lower Back', 'Biceps', 'Triceps', 'Forearms', 'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Core', 'Full Body', 'Other']
const formatDate = (date, options = { month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('en', options).format(new Date(date))
const formatRecordDate = (value) => {
  const date = new Date(value)
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`
}
const formatKg = (value) => `${Number(value || 0).toLocaleString()} kg`

const TRANSITION_MS = 300
const pageOrder = ['dashboard', 'templates', 'exercises', 'history', 'profile', 'settings']

function Transition({ transitionKey, className = '', order, resetScroll = false, children }) {
  const root = useRef(null)
  const previousChildren = useRef(children)
  const [scene, setScene] = useState({ key: transitionKey, id: 0, exiting: null, direction: 1 })

  // Keep the outgoing layer's identity so its components are not mounted twice.
  if (scene.key !== transitionKey) {
    setScene({
      key: transitionKey,
      id: scene.id + 1,
      exiting: { id: scene.id, children: previousChildren.current },
      direction: order && order.indexOf(transitionKey) < order.indexOf(scene.key) ? -1 : 1,
    })
  }

  useLayoutEffect(() => {
    if (!scene.exiting) return undefined
    if (resetScroll) window.scrollTo({ top: 0, behavior: 'instant' })
    const element = root.current
    const outgoing = element.querySelector(':scope > .transition-exit')
    const current = element.querySelector(':scope > .transition-current')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setScene((value) => ({ ...value, exiting: null }))
      return undefined
    }

    // Animate the container too when the next page is shorter or taller.
    element.style.height = `${outgoing.offsetHeight}px`
    let timeout
    const frame = window.requestAnimationFrame(() => {
      element.style.height = `${current.offsetHeight}px`
      timeout = window.setTimeout(() => {
        element.style.height = ''
        setScene((value) => ({ ...value, exiting: null }))
      }, TRANSITION_MS)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
      element.style.height = ''
    }
  }, [scene.id])

  useLayoutEffect(() => {
    previousChildren.current = children
  }, [children])

  return <div ref={root} className={`${className} transition-root${scene.exiting ? ' transitioning' : ''}`} style={{ '--transition-direction': scene.direction, '--transition-duration': `${TRANSITION_MS}ms` }}>
    {scene.exiting && <div key={scene.exiting.id} className="transition-layer transition-exit" aria-hidden="true" inert>{scene.exiting.children}</div>}
    <div key={scene.id} className="transition-layer transition-current">{children}</div>
  </div>
}

function ModalPresence({ open, overlay = true, label = 'Dialog', children }) {
  const presenceRoot = useRef(null)
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const latestOpenContent = useRef(children)
  const returnFocus = useRef(null)

  if (open) latestOpenContent.current = children

  useLayoutEffect(() => {
    if (open && !mounted) returnFocus.current = document.activeElement
  }, [open, mounted])

  useLayoutEffect(() => {
    if (!mounted || !overlay) return undefined
    const appRoot = document.getElementById('root')
    const previousInert = appRoot.inert
    const previousOverflow = document.body.style.overflow
    appRoot.inert = true
    document.body.style.overflow = 'hidden'
    return () => {
      appRoot.inert = previousInert
      document.body.style.overflow = previousOverflow
      if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true })
    }
  }, [mounted, overlay])

  useEffect(() => {
    if (!mounted || !overlay || !open) return undefined
    const element = presenceRoot.current
    if (!element.contains(document.activeElement)) {
      const initialFocus = element.querySelector('input') || element.querySelector('button')
      initialFocus?.focus({ preventScroll: true })
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        element.querySelector('.close-button')?.click()
      }
      if (event.key !== 'Tab') return
      const controls = [...element.querySelectorAll('button, input, select, [tabindex="0"]')].filter((control) => !control.disabled && !control.closest('[inert]') && control.getClientRects().length)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mounted, overlay, open])

  useEffect(() => {
    let frame
    let timeout
    if (open) {
      setMounted(true)
      // Paint the closed position before starting the entrance transition.
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => setVisible(true))
      })
    } else if (mounted) {
      setVisible(false)
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      timeout = window.setTimeout(() => setMounted(false), reducedMotion ? 0 : TRANSITION_MS)
    }
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      if (timeout) window.clearTimeout(timeout)
    }
  }, [open])

  if (!mounted) return null
  const content = open ? children : latestOpenContent.current
  const presence = <div ref={presenceRoot} className={`modal-presence${open && visible ? ' is-open' : ''}`} style={{ '--modal-duration': `${TRANSITION_MS}ms` }} role={overlay ? 'dialog' : undefined} aria-modal={overlay || undefined} aria-label={overlay ? label : undefined} inert={!open} aria-hidden={!open || undefined}>
    {content}
  </div>
  return overlay ? createPortal(presence, document.body) : presence
}

function CloseButton({ onClick, label = 'Close popup', disabled = false }) {
  return <button type="button" className="close-button" aria-label={label} disabled={disabled} onClick={onClick}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
}

function Auth({ onLogin }) {
  const [mode, setMode] = useState('login'); const [form, setForm] = useState({}); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const submitting = useRef(false)
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const submit = async (event) => { event.preventDefault(); if (submitting.current) return; submitting.current = true; setError(''); setBusy(true); try { const data = await post(`/auth/${mode}`, form); await onLogin(data.user) } catch (e) { setError(e.message) } finally { submitting.current = false; setBusy(false) } }
  return <main className="auth-shell"><div className="auth-brand"><img className="brand-image" src={logo} alt="Gym Track" /><span>GYM TRACK</span></div><div className="auth-intro"><p className="eyebrow">YOUR SPACE TO GET STRONGER</p><h2>Make every<br /><span>session count.</span></h2><p>Plan your week. Log your sets.<br />See how far you've come.</p><div className="auth-principles"><span><NavIcon type="schedule" />Plan</span><span><NavIcon type="exercise" />Train</span><span><NavIcon type="history" />Progress</span></div></div><div className="auth-panel"><p className="eyebrow">YOUR WORKOUT, SHARPER</p><h1>{mode === 'login' ? 'Welcome back.' : 'Build your rhythm.'}</h1><p className="muted">{mode === 'login' ? 'Pick up where you left off.' : 'A simple log for stronger sessions.'}</p><form onSubmit={submit} className="stack-form"><label>Username<input autoComplete="username" minLength="3" maxLength="32" pattern="[a-zA-Z0-9_.-]+" title="3–32 letters, numbers, dots, underscores, or hyphens" value={form.username || ''} onChange={update('username')} required /></label>{mode === 'register' && <label><span>Email <span className="optional">optional</span></span><input type="email" value={form.email || ''} onChange={update('email')} /></label>}<label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password || ''} onChange={update('password')} minLength="8" maxLength="128" required /></label>{mode === 'register' && <label>Confirm password<input type="password" value={form.confirmPassword || ''} onChange={update('confirmPassword')} required /></label>}{error && <div className="error-box">{error}</div>}<button className="button primary full" disabled={busy}>{busy ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form><button className="text-button" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}</button></div><p className="auth-foot">YOUR TRAINING <span>·</span> YOUR PROGRESS</p></main>
}

function NavIcon({ type }) {
  return <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'home' ? <><path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9" /></> : type === 'schedule' ? <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></> : type === 'exercise' ? <><path d="M8 12h8M3 10v4M7 6v12M17 6v12M21 10v4M3 12h4M17 12h4" /></> : <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2" /></>}
  </svg>
}

function Layout({ user, page, setPage, onLogout, children }) {
  const navigation = [
    { page: 'dashboard', label: 'Today', icon: 'home' },
    { page: 'templates', label: 'Schedule', icon: 'schedule' },
    { page: 'exercises', label: 'Exercises', icon: 'exercise' },
    { page: 'history', label: 'History', icon: 'history' },
  ]
  return <div className="app-shell">
    <header className="topbar">
      <button type="button" className="brand" aria-label="Gym Track home" onClick={() => setPage('dashboard')}><img className="brand-image small" src={logo} alt="" /><span className="brand-wordmark"><strong>GYM TRACK</strong><small>TRAINING JOURNAL</small></span></button>
      <div className="user-menu"><AccountDropdown user={user} page={page} onNavigate={setPage} onLogout={onLogout} /></div>
    </header>
    <main className="page-wrap"><Transition transitionKey={page} order={pageOrder} resetScroll className="page-transition">{children}</Transition></main>
    <footer className="app-navigation"><div className="navigation-inner"><p className="navigation-caption">YOUR TRAINING</p><nav className="bottom-nav" aria-label="Main navigation">{navigation.map((item) => <button type="button" key={item.page} className={page === item.page ? 'active' : ''} aria-current={page === item.page ? 'page' : undefined} onClick={() => setPage(item.page)}><span className="nav-icon"><NavIcon type={item.icon} /></span><span>{item.label}</span><span className="navigation-arrow" aria-hidden="true">↗</span></button>)}</nav><div className="navigation-note"><span className="navigation-note-icon"><NavIcon type="exercise" /></span><strong>One more rep.</strong><span>A little stronger, every session.</span></div></div></footer>
  </div>
}

function SessionMetaIcon({ type }) {
  return <svg className="session-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'clock' ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 9h16" /></>}
  </svg>
}

function Dashboard({ data, user, onStart, setPage }) {
  const active = data.active; const today = data.today; const [showChooser, setShowChooser] = useState(false)
  const routineSessions = data.templates.filter((template) => template.routineId === data.activeRoutineId)
  return <section className="screen dashboard-screen"><div className="screen-heading"><div><p className="eyebrow">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date())}</p><h1>Hey, {user.username}.</h1></div><div className="streak-pill"><strong>{data.stats.totalDays}</strong><span>TOTAL DAYS</span></div></div><div className="dashboard-board">{active ? <div className="hero-card resume-card"><div><p className="card-kicker">IN PROGRESS</p><h2>{active.template.name}</h2><p className="muted">Your session is saved. Ready when you are.</p></div><button className="button primary" onClick={() => onStart(active)}>Resume <span>→</span></button></div> : today ? <div className="hero-card"><div className="hero-top"><span className="card-kicker">TODAY'S SESSION</span><span className="schedule-tag">{weekdays[(new Date().getDay() + 6) % 7]}</span></div><h2>{today.name}</h2><p className="muted session-meta"><span><NavIcon type="exercise" />{today.exercises.length} Exercises</span><span aria-label={`Estimated duration: ${today.exercises.length * 8 + 12} minutes`}><SessionMetaIcon type="clock" />{today.exercises.length * 8 + 12} min</span><span aria-label={today.lastPerformed ? `Last performed: ${formatDate(today.lastPerformed)}` : 'New template'}><SessionMetaIcon type="calendar" />{today.lastPerformed ? formatDate(today.lastPerformed) : 'new template'}</span></p><button className="button primary full start-workout-button" onClick={() => onStart(today)}>{today.completedToday ? 'Train again' : 'Start workout'} <span>→</span></button><button className="button secondary full choose-template-button" onClick={() => setShowChooser(true)}>Choose another session</button><TodaySessions sessions={data.todaySessions || []} onStart={onStart} /></div> : <div className="hero-card empty-card"><span className="empty-symbol">+</span><h2>No session planned</h2><p className="muted">Set up a template and schedule it for today.</p><button className="button primary" onClick={() => setPage('templates')}>Pick a template <span>→</span></button></div>}<aside className="week-board"><div className="week-board-heading"><h2>Your Training Week</h2></div><WeekPlan sessions={routineSessions} compact /><button type="button" className="week-board-link" onClick={() => setPage('templates')}>Manage schedules <span aria-hidden="true">↗</span></button></aside></div><DashboardInsights stats={data.stats} /><ModalPresence open={showChooser} label="Choose a schedule"><TemplateChooser templates={routineSessions} onSelect={(template) => { setShowChooser(false); onStart(template) }} onClose={() => setShowChooser(false)} /></ModalPresence></section>
}
function DashboardInsightIcon({ type }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'trophy' ? <><path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6v3H9z" /></> : type === 'volume' ? <><path d="M7 9h10M7 15h10M3 9v6M7 6v12M17 6v12M21 9v6M3 12h4M17 12h4" /></> : <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16m-12 5 3 3 5-5" /></>}
  </svg>
}

function DashboardInsights({ stats }) {
  const delta = stats.volumeDelta
  return <div className="dashboard-insights">
    <section aria-labelledby="glance-title">
      <div className="insight-section-heading"><h2 id="glance-title">At a Glance</h2><span>This Week</span></div>
      <div className="insight-stats">
        <div className="insight-volume">
          <div className="insight-stat-label"><span className="insight-icon"><DashboardInsightIcon type="volume" /></span><span>Total volume</span></div>
          <div className="insight-volume-value"><strong>{Number(stats.volume || 0).toLocaleString()}</strong><span>kg</span></div>
          <div className="insight-volume-footer">{delta === null ? <span className="insight-no-comparison">Your training volume this week</span> : <><span className={`insight-change${delta < 0 ? ' is-down' : delta === 0 ? ' is-flat' : ''}`}><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={delta < 0 ? 'M3 5l5 5 5-5' : delta === 0 ? 'M3 8h10' : 'M3 10l5-5 5 5'} /></svg>{delta > 0 ? '+' : ''}{delta}%</span><span>vs last week</span></>}</div>
        </div>
        <div className="insight-count"><div className="insight-stat-label"><DashboardInsightIcon type="workout" /><span>This Week</span></div><strong>{stats.workoutsWeek}</strong><span className="insight-count-unit">{stats.workoutsWeek === 1 ? 'workout' : 'workouts'}</span></div>
        <div className="insight-count"><div className="insight-stat-label"><SessionMetaIcon type="calendar" /><span>This Month</span></div><strong>{stats.workoutsMonth}</strong><span className="insight-count-unit">{stats.workoutsMonth === 1 ? 'workout' : 'workouts'}</span></div>
      </div>
    </section>
    <section aria-labelledby="records-title">
      <div className="insight-section-heading"><h2 id="records-title">Personal Records</h2><span>Top Loads</span></div>
      <div className="insight-records">
        {stats.records.length ? <ol className="insight-record-list">{stats.records.map((record, index) => <li className="insight-record" key={`${record.name}-${index}`}>
          <span className={`insight-record-rank${index === 0 ? ' is-first' : ''}`} aria-label={`Rank ${index + 1}`}>{index === 0 ? <DashboardInsightIcon type="trophy" /> : String(index + 1).padStart(2, '0')}</span>
          <div className="insight-record-info"><strong>{record.name}</strong><span><SessionMetaIcon type="calendar" />{formatRecordDate(record.date)}</span></div>
          <div className="insight-record-result"><strong>{Number(record.weight).toLocaleString()} <span>kg</span></strong><small>× {record.reps} reps</small></div>
        </li>)}</ol> : <div className="insight-record-empty"><span className="insight-record-empty-icon"><DashboardInsightIcon type="trophy" /></span><h3>Your next milestone starts here.</h3><p>Log a workout to see your best sets.</p></div>}
      </div>
    </section>
  </div>
}

function TemplateChooser({ templates, onSelect, onClose }) {
  const todayIndex = (new Date().getDay() + 6) % 7
  return <div className="modal-backdrop"><div className="modal sheet chooser-sheet">
    <div className="modal-header"><div><p className="eyebrow">CHOOSE A SESSION</p><h2>Pick a session</h2></div><CloseButton label="Close schedule picker" onClick={onClose} /></div>
    <p className="modal-copy">Select a routine to start your workout.</p>
    {templates.length > 0 && <div className="chooser-list-heading"><span>YOUR WEEK</span><span>{templates.length} {templates.length === 1 ? 'session' : 'sessions'}</span></div>}
    <div className="chooser-list">
      {sortTemplatesByDay(templates).map((template) => {
        const days = [...template.scheduledDays].sort((a, b) => a - b)
        const isToday = days.includes(todayIndex)
        const totalSets = template.exercises.reduce((sum, exercise) => sum + Number(exercise.targetSets), 0)
        return <button className={`chooser-row${isToday ? ' is-today' : ''}`} key={template.id} onClick={() => onSelect(template)}>
          <span className="chooser-day" aria-hidden="true"><SessionMetaIcon type="calendar" /><span>{days.length ? weekdays[days[0]] : 'Any day'}</span></span>
          <span className="chooser-info">
            <span className="chooser-title"><strong>{template.name}</strong>{isToday && <span className="template-today"><i aria-hidden="true" />Today</span>}</span>
            <span className="chooser-meta">{template.exercises.length} exercises<span aria-hidden="true">·</span>{totalSets} sets</span>
            <span className="chooser-days">{days.length ? days.map((day) => weekdays[day]).join(' / ') : 'No days assigned'}</span>
          </span>
          <span className="chooser-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
        </button>
      })}
      {!templates.length && <div className="chooser-empty"><SessionMetaIcon type="calendar" /><h3>No sessions yet</h3><p>Add a session to your active routine to get started.</p></div>}
    </div>
  </div></div>
}
function Stat({ label, value, detail }) { return <div className="stat-card"><span className="muted">{label}</span><strong>{value}</strong><small>{detail}</small></div> }

function Templates({ data, setData }) {
  const [editing, setEditing] = useState(null); const [showForm, setShowForm] = useState(false); const [deleteError, setDeleteError] = useState(''); const [pendingDelete, setPendingDelete] = useState(null); const [deleteBusy, setDeleteBusy] = useState(false); const deleting = useRef(false)
  const [viewedRoutineId, setViewedRoutineId] = useState(data.activeRoutineId)
  const [pickSessionDay, setPickSessionDay] = useState(null)
  const selectedRoutineId = data.routines.some((routine) => routine.id === viewedRoutineId) ? viewedRoutineId : data.activeRoutineId
  const routineSessions = data.templates.filter((template) => template.routineId === selectedRoutineId)
  const closeDelete = () => { if (!deleting.current) setPendingDelete(null) }
  const save = async (payload) => { payload = { ...payload, routineId: editing?.routineId || selectedRoutineId }; const saved = editing ? await api(`/templates/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) }) : await post('/templates', payload); setData((current) => { const templates = editing ? current.templates.map((item) => item.id === saved.id ? saved : item) : [...current.templates, saved]; return withUpdatedTemplates(current, templates) }); setShowForm(false); setEditing(null) }
  const remove = async () => {
    if (!pendingDelete || deleting.current) return
    deleting.current = true; setDeleteBusy(true); setDeleteError('')
    try {
      await api(`/templates/${pendingDelete.id}`, { method: 'DELETE' })
      setData((current) => {
        const templates = current.templates.filter((item) => item.id !== pendingDelete.id)
        return withUpdatedTemplates(current, templates)
      })
      setPendingDelete(null)
    } catch (e) { setDeleteError(e.message) }
    finally { deleting.current = false; setDeleteBusy(false) }
  }
  const todayIndex = (new Date().getDay() + 6) % 7
  const edit = (template) => { setEditing(template); setShowForm(true) }
  const assignSession = async (session, day) => {
    const saved = await post(`/templates/${session.id}/schedule`, { day })
    setData((current) => withUpdatedTemplates(current, current.templates.map((item) => item.id === saved.id ? saved : item)))
    setPickSessionDay(null)
  }
  return <section className="screen schedule-screen">
    <div className="screen-heading">
      <div><p className="eyebrow">YOUR TRAINING SCHEDULE</p><h1>Routines</h1></div>
    </div>
    <p className="intro-copy">Build your weekly routine. Add one or more sessions to any day.</p>
    <RoutineManager data={data} selectedId={selectedRoutineId} onSelect={setViewedRoutineId} setData={setData} Modal={ModalPresence} CloseButton={CloseButton} /><WeekPlan sessions={routineSessions} onEdit={edit} onAdd={setPickSessionDay} />
    <div className="session-list-actions"><h2>Sessions</h2><button className="button primary schedule-create" onClick={() => edit(null)}><span aria-hidden="true">+</span> Add session</button></div>
    <div className="template-list">
      {sortTemplatesByDay(routineSessions).map((template) => {
        const isToday = template.scheduledDays.includes(todayIndex)
        const totalSets = template.exercises.reduce((sum, exercise) => sum + Number(exercise.targetSets), 0)
        return <article className={`template-card${isToday ? ' is-today' : ''}`} key={template.id}>
          <div className="template-card-head"><h2>{template.name}</h2>{isToday && <span className="template-today"><i aria-hidden="true" />Today</span>}</div>
          <p className="template-meta"><span>{template.exercises.length} {template.exercises.length === 1 ? 'exercise' : 'exercises'}</span><span className="dot-sep" aria-hidden="true">·</span><span>{totalSets} sets</span></p>
          {!template.scheduledDays.length && <p className="template-unscheduled">No days assigned yet</p>}
          <div className="exercise-preview">
            {template.exercises.slice(0, 3).map((exercise) => <div className="template-exercise" key={exercise.id}><span className="template-exercise-mark" aria-hidden="true" /><span>{exercise.name}</span><small>{exercise.targetSets} sets</small></div>)}
            {template.exercises.length > 3 && <p className="template-more">+{template.exercises.length - 3} more exercises</p>}
          </div>
          <div className="template-actions">
            <button className="template-edit" onClick={() => edit(template)}>Edit session <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
            <button className="template-delete" aria-label={`Delete ${template.name}`} title="Delete session template" onClick={() => { setDeleteError(''); setPendingDelete(template) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg></button>
          </div>
        </article>
      })}
      {!routineSessions.length && <div className="blank-state schedule-empty"><span className="schedule-empty-icon"><SessionMetaIcon type="calendar" /></span><p className="eyebrow">A LITTLE STRUCTURE. MORE PROGRESS.</p><h2>Add your first session.</h2><p className="muted">Choose exercises for a session, then assign it to one or more days.</p><button className="button primary" onClick={() => edit(null)}>+ Create your first session</button></div>}
    </div>
    <ModalPresence open={pickSessionDay !== null} label="Add existing session"><SessionDayPicker key={pickSessionDay} sessions={routineSessions} day={pickSessionDay} onAssign={assignSession} onClose={() => setPickSessionDay(null)} CloseButton={CloseButton} /></ModalPresence>
    <ModalPresence open={showForm} label="Schedule editor"><TemplateForm initial={editing} exercises={data.exercises} onSave={save} onClose={() => { setShowForm(false); setEditing(null) }} /></ModalPresence>
    <ModalPresence open={Boolean(pendingDelete)} label="Delete session template">
      <div className="modal-backdrop"><div className="modal sheet small-sheet delete-schedule-sheet">
        <div className="modal-header"><div><p className="eyebrow">YOUR TRAINING PLAN</p><h2>Delete this session?</h2></div><CloseButton onClick={closeDelete} disabled={deleteBusy} /></div>
        <p className="modal-copy">This session will be removed from your routine. Your workout history will stay saved.</p>
        <div className="delete-schedule-preview"><span className="exercise-icon"><SessionMetaIcon type="calendar" /></span><div><strong>{pendingDelete?.name}</strong><span>{pendingDelete?.exercises.length} {pendingDelete?.exercises.length === 1 ? 'exercise' : 'exercises'} · {pendingDelete?.scheduledDays.length ? pendingDelete.scheduledDays.map((day) => weekdays[day]).join(' / ') : 'No days assigned'}</span></div></div>
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        <div className="modal-actions"><button type="button" className="button secondary" disabled={deleteBusy} onClick={closeDelete}>Cancel</button><button type="button" className="button danger" disabled={deleteBusy} onClick={remove}>{deleteBusy ? 'Deleting…' : 'Delete session'}</button></div>
      </div></div>
    </ModalPresence>
  </section>
}
function Exercises({ data, setData }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deleteLock = useRef(false)
  const closeDelete = () => { if (!deleteLock.current) setPendingDelete(null) }
  const groups = ['All', ...new Set(data.exercises.map((exercise) => exercise.muscleGroup))]
  const filtered = data.exercises.filter((exercise) => (group === 'All' || exercise.muscleGroup === group) && `${exercise.name} ${exercise.muscleGroup}`.toLowerCase().includes(query.toLowerCase()))
  const remove = async () => {
    if (!pendingDelete || deleteLock.current) return
    deleteLock.current = true; setDeleting(true); setDeleteError('')
    try {
      await api(`/exercises/${pendingDelete.id}`, { method: 'DELETE' })
      setData((current) => ({ ...current, exercises: current.exercises.filter((item) => item.id !== pendingDelete.id) }))
      setPendingDelete(null)
    } catch (error) { setDeleteError(error.message) }
    finally { deleteLock.current = false; setDeleting(false) }
  }
  return <section className="screen exercises-screen">
    <div className="screen-heading library-heading"><div className="library-heading-title"><p className="eyebrow">MOVEMENT LIBRARY</p><h1>Exercises</h1></div><div className="library-search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input className="library-search" aria-label="Search exercises" placeholder="Search exercises or muscle groups" value={query} onChange={(event) => setQuery(event.target.value)} /></div><button className="button primary library-add" onClick={() => setShowForm(true)}><span aria-hidden="true">+</span> Add custom</button></div>
    <p className="intro-copy">Find your movement. Build your next session.</p>
    <div className="library-filters" aria-label="Filter by muscle group">{(showAllGroups ? groups : groups.slice(0, 5)).map((item) => <button type="button" key={item} className={group === item ? 'is-active' : ''} aria-pressed={group === item} onClick={() => setGroup(item)}>{item}</button>)}{groups.length > 5 && <button type="button" className="library-filter-toggle" aria-expanded={showAllGroups} onClick={() => setShowAllGroups((current) => !current)}>{showAllGroups ? 'Show Less −' : 'Show All +'}</button>}</div>
    <div className="exercise-library">{filtered.map((exercise) => <div className="library-row" key={exercise.id}><span className="exercise-icon"><MuscleIcon group={exercise.muscleGroup} /></span><div><strong>{exercise.name}</strong><small>{exercise.muscleGroup}</small></div>{exercise.isCustom ? <><em>Custom</em><button className="library-delete" aria-label={`Archive ${exercise.name}`} title="Archive movement" onClick={() => { setDeleteError(''); setPendingDelete(exercise) }}>×</button></> : <span className="built-in-label">Built-in</span>}</div>)}</div>
    {!filtered.length && <div className="library-empty"><NavIcon type="exercise" /><h2>No movements found</h2><p>Try another name or muscle group.</p><button type="button" className="button secondary" onClick={() => { setQuery(''); setGroup('All') }}>Clear filters</button></div>}
    <ModalPresence open={showForm} label="Add custom movement"><CustomExerciseModal onSave={(exercise) => { setData({ ...data, exercises: [...data.exercises, exercise] }); setShowForm(false) }} onClose={() => setShowForm(false)} /></ModalPresence>
    <ModalPresence open={Boolean(pendingDelete)} label="Archive custom movement">
      <div className="modal-backdrop"><div className="modal sheet small-sheet delete-movement-sheet">
        <div className="modal-header"><div><p className="eyebrow">MOVEMENT LIBRARY</p><h2>Archive this movement?</h2></div><CloseButton onClick={closeDelete} disabled={deleting} /></div>
        <p className="modal-copy">This movement will be removed from your library. Existing schedules and workout history will be kept.</p>
        <div className="delete-movement-preview"><span className="exercise-icon"><MuscleIcon group={pendingDelete?.muscleGroup} /></span><div><strong>{pendingDelete?.name}</strong><span>{pendingDelete?.muscleGroup}</span></div></div>
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        <div className="modal-actions"><button type="button" className="button secondary" disabled={deleting} onClick={closeDelete}>Cancel</button><button type="button" className="button danger" disabled={deleting} onClick={remove}>{deleting ? 'Archiving…' : 'Archive movement'}</button></div>
      </div></div>
    </ModalPresence>
  </section>
}

function MuscleIcon({ group }) { return <img src={muscleGroupIcons[group] || muscleGroupIcons.Other} alt="" aria-hidden="true" /> }
function MuscleGroupSelect({ value, onChange }) {
  const id = useId()
  const root = useRef(null)
  const trigger = useRef(null)
  const search = useRef({ text: '', time: 0 })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(muscleGroups.indexOf(value))
  const reveal = () => { setActive(muscleGroups.indexOf(value)); setOpen(true) }
  const choose = (group) => { onChange(group); setOpen(false); trigger.current.focus() }

  useEffect(() => {
    if (!open) return undefined
    const dismiss = (event) => { if (!root.current.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const list = root.current.querySelector('[role="listbox"]')
    const option = list.children[active]
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight
  }, [open, active])

  const handleKey = (event) => {
    if (event.key === 'Tab') { setOpen(false); return }
    if (event.key === 'Escape') {
      if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false) }
      return
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      if (!open) reveal()
      if (event.key === 'Home') setActive(0)
      else if (event.key === 'End') setActive(muscleGroups.length - 1)
      else if (open) setActive((index) => Math.max(0, Math.min(muscleGroups.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) choose(muscleGroups[active]); else reveal()
      return
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now()
      const text = (now - search.current.time < 600 ? search.current.text : '') + event.key.toLowerCase()
      search.current = { text, time: now }
      const match = muscleGroups.findIndex((group) => group.toLowerCase().startsWith(text))
      if (match >= 0) { event.preventDefault(); setActive(match); setOpen(true) }
    }
  }

  return <div className="muscle-select label-gap" ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <span className="muscle-select-label" id={`${id}-label`}>Muscle group</span>
    <button ref={trigger} type="button" className={`muscle-select-trigger${open ? ' is-open' : ''}`} role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-controls={`${id}-list`} aria-labelledby={`${id}-label ${id}-value`} aria-activedescendant={open ? `${id}-option-${active}` : undefined} onClick={() => open ? setOpen(false) : reveal()} onKeyDown={handleKey}>
      <span className="muscle-select-value"><MuscleIcon group={value} /><span id={`${id}-value`}>{value}</span></span>
      <svg className="muscle-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
    </button>
    <div className={`muscle-select-presence${open ? ' is-open' : ''}`} inert={!open} aria-hidden={!open}>
      <div className="muscle-select-clip">
        <ul className="muscle-select-options" id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}>
          {muscleGroups.map((group, index) => <li key={group} id={`${id}-option-${index}`} role="option" aria-selected={value === group} className={`${active === index ? 'is-active' : ''}${value === group ? ' is-selected' : ''}`} onPointerDown={(event) => event.preventDefault()} onClick={() => choose(group)}>
            <span className="muscle-option-icon"><MuscleIcon group={group} /></span><span>{group}</span>
            {value === group && <svg className="muscle-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
          </li>)}
        </ul>
      </div>
    </div>
  </div>
}
function CustomExerciseModal({ onSave, onClose }) { const [name, setName] = useState(''); const [muscleGroup, setMuscleGroup] = useState('Other'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const save = async () => { if (!name.trim()) return setError('Movement name is required.'); setBusy(true); try { const exercise = await post('/exercises', { name, muscleGroup }); onSave(exercise) } catch (e) { setError(e.message) } finally { setBusy(false) } }; return <div className="modal-backdrop"><div className="modal sheet small-sheet"><div className="modal-header"><div><p className="eyebrow">EXERCISE LIBRARY</p><h2>Add custom movement</h2></div><CloseButton onClick={onClose} /></div><p className="modal-copy">Save a movement once, then reuse it in any template.</p><label>Movement name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Bench Press" /></label><MuscleGroupSelect value={muscleGroup} onChange={setMuscleGroup} />{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save movement'}</button></div></div></div> }
function TemplateForm({ initial, defaultDays = [], exercises, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || ''); const [days, setDays] = useState(initial?.scheduledDays || defaultDays); const [selected, setSelected] = useState(initial?.exercises || []); const [query, setQuery] = useState(''); const [error, setError] = useState(''); const [dragging, setDragging] = useState(null); const [busy, setBusy] = useState(false); const saving = useRef(false)
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false)
  const exerciseResultsId = useId()
  const filtered = exercises.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()) && !selected.some((current) => current.id === item.id))
  const reorder = (target) => { if (dragging === null || dragging === target) return; const next = [...selected]; const [item] = next.splice(dragging, 1); next.splice(target, 0, item); setSelected(next); setDragging(null) }
  const add = (exercise) => setSelected([...selected, { ...exercise, targetSets: 3 }]); const toggleDay = (index) => setDays(days.includes(index) ? days.filter((day) => day !== index) : [...days, index].sort())
  const submit = async () => { if (saving.current) return; if (!name.trim() || !selected.length) return setError('Add a name and at least one exercise.'); saving.current = true; setBusy(true); setError(''); try { await onSave({ name: name.trim(), scheduledDays: days, exercises: selected }) } catch (e) { setError(e.message) } finally { saving.current = false; setBusy(false) } }
  return <div className="modal-backdrop"><div className="modal sheet template-sheet"><div className="modal-header"><div><p className="eyebrow">{initial ? 'EDIT SESSION' : 'NEW SESSION'}</p><h2>{initial ? 'Tune your session' : 'Create a session'}</h2></div><CloseButton onClick={onClose} /></div><div className="template-form-body"><label>Session name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Push Day" /></label><label className="label-gap">Schedule <span className="optional">choose all that apply</span></label><div className="day-picker">{weekdays.map((day, index) => <button type="button" className={days.includes(index) ? 'selected' : ''} key={day} onClick={() => toggleDay(index)}>{day}</button>)}</div><label className="label-gap">Exercises</label><div className="selected-exercises">{selected.map((exercise, index) => <div className="selected-row" draggable onDragStart={() => setDragging(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorder(index)} key={exercise.id}><span className="drag">≡</span><strong>{exercise.name}</strong><label><input inputMode="numeric" type="number" min="1" max="20" value={exercise.targetSets} onChange={(e) => setSelected(selected.map((item) => item.id === exercise.id ? { ...item, targetSets: e.target.value } : item))} /> sets</label><button className="remove-button" onClick={() => setSelected(selected.filter((_, i) => i !== index))}>×</button></div>)}</div><div className="template-exercise-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setExercisePickerOpen(false) }} onKeyDown={(event) => { if (event.key === "Escape" && exercisePickerOpen) { event.stopPropagation(); setExercisePickerOpen(false) } }}><input className="search-input" aria-label="Search exercises" aria-expanded={exercisePickerOpen} aria-controls={exerciseResultsId} placeholder="Search exercises" value={query} onFocus={() => setExercisePickerOpen(true)} onClick={() => setExercisePickerOpen(true)} onChange={(e) => { setQuery(e.target.value); setExercisePickerOpen(true) }} /><div className={`exercise-results-presence${exercisePickerOpen ? " is-open" : ""}`} inert={!exercisePickerOpen} aria-hidden={!exercisePickerOpen}><div className="exercise-results-clip"><div id={exerciseResultsId} className="exercise-results">{!filtered.length && <p className="exercise-picker-empty">No matching exercises. Create one below.</p>}{filtered.map((exercise) => <button key={exercise.id} onClick={() => { add(exercise); setQuery('') }}><span>{exercise.name}</span><small>{exercise.muscleGroup}</small><b>+</b></button>)}<CustomExercise onAdd={(exercise) => { add(exercise); setQuery('') }} /></div></div></div></div>{error && <p className="form-error">{error}</p>}</div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save'}</button></div></div></div>
}
function CustomExercise({ onAdd }) {
  const [custom, setCustom] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const saving = useRef(false)
  const add = async () => { if (saving.current || !custom.trim()) return; saving.current = true; setBusy(true); setError(''); try { const item = await post('/exercises', { name: custom }); onAdd(item); setCustom('') } catch (e) { setError(e.message) } finally { saving.current = false; setBusy(false) } }
  return <><div className="custom-add"><input disabled={busy} placeholder="Create custom exercise" value={custom} onChange={(e) => setCustom(e.target.value)} /><button disabled={busy || !custom.trim()} onClick={add}>{busy ? 'Saving…' : 'Add'}</button></div>{error && <p className="form-error" role="alert">{error}</p>}</>
}

function QuickAdjust({ value, values, onChange, disabled = false }) { const adjust = (amount) => onChange(String(Math.max(0, (Number(value) || 0) + amount))); return <div className="quick-adjust">{values.map((amount) => <React.Fragment key={amount}><button type="button" disabled={disabled} onClick={() => adjust(-Number(amount))} className="quick-adjust-minus" aria-label={`Decrease by ${amount}`}><span aria-hidden="true">−</span><span>{amount}</span></button><button type="button" disabled={disabled} onClick={() => adjust(Number(amount))} className="quick-adjust-plus" aria-label={`Increase by ${amount}`}><span aria-hidden="true">+</span><span>{amount}</span></button></React.Fragment>)}</div> }
function RestTimer({ timer, duration, setTimer, exercise, setNumber, totalSets }) { return <section className="rest-screen"><div className="rest-center"><div className="rest-ring" style={{ '--timer-progress': `${(timer / duration) * 360}deg` }}><strong>{timer}</strong><span>seconds</span></div><h1>Recover.</h1><p className="muted">Reset your energy. Make the next set your strongest.</p></div><div className="rest-actions"><div className="rest-details"><p className="eyebrow">REST TIMER</p><p className="rest-set-context"><strong>{exercise}</strong><span className="dot-sep" aria-hidden="true">·</span><span className="rest-set-progress">Set {setNumber} / {totalSets}</span></p></div><div className="timer-controls"><button className="timer-minus" onClick={() => setTimer(Math.max(0, timer - 15))}>− 15s</button><button className="timer-plus" onClick={() => setTimer(timer + 15)}>+ 15s</button></div><button className="button primary full" onClick={() => setTimer(0)}>Skip rest <span>→</span></button></div></section> }
function Workout({ workout, onFinish, onAbandon, restDuration = 90 }) {
  const [timer, setTimer] = useState(0); const [duration, setDuration] = useState(restDuration); const [weight, setWeight] = useState(''); const [reps, setReps] = useState(''); const [error, setError] = useState(''); const [logs, setLogs] = useState(workout.logs || []); const [exerciseIndex, setExerciseIndex] = useState(() => workout.template.exercises.findIndex((exercise) => (workout.logs || []).filter((log) => log.exerciseId === exercise.id).length < exercise.targetSets) < 0 ? 0 : workout.template.exercises.findIndex((exercise) => (workout.logs || []).filter((log) => log.exerciseId === exercise.id).length < exercise.targetSets)); const [extraSets, setExtraSets] = useState(0)
  const [saving, setSaving] = useState(false); const [retrySave, setRetrySave] = useState(false); const mutationLock = useRef(false)
  const writer = useRef(null)
  const editPrefill = useRef(null)
  if (!writer.current) writer.current = createSetWriter((body) => post(`/workouts/${workout.id}/sets`, body))
  const exercise = workout.template.exercises[exerciseIndex]; const exerciseLogs = logs.filter((log) => log.exerciseId === exercise.id); const targetSets = exercise.targetSets + extraSets; const setNumber = exerciseLogs.length + 1; const targetDone = setNumber > targetSets; const isLast = exerciseIndex === workout.template.exercises.length - 1; const isFinalSet = isLast && setNumber === targetSets
  const previous = workout.previous?.[exercise.id] || null
  useEffect(() => { const last = editPrefill.current || [...logs].reverse().find((log) => log.exerciseId === exercise.id); editPrefill.current = null; if (last) { setWeight(String(last.weight)); setReps(String(last.reps)) } else { setWeight(previous ? String(previous.weight) : ''); setReps(previous ? String(previous.reps) : '') } }, [exercise.id, workout.id])
  useEffect(() => { if (!timer) return; const interval = setInterval(() => setTimer((value) => Math.max(0, value - 1)), 1000); return () => clearInterval(interval) }, [timer])
  const logSet = async () => { if (mutationLock.current) return; mutationLock.current = true; setSaving(true); setError(''); try { const next = await writer.current.submit({ exerciseId: exercise.id, weight, reps }); setLogs(next.logs); setRetrySave(false); if (!isFinalSet) setTimer(duration) } catch (e) { setRetrySave(Boolean(writer.current.pending)); setError(e.message) } finally { mutationLock.current = false; setSaving(false) } }
  const undoLastSet = async () => {
    if (mutationLock.current || retrySave) return
    const lastSet = logs[logs.length - 1]
    if (!lastSet) return onAbandon(false)
    const lastExerciseIndex = workout.template.exercises.findIndex((item) => item.id === lastSet.exerciseId)
    if (lastExerciseIndex < 0) return setError('This exercise is no longer available.')
    mutationLock.current = true; setSaving(true); setError('')
    try {
      const next = await api(`/workouts/${workout.id}/sets/${lastSet.id}`, { method: 'DELETE' })
      if (lastExerciseIndex !== exerciseIndex) {
        editPrefill.current = lastSet
        const loggedSets = logs.filter((item) => item.exerciseId === lastSet.exerciseId).length
        setExtraSets(Math.max(0, loggedSets - workout.template.exercises[lastExerciseIndex].targetSets))
        setExerciseIndex(lastExerciseIndex)
      }
      setLogs(next.logs); setTimer(0); setWeight(String(lastSet.weight)); setReps(String(lastSet.reps))
    } catch (e) { setError(e.message) }
    finally { mutationLock.current = false; setSaving(false) }
  }
  const nextExercise = () => { if (isLast) onFinish('summary', { ...workout, logs }); else { setExerciseIndex(exerciseIndex + 1); setExtraSets(0); setTimer(0) } }
  const totalSets = logs.length; const totalVolume = logs.reduce((sum, log) => sum + log.weight * log.reps, 0); const progress = ((exerciseIndex + Math.min(exerciseLogs.length, targetSets) / targetSets) / workout.template.exercises.length) * 100
  if (workout.summary) return <Transition transitionKey="summary" resetScroll className="workout-transition"><Summary workout={{ ...workout, logs }} onFinish={onFinish} /></Transition>
  if (timer > 0) {
    const restExercise = targetDone && !isLast ? workout.template.exercises[exerciseIndex + 1] : exercise
    const restTargetSets = restExercise.id === exercise.id ? targetSets : restExercise.targetSets
    const restSetNumber = restExercise.id === exercise.id ? setNumber : logs.filter((log) => log.exerciseId === restExercise.id).length + 1
    return <Transition transitionKey="rest" resetScroll className="workout-transition"><RestTimer timer={timer} duration={duration} setTimer={setTimer} exercise={restExercise.name} setNumber={Math.min(restSetNumber, restTargetSets)} totalSets={restTargetSets} /></Transition>
  }
  return <Transition transitionKey={`exercise-${exercise.id}`} resetScroll className="workout-transition"><section className="workout-screen"><div className="workout-top"><button className={`back-button${logs.length ? " edit-last-set-button" : " leave-workout-button"}`} disabled={saving || retrySave} onClick={undoLastSet}>{logs.length ? "←" : "×"} <span>{logs.length ? "Edit last set" : "Leave workout"}</span></button><span className="workout-count">{exerciseIndex + 1}/{workout.template.exercises.length}</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="workout-heading"><p className="workout-label">{workout.template.name}</p><p className="eyebrow">EXERCISE {String(exerciseIndex + 1).padStart(2, '0')}</p><h1>{exercise.name}</h1><p className="muted">{exercise.muscleGroup} <span className="dot-sep">·</span> Set {Math.min(setNumber, targetSets)} of {targetSets}{targetDone ? ' complete' : ''}</p></div><div className="previous-card"><span className="muted">LAST SESSION · {workout.template.name}</span>{previous ? <strong>{previous.weight} kg <span>×</span> {previous.reps} reps</strong> : <strong className="previous-empty">No previous record <span>· New exercise</span></strong>}</div>{!targetDone ? <div className="set-entry"><div className="input-row"><label>Weight <div className="weight-input"><input type="number" aria-label="Weight in kilograms" disabled={saving || retrySave} inputMode="decimal" step="0.01" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" /><span className="input-unit" aria-hidden="true">KG</span></div><QuickAdjust values={["0.25", "0.50", "1"]} value={weight} onChange={setWeight} disabled={saving || retrySave} /></label><label>Reps <input type="number" aria-label="Repetitions" disabled={saving || retrySave} inputMode="numeric" min="0" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="0" /><QuickAdjust values={["1", "2", "5"]} value={reps} onChange={setReps} disabled={saving || retrySave} /></label></div>{error && <p className="form-error">{error}</p>}<button className="button primary full log-button" disabled={saving} onClick={logSet}>{saving ? 'Saving…' : retrySave ? 'Retry save' : 'Log set'} <span>↵</span></button></div> : <div className="complete-card"><span className="complete-check">✓</span><h2>Exercise complete</h2><p className="muted">{exerciseLogs.length} sets logged. Nice work.</p><button className="button primary full" disabled={saving || retrySave} onClick={nextExercise}>{isLast ? 'View summary' : 'Next exercise'} <span>→</span></button><button className="button secondary full" onClick={() => setExtraSets(extraSets + 1)}>+ Add set</button></div>}{timer > 0 && <div className="timer-card"><div className="timer-ring" style={{ '--timer-progress': `${(timer / duration) * 360}deg` }}><strong>{timer}</strong><small>SEC</small></div><div className="timer-copy"><span className="card-kicker">REST TIMER</span><strong>Recover, then go.</strong><div className="timer-controls"><button className="timer-minus" onClick={() => setTimer(Math.max(0, timer - 15))}>− 15s</button><button className="timer-plus" onClick={() => setTimer(timer + 15)}>+ 15s</button><button onClick={() => setTimer(0)}>Skip</button></div></div></div>}<div className="workout-footer"><button onClick={() => setDuration(duration === 90 ? 60 : duration === 60 ? 120 : 90)}>Rest: {duration}s</button><span>{totalSets} sets <span className="dot-sep">·</span> {formatKg(totalVolume)}</span></div></section></Transition>
}
function Summary({ workout, onFinish }) { const logs = workout.logs || []; const volume = logs.reduce((sum, log) => sum + log.weight * log.reps, 0); return <section className="summary-screen"><div className="summary-orb">✓</div><p className="eyebrow">SESSION COMPLETE</p><h1>Strong work.</h1><p className="muted">{workout.template.name} <span className="dot-sep">·</span> {formatDate(new Date())}</p><div className="summary-stats"><Stat label="Sets" value={logs.length} detail="logged" /><Stat label="Volume" value={formatKg(volume)} detail="total" /><Stat label="Exercises" value={new Set(logs.map((log) => log.exerciseId)).size} detail="completed" /></div><div className="summary-note">Every set counts. This one is now part of your history.</div><button className="button primary full" onClick={() => onFinish('done')}>Finish workout <span>→</span></button></section> }

function localMonth(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` }
function History({ data, setData }) {
  const [month, setMonth] = useState(localMonth())
  const [history, setHistory] = useState({ month: null, sessions: [], error: '' })
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    let active = true
    api(`/history?month=${month}`).then((result) => {
      if (active) setHistory({ month, sessions: result.sessions, error: '' })
    }).catch((error) => {
      if (active) setHistory({ month, sessions: [], error: error.message })
    })
    return () => { active = false }
  }, [month])
  const loading = history.month !== month
  const sessions = loading ? [] : history.sessions
  const [year, monthNumber] = month.split('-').map(Number)
  const offset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, index) => index < offset || index >= offset + daysInMonth ? null : index - offset + 1)
  const sessionByDay = Object.fromEntries([...sessions].reverse().map((session) => [new Date(session.finishedAt).getDate(), session]))
  const today = new Date()
  const isCurrentMonth = month === localMonth(today)
  const totalSets = sessions.reduce((sum, session) => sum + session.sets.length, 0)
  const totalVolume = sessions.reduce((sum, session) => sum + session.sets.reduce((volume, set) => volume + set.weight * set.reps, 0), 0)
  const changeMonth = (next) => { setSelected(null); setMonth(next) }
  const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1))
  return <section className="screen history-screen">
    <div className="screen-heading"><div><p className="eyebrow">YOUR TRAINING ARCHIVE</p><h1>History</h1></div><span className="history-heading-icon"><NavIcon type="history" /></span></div>
    <p className="intro-copy">Every session, a little progress.</p>
    <div className="history-content"><div className="history-calendar-card" aria-busy={loading}>
      <div className="month-nav"><button type="button" aria-label="Previous month" onClick={() => shiftMonth(month, -1, changeMonth)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button><div><strong>{monthLabel}</strong><span>{loading ? 'Loading sessions…' : `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} completed`}</span></div><button type="button" aria-label="Next month" onClick={() => shiftMonth(month, 1, changeMonth)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button></div>
      <div className="calendar"><div className="calendar-days">{weekdays.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}</div><div className="calendar-grid">{cells.map((day, index) => <button type="button" className={`${day && sessionByDay[day] ? 'has-session' : ''}${day && isCurrentMonth && day === today.getDate() ? ' is-today' : ''}`} key={index} disabled={!day || !sessionByDay[day]} aria-label={day ? `${monthLabel} ${day}${sessionByDay[day] ? ', workout completed, view session' : ', no workouts'}` : undefined} aria-current={day && isCurrentMonth && day === today.getDate() ? 'date' : undefined} onClick={() => setSelected(sessionByDay[day])}><span>{day || ''}</span></button>)}</div></div>
      <div className="calendar-legend"><span><i className="legend-workout" />Workout</span><span><i className="legend-today" />Today</span>{!isCurrentMonth && <button type="button" onClick={() => changeMonth(localMonth())}>This Month <span aria-hidden="true">↗</span></button>}</div>
      <div className="history-month-stats"><div><strong>{loading ? '—' : sessions.length}</strong><span>Sessions</span></div><div><strong>{loading ? '—' : totalSets}</strong><span>Sets logged</span></div><div><strong>{loading ? '—' : Math.round(totalVolume).toLocaleString()} <small>kg</small></strong><span>Total volume</span></div></div>
    </div>
    <div className="history-secondary">{!loading && history.error && <p className="form-error" role="alert">{history.error}</p>}
    <ModalPresence open={Boolean(selected)} overlay={false}>{selected ? <SessionDetail session={selected} onClose={() => setSelected(null)} onDeleted={async (id) => { setHistory((current) => ({ ...current, sessions: current.sessions.filter((item) => item.id !== id) })); setSelected(null); try { setData(await api('/bootstrap')) } catch (e) { setHistory((current) => ({ ...current, error: 'Session deleted. Refresh failed: ' + e.message })) } }} /> : <div />}</ModalPresence>
    {!selected && <div className="history-list"><div className="insight-section-heading"><h2>Recent sessions</h2><span>{monthLabel}</span></div><div className="history-session-list">{sessions.map((session) => <button type="button" className="history-row" key={session.id} onClick={() => setSelected(session)}>
      <span className="history-date"><strong>{formatDate(session.finishedAt, { day: '2-digit' })}</strong><small>{formatDate(session.finishedAt, { weekday: 'short' })}</small></span>
      <span className="history-session-info"><strong>{session.name}</strong><span>{session.sets.length} {session.sets.length === 1 ? 'set' : 'sets'}<span aria-hidden="true">·</span>{formatKg(session.sets.reduce((sum, set) => sum + set.weight * set.reps, 0))}</span></span>
      <span className="history-row-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg></span>
    </button>)}</div>
      {loading ? <p className="history-loading" role="status">Loading your sessions…</p> : !history.error && !sessions.length && <div className="history-empty"><span><SessionMetaIcon type="calendar" /></span><h3>A fresh page in your training.</h3><p>Your completed workouts will appear here.</p></div>}
    </div>}
    </div></div>
  </section>
}

function shiftMonth(value, amount, set) { const date = new Date(`${value}-01T00:00:00`); date.setMonth(date.getMonth() + amount); set(localMonth(date)) }
function SessionDetail({ session, onClose, onDeleted }) { const [exerciseHistory, setExerciseHistory] = useState(null); const [deleting, setDeleting] = useState(false); const [error, setError] = useState(''); const [deleteOpen, setDeleteOpen] = useState(false); const [deleteError, setDeleteError] = useState(''); const deleteLock = useRef(false); const closeDelete = () => { if (!deleteLock.current) setDeleteOpen(false) }; const grouped = Object.values(session.sets.reduce((all, set) => { (all[set.exerciseId] ||= { id: set.exerciseId, name: set.name, sets: [] }).sets.push(set); return all }, {})); const showHistory = async (exercise) => { setError(''); try { setExerciseHistory({ ...exercise, ...(await api(`/exercises/${exercise.id}/history?templateId=${session.templateId}`)) }) } catch (e) { setError(e.message) } }; const deleteSession = async () => {
    if (deleteLock.current) return
    deleteLock.current = true; setDeleting(true); setDeleteError('')
    try {
      await api(`/history/${session.id}`, { method: 'DELETE' })
      setDeleteOpen(false)
      await onDeleted(session.id)
    } catch (e) { setDeleteError(e.message) }
    finally { deleteLock.current = false; setDeleting(false) }
  }; return <div className="detail-card"><div className="detail-header"><div><p className="eyebrow">{formatDate(session.finishedAt, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h2>{session.name}</h2></div><CloseButton onClick={onClose} disabled={deleting} /></div>{exerciseHistory ? <div className="progression"><button className="back-link" onClick={() => setExerciseHistory(null)}>← All exercises</button><h3>{exerciseHistory.name}</h3><p className="muted">{exerciseHistory.templateName}</p>{exerciseHistory.sessions.map((item, index) => { const previous = exerciseHistory.sessions[index - 1]; const change = previous ? item.weight - previous.weight : 0; return <div className="progression-row" key={`${item.date}-${index}`}><span>{formatDate(item.date)}</span><strong>{item.weight} kg × {item.reps}</strong><b className={change > 0 ? 'up' : change < 0 ? 'down' : ''}>{change > 0 ? '↑' : change < 0 ? '↓' : '='}</b></div> })}</div> : grouped.map((exercise) => <button className="detail-exercise detail-button" key={exercise.name} onClick={() => showHistory(exercise)}><strong>{exercise.name}</strong><div>{exercise.sets.map((set) => <span key={set.setNumber}>{set.weight} kg × {set.reps}</span>)}</div><small>View progression →</small></button>)}{error && <p className="form-error" role="alert">{error}</p>}<button className="danger-button session-delete" disabled={deleting} onClick={() => { setDeleteError(''); setDeleteOpen(true) }}>Delete session</button>
    <ModalPresence open={deleteOpen} label="Delete history session">
      <div className="modal-backdrop"><div className="modal sheet small-sheet delete-session-sheet">
        <div className="modal-header"><div><p className="eyebrow">WORKOUT HISTORY</p><h2>Delete this session?</h2></div><CloseButton onClick={closeDelete} disabled={deleting} /></div>
        <p className="modal-copy">This workout session and all its logged sets will be permanently deleted.</p>
        <div className="delete-session-preview"><span className="exercise-icon"><SessionMetaIcon type="calendar" /></span><div><strong>{session.name}</strong><span>{formatRecordDate(session.finishedAt)} · {session.sets.length} {session.sets.length === 1 ? 'set' : 'sets'}</span></div></div>
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        <div className="modal-actions"><button type="button" className="button secondary" disabled={deleting} onClick={closeDelete}>Cancel</button><button type="button" className="button danger" disabled={deleting} onClick={deleteSession}>{deleting ? 'Deleting…' : 'Delete session'}</button></div>
      </div></div>
    </ModalPresence>
  </div> }

function App() {
  const [user, setUser] = useState(undefined); const [data, setData] = useState(null); const [page, setPage] = useState('dashboard'); const [workout, setWorkout] = useState(null); const [loading, setLoading] = useState(true)
  const [preferences, setPreferences] = useState(defaultPreferences)
  useEffect(() => { setPreferences(user ? readPreferences(user.id) : { ...defaultPreferences }) }, [user?.id])
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion)
    return () => { delete document.documentElement.dataset.reduceMotion }
  }, [preferences.reduceMotion])
  const updatePreferences = (next) => { savePreferences(user.id, next); setPreferences(next) }
  const [problem, setProblem] = useState(''); const [busy, setBusy] = useState(false); const [leaveOpen, setLeaveOpen] = useState(false); const actionLock = useRef(false)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return undefined
    const updateViewport = () => {
      document.documentElement.style.setProperty('--visible-height', `${viewport.height}px`)
      document.documentElement.style.setProperty('--visible-top', `${viewport.offsetTop}px`)
    }
    updateViewport()
    viewport.addEventListener('resize', updateViewport)
    viewport.addEventListener('scroll', updateViewport)
    return () => {
      viewport.removeEventListener('resize', updateViewport)
      viewport.removeEventListener('scroll', updateViewport)
      document.documentElement.style.removeProperty('--visible-height')
      document.documentElement.style.removeProperty('--visible-top')
    }
  }, [])
  const loadSession = async () => {
    const result = await api('/session')
    setUser(result.user || null)
    if (result.user) setData(await api('/bootstrap'))
  }
  const perform = async (action) => {
    if (actionLock.current) return
    actionLock.current = true; setBusy(true); setProblem('')
    try { await action() }
    catch (error) {
      if (error.status === 401) { setUser(null); setData(null); setWorkout(null) }
      setProblem(error.message)
    } finally { actionLock.current = false; setBusy(false); setLoading(false) }
  }
  useEffect(() => { void perform(loadSession) }, [])
  const login = async (nextUser) => { const nextData = await api('/bootstrap'); setData(nextData); setUser(nextUser) }
  const logout = () => perform(async () => { await post('/auth/logout', {}); setUser(null); setData(null); setWorkout(null) })
  const start = (templateOrWorkout) => perform(async () => {
    const next = templateOrWorkout.template ? await api(`/workouts/${templateOrWorkout.id}`) : await post('/workouts', { templateId: templateOrWorkout.id })
    setWorkout(next)
  })
  const finish = (mode, current = workout) => {
    if (mode === 'summary') { setWorkout({ ...current, summary: true }); return }
    return perform(() => mutateAndRefresh(
      () => post(`/workouts/${current.id}/finish`, {}),
      () => { setWorkout(null); setData(null); setPage('dashboard') },
      async () => setData(await api('/bootstrap')),
    ))
  }
  const abandon = (confirmed = false) => {
    if (!confirmed) { setProblem(''); setLeaveOpen(true); return }
    return perform(() => mutateAndRefresh(
      () => post(`/workouts/${workout.id}/abandon`, {}),
      () => { setLeaveOpen(false); setWorkout(null); setData(null); setPage('dashboard') },
      async () => setData(await api('/bootstrap')),
    ))
  }
  if (loading || ((user === undefined || (user && !data)) && !problem)) return <div className="loading-screen"><img className="brand-image loading-logo" src={logo} alt="Gym Track" /></div>
  if (user === undefined || (user && !data)) return <main className="connection-screen"><img className="brand-image" src={logo} alt="Gym Track" /><h1>Let’s reconnect.</h1><p role="alert">{problem}</p><p>Your saved changes are kept. Retry to load your data.</p><button className="button primary" disabled={busy} onClick={() => perform(loadSession)}>{busy ? 'Reconnecting…' : 'Retry connection'}</button>{user && <button className="text-button" disabled={busy} onClick={logout}>Sign out</button>}</main>
  const content = !user ? <Auth onLogin={login} /> : workout ? <Workout key={workout.id} restDuration={preferences.restDuration} workout={workout} onFinish={finish} onAbandon={abandon} /> : <Layout user={user} page={page} setPage={setPage} onLogout={logout}>{page === 'dashboard' && <Dashboard data={data} user={user} onStart={start} setPage={setPage} />}{page === 'templates' && <Templates data={data} setData={setData} />}{page === 'exercises' && <Exercises data={data} setData={setData} />}{page === 'history' && <History data={data} setData={setData} />}{page === 'profile' && <Profile user={user} stats={data.stats} onSaved={setUser} />}{page === 'settings' && <Settings Modal={ModalPresence} preferences={preferences} onSave={updatePreferences} onLogout={logout} />}</Layout>
  return <>{(problem || busy) && <div className="app-feedback" role={problem ? 'alert' : 'status'}><span>{problem || 'Saving changes…'}</span>{problem && <button type="button" aria-label="Dismiss message" onClick={() => setProblem('')}>×</button>}</div>}<Transition transitionKey={!user ? 'auth' : workout ? 'workout' : 'app'} resetScroll className="app-transition">{content}</Transition><ModalPresence open={leaveOpen} label="Leave this workout?"><div className="modal-backdrop"><div className="modal sheet small-sheet leave-workout-sheet"><div className="modal-header"><div><p className="eyebrow">END SESSION</p><h2>Leave this workout?</h2></div><CloseButton onClick={() => { if (!actionLock.current) setLeaveOpen(false) }} /></div><p className="modal-copy">Your logged sets will be archived.</p>{problem && <p className="form-error" role="alert">{problem}</p>}<div className="modal-actions"><button type="button" className="button secondary keep-training-button" disabled={busy} onClick={() => setLeaveOpen(false)}>Keep training</button><button type="button" className="button danger" disabled={busy} onClick={() => abandon(true)}>{busy ? 'Leaving…' : 'Leave workout'}</button></div></div></div></ModalPresence></>
}

createRoot(document.getElementById('root')).render(<App />)
