export type MaterialCategory = 'wood' | 'metal' | 'stone' | 'resin'

export interface MaterialPreset {
  id: string
  label: string
  category: MaterialCategory
  color: number
  roughness: number
  metalness: number
}

export const MATERIAL_PRESETS: MaterialPreset[] = [
  // Wood
  { id: 'light-oak',    label: 'Light Oak',    category: 'wood',  color: 0xc89a50, roughness: 0.85, metalness: 0.00 },
  { id: 'dark-walnut',  label: 'Dark Walnut',  category: 'wood',  color: 0x3e1f0e, roughness: 0.90, metalness: 0.00 },
  { id: 'red-cedar',    label: 'Red Cedar',    category: 'wood',  color: 0x7a2e18, roughness: 0.82, metalness: 0.00 },
  // Metal
  { id: 'brass',        label: 'Brass',        category: 'metal', color: 0xb5882a, roughness: 0.20, metalness: 0.95 },
  { id: 'silver',       label: 'Silver',       category: 'metal', color: 0xc8c8d0, roughness: 0.12, metalness: 0.98 },
  { id: 'bronze',       label: 'Bronze',       category: 'metal', color: 0x7a4c20, roughness: 0.30, metalness: 0.90 },
  // Stone
  { id: 'white-marble', label: 'White Marble', category: 'stone', color: 0xf0ece8, roughness: 0.22, metalness: 0.02 },
  { id: 'concrete',     label: 'Concrete',     category: 'stone', color: 0x888880, roughness: 0.80, metalness: 0.00 },
  { id: 'terracotta',   label: 'Terracotta',   category: 'stone', color: 0xb84030, roughness: 0.78, metalness: 0.00 },
  // Resin / Plastic
  { id: 'white-resin',  label: 'White Resin',  category: 'resin', color: 0xf2f0f0, roughness: 0.28, metalness: 0.00 },
  { id: 'black-resin',  label: 'Black Resin',  category: 'resin', color: 0x181818, roughness: 0.22, metalness: 0.05 },
  { id: 'amber-resin',  label: 'Amber Resin',  category: 'resin', color: 0xc07818, roughness: 0.18, metalness: 0.00 },
]

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  wood:  'Wood',
  metal: 'Metal',
  stone: 'Stone',
  resin: 'Resin / Plastic',
}
