import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { BulkForm } from './components/BulkForm'
import { DataExplorer } from './components/DataExplorer'
import { DataPegawai } from './components/DataPegawai'
import { Header, type TabId } from './components/Header'
import { NodeDetail } from './components/NodeDetail'
import { OptionManager } from './components/OptionManager'
import { OrgChart } from './components/OrgChart'
import { PivotTable } from './components/PivotTable'
import { StatusFungsional } from './components/StatusFungsional'
import { applyRowFilter, buildOrgTree, findNode } from './lib/formasi'
import { functionalCategory } from './lib/fungsional'
import { StoreProvider, useStore } from './lib/store'
import type { FormasiRow, FungsionalCategory } from './lib/types'

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 text-center">{children}</div>
}

function Shell() {
  const { ready, error, rows, generatedAt, formasiList, jenisJabatan } = useStore()
  const [tab, setTab] = useState<TabId>('chart')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formasiFilter, setFormasiFilter] = useState('ALL')
  const [jenisFilter, setJenisFilter] = useState('ALL')
  const [jabatanFilter, setJabatanFilter] = useState('ALL')
  const [jenjangFilter, setJenjangFilter] = useState('ALL')
  const [kategoriFilter, setKategoriFilter] = useState<FungsionalCategory | 'ALL'>('ALL')
  const [showDetail, setShowDetail] = useState(false)

  const fullTree = useMemo(() => (ready ? buildOrgTree(rows) : null), [ready, rows])

  const tree = useMemo(() => {
    if (!fullTree) return null
    const predicate = (row: FormasiRow) =>
      (formasiFilter === 'ALL' || row.formasi === formasiFilter) &&
      (jenisFilter === 'ALL' || row.jenisJabatan === jenisFilter) &&
      (jabatanFilter === 'ALL' || row.jabatan === jabatanFilter) &&
      (jenjangFilter === 'ALL' || row.jenjang === jenjangFilter) &&
      (kategoriFilter === 'ALL' || functionalCategory(row) === kategoriFilter)
    return applyRowFilter(fullTree, predicate)
  }, [fullTree, formasiFilter, jenisFilter, jabatanFilter, jenjangFilter, kategoriFilter])

  const jabatanOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      if (jenisFilter !== 'ALL' && row.jenisJabatan !== jenisFilter) continue
      if (row.jabatan) set.add(row.jabatan)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'id'))
  }, [rows, jenisFilter])

  const jenjangOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      if (row.jenjang) set.add(row.jenjang)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'id'))
  }, [rows])

  const selected = tree && selectedId ? findNode(tree, selectedId) : null

  if (!ready) {
    return (
      <Centered>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="text-sm text-slate-500">Memuat data formasi…</p>
      </Centered>
    )
  }

  if (error || !fullTree) {
    return (
      <Centered>
        <p className="text-base font-semibold text-rose-600">Gagal memuat data</p>
        <p className="max-w-md text-sm text-slate-500">{error ?? 'Data tidak tersedia.'}</p>
        <code className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700">npm run extract</code>
      </Centered>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        rows={rows}
        generatedAt={generatedAt}
        rootLabel={fullTree.label}
        tab={tab}
        onTab={setTab}
      />

      <main className="min-h-0 flex-1">
        {tab === 'chart' && (
          <div className="flex h-full min-h-0 flex-col lg:flex-row">
            <div className="min-w-0 flex-1 lg:border-r lg:border-slate-200 bg-white">
              {tree ? (
                <OrgChart
                  tree={tree}
                  selectedId={selectedId}
                  onSelect={(node) => {
                    setSelectedId(node.id)
                    setShowDetail(true)
                  }}
                  query={query}
                  onQuery={setQuery}
                  formasiFilter={formasiFilter}
                  onFormasiFilter={setFormasiFilter}
                  formasiOptions={formasiList}
                  jenisFilter={jenisFilter}
                  onJenisFilter={(value) => {
                    setJenisFilter(value)
                    setJabatanFilter('ALL')
                  }}
                  jenisOptions={jenisJabatan}
                  jabatanFilter={jabatanFilter}
                  onJabatanFilter={setJabatanFilter}
                  jabatanOptions={jabatanOptions}
                  jenjangFilter={jenjangFilter}
                  onJenjangFilter={setJenjangFilter}
                  jenjangOptions={jenjangOptions}
                  kategoriFilter={kategoriFilter}
                  onKategoriFilter={setKategoriFilter}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-400">
                  Tidak ada data yang cocok dengan filter.
                </div>
              )}
            </div>

            {/* Desktop side panel (hidden on mobile). */}
            <aside className="lg:block w-0 lg:w-80 shrink-0 bg-white border-l border-slate-200 overflow-hidden transition-all duration-200">
              {showDetail && selected && (
                <div className="h-full flex flex-col">
                  <NodeDetail node={selected} />
                </div>
              )}
            </aside>

            {/* Mobile bottom sheet for node detail. */}
            {showDetail && selected && (
              <div className="lg:hidden fixed inset-x-0 bottom-0 z-[60] bg-white border-t border-slate-200 shadow-2xl transform transition-transform duration-300 ease-in-out translate-y-0 max-h-[75vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 shrink-0">
                  <h2 className="font-medium text-sm">Detail Node</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetail(false)
                      setSelectedId(null)
                    }}
                    className="text-slate-500 hover:text-slate-700"
                    aria-label="Tutup detail"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <NodeDetail node={selected} />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'data' && <div className="overflow-x-auto"><DataExplorer /></div>}
        {tab === 'pegawai' && <div className="overflow-x-auto"><DataPegawai /></div>}
        {tab === 'fungsional' && <div className="overflow-x-auto"><StatusFungsional /></div>}
        {tab === 'pivot' && <div className="overflow-x-auto"><PivotTable /></div>}
        {tab === 'input' && <div className="p-4 lg:p-6"><BulkForm /></div>}
        {tab === 'opsi' && <div className="p-4 lg:p-6"><OptionManager /></div>}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
