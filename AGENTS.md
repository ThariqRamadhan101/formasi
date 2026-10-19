# AGENTS.md

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

## Tabs & behavior

- `Bagan Organisasi` (`chart`, `OrgChart`): filters Formasi?/Jenis Jabatan/Jabatan/Jenjang/Kategori + search; zoom + drag/touch pan. Bezetting/Formasi/pegawai figures show only at unit-kerja level (kinds `root`/`group`/`unit`/`balai`); `subunit`/`seksi` hide them and aren't clickable for pegawai. Clicking a unit card opens `NodeDetail` (side panel on desktop, bottom sheet on mobile). Clicking a jabatan row expands its `pegawai`.
- `Data Formasi` (`data`, `DataExplorer`): formasi table, eselon-colored, `TIDAK` rows red, CSV export.
- `Data Pegawai` (`pegawai`, `DataPegawai`): from `rows[].pegawai`.
- `Status Fungsional` (`fungsional`, `StatusFungsional`): per-jabatan-fungsional status registry (default `BELUM_DIBUKA`); **Simpan** downloads `status-fungsional.json` — persist by overwriting `database/status-fungsional.json` + re-extract (static SPA cannot write files).
- `Pivot Data` (`pivot`, `PivotTable`); `Input Formasi` (`input`, `BulkForm` — target builder unit→satuan→seksi); `Pengaturan Opsi` (`opsi`, `OptionManager` — edit options + Export/Import database JSON).

## Gotchas

- `.xlsx` is an OOXML zip; `Expand-Archive` rejects the `.xlsx` extension — copy to `.zip` first. Don't hand-edit extracted XML/re-zip; use Excel or pandas.
- `public/data/*.json` are generated artifacts — regenerate with the extractor; never hand-edit.
- Vite uses a relative `base: './'`; JSON fetched via `import.meta.env.BASE_URL` (`src/lib/data.ts`).
