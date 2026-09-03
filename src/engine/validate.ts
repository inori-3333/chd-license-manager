import { parseDate } from './dates'
import type { ImportError } from '../types'

export interface RawRow {
  sheet: string
  row: number
  kind: 'person' | 'certificate' | 'work_scope'
  values: Record<string, string>
}

const MAX_LEN = 200

function v(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const hit = Object.keys(row).find((x) => x.replace(/\s/g, '') === k.replace(/\s/g, ''))
    if (hit && row[hit] != null && String(row[hit]).trim()) return String(row[hit]).trim()
  }
  return ''
}

export function normalizeHeaderMap(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(row)) {
    out[k.trim()] = val == null ? '' : String(val).trim()
  }
  return out
}

export function hardValidate(raw: RawRow): ImportError[] {
  const errors: ImportError[] = []
  const x = raw.values
  const push = (field: string, message: string) =>
    errors.push({ row: raw.row, sheet: raw.sheet, field, message, raw: x })

  for (const [k, val] of Object.entries(x)) {
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(val)) {
      push(k, '包含非法控制字符')
    }
    if (val.length > MAX_LEN) push(k, `内容超长（>${MAX_LEN}）`)
  }

  if (raw.kind === 'person') {
    const emp = v(x, ['工号', '人员工号', 'employeeNo'])
    const name = v(x, ['姓名', 'name'])
    const job = v(x, ['岗位名称', '原始岗位', 'job'])
    const start = v(x, ['任职开始', '任职开始日期', 'startDate'])
    const end = v(x, ['任职结束', '任职结束日期', 'endDate'])
    if (!emp) push('工号', '必填人员标识为空')
    if (!name) push('姓名', '姓名为空')
    if (!job) push('岗位名称', '岗位名称为空')
    if (job && /^\d+$/.test(job)) push('岗位名称', '岗位名称为无意义纯数字')
    const sd = start ? parseDate(start) : '2000-01-01'
    const ed = end ? parseDate(end) : null
    if (start && !parseDate(start)) push('任职开始', '日期无法解析')
    if (end && !parseDate(end)) push('任职结束', '日期无法解析')
    if (sd && ed && ed < sd) push('任职结束', '有效结束日期早于开始日期')
  }

  if (raw.kind === 'certificate') {
    const emp = v(x, ['工号', '人员工号', 'employeeNo'])
    const cert = v(x, ['证书名称', '原始证书名称', 'certName'])
    const vf = v(x, ['有效开始', '有效开始日期', 'validFrom'])
    const vt = v(x, ['有效截止', '有效截止日期', 'validTo'])
    if (!emp) push('工号', '必填人员标识为空')
    if (!cert) push('证书名称', '证书名称为空')
    if (vf && !parseDate(vf)) push('有效开始', '日期无法解析')
    if (vt && !parseDate(vt)) push('有效截止', '日期无法解析')
    const a = parseDate(vf)
    const b = parseDate(vt)
    if (a && b && b < a) push('有效截止', '有效结束日期早于开始日期')
  }

  if (raw.kind === 'work_scope') {
    const emp = v(x, ['工号', '人员工号', 'employeeNo'])
    const scope = v(x, ['作业范围', '职责标签', 'workScope'])
    if (!emp) push('工号', '必填人员标识为空')
    if (!scope) push('作业范围', '作业范围为空')
  }

  return errors
}

export function cell(row: Record<string, string>, keys: string[]): string {
  return v(row, keys)
}

export function detectKind(sheet: string, headers: string[]): RawRow['kind'] | null {
  const h = headers.join(' ')
  const s = sheet
  if (/作业|职责/.test(s) || /作业范围/.test(h)) return 'work_scope'
  if (/证书|持证/.test(s) || /证书名称/.test(h)) return 'certificate'
  if (/人员|岗位|任职/.test(s) || /工号/.test(h)) return 'person'
  return null
}
