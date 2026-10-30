import { ConfirmationDialog } from './components/ConfirmationDialog.jsx'
import React, { useState, useEffect, useRef } from 'react'
import {
  defaultPreferences,
  readPreferences,
  savePreferences,
} from './features/account/preferences.js'
import { api, post, mutateAndRefresh } from './requests.js'
import { logo } from './config.js'
import { Auth } from './pages/Auth.jsx'
import { Workout } from './pages/Workout.jsx'
import { Layout } from './components/Layout.jsx'
import { Dashboard } from './pages/Dashboard.jsx'
import { RoutinesPage } from './pages/Routines.jsx'
import { Exercises } from './pages/Exercises.jsx'
import { History } from './pages/History.jsx'
import { Profile, Settings } from './features/account/Account.jsx'
import { ModalPresence } from './components/Modal.jsx'
import { Transition } from './components/Transition.jsx'

function App() {
  const [user, setUser] = useState(undefined)
  const [data, setData] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [workout, setWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [preferences, setPreferences] = useState(defaultPreferences)
  useEffect(() => {
    setPreferences(user ? readPreferences(user.id) : { ...defaultPreferences })
  }, [user?.id])
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion)
    return () => {
      delete document.documentElement.dataset.reduceMotion
    }
  }, [preferences.reduceMotion])
  const updatePreferences = (next) => {
    savePreferences(user.id, next)
    setPreferences(next)
  }
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const actionLock = useRef(false)
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
    actionLock.current = true
    setBusy(true)
    setProblem('')
    try {
      await action()
    } catch (error) {
      if (error.status === 401) {
        setUser(null)
        setData(null)
        setWorkout(null)
      }
      setProblem(error.message)
    } finally {
      actionLock.current = false
      setBusy(false)
      setLoading(false)
    }
  }
  useEffect(() => {
    void perform(loadSession)
  }, [])
  const login = async (nextUser) => {
    const nextData = await api('/bootstrap')
    setData(nextData)
    setUser(nextUser)
  }
  const logout = () =>
    perform(async () => {
      await post('/auth/logout', {})
      setUser(null)
      setData(null)
      setWorkout(null)
    })
  const start = (templateOrWorkout) =>
    perform(async () => {
      const next = templateOrWorkout.template
        ? await api(`/workouts/${templateOrWorkout.id}`)
        : await post('/workouts', { templateId: templateOrWorkout.id })
      setWorkout(next)
    })
  const finish = (mode, current = workout) => {
    if (mode === 'summary') {
      setWorkout({ ...current, summary: true })
      return
    }
    return perform(() =>
      mutateAndRefresh(
        () => post(`/workouts/${current.id}/finish`, {}),
        () => {
          setWorkout(null)
          setData(null)
          setPage('dashboard')
        },
        async () => setData(await api('/bootstrap')),
      ),
    )
  }
  const abandon = (confirmed = false) => {
    if (!confirmed) {
      setProblem('')
      setLeaveOpen(true)
      return
    }
    return perform(() =>
      mutateAndRefresh(
        () => post(`/workouts/${workout.id}/abandon`, {}),
        () => {
          setLeaveOpen(false)
          setWorkout(null)
          setData(null)
          setPage('dashboard')
        },
        async () => setData(await api('/bootstrap')),
      ),
    )
  }
  if (loading || ((user === undefined || (user && !data)) && !problem))
    return (
      <div className="loading-screen">
        <img className="brand-image loading-logo" src={logo} alt="Gym Track" />
      </div>
    )
  if (user === undefined || (user && !data))
    return (
      <main className="connection-screen">
        <img className="brand-image" src={logo} alt="Gym Track" />
        <h1>Let’s reconnect.</h1>
        <p role="alert">{problem}</p>
        <p>Your saved changes are kept. Retry to load your data.</p>
        <button className="button primary" disabled={busy} onClick={() => perform(loadSession)}>
          {busy ? 'Reconnecting…' : 'Retry connection'}
        </button>
        {user && (
          <button className="text-button" disabled={busy} onClick={logout}>
            Sign out
          </button>
        )}
      </main>
    )
  const content = !user ? (
    <Auth onLogin={login} />
  ) : workout ? (
    <Workout
      key={workout.id}
      restDuration={preferences.restDuration}
      workout={workout}
      onFinish={finish}
      onAbandon={abandon}
    />
  ) : (
    <Layout user={user} page={page} setPage={setPage} onLogout={logout}>
      {page === 'dashboard' && (
        <Dashboard data={data} user={user} onStart={start} setPage={setPage} />
      )}
      {page === 'templates' && <RoutinesPage data={data} setData={setData} />}
      {page === 'exercises' && <Exercises data={data} setData={setData} />}
      {page === 'history' && <History data={data} setData={setData} />}
      {page === 'profile' && <Profile user={user} stats={data.stats} onSaved={setUser} />}
      {page === 'settings' && (
        <Settings
          Modal={ModalPresence}
          preferences={preferences}
          onSave={updatePreferences}
          onLogout={logout}
        />
      )}
    </Layout>
  )
  return (
    <>
      {(problem || busy) && (
        <div className="app-feedback" role={problem ? 'alert' : 'status'}>
          <span>{problem || 'Saving changes…'}</span>
          {problem && (
            <button type="button" aria-label="Dismiss message" onClick={() => setProblem('')}>
              ×
            </button>
          )}
        </div>
      )}
      <Transition
        transitionKey={!user ? 'auth' : workout ? 'workout' : 'app'}
        resetScroll
        className="app-transition"
      >
        {content}
      </Transition>
      <ConfirmationDialog
        open={leaveOpen}
        label="Leave this workout?"
        title="Leave this workout?"
        eyebrow="END SESSION"
        description={<>Your logged sets will be archived.</>}
        className="leave-workout-sheet"
        busy={busy}
        onClose={() => {
          if (!actionLock.current) setLeaveOpen(false)
        }}
        onConfirm={() => abandon(true)}
        confirmLabel={busy ? 'Leaving…' : 'Leave workout'}
        cancelLabel="Keep training"
        cancelClassName="keep-training-button"
      >
        {problem && (
          <p className="form-error" role="alert">
            {problem}
          </p>
        )}
      </ConfirmationDialog>
    </>
  )
}

export { App }
