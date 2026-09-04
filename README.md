# Gym Track

A local-first workout logger built for one-handed use on an iPhone-sized viewport.

## Run locally

Requires Node 22.5+ (the server uses the built-in `node:sqlite` module).

```bash
npm install
npm run dev
```

Open `http://localhost:5173` on the laptop. To use a phone on the same Wi-Fi network, open the laptop's LAN IP at port `5173`. For a production-style single process:

```bash
npm run build
npm start
```

The SQLite database is created as `gym-track.sqlite` in the project root and is intentionally ignored by Git. The server binds to `0.0.0.0` for LAN access. Set `PORT` to change the production port.

Static images and other files served by URL belong in `public/assets/`. They are copied to the production build unchanged and can be referenced as `/assets/filename.ext`.

## Run with Docker

Docker Compose builds the frontend and runs the production server in one container. SQLite data is stored in the named `gym-track-data` volume, so recreating the container does not delete accounts or workout history.

```bash
docker compose up -d --build
```

Open `http://localhost:3000`, or replace `localhost` with the homeserver's LAN IP. To use another host port, set `GYM_TRACK_PORT`:

```bash
GYM_TRACK_PORT=8080 docker compose up -d --build
```

Useful commands:

```bash
docker compose logs -f
docker compose ps
docker compose down
```

Do not run `docker compose down -v` unless you intentionally want to delete the SQLite data volume.
