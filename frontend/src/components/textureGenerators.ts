import * as THREE from 'three'
import type { MaterialPreset } from './materialPresets'

// ── Noise primitives ──────────────────────────────────────────────────────────

const fract = (x: number) => x - Math.floor(x)
const mix   = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
const ss    = (lo: number, hi: number, x: number) => { const t = clamp((x-lo)/(hi-lo)); return t*t*(3-2*t) }

function hash(x: number, y: number) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453)
}
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = fract(x),       fy = fract(y)
  const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy)
  return mix(mix(hash(ix,iy),hash(ix+1,iy),ux), mix(hash(ix,iy+1),hash(ix+1,iy+1),ux), uy)
}
function fbm(x: number, y: number, oct = 5) {
  let v=0, a=0.5, s=0
  for (let i=0; i<oct; i++) { v += noise(x,y)*a; s+=a; x*=2; y*=2; a*=0.5 }
  return v/s
}

// ── Canvas / texture helpers ──────────────────────────────────────────────────

const SZ = 512

function mkTex(pixels: Uint8ClampedArray, wrapS = THREE.RepeatWrapping, wrapT = THREE.RepeatWrapping) {
  const c = document.createElement('canvas'); c.width = c.height = SZ
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(SZ, SZ); img.data.set(pixels); ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c); t.wrapS = wrapS; t.wrapT = wrapT
  return t
}

function normalFromHeight(hp: Uint8ClampedArray, str: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(SZ*SZ*4)
  const h = (x: number, y: number) => hp[(((y+SZ)%SZ)*SZ + ((x+SZ)%SZ))*4] / 255
  for (let y=0; y<SZ; y++) for (let x=0; x<SZ; x++) {
    const dx = (h(x+1,y-1)+2*h(x+1,y)+h(x+1,y+1) - h(x-1,y-1)-2*h(x-1,y)-h(x-1,y+1)) * str
    const dy = (h(x-1,y+1)+2*h(x,y+1)+h(x+1,y+1) - h(x-1,y-1)-2*h(x,y-1)-h(x+1,y-1)) * str
    const len = Math.sqrt(dx*dx + dy*dy + 1)
    const i = (y*SZ+x)*4
    out[i]   = Math.round(clamp(-dx/len*0.5+0.5)*255)
    out[i+1] = Math.round(clamp(-dy/len*0.5+0.5)*255)
    out[i+2] = Math.round(clamp(1/len*0.5+0.5)*255)
    out[i+3] = 255
  }
  return out
}

// ── Wood ─────────────────────────────────────────────────────────────────────

function genWood(
  base: [number,number,number],
  dark: [number,number,number],
  freq: number, waviness: number
): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const diff = new Uint8ClampedArray(SZ*SZ*4)
  const hmap = new Uint8ClampedArray(SZ*SZ*4)
  for (let y=0; y<SZ; y++) for (let x=0; x<SZ; x++) {
    const nx = x/SZ * 10, ny = y/SZ * 10
    // Concentric growth rings distorted by fbm
    const distortion = fbm(nx*0.4, ny*0.4, 5) * waviness
    const ring = fract((ny * freq + distortion))
    // Ring shape: narrow dark bands in lighter background
    const ringBand = ss(0,0.12,ring) - ss(0.55,0.85,ring)
    // Fine longitudinal grain lines
    const fineGrain = noise(nx*0.4, ny*10) * 0.2 + noise(nx*0.8, ny*18)*0.1
    const t = clamp(ringBand * 0.8 + fineGrain)
    const i = (y*SZ+x)*4
    diff[i]  = base[0]+(dark[0]-base[0])*t
    diff[i+1]= base[1]+(dark[1]-base[1])*t
    diff[i+2]= base[2]+(dark[2]-base[2])*t
    diff[i+3]= 255
    const ht = Math.round((1 - t*0.65) * 255)
    hmap[i]=ht; hmap[i+1]=ht; hmap[i+2]=ht; hmap[i+3]=255
  }
  return { map: mkTex(diff), normalMap: mkTex(normalFromHeight(hmap, 3.5)) }
}

// ── Marble ────────────────────────────────────────────────────────────────────

