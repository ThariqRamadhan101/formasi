import type { FormasiRow, OrgNode, OrgNodeKind } from './types'

/** Treat the workbook's placeholder "-" and empty strings as "no value". */
export function normalizeName(value: string | null | undefined): string {
  if (!value) return ''
  const text = value.trim()
  return text === '-' ? '' : text
}

/** The Eselon I row identifies the organization's root unit. */
export function rootRow(rows: FormasiRow[]): FormasiRow | undefined {
  return rows.find((row) => row.eselon === 'I')
}

/** Units that have an Eselon II structural row (Sekretariat / Direktorat, ...). */
export function centralUnitNames(rows: FormasiRow[]): Set<string> {
  const names = new Set<string>()
  for (const row of rows) {
    if (row.eselon === 'II' && row.unitKerja) names.add(row.unitKerja)
  }
  return names
}

/** Units that are not the root and have no Eselon II row (UPT / Balai, ...). */
export function satelliteUnitNames(rows: FormasiRow[]): Set<string> {
  const root = rootRow(rows)?.unitKerja
  const central = centralUnitNames(rows)
  const names = new Set<string>()
  for (const row of rows) {
    if (row.unitKerja && row.unitKerja !== root && !central.has(row.unitKerja)) names.add(row.unitKerja)
  }
  return names
}

/**
 * Assistant (staff) units are drawn to the right of their principal with an
 * L-shaped connector instead of straight below: the Sekretariat and the
 * "Tata Usaha" sub-units.
 */
export function isAssistant(label: string): boolean {
  const text = label.trim().toUpperCase()
  return text.startsWith('SEKRETARIAT') || text.includes('TATA USAHA')
}

/** Administrative sub-unit that co-manages a unit (e.g. Subbagian Tata Usaha). */
const CO_MANAGING = /subbagian.*tata usaha/i

function isCoManagingName(value: string): boolean {
  return CO_MANAGING.test(value)
}

function stripKepala(jabatan: string): string {
  return jabatan.replace(/^kepala\s+/i, '')
}

function makeNode(id: string, kind: OrgNodeKind, level: number, label: string): OrgNode {
  return { id, kind, level, label, rows: [], children: [], kebutuhan: 0, bezetting: 0, positionCount: 0 }
}

function headOf(rows: FormasiRow[]): FormasiRow | undefined {
  return rows.find((row) => row.jenisJabatan === 'Jabatan Struktural' && row.eselon !== '')
}

function attachSeksi(parent: OrgNode, groupRows: FormasiRow[], unitName: string, satuanName = '') {
  const seksiBuckets = new Map<string, FormasiRow[]>()
  for (const row of groupRows) {
    const seksi = normalizeName(row.seksiKerja)
    const effective = seksi && seksi !== unitName && seksi !== satuanName ? seksi : ''
    if (!effective) {
      parent.rows.push(row)
      continue
    }
    const bucket = seksiBuckets.get(effective)
    if (bucket) bucket.push(row)
    else seksiBuckets.set(effective, [row])
  }
  for (const [seksi, seksiRows] of seksiBuckets) {
    const seksiNode = makeNode(`${parent.id}-s${parent.children.length}`, 'seksi', parent.level + 1, seksi)
    seksiNode.structural = headOf(seksiRows)
    if (seksiNode.structural) seksiNode.eselon = seksiNode.structural.eselon
    seksiNode.rows.push(...seksiRows)
    parent.children.push(seksiNode)
  }
}

function aggregate(node: OrgNode): OrgNode {
  let kebutuhan = node.rows.reduce((sum, row) => sum + (row.kebutuhan || 0), 0)
  let bezetting = node.rows.reduce((sum, row) => sum + (row.bezetting || 0), 0)
  let positionCount = node.rows.length
  for (const child of node.children) {
    const done = aggregate(child)
    kebutuhan += done.kebutuhan
    bezetting += done.bezetting
    positionCount += done.positionCount
  }
  node.kebutuhan = kebutuhan
  node.bezetting = bezetting
  node.positionCount = positionCount
  return node
}

