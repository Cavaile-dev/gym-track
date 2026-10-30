import React from 'react'
import { weekdays } from '../config.js'
import { sortTemplatesByDay } from '../schedules.js'
import { SessionMetaIcon } from './Icons.jsx'
import { CloseButton } from './Modal.jsx'

export function SessionChooser({ templates, onSelect, onClose }) {
  const todayIndex = (new Date().getDay() + 6) % 7
  return (
    <div className="modal-backdrop">
      <div className="modal sheet chooser-sheet">
        <div className="modal-header">
          <div>
            <p className="eyebrow">CHOOSE A SESSION</p>
            <h2>Pick a session</h2>
          </div>
          <CloseButton label="Close schedule picker" onClick={onClose} />
        </div>
        <p className="modal-copy">Select a routine to start your workout.</p>
        {templates.length > 0 && (
          <div className="chooser-list-heading">
            <span>YOUR WEEK</span>
            <span>
              {templates.length} {templates.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>
        )}
        <div className="chooser-list">
          {sortTemplatesByDay(templates).map((template) => {
            const days = [...template.scheduledDays].sort((a, b) => a - b)
            const isToday = days.includes(todayIndex)
            const totalSets = template.exercises.reduce(
              (sum, exercise) => sum + Number(exercise.targetSets),
              0,
            )
            return (
              <button
                className={`chooser-row${isToday ? ' is-today' : ''}`}
                key={template.id}
                onClick={() => onSelect(template)}
              >
                <span className="chooser-day" aria-hidden="true">
                  <SessionMetaIcon type="calendar" />
                  <span>{days.length ? weekdays[days[0]] : 'Any day'}</span>
                </span>
                <span className="chooser-info">
                  <span className="chooser-title">
                    <strong>{template.name}</strong>
                    {isToday && (
                      <span className="template-today">
                        <i aria-hidden="true" />
                        Today
                      </span>
                    )}
                  </span>
                  <span className="chooser-meta">
                    {template.exercises.length} exercises<span aria-hidden="true">·</span>
                    {totalSets} sets
                  </span>
                  <span className="chooser-days">
                    {days.length
                      ? days.map((day) => weekdays[day]).join(' / ')
                      : 'No days assigned'}
                  </span>
                </span>
                <span className="chooser-arrow" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </button>
            )
          })}
          {!templates.length && (
            <div className="chooser-empty">
              <SessionMetaIcon type="calendar" />
              <h3>No sessions yet</h3>
              <p>Add a session to your active routine to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
