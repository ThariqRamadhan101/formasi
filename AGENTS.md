# AGENTS.md

<<<<<<< HEAD
## What this is

All source data lives in the `database/` folder — formasi from `FORMASI.csv` (primary),
`formasi-master.json`, or `Formasi.xlsx` (fallback; **currently absent** — the README still
speaks as if this file were the primary source; trust the priority order below instead), pegawai from
`DATA PEGAWAI.xlsx` (sheet `DATA PEGAWAI`, 7 kolom), plus `status-fungsional.json`
(manual status registry, not derived). They feed a web app **generik** yang menampilkan
formasi sebuah Unit Organisasi sebagai bagan organisasi. `extract_formasi.py` menggabungkan
formasi + pegawai: baris mendapat `bezetting`, `formasiGap` (Kebutuhan − Bezetting), dan daftar
`pegawai`; pegawai tanpa baris formasi dibuatkan baris baru `formasi = "TIDAK"`.
**Jangan hard-code nama organisasi** — semuanya diturunkan dari data.

=======
>>>>>>> d0cf1abfa79ec49793bd6f0b61deeeceffb6ebc7
## Commands

- `npm install` — install deps (Node 18+).
- `python scripts/extract_formasi.py` (or `npm run extract`) — reads `database/` sources + `database/DATA PEGAWAI.xlsx`, writes `public/data/{formasi,options,fungsional-status}.json`. **Re-run after every `database/` edit.** The app reads `public/data/*.json`, not the sources.
- `npm run dev` — Vite dev server.
- `npm run build` — `tsc -b && vite build`. Fails on type errors (`strict`, `verbatimModuleSyntax` → use `import type` for types, `noUnusedLocals`/`noUnusedParameters`).
- `npm run lint` — ESLint (ignores `public/data`, `dist`).
- `npm run refresh` — extract + build.
- No test suite. Verify with `build` + `lint`.
- Python needs `pandas` + `openpyxl` (present; Python 3.13).

## Data sources & priority

<<<<<<< HEAD
- **After editing any `database/` source you MUST re-run `npm run extract`.** The formasi
  source is auto-picked in this priority: `database/FORMASI.csv` (app "Download CSV" format,
  `;`-separated) → `database/formasi-master.json` → `database/Formasi.xlsx`. Skip a source with
  `--no-csv` / `--no-master`; create files with `--write-csv` / `--write-master`. The app reads
  `public/data/formasi.json`, `options.json`, and `fungsional-status.json` (copied from
  `database/status-fungsional.json`), not the sources.
- Python extraction needs `pandas` + `openpyxl` — already installed on this machine
  (verified: Python 3.15.0, pandas 3.0.6, openpyxl 3.1.5); no venv or setup step.
- **There is no test suite / test runner.** Verify with `npm.cmd run build` (tsc) + `lint`.

## Architecture (not obvious from filenames)

- `scripts/extract_formasi.py` reads sheet `FORMASI` (columns A..I: Eselon, Unit Kerja,
  Satuan Kerja, Seksi Kerja, Jabatan, Jenjang, Jenis Jabatan, Fomasi?, Kebutuhan) **and**
  `DATA PEGAWAI`. Employee matching: key `(Unit Kerja, Jabatan, Jenjang)`; when several
  formasi rows share a key, employees are spread round-robin ("bagi rata"). Unmatched
  employees become new rows with `formasi = "TIDAK"`, `kebutuhan = 0`. Output rows carry
  `bezetting`, `formasiGap`, `pegawai[]`. Employee `NAMA JABATAN` includes the jenjang
  suffix, so it is stripped to the base jabatan before matching; the employee jenjang is
  mapped (`Pelaksana Terampil`→`Terampil`, `Pelaksana Lanjutan (Mahir)`→`Mahir`,
  `Ahli *`/`Penyelia` unchanged). CLI: `--xlsx`, `--pegawai`, `--status-json`, `--out`;
  also copies `database/status-fungsional.json` → `public/data/fungsional-status.json`.
