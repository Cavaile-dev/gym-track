# PRD — Gym Track

**Version:** 1.0
**Status:** Draft
**Owner:** Kevin

---

## 1. Overview

Gym Track is a mobile-first responsive web application for logging strength training workouts — tracking **repetitions and weight progression** per exercise. The app is designed primarily for **iPhone 15** (viewport 393 × 852 pt) and is **self-hosted on a local laptop**, accessible from the phone over the same Wi-Fi network (LAN). It is not deployed to the public internet.

### 1.1 Goals

- Fast, frictionless workout logging — from opening the app to logging the first set in **under 10 seconds**.
- Automatic workout selection based on the day's template (zero manual setup before a session).
- Visible progress over time via per-exercise history and dashboard statistics.
- Full offline-LAN operation with no external service dependencies.

### 1.2 Non-Goals (v1)

- Social features, sharing, or cloud sync.
- Nutrition tracking, body measurements.
- Wearable / HealthKit integration.
- Multi-user support beyond simple accounts on a single server instance.

---

## 2. Environment & Target Device

| Item | Requirement |
|---|---|
| Hosting | Local laptop (single machine), served over HTTP on the LAN |
| Access | Phone browser via LAN IP (e.g., `http://192.168.x.x:PORT`), same Wi-Fi only |
| Primary target | iPhone 15 — Safari, 393 × 852 pt viewport, Dynamic Island, safe-area insets |
| Secondary | Android phones, tablets, and desktop browsers — adaptive navigation and page layouts |
| Connectivity | Fully functional with no internet access (local assets only, no CDN) |

### 2.1 Responsive Design Rules

- Responsive layout: compact screens on phones, wider grids on tablets, and a sidebar with a content area up to 1440 px on desktop. Desktop navigation begins at 1024 px.
- Respect `env(safe-area-inset-top/bottom)` (Dynamic Island & home indicator).
- Touch targets ≥ 44 × 44 pt; numeric inputs open the numeric keypad (`inputmode="decimal"`).
- No horizontal scrolling at 393 pt width, including during an active workout.
- Dark mode default (gym environment), light mode optional.

---

## 3. Suggested Tech Stack

Non-binding recommendation — any local-runnable stack meeting Section 2 is acceptable.

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Vite (PWA-capable) | Mobile-first SPA, installable on iPhone home screen |
| Backend | Node.js (Express or Next.js API routes) | Single process on laptop |
| Database | SQLite (file-based) | Zero-config, survives restarts, easy backup |
| Auth | Local credentials (bcrypt + session cookie or JWT) | No external auth providers |

---

## 4. Pages & Functional Requirements

### 4.1 Page 1 — Login / Register

**Purpose:** Gate access to the app; each user's data is scoped to their account.

- Register: username, email (optional), password (min. 8 chars). Confirm password.
- Login: username + password.
- Validation errors shown inline; no page reloads.
- Session persists across app re-opens (token/cookie with long expiry) — gym users should not log in every time.
- Logged-in users are redirected straight to the Dashboard.

### 4.2 Page 2 — Dashboard

**Purpose:** Home base — start today's workout and see progress at a glance.

**Today's Workout card (primary):**
- Auto-selects the template scheduled for today (see Section 5.1).
- Card shows: template name, exercise count, estimated duration (optional), last performed date.
- Single primary button: **Start Workout** → enters the active workout flow directly at the first exercise.
- If no template is scheduled today: show a "Pick a template" state linking to Page 3.

**Statistics section:**
- Workouts this week / month
- Total volume (weight × reps) this week, with week-over-week delta
- Current streak (consecutive weeks with ≥ 1 workout)
- Personal records (latest PRs per exercise, e.g., "Bench Press — 80 kg × 5, new PR")

### 4.3 Page 3 — Workout Template Builder

**Purpose:** Define reusable workout templates and their scheduling.

- Create / edit / delete templates.
- Template = name, list of exercises, each with default target sets (e.g., 4 sets).
- Exercise picker: searchable list of built-in exercises (Bench Press, Squat, Deadlift, etc.) + custom exercise creation.
- **Scheduling:** assign template to day(s) of the week (e.g., "Push Day — Mon/Thu", "Leg Day — Wed"). This drives the Dashboard auto-pick.
- Reorder exercises via drag handle.

### 4.4 Page 4 — History Log (Calendar)

**Purpose:** Review past sessions on a calendar timeline.

