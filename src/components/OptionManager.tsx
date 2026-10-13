import { useEffect, useMemo, useRef, useState } from 'react'
import { seksiKey } from '../lib/optionModel'
import { useStore } from '../lib/store'
import type { FormasiDatabase, FormasiRow, ModelPath } from '../lib/types'

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-brand-500 focus:outline-none'

const JABATAN_GROUPS = ['I', 'II', 'III', 'IV', 'Fungsional', 'Pelaksana'] as const
type JabatanGroup = (typeof JABATAN_GROUPS)[number]

function usageMap(rows: FormasiRow[], path: ModelPath): Map<string, number> {
  const map = new Map<string, number>()
  const bump = (value: string) => {
    if (value && value !== '-') map.set(value, (map.get(value) ?? 0) + 1)
  }
  for (const row of rows) {
    switch (path.kind) {
      case 'unitKerja':
        bump(row.unitKerja)
        break
      case 'satuanByUnit':
        if (row.unitKerja === path.unit) bump(row.satuanKerja)
        break
      case 'seksiByKey': {
        const unit = path.key.slice(0, path.key.indexOf('||'))
        const satuan = path.key.slice(path.key.indexOf('||') + 2)
        const satuanMatch = satuan ? row.satuanKerja === satuan : row.satuanKerja === row.unitKerja
        if (row.unitKerja === unit && satuanMatch) bump(row.seksiKerja)
        break
      }
      case 'jabatanStruktural':
        if (row.jenisJabatan === 'Jabatan Struktural' && row.eselon === path.eselon) bump(row.jabatan)
        break
      case 'jabatanFungsional':
        if (row.jenisJabatan === 'Jabatan Fungsional') bump(row.jabatan)
        break
      case 'jabatanPelaksana':
        if (row.jenisJabatan === 'Jabatan Pelaksana') bump(row.jabatan)
        break
      case 'jenjangFungsional':
        if (row.jenisJabatan === 'Jabatan Fungsional') bump(row.jenjang)
        break
    }
  }
  return map
}

function OptionRow({
  value,
  count,
  onRemove,
  onRename,
}: {
  value: string
  count: number
  onRemove: () => void
  onRename: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = () => {
    if (draft.trim() && draft.trim() !== value) onRename(draft.trim())
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-slate-50">
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
          onBlur={commit}
          className="min-w-0 flex-1 rounded border border-brand-400 px-1.5 py-0.5 text-xs focus:outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-slate-700" title={value}>
          {value}
        </span>
      )}
      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{count}×</span>
      <button
        type="button"
        onClick={() => {
          setDraft(value)
          setEditing((v) => !v)
        }}
        className="shrink-0 rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label={`Ubah ${value}`}
      >
        ✎
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded px-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600"
        aria-label={`Hapus ${value}`}
      >
        ✕
      </button>
    </div>
  )
}

function OptionList({
  title,
  subtitle,
  path,
  placeholder,
  bare = false,
}: {
  title: string
  subtitle?: string
  path: ModelPath
  placeholder: string
  bare?: boolean
}) {
  const { rows, model, addOption, removeOption, renameOption } = useStore()
  const [draft, setDraft] = useState('')
  const usage = useMemo(() => usageMap(rows, path), [rows, path])
  const values = useMemo(() => {
    switch (path.kind) {
      case 'unitKerja':
        return model.unitKerja
      case 'satuanByUnit':
        return model.satuanByUnit[path.unit] ?? []
      case 'seksiByKey':
        return model.seksiByKey[path.key] ?? []
      case 'jabatanStruktural':
        return model.jabatanStruktural[path.eselon] ?? []
      case 'jabatanFungsional':
        return model.jabatanFungsional
      case 'jabatanPelaksana':
        return model.jabatanPelaksana
      case 'jenjangFungsional':
        return model.jenjangFungsional
    }
  }, [model, path])

  const add = () => {
    const value = draft.trim()
    if (!value) return
    addOption(path, value)
    setDraft('')
  }

  const body = (
    <>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') add()
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Tambah
        </button>
      </div>

      <div className="scroll-thin mt-2 max-h-72 min-h-0 flex-1 space-y-0.5 overflow-auto">
        {values.map((value) => (
          <OptionRow
            key={value}
            value={value}
            count={usage.get(value) ?? 0}
            onRemove={() => removeOption(path, value)}
            onRename={(next) => renameOption(path, value, next)}
          />
        ))}
        {values.length === 0 && <p className="p-2 text-xs text-slate-400">Belum ada opsi.</p>}
      </div>
    </>
  )

  if (bare) return <div className="flex min-h-0 flex-col">{body}</div>

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">{values.length} opsi</span>
      </div>
      {subtitle && <p className="mt-0.5 truncate text-[11px] text-slate-400" title={subtitle}>{subtitle}</p>}
      <div className="mt-2">{body}</div>
    </section>
  )
}

