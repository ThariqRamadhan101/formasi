import { CATEGORY_LABELS, functionalCategory } from './fungsional'
import type { FormasiRow } from './types'

function display(value: string | null | undefined): string {
  const text = (value ?? '').trim()
  return !text || text === '-' ? '—' : text
}

export interface PivotDimension {
  id: string
  label: string
  get: (row: FormasiRow) => string
}

export const PIVOT_DIMENSIONS: PivotDimension[] = [
  { id: 'unitKerja', label: 'Unit Kerja', get: (row) => display(row.unitKerja) },
  { id: 'satuanKerja', label: 'Satuan Kerja', get: (row) => display(row.satuanKerja) },
  { id: 'seksiKerja', label: 'Seksi Kerja', get: (row) => display(row.seksiKerja) },
  { id: 'eselon', label: 'Eselon', get: (row) => (row.eselon ? `Eselon ${row.eselon}` : 'Non-eselon') },
  { id: 'jenisJabatan', label: 'Jenis Jabatan', get: (row) => display(row.jenisJabatan) },
  { id: 'jabatan', label: 'Jabatan', get: (row) => display(row.jabatan) },
  { id: 'jenjang', label: 'Jenjang', get: (row) => display(row.jenjang) },
  { id: 'formasi', label: 'Formasi?', get: (row) => display(row.formasi) },
  { id: 'kategori', label: 'Kategori Fungsional', get: (row) => CATEGORY_LABELS[functionalCategory(row)] },
]

export interface PivotMeasure {
  id: string
  label: string
  compute: (rows: FormasiRow[]) => number
}

export const PIVOT_MEASURES: PivotMeasure[] = [
  {
    id: 'kebutuhan',
    label: 'Kebutuhan',
    compute: (rows) => rows.reduce((sum, row) => sum + (row.kebutuhan || 0), 0),
  },
  {
    id: 'bezetting',
    label: 'Bezetting',
    compute: (rows) => rows.reduce((sum, row) => sum + (row.bezetting || 0), 0),
  },
  {
    id: 'formasi',
    label: 'Formasi (Kebutuhan − Bezetting)',
    compute: (rows) => rows.reduce((sum, row) => sum + (row.kebutuhan || 0) - (row.bezetting || 0), 0),
  },
  { id: 'baris', label: 'Jumlah Baris', compute: (rows) => rows.length },
  {
    id: 'pegawai',
    label: 'Jumlah Pegawai',
    compute: (rows) => rows.reduce((sum, row) => sum + (row.pegawai?.length ?? 0), 0),
  },
]

export interface PivotLeaf {
  key: string
  labels: string[]
  rows: FormasiRow[]
}

export interface ColHeader {
  label: string
  start: number
  span: number
}

export interface PivotConfig {
  rows: string[]
  cols: string[]
  values: string[]
  filters: { field: string; values: string[] }[]
}

export interface PivotResult {
  rowFields: PivotDimension[]
  colFields: PivotDimension[]
  values: PivotMeasure[]
  rowLeaves: PivotLeaf[]
  colLeaves: PivotLeaf[]
  /** cells[row][col][value] */
  cells: number[][][]
  rowTotals: number[][]
  colTotals: number[][]
  grandTotals: number[]
  /** rowSpans[row][level] — 0 means "covered by an earlier rowSpan". */
  rowSpans: number[][]
  /** colHeader[level] — column-field header groups (leaf indices). */
  colHeader: ColHeader[][]
}

const SEP = '\u0001'

function dimension(id: string): PivotDimension | undefined {
  return PIVOT_DIMENSIONS.find((item) => item.id === id)
}

function measure(id: string): PivotMeasure | undefined {
  return PIVOT_MEASURES.find((item) => item.id === id)
}

function buildLeaves(rows: FormasiRow[], fields: PivotDimension[]): PivotLeaf[] {
  const seen = new Map<string, PivotLeaf>()
  const out: PivotLeaf[] = []
  for (const row of rows) {
    const labels = fields.map((field) => field.get(row))
    const key = labels.join(SEP)
    let leaf = seen.get(key)
    if (!leaf) {
      leaf = { key, labels, rows: [] }
      seen.set(key, leaf)
      out.push(leaf)
    }
    leaf.rows.push(row)
  }
  return out
}

