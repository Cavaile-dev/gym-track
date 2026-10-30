import { muscleGroupIcons } from '../config.js'
import React from 'react'

function NavIcon({ type }) {
  return (
    <svg
      className="nav-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === 'home' ? (
        <>
          <path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9" />
        </>
      ) : type === 'schedule' ? (
        <>
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" />
        </>
      ) : type === 'exercise' ? (
        <>
          <path d="M8 12h8M3 10v4M7 6v12M17 6v12M21 10v4M3 12h4M17 12h4" />
        </>
      ) : (
        <>
          <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2" />
        </>
      )}
    </svg>
  )
}

function SessionMetaIcon({ type }) {
  return (
    <svg
      className="session-meta-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === 'clock' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      ) : (
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 9h16" />
        </>
      )}
    </svg>
  )
}

function DashboardInsightIcon({ type }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === 'trophy' ? (
        <>
          <path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6v3H9z" />
        </>
      ) : type === 'volume' ? (
        <>
          <path d="M7 9h10M7 15h10M3 9v6M7 6v12M17 6v12M21 9v6M3 12h4M17 12h4" />
        </>
      ) : (
        <>
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M8 3v4M16 3v4M4 10h16m-12 5 3 3 5-5" />
        </>
      )}
    </svg>
  )
}

function MuscleIcon({ group }) {
  return <img src={muscleGroupIcons[group] || muscleGroupIcons.Other} alt="" aria-hidden="true" />
}

export { NavIcon, SessionMetaIcon, DashboardInsightIcon, MuscleIcon }
