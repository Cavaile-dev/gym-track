import React, { useState } from 'react'
import { NeuralNoise } from '../components/ui/neural-noise.jsx'
import { NavIcon, DashboardInsightIcon, SessionMetaIcon } from '../components/Icons.jsx'
import { logo } from '../config.js'

const previewTabs = [
  { id: 'plan', label: 'Your week', icon: 'schedule' },
  { id: 'train', label: 'Your session', icon: 'exercise' },
  { id: 'progress', label: 'Your progress', icon: 'history' },
]

const trainingWeek = [
  { day: 'Mon', name: 'Push A', group: 'Chest · Shoulders · Triceps', count: 5 },
  { day: 'Tue', name: 'Pull A', group: 'Back · Biceps', count: 5 },
  { day: 'Wed', name: 'Rest day', group: 'Recover. Come back stronger.', count: 0 },
  { day: 'Thu', name: 'Legs', group: 'Quads · Hamstrings · Calves', count: 6 },
  { day: 'Fri', name: 'Push B', group: 'Chest · Shoulders · Triceps', count: 4 },
  { day: 'Sat', name: 'Pull B', group: 'Back · Biceps', count: 4 },
  { day: 'Sun', name: 'Rest day', group: 'Recover. Come back stronger.', count: 0 },
]

const questions = [
  {
    question: 'Can I build my own training routine?',
    answer:
      'Yes. Create routines, add sessions, choose exercises, set your target sets, and assign sessions to the days that work for you. Keep multiple routines and switch your active program when your training changes.',
  },
  {
    question: 'What happens if I close the app during a workout?',
    answer:
      'Your in-progress workout is saved. Reopen Gym Track and use Resume on your dashboard to pick up your session with the sets you already logged.',
  },
  {
    question: 'Can I add my own exercises?',
    answer:
      'Absolutely. Search the built-in movement library or create a custom movement. Add it to your sessions and track its weight and reps just like any other exercise.',
  },
  {
    question: 'Does it work on my phone and computer?',
    answer:
      'Yes. The interface adapts from a phone to a tablet or desktop. Sign in to the same Gym Track server to access your routines and workout history. If your server is hosted locally, your devices need access to that network.',
  },
]

