import { logo, pageOrder } from '../config.js'
import { AccountDropdown } from '../features/account/Account.jsx'
import { Transition } from './Transition.jsx'
import { NavIcon } from './Icons.jsx'
import React from 'react'

function Layout({ user, page, setPage, onLogout, children }) {
  const navigation = [
    { page: 'dashboard', label: 'Today', icon: 'home' },
    { page: 'templates', label: 'Schedule', icon: 'schedule' },
    { page: 'exercises', label: 'Exercises', icon: 'exercise' },
    { page: 'history', label: 'History', icon: 'history' },
  ]
  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="brand"
          aria-label="Gym Track home"
          onClick={() => setPage('dashboard')}
        >
          <img className="brand-image small" src={logo} alt="" />
          <span className="brand-wordmark">
            <strong>GYM TRACK</strong>
            <small>TRAINING JOURNAL</small>
          </span>
        </button>
        <div className="user-menu">
          <AccountDropdown user={user} page={page} onNavigate={setPage} onLogout={onLogout} />
        </div>
      </header>
      <main className="page-wrap">
        <Transition transitionKey={page} order={pageOrder} resetScroll className="page-transition">
          {children}
        </Transition>
      </main>
      <footer className="app-navigation">
        <div className="navigation-inner">
          <p className="navigation-caption">YOUR TRAINING</p>
          <nav className="bottom-nav" aria-label="Main navigation">
            {navigation.map((item) => (
              <button
                type="button"
                key={item.page}
                className={page === item.page ? 'active' : ''}
                aria-current={page === item.page ? 'page' : undefined}
                onClick={() => setPage(item.page)}
              >
                <span className="nav-icon">
                  <NavIcon type={item.icon} />
                </span>
                <span>{item.label}</span>
                <span className="navigation-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            ))}
          </nav>
          <div className="navigation-note">
            <span className="navigation-note-icon">
              <NavIcon type="exercise" />
            </span>
            <strong>One more rep.</strong>
            <span>A little stronger, every session.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export { Layout }
