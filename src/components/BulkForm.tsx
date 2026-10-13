import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { buildLookups, rootRow, satelliteUnitNames } from '../lib/formasi'
import { seksiKey } from '../lib/optionModel'
import { useStore } from '../lib/store'
import type { NewFormasiRow } from '../lib/types'

const NONE = '__none__'

const inputClass =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:border-brand-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400'
const labelClass = 'mb-1 block text-xs font-semibold text-slate-600'

const ESELONS = ['I', 'II', 'III', 'IV']

const FUNCTIONAL_JENJANG = [
  'Ahli Utama',
  'Ahli Madya',
  'Ahli Muda',
  'Ahli Pertama',
  'Penyelia',
  'Mahir',
  'Terampil',
  'Pemula',
]

interface Target {
  unitKerja: string
  satuanKerja: string
  seksiKerja: string
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label}
        {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function CheckList({
  title,
  hint,
  values,
  selected,
  onToggle,
  onSet,
  label,
  actions,
}: {
  title: string
  hint?: string
  values: string[]
  selected: Set<string>
  onToggle: (value: string) => void
  onSet: (values: string[]) => void
  label: (value: string) => string
  actions?: { label: string; onClick: () => void }[]
}) {
  const [filter, setFilter] = useState('')
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return values.filter((value) => !q || label(value).toLowerCase().includes(q))
  }, [values, filter, label])

  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-slate-200 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600">
          {title} <span className="font-normal text-slate-400">{hint}</span>
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onSet(values)}
            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => onSet([])}
            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Kosong
          </button>
        </div>
      </div>

      {actions && actions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="rounded border border-brand-300 bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 hover:bg-brand-100"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter…"
        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-[11px] focus:border-brand-500 focus:outline-none"
      />

      <div className="scroll-thin mt-1 max-h-40 min-h-0 flex-1 space-y-0.5 overflow-auto">
        {visible.map((value) => (
          <label key={value} className="flex cursor-pointer items-start gap-1.5 rounded px-1 py-0.5 text-[11px] hover:bg-slate-50">
            <input
              type="checkbox"
              checked={selected.has(value)}
              onChange={() => onToggle(value)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span className="text-slate-700">{label(value)}</span>
          </label>
        ))}
        {visible.length === 0 && <p className="px-1 py-1 text-[11px] text-slate-400">Tidak ada pilihan.</p>}
      </div>
    </div>
  )
}

