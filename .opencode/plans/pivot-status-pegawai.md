# Plan: Dimensi "Status Pegawai" di tab Pivot Data

## Tujuan

Menambahkan dimensi **Status Pegawai** pada Pivot Data sehingga **Jumlah Pegawai** (dan
Bezetting) bisa dihitung per status (`PNS` / `PPPK` / baris kosong), termasuk saat
digabung dengan dimensi lain (Unit Kerja, Jabatan, …) dan saat dipakai sebagai filter.

## Temuan (data & kode)

- `public/data/formasi.json`: status pegawai hanya `PNS` (883) dan `PPPK` (436); tidak ada
  status kosong. `bezetting === pegawai.length` pada **semua** baris (0 selisih) → menghitung
  `bezetting = 1` per fakta pegawai tidak mengubah total apa pun.
- 1708 baris tanpa pegawai; **127 baris punya pegawai campur status** (PNS + PPPK dalam satu
  baris) → label baris-saja (`"PNS + PPPK"`) akan membuat jumlah PNS/PPPK meleset.
- `src/lib/pivot.ts`: `PivotDimension.get(row)` mengembalikan **satu** label per
  `FormasiRow`, sedangkan measure `pegawai` = `Σ row.pegawai.length`. Satu baris ≠ satu
  status → butuh **ekspansi fakta per pegawai**.
- `src/components/PivotTable.tsx` me-render daftar field/measure dari `PIVOT_DIMENSIONS` /
  `PIVOT_MEASURES` dan nilai filter dari `uniqueFieldValues()` → perubahan terpusat di
  `pivot.ts`, tanpa perubahan fungsional di komponen.

## Desain: ekspansi "employee fact"

Saat dimensi `statusPegawai` dipakai (di area Baris, Kolom, atau Filter), setiap baris
formasi dipecah menjadi fakta per pegawai:

1. Fakta pegawai: `{ ...baris, pegawai: [p], statusPegawai: p.status || '—', bezetting: 1,
   kebutuhan: index === 0 ? baris.kebutuhan : 0 }` — **Kebutuhan 1x per baris**, ditempatkan
   pada status pegawai pertama (keputusan user) → Total Kebutuhan persis benar.
2. Baris tanpa pegawai → satu fakta `statusPeguai` = **`"Tanpa Pegawai"`**,
   `bezetting: 0`, `kebutuhan: baris.kebutuhan` (keputusan user) → kebutuhan belum terisi
   tetap terlihat.
3. Ekspansi **idempotent** (fakta di-ulang ekspansi hasilnya sama) → aman bila terjadi di
   `selectRows` (filter) sekaligus `computePivot` (baris/kolom).

Fakta mewarisi semua kolom baris (unitKerja, satuanKerja, seksiKerja, eselon, jenisJabatan,
jabatan, jenjang, formasi, kategori) sehingga dimensi/filter lain tetap bekerja.

## Perubahan file

### 1. `src/lib/pivot.ts` (inti, satu-satunya perubahan kode)

- `export interface PivotFact extends FormasiRow { statusPegawai?: string }`
- `PivotDimension.get` bertipe `(row: PivotFact) => string` (parameter lebih luas; dimensi
  lama tidak berubah perilaku, `FormasiRow[]` tetap assignable).
- Konstanta: `EMPLOYEE_FIELD = 'statusPegawai'`, `NO_EMPLOYEE_LABEL = 'Tanpa Pegawai'`.
- `expandEmployees(rows: FormasiRow[]): PivotFact[]` — aturan 1 & 2 di atas.
- Tambah ke `PIVOT_DIMENSIONS`:
  `{ id: 'statusPegawai', label: 'Status Pegawai', get: (row) => display(row.statusPegawai) }`.
- `computePivot()`: bila `config.rows`/`config.cols` memuat `statusPegawai` →
  `rows = expandEmployees(rows)` di awal.
- `selectRows()`: bila ada filter `statusPegawai` → expand dulu, lalu filter biasa
  (baris campur hanya menyumbang fakta berstatus yang dipilih).
- `uniqueFieldValues()`: khusus `statusPegawai` → set dari `row.pegawai[].status` semua
  baris + `"Tanpa Pegawai"` bila ada baris tanpa pegawai, diurutkan `localeCompare(…, 'id')`.
- `PivotLeaf.rows` / isi sel memakai `PivotFact[]` (measure tetap `FormasiRow[]` → kompatibel).

### 2. `src/components/PivotTable.tsx`

Tidak ada perubahan fungsional (daftar field, filter, format, CSV sudah generik). Cek ulang
label "Baris sumber" tetap menampilkan jumlah baris sumber, bukan jumlah fakta.

### 3. Dokumentasi

- `README.md`: baris fitur **Pivot Data** — sebutkan dimensi **Status Pegawai**
  (PNS/PPPK/Tanpa Pegawai) + catatan ekspansi fakta.
- `AGENTS.md`: paragraf pivot — tambah satu kalimat bahwa `statusPegawai` memicu ekspansi
  fakta per pegawai dan Kebutuhan hanya dihitung sekali per baris sumber.

## Perilaku yang diharapkan

| Konfigurasi | Hasil |
| --- | --- |
| Baris = Status Pegawai, Nilai = Jumlah Pegawai | PNS 883, PPPK 436, Tanpa Pegawai 0, Total 1319 |
| Nilai = Bezetting | identik dengan Jumlah Pegawai (karena `bezetting == len(pegawai)`) |
| Nilai = Kebutuhan | total = total kebutuhan seluruh data; grup "Tanpa Pegawai" = kebutuhan belum terisi |
| Filter Status Pegawai = PNS | hanya fakta PNS (127 baris campur menyusut ke PNS saja) |
| Status Pegawai + Unit Kerja | benar karena fakta mewarisi kolom baris |

Catatan: measure **Jumlah Baris** menghitung fakta (pegawai + baris kosong) saat dimensi
Status Pegawai aktif — perilaku yang wajar, dicatat di dokumentasi.

## Verifikasi

Tidak ada test suite (lihat AGENTS.md). Verifikasi:

1. `npm.cmd run build` (tsc -b + vite build) — wajib lolos (strict, `noUnusedLocals`).
2. `npm.cmd run lint`.
3. Sanity check angka: hitung ulang PNS/PPPK dari `public/data/formasi.json` (sudah:
   883/436) dan bandingkan dengan yang tampil di `npm.cmd run dev` → tab Pivot Data
   (Baris = Status Pegawai, Nilai = Jumlah Pegawai + Kebutuhan), termasuk filter PNS
   saja dan kombinasi dengan Unit Kerja.