/**
 * Builds the organization tree from the flat formasi rows, without hard-coding
 * any organization name:
 *
 *   <Eselon I unit>
 *   ├─ Eselon II units (Sekretariat / Direktorat / ...)  → Satuan Kerja → Seksi
 *   └─ UPT (Eselon II)                                   → Satuan Kerja/Seksi (Balai, ...)
 *
 * Level-2 units are those with an Eselon II row; every other unit is grouped
 * under the "UPT" node. A row is attached to the deepest unit it belongs to, so
 * a parent's kebutuhan always equals the sum of its branches.
 */
export function buildOrgTree(rows: FormasiRow[]): OrgNode {
  let counter = 0
  const nextId = () => `n${counter++}`

  const rootInfo = rootRow(rows)
  const rootUnit = rootInfo?.unitKerja ?? ''
  const central = centralUnitNames(rows)

  const root = makeNode(nextId(), 'root', 1, rootInfo?.jabatan || rootUnit || 'Unit Organisasi')
  root.eselon = 'I'
  root.rows.push(...rows.filter((row) => row.unitKerja === rootUnit))

  const unitRows = new Map<string, FormasiRow[]>()
  for (const row of rows) {
    if (!row.unitKerja || row.unitKerja === rootUnit) continue
    const bucket = unitRows.get(row.unitKerja)
    if (bucket) bucket.push(row)
    else unitRows.set(row.unitKerja, [row])
  }

  const centralUnits: OrgNode[] = []
  const satelliteUnits: OrgNode[] = []

  for (const [unitName, members] of unitRows) {
    const isCentral = central.has(unitName)
    const node = makeNode(nextId(), isCentral ? 'unit' : 'balai', isCentral ? 2 : 3, unitName)
    const head = headOf(members)
    if (head) {
      node.structural = head
      node.eselon = head.eselon
    }

    const satuanBuckets = new Map<string, FormasiRow[]>()
    const direct: FormasiRow[] = []
    for (const row of members) {
      const satuan = normalizeName(row.satuanKerja)
      if (!satuan || satuan === unitName) {
        direct.push(row)
        continue
      }
      const bucket = satuanBuckets.get(satuan)
      if (bucket) bucket.push(row)
      else satuanBuckets.set(satuan, [row])
    }

    attachSeksi(node, direct, unitName)
    for (const [satuan, satuanRows] of satuanBuckets) {
      const subNode = makeNode(`${node.id}-u${node.children.length}`, 'subunit', node.level + 1, satuan)
      subNode.structural = headOf(satuanRows)
      if (subNode.structural) subNode.eselon = subNode.structural.eselon
      attachSeksi(subNode, satuanRows, unitName, satuan)
      node.children.push(subNode)
    }

    // A co-managing head can be stored as a structural row without a Seksi Kerja
    // (e.g. Balai's "Kepala Subbagian Umum dan Tata Usaha"). Merge it into the
    // matching sub-unit instead of creating a duplicate branch.
    const coRows = node.rows.filter((row) => isCoManagingName(row.jabatan))
    if (coRows.length > 0) {
      node.rows = node.rows.filter((row) => !coRows.includes(row))
      const target = stripKepala(coRows[0].jabatan)
      const existing = node.children.find(
        (child) => child.label.trim().toUpperCase() === target.trim().toUpperCase(),
      )
      if (existing) {
        const coHead = headOf(coRows)
        if (coHead) {
          existing.structural = coHead
          existing.eselon = coHead.eselon
        }
        existing.rows.push(...coRows)
      } else {
        const coNode = makeNode(`${node.id}-cm`, 'subunit', node.level + 1, target)
        coNode.structural = headOf(coRows)
        if (coNode.structural) coNode.eselon = coNode.structural.eselon
        coNode.rows.push(...coRows)
        node.children.push(coNode)
      }
    }

    if (isCentral) centralUnits.push(node)
    else satelliteUnits.push(node)
  }

  // Keep the workbook/data order (first appearance), not alphabetical, so the
  // units stay in the intended regional sequence.
  if (satelliteUnits.length > 0) {
    const upt = makeNode(nextId(), 'group', 2, 'Unit Pelaksana Teknis')
    upt.children.push(...satelliteUnits)
    root.children.push(...centralUnits, upt)
  } else {
    root.children.push(...centralUnits)
  }

  return aggregate(root)
}

