"""
Supabase Storage uploads for relief outputs.

Render's disk is ephemeral: anything in output/ vanishes on restart or deploy,
which breaks STL downloads and thumbnails for saved creations. Uploading to the
public `models` bucket gives permanent URLs.
"""

import asyncio
import io
import logging
import os
from pathlib import Path

from PIL import Image

logger = logging.getLogger(__name__)


def _upload_sync(storage_path: str, data: bytes, content_type: str) -> str | None:
    sb_url = os.getenv("SUPABASE_URL", "")
    sb_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not sb_url or not sb_key:
        logger.warning("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping upload of %s", storage_path)
        return None
    try:
        from supabase import create_client
        sb = create_client(sb_url, sb_key)
        sb.storage.from_("models").upload(
            storage_path, data,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        public = sb.storage.from_("models").get_public_url(storage_path)
        logger.info("Uploaded %s → %s", storage_path, public)
        return public
    except Exception as exc:
        logger.warning("Supabase upload of %s failed: %s", storage_path, exc)
        return None


async def upload_relief_stl(stl_path: Path, session_id: str) -> str | None:
    """Upload (or replace) the session's relief STL; returns its public URL."""
    return await asyncio.to_thread(
        _upload_sync, f"stls/{session_id}/relief.stl", stl_path.read_bytes(), "model/stl",
    )


async def upload_thumbnail(image_path: Path, session_id: str, max_px: int = 512) -> str | None:
    """Upload a small JPEG of the selected design; returns its public URL."""
    img = Image.open(image_path).convert("RGB")
    img.thumbnail((max_px, max_px))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return await asyncio.to_thread(
        _upload_sync, f"thumbnails/{session_id}/relief.jpg", buf.getvalue(), "image/jpeg",
    )
