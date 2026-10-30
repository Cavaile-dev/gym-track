import React, { useState, useRef } from 'react'
import { post } from '../requests.js'
import { logo } from '../config.js'
import { NavIcon } from '../components/Icons.jsx'

function Auth({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const submit = async (event) => {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setError('')
    setBusy(true)
    try {
      const data = await post(`/auth/${mode}`, form)
      await onLogin(data.user)
    } catch (e) {
      setError(e.message)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <main className="auth-shell">
      <div className="auth-brand">
        <img className="brand-image" src={logo} alt="Gym Track" />
        <span>GYM TRACK</span>
      </div>
      <div className="auth-intro">
        <p className="eyebrow">YOUR SPACE TO GET STRONGER</p>
        <h2>
          Make every
          <br />
          <span>session count.</span>
        </h2>
        <p>
          Plan your week. Log your sets.
          <br />
          See how far you've come.
        </p>
        <div className="auth-principles">
          <span>
            <NavIcon type="schedule" />
            Plan
          </span>
          <span>
            <NavIcon type="exercise" />
            Train
          </span>
          <span>
            <NavIcon type="history" />
            Progress
          </span>
        </div>
      </div>
      <div className="auth-panel">
        <p className="eyebrow">YOUR WORKOUT, SHARPER</p>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Build your rhythm.'}</h1>
        <p className="muted">
          {mode === 'login' ? 'Pick up where you left off.' : 'A simple log for stronger sessions.'}
        </p>
        <form onSubmit={submit} className="stack-form">
          <label>
            Username
            <input
              autoComplete="username"
              minLength="3"
              maxLength="32"
              pattern="[a-zA-Z0-9_.-]+"
              title="3–32 letters, numbers, dots, underscores, or hyphens"
              value={form.username || ''}
              onChange={update('username')}
              required
            />
          </label>
          {mode === 'register' && (
            <label>
              <span>
                Email <span className="optional">optional</span>
              </span>
              <input type="email" value={form.email || ''} onChange={update('email')} />
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password || ''}
              onChange={update('password')}
              minLength="8"
              maxLength="128"
              required
            />
          </label>
          {mode === 'register' && (
            <label>
              Confirm password
              <input
                type="password"
                value={form.confirmPassword || ''}
                onChange={update('confirmPassword')}
                required
              />
            </label>
          )}
          {error && <div className="error-box">{error}</div>}
          <button className="button primary full" disabled={busy}>
            {busy ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError('')
          }}
        >
          {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
        </button>
      </div>
      <p className="auth-foot">
        YOUR TRAINING <span>·</span> YOUR PROGRESS
      </p>
    </main>
  )
}

export { Auth }