- `src/lib/store.tsx` is the single source of truth at runtime: React context holding
  `rows` + editable `options`, persisted to `localStorage` (`formasi-unit-organisasi-v2`).
  The snapshot stores `seedVersion` (= JSON `generatedAt`); when it differs the browser
  snapshot is discarded and the fresh extract is used. All mutating UI goes through the store.
- `src/lib/formasi.ts` builds the tree and lookups **generically**. Root = the Eselon I row;
  level-2 units = units that have an Eselon II row; all remaining units are grouped under a
  synthetic Eselon II node `UPT`. Tree:
  `<Eselon I> -> [Eselon II units, UPT (II) -> UPT/Balai units]`. Built from
  `unitKerja/satuanKerja/seksiKerja` + `eselon`; **never** match on organization names.
  `applyRowFilter(tree, predicate)` filters the built tree (recomputes aggregates + prunes
  empty branches) — used by the chart filters so filtering never breaks the hierarchy.
  - `normalizeName()` treats the workbook placeholders `""` and `"-"` as "no value" — the
    extractor writes `-` for unmatched employees' Satuan/Seksi. Reuse it before comparing names.
  - Co-managing heads (`/subbagian.*tata usaha/i`) stored as structural rows are merged into
    the matching child sub-unit (leading `Kepala ` stripped) instead of duplicating a branch.
- Eselon colors live in `src/lib/colors.ts` (`ESELON_COLORS`): I `red-800`, II `yellow`,
  III `green`, IV `sky`; used for chart cards and table row/badge tints. Cards without an
  eselon fall back to `KIND_STYLE` per node kind. `isAssistant()` (label starts
  `SEKRETARIAT` or contains `TATA USAHA`) renders a node to the right via the
  `.oc-assistant` "I-" connector.
- `OrgChart` owns the chart toolbar filters (**Formasi?**, **Jenis Jabatan**, **Jabatan**,
  **Jenjang**, search). Filter values are lifted to `App.tsx` and applied with
  `applyRowFilter`; search only highlights matches. Mouse drag pans the canvas. Employee/bezetting figures are
  **unit-kerja level only** (kinds `root`/`group`/`unit`/`balai`); `subunit` (Satuan Kerja)
  and `seksi` hide Bezetting/Formasi and are not clickable for `pegawai` — because employee
  data only reaches Unit Kerja. At unit level, `NodeDetail` lists a node's jabatan and
  clicking a row expands the `pegawai` attached to it.
- `DataPegawai` derives its list from `rows[].pegawai` (employee data only reaches Unit
  Kerja); `DataExplorer` is the formasi table (eselon-colored, `TIDAK` rows red, CSV export).
  Both filter on unit/jenis jabatan/**jenjang**/kategori (+ status pegawai in DataPegawai);
  Data Formasi's eselon filter was deliberately replaced by the jenjang filter.
- Dynamic options live in `options.json` (seed) and are edited in `OptionManager`
  (`Pengaturan Opsi`); the editable shape is hierarchical (`OptionModel` in
  `src/lib/optionModel.ts`). `buildLookups` derives cascading relations from rows.
- `BulkForm` (`Input Formasi`) uses a target builder (unit → satuan → seksi) and creates one
  row per target; quick actions use `satelliteUnitNames()` (units without an Eselon II row).
- `src/lib/fungsional.ts` classifies rows: `BIDANG_PU` (14 hard-coded names), `NON_BIDANG_PU`,
  `BUKAN_FUNGSIONAL`; name matching is case/whitespace-insensitive because the workbook has
  `Dan`/`dan` variants. The **Kategori** filter is wired into `OrgChart`, `DataExplorer`,
  `DataPegawai`, and the pivot.
- `StatusFungsional` (`Status Fungsional` tab) is a per-jabatan-fungsional status registry
  (no status exists in the source data). Statuses live in `fungsionalStatus` in the store
  (localStorage), default `BELUM_DIBUKA`, keyed by jabatan name; renaming/removing the option
  keeps it in sync. Colors/labels in `FUNGSIONAL_STATUS_META` (`src/lib/colors.ts`).
  **💾 Simpan** downloads `status-fungsional.json` (`{generatedAt, status}`) — a static SPA
  cannot write files, so persist by overwriting `database/status-fungsional.json` and
  re-running extract (notice in the tab says this).
