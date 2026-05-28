import asyncio
import base64
import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# ── Visual render prompt (shown to user for selection) ──────────────────────
_VISUAL_SUFFIX = (
    ", dramatic studio lighting, grayscale, white clay bas-relief sculpture "
    "on a plain dark background, highly detailed, professional photography"
)

# ── Heightmap prompt (used for STL generation) ──────────────────────────────
# Rules are explicit to get pure-black background: the flood-fill remover in
# stl_builder.py also handles any residual grey, but a better source image helps.
_HEIGHTMAP_TEMPLATE = (
    "Grayscale CNC depth map of a bas-relief of: {subject}. "
    "Technical height map for CNC machining — not a photograph or artwork. "
    "STRICT RULES: "
    "(1) Background is pure solid black #000000 — absolutely no grey, texture, or glow outside the subject. "
    "(2) The {subject} shape is bright white-to-grey encoding elevation: "
    "highest raised features are brightest white, shallower areas are lighter grey. "
    "(3) Smooth continuous gradients — no shadows, no cast shadows, no specular highlights. "
    "(4) The boundary between subject and background is sharp — black background, white/grey subject. "
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
    return path
