import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type CameraPreset = 'iso' | 'top' | 'front' | 'right'

interface Props {
  url: string
  /** Called after each geometry load; passes a goToPreset fn using the current mesh size. */
  onReady?: (goToPreset: (preset: CameraPreset) => void) => void
}

export function StlViewer({ url, onReady }: Props) {
  const mountRef     = useRef<HTMLDivElement>(null)
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef     = useRef<THREE.Scene | null>(null)
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null)
  const controlRef   = useRef<OrbitControls | null>(null)
  const meshRef      = useRef<THREE.Mesh | null>(null)
  const planeRef     = useRef<THREE.Mesh | null>(null)
  const sizeRef      = useRef(new THREE.Vector3())
  const firstLoadRef = useRef(true)
  // Keep onReady in a ref so the geometry effect never has it as a dependency
  const onReadyRef   = useRef(onReady)
  useEffect(() => { onReadyRef.current = onReady }, [onReady])

  // ── Scene init: runs ONCE on mount ────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const W = mount.clientWidth || 800
    const H = mount.clientHeight || 600

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(W, H)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0d1117)
    scene.fog = new THREE.Fog(0x0d1117, 300, 600)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 2000)
    cameraRef.current = camera

    // Lights
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

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.autoRotate    = false
    controls.minDistance   = 20
    controls.maxDistance   = 400
    controlRef.current = controls

    // Animation loop
    let raf: number
    function animate() {
      raf = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize handler
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
  }, [])   // ← empty deps: runs once

  // ── Geometry reload: runs when URL changes, KEEPS existing camera ─────────
  useEffect(() => {
    const scene    = sceneRef.current
    const camera   = cameraRef.current
    const controls = controlRef.current
    if (!scene || !camera || !controls) return

    // Remove previous mesh + shadow plane
    if (meshRef.current) {
      scene.remove(meshRef.current)
      meshRef.current.geometry.dispose()
      ;(meshRef.current.material as THREE.Material).dispose()
      meshRef.current = null
    }
    if (planeRef.current) {
      scene.remove(planeRef.current)
      planeRef.current = null
    }

    // Camera preset helper (uses latest size via sizeRef)
    function goToPreset(preset: CameraPreset) {
      const sz = sizeRef.current
      const d  = Math.max(sz.x, sz.y, sz.z) * 1.4
      switch (preset) {
        case 'iso':   camera.position.set( d * 0.6,  d * 0.9,  d * 0.7); break
        case 'top':   camera.position.set( 0,         d * 1.6,  0.001);   break
        case 'front': camera.position.set( 0,         d * 0.2, -d * 1.3); break
        case 'right': camera.position.set( d * 1.3,   d * 0.2,  0);       break
      }
      camera.lookAt(0, 0, 0)
      controls.target.set(0, 0, 0)
      controls.update()
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
      scene.add(mesh)
      meshRef.current = mesh

      // Shadow plane
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        new THREE.ShadowMaterial({ opacity: 0.25 }),
      )
      plane.rotation.x   = -Math.PI / 2
      plane.position.y   = -size.z / 2 - 1
      plane.receiveShadow = true
      scene.add(plane)
      planeRef.current = plane

      // Only auto-position camera on the VERY FIRST load
      if (firstLoadRef.current) {
        firstLoadRef.current = false
        goToPreset('iso')
      }

      // Always expose updated preset fn (size may have changed)
      onReadyRef.current?.(goToPreset)
    })
  }, [url])   // ← only url: camera survives slider-driven URL changes

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
