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
function fbm(x: number, y: number, oct = 4) {
  let v=0, a=0.5, s=0
  for (let i=0; i<oct; i++) { v += noise(x,y)*a; s+=a; x*=2; y*=2; a*=0.5 }
  return v/s
}

// ── Canvas / texture helpers ──────────────────────────────────────────────────

const SZ = 512

function mkTex(pixels: Uint8ClampedArray) {
  const c = document.createElement('canvas'); c.width = c.height = SZ
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(SZ, SZ); img.data.set(pixels); ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
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
// Generates ~6 grain ring bands across the texture.
// With mapRepeat=1, that becomes 6 rings across the full model — natural scale.
// Colors are very close together so grain reads as subtle shading, not banding.

function genWood(
  base: [number,number,number],
  dark: [number,number,number],
  freq: number,
  waviness: number
): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const diff = new Uint8ClampedArray(SZ*SZ*4)
  const hmap = new Uint8ClampedArray(SZ*SZ*4)
  for (let y=0; y<SZ; y++) for (let x=0; x<SZ; x++) {
    const nx = x/SZ * 5
    const ny = y/SZ * 5   // maps 0→5 → freq rings per tile
    // Gentle fbm distortion for organic waviness
    const distortion = fbm(nx*0.5, ny*0.5, 4) * waviness
    const ring = fract(ny * freq + distortion)
    // Latewood band: narrow dark stripe at 70-88% of each ring, sharp dropoff at edge
    const lw = ss(0.70, 0.88, ring) - ss(0.88, 1.00, ring)
    // Very subtle longitudinal pore lines (much finer scale, very low amplitude)
    const pore = noise(nx * 0.6, ny * 12) * 0.04
    const t = clamp(lw * 0.85 + pore)
    const i = (y*SZ+x)*4
    diff[i]  = Math.round(base[0] + (dark[0]-base[0]) * t)
    diff[i+1]= Math.round(base[1] + (dark[1]-base[1]) * t)
    diff[i+2]= Math.round(base[2] + (dark[2]-base[2]) * t)
    diff[i+3]= 255
    // Heightmap: latewood sits slightly lower than earlywood on a planed surface
    const ht = Math.round((1 - t * 0.4) * 255)
    hmap[i]=ht; hmap[i+1]=ht; hmap[i+2]=ht; hmap[i+3]=255
  }
  return { map: mkTex(diff), normalMap: mkTex(normalFromHeight(hmap, 1.0)) }
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
    const nx = x/SZ * 4, ny = y/SZ * 4
    const turb = fbm(nx, ny, 5) * 2 - 1
    const v1 = Math.abs(Math.sin(nx*2 + ny*3.5 + turb*6))
    const v2 = Math.abs(Math.sin(nx*4.5 - ny*2 + turb*3.5 + 2.3))
    const t1 = ss(0.88, 1.0, v1)
    const t2 = ss(0.91, 1.0, v2) * 0.4
    const cloud = (fbm(nx*1.2, ny*1.2, 3) - 0.5) * 14
    let r = mix(base[0]+cloud, vein[0], t1)
    let g = mix(base[1]+cloud, vein[1], t1)
    let b = mix(base[2]+cloud, vein[2], t1)
    r = mix(r, vein2[0], t2); g = mix(g, vein2[1], t2); b = mix(b, vein2[2], t2)
    const i = (y*SZ+x)*4
    diff[i]=clamp(r,0,255); diff[i+1]=clamp(g,0,255); diff[i+2]=clamp(b,0,255); diff[i+3]=255
    const ht = Math.round((1 - t1*0.4 - t2*0.15) * 255)
    hmap[i]=ht; hmap[i+1]=ht; hmap[i+2]=ht; hmap[i+3]=255
  }
  return { map: mkTex(diff), normalMap: mkTex(normalFromHeight(hmap, 0.8)) }
}

// ── Metal ─────────────────────────────────────────────────────────────────────

