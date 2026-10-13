# Bagan Formasi Unit Organisasi

Aplikasi web **generik** untuk menampilkan formasi sebuah **Unit Organisasi** sebagai bagan
organisasi (organization chart), dilengkapi pengelolaan data formasi (multi-unit), serta
pengaturan opsi dinamis (Unit Kerja, Satuan Kerja, Seksi Kerja, Jabatan, Jenjang).

Tidak ada nama organisasi yang di-*hard-code*: unit akar diambil dari baris **Eselon I**,
unit Eselon II dari baris ber-eselon `II`, dan unit lainnya otomatis dikelompokkan sebagai
**UPT**. Ganti isi `database/Formasi.xlsx` untuk organisasi lain tanpa mengubah kode.

Data pegawai (`database/DATA PEGAWAI.xlsx`) ikut digabungkan: setiap jabatan mendapat **Bezetting**
(jumlah pegawai terisi) dan **Formasi** (= Kebutuhan − Bezetting), dan pegawai yang tidak
ada di formasi otomatis dibuatkan baris baru bertanda **Formasi: Tidak**.

---

## Arsitektur

```
database/  (sumber data — tidak di-serve)
  FORMASI.csv                 # sumber formasi #1 (export app, ';')
  formasi-master.json         # sumber formasi #2 (master 9 kolom input)
  Formasi.xlsx                # sumber formasi #3 (fallback)
  DATA PEGAWAI.xlsx           # sumber pegawai (Excel)
   │
   ▼  scripts/extract_formasi.py  (pandas + openpyxl; mencocokkan pegawai)
public/data/formasi.json   (baris + bezetting, formasiGap, daftar pegawai)
public/data/options.json   (seed daftar opsi)
   │  di-fetch saat runtime
   ▼
React + Vite + TypeScript + Tailwind (SPA statis)
   ├─ Bagan Organisasi    : buka/tutup, zoom, geser (drag), filter, klik → rincian + pegawai
   ├─ Data Formasi        : tabel + filter + edit + hapus + CSV (warna eselon)
   ├─ Data Pegawai        : tabel pegawai + filter + CSV
   ├─ Status Fungsional   : status tiap jabatan fungsional (warna per tahap) + CSV
   ├─ Pivot Data          : pivot bebas (pilih baris/kolom/measure) + CSV
   ├─ Input Formasi       : satu jabatan → banyak target (unit/satuan/seksi)
   └─ Pengaturan Opsi     : kelola daftar pilihan + Export/Import database (JSON)
        │
        └─ state tersimpan di localStorage (src/lib/store.tsx)
```

**Keputusan desain**

- **Data dipisah dari aplikasi.** Excel → JSON lewat skrip sekali jalan; tidak ada server.
  Pemuatan data terisolasi di `src/lib/data.ts` agar mudah diganti API di tahap berikutnya.
- **State aplikasi persisten di browser.** Baris formasi yang ditambah/dihapus dan opsi
  yang diedit disimpan di `localStorage` (key `formasi-unit-organisasi-v2`). Snapshot
  menyimpan versi seed; bila `database/formasi-master.json` di-ekstrak ulang, snapshot lama otomatis
  dibuang. Tombol **Reset ke data awal** mengembalikan ke hasil ekstraksi.
- **Opsi dinamis.** Daftar pilihan dikelola lewat menu **Pengaturan Opsi**, bukan hard-code
  di UI. `options.json` hanya menjadi *seed* awal yang diturunkan dari data.
- **Pohon dibangun dari kolom `unitKerja/satuanKerja/seksiKerja` + `eselon`.** Bentuknya:
  `Unit Eselon I → [unit Eselon II (Sekretariat/Direktorat/…), UPT (II) → unit UPT/Balai]`.
  Unit ber-eselon II berada di bawah akar; unit lain dikelompokkan sebagai **UPT**
  (ditampilkan sebagai level Eselon II).

### Kolom sheet `FORMASI` (semuanya input manual)

| Kolom | Nama | Catatan |
| --- | --- | --- |
| A | Eselon | I/II/III/IV (kosong = non-eselon) |
| B | Unit Kerja | opsi dinamis |
| C | Satuan Kerja | opsi dinamis |
| D | Seksi Kerja | opsi dinamis |
| E | Jabatan | opsi dinamis |
| F | Jenjang | opsi dinamis |
| G | Jenis Jabatan | Struktural / Fungsional / Pelaksana |
| H | Fomasi? | YA / TIDAK |
| I | Kebutuhan | angka |

