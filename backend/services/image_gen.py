import asyncio
import base64
import os
from pathlib import Path
import logging

import numpy as np
from PIL import Image, ImageFilter

logger = logging.getLogger(__name__)

# ── Visual render prompt (shown to user for selection) ──────────────────────
_VISUAL_SUFFIX = (
    ", dramatic studio lighting, grayscale, white clay bas-relief sculpture "
    "on a plain dark background, highly detailed, professional photography, "
    "full subject completely in frame with generous padding on all sides, "
    "no cropping, centered composition, entire figure visible from head to toe"
)

# ── Heightmap prompt (used for STL generation) ──────────────────────────────
# Rules are explicit to get pure-black background: the flood-fill remover in
# stl_builder.py also handles any residual grey, but a better source image helps.
_HEIGHTMAP_TEMPLATE = (
    "Grayscale CNC depth map of a bas-relief of: {subject}. "
    "Technical height map for CNC machining — not a photograph or artwork. "
    "STRICT RULES: "
    "(1) The ENTIRE {subject} is fully contained within the image boundaries — no cropping, "
    "complete subject with generous padding on all sides. "
    "(2) Background is pure solid black #000000 — absolutely no grey, texture, or glow outside the subject. "
    "(3) The {subject} shape is bright white-to-grey encoding elevation: "
    "highest raised features are brightest white, shallower areas are lighter grey. "
    "(4) Smooth continuous gradients — no shadows, no cast shadows, no specular highlights. "
    "(5) The boundary between subject and background is sharp — black background, white/grey subject. "
    "Output looks like a topographic heat-map: brightness encodes height above a flat black plane."
)


async def enhance_prompt(original: str) -> str:
    """
    Expand a short subject description into a rich, sculpture-focused prompt
    optimised for AI image generation of bas-relief carving designs.

    Uses gpt-4o-mini — fast and cheap. Falls back to the original on any error.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return original

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)

    system = (
        "You are a prompt engineer for AI image generation specialising in CNC bas-relief wood carving artwork.\n\n"
        "Transform the user's brief subject description into a rich, detailed image generation prompt.\n\n"
        "Rules:\n"
        "• Add specific sculptural detail: anatomy, texture, pose, composition, and depth cues\n"
        "• Emphasise crisp silhouette edges, bold surface relief, and features that read clearly when carved\n"
        "• Prefer iconic, recognisable poses that give strong depth variation across the surface\n"
        "• CRITICAL: ensure the ENTIRE subject fits within the frame — include explicit framing cues like "
        "'full body', 'head to toe', 'complete figure' for full-length subjects, or 'centered', 'full face' "
        "for portraits. Never describe a composition that would be naturally cropped at the edges\n"
        "• Keep the result to 1–2 sentences, under 60 words\n"
        "• Do NOT add lighting, photography, or style words — those are appended automatically\n"
        "• Return ONLY the enhanced prompt text — no quotes, no explanation"
    )

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": original},
            ],
            max_tokens=150,
            temperature=0.7,
        )
        enhanced = response.choices[0].message.content.strip()
        logger.info("Prompt enhanced: %r → %r", original[:40], enhanced[:60])
        return enhanced
    except Exception as e:
        logger.warning("Prompt enhancement failed, using original: %s", e)
        return original


async def generate_images(prompt: str, session_dir: Path, session_id: str) -> list[dict]:
    """Generate 2 visual renders for user selection."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set")

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)

    variants = [
        f"{prompt}{_VISUAL_SUFFIX}, photorealistic render",
        f"{prompt}{_VISUAL_SUFFIX}, detailed illustration style",
    ]

    async def _gen(styled_prompt: str, idx: int) -> dict:
        logger.info("Generating visual image %d …", idx)
        response = await client.images.generate(
            model="gpt-image-1",
            prompt=styled_prompt,
            n=1,
            size="1024x1024",
        )
        img = response.data[0]
        image_data = img.b64_json or ""
        if not image_data:
            raise RuntimeError(f"No image data for variant {idx}")
        path = session_dir / f"image_{idx}.png"
        path.write_bytes(base64.b64decode(image_data))
        logger.info("Visual image %d saved → %s", idx, path)
        # Return as inline data URL so the browser doesn't need a separate request
        return {"index": idx, "url": f"data:image/png;base64,{image_data}"}

    results = await asyncio.gather(*[_gen(p, i) for i, p in enumerate(variants)])
    return list(results)


