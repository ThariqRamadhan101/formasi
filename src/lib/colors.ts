export interface EselonColor {
  /** Row tint for tables. */
  row: string
  /** Small badge style. */
  badge: string
  /** Full card style for the org chart. */
  card: string
}

/** Warna eselon: I merah pekat, II kuning, III hijau muda, IV biru muda. */
export const ESELON_COLORS: Record<string, EselonColor> = {
  I: { row: 'bg-red-100/70', badge: 'bg-red-700 text-white', card: 'border-red-800 bg-red-800 text-white' },
  II: {
    row: 'bg-yellow-100/70',
    badge: 'bg-yellow-400 text-yellow-900',
    card: 'border-yellow-400 bg-yellow-100 text-yellow-900',
  },
  III: {
    row: 'bg-green-100/70',
    badge: 'bg-green-400 text-green-900',
    card: 'border-green-300 bg-green-100 text-green-900',
  },
  IV: { row: 'bg-sky-100/70', badge: 'bg-sky-400 text-sky-900', card: 'border-sky-300 bg-sky-100 text-sky-900' },
}

export function eselonColor(eselon: string | undefined | null): EselonColor | undefined {
  return eselon ? ESELON_COLORS[eselon] : undefined
}

export interface FungsionalStatusMeta extends EselonColor {
  label: string
}

/** Warna status jabatan fungsional (tiap tahap beda warna). */
export const FUNGSIONAL_STATUS_META: Record<string, FungsionalStatusMeta> = {
  BELUM_DIBUKA: {
    label: 'Belum dibuka',
    row: 'bg-slate-100/70',
    badge: 'bg-slate-400 text-slate-900',
    card: 'border-slate-400 bg-slate-100 text-slate-900',
  },
  DIHITUNG_PEMBINA: {
    label: 'Dihitung oleh Unit Pembina',
    row: 'bg-amber-100/70',
    badge: 'bg-amber-400 text-amber-900',
    card: 'border-amber-400 bg-amber-100 text-amber-900',
  },
  DIUSULKAN_PEMBINA: {
    label: 'Sudah diusulkan ke Unit Pembina',
    row: 'bg-sky-100/70',
    badge: 'bg-sky-500 text-white',
    card: 'border-sky-400 bg-sky-100 text-sky-900',
  },
  DIUSULKAN_MENPANRB: {
    label: 'Sudah diusulkan ke MenPAN-RB',
    row: 'bg-violet-100/70',
    badge: 'bg-violet-500 text-white',
    card: 'border-violet-400 bg-violet-100 text-violet-900',
  },
  DITETAPKAN_MENPANRB: {
    label: 'Formasi sudah ditetapkan MenPAN-RB',
    row: 'bg-emerald-100/70',
    badge: 'bg-emerald-600 text-white',
    card: 'border-emerald-400 bg-emerald-100 text-emerald-900',
  },
}

export const FUNGSIONAL_STATUS_ORDER = [
  'BELUM_DIBUKA',
  'DIHITUNG_PEMBINA',
  'DIUSULKAN_PEMBINA',
  'DIUSULKAN_MENPANRB',
  'DITETAPKAN_MENPANRB',
] as const

export function fungsionalStatusMeta(id: string | undefined | null): FungsionalStatusMeta | undefined {
  return id ? FUNGSIONAL_STATUS_META[id] : undefined
}

