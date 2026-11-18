import ExcelJS from 'exceljs'
import type { Cell, Worksheet, Workbook } from 'exceljs'
import { FUNGSIONAL_STATUS_META, FUNGSIONAL_STATUS_ORDER } from './colors'
import { categoryOfJabatan } from './fungsional'
import { centralUnitNames, rootRow } from './formasi'
import type { FormasiRow, FungsionalStatusId, FungsionalStatusMap } from './types'

/**
 * Generates the "Lampiran" report workbook (Tabel 1, Tabel 2, Lampiran I–III)
 * client-side from the store rows — the Excel counterpart of the reference file
 * `Lampiran.xlsx`. All figures derive from the data; nothing organization-specific
 * is hard-coded beyond the report's own column layout.
 *
 * Conventions (mirroring the reference file):
 * - K = kebutuhan, B = bezetting of `formasi = 'YA'` rows only, F = K − B.
 * - "Tidak Sesuai Formasi" = employees on `formasi = 'TIDAK'` rows (K = 0, F = −B).
 * - Eselon III splits into III.a (central units) / III.b (satellite UPT units).
 * - Footnote counts every employee on a `TIDAK` row ("tidak sesuai formasi").
 */

const JENIS_URUT = ['Jabatan Struktural', 'Jabatan Fungsional', 'Jabatan Pelaksana'] as const
const JENJANG_URUT = [
  'Ahli Utama',
  'Ahli Madya',
  'Ahli Muda',
  'Ahli Pertama',
  'Penyelia',
  'Mahir',
  'Terampil',
] as const

interface Bucket {
  k: number
  b: number
}

const isTidak = (row: FormasiRow) => row.formasi === 'TIDAK'
const keb = (row: FormasiRow) => row.kebutuhan || 0
const bez = (row: FormasiRow) => row.bezetting ?? row.pegawai?.length ?? 0
const pegawaiOf = (row: FormasiRow) => row.pegawai?.length ?? row.bezetting ?? 0

function colName(n: number): string {
  let out = ''
  let rest = n
  while (rest > 0) {
    const rem = (rest - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    rest = Math.floor((rest - 1) / 26)
  }
  return out
}

/* ------------------------------------------------------------------ styles */

const THIN = { style: 'thin' } as const

function box(cell: Cell) {
  cell.border = { top: THIN, left: THIN, bottom: THIN, right: THIN }
}

function headerCell(cell: Cell) {
  box(cell)
  cell.font = { bold: true, name: 'Calibri', size: 11 }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
}

function alignCell(cell: Cell, left: boolean) {
  cell.alignment = { horizontal: left ? 'left' : 'center', vertical: 'middle' }
}

function boldRow(ws: Worksheet, row: number, lastCol: number) {
  for (let c = 1; c <= lastCol; c++) {
    const cell = ws.getCell(row, c)
    cell.font = { ...(cell.font ?? { name: 'Calibri', size: 11 }), bold: true }
  }
}

/** Boxes every cell in the used range, then applies header/data styling. */
function finishSheet(
  ws: Worksheet,
  lastRow: number,
  lastCol: number,
  headerRows: number,
  textCols: number[] = [],
  boldRows: number[] = [],
) {
  for (let r = 1; r <= lastRow; r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r, c)
      if (r <= headerRows) headerCell(cell)
      else {
        box(cell)
        alignCell(cell, textCols.includes(c))
      }
    }
  }
  for (const row of boldRows) boldRow(ws, row, lastCol)
}

function setWidths(ws: Worksheet, widths: number[]) {
  widths.forEach((width, i) => {
    ws.getColumn(i + 1).width = width
  })
}

function mergeLabel(ws: Worksheet, address: string, label?: string) {
  ws.mergeCells(address)
  if (label !== undefined) ws.getCell(address.split(':')[0]).value = label
}

function setFormula(cell: Cell, formula: string, result: number) {
  cell.value = { formula, result }
}

function sumFormula(col: number, firstRow: number, lastRow: number): string {
  const letter = colName(col)
  return `SUM(${letter}${firstRow}:${letter}${lastRow})`
}

/* -------------------------------------------------------------- Tabel 1 */

