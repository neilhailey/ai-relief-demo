"""
Converts a grayscale heightmap (white=raised, black=background) into a
watertight binary STL bas-relief mesh.

Performance:
  - Mesh building is fully vectorised with NumPy — no Python inner loop.
  - Binary STL is written with a numpy structured array (single tofile call).
  - Background removal uses a border-seeded BFS flood fill.
  - Morphological closing bridges thin gaps between disconnected components.
  - Default resolution 1024 px gives ~0.1 mm/pixel for 100 mm stock — good
    for CNC G-code generation.
"""

import asyncio
import math
import struct
import logging
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
    resolution: int = 512,          # 512 → 0.2 mm/px at 100 mm — plenty for CNC
    scale_z: float = 1.0,
    detail_enhance: float = 0.25,
    replace_below: float = 0.05,
    draft_angle: float = 0.0,
) -> None:
    await asyncio.get_event_loop().run_in_executor(
        None, _build,
        depth_path, output_path,
        width_mm, height_mm, relief_depth_mm, base_thickness_mm,
        resolution, scale_z, detail_enhance, replace_below, draft_angle,
    )


# ── Background removal ────────────────────────────────────────────────────────

def _flood_fill_background(arr: np.ndarray, tolerance: float = 0.10) -> np.ndarray:
    """
    Zero out the border-connected background region.

    Uses scipy.ndimage.label (C-level) to find connected components of
    background-candidate pixels, then removes those that touch the image
    border. This is 20-50× faster than a Python BFS at 512+ px resolution.
    """
    h, w = arr.shape
    border_vals = np.concatenate([arr[0, :], arr[-1, :], arr[1:-1, 0], arr[1:-1, -1]])
    bg_level = float(np.median(border_vals))
    limit    = bg_level + tolerance
    candidate = arr <= limit

    try:
        from scipy.ndimage import label as ndlabel
        labeled, _ = ndlabel(candidate)
        # Collect all label ids that appear on any border pixel
        border_labels = np.unique(np.concatenate([
            labeled[0, :], labeled[-1, :], labeled[:, 0], labeled[:, -1]
        ]))
        border_labels = border_labels[border_labels > 0]   # 0 = non-candidate
        visited = np.isin(labeled, border_labels)
    except ImportError:
        # Fallback: pure-Python BFS (slower but always available)
        visited = np.zeros((h, w), dtype=bool)
        from collections import deque as _deque
        q: _deque = _deque()
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
    """Morphological closing to bridge thin gaps ≤ 2*radius pixels wide."""
    if not (arr > 0).any():
        return arr

    subject_pil = Image.fromarray((arr > 0).astype(np.uint8) * 255, mode='L')

    dilated = subject_pil
    for _ in range(radius):
        dilated = dilated.filter(ImageFilter.MaxFilter(3))
    closed = dilated
    for _ in range(radius):
        closed = closed.filter(ImageFilter.MinFilter(3))

    closed_mask   = np.array(closed) > 0
    bridge_pixels = closed_mask & ~(arr > 0)

    if not bridge_pixels.any():
        return arr

    h_pil = Image.fromarray((arr * 255).astype(np.uint8), mode='L')
    for _ in range(radius):
        h_pil = h_pil.filter(ImageFilter.MaxFilter(3))
    prop = np.array(h_pil, dtype=np.float64) / 255.0

    result = arr.copy()
    result[bridge_pixels] = prop[bridge_pixels] * 0.15
    logger.info("Gap closing: bridged %d pixels (radius=%d)", int(bridge_pixels.sum()), radius)
    return result


# ── Vectorised helpers ────────────────────────────────────────────────────────

def _normals(v0: np.ndarray, v1: np.ndarray, v2: np.ndarray) -> np.ndarray:
    """Unit normals for N triangles. v0/v1/v2 are (N,3) float32."""
    e1 = v1 - v0
    e2 = v2 - v0
    n  = np.cross(e1, e2)
    lng = np.linalg.norm(n, axis=1, keepdims=True)
    lng[lng < 1e-10] = 1.0
    return (n / lng).astype(np.float32)


def _verts(x: np.ndarray, y: np.ndarray, z: np.ndarray) -> np.ndarray:
    """Stack 1-D arrays into (N,3) float32."""
    return np.stack([x, y, z], axis=1).astype(np.float32)


# ── Draft angle (V-bit compatibility) ─────────────────────────────────────────

