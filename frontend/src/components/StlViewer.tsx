import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type CameraPreset = 'iso' | 'top' | 'front' | 'right'

interface Props {
  url: string
  scaleZ?: number          // applied instantly as mesh.scale.z — no STL reload needed
  onReady?: (goToPreset: (preset: CameraPreset) => void) => void
  onLoadStart?: () => void // called when a new URL begins loading
  onLoadEnd?: () => void   // called when geometry is fully loaded
  onLoadError?: (err: string) => void  // called when the STL fails to load
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

  // Stable refs for callbacks and scaleZ so closures always read the latest value
  const onReadyRef      = useRef(onReady)
  const onLoadStartRef  = useRef(onLoadStart)
  const onLoadEndRef    = useRef(onLoadEnd)
  const onLoadErrorRef  = useRef(onLoadError)
  const scaleZRef       = useRef(scaleZ)
  useEffect(() => { onReadyRef.current     = onReady     }, [onReady])
  useEffect(() => { onLoadStartRef.current = onLoadStart }, [onLoadStart])
  useEffect(() => { onLoadEndRef.current   = onLoadEnd   }, [onLoadEnd])
  useEffect(() => { onLoadErrorRef.current = onLoadError }, [onLoadError])
  useEffect(() => { scaleZRef.current      = scaleZ      }, [scaleZ])

  // ── Instant scale update: no geometry reload required ─────────────────────
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.scale.z = scaleZ
    }
  }, [scaleZ])

  // ── Scene init: runs ONCE on mount ────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const W = mount.clientWidth || 800
    const H = mount.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(W, H)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0d1117)
    scene.fog = new THREE.Fog(0x0d1117, 300, 600)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 2000)
    cameraRef.current = camera

    scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    const key = new THREE.DirectionalLight(0xfff3e0, 1.5)
    key.position.set(60, 140, 60)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x3b82f6, 0.3)
    fill.position.set(-100, 60, 40)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 0.15)
    rim.position.set(0, -80, -60)
    scene.add(rim)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.autoRotate    = false
    // minDistance / maxDistance are set dynamically after the geometry loads
    // so they scale correctly regardless of the model's coordinate units.
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
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      if (mount && renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
      rendererRef.current  = null
      sceneRef.current     = null
      cameraRef.current    = null
      controlRef.current   = null
      firstLoadRef.current = true
    }
  }, [])

  // ── Geometry reload: runs when URL changes, KEEPS existing camera & mesh ──
  useEffect(() => {
    const scene    = sceneRef.current
    const camera   = cameraRef.current
    const controls = controlRef.current
    if (!scene || !camera || !controls) return

    onLoadStartRef.current?.()

    // Keep the OLD mesh visible while loading so the view never goes blank.
    // It will be swapped out atomically once the new geometry is ready.

    const cam  = camera
    const ctrl = controls
    function goToPreset(preset: CameraPreset) {
      const sz = sizeRef.current
      const d  = Math.max(sz.x, sz.y, sz.z) * 1.4
      switch (preset) {
        case 'iso':   cam.position.set( d * 0.6,  d * 0.9,  d * 0.7); break
        case 'top':   cam.position.set( 0,         d * 1.6,  0.001);   break
        case 'front': cam.position.set( 0,         d * 0.2,  d * 1.3); break
        case 'right': cam.position.set( d * 1.3,   d * 0.2,  0);       break
      }
      cam.lookAt(0, 0, 0)
      ctrl.target.set(0, 0, 0)
      ctrl.update()
    }

    const loader = new STLLoader()
    loader.load(url, (geometry) => {
      geometry.computeVertexNormals()
      geometry.computeBoundingBox()

      const bbox   = geometry.boundingBox!
      const center = new THREE.Vector3()
      bbox.getCenter(center)
      geometry.translate(-center.x, -center.y, -center.z)

      const size = new THREE.Vector3()
      bbox.getSize(size)
      sizeRef.current = size

      // Scale zoom limits to match this model's actual coordinate units.
      // Without this, a model with small coordinates gets pushed past minDistance
      // and appears tiny with no way to zoom in.
      const maxDim = Math.max(size.x, size.y, size.z)
      ctrl.minDistance = maxDim * 0.05
      ctrl.maxDistance = maxDim * 20

      const material = new THREE.MeshPhongMaterial({
        color:     0xc8922a,
        specular:  0x2a1a08,
        shininess: 18,
        side:      THREE.DoubleSide,
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow    = true
      mesh.receiveShadow = true
      mesh.rotation.x    = -Math.PI / 2
      mesh.scale.z       = scaleZRef.current   // apply current scale immediately

      // ── Atomic swap: remove old, add new ──────────────────────────────────
      if (meshRef.current) {
        scene.remove(meshRef.current)
        meshRef.current.geometry.dispose()
        ;(meshRef.current.material as THREE.Material).dispose()
      }
      if (planeRef.current) {
        scene.remove(planeRef.current)
        planeRef.current = null
      }

      scene.add(mesh)
      meshRef.current = mesh

      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        new THREE.ShadowMaterial({ opacity: 0.25 }),
      )
      plane.rotation.x    = -Math.PI / 2
      plane.position.y    = -size.z / 2 - 1
      plane.receiveShadow = true
      scene.add(plane)
      planeRef.current = plane

      if (firstLoadRef.current) {
        firstLoadRef.current = false
        goToPreset('iso')
      }

      onReadyRef.current?.(goToPreset)
      onLoadEndRef.current?.()
    },
    undefined,   // onProgress — not used
    (err) => {   // onError
      const msg = err instanceof Error ? err.message : String(err)
      onLoadErrorRef.current?.(msg || 'Failed to load STL')
    },
    )
  }, [url])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