function sheetTabel1(wb: Workbook, rows: FormasiRow[]) {
  const ws = wb.addWorksheet('Tabel 1')
  const headers = ['No', 'Jenis Jabatan', 'Kebutuhan', 'Bezetting', 'Formasi']
  headers.forEach((h, i) => {
    ws.getCell(1, i + 1).value = h
  })

  const totals = { k: 0, b: 0 }
  JENIS_URUT.forEach((jenis, i) => {
    const r = i + 2
    let k = 0
    let b = 0
    for (const row of rows) {
      if (row.jenisJabatan !== jenis) continue
      k += keb(row)
      if (!isTidak(row)) b += bez(row)
    }
    totals.k += k
    totals.b += b
    ws.getCell(r, 1).value = i + 1
    ws.getCell(r, 2).value = jenis
    ws.getCell(r, 3).value = k
    ws.getCell(r, 4).value = b
    setFormula(ws.getCell(r, 5), `C${r}-D${r}`, k - b)
  })

  const totalRow = 2 + JENIS_URUT.length
  ws.getCell(totalRow, 1).value = 'Total'
  ws.mergeCells(`A${totalRow}:B${totalRow}`)
  setFormula(ws.getCell(totalRow, 3), sumFormula(3, 2, totalRow - 1), totals.k)
  setFormula(ws.getCell(totalRow, 4), sumFormula(4, 2, totalRow - 1), totals.b)
  setFormula(ws.getCell(totalRow, 5), sumFormula(5, 2, totalRow - 1), totals.k - totals.b)

  const tanpaFormasi = rows.filter(isTidak).reduce((sum, row) => sum + pegawaiOf(row), 0)
  ws.getCell(totalRow + 2, 1).value = `*Terdapat ${tanpaFormasi} Pegawai yang tidak sesuai formasi`

  setWidths(ws, [6, 24, 12, 12, 12])
  finishSheet(ws, totalRow, 5, 1, [2], [totalRow])
}

/* -------------------------------------------- Tabel 2 & Lampiran II data */

interface JfAgg {
  jabatan: string
  k: number
  b: number
  status: FungsionalStatusId
}

function statusOf(jabatan: string, status: FungsionalStatusMap): FungsionalStatusId {
  const id = status[jabatan]
  return id && id in FUNGSIONAL_STATUS_META ? id : 'BELUM_DIBUKA'
}

function statusRank(id: FungsionalStatusId): number {
  // Tabel 2 groups by status, most advanced first (registry order reversed:
  // ditetapkan MenPAN-RB → belum dibuka).
  const index = FUNGSIONAL_STATUS_ORDER.indexOf(id)
  return index < 0 ? -1 : FUNGSIONAL_STATUS_ORDER.length - 1 - index
}

/** Jabatan fungsional on `formasi = 'YA'` rows, grouped and ordered by status. */
function aggregateJf(rows: FormasiRow[], status: FungsionalStatusMap): JfAgg[] {
  const map = new Map<string, JfAgg>()
  for (const row of rows) {
    if (row.jenisJabatan !== 'Jabatan Fungsional' || isTidak(row)) continue
    let agg = map.get(row.jabatan)
    if (!agg) {
      agg = { jabatan: row.jabatan, k: 0, b: 0, status: statusOf(row.jabatan, status) }
      map.set(row.jabatan, agg)
    }
    agg.k += keb(row)
    agg.b += bez(row)
  }
  return [...map.values()].sort(
    (a, b) => statusRank(a.status) - statusRank(b.status) || a.jabatan.localeCompare(b.jabatan, 'id'),
  )
}