function genMarble(
  base: [number,number,number],
  vein: [number,number,number],
  vein2: [number,number,number]
): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const diff = new Uint8ClampedArray(SZ*SZ*4)
  const hmap = new Uint8ClampedArray(SZ*SZ*4)
  for (let y=0; y<SZ; y++) for (let x=0; x<SZ; x++) {
    const nx = x/SZ * 5, ny = y/SZ * 5
    // Turbulence field
    const turb = fbm(nx, ny, 6) * 2 - 1
    // Primary veins: thin dark sinusoidal lines
    const v1 = Math.abs(Math.sin(nx*2 + ny*3.5 + turb*7))
    // Secondary veins
    const v2 = Math.abs(Math.sin(nx*5 - ny*2.5 + turb*4 + 2.3))
    const t1 = ss(0.90, 1.0, v1)
    const t2 = ss(0.92, 1.0, v2) * 0.45
    // Slight cloud-like variation in base
    const cloud = (fbm(nx*1.5, ny*1.5, 3) - 0.5) * 18
    let r = mix(base[0]+cloud, vein[0], t1)
    let g = mix(base[1]+cloud, vein[1], t1)
    let b = mix(base[2]+cloud, vein[2], t1)
    r = mix(r, vein2[0], t2); g = mix(g, vein2[1], t2); b = mix(b, vein2[2], t2)
    const i = (y*SZ+x)*4
    diff[i]=clamp(r,0,255); diff[i+1]=clamp(g,0,255); diff[i+2]=clamp(b,0,255); diff[i+3]=255
    const ht = Math.round((1 - t1*0.5 - t2*0.2) * 255)
    hmap[i]=ht; hmap[i+1]=ht; hmap[i+2]=ht; hmap[i+3]=255
  }
  return { map: mkTex(diff), normalMap: mkTex(normalFromHeight(hmap, 1.2)) }
}

// ── Metal ─────────────────────────────────────────────────────────────────────

function genMetal(base: [number,number,number]): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const diff = new Uint8ClampedArray(SZ*SZ*4)
  const hmap = new Uint8ClampedArray(SZ*SZ*4)
  for (let y=0; y<SZ; y++) for (let x=0; x<SZ; x++) {
    const nx = x/SZ * 20, ny = y/SZ * 20
    // Brushed/directional micro-scratches
    const brush = noise(nx*0.08, ny*12) * 0.12
    // Larger surface undulation
    const undulation = fbm(nx*0.3, ny*0.3, 3) * 0.06
    // Surface pitting/contamination
    const pit = ss(0.78, 1.0, noise(nx*0.6, ny*0.6)) * 0.05
    const v = (brush + undulation - pit - 0.09)
    const i = (y*SZ+x)*4
    diff[i]  =clamp(base[0]+v*200, 0,255)
    diff[i+1]=clamp(base[1]+v*200, 0,255)
    diff[i+2]=clamp(base[2]+v*200, 0,255)
    diff[i+3]=255
    const ht = Math.round((brush * 0.4 + 0.6) * 255)
    hmap[i]=ht; hmap[i+1]=ht; hmap[i+2]=ht; hmap[i+3]=255
  }
  return { map: mkTex(diff), normalMap: mkTex(normalFromHeight(hmap, 0.6)) }
}

// ── Concrete ──────────────────────────────────────────────────────────────────

function genConcrete(base: [number,number,number]): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const diff = new Uint8ClampedArray(SZ*SZ*4)
  const hmap = new Uint8ClampedArray(SZ*SZ*4)
  for (let y=0; y<SZ; y++) for (let x=0; x<SZ; x++) {
    const nx = x/SZ * 12, ny = y/SZ * 12
    // Large aggregate blobs
    const agg = fbm(nx*0.6, ny*0.6, 4)
    // Fine sand/cement texture
    const fine = noise(nx*3, ny*3)*0.3 + noise(nx*6, ny*6)*0.1
    // Occasional darker pits/holes
    const pits = ss(0.82, 1.0, noise(nx*0.9, ny*0.9)) * 0.35
    const t = agg*0.5 + fine*0.4 - pits
    const i = (y*SZ+x)*4
    diff[i]  =clamp(base[0]+t*50-20, 0,255)
    diff[i+1]=clamp(base[1]+t*50-20, 0,255)
    diff[i+2]=clamp(base[2]+t*45-18, 0,255)
    diff[i+3]=255
    const ht = Math.round(clamp(t*0.8+0.1)*255)
    hmap[i]=ht; hmap[i+1]=ht; hmap[i+2]=ht; hmap[i+3]=255
  }
  return { map: mkTex(diff), normalMap: mkTex(normalFromHeight(hmap, 5.0)) }
}

// ── Terracotta ────────────────────────────────────────────────────────────────

