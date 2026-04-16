## Safecity Dashboard — Server Specs & Sizing Notes

This document summarizes the current implementation characteristics (APIs, uploads, data) and proposes production-ready server specs so the system runs properly at scale.

---

## 1) Current implementation (from the repo)

### Backend
- **Framework**: **Django + Django REST Framework (DRF)** with JWT auth (`rest_framework_simplejwt`).
- **Backend path**: `SafeCity-Backend/`
- **API mount**: `SafeCity-Backend/server/urls.py` mounts `api.urls` at `/api/`.
- **Media**:
  - `MEDIA_URL = '/media/'`
  - `MEDIA_ROOT = BASE_DIR / 'media'`
  - Media is served by Django only when `DEBUG=True` (development).

### Database
- **Production DB**: **PostgreSQL + PostGIS** (GeoDjango engine `django.contrib.gis.db.backends.postgis`).
- Key GIS usage includes `MultiPolygonField` (`SRID 4326`) on `Project`.

### Frontend
- **Framework**: React + Vite (`SafeCity-Frontend/`).
- Typically deployed as **static** assets (e.g., Vercel/CDN).

---

## 2) API inventory (how many APIs are implemented)

### Summary
- **Router “endpoint groups”**: **45** DRF router registrations.
- **Explicit non-router endpoints**: **8** `path(...)` endpoints.
- Total groups/endpoints (high-level): **53** (note: each router group maps to multiple concrete URLs like list/detail).

### Routes file
- All route registrations are in: `SafeCity-Backend/api/urls.py`

### Router groups (examples)
The router registers groups like:
- Users: `create-user`, `login-user`, `get-user`, `update-user`, `user-permissions`
- Location master data: `province`, `division`, `district`, `tehsil`
- Stakeholders, projects, project activities
- Progress images, pictorial archive
- Project documents

### Explicit endpoints (8)
In `SafeCity-Backend/api/urls.py`:
- `project-gantt/<int:project_id>/`
- `update-task-actual/<int:task_id>/`
- `project-gantt-nested/<int:project_id>/`
- `project-gantt-all/`
- `project-summary/`
- `add-delay-log/`
- `list-delay-log/`
- `update-delay-log/<int:pk>/`

### Important routing note (potential duplication)
`server/urls.py` mounts the API at `/api/`, and `api/urls.py` also includes router URLs under `path('api/', ...)` and `path('', ...)`.
This can create two effective prefixes:
- `/api/<route>/...`
- `/api/api/<route>/...`

Recommendation: standardize to a single prefix before production.

---

## 3) Uploads, images, and file storage behavior

### Upload-capable features
The backend stores uploads under `SafeCity-Backend/media/` by default:
- **Project files**: XER + boundary file (GeoJSON) attached to projects
- **Project documents**: PDF/DOC/DOCX/XLSX
- **Progress images**: images per activity (daily logs style)
- **Pictorial archive**: images per project

### Upload path conventions
Upload paths are generated in `SafeCity-Backend/api/utils.py`, using patterns like:
- `projects/<project>/daily_logs/<date>/<uuid>.<ext>`
- `projects/<projectId>-<projectName>/<date>/{xer|geojson|others}/<uuid>.<ext>`

### Media serving
- Development: Django serves `/media/...` when `DEBUG=True`.
- Production: you must serve media via **Nginx** (disk volume) or preferably **object storage + CDN**.

### Image processing / resizing
- No explicit backend resizing pipeline was found; images appear stored “as-is”.

### Upload size limits
- No explicit Django upload limits were found (e.g., `DATA_UPLOAD_MAX_MEMORY_SIZE`).
For production, define safe upload limits and request buffering settings at the reverse proxy.

---

## 4) Data model & “what gets big”

### Likely high-growth tables
These are the most likely to grow large and drive DB size/CPU:
- **ProjectActivity** + **TaskDependency**: schedule import from **Primavera XER** can create many nodes/tasks/dependencies per project.
- **ProgressImage / PictorialArchive / ProjectDocument**: ongoing attachments with TB-scale growth over time.
- **ActivityDelayLog**: history/log style table.

### Heavy endpoints
Performance hotspots at scale are likely:
- `project-gantt*` endpoints (tree building / full-project loads)
- `project-summary/`
- Media-heavy list endpoints (documents/images) if not paginated or cached well

---

## 5) Your scale assumptions (from your answers)

- **Concurrency**: **3000+ concurrent users**
- **Workload shape**: **mixed reads + regular writes** during peak
- **Data + uploads**: **very large** (TB-scale uploads likely; DB may also be large)

---

## 6) Recommended production architecture (so it runs properly at 3000+ concurrency)

At your scale, a single server is a major risk. Recommended split:

1) **Frontend**: CDN/static hosting (Vercel/CloudFront/Nginx static).
2) **Load balancer**: TLS termination + routing to app nodes.
3) **App/API tier**: multiple Django app instances (horizontal scaling).
4) **Database tier**: Postgres + PostGIS (prefer managed, or dedicated HA cluster).
5) **Media storage**: object storage (S3-compatible) + CDN (preferred), or mounted volume + Nginx.
6) **Observability**: logs + metrics + alerts.

High-level flow:
- Users → Load balancer → Django app nodes → PostGIS
- Users → CDN → media/object storage (images/docs)

---

## 7) Concrete server specs (initial sizing)

### Option A (recommended): scalable architecture

**Load balancer**
- 1 managed LB (or HAProxy pair if self-managed).

**API/App nodes (Django)**
- Start with **4–6 nodes**
- Each node: **4 vCPU / 8–16 GB RAM**
- Disk: **60–100 GB** OS/app (do not store media permanently on these disks)
- Network: target **1 Gbps**

**Database (PostgreSQL + PostGIS)**
- Start with **16–32 vCPU / 64–128 GB RAM**
- Storage: **NVMe/SSD**, start **2–4 TB usable** (and plan growth)
- Enable automated backups + PITR; tune IOPS for high read/write

**Media/Object storage**
- S3-compatible bucket sized for **multi-TB**
- Put a **CDN** in front for downloads/images to reduce app/DB load
- Lifecycle rules for retention/cost control

### Option B: single-VM “minimum viable” (not recommended for 3000+ concurrency)

- 1 VM running Nginx + Django + PostGIS together:
  - **16–24 vCPU / 64–96 GB RAM**
  - **2–4 TB NVMe**
  - Daily backups

This can work for a pilot but is fragile at true 3000+ concurrent usage and is hard to scale.

---

## 8) Performance targets (what to aim for)

- **Typical list endpoints**: p50 < 300 ms, p95 < 1–2 s
- **Heavy gantt endpoints**: target depends on project size; expect these to need optimization and/or caching at scale

Measure:
- requests/sec, app worker saturation, DB CPU/memory/IO, slow queries, media egress

---

## 9) Production gaps to address (affects “runs properly”)

The repo does not include production infra configs (Docker/Nginx/systemd/k8s) and currently has these gaps:
- **Media serving**: production needs Nginx/object storage (not Django `DEBUG` static serving)
- **Caching**: no Redis cache configured; adding it can materially reduce required DB/app size
- **Background work**: no Celery/queue; heavy imports/parsing may benefit from async jobs
- **Secrets handling**: avoid deploying `secrets.json` directly; use environment variables or a secrets manager

