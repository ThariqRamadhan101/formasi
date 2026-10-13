import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { loadFormasi, loadFungsionalStatus, loadOptions } from './data'
import { buildOptionModel, flattenOptions, getList, renameKeys, renameRow, seksiKey, withList } from './optionModel'
import type {
  FormasiDatabase,
  FormasiRow,
  FungsionalStatusId,
  FungsionalStatusMap,
  ModelPath,
  NewFormasiRow,
  OptionModel,
} from './types'

const STORAGE_KEY = 'formasi-unit-organisasi-v2'
const DEFAULT_FUNGSIONAL_STATUS: FungsionalStatusId = 'BELUM_DIBUKA'

interface Persisted {
  rows: FormasiRow[]
  model: OptionModel
  fungsionalStatus?: FungsionalStatusMap
  /** generatedAt of the seed JSON this snapshot was built from. */
  seedVersion: string
}

export interface StoreValue {
  ready: boolean
  error: string | null
  generatedAt: string
  source: string
  rows: FormasiRow[]
  model: OptionModel
  options: ReturnType<typeof flattenOptions>
  jenisJabatan: string[]
  formasiList: string[]
  fungsionalStatus: FungsionalStatusMap
  addRows: (rows: NewFormasiRow[]) => void
  updateRow: (id: number, patch: Partial<FormasiRow>) => void
  deleteRow: (id: number) => void
  addOption: (path: ModelPath, value: string) => void
  removeOption: (path: ModelPath, value: string) => void
  renameOption: (path: ModelPath, value: string, next: string) => void
  setFungsionalStatus: (jabatan: string, status: FungsionalStatusId) => void
  bulkSetFungsionalStatus: (jabatanList: string[], status: FungsionalStatusId) => void
  setFungsionalStatusMap: (map: FungsionalStatusMap) => void
  save: () => void
  exportDatabase: () => FormasiDatabase
  importDatabase: (database: FormasiDatabase) => void
  resetData: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

function readPersisted(): Persisted | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Persisted
    if (!Array.isArray(parsed.rows) || !parsed.model) return null
    if (!Array.isArray(parsed.model.unitKerja)) return null
    return parsed
  } catch {
    return null
  }
}

