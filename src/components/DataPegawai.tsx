import { useEffect, useMemo, useState } from 'react'
import { eselonColor } from '../lib/colors'
import { CATEGORY_OPTIONS, functionalCategory } from '../lib/fungsional'
import { useStore } from '../lib/store'
import type { FungsionalCategory } from '../lib/types'

const PAGE_SIZES = [25, 50, 100, 250] as const
type PageSize = (typeof PAGE_SIZES)[number] | 'all'

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-brand-500 focus:outline-none'

interface EmployeeView {
  nama: string
  nip: string
  status: string
  unitKerja: string
  satuanKerja: string
  seksiKerja: string
  jabatan: string
  jenjang: string
  jenisJabatan: string
  eselon: string
  formasi: string
  kategori: FungsionalCategory
}

const CSV_HEADERS = [
  'Nama',
  'NIP',
  'Status',
  'Jabatan',
  'Jenjang',
  'Jenis Jabatan',
  'Eselon',
  'Unit Kerja',
  'Satuan Kerja',
  'Seksi Kerja',
  'Formasi?',
]

const HEADERS = ['#', ...CSV_HEADERS]

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(rows: EmployeeView[]) {
  const lines = [
    CSV_HEADERS.join(';'),
    ...rows.map((row) =>
      [
        row.nama,
        row.nip,
        row.status,
        row.jabatan,
        row.jenjang,
        row.jenisJabatan,
        row.eselon,
        row.unitKerja,
        row.satuanKerja,
        row.seksiKerja,
        row.formasi,
      ]
        .map(csvCell)
        .join(';'),
    ),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `data-pegawai-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const wanted = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...wanted].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
  const result: (number | '…')[] = []
  let previous = 0
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push('…')
    result.push(page)
    previous = page
  }
  return result
}

export function DataPegawai() {
  const { rows, options } = useStore()
  const [search, setSearch] = useState('')
  const [unit, setUnit] = useState('')
  const [status, setStatus] = useState('')
  const [jenis, setJenis] = useState('')
  const [jenjang, setJenjang] = useState('')
  const [kategori, setKategori] = useState<FungsionalCategory | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(50)

  const employees = useMemo(() => {
    const list: EmployeeView[] = []
    for (const row of rows) {
      for (const pegawai of row.pegawai ?? []) {
        list.push({
          nama: pegawai.nama,
          nip: pegawai.nip,
          status: pegawai.status,
          unitKerja: row.unitKerja,
          satuanKerja: row.satuanKerja,
          seksiKerja: row.seksiKerja,
          jabatan: row.jabatan,
          jenjang: row.jenjang,
          jenisJabatan: row.jenisJabatan,
          eselon: row.eselon,
          formasi: row.formasi,
          kategori: functionalCategory(row),
        })
      }
    }
    return list
  }, [rows])

  const statuses = useMemo(
    () => [...new Set(employees.map((e) => e.status).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id')),
    [employees],
  )
  const jenisList = useMemo(
    () => [...new Set(employees.map((e) => e.jenisJabatan).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id')),
    [employees],
  )
  const jenjangList = useMemo(
    () => [...new Set(employees.map((e) => e.jenjang).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id')),
    [employees],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return employees.filter((e) => {
      if (unit && e.unitKerja !== unit) return false
      if (status && e.status !== status) return false
      if (jenis && e.jenisJabatan !== jenis) return false
      if (jenjang && e.jenjang !== jenjang) return false
      if (kategori !== 'ALL' && e.kategori !== kategori) return false
      if (q && !`${e.nama} ${e.nip} ${e.jabatan} ${e.unitKerja}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [employees, search, unit, status, jenis, jenjang, kategori])

  useEffect(() => {
    setPage(1)
  }, [search, unit, status, jenis, jenjang, kategori, pageSize])

  const effectiveSize = pageSize === 'all' ? Math.max(filtered.length, 1) : pageSize
  const pageCount = Math.max(1, Math.ceil(filtered.length / effectiveSize))
  const current = Math.min(page, pageCount)
  const pageRows =
    pageSize === 'all' ? filtered : filtered.slice((current - 1) * effectiveSize, current * effectiveSize)
  const firstRow = filtered.length === 0 ? 0 : (current - 1) * effectiveSize + 1
  const lastRow = pageSize === 'all' ? filtered.length : Math.min(current * effectiveSize, filtered.length)

  const tanpaFormasi = useMemo(() => employees.filter((e) => e.formasi === 'TIDAK').length, [employees])

  const reset = () => {
    setSearch('')
    setUnit('')
    setStatus('')
    setJenis('')
    setJenjang('')
    setKategori('ALL')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari nama / NIP / jabatan…"
          className="w-56 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
        />
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className={`${selectClass} max-w-[16rem]`}>
          <option value="">Semua unit kerja</option>
          {options.unitKerja.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">Semua status</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={jenis} onChange={(e) => setJenis(e.target.value)} className={`${selectClass} max-w-[14rem]`}>
          <option value="">Semua jenis jabatan</option>
          {jenisList.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={jenjang} onChange={(e) => setJenjang(e.target.value)} className={selectClass}>
          <option value="">Semua jenjang</option>
          {jenjangList.map((item) => (
            <option key={item} value={item}>
              {item === '-' ? '—' : item}
            </option>
          ))}
        </select>
        <select
          value={kategori}
          onChange={(e) => setKategori(e.target.value as FungsionalCategory | 'ALL')}
          className={selectClass}
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          ⬇ Download CSV
        </button>
        <div className="ml-auto flex gap-4 text-xs text-slate-500">
          <span>
            Pegawai: <strong className="text-slate-800">{filtered.length.toLocaleString('id-ID')}</strong>
          </span>
          <span>
            Luar formasi:{' '}
            <strong className="text-red-600">{tanpaFormasi.toLocaleString('id-ID')}</strong>
          </span>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-500">
            <tr>
              {HEADERS.map((header, index) => (
                <th key={header || `col-${index}`} className="whitespace-nowrap px-3 py-2 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {pageRows.map((row, index) => {
              const color = eselonColor(row.eselon)
              return (
                <tr key={`${row.nip}-${index}`} className={color ? color.row : 'hover:bg-brand-50/40'}>
                  <td className="px-3 py-1.5 text-slate-400">{firstRow + index}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-medium text-slate-800">{row.nama}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-slate-500">{row.nip}</td>
                  <td className="px-3 py-1.5 text-slate-500">{row.status}</td>
                  <td className="px-3 py-1.5 text-slate-700">{row.jabatan}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{row.jenjang === '-' ? '—' : row.jenjang}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{row.jenisJabatan}</td>
                  <td className="px-3 py-1.5">
                    {color ? (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${color.badge}`}>
                        {row.eselon}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="max-w-[16rem] px-3 py-1.5 text-slate-600">{row.unitKerja}</td>
                </tr>
              )
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={HEADERS.length} className="px-3 py-10 text-center text-slate-400">
                  Tidak ada data pegawai yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
        <span>
          Menampilkan {firstRow.toLocaleString('id-ID')}–{lastRow.toLocaleString('id-ID')} dari{' '}
          {filtered.length.toLocaleString('id-ID')}
        </span>
        <label className="flex items-center gap-1.5">
          Per halaman
          <select
            value={String(pageSize)}
            onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : (Number(e.target.value) as PageSize))}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
            <option value="all">Semua</option>
          </select>
        </label>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
            className="rounded-md border border-slate-300 px-2 py-1 font-medium disabled:opacity-40"
          >
            ‹
          </button>
          {pageNumbers(current, pageCount).map((item, index) =>
            item === '…' ? (
              <span key={`gap-${index}`} className="px-1">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => setPage(item)}
                className={`min-w-[1.75rem] rounded-md border px-2 py-1 font-medium ${
                  item === current ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={current >= pageCount}
            onClick={() => setPage(current + 1)}
            className="rounded-md border border-slate-300 px-2 py-1 font-medium disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  )
}