function Arrow({ diagonal = false, className = '' }) {
  return (
    <svg
      className={`landing-arrow ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h16m-6-6 6 6-6 6'} />
    </svg>
  )
}

function Brand() {
  return (
    <a className="landing-brand" href="#" aria-label="Gym Track home">
      <img src={logo} width="36" height="36" alt="" />
      <span>
        GYM TRACK<span className="landing-brand-period">.</span>
      </span>
    </a>
  )
}

function Landing() {
  return (
    <div className="landing-page">
      <a className="landing-skip" href="#main-content">
        Skip to content
      </a>
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Brand />
          <nav className="landing-nav" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="landing-header-actions">
            <a className="landing-sign-in" href="#login">
              Sign in
            </a>
            <a className="button primary landing-header-cta" href="#signup">
              Get started <Arrow diagonal />
            </a>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-noise">
            <NeuralNoise />
          </div>
          <div className="landing-container landing-hero-content">
            <p className="landing-eyebrow landing-hero-eyebrow">
              <span className="landing-status-dot" /> YOUR NEXT PERSONAL BEST STARTS HERE
            </p>
            <h1 id="landing-title">
              Less guesswork.
              <br />
              <span>More progress.</span>
            </h1>
            <p className="landing-hero-description">
              Plan your week. Log every rep. Watch yourself get stronger.
              <br className="landing-desktop-break" /> A focused workout tracker that keeps up with
              you.
            </p>
            <div className="landing-hero-actions">
              <a className="button primary landing-primary-cta" href="#signup">
                Start your journey <Arrow />
              </a>
              <a className="landing-explore" href="#preview">
                Take a look inside <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div className="landing-hero-note">
              <span>
                <Check /> Built around your routine
              </span>
              <span>
                <Check /> Phone, tablet & desktop
              </span>
            </div>
          </div>
          <div className="landing-container landing-preview-container" id="preview">
            <ProductPreview />
          </div>
        </section>

        <section
          className="landing-container landing-workflow"
          id="how-it-works"
          aria-labelledby="workflow-title"
        >
          <div className="landing-section-heading">
            <div>
              <p className="landing-eyebrow">A LITTLE STRUCTURE. A LOT OF MOMENTUM.</p>
              <h2 id="workflow-title">
                Your only job?
                <br />
                <span>Show up. Get stronger.</span>
              </h2>
            </div>
            <p>
              From your first set to your next milestone,
              <br className="landing-desktop-break" /> everything has its place.
            </p>
          </div>
          <div className="landing-step-grid">
            {[
              {
                number: '01',
                icon: 'schedule',
                title: 'Make it your routine.',
                copy: 'Build your sessions, pick your movements, and map out your training week. Your plan, on your terms.',
              },
              {
                number: '02',
                icon: 'exercise',
                title: 'Get in. Get lifting.',
                copy: 'Open today’s session and go straight to your first set. Log weight and reps, then let the rest timer take over.',
              },
              {
                number: '03',
                icon: 'history',
                title: 'See the work add up.',
                copy: 'Look back at your sessions, follow your training volume, and see your personal records move forward.',
              },
            ].map((step) => (
              <article className="landing-step" key={step.number}>
                <div className="landing-step-top">
                  <span className="landing-icon-box">
                    <NavIcon type={step.icon} />
                  </span>
                  <span>{step.number}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-features" id="features" aria-labelledby="features-title">
          <div className="landing-container">
            <div className="landing-section-heading">
              <div>
                <p className="landing-eyebrow">BUILT FOR THE WAY YOU TRAIN</p>
                <h2 id="features-title">
                  Less tapping.
                  <br />
                  <span>More training.</span>
                </h2>
              </div>
              <p>
                The details that make a difference
                <br className="landing-desktop-break" /> when you’re in the middle of a session.
              </p>
            </div>
            <div className="landing-feature-grid">
              <article className="landing-feature-card landing-feature-session">
                <span className="landing-feature-label">
                  <NavIcon type="exercise" /> IN YOUR CORNER, EVERY SET
                </span>
                <h3>
                  Pick up where
                  <br />
                  you left off.
                </h3>
                <p>
                  Last session’s weight and reps, right where you need them. Spend less time
                  remembering and more time improving.
                </p>
                <div className="landing-set-example">
                  <div>
                    <span>BENCH PRESS</span>
                    <span>SET 2 OF 4</span>
                  </div>
                  <p>
                    Last time <strong>60 kg × 8 reps</strong>
                  </p>
                  <div className="landing-example-inputs">
                    <div>
                      <span>
                        WEIGHT <small>kg</small>
                      </span>
                      <strong>62.5</strong>
                    </div>
                    <div>
                      <span>REPS</span>
                      <strong>8</strong>
                    </div>
                  </div>
                  <div className="landing-example-saved">
                    <Check /> One more step forward.
                  </div>
                </div>
              </article>
              <article className="landing-feature-card landing-feature-timer">
                <span className="landing-feature-label">
                  <SessionMetaIcon type="clock" /> TAKE A BREATHER
                </span>
                <h3>
                  Your rest.
                  <br />
                  Already counting.
                </h3>
                <p>
                  Log a set and your rest timer starts. Adjust it, skip it, or get your next set
                  ready while it runs.
                </p>
                <div
                  className="landing-rest-illustration"
                  aria-label="Example rest timer: one minute and fifteen seconds remaining"
                >
                  <svg viewBox="0 0 160 160" fill="none" aria-hidden="true">
                    <circle cx="80" cy="80" r="70" />
                    <circle className="landing-timer-progress" cx="80" cy="80" r="70" />
                  </svg>
                  <div>
                    <span>REST TIMER</span>
                    <strong>01:15</strong>
                    <small>Breathe. You’ve got this.</small>
                  </div>
                </div>
              </article>
              <article className="landing-feature-card landing-feature-resume">
                <span className="landing-icon-box">
                  <Check />
                </span>
                <div>
                  <h3>Life happens. Your sets stay.</h3>
                  <p>
                    Phone locks? Tab closes? Your workout is saved, ready to resume when you are.
                  </p>
                </div>
                <span className="landing-saved-pill">
                  <span className="landing-status-dot" /> SESSION SAVED
                </span>
              </article>
            </div>
          </div>
        </section>

        <section
          className="landing-container landing-progress-section"
          aria-labelledby="progress-title"
        >
          <div className="landing-progress-copy">
            <p className="landing-eyebrow">PROGRESS IS PERSONAL</p>
            <h2 id="progress-title">
              The numbers tell
              <br />
              <span>your story.</span>
            </h2>
            <p>
              A heavier lift. Another training week. A new personal best. See the proof of the work
              you’re putting in.
            </p>
            <ul className="landing-progress-list">
              <li>
                <DashboardInsightIcon type="volume" />
                <div>
                  <strong>Your effort, in perspective</strong>
                  <span>Weekly volume and workout counts at a glance.</span>
                </div>
              </li>
              <li>
                <DashboardInsightIcon type="trophy" />
                <div>
                  <strong>Your milestones, remembered</strong>
                  <span>Personal records and a history of every session.</span>
                </div>
              </li>
              <li>
                <NavIcon type="history" />
                <div>
                  <strong>A clear reference for your next lift</strong>
                  <span>Previous sets tracked separately for each session.</span>
                </div>
              </li>
            </ul>
            <a className="landing-inline-link" href="#signup">
              Start building your history <Arrow />
            </a>
          </div>
          <div className="landing-progress-art">
            <ProgressPreview detailed />
          </div>
        </section>

        <section className="landing-container landing-faq" id="faq" aria-labelledby="faq-title">
          <div>
            <p className="landing-eyebrow">GOOD TO KNOW</p>
            <h2 id="faq-title">
              A few things
              <br />
              <span>before your first set.</span>
            </h2>
          </div>
          <div className="landing-faq-list">
            {questions.map(({ question, answer }) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-container landing-final-cta" aria-labelledby="final-cta-title">
          <div className="landing-cta-grid" aria-hidden="true" />
          <div className="landing-final-content">
            <p className="landing-eyebrow">ONE MORE REP. ONE MORE STEP FORWARD.</p>
            <h2 id="final-cta-title">
              Make your next
              <br />
              <span>session count.</span>
            </h2>
            <p>Your routine. Your training. Your progress. All in one place.</p>
            <a className="button primary landing-primary-cta" href="#signup">
              Let’s get stronger <Arrow />
            </a>
            <span className="landing-final-signin">
              Already tracking? <a href="#login">Sign in</a>
            </span>
          </div>
        </section>
      </main>
      <footer className="landing-container landing-footer">
        <Brand />
        <p>
          YOUR TRAINING <span>·</span> YOUR PROGRESS
        </p>
        <a href="#">
          Back to top <span aria-hidden="true">↑</span>
        </a>
      </footer>
    </div>
  )
}

function Check() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4 10 4 4 8-8" />
    </svg>
  )
}

function ProductPreview() {
  const [tab, setTab] = useState('plan')
  const selectTab = (event, index) => {
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % previewTabs.length
        : event.key === 'ArrowLeft'
          ? (index + previewTabs.length - 1) % previewTabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? previewTabs.length - 1
              : null
    if (nextIndex === null) return
    event.preventDefault()
    setTab(previewTabs[nextIndex].id)
    document.getElementById(`preview-tab-${previewTabs[nextIndex].id}`).focus()
  }
  return (
    <div className="landing-product-preview">
      <div className="landing-preview-bar">
        <div>
          <span className="landing-status-dot" /> A LOOK INSIDE GYM TRACK
        </div>
        <span>
          <span className="landing-preview-interactive">
            INTERACTIVE PREVIEW <span className="landing-preview-bar-sep">/</span>{' '}
          </span>
          SAMPLE DATA
        </span>
      </div>
      <div className="landing-preview-layout">
        <div className="landing-preview-sidebar">
          <div className="landing-preview-brand">
            <img src={logo} width="28" height="28" alt="" />
            <span>GYM TRACK</span>
          </div>
          <div
            className="landing-preview-tabs"
            role="tablist"
            aria-label="Explore Gym Track features"
          >
            {previewTabs.map((item, index) => (
              <button
                type="button"
                role="tab"
                id={`preview-tab-${item.id}`}
                aria-controls={`preview-panel-${item.id}`}
                aria-selected={tab === item.id}
                tabIndex={tab === item.id ? 0 : -1}
                className={tab === item.id ? 'is-active' : ''}
                key={item.id}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => selectTab(event, index)}
              >
                <NavIcon type={item.icon} />
                <span>{item.label}</span>
                <Arrow diagonal />
              </button>
            ))}
          </div>
          <div className="landing-preview-sidebar-note">
            <NavIcon type="exercise" />
            <strong>One more rep.</strong>
            <span>
              A little stronger,
              <br />
              every session.
            </span>
          </div>
        </div>
        <div
          className="landing-preview-main"
          role="tabpanel"
          id={`preview-panel-${tab}`}
          aria-labelledby={`preview-tab-${tab}`}
          tabIndex="0"
        >
          {tab === 'plan' ? (
            <WeekPreview />
          ) : tab === 'train' ? (
            <SessionPreview />
          ) : (
            <ProgressPreview />
          )}
        </div>
      </div>
      <div className="landing-preview-caption">
        <span>BUILT FOR YOUR TRAINING. DESIGNED TO STAY OUT OF THE WAY.</span>
        <span>
          TRY THE TABS ABOVE <span aria-hidden="true">↖</span>
        </span>
      </div>
    </div>
  )
}

function WeekPreview() {
  const [day, setDay] = useState(0)
  const session = trainingWeek[day]
  return (
    <div className="landing-demo-week">
      <div className="landing-demo-heading">
        <div>
          <p>YOUR WEEK, YOUR WAY</p>
          <h3>Hey, Alex.</h3>
        </div>
        <span className="landing-demo-streak">↗ 3 WEEKS STREAK</span>
      </div>
      <div className="landing-demo-days" aria-label="Example training week">
        {trainingWeek.map((item, index) => (
          <button
            type="button"
            key={item.day}
            aria-pressed={index === day}
            aria-label={`${item.day}: ${item.name}`}
            className={index === day ? 'is-selected' : ''}
            onClick={() => setDay(index)}
          >
            <span>{item.day}</span>
            <strong>{String(index + 9).padStart(2, '0')}</strong>
            <span className={item.count ? 'has-session' : ''} />
          </button>
        ))}
      </div>
      <div className={`landing-demo-session${!session.count ? ' is-rest' : ''}`}>
        <div>
          <p>{session.count ? 'YOUR NEXT SESSION' : 'RECOVERY IS PART OF THE PLAN'}</p>
          <h4>{session.name}</h4>
          <span>{session.group}</span>
          <div className="landing-demo-session-meta">
            {session.count ? (
              <>
                <NavIcon type="exercise" /> {session.count} exercises <span>·</span>{' '}
                <SessionMetaIcon type="clock" /> {session.count * 8 + 12} min
              </>
            ) : (
              'A well-earned break. Your next session will be ready.'
            )}
          </div>
        </div>
        <span className="landing-demo-session-icon">
          <NavIcon type={session.count ? 'exercise' : 'history'} />
        </span>
      </div>
      <p className="landing-demo-hint">
        <span aria-hidden="true">↖</span> Choose a day to explore the sample routine.
      </p>
    </div>
  )
}

function SessionPreview() {
  return (
    <div className="landing-demo-training">
      <div className="landing-demo-heading">
        <div>
          <p>PUSH A · EXERCISE 1 OF 5</p>
          <h3>Bench Press</h3>
        </div>
        <span className="landing-demo-streak">SET 2 OF 4</span>
      </div>
      <div className="landing-demo-workout-progress">
        <span />
      </div>
      <div className="landing-demo-previous">
        <NavIcon type="history" />
        <span>Previous session</span>
        <strong>60 kg × 8 reps</strong>
      </div>
      <div className="landing-demo-log-fields">
        <div>
          <span>
            WEIGHT <small>kg</small>
          </span>
          <strong>62.5</strong>
        </div>
        <div>
          <span>REPS</span>
          <strong>8</strong>
        </div>
      </div>
      <div className="landing-demo-completed-set">
        <Check />
        <span>SET 1 LOGGED</span>
        <strong>62.5 kg × 8 reps</strong>
      </div>
      <div className="landing-demo-training-footer">
        <SessionMetaIcon type="clock" />
        <span>Automatic rest timer. Your next set, ready when you are.</span>
      </div>
    </div>
  )
}

function ProgressPreview({ detailed = false }) {
  return (
    <div className={`landing-demo-progress${detailed ? ' is-detailed' : ''}`}>
      <div className="landing-demo-heading">
        <div>
          <p>SMALL WINS. REAL MOMENTUM.</p>
          <h3>Your work adds up.</h3>
        </div>
        <DashboardInsightIcon type="volume" />
      </div>
      <div className="landing-demo-stats">
        <div>
          <span>THIS WEEK</span>
          <strong>
            4 <small>workouts</small>
          </strong>
        </div>
        <div>
          <span>TOTAL VOLUME</span>
          <strong>
            8,450 <small>kg</small>
          </strong>
        </div>
        <div>
          <span>THIS MONTH</span>
          <strong>
            12 <small>workouts</small>
          </strong>
        </div>
      </div>
      <div className="landing-demo-record-heading">
        <span>PERSONAL RECORDS</span>
        <span>TOP LOADS</span>
      </div>
      <div className="landing-demo-record">
        <span className="landing-record-icon">
          <DashboardInsightIcon type="trophy" />
        </span>
        <div>
          <strong>Bench Press</strong>
          <span>Your strongest set yet</span>
        </div>
        <strong>
          70 <small>kg</small>
          <span>× 6 reps</span>
        </strong>
      </div>
      <div className="landing-demo-record">
        <span className="landing-record-number">02</span>
        <div>
          <strong>Barbell Squat</strong>
          <span>Another milestone in the books</span>
        </div>
        <strong>
          100 <small>kg</small>
          <span>× 5 reps</span>
        </strong>
      </div>
      <div className="landing-progress-activity">
        <div>
          <span>ONE SESSION AT A TIME</span>
          <span>EXAMPLE TRAINING HISTORY</span>
        </div>
        <div
          className="landing-activity-grid"
          role="img"
          aria-label="Illustration of completed workouts over several weeks"
        >
          {Array.from({ length: 56 }, (_, index) => (
            <span
              className={
                [
                  0, 3, 5, 7, 11, 13, 14, 17, 19, 21, 22, 25, 27, 28, 31, 33, 35, 36, 38, 40, 42,
                  45, 47, 49, 50, 52, 54,
                ].includes(index)
                  ? 'is-trained'
                  : ''
              }
              key={index}
            />
          ))}
        </div>
      </div>
      {detailed && (
        <p className="landing-art-caption">
          SAMPLE DATA. YOUR STORY STARTS WITH YOUR FIRST SESSION.
        </p>
      )}
    </div>
  )
}

export { Landing }
