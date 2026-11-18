# AGENTS.md

## Commands

- `npm install` — Node 18+.
- `python3 scripts/extract_formasi.py` — regenerate `public/data/{formasi,options,fungsional-status}.json` from `database/`. **Re-run after every `database/` edit**; the app only reads `public/data/*.json`, never the sources. Use `python3`: `npm run extract` invokes bare `python`, which may not exist. Requires `pandas` + `openpyxl`.
- `npm run dev` — Vite dev server.
- `npm run build` — `tsc -b && vite build`; this is the only typecheck. `strict` + `verbatimModuleSyntax` (use `import type` for types) + `noUnusedLocals`/`noUnusedParameters`.
- `npm run lint` — `eslint .` (ignores `public/data`, `dist`).
- `npm run refresh` — extract + build.
- No test suite or formatter. Verify with `build` + `lint`.

## Data sources & priority

`scripts/extract_formasi.py` picks the formasi source automatically:
1. `database/FORMASI.csv` — `;`-separated, app "Download CSV" format.
2. `database/formasi-master.json` — 9-column input master (`generatedAt` + `rows`).
3. `database/Formasi.xlsx` — sheet `FORMASI`, columns A–I (Eselon, Unit Kerja, Satuan Kerja, Seksi Kerja, Jabatan, Jenjang, Jenis Jabatan, Fomasi?, Kebutuhan).

**A present CSV always wins**: editing `formasi-master.json` or `Formasi.xlsx` has no effect until the CSV is removed/renamed or `--no-csv` is passed. `--write-csv` / `--write-master` write the current input rows back to those sources (e.g. `--no-csv --write-csv` converts the master to CSV).

Pegawai: `database/DATA PEGAWAI.xlsx` (sheet `DATA PEGAWAI`, 7 columns). Matching key `(Unit Kerja, Jabatan, Jenjang)`; multiple formasi rows sharing a key split employees round-robin ("bagi rata"); unmatched employees become new rows `formasi="TIDAK"`, `kebutuhan=0`. Employee `NAMA JABATAN` carries a jenjang suffix stripped before matching; jenjang mapped (`Pelaksana Terampil`→`Terampil`, `Pelaksana Lanjutan (Mahir)`→`Mahir`, `Ahli *`/`Penyelia` unchanged).

Status: `database/status-fungsional.json` (manual registry keyed by jabatan name, copied to `public/data/fungsional-status.json` on extract).

**Never hard-code organization names** — everything is derived from data. Keep Indonesian sheet/column/value strings unchanged (exact match; e.g. `Jabatan Struktural`, `Eselon` `I`/`II`/`III`/`IV`).

## Architecture (not obvious from filenames)

- `src/lib/store.tsx` — single source of truth at runtime: React context holding `rows` + editable `options`, persisted to `localStorage` (`formasi-unit-organisasi-v2`). Snapshot stores `seedVersion` (= JSON `generatedAt`); when it differs the browser snapshot is discarded and the fresh extract is used. All mutating UI goes through the store.
- `src/lib/formasi.ts` — builds the org tree generically (root = Eselon I row; Eselon II units below it; all other units under synthetic `UPT`/`Unit Pelaksana Teknis`). It has two label-pattern layout heuristics despite being name-agnostic: `isAssistant()` treats labels starting `SEKRETARIAT` or containing `TATA USAHA` as staff branches drawn beside their principal, and rows whose jabatan matches `Subbagian ... Tata Usaha` are merged into the matching sub-unit instead of creating a duplicate branch. `normalizeName()` treats `""` and `"-"` as no value. `applyRowFilter(tree, predicate)` filters + recomputes aggregates + prunes empty branches (chart filters use it so filtering never breaks hierarchy). `groupRowsByJabatan(rows)` feeds `NodeDetail`: groups by jabatan + jenjang (+ jenis/formasi) and sorts structural (highest eselon) → fungsional/pelaksana in formasi → outside formasi → other, A–Z with hierarchical jenjang.
- `src/lib/colors.ts` — `ESELON_COLORS` (I red-800, II yellow, III green, IV sky) and `FUNGSIONAL_STATUS_META`.
- `src/lib/fungsional.ts` — classifies rows `BIDANG_PU` (14 hard-coded names) / `NON_BIDANG_PU` / `BUKAN_FUNGSIONAL`; case/whitespace-insensitive name matching. Update the list there when PU jabatan change.
- `src/lib/optionModel.ts` — hierarchical `OptionModel`; `buildOptionModel` derives cascading unit→satuan→seksi relations from rows. Option renames also rewrite matching row values (and status keys for `jabatanFungsional`).
- `src/lib/pivot.ts` — pure `computePivot(rows, {rows, cols, values, filters})`; `PIVOT_DIMENSIONS` / `PIVOT_MEASURES`.
- `src/lib/data.ts` — fetchers for `formasi.json`, `options.json`, `fungsional-status.json` via `import.meta.env.BASE_URL` (Vite `base: './'`).
- No router: tab selection and chart filters are local state in `src/App.tsx`; every tab reads `rows` from `useStore()`.

## Tabs & behavior

- `Bagan Organisasi` (`chart`, `OrgChart`): filters Formasi?/Jenis Jabatan/Jabatan/Jenjang/Kategori + search; zoom + drag/touch pan. Bezetting/Formasi/pegawai figures show only at unit-kerja level (kinds `root`/`group`/`unit`/`balai`); `subunit`/`seksi` hide them and aren't clickable for pegawai. Clicking a unit card opens `NodeDetail` (side panel on desktop, bottom sheet on mobile). The desktop panel is resizable via its left edge (width persisted in `localStorage`); the mobile sheet has a full-height toggle. Clicking a jabatan row expands its locations (paths shown relative to the selected node) and `pegawai`.
- `Data Formasi` (`data`, `DataExplorer`): formasi table, eselon-colored, `TIDAK` rows red, CSV export.
- `Data Pegawai` (`pegawai`, `DataPegawai`): from `rows[].pegawai`.
- `Status Fungsional` (`fungsional`, `StatusFungsional`): per-jabatan-fungsional status registry (default `BELUM_DIBUKA`); **Simpan** downloads `status-fungsional.json` — persist by overwriting `database/status-fungsional.json` + re-extract (static SPA cannot write files).
- `Pivot Data` (`pivot`, `PivotTable`); `Input Formasi` (`input`, `BulkForm` — target builder unit→satuan→seksi); `Pengaturan Opsi` (`opsi`, `OptionManager` — edit options + Export/Import database JSON).

## Gotchas

- `public/data/*.json` are generated **but tracked**; extracting rewrites them with a new `generatedAt`, so expect a dirty tree and commit those diffs intentionally. Never hand-edit them.
- The changing `generatedAt` is also what invalidates stale browser `localStorage` snapshots — that is deliberate.
- `.xlsx` is an OOXML zip; `Expand-Archive` rejects the `.xlsx` extension — copy to `.zip` first. Don't hand-edit extracted XML/re-zip; use Excel or pandas.
- Vite uses a relative `base: './'`; JSON must be fetched via `import.meta.env.BASE_URL` (`src/lib/data.ts`), not an absolute `/data/...` path.
