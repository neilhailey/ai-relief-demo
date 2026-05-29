import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type CameraPreset = 'iso' | 'top' | 'front' | 'right'

interface Props {
  url: string
  scaleZ?: number          // live depth multiplier — applied without reloading STL
  onReady?: (goToPreset: (preset: CameraPreset) => void) => void
  onLoadStart?: () => void
  onLoadEnd?: () => void
  onLoadError?: (err: string) => void
}

export function StlViewer({ url, scaleZ = 1, onReady, onLoadStart, onLoadEnd, onLoadError }: Props) {
  const mountRef     = useRef<HTMLDivElement>(null)
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef     = useRef<THREE.Scene | null>(null)
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null)
  const controlRef   = useRef<OrbitControls | null>(null)
  const meshRef      = useRef<THREE.Mesh | null>(null)
  const planeRef     = useRef<THREE.Mesh | null>(null)
  const sizeRef      = useRef(new THREE.Vector3())
  const firstLoadRef = useRef(true)

  // Stable refs so closures always read the latest callback / scaleZ
  const onReadyRef     = useRef(onReady)
  const onLoadStartRef = useRef(onLoadStart)
  const onLoadEndRef   = useRef(onLoadEnd)
  const onLoadErrorRef = useRef(onLoadError)
  const scaleZRef      = useRef(scaleZ)
  useEffect(() => { onReadyRef.current     = onReady     }, [onReady])
  useEffect(() => { onLoadStartRef.current = onLoadStart }, [onLoadStart])
  useEffect(() => { onLoadEndRef.current   = onLoadEnd   }, [onLoadEnd])
  useEffect(() => { onLoadErrorRef.current = onLoadError }, [onLoadError])
  useEffect(() => { scaleZRef.current      = scaleZ      }, [scaleZ])

  // ── Live scaleZ update — no geometry reload needed ────────────────────────
  useEffect(() => {
    if (meshRef.current) meshRef.current.scale.z = scaleZ
  }, [scaleZ])

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
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0d1117)
    sceneRef.current = scene

    // near/far are updated per-model after geometry loads
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 10000)
    cameraRef.current = camera

    scene.add(new THREE.AmbientLight(0xffffff, 0.4))
    const key = new THREE.DirectionalLight(0xfff3e0, 1.6)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x3b82f6, 0.3)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 0.15)
    scene.add(rim)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controlRef.current = controls

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
        const material = new THREE.MeshPhongMaterial({
          color: 0xc8922a, specular: 0x2a1a08, shininess: 18, side: THREE.DoubleSide,
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow    = true
        mesh.receiveShadow = true
        mesh.rotation.x    = -Math.PI / 2
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

        // 6. Shadow plane — position below the model in world space
        //    After rotation.x = -PI/2, geometry-Z maps to world-Y.
        //    The bottom of the model in world-Y = -normSize.z / 2.
        const groundY = -normSize.z / 2 - 2
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
          const sz = sizeRef.current
          const dist = Math.max(sz.x, sz.y, sz.z) * 1.8   // ~180 units for 100-unit model
          switch (preset) {
            case 'iso':   cam.position.set( dist * 0.55, dist * 0.75, dist * 0.60); break
            case 'top':   cam.position.set( 0,           dist * 1.4,  0.001);       break
            case 'front': cam.position.set( 0,           dist * 0.15, dist * 1.1);  break
            case 'right': cam.position.set( dist * 1.1,  dist * 0.15, 0);           break
          }
          cam.lookAt(0, 0, 0)
          ctrl.target.set(0, 0, 0)
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
