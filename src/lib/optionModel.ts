import { normalizeName } from './formasi'
import type { FormasiRow, ModelPath, OptionLists, OptionModel } from './types'

export function seksiKey(unit: string, satuan: string): string {
  return `${unit}||${normalizeName(satuan)}`
}

/** Derive the hierarchical option model from the current formasi rows. */
export function buildOptionModel(rows: FormasiRow[]): OptionModel {
  const unitKerja: string[] = []
  const satuanByUnit: Record<string, string[]> = {}
  const seksiByKey: Record<string, string[]> = {}
  const jabatanStruktural: Record<string, string[]> = {}
  const jabatanFungsional: string[] = []
  const jabatanPelaksana: string[] = []
  const jenjangFungsional: string[] = []

  const add = (list: string[], value: string) => {
    if (value && !list.includes(value)) list.push(value)
  }

  for (const row of rows) {
    if (!row.unitKerja) continue
    const unit = row.unitKerja
    add(unitKerja, unit)

    const satuan = normalizeName(row.satuanKerja)
    const effectiveSatuan = satuan && satuan !== unit ? satuan : ''
    if (effectiveSatuan) {
      ;(satuanByUnit[unit] ??= [])
      add(satuanByUnit[unit], effectiveSatuan)
    }

    const seksi = normalizeName(row.seksiKerja)
    if (seksi && seksi !== unit) {
      const key = seksiKey(unit, effectiveSatuan)
      ;(seksiByKey[key] ??= [])
      add(seksiByKey[key], seksi)
    }

    if (row.jenisJabatan === 'Jabatan Struktural' && row.eselon) {
      ;(jabatanStruktural[row.eselon] ??= [])
      add(jabatanStruktural[row.eselon], row.jabatan)
    } else if (row.jenisJabatan === 'Jabatan Fungsional') {
      add(jabatanFungsional, row.jabatan)
      if (row.jenjang && row.jenjang !== '-') add(jenjangFungsional, row.jenjang)
    } else if (row.jenisJabatan === 'Jabatan Pelaksana') {
      add(jabatanPelaksana, row.jabatan)
    }
  }

  const sort = (list: string[]) => list.sort((a, b) => a.localeCompare(b, 'id'))
  sort(unitKerja)
  Object.values(satuanByUnit).forEach(sort)
  Object.values(seksiByKey).forEach(sort)
  Object.values(jabatanStruktural).forEach(sort)
  sort(jabatanFungsional)
  sort(jabatanPelaksana)
  sort(jenjangFungsional)

  return {
    unitKerja,
    satuanByUnit,
    seksiByKey,
    jabatanStruktural,
    jabatanFungsional,
    jabatanPelaksana,
    jenjangFungsional,
  }
}

/** Flatten the model into the simple lists the forms and tables consume. */
export function flattenOptions(model: OptionModel): OptionLists {
  const satuan = new Set<string>()
  Object.values(model.satuanByUnit).forEach((list) => list.forEach((value) => satuan.add(value)))

  const seksi = new Set<string>()
  Object.values(model.seksiByKey).forEach((list) => list.forEach((value) => seksi.add(value)))

  const jabatan = new Set<string>()
  Object.values(model.jabatanStruktural).forEach((list) => list.forEach((value) => jabatan.add(value)))
  model.jabatanFungsional.forEach((value) => jabatan.add(value))
  model.jabatanPelaksana.forEach((value) => jabatan.add(value))

  const sort = (values: Set<string>) => [...values].sort((a, b) => a.localeCompare(b, 'id'))
  return {
    unitKerja: model.unitKerja,
    satuanKerja: sort(satuan),
    seksiKerja: sort(seksi),
    jabatan: sort(jabatan),
    jenjang: ['-', ...model.jenjangFungsional],
  }
}

export function getList(model: OptionModel, path: ModelPath): string[] {
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
}

export function withList(model: OptionModel, path: ModelPath, list: string[]): OptionModel {
  switch (path.kind) {
    case 'unitKerja':
      return { ...model, unitKerja: list }
    case 'satuanByUnit':
      return { ...model, satuanByUnit: { ...model.satuanByUnit, [path.unit]: list } }
    case 'seksiByKey':
      return { ...model, seksiByKey: { ...model.seksiByKey, [path.key]: list } }
    case 'jabatanStruktural':
      return { ...model, jabatanStruktural: { ...model.jabatanStruktural, [path.eselon]: list } }
    case 'jabatanFungsional':
      return { ...model, jabatanFungsional: list }
    case 'jabatanPelaksana':
      return { ...model, jabatanPelaksana: list }
    case 'jenjangFungsional':
      return { ...model, jenjangFungsional: list }
  }
}

/** Rename keys that embed the changed value (unit in satuan/seksi keys). */
export function renameKeys(model: OptionModel, path: ModelPath, value: string, next: string): OptionModel {
  if (path.kind === 'unitKerja') {
    const satuanByUnit = { ...model.satuanByUnit }
    if (satuanByUnit[value]) {
      satuanByUnit[next] = satuanByUnit[value]
      delete satuanByUnit[value]
    }
    const seksiByKeyMap: Record<string, string[]> = {}
    for (const [key, list] of Object.entries(model.seksiByKey)) {
      if (key.startsWith(`${value}||`)) seksiByKeyMap[`${next}||${key.slice(value.length + 2)}`] = list
      else seksiByKeyMap[key] = list
    }
    return { ...model, satuanByUnit, seksiByKey: seksiByKeyMap }
  }
  if (path.kind === 'satuanByUnit') {
    const oldKey = seksiKey(path.unit, value)
    const newKey = seksiKey(path.unit, next)
    if (model.seksiByKey[oldKey]) {
      const seksiByKeyMap = { ...model.seksiByKey }
      seksiByKeyMap[newKey] = seksiByKeyMap[oldKey]
      delete seksiByKeyMap[oldKey]
      return { ...model, seksiByKey: seksiByKeyMap }
    }
  }
  return model
}

/** Update rows that reference a renamed option (keeps data consistent). */
export function renameRow(row: FormasiRow, path: ModelPath, value: string, next: string): FormasiRow {
  switch (path.kind) {
    case 'unitKerja':
      return row.unitKerja === value ? { ...row, unitKerja: next } : row
    case 'satuanByUnit':
      return row.unitKerja === path.unit && row.satuanKerja === value
        ? { ...row, satuanKerja: next }
        : row
    case 'seksiByKey': {
      const satuan = path.key.slice(path.key.indexOf('||') + 2)
      const satuanMatch = satuan
        ? row.satuanKerja === satuan
        : row.satuanKerja === row.unitKerja
      const unit = path.key.slice(0, path.key.indexOf('||'))
      return row.unitKerja === unit && satuanMatch && row.seksiKerja === value
        ? { ...row, seksiKerja: next }
        : row
    }
    case 'jabatanStruktural':
      return row.jenisJabatan === 'Jabatan Struktural' && row.eselon === path.eselon && row.jabatan === value
        ? { ...row, jabatan: next }
        : row
    case 'jabatanFungsional':
      return row.jenisJabatan === 'Jabatan Fungsional' && row.jabatan === value
        ? { ...row, jabatan: next }
        : row
    case 'jabatanPelaksana':
      return row.jenisJabatan === 'Jabatan Pelaksana' && row.jabatan === value
        ? { ...row, jabatan: next }
        : row
    case 'jenjangFungsional':
      return row.jenisJabatan === 'Jabatan Fungsional' && row.jenjang === value
        ? { ...row, jenjang: next }
        : row
  }
}