function genTerracotta(base: [number,number,number]): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const diff = new Uint8ClampedArray(SZ*SZ*4)
  const hmap = new Uint8ClampedArray(SZ*SZ*4)
  for (let y=0; y<SZ; y++) for (let x=0; x<SZ; x++) {
    const nx = x/SZ * 10, ny = y/SZ * 10
    // Sandy clay grain — irregular organic clumps
    const grain = fbm(nx, ny, 6)
    const fine  = noise(nx*5, ny*5)*0.18 + noise(nx*10, ny*10)*0.08
    // Slight firing color variation (darker/lighter patches)
    const color = fbm(nx*0.4, ny*0.4, 3)
    const t = grain*0.5 + fine
    const c = (color - 0.5)*25
    const i = (y*SZ+x)*4
    diff[i]  =clamp(base[0]+t*30-8+c, 0,255)
    diff[i+1]=clamp(base[1]+t*22-6+c*0.6, 0,255)
    diff[i+2]=clamp(base[2]+t*15-4+c*0.3, 0,255)
    diff[i+3]=255
    const ht = Math.round(clamp(t*0.7+0.15)*255)
    hmap[i]=ht; hmap[i+1]=ht; hmap[i+2]=ht; hmap[i+3]=255
  }
  return { map: mkTex(diff), normalMap: mkTex(normalFromHeight(hmap, 4.0)) }
}

// ── Resin ─────────────────────────────────────────────────────────────────────

function genResin(base: [number,number,number]): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const diff = new Uint8ClampedArray(SZ*SZ*4)
  const hmap = new Uint8ClampedArray(SZ*SZ*4)
  for (let y=0; y<SZ; y++) for (let x=0; x<SZ; x++) {
    const nx = x/SZ * 4, ny = y/SZ * 4
    // Subtle internal swirl / flow patterns
    const swirl = fbm(nx + Math.sin(ny)*0.8, ny + Math.cos(nx)*0.8, 4) - 0.5
    // Very subtle micro-bubbles
    const bubble = ss(0.88, 1.0, noise(nx*3, ny*3)) * 0.04
    const v = swirl * 12 - bubble * 30
    const i = (y*SZ+x)*4
    diff[i]  =clamp(base[0]+v, 0,255)
    diff[i+1]=clamp(base[1]+v*0.8, 0,255)
    diff[i+2]=clamp(base[2]+v*0.6, 0,255)
    diff[i+3]=255
    const ht = Math.round((swirl*0.08+0.5)*255)
    hmap[i]=ht; hmap[i+1]=ht; hmap[i+2]=ht; hmap[i+3]=255
  }
  return { map: mkTex(diff), normalMap: mkTex(normalFromHeight(hmap, 0.4)) }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface TextureSet {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
  normalScale: number    // strength of normal map
  mapRepeat: number      // texture tile count (how many times it repeats)
}

const cache = new Map<string, TextureSet>()

export function getTextures(preset: MaterialPreset): TextureSet {
  if (cache.has(preset.id)) return cache.get(preset.id)!

  let raw: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture }
  let normalScale: number
  let mapRepeat: number

  switch (preset.id) {
    case 'light-oak':
      raw = genWood([212,158, 80],[130, 72, 28], 1.8, 3.5)
      normalScale = 1.2; mapRepeat = 3; break
    case 'dark-walnut':
      raw = genWood([ 85, 45, 22],[ 38, 18,  8], 2.2, 4.0)
      normalScale = 1.0; mapRepeat = 3; break
    case 'red-cedar':
      raw = genWood([150, 70, 40],[ 90, 30, 15], 1.5, 3.0)
      normalScale = 1.0; mapRepeat = 3; break
    case 'brass':
      raw = genMetal([176,136, 48])
      normalScale = 0.4; mapRepeat = 4; break
    case 'silver':
      raw = genMetal([210,210,215])
      normalScale = 0.3; mapRepeat = 4; break
    case 'bronze':
      raw = genMetal([122, 76, 32])
      normalScale = 0.4; mapRepeat = 4; break
    case 'white-marble':
      raw = genMarble([245,242,238],[110,100, 95],[170,160,155])
      normalScale = 0.6; mapRepeat = 2; break
    case 'concrete':
      raw = genConcrete([138,136,130])
      normalScale = 2.0; mapRepeat = 3; break
    case 'terracotta':
      raw = genTerracotta([184, 64, 48])
      normalScale = 1.8; mapRepeat = 3; break
    case 'white-resin':
      raw = genResin([245,243,241])
      normalScale = 0.2; mapRepeat = 2; break
    case 'black-resin':
      raw = genResin([ 28, 28, 30])
      normalScale = 0.2; mapRepeat = 2; break
    case 'amber-resin':
      raw = genResin([195,120, 24])
      normalScale = 0.2; mapRepeat = 2; break
    default:
      raw = genWood([212,158,80],[130,72,28], 1.8, 3.5)
      normalScale = 1.2; mapRepeat = 3
  }

  const set: TextureSet = { ...raw, normalScale, mapRepeat }
  cache.set(preset.id, set)
  return set
}
