import { useEffect, useMemo, useState } from 'react'
import { FUNGSIONAL_STATUS_ORDER, fungsionalStatusMeta } from '../lib/colors'
import { CATEGORY_LABELS, categoryOfJabatan } from '../lib/fungsional'
import { useStore } from '../lib/store'
import type { FungsionalStatusId, FungsionalStatusMap } from '../lib/types'

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-brand-500 focus:outline-none'

const STATUS_OPTIONS: FungsionalStatusId[] = FUNGSIONAL_STATUS_ORDER.map((id) => id as FungsionalStatusId)

interface FungsionalRow {
  jabatan: string
  kategori: string
  kebutuhan: number
  bezetting: number
  unitCount: number
  status: FungsionalStatusId
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(rows: FungsionalRow[]) {
  const headers = ['Jabatan Fungsional', 'Kategori', 'Kebutuhan', 'Bezetting', 'Formasi', 'Status']
  const lines = [
    headers.join(';'),
    ...rows.map((row) =>
      [
        row.jabatan,
        row.kategori,
        row.kebutuhan,
        row.bezetting,
        row.kebutuhan - row.bezetting,
        fungsionalStatusMeta(row.status)?.label ?? row.status,
      ]
        .map(csvCell)
        .join(';'),
    ),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `status-jabatan-fungsional-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function saveStatusJson(status: FungsionalStatusMap) {
  const payload = { generatedAt: new Date().toISOString(), status }
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'status-fungsional.json'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function StatusFungsional() {
  const { rows, fungsionalStatus, setFungsionalStatus, bulkSetFungsionalStatus } =
    useStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | FungsionalStatusId>('ALL')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<FungsionalStatusId>('BELUM_DIBUKA')
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const list = useMemo<FungsionalRow[]>(() => {
    // Only jabatan fungsional that have at least one row with Formasi = YA.
    const stats = new Map<string, { kebutuhan: number; bezetting: number; units: Set<string> }>()
    for (const row of rows) {
      if (row.jenisJabatan !== 'Jabatan Fungsional' || row.formasi !== 'YA') continue
      let entry = stats.get(row.jabatan)
      if (!entry) {
        entry = { kebutuhan: 0, bezetting: 0, units: new Set() }
        stats.set(row.jabatan, entry)
      }
      entry.kebutuhan += row.kebutuhan || 0
      entry.bezetting += row.bezetting || 0
      if (row.unitKerja) entry.units.add(row.unitKerja)
    }
    return [...stats.entries()].map(([jabatan, entry]) => ({
      jabatan,
      kategori: CATEGORY_LABELS[categoryOfJabatan(jabatan)],
      kebutuhan: entry.kebutuhan,
      bezetting: entry.bezetting,
      unitCount: entry.units.size,
      status: fungsionalStatus[jabatan] ?? 'BELUM_DIBUKA',
    }))
  }, [rows, fungsionalStatus])

  const counts = useMemo(() => {
    const out = new Map<FungsionalStatusId, number>()
    for (const id of STATUS_OPTIONS) out.set(id, 0)
    for (const item of list) out.set(item.status, (out.get(item.status) ?? 0) + 1)
    return out
  }, [list])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list
      .filter((item) => {
        if (statusFilter !== 'ALL' && item.status !== statusFilter) return false
        if (q && !item.jabatan.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => a.jabatan.localeCompare(b.jabatan, 'id'))
  }, [list, search, statusFilter])

  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.jabatan))

  const toggle = (jabatan: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(jabatan)) next.delete(jabatan)
      else next.add(jabatan)
      return next
    })

  const toggleAll = () =>
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        filtered.forEach((item) => next.delete(item.jabatan))
        return next
      }
      const next = new Set(prev)
      filtered.forEach((item) => next.add(item.jabatan))
      return next
    })

  const applyBulk = () => {
    if (selected.size === 0) return
    bulkSetFungsionalStatus([...selected], bulkStatus)
    setSelected(new Set())
  }

  const handleSave = () => {
    saveStatusJson(fungsionalStatus)
    setNotice({
      text: 'status-fungsional.json diunduh — timpa database/status-fungsional.json lalu jalankan "npm run extract".',
      error: false,
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari jabatan fungsional…"
          className="w-64 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'ALL' | FungsionalStatusId)}
          className={selectClass}
        >
          <option value="ALL">Semua status</option>
          {STATUS_OPTIONS.map((id) => (
            <option key={id} value={id}>
              {fungsionalStatusMeta(id)?.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          💾 Simpan
        </button>
        <button
          type="button"
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          ⬇ Download CSV
        </button>
        {notice && (
          <span className={`text-xs font-medium ${notice.error ? 'text-rose-600' : 'text-emerald-600'}`}>
            {notice.text}
          </span>
        )}
        <div className="ml-auto flex gap-4 text-xs text-slate-500">
          <span>
            Jabatan: <strong className="text-slate-800">{list.length.toLocaleString('id-ID')}</strong>
          </span>
          <span className="text-slate-400">hanya Formasi YA</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
        {STATUS_OPTIONS.map((id) => {
          const meta = fungsionalStatusMeta(id)
          return (
            <span
              key={id}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta?.badge ?? 'bg-slate-200'}`}
            >
              {meta?.label}: {counts.get(id) ?? 0}
            </span>
          )
        })}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-brand-200 bg-brand-50 px-4 py-2 text-xs text-brand-800">
          <span>{selected.size} dipilih</span>
          <select
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value as FungsionalStatusId)}
            className={selectClass}
          >
            {STATUS_OPTIONS.map((id) => (
              <option key={id} value={id}>
                {fungsionalStatusMeta(id)?.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBulk}
            className="rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Terapkan ke yang dipilih
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
          >
            Batal
          </button>
        </div>
      )}

      <div className="scroll-thin min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-500">
            <tr>
              <th className="w-8 px-3 py-2">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Pilih semua" />
              </th>
              <th className="px-3 py-2 font-semibold">Jabatan Fungsional</th>
              <th className="px-3 py-2 font-semibold">Kategori</th>
              <th className="px-3 py-2 text-right font-semibold">Kebutuhan</th>
              <th className="px-3 py-2 text-right font-semibold">Bezetting</th>
              <th className="px-3 py-2 text-right font-semibold">Formasi</th>
              <th className="px-3 py-2 font-semibold">Unit</th>
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.map((item) => {
              const meta = fungsionalStatusMeta(item.status)
              return (
                <tr key={item.jabatan} className={meta?.row ?? 'hover:bg-brand-50/40'}>
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={selected.has(item.jabatan)}
                      onChange={() => toggle(item.jabatan)}
                      aria-label={`Pilih ${item.jabatan}`}
                    />
                  </td>
                  <td className="px-3 py-1.5 font-medium text-slate-800">{item.jabatan}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{item.kategori}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-800">
                    {item.kebutuhan.toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium text-emerald-700">
                    {item.bezetting.toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-700">
                    {(item.kebutuhan - item.bezetting).toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{item.unitCount}</td>
                  <td className="px-3 py-1.5">
                    <select
                      value={item.status}
                      onChange={(event) =>
                        setFungsionalStatus(item.jabatan, event.target.value as FungsionalStatusId)
                      }
                      className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                        meta?.badge ?? 'border-slate-300 bg-white'
                      }`}
                    >
                      {STATUS_OPTIONS.map((id) => (
                        <option key={id} value={id}>
                          {fungsionalStatusMeta(id)?.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                  Tidak ada jabatan fungsional yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