function sheetTabel2(wb: Workbook, jf: JfAgg[]) {
  const ws = wb.addWorksheet('Tabel 2')
  const headers = ['No', 'Jabatan Fungsional', 'Kebutuhan', 'Bezetting', 'Formasi', 'Status']
  headers.forEach((h, i) => {
    ws.getCell(1, i + 1).value = h
  })

  jf.forEach((agg, i) => {
    const r = i + 2
    ws.getCell(r, 1).value = i + 1
    ws.getCell(r, 2).value = agg.jabatan
    ws.getCell(r, 3).value = agg.k
    ws.getCell(r, 4).value = agg.b
    setFormula(ws.getCell(r, 5), `C${r}-D${r}`, agg.k - agg.b)
    ws.getCell(r, 6).value = FUNGSIONAL_STATUS_META[agg.status].label
  })

  // Merge the Status column across consecutive rows sharing the same status.
  let runStart = 0
  for (let i = 1; i <= jf.length; i++) {
    if (i === jf.length || jf[i].status !== jf[runStart].status) {
      if (i - 1 > runStart) ws.mergeCells(`F${runStart + 2}:F${i + 1}`)
      runStart = i
    }
  }

  const totalRow = jf.length + 2
  ws.getCell(totalRow, 1).value = 'Total'
  ws.mergeCells(`A${totalRow}:B${totalRow}`)
  const totals = jf.reduce((sum, agg) => ({ k: sum.k + agg.k, b: sum.b + agg.b }), { k: 0, b: 0 })
  setFormula(ws.getCell(totalRow, 3), sumFormula(3, 2, totalRow - 1), totals.k)
  setFormula(ws.getCell(totalRow, 4), sumFormula(4, 2, totalRow - 1), totals.b)
  setFormula(ws.getCell(totalRow, 5), sumFormula(5, 2, totalRow - 1), totals.k - totals.b)

  setWidths(ws, [6, 58, 12, 12, 12, 42])
  finishSheet(ws, totalRow, 6, 1, [2, 6], [totalRow])
}

/* ----------------------------------------------------------- Lampiran I */

const MANAJ_GROUPS = [
  { label: 'I.a', col: 3 },
  { label: 'II.a', col: 6 },
  { label: 'III.a', col: 9 },
  { label: 'III.b', col: 12 },
  { label: 'IV.a', col: 15 },
] as const
const MANAJ_JML = 18
const NON_SESUAI_PU = 21
const NON_SESUAI_NON = 24
const NON_TIDAK_PU = 27
const NON_TIDAK_NON = 30
const NON_PELAKSANA = 33
const NON_JML = 36
const TOTAL_K = 39
const LAMPIRAN_I_COLS = 41

type ManajLabel = (typeof MANAJ_GROUPS)[number]['label']

function manajGroup(eselon: string, isCentral: boolean): ManajLabel | null {
  const e = eselon.trim().toUpperCase()
  if (e === 'I') return 'I.a'
  if (e === 'II') return 'II.a'
  if (e === 'IV') return 'IV.a'
  if (e === 'III') return isCentral ? 'III.a' : 'III.b'
  return null
}

interface UnitAgg {
  unit: string
  manaj: Record<ManajLabel, Bucket>
  sesuaiPu: Bucket
  sesuaiNon: Bucket
  tidakPu: Bucket
  tidakNon: Bucket
  pelaksana: Bucket
}

function aggregateUnits(rows: FormasiRow[]): UnitAgg[] {
  const central = centralUnitNames(rows)
  const order: string[] = []
  const byUnit = new Map<string, UnitAgg>()

  for (const row of rows) {
    const unit = row.unitKerja
    if (!unit) continue
    let agg = byUnit.get(unit)
    if (!agg) {
      agg = {
        unit,
        manaj: {
          'I.a': { k: 0, b: 0 },
          'II.a': { k: 0, b: 0 },
          'III.a': { k: 0, b: 0 },
          'III.b': { k: 0, b: 0 },
          'IV.a': { k: 0, b: 0 },
        },
        sesuaiPu: { k: 0, b: 0 },
        sesuaiNon: { k: 0, b: 0 },
        tidakPu: { k: 0, b: 0 },
        tidakNon: { k: 0, b: 0 },
        pelaksana: { k: 0, b: 0 },
      }
      byUnit.set(unit, agg)
      order.push(unit)
    }

    if (row.jenisJabatan === 'Jabatan Struktural') {
      if (isTidak(row)) continue
      const group = manajGroup(row.eselon, central.has(unit))
      if (!group) continue
      agg.manaj[group].k += keb(row)
      agg.manaj[group].b += bez(row)
    } else if (row.jenisJabatan === 'Jabatan Fungsional') {
      const pu = categoryOfJabatan(row.jabatan) === 'BIDANG_PU'
      if (isTidak(row)) {
        ;(pu ? agg.tidakPu : agg.tidakNon).b += pegawaiOf(row)
      } else {
        const bucket = pu ? agg.sesuaiPu : agg.sesuaiNon
        bucket.k += keb(row)
        bucket.b += bez(row)
      }
    } else if (row.jenisJabatan === 'Jabatan Pelaksana') {
      if (isTidak(row)) continue
      agg.pelaksana.k += keb(row)
      agg.pelaksana.b += bez(row)
    }
  }

  return order.map((unit) => byUnit.get(unit)!)
}