function genMetal(base: [number,number,number]): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const diff = new Uint8ClampedArray(SZ*SZ*4)
  const hmap = new Uint8ClampedArray(SZ*SZ*4)
  for (let y=0; y<SZ; y++) for (let x=0; x<SZ; x++) {
    const nx = x/SZ * 16, ny = y/SZ * 16
    const brush = noise(nx*0.06, ny*10) * 0.09   // directional brushed streaks
    const undulation = fbm(nx*0.25, ny*0.25, 3) * 0.05
    const pit = ss(0.80, 1.0, noise(nx*0.5, ny*0.5)) * 0.04
    const v = brush + undulation - pit - 0.07
    const i = (y*SZ+x)*4
    diff[i]  =clamp(base[0]+v*180, 0,255)
    diff[i+1]=clamp(base[1]+v*180, 0,255)
    diff[i+2]=clamp(base[2]+v*180, 0,255)
    diff[i+3]=255
    const ht = Math.round((brush*0.35 + 0.65) * 255)
    hmap[i]=ht; hmap[i+1]=ht; hmap[i+2]=ht; hmap[i+3]=255
  }
  return { map: mkTex(diff), normalMap: mkTex(normalFromHeight(hmap, 0.5)) }
}

// ── Concrete ──────────────────────────────────────────────────────────────────

function genConcrete(base: [number,number,number]): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const diff = new Uint8ClampedArray(SZ*SZ*4)
  const hmap = new Uint8ClampedArray(SZ*SZ*4)
  for (let y=0; y<SZ; y++) for (let x=0; x<SZ; x++) {
    const nx = x/SZ * 8, ny = y/SZ * 8
    const agg = fbm(nx*0.6, ny*0.6, 4)
    const fine = noise(nx*3, ny*3)*0.2 + noise(nx*5, ny*5)*0.08
    const pits = ss(0.84, 1.0, noise(nx*0.8, ny*0.8)) * 0.22
    const t = agg*0.45 + fine*0.35 - pits
    const i = (y*SZ+x)*4
    diff[i]  =clamp(base[0]+t*35-12, 0,255)
    diff[i+1]=clamp(base[1]+t*35-12, 0,255)
    diff[i+2]=clamp(base[2]+t*32-10, 0,255)
    diff[i+3]=255
    const ht = Math.round(clamp(t*0.7+0.15)*255)
    hmap[i]=ht; hmap[i+1]=ht; hmap[i+2]=ht; hmap[i+3]=255
  }
  return { map: mkTex(diff), normalMap: mkTex(normalFromHeight(hmap, 2.0)) }
}

// ── Terracotta ────────────────────────────────────────────────────────────────

function genTerracotta(base: [number,number,number]): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const diff = new Uint8ClampedArray(SZ*SZ*4)
  const hmap = new Uint8ClampedArray(SZ*SZ*4)
  for (let y=0; y<SZ; y++) for (let x=0; x<SZ; x++) {
    const nx = x/SZ * 7, ny = y/SZ * 7
    const grain = fbm(nx, ny, 5)
    const fine  = noise(nx*4, ny*4)*0.14 + noise(nx*8, ny*8)*0.06
    const color = fbm(nx*0.4, ny*0.4, 3)
    const t = grain*0.45 + fine
    const c = (color - 0.5)*18
    const i = (y*SZ+x)*4
    diff[i]  =clamp(base[0]+t*22-6+c, 0,255)
    diff[i+1]=clamp(base[1]+t*16-4+c*0.6, 0,255)
    diff[i+2]=clamp(base[2]+t*10-3+c*0.3, 0,255)
    diff[i+3]=255
    const ht = Math.round(clamp(t*0.6+0.2)*255)
    hmap[i]=ht; hmap[i+1]=ht; hmap[i+2]=ht; hmap[i+3]=255
  }
  return { map: mkTex(diff), normalMap: mkTex(normalFromHeight(hmap, 1.5)) }
}

// ── Resin ─────────────────────────────────────────────────────────────────────

