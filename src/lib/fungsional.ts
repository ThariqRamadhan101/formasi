import type { FormasiRow, FungsionalCategory } from './types'

/** Jabatan Fungsional that belong to the PU (Pekerjaan Umum) bidang. */
export const BIDANG_PU_JABATAN = [
  'Teknik Pengairan',
  'Teknik Jalan dan Jembatan',
  'Teknik Tata Bangunan dan Perumahan',
  'Teknik Penyehatan Lingkungan',
  'Pembina Jasa Konstruksi',
  'Pengelola Sumber Daya Air',
  'Penata Kelola Jalan dan Jembatan',
  'Penata Kelola Bangunan Gedung dan Kawasan Permukiman',
  'Penata Kelola Penyehatan Lingkungan',
  'Analis Pembiayaan Infrastruktur Pekerjaan Umum dan Perumahan',
  'Penata Laksana Sumber Daya Air',
  'Penata Laksana Jalan dan Jembatan',
  'Penata Laksana Bangunan Gedung dan Kawasan Permukiman',
  'Penata Laksana Penyehatan Lingkungan',
]

/** Case/whitespace-insensitive key — the workbook has "Dan"/"dan" variants. */
export function normalizeJabatan(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

const BIDANG_PU_KEYS = new Set(BIDANG_PU_JABATAN.map(normalizeJabatan))

/** Category of a "Jabatan Fungsional" name (no row needed). */
export function categoryOfJabatan(jabatan: string | null | undefined): FungsionalCategory {
  return BIDANG_PU_KEYS.has(normalizeJabatan(jabatan)) ? 'BIDANG_PU' : 'NON_BIDANG_PU'
}

export function functionalCategory(row: FormasiRow): FungsionalCategory {
  if (row.jenisJabatan !== 'Jabatan Fungsional') return 'BUKAN_FUNGSIONAL'
  return categoryOfJabatan(row.jabatan)
}

export const CATEGORY_LABELS: Record<FungsionalCategory, string> = {
  BIDANG_PU: 'Bidang PU',
  NON_BIDANG_PU: 'Non Bidang PU',
  BUKAN_FUNGSIONAL: 'Bukan Fungsional',
}

export interface CategoryOption {
  id: FungsionalCategory | 'ALL'
  label: string
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: 'ALL', label: 'Semua kategori' },
  { id: 'BIDANG_PU', label: CATEGORY_LABELS.BIDANG_PU },
  { id: 'NON_BIDANG_PU', label: CATEGORY_LABELS.NON_BIDANG_PU },
  { id: 'BUKAN_FUNGSIONAL', label: CATEGORY_LABELS.BUKAN_FUNGSIONAL },
]