function leafKey(row: FormasiRow, fields: PivotDimension[]): string {
  return fields.map((field) => field.get(row)).join(SEP)
}

export function selectRows(rows: FormasiRow[], filters: PivotConfig['filters']): FormasiRow[] {
  if (filters.length === 0) return rows
  const active = filters
    .map((filter) => ({ field: dimension(filter.field), values: new Set(filter.values) }))
    .filter((filter): filter is { field: PivotDimension; values: Set<string> } =>
      Boolean(filter.field) && filter.values.size > 0,
    )
  if (active.length === 0) return rows
  return rows.filter((row) => active.every(({ field, values }) => values.has(field.get(row))))
}

export function computePivot(rows: FormasiRow[], config: PivotConfig): PivotResult {
  const rowFields = config.rows
    .map(dimension)
    .filter((field): field is PivotDimension => Boolean(field))
  const colFields = config.cols
    .map(dimension)
    .filter((field): field is PivotDimension => Boolean(field))
  const valueMeasures = config.values
    .map(measure)
    .filter((item): item is PivotMeasure => Boolean(item))
  const values = valueMeasures.length > 0 ? valueMeasures : [PIVOT_MEASURES[0]]

  const rowLeaves: PivotLeaf[] =
    rowFields.length > 0 ? buildLeaves(rows, rowFields) : [{ key: '', labels: [], rows }]
  const colLeaves: PivotLeaf[] =
    colFields.length > 0 ? buildLeaves(rows, colFields) : [{ key: '', labels: [], rows }]

  const rowIndex = new Map(rowLeaves.map((leaf, index) => [leaf.key, index]))
  const colIndex = new Map(colLeaves.map((leaf, index) => [leaf.key, index]))

  const cellRows: FormasiRow[][][] = rowLeaves.map(() => colLeaves.map(() => []))
  for (const row of rows) {
    const ri = rowIndex.get(rowFields.length > 0 ? leafKey(row, rowFields) : '')
    const ci = colIndex.get(colFields.length > 0 ? leafKey(row, colFields) : '')
    if (ri === undefined || ci === undefined) continue
    cellRows[ri][ci].push(row)
  }

  const cells = cellRows.map((rowCells) =>
    rowCells.map((cell) => values.map((value) => value.compute(cell))),
  )
  const rowTotals = rowLeaves.map((leaf) => values.map((value) => value.compute(leaf.rows)))
  const colTotals = colLeaves.map((leaf) => values.map((value) => value.compute(leaf.rows)))
  const grandTotals = values.map((value) => value.compute(rows))

  const rowSpans = rowLeaves.map(() => rowFields.map(() => 0))
  for (let level = 0; level < rowFields.length; level++) {
    let start = 0
    while (start < rowLeaves.length) {
      const prefix = rowLeaves[start].labels.slice(0, level + 1).join(SEP)
      let end = start + 1
      while (
        end < rowLeaves.length &&
        rowLeaves[end].labels.slice(0, level + 1).join(SEP) === prefix
      ) {
        end++
      }
      rowSpans[start][level] = end - start
      start = end
    }
  }

  const colHeader: ColHeader[][] = []
  for (let level = 0; level < colFields.length; level++) {
    const headers: ColHeader[] = []
    let start = 0
    while (start < colLeaves.length) {
      const prefix = colLeaves[start].labels.slice(0, level + 1).join(SEP)
      let end = start + 1
      while (
        end < colLeaves.length &&
        colLeaves[end].labels.slice(0, level + 1).join(SEP) === prefix
      ) {
        end++
      }
      headers.push({ label: colLeaves[start].labels[level], start, span: end - start })
      start = end
    }
    colHeader.push(headers)
  }

  return {
    rowFields,
    colFields,
    values,
    rowLeaves,
    colLeaves,
    cells,
    rowTotals,
    colTotals,
    grandTotals,
    rowSpans,
    colHeader,
  }
}

export function uniqueFieldValues(rows: FormasiRow[], fieldId: string): string[] {
  const field = dimension(fieldId)
  if (!field) return []
  const set = new Set<string>()
  for (const row of rows) set.add(field.get(row))
  return [...set]
}
