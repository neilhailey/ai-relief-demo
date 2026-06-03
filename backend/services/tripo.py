"""
Tripo3D API integration — text-to-3D mesh generation.

Flow
----
1. POST /task  → task_id  (fast, returns immediately)
2. Poll GET /task/{id} until status == "success"  (30–120 s)
3. Download GLB from output.model
4. Download rendered preview image (optional)

Note: we no longer convert GLB → STL on the server.
The frontend loads the GLB directly using Three.js GLTFLoader,
and the Tripo CDN URL is offered as a download link.
This eliminates the trimesh dependency and its ~200 MB RAM spike
that was causing OOM crashes on Render's free tier.
"""

import asyncio
import logging
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
) -> tuple[str | None, Path]:
    """
    Poll a Tripo task until it finishes, then download the GLB to disk.

    Parameters
    ----------
    on_progress(pct: int, tripo_status: str)
        Called whenever the Tripo progress value changes.

    Returns
    -------
    (rendered_cdn_url | None, glb_path)
        rendered_cdn_url is passed directly to the browser (<img> bypasses CORS).
        glb_path is the local file; serve it via FastAPI which has CORS headers.
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
            rendered_url = output.get("rendered_image")
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

    # ── Download GLB to disk ──────────────────────────────────────────────────
    # We cannot pass the Tripo CDN URL directly to the browser: Tripo's CDN
    # has no Access-Control-Allow-Origin headers, so GLTFLoader (XHR) is
    # blocked by CORS.  Download here and serve via FastAPI, which has the
    # CORS middleware configured.  Fresh session → closes cleanly with no hang.
    logger.info("Downloading GLB (~%s)…", model_url[:60])
    glb_path = session_dir / "model.glb"
    async with aiohttp.ClientSession() as dl:
        async with dl.get(model_url, timeout=aiohttp.ClientTimeout(total=120)) as resp:
            resp.raise_for_status()
            glb_path.write_bytes(await resp.read())
    logger.info("GLB saved %d bytes → %s", glb_path.stat().st_size, glb_path)

    # rendered_url is a signed CDN URL — browsers display <img> cross-origin
    # without CORS so we can pass it directly (no download needed).
    logger.info("Tripo task %s done  glb=%s  preview=%s", task_id, glb_path, rendered_url)
    return rendered_url, glb_path
