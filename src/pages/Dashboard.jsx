import { SessionChooser } from '../components/SessionChooser.jsx'
import React, { useState } from 'react'
import { weekdays } from '../config.js'
import { NavIcon, SessionMetaIcon, DashboardInsightIcon } from '../components/Icons.jsx'
import { formatDate, formatRecordDate } from '../utils/format.js'
import { TodaySessions, WeekPlan } from '../features/routines/RoutinePlanner.jsx'
import { ModalPresence } from '../components/Modal.jsx'

function Dashboard({ data, user, onStart, setPage }) {
  const active = data.active
  const today = data.today
  const [showChooser, setShowChooser] = useState(false)
  const routineSessions = data.templates.filter(
    (template) => template.routineId === data.activeRoutineId,
  )
  return (
    <section className="screen dashboard-screen">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">
            {new Intl.DateTimeFormat('en', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            }).format(new Date())}
          </p>
          <h1>Hey, {user.username}.</h1>
        </div>
        <div className="streak-pill">
          <strong>{data.stats.totalDays}</strong>
          <span>TOTAL DAYS</span>
        </div>
      </div>
      <div className="dashboard-board">
        {active ? (
          <div className="hero-card resume-card">
            <div>
              <p className="card-kicker">IN PROGRESS</p>
              <h2>{active.template.name}</h2>
              <p className="muted">Your session is saved. Ready when you are.</p>
            </div>
            <button className="button primary" onClick={() => onStart(active)}>
              Resume <span>→</span>
            </button>
          </div>
        ) : today ? (
          <div className="hero-card">
            <div className="hero-top">
              <span className="card-kicker">TODAY'S SESSION</span>
              <span className="schedule-tag">{weekdays[(new Date().getDay() + 6) % 7]}</span>
            </div>
            <h2>{today.name}</h2>
            <p className="muted session-meta">
              <span>
                <NavIcon type="exercise" />
                {today.exercises.length} Exercises
              </span>
              <span aria-label={`Estimated duration: ${today.exercises.length * 8 + 12} minutes`}>
                <SessionMetaIcon type="clock" />
                {today.exercises.length * 8 + 12} min
              </span>
              <span
                aria-label={
                  today.lastPerformed
                    ? `Last performed: ${formatDate(today.lastPerformed)}`
                    : 'New template'
                }
              >
                <SessionMetaIcon type="calendar" />
                {today.lastPerformed ? formatDate(today.lastPerformed) : 'new template'}
              </span>
            </p>
            <button
              className="button primary full start-workout-button"
              onClick={() => onStart(today)}
            >
              {today.completedToday ? 'Train again' : 'Start workout'} <span>→</span>
            </button>
            <button
              className="button secondary full choose-template-button"
              onClick={() => setShowChooser(true)}
            >
              Choose another session
            </button>
            <TodaySessions sessions={data.todaySessions || []} onStart={onStart} />
          </div>
        ) : (
          <div className="hero-card empty-card">
            <span className="empty-symbol">+</span>
            <h2>No session planned</h2>
            <p className="muted">Set up a template and schedule it for today.</p>
            <button className="button primary" onClick={() => setPage('templates')}>
              Pick a template <span>→</span>
            </button>
          </div>
        )}
        <aside className="week-board">
          <div className="week-board-heading">
            <h2>Your Training Week</h2>
          </div>
          <WeekPlan sessions={routineSessions} compact />
          <button type="button" className="week-board-link" onClick={() => setPage('templates')}>
            Manage schedules <span aria-hidden="true">↗</span>
          </button>
        </aside>
      </div>
      <DashboardInsights stats={data.stats} />
      <ModalPresence open={showChooser} label="Choose a schedule">
        <SessionChooser
          templates={routineSessions}
          onSelect={(template) => {
            setShowChooser(false)
            onStart(template)
          }}
          onClose={() => setShowChooser(false)}
        />
      </ModalPresence>
    </section>
  )
}

function DashboardInsights({ stats }) {
  const delta = stats.volumeDelta
  return (
    <div className="dashboard-insights">
      <section aria-labelledby="glance-title">
        <div className="insight-section-heading">
          <h2 id="glance-title">At a Glance</h2>
          <span>This Week</span>
        </div>
        <div className="insight-stats">
          <div className="insight-volume">
            <div className="insight-stat-label">
              <span className="insight-icon">
                <DashboardInsightIcon type="volume" />
              </span>
              <span>Total volume</span>
            </div>
            <div className="insight-volume-value">
              <strong>{Number(stats.volume || 0).toLocaleString()}</strong>
              <span>kg</span>
            </div>
            <div className="insight-volume-footer">
              {delta === null ? (
                <span className="insight-no-comparison">Your training volume this week</span>
              ) : (
                <>
                  <span
                    className={`insight-change${delta < 0 ? ' is-down' : delta === 0 ? ' is-flat' : ''}`}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path
                        d={delta < 0 ? 'M3 5l5 5 5-5' : delta === 0 ? 'M3 8h10' : 'M3 10l5-5 5 5'}
                      />
                    </svg>
                    {delta > 0 ? '+' : ''}
                    {delta}%
                  </span>
                  <span>vs last week</span>
                </>
              )}
            </div>
          </div>
          <div className="insight-count">
            <div className="insight-stat-label">
              <DashboardInsightIcon type="workout" />
              <span>This Week</span>
            </div>
            <strong>{stats.workoutsWeek}</strong>
            <span className="insight-count-unit">
              {stats.workoutsWeek === 1 ? 'workout' : 'workouts'}
            </span>
          </div>
          <div className="insight-count">
            <div className="insight-stat-label">
              <SessionMetaIcon type="calendar" />
              <span>This Month</span>
            </div>
            <strong>{stats.workoutsMonth}</strong>
            <span className="insight-count-unit">
              {stats.workoutsMonth === 1 ? 'workout' : 'workouts'}
            </span>
          </div>
        </div>
      </section>
      <section aria-labelledby="records-title">
        <div className="insight-section-heading">
          <h2 id="records-title">Personal Records</h2>
          <span>Top Loads</span>
        </div>
        <div className="insight-records">
          {stats.records.length ? (
            <ol className="insight-record-list">
              {stats.records.map((record, index) => (
                <li className="insight-record" key={`${record.name}-${index}`}>
                  <span
                    className={`insight-record-rank${index === 0 ? ' is-first' : ''}`}
                    aria-label={`Rank ${index + 1}`}
                  >
                    {index === 0 ? (
                      <DashboardInsightIcon type="trophy" />
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </span>
                  <div className="insight-record-info">
                    <strong>{record.name}</strong>
                    <span>
                      <SessionMetaIcon type="calendar" />
                      {formatRecordDate(record.date)}
                    </span>
                  </div>
                  <div className="insight-record-result">
                    <strong>
                      {Number(record.weight).toLocaleString()} <span>kg</span>
                    </strong>
                    <small>× {record.reps} reps</small>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="insight-record-empty">
              <span className="insight-record-empty-icon">
                <DashboardInsightIcon type="trophy" />
              </span>
              <h3>Your next milestone starts here.</h3>
              <p>Log a workout to see your best sets.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, detail }) {
  return (
    <div className="stat-card">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

export { Dashboard, DashboardInsights, Stat }
