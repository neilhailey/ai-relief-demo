"""
Tripo3D API integration — text-to-3D mesh generation.

Flow
----
1. POST /task  → task_id  (fast, returns immediately)
2. Poll GET /task/{id} until status == "success"  (30–300 s, reported via callback)
3. Download GLB from output.model
4. Download rendered preview image (optional)
5. Convert GLB → binary STL using trimesh (CPU, no GPU needed)
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
        "pbr":           True,
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
) -> tuple[Path, Path, str | None]:
    """
    Poll a Tripo task until it finishes, download the GLB, convert to STL.

    Parameters
    ----------
    on_progress(pct: int, tripo_status: str)
        Called whenever the Tripo progress value changes.

    Returns
    -------
    (glb_path, stl_path, rendered_data_url | None)
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
                model_url    = output.get("model")
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

        # ── Download GLB ──────────────────────────────────────────────────────
        logger.info("Downloading GLB…")
        async with http.get(model_url, timeout=aiohttp.ClientTimeout(total=120)) as resp:
            resp.raise_for_status()
            glb_bytes = await resp.read()

        # ── Download rendered preview (best-effort) ───────────────────────────
        rendered_data_url = None
        if rendered_url:
            try:
                async with http.get(rendered_url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status == 200:
                        import base64
                        rendered_bytes    = await resp.read()
                        rendered_data_url = (
                            f"data:image/png;base64,{base64.b64encode(rendered_bytes).decode()}"
                        )
                        (session_dir / "rendered.png").write_bytes(rendered_bytes)
            except Exception as exc:
                logger.warning("Could not download rendered preview: %s", exc)

    # ── Save GLB ──────────────────────────────────────────────────────────────
    glb_path = session_dir / "model.glb"
    glb_path.write_bytes(glb_bytes)
    logger.info("Saved GLB %d bytes → %s", len(glb_bytes), glb_path)

    # ── Convert GLB → STL ─────────────────────────────────────────────────────
    stl_path = session_dir / "model.stl"
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _sync_convert, glb_path, stl_path)
    logger.info("STL written %d bytes → %s", stl_path.stat().st_size, stl_path)

    return glb_path, stl_path, rendered_data_url


# ── GLB → STL (synchronous, runs in thread pool) ─────────────────────────────

def _sync_convert(glb_path: Path, stl_path: Path) -> None:
    """Load a GLB file and export its geometry as binary STL."""
    import trimesh

    loaded = trimesh.load(str(glb_path), force="mesh")

    if isinstance(loaded, trimesh.Scene):
        meshes = [g for g in loaded.geometry.values() if hasattr(g, "faces") and len(g.faces)]
        if not meshes:
            raise RuntimeError("GLB file contains no mesh geometry")
        combined = trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0]
    elif isinstance(loaded, trimesh.Trimesh):
        combined = loaded
    else:
        raise RuntimeError(f"Unexpected trimesh type: {type(loaded).__name__}")

    if not len(combined.faces):
        raise RuntimeError("Mesh has no faces after loading")

    combined.export(str(stl_path))
