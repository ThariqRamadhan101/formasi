import type { FormasiRow } from '../lib/types'

export type TabId = 'chart' | 'data' | 'pegawai' | 'fungsional' | 'pivot' | 'input' | 'opsi'

const TABS: { id: TabId; label: string }[] = [
  { id: 'chart', label: 'Bagan Organisasi' },
  { id: 'data', label: 'Data Formasi' },
  { id: 'pegawai', label: 'Data Pegawai' },
  { id: 'fungsional', label: 'Status Fungsional' },
  { id: 'pivot', label: 'Pivot Data' },
  { id: 'input', label: 'Input Formasi' },
  { id: 'opsi', label: 'Pengaturan Opsi' },
]

interface HeaderProps {
  rows: FormasiRow[]
  generatedAt: string
  rootLabel: string
  tab: TabId
  onTab: (tab: TabId) => void
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-lg bg-white/10 px-2 py-1 text-center flex-shrink-0 sm:px-3 sm:py-1.5">
      <p className={`text-sm font-bold leading-none ${tone} sm:text-base`}>
        {typeof value === 'number' ? value.toLocaleString('id-ID') : value}
      </p>
      <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-white/70 sm:text-[10px]">{label}</p>
    </div>
  )
}

export function Header({ rows, generatedAt, rootLabel, tab, onTab }: HeaderProps) {
  const kebutuhan = rows.reduce((sum, row) => sum + row.kebutuhan, 0)
  const bezetting = rows.reduce((sum, row) => sum + (row.bezetting ?? 0), 0)
  const units = new Set(rows.map((row) => row.unitKerja).filter(Boolean)).size
  const jabatan = new Set(rows.map((row) => row.jabatan).filter(Boolean)).size

  return (
    <header className="z-20 bg-brand-800 text-white shadow-md">
      <div className="px-4 py-3">
        {/* Title + subtitle stacked above stats on mobile, side-by-side on desktop */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight truncate">Bagan Formasi Unit Organisasi</h1>
            <p className="text-[11px] text-brand-100 truncate">
              {rootLabel || 'Unit Organisasi'} · data per {new Date(generatedAt).toLocaleDateString('id-ID')}
            </p>
          </div>

          {/* Stats: 2-col grid on mobile, single row on desktop */}
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0 lg:flex-1 lg:justify-end">
            <Stat label="Kebutuhan" value={kebutuhan} tone="text-white" />
            <Stat label="Bezetting" value={bezetting} tone="text-emerald-200" />
            <Stat label="Entri" value={rows.length} tone="text-brand-100" />
            <Stat label="Unit kerja" value={units} tone="text-white" />
            <Stat label="Jabatan" value={jabatan} tone="text-white" />
          </div>
        </div>
      </div>

      {/* Tab navigation: horizontal scroll with visible indicator on mobile */}
      <nav className="flex gap-1 px-4 pb-3 overflow-x-auto scrollbar-hide -mx-4 px-4" role="tablist" aria-label="Navigasi tab utama">
        <div className="flex gap-1 min-w-max">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => onTab(item.id)}
              className={`rounded-t-lg px-3 py-2 text-xs font-medium transition whitespace-nowrap flex-shrink-0 sm:px-4 sm:text-sm ${
                tab === item.id ? 'bg-slate-100 text-brand-800' : 'text-white/70 hover:bg-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {/* Scroll hint for mobile */}
        <div className="absolute right-0 top-0 bottom-0 w-4 flex items-center pointer-events-none bg-gradient-to-r from-brand-800/0 to-brand-800 opacity-0 sm:hidden">
          <span className="text-[10px] font-bold text-brand-100">›</span>
        </div>
      </nav>
    </header>
  )
}
