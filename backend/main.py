import logging
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from services.image_gen import generate_images, generate_heightmap
from services.stl_builder import depth_to_stl

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


@app.post("/api/generate")
async def api_generate(req: GenerateRequest):
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    session_id = str(uuid.uuid4())[:8]
    session_dir = OUTPUT_DIR / session_id
    session_dir.mkdir(exist_ok=True)

    # Save prompt for later (heightmap generation)
    (session_dir / "prompt.txt").write_text(req.prompt.strip())

    try:
        images = await generate_images(req.prompt.strip(), session_dir, session_id)
        return {"session_id": session_id, "images": images}
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


@app.get("/api/files/{session_id}/{filename}")
async def get_file(session_id: str, filename: str):
    if ".." in session_id or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid path")
    file_path = OUTPUT_DIR / session_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    media = {".png": "image/png", ".stl": "model/stl"}
    return FileResponse(
        file_path,
        media_type=media.get(file_path.suffix.lower(), "application/octet-stream"),
        filename=filename,
        headers={"Cache-Control": "no-cache"},
    )
