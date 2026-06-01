import asyncio
import logging
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from services.image_gen import (
    enhance_prompt, generate_images, generate_heightmap,
    describe_image_subject, enhance_uploaded_for_carving,
)
from services.stl_builder import depth_to_stl
from services.tripo import create_tripo_task, finish_tripo_task

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Relief Generator API")

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ──────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str


class ReliefRequest(BaseModel):
    session_id: str
    image_index: int
    prompt: str                          # needed to generate heightmap
    scale_z: float        = Field(1.0,  ge=0.1, le=3.0)
    detail_enhance: float = Field(0.25, ge=0.0, le=1.0)
    replace_below: float  = Field(0.05, ge=0.0, le=0.9)
    draft_angle: float    = Field(10.0, ge=0.0, le=45.0)   # degrees, 0 = vertical walls


class EnhanceImageRequest(BaseModel):
    session_id: str


class Generate3dRequest(BaseModel):
    prompt: str


# ── In-memory 3D generation job store ────────────────────────────────────────
# Keyed by job_id (short uuid). Cleared on server restart (acceptable for demo).

from typing import TypedDict

class _Job(TypedDict):
    status:       str          # pending | running | success | failed
    progress:     int          # 0–100 (real value from Tripo)
    tripo_status: str          # raw Tripo status string for display
    session_id:   str | None
    glb_url:      str | None   # Tripo CDN URL — permanent, survives server restarts
    rendered_url: str | None
    error:        str | None

_jobs: dict[str, _Job] = {}


class UpdateReliefRequest(BaseModel):
    """Re-run STL from existing heightmap with new slider values."""
    session_id: str
    scale_z: float        = Field(1.0,  ge=0.1, le=3.0)
    detail_enhance: float = Field(0.25, ge=0.0, le=1.0)
    replace_below: float  = Field(0.05, ge=0.0, le=0.9)
    draft_angle: float    = Field(10.0, ge=0.0, le=45.0)


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    """Accept a user image, create a session, and return the image URL + subject description."""
    import io as _io
    import base64 as _b64
    from PIL import Image as PILImage

    content = await file.read()
    if len(content) > 30 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 30 MB)")

    try:
        pil_img = PILImage.open(_io.BytesIO(content)).convert("RGB")
        # Fit inside 1024×1024 with black letterbox to preserve aspect ratio
        pil_img.thumbnail((1024, 1024), PILImage.LANCZOS)
        canvas = PILImage.new("RGB", (1024, 1024), (0, 0, 0))
        x, y = (1024 - pil_img.width) // 2, (1024 - pil_img.height) // 2
        canvas.paste(pil_img, (x, y))
        buf = _io.BytesIO()
        canvas.save(buf, "PNG")
        image_bytes = buf.getvalue()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read image: {e}")

    session_id = str(uuid.uuid4())[:8]
    session_dir = OUTPUT_DIR / session_id
    session_dir.mkdir(exist_ok=True)

    # image_0.png = original (used if user skips enhancement)
    # uploaded.png = immutable original (source for enhancement)
    (session_dir / "image_0.png").write_bytes(image_bytes)
    (session_dir / "uploaded.png").write_bytes(image_bytes)

    subject = await describe_image_subject(session_dir / "uploaded.png")

    b64 = _b64.b64encode(image_bytes).decode()
    return {
        "session_id": session_id,
        "image_url":  f"data:image/png;base64,{b64}",
        "subject":    subject,
    }


@app.post("/api/enhance-image")
async def api_enhance_image(req: EnhanceImageRequest):
    """AI-convert uploaded image to sculptural carving style. Saves as image_1.png."""
    import base64 as _b64

    if not req.session_id.replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid session_id")

    session_dir = OUTPUT_DIR / req.session_id
    uploaded = session_dir / "uploaded.png"
    if not uploaded.exists():
        raise HTTPException(status_code=404, detail="Session image not found")

    try:
        enhanced_path, subject = await enhance_uploaded_for_carving(uploaded, session_dir)
        b64 = _b64.b64encode(enhanced_path.read_bytes()).decode()
        return {
            "enhanced_url": f"data:image/png;base64,{b64}",
            "subject":      subject,
        }
    except Exception as e:
        logger.error("Image enhancement failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Enhancement failed: {e}")