function lampiranIRowValues(agg: UnitAgg): number[] {
  const v = new Array<number>(LAMPIRAN_I_COLS + 1).fill(0)
  const putTriple = (start: number, bucket: Bucket) => {
    v[start] = bucket.k
    v[start + 1] = bucket.b
    v[start + 2] = bucket.k - bucket.b
  }
  for (const group of MANAJ_GROUPS) putTriple(group.col, agg.manaj[group.label])
  v[MANAJ_JML] = MANAJ_GROUPS.reduce((sum, g) => sum + agg.manaj[g.label].k, 0)
  v[MANAJ_JML + 1] = MANAJ_GROUPS.reduce((sum, g) => sum + agg.manaj[g.label].b, 0)
  v[MANAJ_JML + 2] = v[MANAJ_JML] - v[MANAJ_JML + 1]
  putTriple(NON_SESUAI_PU, agg.sesuaiPu)
  putTriple(NON_SESUAI_NON, agg.sesuaiNon)
  putTriple(NON_TIDAK_PU, agg.tidakPu)
  putTriple(NON_TIDAK_NON, agg.tidakNon)
  putTriple(NON_PELAKSANA, agg.pelaksana)
  v[NON_JML] = v[NON_SESUAI_PU] + v[NON_SESUAI_NON] + v[NON_TIDAK_PU] + v[NON_TIDAK_NON] + v[NON_PELAKSANA]
  v[NON_JML + 1] =
    v[NON_SESUAI_PU + 1] +
    v[NON_SESUAI_NON + 1] +
    v[NON_TIDAK_PU + 1] +
    v[NON_TIDAK_NON + 1] +
    v[NON_PELAKSANA + 1]
  v[NON_JML + 2] = v[NON_JML] - v[NON_JML + 1]
  v[TOTAL_K] = v[MANAJ_JML] + v[NON_JML]
  v[TOTAL_K + 1] = v[MANAJ_JML + 1] + v[NON_JML + 1]
  v[TOTAL_K + 2] = v[TOTAL_K] - v[TOTAL_K + 1]
  return v
}

/** Formula for a sum-style cell (F cells are written separately), or null. */
function lampiranIFormula(col: number, row: number): string | null {
  const at = (cols: number[]) => `=${cols.map((c) => `${colName(c)}${row}`).join('+')}`
  if (col === MANAJ_JML) return at(MANAJ_GROUPS.map((g) => g.col))
  if (col === MANAJ_JML + 1) return at(MANAJ_GROUPS.map((g) => g.col + 1))
  if (col === NON_JML) {
    return at([NON_SESUAI_PU, NON_SESUAI_NON, NON_TIDAK_PU, NON_TIDAK_NON, NON_PELAKSANA])
  }
  if (col === NON_JML + 1) {
    return at([NON_SESUAI_PU + 1, NON_SESUAI_NON + 1, NON_TIDAK_PU + 1, NON_TIDAK_NON + 1, NON_PELAKSANA + 1])
  }
  if (col === TOTAL_K) return `=${colName(MANAJ_JML)}${row}+${colName(NON_JML)}${row}`
  if (col === TOTAL_K + 1) return `=${colName(MANAJ_JML + 1)}${row}+${colName(NON_JML + 1)}${row}`
  return null
}

/** True for the F cell of a K/B/F triple (group, Jumlah or Total). */
function isTripleF(col: number): boolean {
  return col >= 5 && (col - 3) % 3 === 2
}