- `src/lib/pivot.ts` + `PivotTable` (`Pivot Data` tab) is an Excel-style pivot: field list
  plus Rows/Columns/Values/Filter areas, multiple fields per area, multiple measures, nested
  row/column headers with totals. `computePivot(rows, {rows, cols, values, filters})` is pure;
  `selectRows` applies filter fields. `PIVOT_DIMENSIONS` / `PIVOT_MEASURES` are the field lists.
- `src/lib/report.ts` builds the "Lampiran" Excel report (sheets `Tabel 1`, `Tabel 2`,
  `Lampiran I`, `Lampiran II`, `Lampiran III`, mirroring `Lampiran.xlsx`) with `exceljs`
  from the live store `rows` + `fungsionalStatus`; the **📥 Unduh Report** button in
  `Header.tsx` downloads it as `Lampiran_YYYY-MM-DD.xlsx`. K = kebutuhan, B = bezetting of
  `formasi='YA'` rows, F = K−B; "Tidak Sesuai" = `TIDAK` rows (footnote counts their
  pegawai); Lampiran I splits eselon III into III.a (central) / III.b (satellite) and
  JF into Bidang PU / Non Bidang PU via `categoryOfJabatan`; the template's hand-typed
  **KI / TOTAL** columns are deliberately omitted (not derivable from data). Tabel 2 groups
  jabatan fungsional by status in **reversed** registry order (Ditetapkan MenPAN-RB →
  Belum dibuka, jabatan A–Z inside each status); Lampiran II lists them **A–Z**.
  `scripts/_check_report.mjs` regenerates the workbook through Vite SSR for diffing against
  the template with openpyxl. `tsconfig.app.json` sets `allowSyntheticDefaultImports` for
  the `import ExcelJS from 'exceljs'` CJS interop.
- `OptionManager` also has **Export/Import database (JSON)** (`FormasiDatabase`: rows + model +
  `fungsionalStatus`) — the in-app editor for the JSON-master workflow.
=======
`scripts/extract_formasi.py` picks the formasi source automatically:
1. `database/FORMASI.csv` — `;`-separated, app "Download CSV" format.
2. `database/formasi-master.json` — 9-column input master (`generatedAt` + `rows`).
3. `database/Formasi.xlsx` — sheet `FORMASI`, columns A–I (Eselon, Unit Kerja, Satuan Kerja, Seksi Kerja, Jabatan, Jenjang, Jenis Jabatan, Fomasi?, Kebutuhan).

Pegawai: `database/DATA PEGAWAI.xlsx` (sheet `DATA PEGAWAI`, 7 columns). Matching key `(Unit Kerja, Jabatan, Jenjang)`; multiple formasi rows sharing a key split employees round-robin ("bagi rata"); unmatched employees become new rows `formasi="TIDAK"`, `kebutuhan=0`. Employee `NAMA JABATAN` carries a jenjang suffix stripped before matching; jenjang mapped (`Pelaksana Terampil`→`Terampil`, `Pelaksana Lanjutan (Mahir)`→`Mahir`, `Ahli *`/`Penyelia` unchanged).

Status: `database/status-fungsional.json` (manual registry, copied to `public/data/fungsional-status.json` on extract).

**Never hard-code organization names** — everything is derived from data. Keep Indonesian sheet/column/value strings unchanged (exact match; e.g. `Jabatan Struktural`, `Eselon` `I`/`II`/`III`/`IV`).

## Architecture (not obvious from filenames)

