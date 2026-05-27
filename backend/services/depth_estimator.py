"""
Depth estimation with three tiers:
  1. Replicate API (best quality) — set REPLICATE_API_TOKEN
  2. Local transformers model   — set USE_LOCAL_DEPTH_AI=true (downloads ~400 MB once)
  3. PIL luminance fallback     — always available, no extra deps
"""

import asyncio
import os
import logging
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance, ImageOps
import numpy as np

logger = logging.getLogger(__name__)

# Lazy-loaded transformers pipeline
_pipe = None


async def estimate_depth(image_path: Path, output_path: Path) -> None:
    if os.getenv("REPLICATE_API_TOKEN"):
        await _depth_replicate(image_path, output_path)
    elif os.getenv("USE_LOCAL_DEPTH_AI", "").lower() == "true":
        await asyncio.get_event_loop().run_in_executor(
            None, _depth_transformers, image_path, output_path
        )
    else:
        await asyncio.get_event_loop().run_in_executor(
            None, _depth_luminance, image_path, output_path
        )


# ── Tier 1: Replicate ──────────────────────────────────────────────────────

async def _depth_replicate(image_path: Path, output_path: Path) -> None:
    import replicate
    import aiohttp

    logger.info("Depth: using Replicate (Depth Anything V2)")

    def _run() -> str:
        with open(image_path, "rb") as f:
            out = replicate.run(
                "adirik/depth-anything-v2:9f90148e71bc660f1ffeec4d97e9c2fe78f79a2ae2f70a61e44e8a81fbd01b4",
                input={"image": f, "model_size": "Small"},
            )
        return str(out)

    url = await asyncio.get_event_loop().run_in_executor(None, _run)

    async with aiohttp.ClientSession() as session:
        async with session.get(url) as r:
            r.raise_for_status()
            data = await r.read()

    output_path.write_bytes(data)
    logger.info("Replicate depth map → %s", output_path)


# ── Tier 2: Local HuggingFace model ────────────────────────────────────────

def _depth_transformers(image_path: Path, output_path: Path) -> None:
    global _pipe
    if _pipe is None:
        from transformers import pipeline
        logger.info("Loading Depth Anything V2 Small (first run will download ~400 MB) …")
        _pipe = pipeline(
            task="depth-estimation",
            model="depth-anything/Depth-Anything-V2-Small-hf",
        )
        logger.info("Model ready.")

    image = Image.open(image_path).convert("RGB")
    result = _pipe(image)
    depth_pil = result["depth"]

    arr = np.array(depth_pil, dtype=float)
    lo, hi = arr.min(), arr.max()
    if hi > lo:
        arr = (arr - lo) / (hi - lo) * 255
    normalized = Image.fromarray(arr.astype(np.uint8))
    normalized.save(output_path)
    logger.info("Transformers depth map → %s", output_path)


# ── Tier 3: Luminance approximation ────────────────────────────────────────

def _depth_luminance(image_path: Path, output_path: Path) -> None:
    """
    Converts image luminance to a plausible depth map.
    Assumes light = raised, dark = recessed — works well for subjects
    on plain white backgrounds (which DALL-E tends to produce).
    """
    logger.info("Depth: using luminance fallback (no AI depth API configured)")

    img = Image.open(image_path).convert("RGB").resize((512, 512), Image.LANCZOS)
    gray = img.convert("L")

    # Sharpen to preserve carving detail
    sharp = gray.filter(ImageFilter.UnsharpMask(radius=3, percent=180, threshold=2))

    # Smooth out high-frequency noise that would create ugly bumps in the STL
    smooth = sharp.filter(ImageFilter.GaussianBlur(radius=2))

    # Boost contrast so the relief has more dramatic height variation
    enhanced = ImageEnhance.Contrast(smooth).enhance(1.6)

    # If the image is mostly dark (subject on dark bg) invert so subject is raised
    arr = np.array(enhanced)
    if arr.mean() < 100:
        enhanced = ImageOps.invert(enhanced)

    enhanced.save(output_path)
    logger.info("Luminance depth map → %s", output_path)