function sheetLampiranI(wb: Workbook, rows: FormasiRow[]) {
  const ws = wb.addWorksheet('Lampiran I')
  const aggs = aggregateUnits(rows)

  mergeLabel(ws, 'A1:A4', 'No')
  mergeLabel(ws, 'B1:B4', 'Unit Organisasi / Unit Kerja')
  mergeLabel(ws, 'C1:T1', 'Jabatan Manajerial')
  mergeLabel(ws, 'U1:AL1', 'Jabatan Non Manajerial')
  mergeLabel(ws, 'AM1:AO3', 'Total')
  for (const group of MANAJ_GROUPS) {
    mergeLabel(ws, `${colName(group.col)}2:${colName(group.col + 2)}3`, group.label)
  }
  mergeLabel(ws, 'R2:T3', 'Jumlah')
  mergeLabel(ws, 'U2:Z2', 'Sesuai Formasi')
  mergeLabel(ws, 'U3:W3', 'JF Bidang PU')
  mergeLabel(ws, 'X3:Z3', 'JF Non Bidang PU')
  mergeLabel(ws, 'AA2:AF2', 'Tidak Sesuai Formasi')
  mergeLabel(ws, 'AA3:AC3', 'JF Bidang PU')
  mergeLabel(ws, 'AD3:AF3', 'JF Non Bidang PU')
  mergeLabel(ws, 'AG2:AI3', 'Pelaksana')
  mergeLabel(ws, 'AJ2:AL3', 'Jumlah')
  for (let c = 3; c <= LAMPIRAN_I_COLS; c++) ws.getCell(4, c).value = ['K', 'B', 'F'][(c - 3) % 3]

  const firstDataRow = 5
  const totals = new Array<number>(LAMPIRAN_I_COLS + 1).fill(0)
  aggs.forEach((agg, i) => {
    const r = firstDataRow + i
    ws.getCell(r, 1).value = i + 1
    ws.getCell(r, 2).value = agg.unit
    const values = lampiranIRowValues(agg)
    for (let c = 3; c <= LAMPIRAN_I_COLS; c++) {
      totals[c] += values[c]
      const cell = ws.getCell(r, c)
      if (isTripleF(c)) {
        setFormula(cell, `${colName(c - 2)}${r}-${colName(c - 1)}${r}`, values[c])
      } else {
        const formula = lampiranIFormula(c, r)
        if (formula) setFormula(cell, formula, values[c])
        else cell.value = values[c]
      }
    }
  })

  const totalRow = firstDataRow + aggs.length
  ws.getCell(totalRow, 1).value = 'TOTAL'
  ws.mergeCells(`A${totalRow}:B${totalRow}`)
  for (let c = 3; c <= LAMPIRAN_I_COLS; c++) {
    setFormula(ws.getCell(totalRow, c), sumFormula(c, firstDataRow, totalRow - 1), totals[c])
  }

  setWidths(ws, [
    6, 50, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7,
    7, 7, 7, 7,
  ])
  finishSheet(ws, totalRow, LAMPIRAN_I_COLS, 4, [2], [totalRow])
  ws.pageSetup = { orientation: 'landscape', paperSize: 9 }
}

/* ---------------------------------------------------------- Lampiran II */

/** Jenjang columns: the 7 standard ones, plus any extra found in the data. */
function jenjangList(rows: FormasiRow[]): string[] {
  const list: string[] = [...JENJANG_URUT]
  const seen = new Set(list)
  for (const row of rows) {
    if (row.jenisJabatan !== 'Jabatan Fungsional' || isTidak(row)) continue
    const jenjang = row.jenjang.trim() || '-'
    if (seen.has(jenjang)) continue
    seen.add(jenjang)
    list.push(jenjang)
  }
  return list
}

