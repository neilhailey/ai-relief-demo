import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MATERIAL_PRESETS, type MaterialPreset } from './materialPresets'
export type { MaterialPreset, MaterialCategory } from './materialPresets'
export { MATERIAL_PRESETS, CATEGORY_LABELS } from './materialPresets'

export type CameraPreset = 'iso' | 'top' | 'front' | 'right'

interface Props {
  url: string
  scaleZ?: number           // live depth multiplier — applied without reloading STL
  relief?: boolean          // true = apply -π/2 X-rotation for flat bas-reliefs; false = full 3D model (default)
  materialPreset?: MaterialPreset
  onReady?: (goToPreset: (preset: CameraPreset) => void) => void
  onLoadStart?: () => void
  onLoadEnd?: () => void
  onLoadError?: (err: string) => void
}

export function StlViewer({ url, scaleZ = 1, relief = false, materialPreset, onReady, onLoadStart, onLoadEnd, onLoadError }: Props) {
  const mountRef     = useRef<HTMLDivElement>(null)
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef     = useRef<THREE.Scene | null>(null)
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null)
  const controlRef   = useRef<OrbitControls | null>(null)
  const meshRef      = useRef<THREE.Mesh | null>(null)
  const planeRef     = useRef<THREE.Mesh | null>(null)
  const sizeRef      = useRef(new THREE.Vector3())
  const firstLoadRef = useRef(true)
  const targetYRef   = useRef(0)
  // Light refs for per-material dynamic adjustment
  const keyLightRef  = useRef<THREE.DirectionalLight | null>(null)
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null)
  const rimLightRef  = useRef<THREE.DirectionalLight | null>(null)

  // Stable refs so closures always read the latest callback / scaleZ / relief
  const onReadyRef     = useRef(onReady)
  const onLoadStartRef = useRef(onLoadStart)
  const onLoadEndRef   = useRef(onLoadEnd)
  const onLoadErrorRef = useRef(onLoadError)
  const scaleZRef          = useRef(scaleZ)
  const reliefRef          = useRef(relief)
  const materialPresetRef  = useRef<MaterialPreset>(materialPreset ?? MATERIAL_PRESETS[0])
  useEffect(() => { onReadyRef.current     = onReady     }, [onReady])
  useEffect(() => { onLoadStartRef.current = onLoadStart }, [onLoadStart])
  useEffect(() => { onLoadEndRef.current   = onLoadEnd   }, [onLoadEnd])
  useEffect(() => { onLoadErrorRef.current = onLoadError }, [onLoadError])
  useEffect(() => { scaleZRef.current      = scaleZ      }, [scaleZ])
  useEffect(() => { reliefRef.current      = relief      }, [relief])
  useEffect(() => { materialPresetRef.current = materialPreset ?? MATERIAL_PRESETS[0] }, [materialPreset])

  // ── Live scaleZ update — no geometry reload needed ────────────────────────
  useEffect(() => {
    if (meshRef.current) meshRef.current.scale.z = scaleZ
  }, [scaleZ])

  // ── Live material update — swap material properties without reloading STL ─
  useEffect(() => {
    const mesh  = meshRef.current
    const scene = sceneRef.current
    if (!mesh || !scene) return
    const p   = materialPreset ?? MATERIAL_PRESETS[0]
    const mat = mesh.material as THREE.MeshPhysicalMaterial
    mat.color.setHex(p.color)
    mat.roughness          = p.roughness
    mat.metalness          = p.metalness
    mat.clearcoat          = p.clearcoat
    mat.clearcoatRoughness = p.clearcoatRoughness
    mat.envMapIntensity    = p.envMapIntensity
    mat.needsUpdate        = true

    // Tune lights per material category for more convincing looks
    const key  = keyLightRef.current
    const fill = fillLightRef.current
    const rim  = rimLightRef.current
    if (key && fill && rim) {
      if (p.category === 'metal') {
        key.intensity  = 2.8;  key.color.set(0xffffff)
        fill.intensity = 0.4;  fill.color.set(0xd8eaff)
        rim.intensity  = 0.9;  rim.color.set(0xffffff)
        scene.environmentIntensity = 2.0
      } else if (p.category === 'resin') {
        key.intensity  = 2.2;  key.color.set(0xfff8f0)
        fill.intensity = 0.5;  fill.color.set(0xddeeff)
        rim.intensity  = 0.6;  rim.color.set(0xffffff)
        scene.environmentIntensity = 1.8
      } else if (p.category === 'stone') {
        key.intensity  = 2.0;  key.color.set(0xfff4e0)
        fill.intensity = 0.6;  fill.color.set(0xd0d8f0)
        rim.intensity  = 0.3;  rim.color.set(0xffffff)
        scene.environmentIntensity = 0.8
      } else {
        // wood — warm, soft
        key.intensity  = 2.0;  key.color.set(0xffe8c8)
        fill.intensity = 0.5;  fill.color.set(0xd0c8b0)
        rim.intensity  = 0.25; rim.color.set(0xfff0d0)
        scene.environmentIntensity = 0.6
      }
    }
  }, [materialPreset])

  // ── Scene init (once on mount) ────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const W = mount.clientWidth  || 800
    const H = mount.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(W, H)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap
    renderer.toneMapping       = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.4
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0d1117)
    sceneRef.current = scene

    // PMREM environment — provides IBL reflections for metals and clearcoat
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 1.5
    pmrem.dispose()

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 10000)
    cameraRef.current = camera

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))

    const key = new THREE.DirectionalLight(0xfff4e8, 2.2)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.bias = -0.0005
    scene.add(key)
    keyLightRef.current = key

    const fill = new THREE.DirectionalLight(0xd0e8ff, 0.55)
    scene.add(fill)
    fillLightRef.current = fill

    const rim = new THREE.DirectionalLight(0xffffff, 0.45)
    scene.add(rim)
    rimLightRef.current = rim

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping  = true
    controls.dampingFactor  = 0.06
    controls.autoRotate     = true
    controls.autoRotateSpeed = 1.0   // ~0.5 RPM — slow turntable
    controlRef.current = controls

    // Pause rotation while the user is dragging; resume 2 s after release.
    let resumeTimer: ReturnType<typeof setTimeout> | null = null
    function onPointerDown() {
      controls.autoRotate = false
      if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null }
    }
    function onPointerUp() {
      if (resumeTimer) clearTimeout(resumeTimer)
      resumeTimer = setTimeout(() => { controls.autoRotate = true }, 2000)
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup',   onPointerUp)

    let raf: number
    function animate() {
      raf = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    function onResize() {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup',   onPointerUp)
      if (resumeTimer) clearTimeout(resumeTimer)
      controls.dispose()
      renderer.dispose()
      if (mount && renderer.domElement.parentNode === mount)
        mount.removeChild(renderer.domElement)
      rendererRef.current  = null
      sceneRef.current     = null
      cameraRef.current    = null
      controlRef.current   = null
      firstLoadRef.current = true
    }
  }, [])

  // ── Geometry reload when URL changes ─────────────────────────────────────
  useEffect(() => {
    const scene    = sceneRef.current
    const camera   = cameraRef.current
    const controls = controlRef.current
    if (!scene || !camera || !controls) return

    // Non-null aliases so nested functions don't see nullable types
    const cam  = camera
    const ctrl = controls

    onLoadStartRef.current?.()

    const loader = new STLLoader()
    loader.load(
      url,
      (geometry) => {
        // 1. Centre the geometry
        geometry.computeBoundingBox()
        const bbox = geometry.boundingBox!
        const center = new THREE.Vector3()
        bbox.getCenter(center)
        geometry.translate(-center.x, -center.y, -center.z)

        // 2. Normalise vertex positions to a ~100-unit world
        //    Done directly on the vertex buffer so mesh.scale stays at 1,
        //    avoiding any scale×rotation interaction that produces wrong sizes.
        const rawSize = new THREE.Vector3()
        bbox.getSize(rawSize)
        const maxRaw = Math.max(rawSize.x, rawSize.y, rawSize.z)
        const TARGET = 100
        const ns = maxRaw > 0 ? TARGET / maxRaw : 1   // normalise scale
        geometry.scale(ns, ns, ns)

        // 3. Recompute bbox after normalisation to get accurate world sizes
        geometry.computeBoundingBox()
        const normBbox = geometry.boundingBox!
        const normSize = new THREE.Vector3()
        normBbox.getSize(normSize)
        sizeRef.current = normSize   // used by goToPreset (geometry space = ~100 units)

        // 4. Build mesh — scale is (1, 1, scaleZ) only; no normalisation factor needed
        const p = materialPresetRef.current
        const material = new THREE.MeshPhysicalMaterial({
          color:              p.color,
          roughness:          p.roughness,
          metalness:          p.metalness,
          clearcoat:          p.clearcoat,
          clearcoatRoughness: p.clearcoatRoughness,
          envMapIntensity:    p.envMapIntensity,
          side:               THREE.DoubleSide,
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow    = true
        mesh.receiveShadow = true
        // Bas-reliefs are built flat in the XY plane; -π/2 around X tilts the face upward.
        // Full 3D models from trimesh/GLB are already Y-up — no rotation needed.
        if (relief) mesh.rotation.x = -Math.PI / 2
        mesh.scale.z       = scaleZRef.current

        // 5. Atomic swap
        if (meshRef.current) {
          scene.remove(meshRef.current)
          meshRef.current.geometry.dispose()
          ;(meshRef.current.material as THREE.Material).dispose()
        }
        if (planeRef.current) { scene.remove(planeRef.current); planeRef.current = null }

        scene.add(mesh)
        meshRef.current = mesh

        // Compute the true world-space Y centre of the mesh (after rotation/scale) so
        // the orbit target is exactly at the model's mid-point, not assumed to be at Y=0.
        const worldBox = new THREE.Box3().setFromObject(mesh)
        const worldCenter = new THREE.Vector3()
        worldBox.getCenter(worldCenter)
        targetYRef.current = worldCenter.y
        ctrl.target.set(0, worldCenter.y, 0)

        // 6. Shadow plane — position below the model in world space.
        //    Relief: after rotation.x = -PI/2, geometry-Z → world-Y, so bottom = -normSize.z/2.
        //    3D model: no rotation, geometry-Y is already world-Y, so bottom = -normSize.y/2.
        const groundY = relief ? -normSize.z / 2 - 2 : -normSize.y / 2 - 2
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(TARGET * 8, TARGET * 8),
          new THREE.ShadowMaterial({ opacity: 0.2 }),
        )
        plane.rotation.x    = -Math.PI / 2
        plane.position.y    = groundY
        plane.receiveShadow = true
        scene.add(plane)
        planeRef.current = plane

        // 7. Camera, fog, lights — all scaled to the normalised ~100-unit world
        const maxDim = TARGET   // always ~100 after normalisation

        cam.near = maxDim * 0.002   //  0.2 — can get very close
        cam.far  = maxDim * 200     // 20000 — can zoom far out
        cam.updateProjectionMatrix()

        scene.fog = new THREE.Fog(0x0d1117, maxDim * 12, maxDim * 25)

        const d = maxDim * 1.6   // 160 — light/camera reference distance
        const key  = scene.children.find(c => c instanceof THREE.DirectionalLight && (c as THREE.DirectionalLight).castShadow) as THREE.DirectionalLight
        const fill = scene.children.filter(c => c instanceof THREE.DirectionalLight && !(c as THREE.DirectionalLight).castShadow)[0] as THREE.DirectionalLight
        const rim  = scene.children.filter(c => c instanceof THREE.DirectionalLight && !(c as THREE.DirectionalLight).castShadow)[1] as THREE.DirectionalLight
        if (key)  key.position.set( d * 0.5,  d,      d * 0.4)
        if (fill) fill.position.set(-d,        d * 0.5, d * 0.3)
        if (rim)  rim.position.set(  0,       -d * 0.6,-d * 0.5)

        ctrl.minDistance = maxDim * 0.05   //   5 — very close zoom
        ctrl.maxDistance = maxDim * 20     // 2000 — very far zoom

        // 8. Camera preset helper
        function goToPreset(preset: CameraPreset) {
          const sz   = sizeRef.current
          const dist = Math.max(sz.x, sz.y, sz.z) * 1.8   // ~180 units for 100-unit model
          const isRelief = reliefRef.current
          const ty   = targetYRef.current   // world Y of orbit centre (model mid-point)
          switch (preset) {
            // Relief: steep top-down ISO to show the carved surface.
            // 3D model: shallower angle (30° elevation) so the full object is visible.
            case 'iso':
              if (isRelief) cam.position.set(dist * 0.55, ty + dist * 0.75, dist * 0.60)
              else          cam.position.set(dist * 0.80, ty + dist * 0.45, dist * 0.80)
              break
            case 'top':   cam.position.set( 0,           ty + dist * 1.4,  0.001);       break
            case 'front': cam.position.set( 0,           ty + dist * 0.15, dist * 1.1);  break
            case 'right': cam.position.set( dist * 1.1,  ty + dist * 0.15, 0);           break
          }
          cam.lookAt(0, ty, 0)
          ctrl.target.set(0, ty, 0)
          ctrl.update()
        }

        if (firstLoadRef.current) {
          firstLoadRef.current = false
          goToPreset('iso')
        }

        onReadyRef.current?.(goToPreset)
        onLoadEndRef.current?.()
      },
      undefined,
      (err) => {
        const msg = err instanceof Error ? err.message : String(err)
        onLoadErrorRef.current?.(msg || 'Failed to load STL')
      },
    )
  }, [url])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
