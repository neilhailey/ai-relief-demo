"""
Standalone GLB → STL converter.
Run as a subprocess: python convert_glb.py <glb_path> <stl_path> [max_faces]

Importing trimesh only in this subprocess so the main FastAPI process
never accumulates the ~200 MB trimesh memory footprint.
"""
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    if len(sys.argv) < 3:
        print("usage: python convert_glb.py <glb_path> <stl_path> [max_faces]", file=sys.stderr)
        sys.exit(1)

    glb_path  = sys.argv[1]
    stl_path  = sys.argv[2]
    max_faces = int(sys.argv[3]) if len(sys.argv) > 3 else 200_000  # generous limit

    import trimesh

    loaded = trimesh.load(glb_path, force="mesh")

    if isinstance(loaded, trimesh.Scene):
        meshes = [g for g in loaded.geometry.values() if hasattr(g, "faces") and len(g.faces)]
        if not meshes:
            print("GLB contains no mesh geometry", file=sys.stderr)
            sys.exit(2)
        combined = trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0]
    elif isinstance(loaded, trimesh.Trimesh):
        combined = loaded
    else:
        print(f"Unexpected trimesh type: {type(loaded)}", file=sys.stderr)
        sys.exit(2)

    if not len(combined.faces):
        print("Mesh has no faces after loading", file=sys.stderr)
        sys.exit(2)

    if len(combined.faces) > max_faces:
        logger.info("Decimating %d → %d faces…", len(combined.faces), max_faces)
        try:
            result = combined.simplify_quadric_decimation(max_faces)
            if result is not None and hasattr(result, 'faces') and len(result.faces) > 0:
                combined = result
                logger.info("Decimated to %d faces", len(combined.faces))
            else:
                raise RuntimeError("Empty result from decimation")
        except Exception as exc:
            # simplify_quadric_decimation can fail on non-manifold or complex meshes.
            # Exporting the full mesh is fine — STL for 300k faces ≈ 15 MB.
            logger.warning(
                "Quadric decimation failed (%s) — exporting full mesh (%d faces)",
                exc, len(combined.faces),
            )

    combined.export(stl_path)
    logger.info("STL written: %s  (%d faces)", stl_path, len(combined.faces))


if __name__ == "__main__":
    main()
