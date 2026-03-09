# IKG Studio Dataset Manager

Web application for managing datasets, job assignment, FiftyOne launchers, duplicate handling, and the built-in YOLO label editor.

## What It Does

- Manages datasets stored under a configured base path
- Splits datasets into assignable jobs and tracks progress per user
- Launches per-dataset FiftyOne instances on a managed port range
- Provides a browser-based YOLO label editor and quick-edit tools
- Supports duplicate detection rules and duplicate action defaults
- Uses PostgreSQL for users, datasets, jobs, settings, and legacy instance data
- Protects the UI and API with JWT-based login

## Requirements

- Node.js 20+
- PostgreSQL 16+ if running locally
- Python 3 with FiftyOne dependencies if you want to launch local FiftyOne jobs outside Docker
- Docker + Docker Compose if you want the containerized setup

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
```

Set at least:

- `JWT_SECRET`
- `DATABASE_URL`
- `DATASET_BASE_PATH`
- `PUBLIC_ADDRESS`

The app seeds an initial admin user on first startup:

- Username: `admin`
- Password: `INITIAL_ADMIN_PASSWORD`

### 2. Start with Docker Compose

```bash
docker compose up -d
```

Open the manager at `http://localhost:3000` unless you changed `MANAGER_PORT`.

Notes:

- Docker Compose starts PostgreSQL automatically.
- The app container mounts `${DATASET_BASE_PATH}` to the same path inside the container, so the path in `.env` must exist on the host.
- `JWT_SECRET` is required by [`compose.yml`](/home/brian/projects/IKG-studio-dataset-Manager/compose.yml).

### 3. Start locally

Install dependencies:

```bash
npm install
```

Start PostgreSQL, point `DATABASE_URL` at it, then run:

```bash
npm run dev
```

For production:

```bash
npm run build
npm start
```

If local FiftyOne launching needs a non-default Python, set `PYTHON_BIN` or `FIFTYONE_PYTHON`.

## Environment Variables

These are the active environment variables used by the app:

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `JWT_SECRET` | Yes | none | Required for login/session signing |
| `DATABASE_URL` | Yes | none | PostgreSQL connection string |
| `INITIAL_ADMIN_PASSWORD` | No | `admin` | Seed password for the initial `admin` user |
| `DATASET_BASE_PATH` | Yes | `/data/datasets` | Root directory scanned for datasets |
| `PUBLIC_ADDRESS` | No | `localhost` | Hostname/IP users use to open the manager and launched tools |
| `PORT_START` | No | `5151` | First managed FiftyOne port |
| `PORT_END` | No | `5160` | Last managed FiftyOne port |
| `MANAGER_PORT` | No | `3000` | Next.js web server port |
| `DEFAULT_IOU_THRESHOLD` | No | `0.8` | Default duplicate threshold for new datasets |
| `DEFAULT_DEBUG_MODE` | No | `false` | Default duplicate debug mode |
| `LABEL_EDITOR_PRELOAD_COUNT` | No | `20` in code | Number of nearby images preloaded by the label editor |
| `VIEWER_IMAGE_LOADING_BATCH_COUNT` | No | `200` | Max concurrent viewer thumbnail loads |
| `THUMBNAIL_QUALITY` | No | `70` in code | JPEG quality used for thumbnails |
| `API_LOG_LEVEL` | No | `info` | `info`, `debug`, or `silent` |
| `PYTHON_BIN` | No | auto-detected | Preferred Python executable for FiftyOne tasks |
| `FIFTYONE_PYTHON` | No | auto-detected | Legacy alias for `PYTHON_BIN` |
| `AVAILABLE_OBB_MODES` | No | `rectangle,4point` | Allowed admin-selectable OBB modes |
| `DUPLICATE_RULES` | No | empty | JSON array string of path-based duplicate rules |
| `DUPLICATE_DEFAULT_ACTION` | No | `move` | Fallback duplicate action |

Reference template: [`.env.example`](/home/brian/projects/IKG-studio-dataset-Manager/.env.example)

## Docker Compose Notes

[`compose.yml`](/home/brian/projects/IKG-studio-dataset-Manager/compose.yml) runs:

- `postgres` on port `5432`
- `fiftyone-manager` on `MANAGER_PORT`
- The full managed FiftyOne port range from `PORT_START` to `PORT_END`

Persisted data:

- `./postgres-data` for PostgreSQL
- `pm2-logs` volume for PM2 logs
- `./deletion_logs` for deletion audit output

## Authentication

All pages and API routes except login/logout are protected by [`middleware.js`](/home/brian/projects/IKG-studio-dataset-Manager/middleware.js). If there is no valid JWT cookie, the app redirects to `/login` or returns `401` for API requests.

On first startup, [`src/lib/db.js`](/home/brian/projects/IKG-studio-dataset-Manager/src/lib/db.js) creates the initial admin account if the `users` table is empty.

## Dataset Layout

Datasets are discovered under `DATASET_BASE_PATH`. A directory is treated as a dataset when it contains both `images/` and `labels/`.

Example:

```text
/data/datasets/project-a/
  images/
  labels/
```

The recursive dataset scan currently searches up to 5 levels deep.

## Duplicate Handling

The app supports two layers of duplicate configuration:

- `DEFAULT_IOU_THRESHOLD` and `DEFAULT_DEBUG_MODE` for defaults on new datasets
- `DUPLICATE_RULES` plus `DUPLICATE_DEFAULT_ACTION` for path-based duplicate behavior

`DUPLICATE_RULES` must be a JSON array string. Example:

```env
DUPLICATE_RULES=[{"pattern":"invalid","action":"skip","labels":0,"priority":1},{"pattern":"dice","action":"delete","labels":3,"priority":2}]
```

Rule priority is ascending: lower numbers win.

## Migration Scripts

- [`scripts/migrate-to-postgres.js`](/home/brian/projects/IKG-studio-dataset-Manager/scripts/migrate-to-postgres.js): migrate older instance data into PostgreSQL
- [`scripts/migrate-to-datasets.js`](/home/brian/projects/IKG-studio-dataset-Manager/scripts/migrate-to-datasets.js): migrate legacy instance-oriented records to dataset/job structures

Run them with the same `DATABASE_URL` used by the app.

## Troubleshooting

- If the app fails at startup, check `JWT_SECRET` and `DATABASE_URL` first.
- If dataset browsing is empty, verify `DATASET_BASE_PATH` exists and is mounted at the same path inside Docker.
- If launched tools open with the wrong host, fix `PUBLIC_ADDRESS`.
- If FiftyOne jobs do not start locally, set `PYTHON_BIN` to the correct interpreter.
