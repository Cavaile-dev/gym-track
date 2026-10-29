import React, { useEffect, useId, useRef, useState } from 'react'
import { api } from './requests.js'
import { validRestDuration } from './accountPreferences.js'

function AccountIcon({ settings = false }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{settings ? <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--panel)" /><circle cx="15" cy="17" r="3" fill="var(--panel)" /></> : <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}</svg>
}

export function AccountDropdown({ user, page, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const dismiss = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  useEffect(() => setOpen(false), [page])
  return <div className="account-dropdown" ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={(event) => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => root.current?.querySelector('nav button')?.focus()) }
  }}>
    <button type="button" ref={trigger} className="account-trigger" aria-label={`Account: ${user.username}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><span className="user-name">{user.username}</span><svg className={`account-chevron${open ? ' is-open' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg>
    </button>
    {open && <nav id={id} className="account-popover" aria-label="Account navigation">{['profile', 'settings'].map((item) => <button key={item} type="button" aria-current={page === item ? 'page' : undefined} onClick={() => { setOpen(false); onNavigate(item) }}><AccountIcon settings={item === 'settings'} /><span>{item === 'profile' ? 'Profile' : 'Settings'}</span><span aria-hidden="true">↗</span></button>)}<button type="button" className="account-menu-signout" onClick={() => { setOpen(false); onLogout() }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4H5v16h4M10 12h11m-4-4 4 4-4 4" /></svg><span>Sign out</span></button></nav>}
  </div>
}

export function Profile({ user, stats, onSaved }) {
  const [username, setUsername] = useState(user.username)
  const [email, setEmail] = useState(user.email || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const lock = useRef(false)
  const changed = username.trim() !== user.username || email.trim() !== (user.email || '')
  const submit = async (event) => {
    event.preventDefault()
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const result = await api('/profile', { method: 'PUT', body: JSON.stringify({ username: username.trim(), email: email.trim() }) })
      onSaved(result.user); setUsername(result.user.username); setEmail(result.user.email || ''); setMessage('Profile updated.')
    } catch (error) { setError(error.message) }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="screen account-screen">
    <div className="screen-heading"><div><p className="eyebrow">YOUR TRAINING IDENTITY</p><h1>Profile</h1></div></div>
    <p className="intro-copy">Your name. Your progress. Your space.</p>
    <div className="account-page-grid">
      <aside className="account-card profile-overview"><span className="profile-avatar">{user.username.slice(0, 1).toUpperCase()}</span><h2>{user.username}</h2><p className="muted">{user.email || 'No email added'}</p><div className="profile-days"><strong>{stats.totalDays ?? 0}</strong><span>Total Training Days</span></div></aside>
      <form className="account-card account-form" onSubmit={submit}><div className="account-section-title"><AccountIcon /><div><h2>Account details</h2><p className="muted">Keep your details up to date.</p></div></div>
        <label>Username<input autoComplete="username" value={username} disabled={busy} onChange={(event) => { setUsername(event.target.value); setMessage('') }} minLength="3" maxLength="32" pattern="[a-zA-Z0-9_.-]+" title="3–32 letters, numbers, dots, underscores, or hyphens" required /></label>
        <label>Email <span className="optional">optional</span><input type="email" autoComplete="email" maxLength="254" value={email} disabled={busy} onChange={(event) => { setEmail(event.target.value); setMessage('') }} placeholder="you@example.com" /></label>
        <p className="account-hint">Use your username to sign in.</p>
        {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="account-success" role="status">{message}</p>}
        <button className="button primary" type="submit" disabled={busy || !changed}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>
    </div>
  </section>
}

export function Settings({ preferences, onSave, onLogout, Modal }) {
  const [draft, setDraft] = useState(preferences)
  const [customOpen, setCustomOpen] = useState(false)
  const [customSeconds, setCustomSeconds] = useState('')
  const [customError, setCustomError] = useState('')
  const customInputId = useId()
  const openCustom = () => { setCustomSeconds(draft.customRestDuration ? String(draft.customRestDuration) : ''); setCustomError(''); setCustomOpen(true) }
  const applyCustom = (event) => {
    event.preventDefault()
    const seconds = Number(customSeconds)
    if (!validRestDuration(seconds)) return setCustomError('Enter a whole number between 1 and 3600 seconds.')
    update({ restDuration: seconds, customRestDuration: seconds })
    setCustomOpen(false)
  }
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const update = (value) => { setDraft((current) => ({ ...current, ...value })); setMessage(''); setError('') }
  const changed = draft.restDuration !== preferences.restDuration || draft.reduceMotion !== preferences.reduceMotion || draft.customRestDuration !== preferences.customRestDuration
  const submit = (event) => {
    event.preventDefault(); setError(''); setMessage('')
    try { onSave(draft); setMessage('Settings saved.') }
    catch { setError('Settings could not be saved. Allow browser storage and try again.') }
  }
  return <section className="screen account-screen"><div className="screen-heading"><div><p className="eyebrow">MAKE IT YOURS</p><h1>Settings</h1></div></div><p className="intro-copy">Fine-tune your training rhythm.</p>
    <form className="account-card settings-form" onSubmit={submit}>
      <div className="account-section-title"><AccountIcon settings /><div><h2>Training preferences</h2><p className="muted">Saved for your account on this browser.</p></div></div>
      <fieldset className="rest-preference"><legend>Default rest timer</legend><p className="muted">Applied when you start or resume a workout.</p><div className="preference-options">{[60, 90, 120].map((seconds) => <button type="button" key={seconds} aria-pressed={draft.restDuration === seconds} onClick={() => update({ restDuration: seconds })}>{seconds}s</button>)}<button type="button" className="custom-rest-option" aria-haspopup="dialog" aria-pressed={Boolean(draft.customRestDuration && draft.restDuration === draft.customRestDuration && ![60, 90, 120].includes(draft.restDuration))} onClick={openCustom}>{draft.customRestDuration ? `${draft.customRestDuration}s` : 'Custom +'}</button></div></fieldset>
      <div className="settings-row"><div><h3>Reduce motion</h3><p className="muted">Use simpler transitions and less movement.</p></div><button type="button" className="preference-switch" role="switch" aria-label="Reduce motion" aria-checked={draft.reduceMotion} onClick={() => update({ reduceMotion: !draft.reduceMotion })}><span /></button></div>
      <p className="account-hint">Weight is recorded in kilograms. Training dates follow your device’s time zone.</p>
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="account-success" role="status">{message}</p>}
      <button type="submit" className="button primary" disabled={!changed}>Save settings</button>
    </form>
    <div className="account-card settings-row account-signout"><div><h2>Sign out</h2><p className="muted">Your saved workouts stay in your account.</p></div><button type="button" className="button danger" onClick={onLogout}>Sign out</button></div>
    <Modal open={customOpen} label="Custom rest timer"><div className="modal-backdrop"><form className="modal sheet small-sheet custom-rest-sheet" onSubmit={applyCustom}>
      <div className="modal-header"><div><p className="eyebrow">YOUR OWN PACE</p><h2>Custom rest timer</h2></div><button type="button" className="close-button" aria-label="Close custom rest timer" onClick={() => setCustomOpen(false)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
      <p className="modal-copy">Set the recovery time that works for you.</p>
      <label htmlFor={customInputId}>Rest duration (seconds)</label><input id={customInputId} autoFocus type="number" inputMode="numeric" min="1" max="3600" step="1" required placeholder="150" value={customSeconds} onChange={(event) => { setCustomSeconds(event.target.value); setCustomError('') }} aria-describedby={`${customInputId}-hint`} />
      <p id={`${customInputId}-hint`} className="account-hint">Choose 1–3600 seconds.</p>
      {customError && <p className="form-error" role="alert">{customError}</p>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setCustomOpen(false)}>Cancel</button><button type="submit" className="button primary">Use duration</button></div>
    </form></div></Modal>
  </section>
}
