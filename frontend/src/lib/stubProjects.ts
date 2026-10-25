import type { ProjectCard, ProjectDetail, ProjectFilters, ProjectSort } from './projects'

// ─────────────────────────────────────────────────────────────────────────────
// Stub / seed projects. These render in the gallery and detail pages whenever
// the database has no published projects yet, so the community area is never
// empty during the demo. As soon as real projects are published they take over
// automatically (see loadProjects / loadProjectDetail fallbacks).
//
// To remove later: delete this file and the two `STUB_*` fallbacks in projects.ts.
// ─────────────────────────────────────────────────────────────────────────────

// AI-generated artwork of each project (public/project-*.png). Distinct from
// the AI-feature tab images. Swap for real user photos anytime.
const IMG = {
  clamp:  '/project-top-clamp.png',
  relief: '/project-wild-spirit.png',
  laser:  '/project-peak-cabin.png',
  rotary: '/project-marble-muse.png',
  badge:  '/project-maker-badge.png',
}

function base(id: string, over: Partial<ProjectDetail>): ProjectDetail {
  return {
    id,
    user_id:            'stub',
    name:               '',
    description:        '',
    category:           null,
    is_original:        true,
    remix_source:       null,
    license_adapt:      'yes',
    license_commercial: true,
    post_process:       null,
    pictures:           [],
    tags:               [],
    machines:           [],
    materials:          [],
    status:             'published',
    download_count:     0,
    created_at:         '2026-06-23T20:24:58Z',
    updated_at:         '2026-06-23T20:24:58Z',
    published_at:       '2026-06-23T20:24:58Z',
    files:              [],
    like_count:         0,
    is_liked:           false,
    is_saved:           false,
    author_name:        'WeCarver',
    views:              0,
    comments:           [],
    ...over,
  }
}