export function OptionManager() {
  const { model, resetData, exportDatabase, importDatabase } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dbMessage, setDbMessage] = useState('')
  const [dbError, setDbError] = useState(false)

  const downloadDatabase = () => {
    const payload = exportDatabase()
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `formasi-database-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    setDbError(false)
    setDbMessage('Database diekspor ke berkas JSON.')
  }

  const onImportFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as FormasiDatabase
      importDatabase(parsed)
      setDbError(false)
      setDbMessage(`Database dimuat dari ${file.name}.`)
    } catch (err) {
      setDbError(true)
      setDbMessage(err instanceof Error ? err.message : 'Gagal memuat berkas database.')
    }
  }

  useEffect(() => {
    if (!dbMessage) return
    const timer = window.setTimeout(() => setDbMessage(''), 4000)
    return () => window.clearTimeout(timer)
  }, [dbMessage])

  const [satuanUnit, setSatuanUnit] = useState('')
  const [seksiUnit, setSeksiUnit] = useState('')
  const [seksiSatuan, setSeksiSatuan] = useState('')
  const [jabatanGroup, setJabatanGroup] = useState<JabatanGroup>('I')

  useEffect(() => {
    if (!satuanUnit && model.unitKerja.length > 0) setSatuanUnit(model.unitKerja[0])
    if (!seksiUnit && model.unitKerja.length > 0) setSeksiUnit(model.unitKerja[0])
  }, [model.unitKerja, satuanUnit, seksiUnit])

  const satuanOptions = model.satuanByUnit[seksiUnit] ?? []

  const seksiPath: ModelPath = { kind: 'seksiByKey', key: seksiKey(seksiUnit, seksiSatuan) }

  const jabatanPath: ModelPath =
    jabatanGroup === 'Fungsional'
      ? { kind: 'jabatanFungsional' }
      : jabatanGroup === 'Pelaksana'
        ? { kind: 'jabatanPelaksana' }
        : { kind: 'jabatanStruktural', eselon: jabatanGroup }

  const jabatanLabel =
    jabatanGroup === 'Fungsional'
      ? 'Jabatan Fungsional'
      : jabatanGroup === 'Pelaksana'
        ? 'Jabatan Pelaksana'
        : `Jabatan Struktural · Eselon ${jabatanGroup}`

  return (
    <div className="scroll-thin h-full overflow-auto bg-slate-100 p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Pengaturan Opsi Dinamis</h2>
            <p className="text-xs text-slate-500">
              Disusun mengikuti alur input: Eselon → Jabatan, dan Unit Kerja → Satuan Kerja → Seksi Kerja.
              Perubahan tersimpan otomatis di browser.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadDatabase}
              className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              ⬇ Export database (JSON)
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-md border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              ⬆ Import database (JSON)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onImportFile(file)
                event.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={resetData}
              className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
            >
              Reset ke data awal
            </button>
          </div>
        </div>

        {dbMessage && (
          <p className={`mb-3 text-xs font-medium ${dbError ? 'text-rose-600' : 'text-emerald-600'}`}>
            {dbMessage}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <OptionList title="Unit Kerja" placeholder="Tambah unit kerja…" path={{ kind: 'unitKerja' }} />

          <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Satuan Kerja</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">Pilih Unit Kerja, lalu atur satuannya.</p>
            <select
              value={satuanUnit}
              onChange={(event) => setSatuanUnit(event.target.value)}
              className={`${selectClass} mt-2`}
            >
              {model.unitKerja.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <div className="mt-3 min-h-0 flex-1">
              <OptionList
                bare
                title="Satuan Kerja"
                path={{ kind: 'satuanByUnit', unit: satuanUnit }}
                placeholder="Tambah satuan kerja…"
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Seksi Kerja</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">Pilih Unit Kerja &amp; Satuan Kerja, lalu atur seksinya.</p>
            <div className="mt-2 space-y-2">
              <select
                value={seksiUnit}
                onChange={(event) => {
                  setSeksiUnit(event.target.value)
                  setSeksiSatuan('')
                }}
                className={`${selectClass} w-full`}
              >
                {model.unitKerja.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
              <select
                value={seksiSatuan}
                onChange={(event) => setSeksiSatuan(event.target.value)}
                className={`${selectClass} w-full`}
              >
                <option value="">— tanpa satuan —</option>
                {satuanOptions.map((satuan) => (
                  <option key={satuan} value={satuan}>
                    {satuan}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 min-h-0 flex-1">
              <OptionList bare title="Seksi Kerja" path={seksiPath} placeholder="Tambah seksi kerja…" />
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Jabatan</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">Struktural per eselon, atau fungsional / pelaksana.</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {JABATAN_GROUPS.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setJabatanGroup(group)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                    jabatanGroup === group
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {group === 'Fungsional' || group === 'Pelaksana' ? group : `Eselon ${group}`}
                </button>
              ))}
            </div>
            <div className="mt-3 min-h-0 flex-1">
              <OptionList bare title={jabatanLabel} path={jabatanPath} placeholder="Tambah jabatan…" />
            </div>
          </section>

          <OptionList
            title="Jenjang Fungsional"
            subtitle="Jenjang untuk Jabatan Fungsional"
            path={{ kind: 'jenjangFungsional' }}
            placeholder="Tambah jenjang…"
          />
        </div>
      </div>
    </div>
  )
}
