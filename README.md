# Quick local dev

Frontend (install once if you haven't):

```pwsh
cd frontend
npm install
npm start
```

Backend (dev server):

```pwsh
cd server\index.js
node index.js
```

Build frontend and serve (production):

```pwsh
cd frontend
npm run build
npm run serve
```

Docker build for frontend (from repo root):

```pwsh
docker build -f frontend/dockerfile/Dockerfile -t storyforge-frontend:latest frontend
docker run -p 3000:3000 storyforge-frontend:latest
```


# StoryForge — local dev & verification

Quick start


1. Install dependencies and ensure ffmpeg is available. On Windows you can install a static build (BtbN) and add it to PATH, or set `FFMPEG_PATH` before starting the server.

1. Start the local mock server (from repo root):

```powershell
$env:FFMPEG_PATH='C:\path\to\ffmpeg.exe'  # optional if ffmpeg on PATH
npm run server
```

1. Verify the dev flow (uploads + sample video):

```powershell
npm run verify
```

CI

- A GitHub Action `verify-dev-flow.yml` is provided to run the verification script in CI. It installs ffmpeg and runs `npm run verify`.

Production notes

- Docker: a `Dockerfile` for the server exists at `server/index.js/Dockerfile`. Build with `docker build -t storyforge-backend ./server/index.js` and run with `docker run -p 5000:5000 -e PORT=5000 storyforge-backend`.
- Process manager: `ecosystem.config.js` is included for PM2 cluster mode. Example:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 status
```

- Monitoring: `/metrics` endpoint exposes Prometheus metrics (process, GC, HTTP durations). Configure Prometheus to scrape it.

Queue & Redis

- This project includes a basic Bull queue in `server/index.js/queue.js` for export jobs. It expects Redis available at `REDIS_URL` (defaults to `redis://127.0.0.1:6379`).
- To run Redis locally on Windows, use Docker: `docker run -p 6379:6379 redis`.
- Enqueue an export via the API (`/export/youtube` or `/export/download`) and check job status at `/export/status/:id`.

YouTube OAuth & setup

- To enable real YouTube uploads you must create a Google Cloud project and OAuth credentials (Web application). Set the following environment variables in your `.env` or process env:
	- `YOUTUBE_CLIENT_ID`
	- `YOUTUBE_CLIENT_SECRET`
	- `YOUTUBE_REDIRECT_URI` (e.g., `http://localhost:5000/youtube/callback`)
- Obtain the consent URL from `/youtube/auth`, visit it, allow access, and Google will redirect to `/youtube/callback?code=...` which the server will exchange and persist tokens to `server/index.js/youtube_tokens.json`.