function genResin(base: [number,number,number]): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const diff = new Uint8ClampedArray(SZ*SZ*4)
  const hmap = new Uint8ClampedArray(SZ*SZ*4)
  for (let y=0; y<SZ; y++) for (let x=0; x<SZ; x++) {
    const nx = x/SZ * 4, ny = y/SZ * 4
    const swirl = fbm(nx + Math.sin(ny)*0.7, ny + Math.cos(nx)*0.7, 4) - 0.5
    const bubble = ss(0.88, 1.0, noise(nx*3, ny*3)) * 0.03
    const v = swirl * 9 - bubble * 25
    const i = (y*SZ+x)*4
    diff[i]  =clamp(base[0]+v, 0,255)
    diff[i+1]=clamp(base[1]+v*0.8, 0,255)
    diff[i+2]=clamp(base[2]+v*0.6, 0,255)
    diff[i+3]=255
    const ht = Math.round((swirl*0.06+0.5)*255)
    hmap[i]=ht; hmap[i+1]=ht; hmap[i+2]=ht; hmap[i+3]=255
  }
  return { map: mkTex(diff), normalMap: mkTex(normalFromHeight(hmap, 0.3)) }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface TextureSet {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
  normalScale: number    // MeshPhysicalMaterial normalScale XY strength
  mapRepeat: number      // how many times texture tiles across the model
}

const cache = new Map<string, TextureSet>()

export function getTextures(preset: MaterialPreset): TextureSet {
  if (cache.has(preset.id)) return cache.get(preset.id)!

  let raw: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture }
  let normalScale: number
  let mapRepeat: number

  switch (preset.id) {
    // ── Wood: mapRepeat=1 → grain tiles once across the model (5-6 rings visible)
    //    Colors differ by only ~18-22 RGB units — subtle planed-surface look
    case 'light-oak':
      raw = genWood([205,168,108],[184,148, 88], 1.1, 1.2)
      normalScale = 0.12; mapRepeat = 1; break
    case 'dark-walnut':
      raw = genWood([ 82, 48, 26],[ 64, 33, 14], 1.2, 1.4)
      normalScale = 0.10; mapRepeat = 1; break
    case 'red-cedar':
      raw = genWood([150, 74, 48],[128, 54, 30], 1.0, 1.1)
      normalScale = 0.10; mapRepeat = 1; break

    // ── Metal: directional micro-scratches, very subtle normal
    case 'brass':
      raw = genMetal([178,138, 50])
      normalScale = 0.25; mapRepeat = 3; break
    case 'silver':
      raw = genMetal([210,210,215])
      normalScale = 0.18; mapRepeat = 3; break
    case 'bronze':
      raw = genMetal([122, 76, 32])
      normalScale = 0.25; mapRepeat = 3; break

    // ── Stone
    case 'white-marble':
      raw = genMarble([245,242,238],[105, 95, 90],[165,155,150])
      normalScale = 0.35; mapRepeat = 2; break
    case 'concrete':
      raw = genConcrete([138,136,130])
      normalScale = 0.70; mapRepeat = 2; break
    case 'terracotta':
      raw = genTerracotta([182, 64, 46])
      normalScale = 0.50; mapRepeat = 2; break

    // ── Resin: nearly flat, clearcoat does the visual work
    case 'white-resin':
      raw = genResin([245,243,241])
      normalScale = 0.12; mapRepeat = 2; break
    case 'black-resin':
      raw = genResin([ 28, 28, 30])
      normalScale = 0.12; mapRepeat = 2; break
    case 'amber-resin':
      raw = genResin([195,120, 24])
      normalScale = 0.12; mapRepeat = 2; break

    default:
      raw = genWood([205,168,108],[184,148,88], 1.1, 1.2)
      normalScale = 0.12; mapRepeat = 1
  }

  const set: TextureSet = { ...raw, normalScale, mapRepeat }
  cache.set(preset.id, set)
  return set
}