- Month calendar view; days with completed workouts are marked (dot/badge).
- Tap a day → detail sheet listing exercises with all sets (weight × reps) performed that day.
- Month navigation (prev/next).
- Per-exercise history view: tap an exercise anywhere in history → chronological list of sessions showing weight/reps progression, best set highlighted, simple progression indicator (↑ / ↓ / = vs previous session).

---

## 5. Core Flow — Active Workout

This is the product's defining flow. It must be optimized for one-handed use mid-set, with sweaty hands and time pressure.

### 5.1 Auto-Pick Logic

- On Dashboard load, the app determines today's scheduled template (Section 4.3 scheduling).
- Auto-picked template is presented as the default. User may override by choosing another template before starting (secondary action).
- Pressing **Start Workout** skips any intermediate screen — the active workout screen opens **directly on the first exercise, first set**.

### 5.2 Active Workout Screen — Set Logging

For each set, the screen shows:

1. **Exercise header:** name, set progress (e.g., "Set 2 of 4"), overall workout progress bar.
2. **Previous session reference:** last session's weight and reps for THIS exercise (e.g., "Last time: 60 kg × 8"). If no history exists (new exercise), show empty/placeholder fields — no error states.
3. **Input fields:** Weight (kg, decimal allowed) and Reps — large numeric inputs, numeric keypad, last session's values pre-filled as editable defaults (if history exists).
4. **Log Set button** → saves the set and starts the rest timer.

### 5.3 Rest Timer

- On logging a set, a **rest timer** starts automatically with a **running animation** (circular or linear progress ring/bar counting down).
- Default duration configurable (e.g., 90 s); adjustable (±15 s) during the countdown; skippable.
- Timer state: large remaining-seconds display + animated progress; optional sound/vibration at completion (best-effort on iOS Safari).
- While the timer runs, the next set's inputs are already visible and editable — the user may log early and skip the remaining rest.

### 5.4 Set & Exercise Progression

- After a set is logged (and rest elapses or is skipped) → **same exercise, next set** (repeat 5.2).
- When the exercise reaches its target sets → the user may log extra sets ("+ Add set") or tap **Next Exercise**.
- → Next exercise, set 1. Repeat until the last exercise of the template.
- After the final exercise: **Workout Summary** — total sets, total volume, duration, PRs achieved, and a **Finish Workout** button. Finishing writes the session to history (Page 4) and returns to the Dashboard.

### 5.5 Active Workout Safeguards

- Workout state persists (survives accidental tab close / phone lock / page refresh mid-workout).
- In-progress workouts are resumed from the Dashboard if the app is reopened mid-session.
- Abandon workout requires explicit confirmation and is archived (not silently deleted).

---

## 6. Data Model (Conceptual)

| Entity | Key fields |
|---|---|
| User | id, username, password_hash, created_at |
| Exercise | id, name, muscle_group, is_custom, created_by |
| Template | id, user_id, name, scheduled_days[] |
| TemplateExercise | template_id, exercise_id, position, target_sets |
| WorkoutSession | id, user_id, template_id, started_at, finished_at, status |
| SetLog | id, session_id, exercise_id, set_number, weight, reps, logged_at |

---

## 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | App interactive < 1.5 s on LAN; set logging writes feel instant (optimistic UI) |
| Persistence | SQLite file; zero data loss on server restart; simple backup (copy file) |
| Availability | Served via a single command / script on the laptop; binding to `0.0.0.0` for LAN access |
| Security (LAN) | Passwords hashed (bcrypt); sessions signed; no plaintext secrets |
| Reliability | Mid-workout refresh/lock never loses logged sets (local persistence or server-side partial saves) |
| Accessibility | Contrast ≥ WCAG AA; large type on active workout screen |

---

## 8. Release Criteria (v1)

- [ ] Register, login, persistent session on iPhone 15 Safari.
- [ ] Create a template, schedule it, and have it auto-picked on the dashboard on the right day.
- [ ] Start Workout → lands directly on exercise 1, set 1, showing previous session values (or empty).
- [ ] Log set → animated rest timer → auto-advance through all sets → next exercise → summary → history.
- [ ] History calendar shows the session with per-exercise detail.
- [ ] Workout survives page refresh mid-session.
- [ ] Entire flow usable one-handed at 393 pt width with no horizontal scroll.

---

## 9. Future Considerations (Post-v1)

- PWA install + offline set caching.
- Rest timer presets per exercise.
- Progress charts (volume, estimated 1RM per exercise).
- Plate math helper ("load 60 kg → 20 + 20 + ... per side").
- Export data (CSV/JSON).
