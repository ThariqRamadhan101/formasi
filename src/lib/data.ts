import type { FormasiData, FungsionalStatusData, OptionsData } from './types'

const base = import.meta.env.BASE_URL

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(`${base}data/${file}`)
  if (!response.ok) {
    throw new Error(`Gagal memuat ${file} (${response.status}). Jalankan "npm run extract".`)
  }
  return (await response.json()) as T
}

export async function loadFormasi(): Promise<FormasiData> {
  return fetchJson<FormasiData>('formasi.json')
}

export async function loadOptions(): Promise<OptionsData> {
  return fetchJson<OptionsData>('options.json')
}

/** Status fungsional seed; optional (empty when the file has not been generated). */
export async function loadFungsionalStatus(): Promise<FungsionalStatusData> {
  try {
    return await fetchJson<FungsionalStatusData>('fungsional-status.json')
  } catch {
    return { generatedAt: '', status: {} }
  }
}
