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
) -> tuple[str | None, str | None]:
    """
    Poll a Tripo task until it finishes.  No GLB download — the frontend
    fetches the model directly from Tripo's CDN using the returned URL.

    Parameters
    ----------
    on_progress(pct: int, tripo_status: str)
        Called whenever the Tripo progress value changes.

    Returns
    -------
    (rendered_data_url | None, tripo_glb_url | None)
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    }

    model_url    = None
    rendered_url = None
    elapsed      = 0
    last_pct     = -1

    async with aiohttp.ClientSession() as http:

        # ── Poll until done ───────────────────────────────────────────────────
        while elapsed < POLL_TIMEOUT:
            await asyncio.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL

            try:
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

    # Return both CDN URLs directly — no server-side downloading at all.
    # The frontend's GLTFLoader fetches the GLB from Tripo's CDN,
    # and the rendered preview is displayed with a plain <img> tag.
    # Downloading on the server was the root cause of the post-generation hang.
    logger.info("Tripo task %s done  glb=%s  preview=%s", task_id, model_url, rendered_url)
    return rendered_url, model_url