@app.post("/api/generate")
async def api_generate(req: GenerateRequest):
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    session_id = str(uuid.uuid4())[:8]
    session_dir = OUTPUT_DIR / session_id
    session_dir.mkdir(exist_ok=True)

    original = req.prompt.strip()
    (session_dir / "prompt.txt").write_text(original)

    try:
        # Expand the short user prompt into a rich, sculpture-focused description
        # before passing it to the image generator.
        enhanced = await enhance_prompt(original)
        (session_dir / "enhanced_prompt.txt").write_text(enhanced)

        images = await generate_images(enhanced, session_dir, session_id)
        return {
            "session_id":      session_id,
            "images":          images,
            "original_prompt": original,
            "enhanced_prompt": enhanced,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Image generation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Image generation failed: {e}")


@app.post("/api/relief")
async def api_relief(req: ReliefRequest):
    if not req.session_id.replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid session_id")

    session_dir = OUTPUT_DIR / req.session_id
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found")

    image_path = session_dir / f"image_{req.image_index}.png"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    try:
        # Generate a grayscale heightmap derived from the user-selected image
        # so the STL faithfully represents what was chosen, not a re-imagination
        # of the text prompt.
        heightmap_path = await generate_heightmap(
            req.prompt, session_dir, req.session_id,
            source_image=image_path,
        )

        stl_path = session_dir / "relief.stl"
        await depth_to_stl(
            heightmap_path, stl_path,
            scale_z=req.scale_z,
            detail_enhance=req.detail_enhance,
            replace_below=req.replace_below,
            draft_angle=req.draft_angle,
        )

        import base64 as _b64
        heightmap_b64 = _b64.b64encode(heightmap_path.read_bytes()).decode()
        return {
            "heightmap_url": f"data:image/png;base64,{heightmap_b64}",
            "stl_url":       f"/api/files/{req.session_id}/relief.stl",
        }
    except Exception as e:
        logger.error("Relief creation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Relief creation failed: {e}")


@app.post("/api/update-relief")
async def api_update_relief(req: UpdateReliefRequest):
    """Re-generate STL from existing heightmap with updated slider values — no API calls."""
    if not req.session_id.replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid session_id")

    session_dir = OUTPUT_DIR / req.session_id
    heightmap_path = session_dir / "heightmap.png"
    if not heightmap_path.exists():
        raise HTTPException(status_code=404, detail="No heightmap found — generate relief first")

    try:
        stl_path = session_dir / "relief.stl"
        await depth_to_stl(
            heightmap_path, stl_path,
            scale_z=req.scale_z,
            detail_enhance=req.detail_enhance,
            replace_below=req.replace_below,
            draft_angle=req.draft_angle,
        )
        # Return a cache-busted URL so the browser reloads the 3D viewer
        return {"stl_url": f"/api/files/{req.session_id}/relief.stl"}
    except Exception as e:
        logger.error("Relief update failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Relief update failed: {e}")


@app.post("/api/generate-3d")
async def api_generate_3d_start(req: Generate3dRequest):
    """
    Submit a 3D generation job. Returns job_id immediately.
    Poll GET /api/generate-3d/status/{job_id} for progress.
    """
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    tripo_key = os.getenv("TRIPO_API_KEY", "")
    if not tripo_key:
        raise HTTPException(status_code=500, detail="TRIPO_API_KEY is not configured on this server")

    prompt = req.prompt.strip()
    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {
        "status": "pending", "progress": 0, "tripo_status": "queued",
        "session_id": None, "glb_url": None,
        "rendered_url": None, "error": None,
    }

    # Submit to Tripo3D right now so the task is in their queue immediately.
    # This is fast (<1 s) and gives us a task_id we can poll in the background.
    try:
        task_id = await create_tripo_task(tripo_key, prompt)
    except Exception as e:
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"]  = str(e)
        raise HTTPException(status_code=500, detail=f"Failed to start Tripo task: {e}")

    # Kick off background polling — the response returns while this runs.
    asyncio.create_task(_poll_and_finish(job_id, task_id, tripo_key, prompt))

    return {"job_id": job_id}


@app.get("/api/generate-3d/status/{job_id}")
async def api_generate_3d_status(job_id: str):
    """Return current status of a 3D generation job."""
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


async def _poll_and_finish(job_id: str, task_id: str, tripo_key: str, prompt: str) -> None:
    """Background coroutine: poll Tripo, download GLB, convert to STL, update job."""
    _jobs[job_id]["status"] = "running"

    session_id  = str(uuid.uuid4())[:8]
    session_dir = OUTPUT_DIR / session_id
    session_dir.mkdir(exist_ok=True)
    (session_dir / "prompt.txt").write_text(prompt)

    def _on_progress(pct: int, tripo_status: str) -> None:
        _jobs[job_id]["progress"]     = pct
        _jobs[job_id]["tripo_status"] = tripo_status

    try:
        rendered_url, tripo_glb_url = await finish_tripo_task(
            tripo_key, task_id, session_dir, on_progress=_on_progress,
        )

        _jobs[job_id].update({
            "status":       "success",
            "progress":     100,
            "session_id":   session_id,
            "glb_url":      tripo_glb_url,   # Tripo CDN URL — frontend fetches directly
            "rendered_url": rendered_url,
        })
        logger.info("Job %s complete (session %s) glb=%s", job_id, session_id, tripo_glb_url)
    except Exception as e:
        logger.error("Job %s failed: %s", job_id, e)
        _jobs[job_id].update({"status": "failed", "error": str(e)})


@app.get("/api/files/{session_id}/{filename}")
async def get_file(session_id: str, filename: str):
    if ".." in session_id or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid path")
    file_path = OUTPUT_DIR / session_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    media = {".png": "image/png", ".stl": "model/stl", ".glb": "model/gltf-binary"}
    return FileResponse(
        file_path,
        media_type=media.get(file_path.suffix.lower(), "application/octet-stream"),
        filename=filename,
        headers={"Cache-Control": "no-cache"},
    )
