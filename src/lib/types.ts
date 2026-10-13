export interface Pegawai {
  nama: string
  nip: string
  status: string
}

export interface FormasiRow {
  id: number
  eselon: string
  unitKerja: string
  satuanKerja: string
  seksiKerja: string
  jabatan: string
  jenjang: string
  jenisJabatan: string
  formasi: string
  kebutuhan: number
  /** Filled positions (from DATA PEGAWAI). */
  bezetting?: number
  /** Kebutuhan - Bezetting. */
  formasiGap?: number
  pegawai?: Pegawai[]
}

export type NewFormasiRow = Omit<FormasiRow, 'id'>

export interface FormasiSummary {
  rows: number
  kebutuhan: number
  unitKerja: number
  satuanKerja: number
  jabatan: number
}

export interface FormasiData {
  generatedAt: string
  source: string
  summary: FormasiSummary
  rows: FormasiRow[]
}

/** Flat option lists used by the forms/tables (derived from OptionModel). */
export interface OptionLists {
  unitKerja: string[]
  satuanKerja: string[]
  seksiKerja: string[]
  jabatan: string[]
  jenjang: string[]
}

/**
 * Hierarchical, editable option model — mirrors the input dependencies:
 * Unit Kerja → Satuan Kerja → Seksi Kerja, and
 * Eselon (struktural) / Fungsional / Pelaksana → Jabatan + Jenjang.
 */
export interface OptionModel {
  unitKerja: string[]
  satuanByUnit: Record<string, string[]>
  /** key = `${unit}||${satuan}` (satuan '' for Balai/UPT whose Satuan == Unit). */
  seksiByKey: Record<string, string[]>
  jabatanStruktural: Record<string, string[]>
  jabatanFungsional: string[]
  jabatanPelaksana: string[]
  jenjangFungsional: string[]
}

export type ModelPath =
  | { kind: 'unitKerja' }
  | { kind: 'satuanByUnit'; unit: string }
  | { kind: 'seksiByKey'; key: string }
  | { kind: 'jabatanStruktural'; eselon: string }
  | { kind: 'jabatanFungsional' }
  | { kind: 'jabatanPelaksana' }
  | { kind: 'jenjangFungsional' }

export interface OptionsData {
  generatedAt: string
  unitKerja: string[]
  satuanKerja: string[]
  seksiKerja: string[]
  jabatan: string[]
  jenjang: string[]
  jenisJabatan: string[]
  formasi: string[]
}

/** Functional-position category used by the chart/table filters. */
export type FungsionalCategory = 'BIDANG_PU' | 'NON_BIDANG_PU' | 'BUKAN_FUNGSIONAL'

/** Lifecycle status of a functional position ("jabatan fungsional"). */
export type FungsionalStatusId =
  | 'BELUM_DIBUKA'
  | 'DIHITUNG_PEMBINA'
  | 'DIUSULKAN_PEMBINA'
  | 'DIUSULKAN_MENPANRB'
  | 'DITETAPKAN_MENPANRB'

/** Status keyed by jabatan name. */
export type FungsionalStatusMap = Record<string, FungsionalStatusId>

/** Seed file for fungsional status (database/status-fungsional.json -> public/data). */
export interface FungsionalStatusData {
  generatedAt: string
  status: FungsionalStatusMap
}

/** Portable in-app database snapshot (import/export). */
export interface FormasiDatabase {
  generatedAt: string
  source?: string
  rows: FormasiRow[]
  model: OptionModel
  fungsionalStatus: FungsionalStatusMap
}

export type OrgNodeKind = 'root' | 'group' | 'unit' | 'balai' | 'subunit' | 'seksi'

export interface OrgNode {
  id: string
  kind: OrgNodeKind
  level: number
  label: string
  structural?: FormasiRow
  eselon?: string
  rows: FormasiRow[]
  children: OrgNode[]
  kebutuhan: number
  bezetting: number
  positionCount: number
}
