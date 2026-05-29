import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type CameraPreset = 'iso' | 'top' | 'front' | 'right'

interface Props {
  url: string
  onReady?: (goToPreset: (preset: CameraPreset) => void) => void
  onLoadStart?: () => void
  onLoadEnd?: () => void
  onLoadError?: (err: string) => void
}

export function GlbViewer({ url, onReady, onLoadStart, onLoadEnd, onLoadError }: Props) {
  const mountRef     = useRef<HTMLDivElement>(null)
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef     = useRef<THREE.Scene | null>(null)
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null)
  const controlRef   = useRef<OrbitControls | null>(null)
  const modelRef     = useRef<THREE.Object3D | null>(null)
  const sizeRef      = useRef(new THREE.Vector3())
  const firstLoadRef = useRef(true)

  // Stable refs so closures always see the latest callbacks
  const onReadyRef     = useRef(onReady)
  const onLoadStartRef = useRef(onLoadStart)
  const onLoadEndRef   = useRef(onLoadEnd)
  const onLoadErrorRef = useRef(onLoadError)
  useEffect(() => { onReadyRef.current     = onReady     }, [onReady])
  useEffect(() => { onLoadStartRef.current = onLoadStart }, [onLoadStart])
  useEffect(() => { onLoadEndRef.current   = onLoadEnd   }, [onLoadEnd])
  useEffect(() => { onLoadErrorRef.current = onLoadError }, [onLoadError])

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

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 10000)
    cameraRef.current = camera

    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const key = new THREE.DirectionalLight(0xfff3e0, 1.6)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x6ea8fe, 0.4)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 0.2)
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

  // ── Load GLB when URL changes ─────────────────────────────────────────────
  useEffect(() => {
    const scene    = sceneRef.current
    const camera   = cameraRef.current
    const controls = controlRef.current
    if (!scene || !camera || !controls || !url) return

    // Non-null aliases for nested closures
    const cam  = camera
    const ctrl = controls

    onLoadStartRef.current?.()

    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        // ── Remove previous model ─────────────────────────────────────────
        if (modelRef.current) {
          scene.remove(modelRef.current)
          modelRef.current.traverse(obj => {
            const mesh = obj as THREE.Mesh
            if (mesh.geometry) mesh.geometry.dispose()
            if (mesh.material) {
              if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose())
              else mesh.material.dispose()
            }
          })
          modelRef.current = null
        }

        const model = gltf.scene

        // ── Replace materials with bronze Phong (consistent look, no textures needed) ──
        const material = new THREE.MeshPhongMaterial({
          color:     0xc8922a,
          specular:  0x3a2010,
          shininess: 22,
          side: THREE.DoubleSide,
        })
        model.traverse(obj => {
          const mesh = obj as THREE.Mesh
          if (mesh.isMesh) {
            mesh.material      = material
            mesh.castShadow    = true
            mesh.receiveShadow = true
          }
        })

        // ── Centre and normalise to ~100-unit world ───────────────────────
        const bbox = new THREE.Box3().setFromObject(model)
        const center = new THREE.Vector3()
        bbox.getCenter(center)
        // Translate so bounding-box centre is at origin
        model.position.sub(center)

        const rawSize = new THREE.Vector3()
        bbox.getSize(rawSize)
        const maxRaw = Math.max(rawSize.x, rawSize.y, rawSize.z)
        const TARGET = 100
        const ns = maxRaw > 0 ? TARGET / maxRaw : 1
        model.scale.setScalar(ns)

        // Store the normalised size for goToPreset distance calculations
        sizeRef.current = rawSize.clone().multiplyScalar(ns)

        scene.add(model)
        modelRef.current = model

        // ── Camera, fog, lights — all in the ~100-unit world ─────────────
        const maxDim = TARGET

        cam.near = maxDim * 0.002   //   ~0.2
        cam.far  = maxDim * 200     // ~20000
        cam.updateProjectionMatrix()

        scene.fog = new THREE.Fog(0x0d1117, maxDim * 12, maxDim * 25)

        const d = maxDim * 1.6
        const lights = scene.children.filter(c => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight[]
        if (lights[0]) lights[0].position.set( d * 0.5,  d,      d * 0.4)
        if (lights[1]) lights[1].position.set(-d,         d * 0.5, d * 0.3)
        if (lights[2]) lights[2].position.set( 0,        -d * 0.6,-d * 0.5)

        ctrl.minDistance = maxDim * 0.05
        ctrl.maxDistance = maxDim * 20

        // ── Camera preset helper ──────────────────────────────────────────
        function goToPreset(preset: CameraPreset) {
          const sz   = sizeRef.current
          const dist = Math.max(sz.x, sz.y, sz.z) * 1.8
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
        onLoadErrorRef.current?.(msg || 'Failed to load GLB')
      },
    )
  }, [url])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
