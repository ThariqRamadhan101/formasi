// One-off diagnostic (kept): builds the Excel report through Vite's SSR loader
// and writes it out so it can be diffed against `Lampiran.xlsx` with openpyxl.
// Run: node scripts/_check_report.mjs  (prints the written .xlsx path)
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const { buildReport } = await server.ssrLoadModule('/src/lib/report.ts')
  const formasi = JSON.parse(readFileSync('public/data/formasi.json', 'utf8'))
  const status = JSON.parse(readFileSync('public/data/fungsional-status.json', 'utf8'))
  const buffer = await buildReport(formasi.rows, status.status)
  const out = join(tmpdir(), 'report-check.xlsx')
  writeFileSync(out, Buffer.from(buffer))
  console.log(out)
} finally {
  await server.close()
}