/**
 * Filter a built tree by rows: keeps only rows matching `predicate`, prunes
 * branches with no matching rows, and recomputes the aggregates. Structural
 * nodes are kept as containers when any descendant matches, so the hierarchy
 * stays valid when filtering by (non-structural) jenis/jabatan.
 */
export function applyRowFilter(node: OrgNode, predicate: (row: FormasiRow) => boolean): OrgNode | null {
  const own = node.rows.filter(predicate)
  const children = node.children
    .map((child) => applyRowFilter(child, predicate))
    .filter((child): child is OrgNode => child !== null)
  if (own.length === 0 && children.length === 0) return null
  const kebutuhan =
    own.reduce((sum, row) => sum + row.kebutuhan, 0) +
    children.reduce((sum, child) => sum + child.kebutuhan, 0)
  const bezetting =
    own.reduce((sum, row) => sum + (row.bezetting || 0), 0) +
    children.reduce((sum, child) => sum + child.bezetting, 0)
  const positionCount = own.length + children.reduce((sum, child) => sum + child.positionCount, 0)
  return { ...node, rows: own, children, kebutuhan, bezetting, positionCount }
}

export function collectDescendantRows(node: OrgNode): FormasiRow[] {
  const result = [...node.rows]
  for (const child of node.children) result.push(...collectDescendantRows(child))
  return result
}

export function findNode(node: OrgNode, id: string): OrgNode | null {
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

export function flattenNodes(node: OrgNode, depth = 0): { node: OrgNode; depth: number }[] {
  const list: { node: OrgNode; depth: number }[] = [{ node, depth }]
  for (const child of node.children) list.push(...flattenNodes(child, depth + 1))
  return list
}

export interface OrgLookups {
  satuanByUnit: Record<string, string[]>
  seksiByUnitSatuan: Record<string, string[]>
  /** Seksi grouped by unit only — fallback when Satuan == Unit. */
  seksiByUnit: Record<string, string[]>
  jabatanByJenisJabatan: Record<string, string[]>
}

export function buildLookups(rows: FormasiRow[]): OrgLookups {
  const satuanByUnit: Record<string, Set<string>> = {}
  const seksiByUnitSatuan: Record<string, Set<string>> = {}
  const seksiByUnit: Record<string, Set<string>> = {}
  const jabatanByJenisJabatan: Record<string, Set<string>> = {}

  for (const row of rows) {
    const satuan = normalizeName(row.satuanKerja)
    if (satuan && satuan !== row.unitKerja) {
      ;(satuanByUnit[row.unitKerja] ??= new Set()).add(satuan)
      ;(seksiByUnitSatuan[`${row.unitKerja}||${satuan}`] ??= new Set())
    }
    const seksi = normalizeName(row.seksiKerja)
    if (seksi && seksi !== row.unitKerja) {
      ;(seksiByUnit[row.unitKerja] ??= new Set()).add(seksi)
      if (satuan && satuan !== row.unitKerja) {
        ;(seksiByUnitSatuan[`${row.unitKerja}||${satuan}`] ??= new Set()).add(seksi)
      }
    }
    ;(jabatanByJenisJabatan[row.jenisJabatan] ??= new Set()).add(row.jabatan)
  }

  const toSorted = (source: Record<string, Set<string>>) => {
    const out: Record<string, string[]> = {}
    for (const key of Object.keys(source)) out[key] = [...source[key]].sort((a, b) => a.localeCompare(b, 'id'))
    return out
  }
  return {
    satuanByUnit: toSorted(satuanByUnit),
    seksiByUnitSatuan: toSorted(seksiByUnitSatuan),
    seksiByUnit: toSorted(seksiByUnit),
    jabatanByJenisJabatan: toSorted(jabatanByJenisJabatan),
  }
}

export function kindLabel(kind: OrgNodeKind): string {
  switch (kind) {
    case 'root':
      return 'Eselon I'
    case 'group':
      return 'UPT BALAI'
    case 'unit':
      return 'Unit Eselon II'
    case 'balai':
      return 'UPT / Balai'
    case 'subunit':
      return 'Satuan Kerja'
    case 'seksi':
      return 'Seksi / Subbagian'
  }
}
