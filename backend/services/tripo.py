"""
Tripo3D API integration — text-to-3D mesh generation.

Flow
----
1. POST /task  → task_id  (fast, returns immediately)
2. Poll GET /task/{id} until status == "success"  (30–120 s)
3. Download GLB from output.model
4. Convert GLB → STL via subprocess (trimesh isolated so FastAPI never OOMs)
5. Upload STL to Supabase Storage (permanent URL, survives Render restarts)
6. Return rendered preview URL + Supabase STL URL
"""

import asyncio
import logging
import os
import sys
from collections.abc import Callable
from pathlib import Path

import aiohttp

logger = logging.getLogger(__name__)

TRIPO_API     = "https://api.tripo3d.ai/v2/openapi"
POLL_INTERVAL = 5      # seconds between status polls
POLL_TIMEOUT  = 1200   # max seconds to wait (20 minutes — includes Tripo queue time)


async def create_tripo_task(api_key: str, prompt: str) -> str:
    """Submit a text-to-model job and return the Tripo task_id immediately."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    }
    payload = {
        "type":          "text_to_model",
        "model_version": "v2.5-20250123",
        "prompt":        prompt,
        "texture":       True,
        "pbr":           False,
    }
    async with aiohttp.ClientSession() as http:
        async with http.post(f"{TRIPO_API}/task", headers=headers, json=payload) as resp:
            if resp.status != 200:
                body = await resp.text()
                raise RuntimeError(f"Tripo task creation failed ({resp.status}): {body[:300]}")
            data = await resp.json()

    if data.get("code", -1) != 0:
        raise RuntimeError(f"Tripo API error: {data.get('message', data)}")

    task_id = data["data"]["task_id"]
    logger.info("Tripo task created: %s", task_id)
    return task_id


async def finish_tripo_task(
    api_key: str,
    task_id: str,
    session_dir: Path,
    on_progress: Callable[[int, str], None] | None = None,
) -> tuple[str | None, Path, str | None]:
    """
    Poll a Tripo task until done, download GLB, convert to STL, upload to Supabase.

    Parameters
    ----------
    on_progress(pct: int, tripo_status: str)
        Called whenever the Tripo progress value changes.

    Returns
    -------
    (rendered_cdn_url | None, stl_path, stl_supabase_url | None)
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    }

    model_url    = None
    rendered_url = None
    elapsed      = 0
    last_pct     = -1

    # ── Poll until done ───────────────────────────────────────────────────────
    # Each poll uses its own short-lived ClientSession so the session closes
    # immediately after each request (no keep-alive connection to clean up).
    # A single long-lived session caused the post-generation hang: aiohttp
    # waited to gracefully close the keep-alive TCP connection to Tripo's
    # API server, blocking the coroutine for minutes after polling finished.
    while elapsed < POLL_TIMEOUT:
        await asyncio.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

        try:
            async with aiohttp.ClientSession() as http:
                async with http.get(
                    f"{TRIPO_API}/task/{task_id}", headers=headers,
                    timeout=aiohttp.ClientTimeout(total=20),
                ) as resp:
                    if resp.status != 200:
                        logger.warning("Tripo poll %d — retrying", resp.status)
                        continue
                    data = await resp.json()
        except Exception as exc:
            logger.warning("Tripo poll error: %s — retrying", exc)
            continue

        if data.get("code", -1) != 0:
            raise RuntimeError(f"Tripo status error: {data.get('message', data)}")

        task         = data["data"]
        tripo_status = task.get("status", "")
        progress     = int(task.get("progress", 0))
        logger.info("Tripo %s: %s %d%%", task_id, tripo_status, progress)

        if progress != last_pct:
            last_pct = progress
            if on_progress:
                on_progress(progress, tripo_status)

        if tripo_status == "success":
            output       = task.get("output", {})
            model_url    = output.get("pbr_model") or output.get("model")
            rendered_url = output.get("rendered_image")  # raw CDN URL — will be downloaded below
            if on_progress:
                on_progress(100, "success")
            break
        if tripo_status in ("failed", "cancelled", "banned", "expired"):
            raise RuntimeError(f"Tripo generation {tripo_status}")

    if model_url is None:
        raise RuntimeError(
            f"Tripo generation timed out after {POLL_TIMEOUT}s — "
            "the model may still be queued; try again shortly"
        )

    # ── Download GLB ─────────────────────────────────────────────────────────
    logger.info("Downloading GLB…")
    glb_path = session_dir / "model.glb"
    try:
        async with aiohttp.ClientSession() as dl:
            # 600 s total; stream in 1 MB chunks so large files (50–200 MB) don't stall
            async with dl.get(model_url, timeout=aiohttp.ClientTimeout(total=600)) as resp:
                resp.raise_for_status()
                with glb_path.open("wb") as fout:
                    async for chunk in resp.content.iter_chunked(1024 * 1024):
                        fout.write(chunk)
    except asyncio.TimeoutError as exc:
        raise RuntimeError("GLB download timed out after 600 s — Tripo CDN may be slow") from exc
    logger.info("GLB saved %d bytes → %s", glb_path.stat().st_size, glb_path)

    # ── Convert GLB → STL in a subprocess ────────────────────────────────────
    # trimesh is only imported inside convert_glb.py (a subprocess), so the
    # FastAPI process never accumulates trimesh's ~200 MB footprint.
    stl_path = session_dir / "model.stl"
    converter = Path(__file__).parent.parent / "convert_glb.py"
    loop = asyncio.get_running_loop()

    async def _run_conversion() -> None:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, str(converter), str(glb_path), str(stl_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=180)
        if proc.returncode != 0:
            raise RuntimeError(f"GLB→STL conversion failed: {stderr.decode()[:300]}")
        logger.info("STL written %d bytes → %s", stl_path.stat().st_size, stl_path)

    await _run_conversion()

    # ── Upload STL to Supabase Storage ────────────────────────────────────────
    # Render's disk is ephemeral (files vanish on restart).  Uploading to
    # Supabase Storage gives a permanent public URL for the user's creations.
    stl_public_url = await _upload_stl_to_supabase(stl_path, session_dir.name)

    # ── Download rendered preview → upload to Supabase ───────────────────────
    # Tripo's rendered_image is an ephemeral CDN URL that expires within hours.
    # We download it here and upload to Supabase Storage so the thumbnail URL
    # is permanent.  Crucially we return a small URL string — NOT base64 — so
    # the polling JSON response stays small and the browser never freezes.
    permanent_thumb_url = await _upload_rendered_to_supabase(rendered_url, session_dir.name)

    logger.info("Tripo task %s done  stl=%s  preview=%s", task_id, stl_public_url or stl_path, permanent_thumb_url or rendered_url)
    return permanent_thumb_url or rendered_url, stl_path, stl_public_url


