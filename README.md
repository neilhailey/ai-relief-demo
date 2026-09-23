# WeCarver — AI Relief & 3D Model Generator

Turn a text prompt into a CNC-ready **bas-relief STL** or a **full 3D model**, then share it in a community projects gallery. Built for makers using CNC routers, laser engravers, and 3D printers.

> **Live demo:** https://frontend-flame-three-47.vercel.app

---

## What it does

WeCarver has two independent AI generation pipelines plus a community layer:

- **AI Relief** — describe something ("a soaring eagle"), and ChatGPT generates preview images and a grayscale heightmap; a deterministic algorithm then extrudes that heightmap into a watertight bas-relief STL. Live sliders (depth, detail, cut-below, draft angle) re-shape the carving instantly.
- **Full 3D Model** — describe an object and the **Tripo3D** AI service sculpts a true, all-sides 3D mesh, which is converted to STL and stored permanently.
- **Upload → Relief** — upload your own photo; it's AI-converted to a carving-ready sculptural style, then turned into a relief.
- **Community Projects** — publish finished projects (NC/G-code, CAM, and model files) with pictures, description, category, tags, and a license; browse, like, and save others' projects.

> The AI-relief mesh step is **procedural math, not AI** — fast, cheap, repeatable, and clean for CNC. Full-3D uses an AI mesh service. See the design docs for a step-by-step walkthrough.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite, React Router, Three.js (STL/GLB viewers) |
| Backend | FastAPI (Python), async background jobs |
| Auth / DB / Storage | Supabase (Postgres + Row-Level Security, Auth, Storage) |
| AI — images | OpenAI `gpt-image-1` (images) + `gpt-4o-mini` (prompt expansion) |
| AI — 3D mesh | Tripo3D (`text_to_model`) |
| Mesh processing | NumPy (relief extrusion), trimesh (GLB→STL, isolated subprocess) |
| Hosting | Vercel (frontend) · Render (backend) · Cloudflare (planned edge/CDN) |

---

## How the pipelines work

**AI Relief:** prompt → `gpt-4o-mini` expands it → `gpt-image-1` renders 2 preview images → user picks one → `gpt-image-1` (edit mode) converts it to a grayscale heightmap → `depth_to_stl` extrudes it (background flood-fill removal, brightness→Z height mapping, optional V-bit draft walls, top surface + bottom cap + silhouette walls) → binary STL.

**Full 3D Model:** prompt → Tripo task submitted → backend polls for progress (async job) → GLB downloaded → converted to STL in an isolated subprocess (trimesh, decimated ≤200k faces to avoid OOM) → STL + preview uploaded to Supabase Storage.

---

## Repository structure

```
ai-relief-demo/
├── backend/                 # FastAPI service
│   ├── main.py              # API endpoints + async 3D job store
│   ├── convert_glb.py       # GLB → STL (runs as an isolated subprocess)
│   └── services/
│       ├── image_gen.py     # OpenAI prompt expansion, image + heightmap generation
│       ├── stl_builder.py   # heightmap → watertight STL (NumPy)
│       ├── depth_estimator.py  # depth map from uploaded photos
│       └── tripo.py         # Tripo3D integration + Supabase upload
├── frontend/                # React + Vite SPA
│   └── src/
│       ├── App.tsx          # AI generation wizard (relief / upload / 3D)
│       ├── pages/           # Projects gallery, project detail, upload wizard
│       ├── components/      # steps, viewers, gallery, nav, auth
│       └── lib/             # Supabase + projects data layer
├── supabase-migration-phase1.sql        # likes / saves
├── supabase-migration-phase2-projects.sql  # community projects schema
└── render.yaml              # backend deployment config
```

---

## Local development

### Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in your keys (see below)
uvicorn main:app --reload --port 8000
```

### Frontend (Vite)

```bash
cd frontend
npm install
cp .env.example .env.local  # then fill in your keys
npm run dev                 # http://localhost:5173
```

---

## Environment variables

Secrets are **never** committed — set these in `.env` / `.env.local` locally and in your host's dashboard in production.

**Backend (`backend/.env`)**

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Image + prompt generation |
| `TRIPO_API_KEY` | Full 3D model generation |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Storage uploads (**server only**) |
| `CORS_ORIGINS` | Comma-separated allowed origins |

**Frontend (`frontend/.env.local`)**

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (safe for the browser) |
| `VITE_API_URL` | Backend base URL |

---

## Database setup

Run the SQL migrations in the Supabase dashboard → **SQL Editor**, in order:

1. `supabase-migration-phase1.sql` — likes & saves for the AI gallery
2. `supabase-migration-phase2-projects.sql` — community projects, files, likes, saves, download counter

Create a public Storage bucket named `models` (used for thumbnails, STLs, and project files).

---

## Deployment

- **Frontend** → Vercel (SPA rewrite in `frontend/vercel.json` so deep links resolve).
- **Backend** → Render (see `render.yaml`); set all secrets in the Render dashboard.
- Point `VITE_API_URL` at the deployed backend and `CORS_ORIGINS` at the deployed frontend.

---

## Security

- API keys live only in environment variables / host secret stores — never in the repo.
- The Supabase **service-role key is server-side only**; the browser uses the anon key with Row-Level Security.
- A full production hardening + scale plan (auth, rate limiting, HTML sanitization, storage policies, observability) is maintained separately.
