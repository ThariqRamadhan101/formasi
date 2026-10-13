# AGENTS.md

## What this is

All source data lives in the `database/` folder — formasi from `FORMASI.csv` (primary),
`formasi-master.json`, or `Formasi.xlsx` (fallback; **currently absent**), pegawai from
`DATA PEGAWAI.xlsx` (sheet `DATA PEGAWAI`, 7 kolom), plus `status-fungsional.json`
(manual status registry, not derived). They feed a web app **generik** yang menampilkan
formasi sebuah Unit Organisasi sebagai bagan organisasi. `extract_formasi.py` menggabungkan
formasi + pegawai: baris mendapat `bezetting`, `formasiGap` (Kebutuhan − Bezetting), dan daftar
`pegawai`; pegawai tanpa baris formasi dibuatkan baris baru `formasi = "TIDAK"`.
**Jangan hard-code nama organisasi** — semuanya diturunkan dari data.

## Commands

Use `npm.cmd` instead of `npm` on this Windows box — the `.ps1` shim is blocked by
ExecutionPolicy.

```powershell
npm.cmd install
python scripts/extract_formasi.py   # or: npm.cmd run extract   -> public/data/*.json
npm.cmd run dev
npm.cmd run build                   # tsc -b && vite build   (build fails on type errors)
npm.cmd run lint
npm.cmd run refresh                 # extract + build
```

- **After editing any `database/` source you MUST re-run `npm run extract`.** The formasi
  source is auto-picked in this priority: `database/FORMASI.csv` (app "Download CSV" format,
  `;`-separated) → `database/formasi-master.json` → `database/Formasi.xlsx`. Skip a source with
  `--no-csv` / `--no-master`; create files with `--write-csv` / `--write-master`. The app reads
  `public/data/formasi.json`, `options.json`, and `fungsional-status.json` (copied from
  `database/status-fungsional.json`), not the sources.
- Python extraction needs `pandas` + `openpyxl` (present on this machine; Python 3.13).
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
- `OptionManager` also has **Export/Import database (JSON)** (`FormasiDatabase`: rows + model +
  `fungsionalStatus`) — the in-app editor for the JSON-master workflow.

## Workbook gotchas

- `.xlsx` is an OOXML zip. `Expand-Archive` rejects the `.xlsx` extension; copy to `.zip`
  first. Do not hand-edit extracted XML and re-zip blindly — use Excel/pandas.
- The workbook still embeds stale Power Query (DataMashup) parts (`customXml/`, `connections.xml`)
  but they are not read by the extractor.
- Keep Indonesian sheet/column/value names unchanged — the app matches on exact strings
  (e.g. `Jabatan Struktural`; `Eselon` values `I`/`II`/`III`/`IV`).

## Conventions

- `public/data/*.json` are generated artifacts — regenerate with the extractor; never hand-edit.
  ESLint ignores `public/data`; eslint also ignores `dist`.
- TypeScript is strict with `verbatimModuleSyntax` (use `import type` for types) plus
  `noUnusedLocals`/`noUnusedParameters`; `npm.cmd run build` runs `tsc -b` first, so these
  fail the build even though `lint` may not catch them.
- Vite uses a relative `base: './'`; JSON is fetched via `import.meta.env.BASE_URL` (`src/lib/data.ts`).
