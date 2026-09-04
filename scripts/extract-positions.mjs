import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const wb = XLSX.read(readFileSync(join(root, '岗位示例表.xlsx')))
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { defval: '', raw: false })
const out = rows.map((r) => ({
  c: String(r['公司'] || '').trim(),
  d: String(r['部门'] || '').trim(),
  t: String(r['班组'] || '').trim(),
  j: String(r['岗位'] || '').trim(),
}))
writeFileSync(join(root, 'src/data/positions.json'), JSON.stringify(out))
console.log('wrote', out.length, 'positions')
