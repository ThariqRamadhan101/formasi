import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { seksiKey } from '../lib/optionModel'
import { useStore } from '../lib/store'
import type { FormasiRow } from '../lib/types'

interface RowEditorProps {
  row: FormasiRow
  onClose: () => void
}

const inputClass =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:border-brand-500 focus:outline-none'
const labelClass = 'mb-1 block text-xs font-semibold text-slate-600'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}

function sortUnique(values: Set<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, 'id'))
}

export function RowEditor({ row, onClose }: RowEditorProps) {
  const { model, options, jenisJabatan, formasiList, updateRow } = useStore()

  const [form, setForm] = useState({
    eselon: row.eselon,
    unitKerja: row.unitKerja,
    satuanKerja: row.satuanKerja || '-',
    seksiKerja: row.seksiKerja || '-',
    jabatan: row.jabatan,
    jenjang: row.jenjang || '-',
    jenisJabatan: row.jenisJabatan,
    formasi: row.formasi,
    kebutuhan: row.kebutuhan,
  })
  const [error, setError] = useState('')

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const onUnitChange = (value: string) =>
    setForm((prev) => ({ ...prev, unitKerja: value, satuanKerja: '-', seksiKerja: '-' }))

  const onSatuanChange = (value: string) =>
    setForm((prev) => ({ ...prev, satuanKerja: value, seksiKerja: '-' }))

  const unitValues = useMemo(() => {
    const set = new Set(model.unitKerja)
    if (form.unitKerja) set.add(form.unitKerja)
    return sortUnique(set)
  }, [model.unitKerja, form.unitKerja])

  const satuanValues = useMemo(() => {
    const set = new Set<string>(['-'])
    ;(model.satuanByUnit[form.unitKerja] ?? []).forEach((value) => set.add(value))
    if (form.satuanKerja && form.satuanKerja !== '-') set.add(form.satuanKerja)
    return sortUnique(set)
  }, [model.satuanByUnit, form.unitKerja, form.satuanKerja])

  const seksiValues = useMemo(() => {
    const set = new Set<string>(['-'])
    const key = seksiKey(form.unitKerja, form.satuanKerja)
    ;(model.seksiByKey[key] ?? []).forEach((value) => set.add(value))
    if (form.seksiKerja && form.seksiKerja !== '-') set.add(form.seksiKerja)
    return sortUnique(set)
  }, [model.seksiByKey, form.unitKerja, form.satuanKerja, form.seksiKerja])

  const jenjangValues = useMemo(() => {
    const set = new Set<string>(['-', ...model.jenjangFungsional])
    if (form.jenjang && form.jenjang !== '-') set.add(form.jenjang)
    return sortUnique(set)
  }, [model.jenjangFungsional, form.jenjang])

  const jabatanValues = useMemo(() => {
    const set = new Set(options.jabatan)
    if (form.jabatan) set.add(form.jabatan)
    return sortUnique(set)
  }, [options.jabatan, form.jabatan])

  const save = () => {
    if (!form.unitKerja.trim()) {
      setError('Unit Kerja wajib diisi.')
      return
    }
    if (!form.jabatan.trim()) {
      setError('Jabatan wajib diisi.')
      return
    }
    updateRow(row.id, {
      eselon: form.eselon,
      unitKerja: form.unitKerja.trim(),
      satuanKerja: form.satuanKerja,
      seksiKerja: form.seksiKerja,
      jabatan: form.jabatan.trim(),
      jenjang: form.jenjang,
      jenisJabatan: form.jenisJabatan,
      formasi: form.formasi,
      kebutuhan: Number(form.kebutuhan) || 0,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-bold text-slate-800">Edit Formasi #{row.id}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          <Field label="Eselon">
            <select value={form.eselon} onChange={(e) => set('eselon', e.target.value)} className={inputClass}>
              <option value="">— non-eselon —</option>
              {['I', 'II', 'III', 'IV'].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Formasi?">
            <select value={form.formasi} onChange={(e) => set('formasi', e.target.value)} className={inputClass}>
              {(formasiList.length > 0 ? formasiList : ['YA', 'TIDAK']).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Unit Kerja">
            <select value={form.unitKerja} onChange={(e) => onUnitChange(e.target.value)} className={inputClass}>
              <option value="">— pilih unit —</option>
              {unitValues.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Satuan Kerja">
            <select value={form.satuanKerja} onChange={(e) => onSatuanChange(e.target.value)} className={inputClass}>
              {satuanValues.map((item) => (
                <option key={item} value={item}>
                  {item === '-' ? '— tanpa satuan —' : item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Seksi Kerja">
            <select value={form.seksiKerja} onChange={(e) => set('seksiKerja', e.target.value)} className={inputClass}>
              {seksiValues.map((item) => (
                <option key={item} value={item}>
                  {item === '-' ? '— tanpa seksi —' : item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Jenis Jabatan">
            <select
              value={form.jenisJabatan}
              onChange={(e) => set('jenisJabatan', e.target.value)}
              className={inputClass}
            >
              <option value="">— pilih jenis —</option>
              {(jenisJabatan.length > 0
                ? jenisJabatan
                : ['Jabatan Struktural', 'Jabatan Fungsional', 'Jabatan Pelaksana']
              ).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Jabatan">
            <input
              list="row-editor-jabatan"
              value={form.jabatan}
              onChange={(e) => set('jabatan', e.target.value)}
              className={inputClass}
            />
            <datalist id="row-editor-jabatan">
              {jabatanValues.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </Field>

          <Field label="Jenjang">
            <select value={form.jenjang} onChange={(e) => set('jenjang', e.target.value)} className={inputClass}>
              {jenjangValues.map((item) => (
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
              value={form.kebutuhan}
              onChange={(e) => set('kebutuhan', Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>

        {error && <p className="px-5 pb-2 text-xs text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}
