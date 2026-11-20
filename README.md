# GreenTrack

GreenTrack helps a campus waste team manage bins from registration to pickup. A citizen scans a bin’s QR label for sorting guidance, a collector records what they observe on site, and an administrator assigns work and reviews activity. A confirmed QR check-in measures participation. Fill levels come from observations, and citizen condition reports are available for admin review.

## Start the local app

The React frontend runs the three workspaces using a browser-based mock API by default. You can try the full local workflow before setting up Python or PostgreSQL. Use the same browser profile and frontend address when switching roles so each role can see the same saved records. A phone and a laptop have separate demo data.

Open PowerShell in the GreenTrack project folder. With Node.js and npm installed, run:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open the URL printed by Vite, normally [localhost:3000](http://localhost:3000). On subsequent runs, start with `npm.cmd run dev` from `frontend`. Press **Ctrl+C** to stop the server.

## Accounts and workspaces

The three starter accounts use the password `password123`. Use these credentials only for the local demo.

| Workspace | Starter email | What you can do |
| --- | --- | --- |
| Citizen | `citizen@greentrack.org` | Scan or enter a QR token, confirm participation, view personal history, or report a full or empty bin with an optional photo. |
| Collector | `collector@greentrack.org` | Review assignments, record inspections, complete pickups, report blocked roads, and open directions in Google Maps. |
| Admin | `admin@greentrack.org` | Manage zones, bins, QR labels, collector accounts and assignments. Review citizen reports and generate monthly analytics. |

Citizens can choose **Sign in → Create new citizen account**, enter an email, and choose or generate a password. GreenTrack generates a profile ID. Admins can create collector credentials under **Collectors & Tasks → Register Collector**, or choose **Set collector password** for an existing collector. These accounts belong to the browser profile that created them.

## Try one pickup from start to finish

1. **Register a bin.** Sign in as Admin and open **Zones & Bins**. Create a zone, pick a bin location on the campus map, and register the bin. Download the QR label or copy its token. New workspaces start with an empty inventory.
2. **Check in or report a condition.** Sign out and open Citizen Check-In. Scan the label or paste the token to see the bin’s waste category. Confirm participation to record a check-in. To flag a pickup need, choose **Report bin condition → Full** and submit. Attaching a photo is optional.
3. **Dispatch a collector.** Return as Admin in the same browser. Review **Citizen bin reports**, identify the bin, then create and assign a collection task under **Collectors & Tasks**.
4. **Complete the pickup.** Sign in as the assigned collector. Under **Assigned Tasks**, choose **Find nearest assigned bin** to compare road distances, then **Navigate with Google Maps** for directions. Record the inspection and complete the task.

The map opens at SDGI Global University. Nearest-pickup lookup uses browser location permission and the external OSRM routing service. Collector road-block reports are available as incidents. Automatically feeding those reports into Google Maps navigation is outside the current implementation.

## Run FastAPI

The Python backend currently implements the public health endpoint. The shared OpenAPI contract also describes planned operational endpoints. Starting FastAPI does not move browser accounts, QR records, photos, or tasks into PostgreSQL.

In a second PowerShell window, start from the project root with Python 3.12 or newer:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8765
```

Open the [health check](http://127.0.0.1:8765/api/v1/health) or [interactive API docs](http://127.0.0.1:8765/docs). The expected health response is:

```json
{"status":"ok","service":"greentrack-api"}
```

For the local role workflows, keep `VITE_USE_MOCK_API=true`. To test requests against FastAPI, set `VITE_USE_MOCK_API=false` and `VITE_API_BASE_URL=http://127.0.0.1:8765/api/v1` in `frontend/.env.local`, then restart Vite. Direct cross-origin browser calls also require a development proxy or backend CORS configuration. The health endpoint can be opened directly without either.

## Prepare PostgreSQL and PostGIS

Database setup is optional for the frontend demo, health endpoint, and basic backend tests. For migrations, install PostgreSQL with the matching PostGIS package and make `psql` available on your PATH. On a fresh local server:

```powershell
psql -U postgres -d postgres -c "CREATE ROLE greentrack LOGIN"
psql -U postgres -d postgres -c "\password greentrack"
psql -U postgres -d postgres -c "CREATE DATABASE greentrack OWNER greentrack"
psql -U postgres -d greentrack -c "CREATE EXTENSION IF NOT EXISTS postgis"
```

From `backend`, copy `.env.example` to `.env` if you have not configured it yet. Set `DATABASE_URL` to your local credentials using the `postgresql+psycopg` driver. Percent-encode special characters in the password. Then apply and verify the migration:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
```

The baseline revision is `0001_enable_postgis`. It prepares the spatial extension for future application tables.

## Development checks

| From | Command | Checks |
| --- | --- | --- |
| `frontend` | `npm.cmd run lint` | TypeScript types |
| `frontend` | `npm.cmd run build` | Vite production build |
| `backend` | `.\.venv\Scripts\python.exe -m pytest -q` | Health endpoint and database configuration |

## Project guide

- [Frontend](frontend/) — React, TypeScript, Vite and Tailwind CSS. Leaflet displays OpenStreetMap tiles, Recharts renders analytics, and jsQR and qrcode handle scanning and label generation.
- [Backend](backend/) — Python, FastAPI and Pydantic, with SQLAlchemy, Psycopg and Alembic for PostgreSQL/PostGIS.
- [API contract](contracts/openapi.yaml) — agreed request paths, payloads, roles and response schemas.
- [Engineering blueprint](docs/ENGINEERING_BLUEPRINT.md) — system design, data model and the distinction between participation, observed bin conditions and forecasts.
- [Model handoff prompts](docs/MODEL_HANDOFF_PROMPTS.md) — frontend and backend ownership and integration rules.