/** Lampiran II — `jf` is expected in alphabetical (A–Z) jabatan order. */
function sheetLampiranII(wb: Workbook, rows: FormasiRow[], jf: JfAgg[]) {
  const ws = wb.addWorksheet('Lampiran II')
  const jenjangs = jenjangList(rows)
  const tripleStart = (index: number) => 3 + index * 3
  const jumlahK = tripleStart(jenjangs.length)
  const lastCol = jumlahK + 2

  // Per-jabatan per-jenjang K/B/F from YA rows.
  const detail = new Map<string, Map<string, Bucket>>()
  for (const row of rows) {
    if (row.jenisJabatan !== 'Jabatan Fungsional' || isTidak(row)) continue
    let perJenjang = detail.get(row.jabatan)
    if (!perJenjang) {
      perJenjang = new Map()
      detail.set(row.jabatan, perJenjang)
    }
    const key = row.jenjang.trim() || '-'
    let bucket = perJenjang.get(key)
    if (!bucket) {
      bucket = { k: 0, b: 0 }
      perJenjang.set(key, bucket)
    }
    bucket.k += keb(row)
    bucket.b += bez(row)
  }

  mergeLabel(ws, 'A1:A3', 'No')
  mergeLabel(ws, 'B1:B3', 'Nama Jabatan')
  mergeLabel(ws, `C1:${colName(jumlahK - 1)}1`, 'Jenjang')
  mergeLabel(ws, `${colName(jumlahK)}1:${colName(lastCol)}2`, 'Jumlah')
  jenjangs.forEach((jenjang, i) => {
    const start = tripleStart(i)
    mergeLabel(ws, `${colName(start)}2:${colName(start + 2)}2`, jenjang)
  })
  for (let c = 3; c <= lastCol; c++) ws.getCell(3, c).value = ['K', 'B', 'F'][(c - 3) % 3]

  const totals = new Array<number>(lastCol + 1).fill(0)
  jf.forEach((agg, i) => {
    const r = i + 4
    ws.getCell(r, 1).value = i + 1
    ws.getCell(r, 2).value = agg.jabatan
    const perJenjang = detail.get(agg.jabatan)
    const values = new Array<number>(lastCol + 1).fill(0)
    jenjangs.forEach((jenjang, j) => {
      const bucket = perJenjang?.get(jenjang)
      const start = tripleStart(j)
      values[start] = bucket?.k ?? 0
      values[start + 1] = bucket?.b ?? 0
      values[start + 2] = values[start] - values[start + 1]
    })
    values[jumlahK] = jenjangs.reduce((sum, _, j) => sum + values[tripleStart(j)], 0)
    values[jumlahK + 1] = jenjangs.reduce((sum, _, j) => sum + values[tripleStart(j) + 1], 0)
    values[jumlahK + 2] = values[jumlahK] - values[jumlahK + 1]

    for (let c = 3; c <= lastCol; c++) {
      totals[c] += values[c]
      const cell = ws.getCell(r, c)
      if (isTripleF(c)) setFormula(cell, `${colName(c - 2)}${r}-${colName(c - 1)}${r}`, values[c])
      else if (c === jumlahK || c === jumlahK + 1) {
        const starts = jenjangs.map((_, j) => tripleStart(j) + (c === jumlahK + 1 ? 1 : 0))
        setFormula(cell, `=${starts.map((s) => `${colName(s)}${r}`).join('+')}`, values[c])
      } else cell.value = values[c]
    }
  })

  const totalRow = jf.length + 4
  ws.getCell(totalRow, 1).value = 'TOTAL'
  ws.mergeCells(`A${totalRow}:B${totalRow}`)
  for (let c = 3; c <= lastCol; c++) {
    setFormula(ws.getCell(totalRow, c), sumFormula(c, 4, totalRow - 1), totals[c])
  }

  const widths = [6, 58]
  for (let c = 3; c <= lastCol; c++) widths.push(c === jumlahK || c === jumlahK + 1 || c === lastCol ? 8 : 6)
  setWidths(ws, widths)
  finishSheet(ws, totalRow, lastCol, 3, [2], [totalRow])
  ws.pageSetup = { orientation: 'landscape', paperSize: 9 }
}

/* --------------------------------------------------------- Lampiran III */

interface JfDetail {
  unit: string
  jabs: { jabatan: string; js: { jenjang: string; k: number; b: number }[] }[]
  k: number
  b: number
}

