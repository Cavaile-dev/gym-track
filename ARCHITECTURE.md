# Gym Track v0.1

The refactor keeps the existing API URLs, SQLite tables, workout flow, and visual design.

## Frontend

- `src/main.jsx` mounts React and loads the stylesheet entry point.
- `src/App.jsx` coordinates authentication, navigation, the active workout, and preferences.
- `src/pages/` owns page-specific state and UI: authentication, dashboard, routines, movements, workout, and history.
- `src/components/` contains shared navigation, icons, transitions, selectors, modal behavior, and confirmation dialogs. Use `ConfirmationDialog` for destructive confirmations rather than duplicating focus/scroll-lock behavior.
- `src/features/` contains account screens/preferences and the routine planner's related controls.
- `src/hooks/` contains the routine layout animation independently of API mutations.
- `src/requests.js` owns HTTP handling and idempotent set writes. A retry must keep its request ID until the server acknowledges it.
- `shared/muscleGroups.js` is the vocabulary shared by the movement picker and server validation.

## Backend

- `server/index.js` starts the listener; `server/app.js` assembles middleware and routes.
- `server/database.js` opens SQLite and exposes query/transaction helpers. Its database path is unchanged; `DATABASE_PATH` remains supported.
- `server/database/` owns additive migrations, built-in exercise data, and seeding. Importing the server applies the same migrations as before; do not replace a user's database for an upgrade.
- `server/auth.js` handles sessions/cookies; `server/validation.js` handles input validation and HTTP errors.
- `server/services/training.js` owns training data shapes, statistics, routine membership, and schedule validation.
- `server/routes/` groups endpoints by account, movements, routines, session templates, workouts, and history. Existing `/api/templates` URLs remain stable although the UI calls them sessions.

The hierarchy is Routine → weekly day assignments → session template → exercises. Workout executions reference session template IDs. Keep those IDs stable to preserve progression. Archiving a custom movement must preserve existing schedule/history references and free its active quota slot.

## Styles

`src/styles/index.css` explicitly orders base styles and enhancements. The order preserves the existing cascade. Styles are split into feature/layout sections; keep media queries beside their owning rules when making future changes, and avoid adding page-specific declarations to unrelated files.

## Verification

- `npm run format` formats source files; `npm run format:check` checks without rewriting.
- `npm test` runs API integration tests on disposable SQLite databases, React page render tests, and request retry tests. Tests do not use the user's database.
- `npm run check` runs formatting checks, all tests, and the production build.
- `npm audit` checks both runtime and development dependencies. `package-lock.json` pins the verified dependency versions.

## Preparing v0.1

1. Back up the existing SQLite database while the application is stopped, or use SQLite's backup mechanism.
2. Install the lockfile dependencies with `npm ci` and run `npm run check` and `npm audit`.
3. Start with `npm start`, keeping the existing `DATABASE_PATH` and environment settings.
4. Smoke-check sign-in, routine selection, schedule assignment, workout logging/rest/editing, and history on desktop and mobile.

This change prepares the source for v0.1; publishing, tagging, and deployment are separate actions.