async def _upload_rendered_to_supabase(rendered_url: str | None, session_id: str) -> str | None:
    """Download Tripo's ephemeral rendered_image CDN URL and upload to Supabase Storage.

    Returns a permanent public URL (small string), or None on any failure.
    Never passes image bytes to the caller — keeping the polling JSON response
    small is critical so the browser thread never freezes on a large payload.
    """
    if not rendered_url:
        return None

    sb_url = os.getenv("SUPABASE_URL", "")
    sb_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not sb_url or not sb_key:
        logger.warning("Supabase env not set — skipping rendered thumbnail upload, returning CDN URL")
        return rendered_url   # fall back to ephemeral URL; at least it works briefly

    try:
        # 1. Download the rendered image
        async with aiohttp.ClientSession() as dl:
            async with dl.get(rendered_url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                resp.raise_for_status()
                ct       = resp.headers.get("Content-Type", "image/webp").split(";")[0].strip()
                img_data = await resp.read()

        ext = "webp" if "webp" in ct else "jpg"
        logger.info("Rendered preview downloaded %d bytes (ct=%s)", len(img_data), ct)

        # 2. Upload to Supabase Storage
        from supabase import create_client
        sb             = create_client(sb_url, sb_key)
        storage_path   = f"thumbnails/{session_id}/rendered.{ext}"
        sb.storage.from_("models").upload(
            storage_path, img_data,
            file_options={"content-type": ct, "upsert": "true"},
        )
        public = sb.storage.from_("models").get_public_url(storage_path)
        logger.info("Rendered thumbnail uploaded → %s", public)
        return public
    except Exception as exc:
        logger.warning("Could not upload rendered thumbnail (%s) — returning CDN URL", exc)
        return rendered_url   # still better than nothing for the current session


async def _upload_stl_to_supabase(stl_path: Path, session_id: str) -> str | None:
    """Upload the STL file to Supabase Storage and return the public URL."""
    sb_url = os.getenv("SUPABASE_URL", "")
    sb_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not sb_url or not sb_key:
        logger.warning("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping upload")
        return None

    try:
        from supabase import create_client
        sb = create_client(sb_url, sb_key)
        storage_path = f"stls/{session_id}/model.stl"
        stl_bytes = stl_path.read_bytes()
        sb.storage.from_("models").upload(
            storage_path, stl_bytes,
            file_options={"content-type": "model/stl", "upsert": "true"},
        )
        public = sb.storage.from_("models").get_public_url(storage_path)
        logger.info("STL uploaded → %s", public)
        return public
    except Exception as exc:
        logger.warning("Supabase STL upload failed: %s", exc)
        return None
