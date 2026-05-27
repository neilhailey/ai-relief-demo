"""
Converts a grayscale heightmap (white=raised, black=background) into a
watertight binary STL bas-relief mesh.

Performance notes:
  - Coordinate arrays are pre-converted to Python lists to avoid per-iteration
    numpy overhead in the inner loop.
  - Normal computation uses pure-Python arithmetic (faster than numpy for tiny 3-vectors).
  - Background removal uses a border-seeded BFS flood fill (handles grey backgrounds).
  - Morphological closing bridges thin gaps between disconnected components.
"""

import asyncio
import struct
import logging
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

logger = logging.getLogger(__name__)


async def depth_to_stl(
    depth_path: Path,
    output_path: Path,
    width_mm: float = 100.0,
    height_mm: float = 100.0,
    relief_depth_mm: float = 8.0,
    base_thickness_mm: float = 2.0,
    resolution: int = 512,
    scale_z: float = 1.0,
    detail_enhance: float = 0.25,
    replace_below: float = 0.05,
) -> None:
    await asyncio.get_event_loop().run_in_executor(
        None, _build,
        depth_path, output_path,
        width_mm, height_mm, relief_depth_mm, base_thickness_mm,
        resolution, scale_z, detail_enhance, replace_below,
    )


# ── Background removal ────────────────────────────────────────────────────────

def _flood_fill_background(arr: np.ndarray, tolerance: float = 0.10) -> np.ndarray:
    """
    BFS flood-fill from the image border to zero out the connected background.
    Works even when the AI generates a grey background (~35% luminance).
    """
    h, w = arr.shape
    border_vals = np.concatenate([arr[0, :], arr[-1, :], arr[1:-1, 0], arr[1:-1, -1]])
    bg_level = float(np.median(border_vals))
    limit    = bg_level + tolerance
    candidate = arr <= limit

    visited = np.zeros((h, w), dtype=bool)
    q: deque = deque()

    for i in range(h):
        for j in (0, w - 1):
            if candidate[i, j] and not visited[i, j]:
                visited[i, j] = True; q.append((i, j))
    for j in range(w):
        for i in (0, h - 1):
            if candidate[i, j] and not visited[i, j]:
                visited[i, j] = True; q.append((i, j))

    while q:
        r, c = q.popleft()
        for dr, dc in ((-1,0),(1,0),(0,-1),(0,1)):
            nr, nc = r+dr, c+dc
            if 0 <= nr < h and 0 <= nc < w and not visited[nr, nc] and candidate[nr, nc]:
                visited[nr, nc] = True; q.append((nr, nc))

    result = arr.copy()
    result[visited] = 0.0
    logger.info("BG flood-fill: zeroed %d / %d px  (bg≈%.2f, limit≈%.2f)",
                int(visited.sum()), h*w, bg_level, limit)
    return result


# ── Connectivity repair ───────────────────────────────────────────────────────

def _close_subject_gaps(arr: np.ndarray, radius: int = 5) -> np.ndarray:
    """
    Morphological closing: dilate the subject mask then erode back.
    Bridges thin gaps ≤ 2*radius pixels wide between disconnected components.
    Gap pixels get a very low height so they form a thin base connection.
    """
    if not (arr > 0).any():
        return arr

    subject_pil = Image.fromarray((arr > 0).astype(np.uint8) * 255, mode='L')

    # Dilate
    dilated = subject_pil
    for _ in range(radius):
        dilated = dilated.filter(ImageFilter.MaxFilter(3))

    # Erode back (closing preserves outer boundary, fills interior gaps)
    closed = dilated
    for _ in range(radius):
        closed = closed.filter(ImageFilter.MinFilter(3))

    closed_mask    = np.array(closed) > 0
    bridge_pixels  = closed_mask & ~(arr > 0)

    if not bridge_pixels.any():
        return arr

    # Propagate nearby heights into gap pixels × 0.15 (thin physical bridge)
    h_pil = Image.fromarray((arr * 255).astype(np.uint8), mode='L')
    for _ in range(radius):
        h_pil = h_pil.filter(ImageFilter.MaxFilter(3))
    prop = np.array(h_pil, dtype=np.float64) / 255.0

    result = arr.copy()
    result[bridge_pixels] = prop[bridge_pixels] * 0.15
    logger.info("Gap closing: bridged %d pixels (radius=%d)", int(bridge_pixels.sum()), radius)
    return result


# ── STL builder ───────────────────────────────────────────────────────────────