Kolom turunan dari hasil merge `database/DATA PEGAWAI.xlsx` (tidak diinput manual):

| Kolom | Arti |
| --- | --- |
| Bezetting | jumlah pegawai yang mengisi jabatan (dari `DATA PEGAWAI`) |
| Formasi | `Kebutuhan − Bezetting` |
| pegawai | daftar nama/NIP/status pegawai pada baris tsb |

Pegawai dicocokkan per **(Unit Kerja, Jabatan, Jenjang)**. Karena data pegawai hanya
sampai Unit Kerja, bila satu key punya beberapa baris (Satuan/Seksi berbeda) pegawai
**dibagi rata**. Pegawai tanpa baris yang cocok dibuatkan baris baru dengan **Formasi:
Tidak** (disorot merah). Warna kartu bagan mengikuti eselon: **I merah pekat, II kuning,
III hijau muda, IV biru muda**.

---

## Fitur

- **Bagan Organisasi** — pohon unit (buka/tutup, zoom, **geser/drag**), pencarian unit/jabatan,
  serta filter **Formasi?**, **Jenis Jabatan**, **Jabatan**, dan **Jenjang**. Kartu berwarna per eselon.
  Klik kartu → panel rincian; klik salah satu baris **jabatan** → daftar pegawai yang
  mengisinya. Info **Bezetting/Formasi/pegawai hanya tampil sampai level Unit Kerja**
  (Satuan Kerja & Seksi tidak menampilkannya, karena data pegawai hanya sampai Unit Kerja).
- **Data Formasi** — tabel + filter + edit/hapus + Download CSV; kolom Kebutuhan/Bezetting/Formasi,
  baris berwarna eselon dan baris **Formasi: Tidak** disorot merah.
- **Data Pegawai** — daftar pegawai (hanya sampai **Unit Kerja**) + filter + Download CSV.
- **Status Fungsional** — status tiap jabatan fungsional yang **Formasi = YA** (Belum dibuka →
  dihitung/diusulkan unit pembina → diusulkan MenPAN-RB → ditetapkan MenPAN-RB) dengan warna
  berbeda, ubah massal, tombol **Simpan** (mengunduh `status-fungsional.json` — timpa
  `database/status-fungsional.json` lalu `npm run extract`), CSV.
- **Pivot Data** — pivot gaya Excel: daftar field + area **Filter / Kolom / Baris / Nilai**,
  banyak field per area, banyak measure, header baris/kolom bertingkat + total, CSV.
- **Filter kategori** — Bidang PU / Non Bidang PU / Bukan Fungsional di Bagan, Data Formasi,
  Data Pegawai, dan Pivot (daftar Bidang PU ada di `src/lib/fungsional.ts`).
- **Input Formasi** — satu jabatan diterapkan ke banyak target (unit → satuan → seksi).
- **Pengaturan Opsi** — kelola daftar Unit/Satuan/Seksi/Jabatan/Jenjang (hierarkis per relasi).

---

## Menjalankan

Prasyarat: **Node.js 18+**, **Python 3.10+** dengan `pandas` dan `openpyxl`.

```powershell
npm install
python scripts/extract_formasi.py   # atau: npm run extract  -> public/data/*.json
npm run dev
npm run build                       # tsc -b && vite build   -> dist/
npm run preview
npm run lint
```

Setiap `database/FORMASI.csv`, `database/formasi-master.json`, `database/Formasi.xlsx`,
**atau** `database/DATA PEGAWAI.xlsx` berubah, **jalankan `npm run extract` lagi**
(atau `npm run refresh` untuk extract + build).

### Update data pegawai

1. Ganti/timpa `database/DATA PEGAWAI.xlsx`. Sheet harus tetap bernama `DATA PEGAWAI` dengan kolom:
   `NAMA LENGKAP, NIP, STATUS PEGAWAI, NAMA JABATAN, JENIS JABATAN, JENJANG JABATAN, UNIT KERJA`.
2. Jalankan `npm run extract` — skrip akan menghitung ulang **Bezetting** & **Formasi** dan
   membuat baris **Formasi: Tidak** untuk pegawai di luar formasi. Bisa menunjuk file lain:
   `python scripts/extract_formasi.py --pegawai "path/DATA PEGAWAI.xlsx"`.
3. Muat ulang browser — snapshot `localStorage` lama otomatis dibuang karena versi seed
   (`generatedAt`) berubah, sehingga data terbaru langsung dipakai.

