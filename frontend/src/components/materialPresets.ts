export type MaterialCategory = 'wood' | 'metal' | 'stone' | 'resin'

export interface MaterialPreset {
  id: string
  label: string
  category: MaterialCategory
  color: number
  roughness: number
  metalness: number
  clearcoat: number          // 0-1: lacquer/polish layer on top
  clearcoatRoughness: number // 0-1: glossiness of that layer
  envMapIntensity: number    // reflection strength (metals need 3-4×)
}

export const MATERIAL_PRESETS: MaterialPreset[] = [
  // ── Wood ──────────────────────────────────────────────────────────────────
  { id: 'light-oak',    label: 'Light Oak',    category: 'wood',
    color: 0xc89a50, roughness: 0.82, metalness: 0.0,
    clearcoat: 0.15, clearcoatRoughness: 0.50, envMapIntensity: 0.40 },

  { id: 'dark-walnut',  label: 'Dark Walnut',  category: 'wood',
    color: 0x3e1f0e, roughness: 0.88, metalness: 0.0,
    clearcoat: 0.10, clearcoatRoughness: 0.55, envMapIntensity: 0.30 },

  { id: 'red-cedar',    label: 'Red Cedar',    category: 'wood',
    color: 0x7a2e18, roughness: 0.80, metalness: 0.0,
    clearcoat: 0.12, clearcoatRoughness: 0.45, envMapIntensity: 0.35 },

  // ── Metal ─────────────────────────────────────────────────────────────────
  { id: 'brass',        label: 'Brass',        category: 'metal',
    color: 0xb08030, roughness: 0.22, metalness: 0.95,
    clearcoat: 0.0,  clearcoatRoughness: 0.0,  envMapIntensity: 3.50 },

  { id: 'silver',       label: 'Silver',       category: 'metal',
    color: 0xd0d0d8, roughness: 0.08, metalness: 1.00,
    clearcoat: 0.0,  clearcoatRoughness: 0.0,  envMapIntensity: 4.50 },

  { id: 'bronze',       label: 'Bronze',       category: 'metal',
    color: 0x7a4c20, roughness: 0.32, metalness: 0.92,
    clearcoat: 0.0,  clearcoatRoughness: 0.0,  envMapIntensity: 2.80 },

  // ── Stone ─────────────────────────────────────────────────────────────────
  { id: 'white-marble', label: 'White Marble', category: 'stone',
    color: 0xf0ece8, roughness: 0.18, metalness: 0.02,
    clearcoat: 0.30, clearcoatRoughness: 0.04, envMapIntensity: 0.90 },

  { id: 'concrete',     label: 'Concrete',     category: 'stone',
    color: 0x888880, roughness: 0.95, metalness: 0.0,
    clearcoat: 0.0,  clearcoatRoughness: 0.0,  envMapIntensity: 0.10 },

  { id: 'terracotta',   label: 'Terracotta',   category: 'stone',
    color: 0xb84030, roughness: 0.88, metalness: 0.0,
    clearcoat: 0.0,  clearcoatRoughness: 0.0,  envMapIntensity: 0.15 },

  // ── Resin / Plastic ───────────────────────────────────────────────────────
  { id: 'white-resin',  label: 'White Resin',  category: 'resin',
    color: 0xf2f0f0, roughness: 0.08, metalness: 0.0,
    clearcoat: 1.00, clearcoatRoughness: 0.02, envMapIntensity: 1.80 },

  { id: 'black-resin',  label: 'Black Resin',  category: 'resin',
    color: 0x181818, roughness: 0.06, metalness: 0.05,
    clearcoat: 1.00, clearcoatRoughness: 0.02, envMapIntensity: 2.20 },

  { id: 'amber-resin',  label: 'Amber Resin',  category: 'resin',
    color: 0xc07818, roughness: 0.08, metalness: 0.0,
    clearcoat: 0.90, clearcoatRoughness: 0.03, envMapIntensity: 1.90 },
]

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  wood:  'Wood',
  metal: 'Metal',
  stone: 'Stone',
  resin: 'Resin / Plastic',
}