def _build(
    depth_path: Path,
    output_path: Path,
    width_mm: float,
    height_mm: float,
    relief_depth_mm: float,
    base_thickness_mm: float,
    resolution: int,
    scale_z: float,
    detail_enhance: float,
    replace_below: float,
) -> None:
    logger.info("Building STL (res=%d, scaleZ=%.2f, enhance=%.2f, cutBelow=%.2f) …",
                resolution, scale_z, detail_enhance, replace_below)

    # ── Load & resize ───────────────────────────────────────────────────────
    img = Image.open(depth_path).convert("L")
    img = img.resize((resolution, resolution), Image.LANCZOS)

    # Detail enhancement (contrast boost)
    if detail_enhance > 0:
        factor = 1.0 + detail_enhance * 3.0
        img = ImageEnhance.Contrast(img).enhance(factor)

    # Smooth to reduce micro-facet staircase noise
    img = img.filter(ImageFilter.GaussianBlur(radius=2.0))

    arr = np.array(img, dtype=np.float64) / 255.0

    # ── Background & gap processing ─────────────────────────────────────────
    arr = _flood_fill_background(arr, tolerance=0.10)

    if replace_below > 0:
        arr[arr < replace_below] = 0.0

    arr = _close_subject_gaps(arr, radius=5)

    h, w = arr.shape

    # ── Coordinate grids (pre-convert to Python lists for fast inner loop) ──
    effective_depth = relief_depth_mm * max(scale_z, 0.01)
    zz = np.where(arr > 0, base_thickness_mm + arr * effective_depth, 0.0)

    xs = np.linspace(0.0, width_mm,  w).tolist()
    ys = np.linspace(0.0, height_mm, h).tolist()
    zs = zz.tolist()                          # list-of-lists for fast [i][j] access

    # ── Active quads ────────────────────────────────────────────────────────
    mask = arr > 0
    active = (
        mask[:-1, :-1] | mask[:-1, 1:]
        | mask[1:, :-1] | mask[1:, 1:]
    )
    active_ij = np.argwhere(active)
    logger.info("Active quads: %d / %d", len(active_ij), (h-1)*(w-1))

    # ── Pure-Python normal (faster than numpy for tiny 3-vectors) ───────────
    def _n(ax, ay, az, bx, by, bz, cx, cy, cz):
        v1x, v1y, v1z = bx-ax, by-ay, bz-az
        v2x, v2y, v2z = cx-ax, cy-ay, cz-az
        nx = v1y*v2z - v1z*v2y
        ny = v1z*v2x - v1x*v2z
        nz = v1x*v2y - v1y*v2x
        lng = (nx*nx + ny*ny + nz*nz) ** 0.5
        if lng > 1e-10:
            return (nx/lng, ny/lng, nz/lng)
        return (0.0, 0.0, 1.0)

    tris: list = []
    app = tris.append        # local alias avoids attribute lookup per iteration

    for qi in range(len(active_ij)):
        i, j = int(active_ij[qi, 0]), int(active_ij[qi, 1])

        # Corner coordinates (pulled from pre-built lists)
        x0, x1 = xs[j], xs[j+1]
        y0, y1 = ys[i], ys[i+1]
        z00, z10 = zs[i][j],   zs[i][j+1]
        z01, z11 = zs[i+1][j], zs[i+1][j+1]

        # ── Top surface ────────────────────────────────────────────────────
        app((_n(x0,y0,z00, x1,y0,z10, x0,y1,z01), (x0,y0,z00),(x1,y0,z10),(x0,y1,z01)))
        app((_n(x1,y0,z10, x1,y1,z11, x0,y1,z01), (x1,y0,z10),(x1,y1,z11),(x0,y1,z01)))

        # ── Bottom cap ─────────────────────────────────────────────────────
        dn = (0.0, 0.0, -1.0)
        app((dn, (x0,y0,0),(x0,y1,0),(x1,y0,0)))
        app((dn, (x1,y0,0),(x0,y1,0),(x1,y1,0)))

        # ── Silhouette walls: each exposed edge gets a wall ─────────────────
        # TOP edge (y=y0) → wall faces -y
        if i == 0 or not active[i-1, j]:
            app((_n(x0,y0,0, x1,y0,0, x1,y0,z10), (x0,y0,0),(x1,y0,0),(x1,y0,z10)))
            app((_n(x0,y0,0, x1,y0,z10, x0,y0,z00), (x0,y0,0),(x1,y0,z10),(x0,y0,z00)))

        # BOTTOM edge (y=y1) → wall faces +y
        if i == h-2 or not active[i+1, j]:
            app((_n(x0,y1,0, x0,y1,z01, x1,y1,0), (x0,y1,0),(x0,y1,z01),(x1,y1,0)))
            app((_n(x0,y1,z01, x1,y1,z11, x1,y1,0), (x0,y1,z01),(x1,y1,z11),(x1,y1,0)))

        # LEFT edge (x=x0) → wall faces -x
        if j == 0 or not active[i, j-1]:
            app((_n(x0,y0,0, x0,y0,z00, x0,y1,z01), (x0,y0,0),(x0,y0,z00),(x0,y1,z01)))
            app((_n(x0,y0,0, x0,y1,z01, x0,y1,0), (x0,y0,0),(x0,y1,z01),(x0,y1,0)))

        # RIGHT edge (x=x1) → wall faces +x
        if j == w-2 or not active[i, j+1]:
            app((_n(x1,y0,0, x1,y1,z11, x1,y0,z10), (x1,y0,0),(x1,y1,z11),(x1,y0,z10)))
            app((_n(x1,y0,0, x1,y1,0, x1,y1,z11), (x1,y0,0),(x1,y1,0),(x1,y1,z11)))

    _write_stl(tris, output_path)
    logger.info("STL → %s  (%d triangles, %d KB)",
                output_path, len(tris), output_path.stat().st_size // 1024)


def _write_stl(tris: list, path: Path) -> None:
    with open(path, "wb") as f:
        f.write(b"\x00" * 80)
        f.write(struct.pack("<I", len(tris)))
        for normal, v0, v1, v2 in tris:
            f.write(struct.pack("<fff", *normal))
            f.write(struct.pack("<fff", *v0))
            f.write(struct.pack("<fff", *v1))
            f.write(struct.pack("<fff", *v2))
            f.write(struct.pack("<H", 0))