function writePersisted(data: Persisted) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full / disabled — keep working in memory.
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<FormasiRow[]>([])
  const [model, setModel] = useState<OptionModel>(() => buildOptionModel([]))
  const [jenisJabatan, setJenisJabatan] = useState<string[]>([])
  const [formasiList, setFormasiList] = useState<string[]>([])
  const [statusMap, setStatusMap] = useState<FungsionalStatusMap>({})
  const [meta, setMeta] = useState({ generatedAt: new Date().toISOString(), source: '' })
  const [seedVersion, setSeedVersion] = useState('')
  const nextId = useRef(1)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadFormasi(), loadOptions(), loadFungsionalStatus()])
      .then(([formasi, seed, statusSeed]) => {
        if (cancelled) return
        const stored = readPersisted()
        // Only reuse the browser snapshot when it came from this exact extract;
        // otherwise the Excel was re-extracted and we take the fresh seed.
        const useStored = stored !== null && stored.seedVersion === formasi.generatedAt
        const initialRows = useStored && stored ? stored.rows : formasi.rows
        setRows(initialRows)
        setModel(useStored && stored ? stored.model : buildOptionModel(initialRows))
        setStatusMap(
          useStored && stored?.fungsionalStatus ? stored.fungsionalStatus : statusSeed.status ?? {},
        )
        setJenisJabatan(seed.jenisJabatan)
        setFormasiList(seed.formasi)
        setSeedVersion(formasi.generatedAt)
        setMeta({ generatedAt: formasi.generatedAt, source: formasi.source })
        nextId.current = initialRows.reduce((max, row) => Math.max(max, row.id), 0) + 1
        setReady(true)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const options = useMemo(() => flattenOptions(model), [model])

  const fungsionalStatus = useMemo<FungsionalStatusMap>(() => {
    const out: FungsionalStatusMap = {}
    for (const jabatan of model.jabatanFungsional) {
      out[jabatan] = statusMap[jabatan] ?? DEFAULT_FUNGSIONAL_STATUS
    }
    return out
  }, [model.jabatanFungsional, statusMap])

  useEffect(() => {
    if (!ready) return
    writePersisted({ rows, model, fungsionalStatus, seedVersion })
  }, [ready, rows, model, fungsionalStatus, seedVersion])

  const addRows = useCallback((incoming: NewFormasiRow[]) => {
    setRows((prev) => {
      const additions = incoming.map((row) => ({
        ...row,
        id: nextId.current++,
        bezetting: row.bezetting ?? 0,
        formasiGap: row.formasiGap ?? (row.kebutuhan ?? 0),
        pegawai: row.pegawai ?? [],
      }))
      return [...prev, ...additions]
    })
  }, [])

  const updateRow = useCallback((id: number, patch: Partial<FormasiRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }, [])

  const deleteRow = useCallback((id: number) => {
    setRows((prev) => prev.filter((row) => row.id !== id))
  }, [])

  const addOption = useCallback((path: ModelPath, value: string) => {
    const clean = value.trim()
    if (!clean) return
    setModel((prev) => {
      const list = getList(prev, path)
      if (list.includes(clean)) return prev
      return withList(prev, path, [...list, clean])
    })
  }, [])

  const removeOption = useCallback((path: ModelPath, value: string) => {
    setModel((prev) => {
      let updated = withList(prev, path, getList(prev, path).filter((item) => item !== value))
      if (path.kind === 'unitKerja') {
        const satuanByUnit = { ...updated.satuanByUnit }
        delete satuanByUnit[value]
        const seksiByKeyMap: Record<string, string[]> = {}
        for (const [key, list] of Object.entries(updated.seksiByKey)) {
          if (!key.startsWith(`${value}||`)) seksiByKeyMap[key] = list
        }
        updated = { ...updated, satuanByUnit, seksiByKey: seksiByKeyMap }
      } else if (path.kind === 'satuanByUnit') {
        const seksiByKeyMap = { ...updated.seksiByKey }
        delete seksiByKeyMap[seksiKey(path.unit, value)]
        updated = { ...updated, seksiByKey: seksiByKeyMap }
      }
      return updated
    })
    if (path.kind === 'jabatanFungsional') {
      setStatusMap((prev) => {
        if (!(value in prev)) return prev
        const next = { ...prev }
        delete next[value]
        return next
      })
    }
  }, [])

  const renameOption = useCallback((path: ModelPath, value: string, next: string) => {
    const clean = next.trim()
    if (!clean || clean === value) return
    setModel((prev) => {
      const list = getList(prev, path).map((item) => (item === value ? clean : item))
      const updated = withList(prev, path, list)
      return renameKeys(updated, path, value, clean)
    })
    setRows((prev) => prev.map((row) => renameRow(row, path, value, clean)))
    if (path.kind === 'jabatanFungsional') {
      setStatusMap((prev) => {
        if (!(value in prev)) return prev
        const next = { ...prev }
        next[clean] = next[value]
        delete next[value]
        return next
      })
    }
  }, [])

  const setFungsionalStatus = useCallback((jabatan: string, status: FungsionalStatusId) => {
    setStatusMap((prev) => ({ ...prev, [jabatan]: status }))
  }, [])

  const bulkSetFungsionalStatus = useCallback((jabatanList: string[], status: FungsionalStatusId) => {
    setStatusMap((prev) => {
      const next = { ...prev }
      for (const jabatan of jabatanList) next[jabatan] = status
      return next
    })
  }, [])

  const setFungsionalStatusMap = useCallback((map: FungsionalStatusMap) => {
    setStatusMap(map)
  }, [])

  const save = useCallback(() => {
    writePersisted({ rows, model, fungsionalStatus, seedVersion })
  }, [rows, model, fungsionalStatus, seedVersion])

  const exportDatabase = useCallback(
    (): FormasiDatabase => ({
      generatedAt: meta.generatedAt,
      source: meta.source,
      rows,
      model,
      fungsionalStatus,
    }),
    [meta, rows, model, fungsionalStatus],
  )

  const importDatabase = useCallback((database: FormasiDatabase) => {
    if (!Array.isArray(database.rows) || !database.model) {
      throw new Error('Berkas database tidak valid.')
    }
    setRows(database.rows)
    setModel(database.model)
    setStatusMap(database.fungsionalStatus ?? {})
    nextId.current = database.rows.reduce((max, row) => Math.max(max, row.id), 0) + 1
  }, [])

  const resetData = useCallback(() => {
    void loadFormasi().then((formasi) => {
      setRows(formasi.rows)
      setModel(buildOptionModel(formasi.rows))
      setStatusMap({})
      setSeedVersion(formasi.generatedAt)
      nextId.current = formasi.rows.reduce((max, row) => Math.max(max, row.id), 0) + 1
    })
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      error,
      generatedAt: meta.generatedAt,
      source: meta.source,
      rows,
      model,
      options,
      jenisJabatan,
      formasiList,
      fungsionalStatus,
      addRows,
      updateRow,
      deleteRow,
      addOption,
      removeOption,
      renameOption,
      setFungsionalStatus,
      bulkSetFungsionalStatus,
      setFungsionalStatusMap,
      save,
      exportDatabase,
      importDatabase,
      resetData,
    }),
    [
      ready,
      error,
      meta,
      rows,
      model,
      options,
      jenisJabatan,
      formasiList,
      fungsionalStatus,
      addRows,
      updateRow,
      deleteRow,
      addOption,
      removeOption,
      renameOption,
      setFungsionalStatus,
      bulkSetFungsionalStatus,
      setFungsionalStatusMap,
      save,
      exportDatabase,
      importDatabase,
      resetData,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreValue {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used within <StoreProvider>')
  return context
}
