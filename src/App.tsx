import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
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

const DETAIL_WIDTH_KEY = 'formasi-detail-width'
const DETAIL_WIDTH_DEFAULT = 384
const DETAIL_WIDTH_MIN = 320
const DETAIL_WIDTH_MAX = 720

function clampDetailWidth(width: number): number {
  const viewportMax =
    typeof window === 'undefined'
      ? DETAIL_WIDTH_MAX
      : Math.max(DETAIL_WIDTH_MIN, Math.min(DETAIL_WIDTH_MAX, window.innerWidth - 480))
  return Math.min(viewportMax, Math.max(DETAIL_WIDTH_MIN, width))
}

function loadDetailWidth(): number {
  if (typeof window === 'undefined') return DETAIL_WIDTH_DEFAULT
  const stored = Number(window.localStorage.getItem(DETAIL_WIDTH_KEY))
  return Number.isFinite(stored) && stored > 0 ? clampDetailWidth(stored) : DETAIL_WIDTH_DEFAULT
}

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
  const [detailWidth, setDetailWidth] = useState(loadDetailWidth)
  const [resizing, setResizing] = useState(false)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const resizeStart = useRef<{ x: number; width: number } | null>(null)

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

  // Prevent background scroll when the mobile bottom-sheet detail is open.
  useEffect(() => {
    if (showDetail && selected) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [showDetail, selected])

  // Track pointer movement while the desktop panel is being resized.
  useEffect(() => {
    if (!resizing) return
    const handleMove = (event: PointerEvent) => {
      const start = resizeStart.current
      if (!start) return
      setDetailWidth(clampDetailWidth(start.width + (start.x - event.clientX)))
    }
    const handleUp = () => {
      resizeStart.current = null
      setResizing(false)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [resizing])

  // Remember the last width once dragging stops.
  useEffect(() => {
    if (!resizing) window.localStorage.setItem(DETAIL_WIDTH_KEY, String(detailWidth))
  }, [detailWidth, resizing])

  // Keep the panel inside the viewport when the window shrinks.
  useEffect(() => {
    const handleResize = () => setDetailWidth((width) => clampDetailWidth(width))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    resizeStart.current = { x: event.clientX, width: detailWidth }
    setResizing(true)
  }

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
                    setSheetExpanded(false)
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

            {/* Desktop side panel (hidden on mobile), resizable via its left edge. */}
            <aside
              className={`relative hidden shrink-0 overflow-hidden border-l border-slate-200 bg-white lg:block ${
                resizing ? '' : 'transition-[width] duration-200'
              }`}
              style={{ width: showDetail && selected ? detailWidth : 0 }}
            >
              {showDetail && selected && (
                <>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Atur lebar panel rincian"
                    title="Tarik untuk mengatur lebar · klik dua kali untuk reset"
                    tabIndex={0}
                    onPointerDown={startResize}
                    onDoubleClick={() => setDetailWidth(clampDetailWidth(DETAIL_WIDTH_DEFAULT))}
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                      event.preventDefault()
                      setDetailWidth((width) =>
                        clampDetailWidth(width + (event.key === 'ArrowLeft' ? 24 : -24)),
                      )
                    }}
                    className={`absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize touch-none outline-none ${
                      resizing
                        ? 'bg-brand-400'
                        : 'bg-transparent hover:bg-brand-300 focus-visible:bg-brand-300'
                    }`}
                  />
                  <div className="flex h-full flex-col">
                    <NodeDetail node={selected} />
                  </div>
                </>
              )}
            </aside>

            {/* Mobile bottom sheet for node detail with backdrop overlay. */}
            {showDetail && selected && (
              <>
                {/* Backdrop: tap to close */}
                <div
                  className="lg:hidden fixed inset-0 z-[50] bg-black/40 backdrop-blur-sm"
                  onClick={() => {
                    setShowDetail(false)
                    setSelectedId(null)
                    setSheetExpanded(false)
                  }}
                  aria-hidden="true"
                />
                <div
                  className={`lg:hidden fixed inset-x-0 bottom-0 z-[60] flex w-full translate-y-0 flex-col border-t border-slate-200 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
                    sheetExpanded ? 'h-[100dvh]' : 'max-h-[92vh]'
                  }`}
                >
                  <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-2">
                    <h2 className="text-sm font-medium">Detail Node</h2>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSheetExpanded((value) => !value)}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                        aria-label={sheetExpanded ? 'Perkecil detail' : 'Perbesar detail'}
                      >
                        {sheetExpanded ? 'Perkecil' : 'Perbesar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDetail(false)
                          setSelectedId(null)
                          setSheetExpanded(false)
                        }}
                        className="text-slate-500 hover:text-slate-700"
                        aria-label="Tutup detail"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 w-full overflow-y-auto p-4">
                    <NodeDetail node={selected} />
                  </div>
                </div>
              </>
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
