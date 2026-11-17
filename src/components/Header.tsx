import { useState } from 'react'
import type { FormasiRow, FungsionalStatusMap } from '../lib/types'
import { buildReport } from '../lib/report'

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
  fungsionalStatus: FungsionalStatusMap
  generatedAt: string
  rootLabel: string
  tab: TabId
  onTab: (tab: TabId) => void
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-lg bg-white/10 px-3 py-1.5 text-center">
      <p className={`text-base font-bold leading-none ${tone}`}>
        {typeof value === 'number' ? value.toLocaleString('id-ID') : value}
      </p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/70">{label}</p>
    </div>
  )
}

export function Header({ rows, fungsionalStatus, generatedAt, rootLabel, tab, onTab }: HeaderProps) {
  const [building, setBuilding] = useState(false)
  const kebutuhan = rows.reduce((sum, row) => sum + row.kebutuhan, 0)
  const bezetting = rows.reduce((sum, row) => sum + (row.bezetting ?? 0), 0)
  const units = new Set(rows.map((row) => row.unitKerja).filter(Boolean)).size
  const jabatan = new Set(rows.map((row) => row.jabatan).filter(Boolean)).size

  async function downloadReport() {
    if (building) return
    setBuilding(true)
    try {
      const buffer = await buildReport(rows, fungsionalStatus)
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `Lampiran_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Gagal membuat report', error)
      alert(`Gagal membuat report: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBuilding(false)
    }
  }

  return (
    <header className="z-20 bg-brand-800 text-white shadow-md">
      <div className="flex flex-wrap items-center gap-4 px-5 py-3">
        <div>
          <h1 className="text-lg font-bold leading-tight">Bagan Formasi Unit Organisasi</h1>
          <p className="text-[11px] text-brand-100">
            {rootLabel || 'Unit Organisasi'} · data per {new Date(generatedAt).toLocaleDateString('id-ID')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Stat label="Kebutuhan" value={kebutuhan} tone="text-white" />
          <Stat label="Bezetting" value={bezetting} tone="text-emerald-200" />
          <Stat label="Entri" value={rows.length} tone="text-brand-100" />
          <Stat label="Unit kerja" value={units} tone="text-white" />
          <Stat label="Jabatan" value={jabatan} tone="text-white" />
        </div>

        <button
          type="button"
          onClick={() => void downloadReport()}
          disabled={building}
          title="Unduh report Excel (Tabel 1, Tabel 2, Lampiran I–III) dari data saat ini"
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/25 disabled:cursor-wait disabled:opacity-70"
        >
          {building ? '⏳ Membuat report…' : '📥 Unduh Report'}
        </button>
      </div>

      <nav className="flex gap-1 px-4">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTab(item.id)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              tab === item.id ? 'bg-slate-100 text-brand-800' : 'text-white/70 hover:bg-white/10'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
