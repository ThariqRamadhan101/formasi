import { useMemo, useState } from 'react'
import {
  PIVOT_DIMENSIONS,
  PIVOT_MEASURES,
  computePivot,
  selectRows,
  uniqueFieldValues,
} from '../lib/pivot'
import { useStore } from '../lib/store'
import type { FormasiRow } from '../lib/types'

type ListArea = 'rows' | 'cols' | 'values'

interface FilterConfig {
  field: string
  values: string[]
}

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none'

const AREA_META: Record<ListArea, { label: string; hint: string; allowed: 'dimension' | 'measure' }> = {
  rows: { label: 'Baris (Rows)', hint: 'seret/tambah dimensi', allowed: 'dimension' },
  cols: { label: 'Kolom (Columns)', hint: 'seret/tambah dimensi', allowed: 'dimension' },
  values: { label: 'Nilai (Values)', hint: 'measure yang dihitung', allowed: 'measure' },
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(lines: string[][], name: string) {
  const text = lines.map((line) => line.map(csvCell).join(';')).join('\r\n')
  const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function PivotTable() {
  const { rows } = useStore()
  const [rowFields, setRowFields] = useState<string[]>(['unitKerja'])
  const [colFields, setColFields] = useState<string[]>(['jenisJabatan'])
  const [valueFields, setValueFields] = useState<string[]>(['kebutuhan'])
  const [filters, setFilters] = useState<FilterConfig[]>([])
  const [search, setSearch] = useState('')

  const lists: Record<ListArea, string[]> = { rows: rowFields, cols: colFields, values: valueFields }

  const setList = (area: ListArea, next: string[]) => {
    if (area === 'rows') setRowFields(next)
    else if (area === 'cols') setColFields(next)
    else setValueFields(next)
  }

  const addField = (area: ListArea, id: string) => {
    const current = lists[area]
    if (current.includes(id)) return
    setList(area, [...current, id])
  }

  const removeField = (area: ListArea, index: number) => {
    setList(
      area,
      lists[area].filter((_, i) => i !== index),
    )
  }

  const moveField = (area: ListArea, index: number, delta: number) => {
    const next = [...lists[area]]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setList(area, next)
  }

  const addFilter = (field: string) => {
    if (filters.some((filter) => filter.field === field)) return
    setFilters((prev) => [...prev, { field, values: [] }])
  }

  const removeFilter = (field: string) => setFilters((prev) => prev.filter((f) => f.field !== field))

  const toggleFilterValue = (field: string, value: string) =>
    setFilters((prev) =>
      prev.map((filter) =>
        filter.field === field
          ? {
              ...filter,
              values: filter.values.includes(value)
                ? filter.values.filter((item) => item !== value)
                : [...filter.values, value],
            }
          : filter,
      ),
    )

  const setAllFilterValues = (field: string, values: string[]) =>
    setFilters((prev) => prev.map((filter) => (filter.field === field ? { ...filter, values } : filter)))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = selectRows(rows, filters)
    if (!q) return base
    return base.filter((row: FormasiRow) =>
      `${row.jabatan} ${row.unitKerja} ${row.satuanKerja} ${row.seksiKerja}`.toLowerCase().includes(q),
    )
  }, [rows, filters, search])

  const pivot = useMemo(
    () => computePivot(filtered, { rows: rowFields, cols: colFields, values: valueFields, filters: [] }),
    [filtered, rowFields, colFields, valueFields],
  )

  const format = (value: number) => value.toLocaleString('id-ID')
  const valueCount = pivot.values.length
  const cornerCols = Math.max(1, pivot.rowFields.length)
  const headerRows = (pivot.colFields.length > 0 ? pivot.colFields.length : 0) + 1
  const hasData = pivot.rowLeaves.length > 0 && filtered.length > 0

  const exportCsv = () => {
    const lines: string[][] = []
    const header: string[] = new Array(cornerCols).fill(pivot.rowFields.map((f) => f.label).join(' / '))
    if (pivot.colFields.length > 0) {
      for (const leaf of pivot.colLeaves) {
        for (const value of pivot.values) header.push(`${leaf.labels.join(' / ')} — ${value.label}`)
      }
    } else {
      for (const value of pivot.values) header.push(value.label)
    }
    for (const value of pivot.values) header.push(`Total — ${value.label}`)
    lines.push(header)
    pivot.rowLeaves.forEach((leaf, ri) => {
      const line = [...leaf.labels]
      while (line.length < cornerCols) line.unshift('')
      for (const cell of pivot.cells[ri]) for (const value of cell) line.push(String(value))
      for (const total of pivot.rowTotals[ri]) line.push(String(total))
      lines.push(line)
    })
    const totalLine: string[] = ['Total']
    while (totalLine.length < cornerCols) totalLine.unshift('')
    for (const cell of pivot.colTotals) for (const value of cell) totalLine.push(String(value))
    for (const total of pivot.grandTotals) totalLine.push(String(total))
    lines.push(totalLine)
    downloadCsv(lines, `pivot-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const fieldButton = (id: string, area: ListArea, text: string) => {
    const used = lists[area].includes(id)
    return (
      <button
        key={area + id}
        type="button"
        onClick={() => addField(area, id)}
        disabled={used}
        className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
          used
            ? 'cursor-default border-slate-200 text-slate-300'
            : 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
        }`}
      >
        {text}
      </button>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="scroll-thin w-60 shrink-0 overflow-auto border-r border-slate-200 bg-white p-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Daftar Field</h3>

        <p className="mt-3 text-[11px] font-semibold text-slate-500">Dimensi</p>
        <div className="mt-1 space-y-1">
          {PIVOT_DIMENSIONS.map((dim) => (
            <div key={dim.id} className="rounded-md border border-slate-100 px-2 py-1">
              <p className="truncate text-[11px] font-medium text-slate-700" title={dim.label}>
                {dim.label}
              </p>
              <div className="mt-1 flex gap-1">
                {fieldButton(dim.id, 'rows', '+ Baris')}
                {fieldButton(dim.id, 'cols', '+ Kolom')}
                <button
                  type="button"
                  onClick={() => addFilter(dim.id)}
                  disabled={filters.some((f) => f.field === dim.id)}
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                    filters.some((f) => f.field === dim.id)
                      ? 'cursor-default border-slate-200 text-slate-300'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  + Filter
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[11px] font-semibold text-slate-500">Measure</p>
        <div className="mt-1 space-y-1">
          {PIVOT_MEASURES.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-100 px-2 py-1">
              <p className="truncate text-[11px] font-medium text-slate-700" title={item.label}>
                {item.label}
              </p>
              <div className="mt-1">{fieldButton(item.id, 'values', '+ Nilai')}</div>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-b border-slate-200 bg-white p-3">
          <div className="grid gap-2 md:grid-cols-3">
            {(['rows', 'cols', 'values'] as ListArea[]).map((area) => {
              const meta = AREA_META[area]
              const options = area === 'values' ? PIVOT_MEASURES : PIVOT_DIMENSIONS
              return (
                <div key={area} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-600">{meta.label}</p>
                    <span className="text-[10px] text-slate-400">{meta.hint}</span>
                  </div>
                  <div className="mt-1 min-h-[1.75rem] space-y-1">
                    {lists[area].map((id, index) => {
                      const label = options.find((option) => option.id === id)?.label ?? id
                      return (
                        <div
                          key={`${area}-${id}`}
                          className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px]"
                        >
                          <span className="min-w-0 flex-1 truncate text-slate-700" title={label}>
                            {label}
                          </span>
                          <button
                            type="button"
                            onClick={() => moveField(area, index, -1)}
                            disabled={index === 0}
                            className="px-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            aria-label="Naik"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveField(area, index, 1)}
                            disabled={index === lists[area].length - 1}
                            className="px-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            aria-label="Turun"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeField(area, index)}
                            className="px-0.5 text-rose-400 hover:text-rose-600"
                            aria-label="Hapus"
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                    {lists[area].length === 0 && (
                      <p className="px-1 text-[10px] italic text-slate-400">(kosong)</p>
                    )}
                  </div>
                  <select
                    value=""
                    onChange={(event) => {
                      if (event.target.value) addField(area, event.target.value)
                    }}
                    className={`${selectClass} mt-1 w-full`}
                  >
                    <option value="">+ Tambah…</option>
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>

          {filters.length > 0 && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="text-[11px] font-bold text-slate-600">Filter</p>
              <div className="mt-1 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {filters.map((filter) => {
                  const field = PIVOT_DIMENSIONS.find((dim) => dim.id === filter.field)
                  const values = uniqueFieldValues(rows, filter.field)
                  const allSelected = filter.values.length === 0
                  return (
                    <div key={filter.field} className="rounded border border-slate-200 bg-white p-2">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[11px] font-semibold text-slate-700">
                          {field?.label ?? filter.field}
                          {allSelected ? ' (semua)' : ` (${filter.values.length})`}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setAllFilterValues(filter.field, [])}
                            className="rounded border border-slate-300 px-1 py-0.5 text-[10px] hover:bg-slate-50"
                          >
                            Semua
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFilter(filter.field)}
                            className="rounded border border-rose-300 px-1 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="scroll-thin mt-1 max-h-32 space-y-0.5 overflow-auto">
                        {values.map((value) => (
                          <label
                            key={value}
                            className="flex cursor-pointer items-start gap-1.5 rounded px-1 py-0.5 text-[11px] hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={allSelected || filter.values.includes(value)}
                              onChange={() => toggleFilterValue(filter.field, value)}
                              className="mt-0.5"
                            />
                            <span className="text-slate-700">{value}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari jabatan / unit…"
              className="w-56 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setRowFields(['unitKerja'])
                setColFields(['jenisJabatan'])
                setValueFields(['kebutuhan'])
                setFilters([])
                setSearch('')
              }}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!hasData}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              ⬇ Download CSV
            </button>
            <div className="ml-auto text-xs text-slate-500">
              Baris sumber: <strong className="text-slate-800">{filtered.length.toLocaleString('id-ID')}</strong>
            </div>
          </div>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
          {!hasData ? (
            <p className="text-sm text-slate-500">Tidak ada data untuk dipivot dengan konfigurasi saat ini.</p>
          ) : (
            <table className="border-collapse bg-white text-xs shadow-sm">
              <thead className="sticky top-0 z-10">
                {pivot.colFields.length > 0 ? (
                  <>
                    {pivot.colFields.map((field, level) => (
                      <tr key={field.id + level}>
                        {level === 0 && (
                          <th
                            rowSpan={headerRows}
                            colSpan={cornerCols}
                            className="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-600"
                          >
                            {pivot.rowFields.map((f) => f.label).join(' / ') || 'Nilai'}
                          </th>
                        )}
                        {pivot.colHeader[level]?.map((header, index) => (
                          <th
                            key={`${level}-${index}`}
                            colSpan={header.span * valueCount}
                            className="border border-slate-200 bg-slate-100 px-3 py-2 text-center font-semibold text-slate-600"
                          >
                            {header.label}
                          </th>
                        ))}
                        {level === 0 && (
                          <th
                            rowSpan={headerRows}
                            colSpan={valueCount}
                            className="border border-slate-300 bg-brand-100 px-3 py-2 text-center font-bold text-brand-800"
                          >
                            Total
                          </th>
                        )}
                      </tr>
                    ))}
                    <tr>
                      {pivot.colLeaves.flatMap((_, ci) =>
                        pivot.values.map((value) => (
                          <th
                            key={`v-${ci}-${value.id}`}
                            className="border border-slate-200 bg-slate-50 px-3 py-1.5 text-right font-medium text-slate-500"
                          >
                            {value.label}
                          </th>
                        )),
                      )}
                    </tr>
                  </>
                ) : (
                  <tr>
                    <th
                      rowSpan={1}
                      colSpan={cornerCols}
                      className="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-600"
                    >
                      {pivot.rowFields.map((f) => f.label).join(' / ') || 'Nilai'}
                    </th>
                    {pivot.values.map((value, vi) => (
                      <th
                        key={`v-${vi}`}
                        className="border border-slate-200 bg-slate-100 px-3 py-2 text-right font-semibold text-slate-600"
                      >
                        {value.label}
                      </th>
                    ))}
                    <th
                      colSpan={valueCount}
                      className="border border-slate-300 bg-brand-100 px-3 py-2 text-center font-bold text-brand-800"
                    >
                      Total
                    </th>
                  </tr>
                )}
              </thead>
              <tbody>
                {pivot.rowLeaves.map((leaf, ri) => (
                  <tr key={leaf.key || 'total'} className="hover:bg-brand-50/40">
                    {pivot.rowFields.length > 0 ? (
                      pivot.rowFields.map((_, level) => {
                        const span = pivot.rowSpans[ri][level]
                        if (span === 0) return null
                        return (
                          <th
                            key={`rh-${ri}-${level}`}
                            rowSpan={span}
                            scope="rowgroup"
                            className="sticky left-0 border border-slate-200 bg-slate-50 px-3 py-1.5 text-left align-top font-medium text-slate-700"
                          >
                            {leaf.labels[level]}
                          </th>
                        )
                      })
                    ) : (
                      <th scope="row" className="border border-slate-200 bg-slate-50 px-3 py-1.5 text-left font-medium text-slate-700">
                        Total
                      </th>
                    )}
                    {pivot.cells[ri].map((cell, ci) =>
                      cell.map((value, vi) => (
                        <td
                          key={`c-${ri}-${ci}-${vi}`}
                          className={`border border-slate-200 px-3 py-1.5 text-right tabular-nums ${
                            value < 0 ? 'text-red-600' : 'text-slate-700'
                          }`}
                        >
                          {value === 0 ? '—' : format(value)}
                        </td>
                      )),
                    )}
                    {pivot.rowTotals[ri].map((value, vi) => (
                      <td
                        key={`rt-${ri}-${vi}`}
                        className="border border-slate-300 bg-brand-50 px-3 py-1.5 text-right font-semibold tabular-nums text-brand-800"
                      >
                        {format(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th
                    colSpan={cornerCols}
                    className="border border-slate-300 bg-slate-200 px-3 py-2 text-left font-bold text-slate-700"
                  >
                    Total
                  </th>
                  {pivot.colTotals.map((cell, ci) =>
                    cell.map((value, vi) => (
                      <td
                        key={`ct-${ci}-${vi}`}
                        className="border border-slate-300 bg-slate-100 px-3 py-2 text-right font-bold tabular-nums text-slate-800"
                      >
                        {format(value)}
                      </td>
                    )),
                  )}
                  {pivot.grandTotals.map((value, vi) => (
                    <td
                      key={`gt-${vi}`}
                      className="border border-slate-300 bg-brand-200 px-3 py-2 text-right font-bold tabular-nums text-brand-900"
                    >
                      {format(value)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