/** Per-unit JF detail (YA rows only), preserving first-appearance order. */
function aggregateDetail(rows: FormasiRow[]): JfDetail[] {
  const root = rootRow(rows)?.unitKerja
  const order: string[] = []
  const byUnit = new Map<string, JfDetail>()
  const index = new Map<
    string,
    Map<string, { entry: JfDetail['jabs'][number]; buckets: Map<string, JfDetail['jabs'][number]['js'][number]> }>
  >()

  for (const row of rows) {
    const unit = row.unitKerja
    if (!unit || unit === root || row.jenisJabatan !== 'Jabatan Fungsional' || isTidak(row)) continue
    let detail = byUnit.get(unit)
    if (!detail) {
      detail = { unit, jabs: [], k: 0, b: 0 }
      byUnit.set(unit, detail)
      index.set(unit, new Map())
      order.push(unit)
    }
    const byJab = index.get(unit)!
    let record = byJab.get(row.jabatan)
    if (!record) {
      const entry = { jabatan: row.jabatan, js: [] }
      record = { entry, buckets: new Map() }
      byJab.set(row.jabatan, record)
      detail.jabs.push(entry)
    }
    const jenjang = row.jenjang.trim() || '-'
    let bucket = record.buckets.get(jenjang)
    if (!bucket) {
      bucket = { jenjang, k: 0, b: 0 }
      record.buckets.set(jenjang, bucket)
      record.entry.js.push(bucket)
    }
    bucket.k += keb(row)
    bucket.b += bez(row)
    detail.k += keb(row)
    detail.b += bez(row)
  }

  const rank = (jenjang: string) => {
    const i = JENJANG_URUT.indexOf(jenjang as (typeof JENJANG_URUT)[number])
    return i < 0 ? JENJANG_URUT.length : i
  }
  for (const detail of byUnit.values()) {
    for (const jab of detail.jabs) jab.js.sort((a, b) => rank(a.jenjang) - rank(b.jenjang))
  }
  return order.map((unit) => byUnit.get(unit)!)
}

function sheetLampiranIII(wb: Workbook, rows: FormasiRow[]) {
  const ws = wb.addWorksheet('Lampiran III')
  const headers = ['No', 'Unit Kerja', 'K', 'B', 'F', 'Nama Jabatan', 'Jenjang', 'K', 'B', 'F']
  headers.forEach((h, i) => {
    ws.getCell(1, i + 1).value = h
  })

  const details = aggregateDetail(rows)
  let r = 2
  details.forEach((detail, i) => {
    const start = r
    for (const jab of detail.jabs) {
      const jabStart = r
      for (const j of jab.js) {
        ws.getCell(r, 6).value = jab.jabatan
        ws.getCell(r, 7).value = j.jenjang
        ws.getCell(r, 8).value = j.k
        ws.getCell(r, 9).value = j.b
        setFormula(ws.getCell(r, 10), `H${r}-I${r}`, j.k - j.b)
        r++
      }
      if (r - 1 > jabStart) ws.mergeCells(jabStart, 6, r - 1, 6)
    }
    const end = r - 1
    ws.getCell(start, 1).value = i + 1
    ws.getCell(start, 2).value = detail.unit
    ws.getCell(start, 3).value = detail.k
    ws.getCell(start, 4).value = detail.b
    setFormula(ws.getCell(start, 5), `C${start}-D${start}`, detail.k - detail.b)
    for (const col of [1, 2, 3, 4, 5]) {
      if (end > start) ws.mergeCells(start, col, end, col)
    }
  })
  const lastRow = r - 1

  setWidths(ws, [6, 48, 7, 7, 7, 48, 16, 7, 7, 7])
  finishSheet(ws, lastRow, 10, 1, [2, 6, 7])
  ws.pageSetup = { orientation: 'portrait', paperSize: 9 }
}

/* ------------------------------------------------------------ entrypoint */

/** Builds the full report workbook and returns the raw .xlsx bytes. */
export async function buildReport(
  rows: FormasiRow[],
  fungsionalStatus: FungsionalStatusMap,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Bagan Formasi Unit Organisasi'
  wb.created = new Date()

  const jf = aggregateJf(rows, fungsionalStatus)
  // Lampiran II lists jabatan fungsional alphabetically (A–Z), not by status.
  const jfAz = [...jf].sort((a, b) => a.jabatan.localeCompare(b.jabatan, 'id'))
  sheetTabel1(wb, rows)
  sheetTabel2(wb, jf)
  sheetLampiranI(wb, rows)
  sheetLampiranII(wb, rows, jfAz)
  sheetLampiranIII(wb, rows)

  return wb.xlsx.writeBuffer()
}