async def describe_image_subject(image_path: Path) -> str:
    """Use GPT-4o-mini vision to extract a short carving subject description."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "uploaded artwork"

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)

    img_b64 = base64.b64encode(image_path.read_bytes()).decode()
    try:
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
                    {"type": "text", "text": (
                        "Describe the main subject of this image in 5–10 words for a CNC bas-relief carving design. "
                        "Focus on the key visual element. Example: 'eagle in flight with outstretched wings'. "
                        "Return only the description — no punctuation, no quotes, no explanation."
                    )},
                ],
            }],
            max_tokens=60,
        )
        subject = resp.choices[0].message.content.strip().rstrip(".,")
        logger.info("Image subject detected: %r", subject)
        return subject
    except Exception as e:
        logger.warning("Image description failed: %s", e)
        return "uploaded artwork"


async def enhance_uploaded_for_carving(
    source_image: Path,
    session_dir: Path,
) -> tuple[Path, str]:
    """
    AI-convert a user-uploaded photo to a carving-ready bas-relief sculpture style.

    Saves the result as image_1.png (index 1) so the user can choose between
    the original (index 0) and the enhanced version (index 1) in the UI.
    Returns (enhanced_path, subject_description).
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set")

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)

    subject = await describe_image_subject(source_image)

    enhance_prompt_text = (
        f"Transform this into a dramatic grayscale white-clay bas-relief sculpture carving of {subject}. "
        "Preserve the exact composition and pose of the original image. "
        "Convert to sculptural form: bright white/grey raised surfaces, dark recessed areas, "
        "solid black background. High contrast, no colour, smooth surface gradients. "
        "Professional bas-relief carving design suitable for CNC machining."
    )

    with open(source_image, "rb") as f:
        response = await client.images.edit(
            model="gpt-image-1",
            image=f,
            prompt=enhance_prompt_text,
            n=1,
            size="1024x1024",
        )

    enhanced_data = response.data[0].b64_json or ""
    if not enhanced_data:
        raise RuntimeError("Enhancement returned no image data")

    # Save as image_1.png so /api/relief can find it via image_index=1
    enhanced_path = session_dir / "image_1.png"
    enhanced_path.write_bytes(base64.b64decode(enhanced_data))
    logger.info("Enhanced image saved → %s  subject: %r", enhanced_path, subject)
    return enhanced_path, subject


def _fix_heightmap_artifact(path: Path) -> None:
    """
    Post-process a generated heightmap to remove the dark rectangular tile-seam
    artifact that gpt-image-1 sometimes produces at internal 512 px boundaries.

    Strategy: find pixels significantly darker than their local neighbourhood
    (estimated by a wide Gaussian blur) and lift them to match.  The pure-black
    background outside the subject is excluded so only in-subject artifacts are
    corrected.
    """
    img = Image.open(path).convert("L")
    arr = np.array(img, dtype=np.float32)

    # Wide Gaussian → local average brightness at every pixel
    local_avg = np.array(img.filter(ImageFilter.GaussianBlur(radius=22)), dtype=np.float32)

    # Mask: ≥25 % darker than local average AND in a real-content region (not bg)
    mask = (arr < local_avg * 0.75) & (local_avg > 20)

    fixed = arr.copy()
    fixed[mask] = local_avg[mask] * 0.90   # lift to 90 % of expected value

    # Gentle smooth to remove sharp edges at the repair boundary
    result = Image.fromarray(np.clip(fixed, 0, 255).astype(np.uint8), mode="L")
    result = result.filter(ImageFilter.GaussianBlur(radius=1))
    result.save(path)
    logger.info("Heightmap artifact fix: %d px corrected", int(mask.sum()))


async def generate_heightmap(
    prompt: str,
    session_dir: Path,
    session_id: str,
    source_image: Path,
) -> Path:
    """Generate a grayscale heightmap using images.generate().

    Previously used images.edit() with the selected image as input, but that
    endpoint consistently produced a rectangular patch artifact in the centre of
    the heightmap (an internal tiling boundary of the gpt-image-1 edit model)
    which was then baked visibly into the STL mesh geometry.

    images.generate() with the enhanced prompt produces clean, artifact-free
    heightmaps. The enhanced prompt already captures the key structural features
    of the selected image, so the depth map quality is maintained.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set")

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)

    heightmap_prompt = _HEIGHTMAP_TEMPLATE.format(subject=prompt)
    logger.info("Generating heightmap for: %s …", prompt[:60])

    response = await client.images.generate(
        model="gpt-image-1",
        prompt=heightmap_prompt,
        n=1,
        size="1024x1024",
    )
    img = response.data[0]
    image_data = img.b64_json or ""
    if not image_data:
        raise RuntimeError("No heightmap data returned")

    path = session_dir / "heightmap.png"
    path.write_bytes(base64.b64decode(image_data))
    logger.info("Heightmap saved → %s", path)

    # Remove dark tile-seam artifact from gpt-image-1
    _fix_heightmap_artifact(path)

    return path
