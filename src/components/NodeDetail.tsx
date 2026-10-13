import { Fragment, useMemo, useState } from 'react'
import { collectDescendantRows, kindLabel } from '../lib/formasi'
import type { OrgNode } from '../lib/types'

interface NodeDetailProps {
  node: OrgNode | null
}

const JENIS_STYLE: Record<string, string> = {
  'Jabatan Struktural': 'bg-brand-100 text-brand-800',
  'Jabatan Fungsional': 'bg-emerald-100 text-emerald-800',
  'Jabatan Pelaksana': 'bg-amber-100 text-amber-800',
  'Jabatan Pemberdaharaan': 'bg-violet-100 text-violet-800',
}

/** Employee/bezetting data only reaches the Unit Kerja level. */
function isUnitLevel(node: OrgNode): boolean {
  return node.kind !== 'subunit' && node.kind !== 'seksi'
}

export function NodeDetail({ node }: NodeDetailProps) {
  const [openRow, setOpenRow] = useState<number | null>(null)

  const rows = useMemo(() => (node ? collectDescendantRows(node) : []), [node])

  const byJenis = useMemo(() => {
    const map = new Map<string, { count: number; kebutuhan: number; bezetting: number }>()
    for (const row of rows) {
      const entry = map.get(row.jenisJabatan) ?? { count: 0, kebutuhan: 0, bezetting: 0 }
      entry.count += 1
      entry.kebutuhan += row.kebutuhan
      entry.bezetting += row.bezetting ?? 0
      map.set(row.jenisJabatan, entry)
    }
    return [...map.entries()].sort((a, b) => b[1].kebutuhan - a[1].kebutuhan)
  }, [rows])

  const byJenjang = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rows) {
      if (row.jenisJabatan !== 'Jabatan Fungsional') continue
      const key = row.jenjang === '-' ? 'Tanpa jenjang' : row.jenjang
      map.set(key, (map.get(key) ?? 0) + row.kebutuhan)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-400">
        Pilih salah satu kartu pada bagan untuk melihat rincian jabatan.
      </div>
    )
  }

  const unitLevel = isUnitLevel(node)
  const totalPegawai = unitLevel ? rows.reduce((sum, row) => sum + (row.pegawai?.length ?? 0), 0) : 0
  const tanpaFormasi = unitLevel ? rows.filter((row) => row.formasi === 'TIDAK').length : 0
  const jenisSet = new Set(byJenis.map(([jenis]) => jenis))
  const colSpan = unitLevel ? 5 : 3

  return (
    <div className="scroll-thin h-full overflow-auto p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {kindLabel(node.kind)}
        {node.eselon ? ` · Eselon ${node.eselon}` : ''}
      </p>
      <h2 className="mt-1 text-base font-bold leading-snug text-slate-800">{node.label}</h2>
      {node.structural && <p className="mt-0.5 text-xs text-slate-500">{node.structural.jabatan}</p>}

      {unitLevel ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-brand-50 p-2 text-center">
            <p className="text-base font-bold text-brand-700">{node.kebutuhan.toLocaleString('id-ID')}</p>
            <p className="text-[10px] font-medium uppercase text-brand-600">Kebutuhan</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2 text-center">
            <p className="text-base font-bold text-emerald-700">{node.bezetting.toLocaleString('id-ID')}</p>
            <p className="text-[10px] font-medium uppercase text-emerald-600">Bezetting</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 text-center">
            <p className="text-base font-bold text-slate-700">
              {(node.kebutuhan - node.bezetting).toLocaleString('id-ID')}
            </p>
            <p className="text-[10px] font-medium uppercase text-slate-500">Formasi</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 text-center">
            <p className="text-base font-bold text-slate-700">{totalPegawai.toLocaleString('id-ID')}</p>
            <p className="text-[10px] font-medium uppercase text-slate-500">Pegawai</p>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-brand-50 p-2 text-center">
            <p className="text-base font-bold text-brand-700">{node.kebutuhan.toLocaleString('id-ID')}</p>
            <p className="text-[10px] font-medium uppercase text-brand-600">Kebutuhan</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 text-center">
            <p className="text-base font-bold text-slate-700">{node.positionCount}</p>
            <p className="text-[10px] font-medium uppercase text-slate-500">Posisi</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 text-center">
            <p className="text-base font-bold text-slate-700">{node.children.length}</p>
            <p className="text-[10px] font-medium uppercase text-slate-500">Sub-unit</p>
          </div>
        </div>
      )}

      <section className="mt-4">
        <h3 className="text-xs font-semibold text-slate-500">Komposisi jenis jabatan</h3>
        <div className="mt-2 space-y-1.5">
          {byJenis.map(([jenis, stat]) => (
            <div key={jenis} className="flex items-center justify-between text-xs">
              <span className={`rounded px-1.5 py-0.5 font-medium ${JENIS_STYLE[jenis] ?? 'bg-slate-100 text-slate-700'}`}>
                {jenis}
              </span>
              <span className="tabular-nums text-slate-500">
                {stat.count} posisi · butuh {stat.kebutuhan.toLocaleString('id-ID')}
                {unitLevel && (
                  <>
                    {' '}
                    · isi <span className="font-semibold text-emerald-700">{stat.bezetting.toLocaleString('id-ID')}</span>
                  </>
                )}
              </span>
            </div>
          ))}
          {byJenis.length === 0 && <p className="text-xs text-slate-400">Tidak ada jabatan.</p>}
        </div>
      </section>

      {jenisSet.has('Jabatan Fungsional') && byJenjang.length > 0 && (
        <section className="mt-4">
          <h3 className="text-xs font-semibold text-slate-500">Jenjang fungsional</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {byJenjang.map(([jenjang, jumlah]) => (
              <span key={jenjang} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                {jenjang}: {jumlah}
              </span>
            ))}
          </div>
        </section>
      )}

      {tanpaFormasi > 0 && (
        <p className="mt-3 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] font-medium text-red-700">
          {tanpaFormasi} jabatan berstatus <strong>Formasi: Tidak</strong> (pegawai di luar formasi).
        </p>
      )}

      <section className="mt-4">
        <h3 className="text-xs font-semibold text-slate-500">Daftar jabatan ({rows.length})</h3>
        <p className="mt-0.5 text-[11px] text-slate-400">
          K = Kebutuhan · B = Bezetting · F = Formasi (Kebutuhan − Bezetting)
        </p>
        {unitLevel && (
          <p className="text-[11px] text-slate-400">Klik jabatan untuk melihat siapa saja yang mengisinya.</p>
        )}
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Jabatan</th>
                <th className="px-2 py-1 font-medium">Jenjang</th>
                <th className="px-2 py-1 text-right font-medium" title="Kebutuhan">
                  K
                </th>
                {unitLevel && (
                  <th className="px-2 py-1 text-right font-medium" title="Bezetting">
                    B
                  </th>
                )}
                {unitLevel && (
                  <th className="px-2 py-1 text-right font-medium" title="Formasi (Kebutuhan - Bezetting)">
                    F
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const tidak = row.formasi === 'TIDAK'
                const pegawai = row.pegawai ?? []
                const open = openRow === row.id
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => unitLevel && setOpenRow(open ? null : row.id)}
                      className={`${unitLevel ? 'cursor-pointer ' : ''}${tidak ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-2 py-1">
                        <span className={`flex items-center gap-1 font-medium ${tidak ? 'text-red-700' : 'text-slate-700'}`}>
                          {unitLevel && <span className="w-3 text-slate-400">{open ? '▾' : '▸'}</span>}
                          {row.jabatan}
                          {tidak && (
                            <span className="rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold uppercase text-white">
                              Tidak
                            </span>
                          )}
                        </span>
                        <span className={`block text-[10px] text-slate-400 ${unitLevel ? 'ml-4' : ''}`}>
                          {[row.unitKerja, row.satuanKerja, row.seksiKerja]
                            .filter((value) => value && value !== '-')
                            .join(' › ')}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-slate-500">{row.jenjang === '-' ? '—' : row.jenjang}</td>
                      <td className="px-2 py-1 text-right tabular-nums font-medium text-slate-700">{row.kebutuhan}</td>
                      {unitLevel && (
                        <td className="px-2 py-1 text-right tabular-nums font-medium text-emerald-700">
                          {row.bezetting ?? 0}
                        </td>
                      )}
                      {unitLevel && (
                        <td
                          className={`px-2 py-1 text-right tabular-nums font-semibold ${
                            row.kebutuhan - (row.bezetting ?? 0) < 0 ? 'text-red-600' : 'text-slate-700'
                          }`}
                        >
                          {row.kebutuhan - (row.bezetting ?? 0)}
                        </td>
                      )}
                    </tr>
                    {unitLevel && open && (
                      <tr className="bg-slate-50">
                        <td colSpan={colSpan} className="px-2 py-2">
                          {pegawai.length === 0 && (
                            <p className="rounded bg-white px-2 py-1 text-[11px] text-slate-400">
                              Belum ada pegawai pada jabatan ini.
                            </p>
                          )}
                          <ul className="space-y-1">
                            {pegawai.map((orang, index) => (
                              <li
                                key={`${orang.nip}-${index}`}
                                className="flex items-center justify-between rounded bg-white px-2 py-1 text-[11px]"
                              >
                                <span className="font-medium text-slate-700">{orang.nama}</span>
                                <span className="text-slate-400">
                                  {orang.nip} · {orang.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