export function BulkForm() {
  const { rows, model, formasiList, addRows } = useStore()
  const lookups = useMemo(() => buildLookups(rows), [rows])
  const satellites = useMemo(() => satelliteUnitNames(rows), [rows])
  const rootUnit = useMemo(() => rootRow(rows)?.unitKerja ?? '', [rows])

  const [eselon, setEselon] = useState('')
  const [jenis, setJenis] = useState('')
  const [jabatan, setJabatan] = useState('')
  const [jenjang, setJenjang] = useState('-')
  const [formasi, setFormasi] = useState('YA')
  const [kebutuhan, setKebutuhan] = useState(1)

  const [units, setUnits] = useState<Set<string>>(new Set())
  const [satuan, setSatuan] = useState<Set<string>>(new Set())
  const [seksi, setSeksi] = useState<Set<string>>(new Set())
  const [targets, setTargets] = useState<Target[]>([])
  const [message, setMessage] = useState('')

  const structural = eselon !== ''
  const topStructural = structural && (eselon === 'I' || eselon === 'II')

  const structuralByEselon = useMemo(() => {
    const buckets: Record<string, Set<string>> = {}
    for (const row of rows) {
      if (row.jenisJabatan === 'Jabatan Struktural' && row.eselon) {
        ;(buckets[row.eselon] ??= new Set()).add(row.jabatan)
      }
    }
    const out: Record<string, string[]> = {}
    for (const key of Object.keys(buckets)) {
      out[key] = [...buckets[key]].sort((a, b) => a.localeCompare(b, 'id'))
    }
    return out
  }, [rows])

  const functionalJenjang = useMemo(() => {
    const present = new Set(
      rows.filter((row) => row.jenisJabatan === 'Jabatan Fungsional').map((row) => row.jenjang),
    )
    const ordered = FUNCTIONAL_JENJANG.filter((item) => present.has(item))
    return ordered.length > 0 ? ordered : FUNCTIONAL_JENJANG
  }, [rows])

  const jabatanOptions = useMemo(() => {
    if (structural) return structuralByEselon[eselon] ?? []
    if (!jenis) return []
    const fromData = lookups.jabatanByJenisJabatan[jenis]
    return fromData && fromData.length > 0 ? fromData : []
  }, [structural, eselon, structuralByEselon, jenis, lookups])

  const jenjangOptions = useMemo(() => {
    if (structural) return ['-']
    if (jenis === 'Jabatan Fungsional') return ['-', ...functionalJenjang]
    return ['-']
  }, [structural, jenis, functionalJenjang])

  const unitList = useMemo(() => model.unitKerja, [model.unitKerja])
  const selectedUnits = useMemo(() => [...units], [units])

  const satuanPool = useMemo(() => {
    if (topStructural) return []
    const set = new Set<string>()
    for (const unit of selectedUnits) (model.satuanByUnit[unit] ?? []).forEach((value) => set.add(value))
    return [...set].sort((a, b) => a.localeCompare(b, 'id'))
  }, [topStructural, selectedUnits, model])

  const seksiPool = useMemo(() => {
    if (topStructural) return []
    const set = new Set<string>()
    const satuanChoices = satuan.size ? [...satuan] : [NONE]
    for (const unit of selectedUnits) {
      const unitSatuan = model.satuanByUnit[unit] ?? []
      const validSatuan = satuanChoices.filter((value) => value === NONE || unitSatuan.includes(value))
      const satuanList = validSatuan.length ? validSatuan : [NONE]
      for (const value of satuanList) {
        const key = seksiKey(unit, value === NONE ? '' : value)
        ;(model.seksiByKey[key] ?? []).forEach((item) => set.add(item))
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'id'))
  }, [topStructural, selectedUnits, satuan, model])

  // Keep the satuan/seksi selections valid when the pools change.
  useEffect(() => {
    setSatuan((prev) => {
      const next = new Set([...prev].filter((value) => value === NONE || satuanPool.includes(value)))
      return next.size === prev.size ? prev : next
    })
  }, [satuanPool])

  useEffect(() => {
    setSeksi((prev) => {
      const next = new Set([...prev].filter((value) => value === NONE || seksiPool.includes(value)))
      return next.size === prev.size ? prev : next
    })
  }, [seksiPool])

  const toggleIn = (setter: (updater: (prev: Set<string>) => Set<string>) => void) => (value: string) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })

  const toggleUnit = toggleIn(setUnits)
  const toggleSatuan = toggleIn(setSatuan)
  const toggleSeksi = toggleIn(setSeksi)

  const generateTargets = (): Target[] => {
    const out: Target[] = []
    const seen = new Set<string>()
    const satuanChoices = topStructural ? [NONE] : satuan.size ? [...satuan] : [NONE]
    const seksiChoices = topStructural ? [NONE] : seksi.size ? [...seksi] : [NONE]

    for (const unit of selectedUnits) {
      const unitSatuan = model.satuanByUnit[unit] ?? []
      const validSatuan = satuanChoices.filter((value) => value === NONE || unitSatuan.includes(value))
      const satuanList = validSatuan.length ? validSatuan : [NONE]
      for (const s of satuanList) {
        const key = seksiKey(unit, s === NONE ? '' : s)
        const unitSeksi = model.seksiByKey[key] ?? []
        const validSeksi = seksiChoices.filter((value) => value === NONE || unitSeksi.includes(value))
        const seksiList = validSeksi.length ? validSeksi : [NONE]
        for (const k of seksiList) {
          const target: Target = {
            unitKerja: unit,
            satuanKerja: s === NONE ? '-' : s,
            seksiKerja: k === NONE ? '-' : k,
          }
          const id = `${target.unitKerja}|${target.satuanKerja}|${target.seksiKerja}`
          if (!seen.has(id)) {
            seen.add(id)
            out.push(target)
          }
        }
      }
    }
    return out
  }

  const addTargets = () => {
    const generated = generateTargets()
    if (generated.length === 0) {
      setMessage('Tidak ada target yang dihasilkan. Pilih minimal satu Unit Kerja.')
      return
    }
    setTargets((prev) => {
      const seen = new Set(prev.map((t) => `${t.unitKerja}|${t.satuanKerja}|${t.seksiKerja}`))
      const merged = [...prev]
      for (const target of generated) {
        const id = `${target.unitKerja}|${target.satuanKerja}|${target.seksiKerja}`
        if (!seen.has(id)) {
          seen.add(id)
          merged.push(target)
        }
      }
      return merged
    })
    setMessage(`${generated.length} target ditambahkan ke daftar.`)
  }

  const onEselonChange = (value: string) => {
    setEselon(value)
    setJabatan('')
    if (value) {
      setJenis('Jabatan Struktural')
      setJenjang('-')
      setKebutuhan(1)
    } else {
      setJenis('')
      setJenjang('-')
    }
  }

  const onJenisChange = (value: string) => {
    setJenis(value)
    setJabatan('')
    if (value !== 'Jabatan Fungsional') setJenjang('-')
  }

  const errors = useMemo(() => {
    const list: string[] = []
    if (!jenis) list.push('Jenis Jabatan wajib dipilih.')
    if (!jabatan) list.push('Jabatan wajib dipilih.')
    if (targets.length === 0) list.push('Daftar target masih kosong.')
    return list
  }, [jenis, jabatan, targets])

  const submit = () => {
    if (errors.length > 0) return
    const incoming: NewFormasiRow[] = targets.map((target) => ({
      eselon,
      unitKerja: target.unitKerja,
      satuanKerja: target.satuanKerja,
      seksiKerja: target.seksiKerja,
      jabatan,
      jenjang,
      jenisJabatan: jenis,
      formasi,
      kebutuhan,
    }))
    addRows(incoming)
    setMessage(`${incoming.length} entri formasi ditambahkan.`)
    setTargets([])
  }

  const targetLabel = (target: Target) =>
    [target.unitKerja, target.satuanKerja, target.seksiKerja]
      .filter((value) => value && value !== '-')
      .join(' › ') || target.unitKerja

  return (
    <div className="scroll-thin h-full overflow-auto bg-slate-100 p-4">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800">Input Formasi</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Tentukan jabatan, lalu pilih target (Unit Kerja → Satuan Kerja → Seksi Kerja). Satu jabatan bisa
              diterapkan ke banyak target sekaligus.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Eselon">
                <select value={eselon} onChange={(e) => onEselonChange(e.target.value)} className={inputClass}>
                  <option value="">— non-eselon —</option>
                  {ESELONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Formasi?">
                <select value={formasi} onChange={(e) => setFormasi(e.target.value)} className={inputClass}>
                  {formasiList.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Jenis Jabatan" hint={structural ? 'otomatis: struktural' : 'fungsional / pelaksana'}>
                <select
                  value={jenis}
                  onChange={(e) => onJenisChange(e.target.value)}
                  className={inputClass}
                  disabled={structural}
                >
                  <option value="">— pilih jenis —</option>
                  {(structural ? ['Jabatan Struktural'] : ['Jabatan Fungsional', 'Jabatan Pelaksana']).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Jabatan" hint={structural ? `struktural Eselon ${eselon}` : undefined}>
                <select value={jabatan} onChange={(e) => setJabatan(e.target.value)} className={inputClass}>
                  <option value="">— pilih jabatan —</option>
                  {jabatanOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Jenjang">
                <select
                  value={jenjang}
                  onChange={(e) => setJenjang(e.target.value)}
                  className={inputClass}
                  disabled={jenjangOptions.length <= 1}
                >
                  {jenjangOptions.map((item) => (
                    <option key={item} value={item}>
                      {item === '-' ? '— tanpa jenjang —' : item}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kebutuhan">
                <input
                  type="number"
                  min={0}
                  value={kebutuhan}
                  onChange={(e) => setKebutuhan(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Target</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Pilih unit, lalu satuan &amp; seksi kerjanya. Bisa beda antar unit (mis. semua Subbag Balai, atau
              beberapa satuan di satu direktorat).
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <CheckList
                title="Unit Kerja"
                hint={`(${units.size})`}
                values={unitList}
                selected={units}
                onToggle={toggleUnit}
                onSet={(values) => setUnits(new Set(values))}
                label={(value) => value}
                actions={[
                  { label: 'Semua UPT/Balai', onClick: () => setUnits(new Set(unitList.filter((u) => satellites.has(u)))) },
                  {
                    label: 'Semua Pusat',
                    onClick: () => setUnits(new Set(unitList.filter((u) => !satellites.has(u) && u !== rootUnit))),
                  },
                ]}
              />

              <CheckList
                title="Satuan Kerja"
                hint={`(${satuan.size})`}
                values={topStructural ? [NONE] : [NONE, ...satuanPool]}
                selected={satuan}
                onToggle={toggleSatuan}
                onSet={(values) => setSatuan(new Set(values))}
                label={(value) => (value === NONE ? '— tanpa satuan —' : value)}
              />

              <CheckList
                title="Seksi Kerja"
                hint={`(${seksi.size})`}
                values={topStructural ? [NONE] : [NONE, ...seksiPool]}
                selected={seksi}
                onToggle={toggleSeksi}
                onSet={(values) => setSeksi(new Set(values))}
                label={(value) => (value === NONE ? '— tanpa seksi —' : value)}
              />
            </div>

            <button
              type="button"
              onClick={addTargets}
              disabled={units.size === 0}
              className="mt-3 rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-40"
            >
              + Tambah ke daftar target
            </button>
            {topStructural && (
              <p className="mt-2 text-[11px] text-slate-400">
                Eselon I/II tidak memakai Satuan/Seksi Kerja.
              </p>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Daftar target <span className="text-slate-400">({targets.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => setTargets([])}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Bersihkan
            </button>
          </div>

          <div className="scroll-thin mt-2 min-h-0 flex-1 space-y-1 overflow-auto rounded-lg border border-slate-100 p-1">
            {targets.map((target, index) => (
              <div
                key={`${target.unitKerja}|${target.satuanKerja}|${target.seksiKerja}`}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-slate-50"
              >
                <span className="mt-0.5 w-5 shrink-0 text-slate-400">{index + 1}.</span>
                <span className="min-w-0 flex-1 text-slate-700">{targetLabel(target)}</span>
                <button
                  type="button"
                  onClick={() => setTargets((prev) => prev.filter((_, i) => i !== index))}
                  className="shrink-0 rounded px-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Hapus target"
                >
                  ✕
                </button>
              </div>
            ))}
            {targets.length === 0 && (
              <p className="p-3 text-xs text-slate-400">
                Belum ada target. Pilih unit/satuan/seksi lalu klik “Tambah ke daftar target”.
              </p>
            )}
          </div>

          {errors.length > 0 && (
            <ul className="mt-3 list-inside list-disc rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={errors.length > 0}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
            >
              Simpan {targets.length || ''} entri
            </button>
            {message && <span className="text-xs font-medium text-emerald-600">{message}</span>}
          </div>
        </section>
      </div>
    </div>
  )
}