export const STUB_PROJECTS: ProjectDetail[] = [
  base('stub-top-clamp', {
    name:           'Top Clamp - 3D Feature',
    category:       'Workshop Tools',
    pictures:       [IMG.clamp],
    description:    '<p>Create a durable aluminum <b>Top Clamp</b> with your CNC machine and learn essential 3D-feature machining steps: step cutting, inner-slot machining, and outer-contour cutting. A practical accessory for securing material firmly to the workbed during future projects.</p><p>Light cutting marks may remain on the spoilboard after machining — this is normal, as the tool typically cuts ~0.3&nbsp;mm deeper to ensure a clean through-cut.</p>',
    post_process:   'Use the saw function of a multi-function screwdriver to cut the tabs and remove the Top Clamp. Deburr the edges with a file.',
    machines:       ['TTC 450 Ultra'],
    materials:      ['Aluminum'],
    tags:           ['clamp', 'workholding', 'aluminum'],
    download_count: 795,
    like_count:     17,
    views:          2500,
    comments:       [
      { author: 'immortal30',    when: '12 hours ago', text: 'Just received my machine — is there a beta program to run the CAM studio?', avatar_color: '#6366f1' },
      { author: 'Michel Loiseau', when: '4 days ago',  text: "I'm very satisfied with mine. It surfaced the jaws of my vise like butter. Can't wait to make more!", avatar_color: '#ec4899' },
    ],
    files: [{
      kind: 'nc', name: 'TopClamp.nc', url: '#', path: 'stub', size_bytes: 0,
      machining_time: '29min 10s', paths: 3, tool_count: 1, source: 'CAM Studio',
      machine: 'TTC 450 Ultra', material: '6061 Aluminum Plate — 100mm × 100mm × 5mm',
      tools: ['NO.1 · 3.175×12mm Flat End (Metal)'],
      nc_paths: [
        { name: '[T1] 3D Pocket',  tool: '3.175×12mm Flat End', note: 'Machine the steps' },
        { name: '[T1] 3D Contour', tool: '3.175×12mm Flat End', note: 'Machine the inner groove' },
        { name: '[T1] 2D Contour', tool: '3.175×12mm Flat End', note: 'Outer contour cut' },
      ],
    }],
  }),

  base('stub-wild-spirit', {
    name:           'Wild Spirit - 3D Relief',
    category:       'Art & Gifts',
    pictures:       [IMG.relief],
    description:    '<p>A highly detailed <b>3D relief</b> of a wolf, carved into a hardwood panel. A great introduction to fine 3D relief carving and finishing.</p>',
    post_process:   'Sand progressively from 120 to 320 grit. Apply two coats of Danish oil, buffing between coats.',
    machines:       ['TTC 6050'],
    materials:      ['Wood'],
    tags:           ['relief', 'wolf', 'art', 'wood'],
    download_count: 380,
    like_count:     7,
    views:          1400,
    files: [{
      kind: 'nc', name: 'WildSpirit.nc', url: '#', path: 'stub', size_bytes: 0,
      machining_time: '1h 42min', paths: 2, tool_count: 2, source: 'CAM Studio',
      machine: 'TTC 6050', material: 'Hardwood Panel — 150mm × 150mm × 20mm',
      tools: ['NO.1 · 6mm Flat End', 'NO.2 · 1.5mm Tapered Ball'],
      nc_paths: [
        { name: '[T1] 3D Roughing',  tool: '6mm Flat End',       note: 'Bulk material removal' },
        { name: '[T2] 3D Finishing', tool: '1.5mm Tapered Ball', note: 'Fine detail pass' },
      ],
    }],
  }),

  base('stub-peak-cabin', {
    name:           'Peak Cabin - Laser Image',
    category:       'Home & Living',
    pictures:       [IMG.laser],
    description:    '<p>A laser-engraved mountain cabin scene on a wooden coaster blank. Perfect for a first laser-image project.</p>',
    post_process:   'Wipe with a damp cloth to remove soot. Finish with a food-safe wax.',
    machines:       ['ED1'],
    materials:      ['Wood'],
    tags:           ['laser', 'engraving', 'landscape'],
    download_count: 126,
    like_count:     8,
    views:          640,
    files: [{
      kind: 'nc', name: 'PeakCabin.nc', url: '#', path: 'stub', size_bytes: 0,
      machining_time: '18min 30s', paths: 1, tool_count: 1, source: 'CAM Studio',
      machine: 'ED1', material: 'Basswood — 90mm × 90mm × 4mm',
      tools: ['Laser · 5W'],
      nc_paths: [{ name: '[L1] Raster Image', tool: 'Laser 5W', note: 'Grayscale engrave' }],
    }],
  }),

  base('stub-marble-muse', {
    name:           'Marble Muse - 4th Axis Relief',
    category:       'Art & Gifts',
    pictures:       [IMG.rotary],
    description:    '<p>A classical bust carved on the 4th axis — a rotary relief that wraps a full 360°. An advanced project showcasing rotary machining.</p>',
    post_process:   'Light sanding with 400 grit; leave matte for a stone-like finish.',
    machines:       ['TTC 450 Pro'],
    materials:      ['Composite'],
    tags:           ['4th-axis', 'rotary', 'bust', 'relief'],
    download_count: 410,
    like_count:     7,
    views:          1900,
    files: [{
      kind: 'nc', name: 'MarbleMuse.nc', url: '#', path: 'stub', size_bytes: 0,
      machining_time: '3h 05min', paths: 2, tool_count: 2, source: 'CAM Studio',
      machine: 'TTC 450 Pro (4th axis)', material: 'Modeling board — Ø60mm × 120mm',
      tools: ['NO.1 · 6mm Ball', 'NO.2 · 2mm Ball'],
      nc_paths: [
        { name: '[T1] Rotary Roughing',  tool: '6mm Ball', note: 'Around Z' },
        { name: '[T2] Rotary Finishing', tool: '2mm Ball', note: 'Detail pass' },
      ],
    }],
  }),

  base('stub-maker-badge', {
    name:           'Maker Badge - 2D Pattern',
    category:       'Models & Toys',
    pictures:       [IMG.badge],
    description:    '<p>A brass badge with a crisp 2D engraved pattern. A quick, satisfying project that teaches 2D pocketing and engraving.</p>',
    post_process:   'Fill the engraving with enamel paint; wipe the surface clean before it cures.',
    machines:       ['TTC 450 Pro'],
    materials:      ['Brass'],
    tags:           ['badge', 'brass', 'engraving', '2d'],
    download_count: 255,
    like_count:     7,
    views:          980,
    files: [{
      kind: 'nc', name: 'MakerBadge.nc', url: '#', path: 'stub', size_bytes: 0,
      machining_time: '42min', paths: 2, tool_count: 1, source: 'CAM Studio',
      machine: 'TTC 450 Pro', material: 'Brass Plate — 50mm × 50mm × 2mm',
      tools: ['NO.1 · 30° V-bit'],
      nc_paths: [
        { name: '[T1] 2D Pocket',   tool: '30° V-bit', note: 'Clear background' },
        { name: '[T1] Engrave',     tool: '30° V-bit', note: 'Pattern detail' },
      ],
    }],
  }),
]

function matches(p: ProjectDetail, f: ProjectFilters): boolean {
  if (f.category && p.category !== f.category) return false
  if (f.machine  && !p.machines.includes(f.machine)) return false
  if (f.material && !p.materials.includes(f.material)) return false
  return true
}

export function stubCards(filters: ProjectFilters, sort: ProjectSort): ProjectCard[] {
  const cards = STUB_PROJECTS.filter(p => matches(p, filters)).map(p => ({ ...p }))
  if (sort === 'downloads')   cards.sort((a, b) => b.download_count - a.download_count)
  else if (sort === 'likes')  cards.sort((a, b) => b.like_count - a.like_count)
  return cards
}

export function stubDetail(id: string): ProjectDetail | null {
  return STUB_PROJECTS.find(p => p.id === id) ?? null
}

export function isStubId(id: string): boolean {
  return id.startsWith('stub-')
}