Pencocokan pegawai memakai key **(Unit Kerja, Jabatan, Jenjang)**; bila beberapa baris
formasi punya key sama (Satuan/Seksi berbeda) pegawai **dibagi rata**. Mapping jenjang
pegawai → formasi: `Pelaksana Terampil → Terampil`, `Pelaksana Lanjutan (Mahir) → Mahir`,
`Ahli Utama/Madya/Muda/Pertama` dan `Penyelia` tetap sama.

### Catatan Windows / PowerShell

- Jika muncul `npm.ps1 cannot be loaded because running scripts is disabled`, gunakan
  `npm.cmd install`, `npm.cmd run dev`, dst. (ExecutionPolicy memblokir shim `.ps1`).
- `.xlsx` adalah arsip OOXML; `Expand-Archive` menolak ekstensi `.xlsx` (salin ke `.zip` dulu).
  Jangan mengedit XML di dalam zip lalu men-zip ulang manual — pakai Excel/pandas.

---

## Struktur proyek

```
database/                       # SEMUA sumber data (tidak di-serve)
  FORMASI.csv                   # sumber formasi utama (format export app, ';')
  formasi-master.json           # sumber formasi cadangan (9 kolom input)
  Formasi.xlsx                  # sumber formasi fallback
  DATA PEGAWAI.xlsx             # sumber pegawai
  status-fungsional.json        # status jabatan fungsional (disalin ke public/data)
scripts/extract_formasi.py      # database -> public/data/*.json
public/data/                    # artefak hasil extract (di-serve ke browser)
  formasi.json                  # baris formasi + bezetting/formasi/pegawai
  options.json                  # seed daftar opsi
src/
  lib/types.ts                  # tipe data
  lib/data.ts                   # loader JSON (fetch)
  lib/formasi.ts                # pembangun pohon + filter + lookups
  lib/fungsional.ts             # kategori Bidang PU / Non Bidang PU / Bukan Fungsional
  lib/pivot.ts                  # dimensi + measure + computePivot
  lib/optionModel.ts            # model opsi hierarkis
  lib/store.tsx                 # state global + localStorage (+ status fungsional)
  components/
    Header.tsx                  # judul + statistik + nav tab
    OrgChart.tsx                # bagan organisasi (filter, zoom, drag)
    NodeDetail.tsx              # rincian unit + daftar pegawai
    DataExplorer.tsx            # tabel formasi + filter + edit + hapus + CSV
    DataPegawai.tsx             # tabel pegawai + filter + CSV
    StatusFungsional.tsx        # status jabatan fungsional + CSV
    PivotTable.tsx              # pivot data bebas + CSV
    BulkForm.tsx                # input formasi (banyak target)
    OptionManager.tsx           # pengaturan opsi + export/import database
    RowEditor.tsx               # edit satu baris
  App.tsx
```

### Database formasi (folder `database/`)

Semua sumber data ada di folder `database/` (tidak di-serve; `public/data/*.json` adalah
artefak hasil extract). Sumber formasi dipilih otomatis dengan urutan prioritas:

1. **`database/FORMASI.csv`** — format "Download CSV" dari tab Data Formasi (pemisah `;`).
2. **`database/formasi-master.json`** — master JSON (Export database).
3. **`database/Formasi.xlsx`** — fallback.

**Update lewat CSV (paling praktis):**

1. Di tab **Data Formasi**, klik **Download CSV** (atau siapkan CSV dengan header
   `Eselon;Unit Kerja;Satuan Kerja;Seksi Kerja;Jabatan;Jenjang;Jenis Jabatan;Formasi?;Kebutuhan`).
2. Simpan/timpa sebagai `database/FORMASI.csv` (kolom `Bezetting`/`Formasi` opsional, diabaikan).
3. `npm run extract` — skrip membaca CSV + `database/DATA PEGAWAI.xlsx`, menghitung ulang
   Bezetting/Formasi di `public/data/formasi.json`.

Lewati sumber dengan `--no-csv` / `--no-master`; tulis ulang dengan `--write-csv` /
`--write-master` (mis. `python scripts/extract_formasi.py --no-csv --write-csv` mengubah
master JSON/Excel menjadi CSV). **Import database (JSON)** di Pengaturan Opsi memuat berkas
export kembali ke aplikasi.

---

## Tahap berikutnya (di luar lingkup sekarang)

- Pencocokan pegawai yang lebih presisi (data pegawai belum memuat Satuan/Seksi Kerja,
  saat ini dibagi rata).
- Persistensi permanen (backend + basis data) sebagai pengganti localStorage.
- Ekspor hasil input kembali ke Excel/CSV.
"# formasi" 