def _apply_draft_angle(
    arr: np.ndarray,
    draft_angle_deg: float,
    pixel_size_mm: float,
    effective_depth_mm: float,
) -> np.ndarray:
    """
    Expand raised features outward with sloped walls at `draft_angle_deg` from
    vertical, using grey-scale morphological dilation with a cone kernel.

    Physical meaning: a V-bit with half-angle = draft_angle_deg can follow the
    wall surface cleanly because no wall is steeper than the bit's cutting edge.

    Maths: for each pixel (y, x), compute
        output[y, x] = max over all (dy, dx) of  arr[y+dy, x+dx] − dist·slope
    where slope = pixel_size_mm / (tan(θ) · effective_depth_mm).
    """
    if draft_angle_deg <= 0:
        return arr

    try:
        from scipy.ndimage import grey_dilation
    except ImportError:
        logger.warning("scipy not installed — draft angle disabled")
        return arr

    tan_a = math.tan(math.radians(draft_angle_deg))
    # Normalised-height units that drop per pixel of distance
    slope = pixel_size_mm / (tan_a * effective_depth_mm)
    # Max radius: beyond this the cone contribution is ≤ 0
    max_r = min(int(1.0 / slope) + 2, 80)

    r = max_r
    yy, xx = np.mgrid[-r:r+1, -r:r+1]
    dists = np.sqrt(yy**2 + xx**2)

    # -inf outside the circle so those cells are never selected by max
    structure = np.full_like(dists, -np.inf, dtype=np.float64)
    inside = dists <= r
    structure[inside] = -dists[inside] * slope

    dilated = grey_dilation(arr.astype(np.float64), structure=structure)
    logger.info("Draft angle %.1f°: max_r=%d px, slope=%.4f/px", draft_angle_deg, max_r, slope)
    return np.clip(dilated, 0.0, 1.0)


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
    draft_angle: float,
) -> None:
    logger.info("Building STL (res=%d, scaleZ=%.2f, enhance=%.2f, cutBelow=%.2f, draft=%.1f°) …",
                resolution, scale_z, detail_enhance, replace_below, draft_angle)

    # ── Load & resize ────────────────────────────────────────────────────────
    img = Image.open(depth_path).convert("L")
    orig_w, orig_h = img.size
    aspect = orig_h / orig_w           # preserve portrait / landscape proportions

    target_w = resolution
    target_h = max(1, round(resolution * aspect))
    img = img.resize((target_w, target_h), Image.LANCZOS)

    # Derive physical height so the carving proportions match the image
    height_mm = width_mm * aspect

    logger.info("Heightmap %dx%d → %dx%d  (%.2f:1)  carving %.0f×%.0f mm",
                orig_w, orig_h, target_w, target_h, aspect, width_mm, height_mm)

    if detail_enhance > 0:
        img = ImageEnhance.Contrast(img).enhance(1.0 + detail_enhance * 3.0)

    # Light blur: reduces staircase noise while keeping fine detail for G-code
    img = img.filter(ImageFilter.GaussianBlur(radius=1.5))

    arr = np.array(img, dtype=np.float64) / 255.0

    # ── Background & gap processing ──────────────────────────────────────────
    arr = _flood_fill_background(arr, tolerance=0.10)
    if replace_below > 0:
        arr[arr < replace_below] = 0.0
    arr = _close_subject_gaps(arr, radius=5)

    # Flip vertically so image top → STL Y=height_mm → world Z=-height_mm (far side).
    # Without this, row 0 (image top) ends up at world Z=0 (near camera), making
    # the 3D view appear as a vertical flip / mirror of the original image.
    arr = np.flipud(arr)

    h, w = arr.shape

    # ── Height grid ──────────────────────────────────────────────────────────
    effective_depth = relief_depth_mm * max(scale_z, 0.01)

    # ── Draft angle for V-bit compatibility ──────────────────────────────────
    # Expand each raised feature outward with walls sloped at draft_angle° from
    # vertical. A V-bit with half-angle ≥ draft_angle can follow the wall in a
    # single pass without undercutting.
    if draft_angle > 0:
        pixel_size_mm = width_mm / w
        arr = _apply_draft_angle(arr, draft_angle, pixel_size_mm, effective_depth)
    zz = np.where(arr > 0, base_thickness_mm + arr * effective_depth, 0.0)

    xs = np.linspace(0.0, width_mm,  w, dtype=np.float32)
    ys = np.linspace(0.0, height_mm, h, dtype=np.float32)

    # ── Active-quad mask ─────────────────────────────────────────────────────
    mask   = arr > 0
    active = (
        mask[:-1, :-1] | mask[:-1, 1:]
        | mask[1:, :-1] | mask[1:, 1:]
    )
    active_ij = np.argwhere(active)          # (N, 2)
    N = len(active_ij)
    logger.info("Active quads: %d / %d", N, (h-1)*(w-1))

    i_idx = active_ij[:, 0]
    j_idx = active_ij[:, 1]

    # ── Corner coordinates (all vectorised, no Python loop) ──────────────────
    x0 = xs[j_idx];     x1 = xs[j_idx + 1]
    y0 = ys[i_idx];     y1 = ys[i_idx + 1]

    zf  = zz.astype(np.float32)
    z00 = zf[i_idx,     j_idx]
    z10 = zf[i_idx,     j_idx + 1]
    z01 = zf[i_idx + 1, j_idx]
    z11 = zf[i_idx + 1, j_idx + 1]
    zero = np.zeros(N, dtype=np.float32)

    # Top-surface vertices (N, 3)
    V00 = _verts(x0, y0, z00);  V10 = _verts(x1, y0, z10)
    V01 = _verts(x0, y1, z01);  V11 = _verts(x1, y1, z11)
    # Bottom-cap vertices (z = 0)
    B00 = _verts(x0, y0, zero); B10 = _verts(x1, y0, zero)
    B01 = _verts(x0, y1, zero); B11 = _verts(x1, y1, zero)

    batches: list[tuple] = []

    def add(n, a, b, c):
        batches.append((_normals(a, b, c) if n is None else n, a, b, c))

    # ── Top surface ───────────────────────────────────────────────────────────
    add(None, V00, V10, V01)
    add(None, V10, V11, V01)

    # ── Bottom cap ────────────────────────────────────────────────────────────
    dn = np.tile(np.float32([0, 0, -1]), (N, 1))
    add(dn,   B00, B01, B10)
    add(dn,   B10, B01, B11)

    # ── Silhouette walls (only exposed edges) ─────────────────────────────────
    def exposed(axis: int, side: int) -> np.ndarray:
        """Boolean (N,) — True where the neighbouring quad is absent."""
        idx  = i_idx if axis == 0 else j_idx
        size = h - 2  if axis == 0 else w - 2
        boundary = (idx == 0) if side < 0 else (idx == size)
        interior = ~boundary
        nb = idx - 1 if side < 0 else idx + 1
        nb_active = np.zeros(N, dtype=bool)
        if axis == 0:
            nb_active[interior] = active[nb[interior], j_idx[interior]]
        else:
            nb_active[interior] = active[i_idx[interior], nb[interior]]
        return boundary | ~nb_active

    def wall(mask, a, b, c):
        if mask.any():
            add(None, a[mask], b[mask], c[mask])

    # TOP wall   (row above missing → outward normal faces −y)
    ix = exposed(0, -1)
    wall(ix, B00, B10, V10); wall(ix, B00, V10, V00)

    # BOTTOM wall (row below missing → outward normal faces +y)
    ix = exposed(0, +1)
    wall(ix, B01, V01, B11); wall(ix, V01, V11, B11)

    # LEFT wall  (col left missing → outward normal faces −x)
    ix = exposed(1, -1)
    wall(ix, B00, V00, V01); wall(ix, B00, V01, B01)

    # RIGHT wall (col right missing → outward normal faces +x)
    ix = exposed(1, +1)
    wall(ix, B10, V11, V10); wall(ix, B10, B11, V11)

    _write_stl(batches, output_path)
    logger.info("STL → %s  (%d KB)",
                output_path, output_path.stat().st_size // 1024)


# ── Fast binary STL writer ────────────────────────────────────────────────────

_TRI_DTYPE = np.dtype([
    ('normal', '<f4', (3,)),
    ('v0',     '<f4', (3,)),
    ('v1',     '<f4', (3,)),
    ('v2',     '<f4', (3,)),
    ('attr',   '<u2'),
])


def _write_stl(batches: list[tuple], path: Path) -> None:
    """Concatenate all batches into one numpy array and write as binary STL."""
    total = sum(len(n) for n, *_ in batches)

    tris = np.zeros(total, dtype=_TRI_DTYPE)
    offset = 0
    for normals, v0, v1, v2 in batches:
        m = len(normals)
        tris['normal'][offset:offset+m] = normals
        tris['v0'][offset:offset+m]     = v0
        tris['v1'][offset:offset+m]     = v1
        tris['v2'][offset:offset+m]     = v2
        offset += m

    with open(path, 'wb') as f:
        f.write(b'\x00' * 80)
        f.write(struct.pack('<I', total))
        tris.tofile(f)
    logger.info("Wrote %d triangles", total)