- `src/lib/store.tsx` — single source of truth at runtime: React context holding `rows` + editable `options`, persisted to `localStorage` (`formasi-unit-organisasi-v2`). Snapshot stores `seedVersion` (= JSON `generatedAt`); when it differs the browser snapshot is discarded and the fresh extract is used. All mutating UI goes through the store.
- `src/lib/formasi.ts` — builds the org tree generically (root = Eselon I row; Eselon II units below it; all other units under synthetic `UPT`/`Unit Pelaksana Teknis`). Never matches on org names. `normalizeName()` treats `""` and `"-"` as no value. `applyRowFilter(tree, predicate)` filters + recomputes aggregates + prunes empty branches (chart filters use it so filtering never breaks hierarchy).
- `src/lib/colors.ts` — `ESELON_COLORS` (I red-800, II yellow, III green, IV sky) and `FUNGSIONAL_STATUS_META`.
- `src/lib/fungsional.ts` — classifies rows `BIDANG_PU` (14 hard-coded names) / `NON_BIDANG_PU` / `BUKAN_FUNGSIONAL`; case/whitespace-insensitive name matching.
- `src/lib/optionModel.ts` — hierarchical `OptionModel`; `buildOptionModel` derives cascading unit→satuan→seksi relations from rows.
- `src/lib/pivot.ts` — pure `computePivot(rows, {rows, cols, values, filters})`; `PIVOT_DIMENSIONS` / `PIVOT_MEASURES`.
- `src/lib/data.ts` — fetchers for `formasi.json`, `options.json`, `fungsional-status.json` via `import.meta.env.BASE_URL` (Vite `base: './'`).
>>>>>>> d0cf1abfa79ec49793bd6f0b61deeeceffb6ebc7

## Tabs & behavior

- `Bagan Organisasi` (`chart`, `OrgChart`): filters Formasi?/Jenis Jabatan/Jabatan/Jenjang/Kategori + search; zoom + drag/touch pan. Bezetting/Formasi/pegawai figures show only at unit-kerja level (kinds `root`/`group`/`unit`/`balai`); `subunit`/`seksi` hide them and aren't clickable for pegawai. Clicking a unit card opens `NodeDetail` (side panel on desktop, bottom sheet on mobile). Clicking a jabatan row expands its `pegawai`.
- `Data Formasi` (`data`, `DataExplorer`): formasi table, eselon-colored, `TIDAK` rows red, CSV export.
- `Data Pegawai` (`pegawai`, `DataPegawai`): from `rows[].pegawai`.
- `Status Fungsional` (`fungsional`, `StatusFungsional`): per-jabatan-fungsional status registry (default `BELUM_DIBUKA`); **Simpan** downloads `status-fungsional.json` — persist by overwriting `database/status-fungsional.json` + re-extract (static SPA cannot write files).
- `Pivot Data` (`pivot`, `PivotTable`); `Input Formasi` (`input`, `BulkForm` — target builder unit→satuan→seksi); `Pengaturan Opsi` (`opsi`, `OptionManager` — edit options + Export/Import database JSON).

## Gotchas

- `.xlsx` is an OOXML zip; `Expand-Archive` rejects the `.xlsx` extension — copy to `.zip` first. Don't hand-edit extracted XML/re-zip; use Excel or pandas.
- `public/data/*.json` are generated artifacts — regenerate with the extractor; never hand-edit.
<<<<<<< HEAD
  ESLint ignores `public/data`; eslint also ignores `dist`.
- TypeScript is strict with `verbatimModuleSyntax` (use `import type` for types) plus
  `noUnusedLocals`/`noUnusedParameters`; `npm.cmd run build` runs `tsc -b` first, so these
  fail the build even though `lint` may not catch them.
- Vite uses a relative `base: './'`; JSON is fetched via `import.meta.env.BASE_URL` (`src/lib/data.ts`).
- `tsc -b` only type-checks `src/` and `vite.config.ts` (the `include`s in `tsconfig.app.json`
  / `tsconfig.node.json`) — `scripts/*.ts` is outside the build but still linted by `eslint .`.
  `scripts/_check_cm.ts` is a one-off org-tree diagnostic (imports `src/lib/formasi.ts` with a
  `.ts` extension); no npm script or TS runner is wired for it, so it never runs in build/lint
  workflows on its own. `scripts/_check_report.mjs` (report-vs-template diagnostic, uses Vite's
  `ssrLoadModule` + openpyxl externally) is plain ESM JavaScript — neither `tsc -b` nor
  `eslint .` (which only matches `**/*.{ts,tsx}`) touches it.
=======
- Vite uses a relative `base: './'`; JSON fetched via `import.meta.env.BASE_URL` (`src/lib/data.ts`).
>>>>>>> d0cf1abfa79ec49793bd6f0b61deeeceffb6ebc7
