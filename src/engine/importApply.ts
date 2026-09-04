import type { Assignment, CertHolding, DB, ImportBatch, ImportError, PersonWorkScope } from '../types'
import type { RawRow } from './validate'
import { cell, hardValidate } from './validate'
import { parseDate } from './dates'
import { resolveStandardId, suggest } from './standardize'
import { nid } from './ids'

export interface ImportResult {
  batch: ImportBatch
  db: DB
}

function suspectedAnomaly(orgName: string, jobName: string): string | undefined {
  if (/锅炉|检修车间/.test(orgName) && /财务|会计|出纳/.test(jobName)) {
    return `组织「${orgName}」与岗位「${jobName}」组合看起来异常，但不能确定错误，标记为疑似异常待核查。`
  }
  return undefined
}

export function applyImport(db: DB, rows: RawRow[], filename: string, actorId: string, actorName: string): ImportResult {
  const errors: ImportError[] = []
  let accepted = 0
  let standardized = 0
  let pending = 0
  const next: DB = structuredClone(db)

  const byEmp = new Map(next.people.map((p) => [p.employeeNo, p]))

  for (const row of rows) {
    const hard = hardValidate(row)
    if (hard.length) {
      errors.push(...hard)
      continue
    }
    if (row.kind === 'person') {
      const emp = cell(row.values, ['工号', '人员工号', 'employeeNo'])
      const name = cell(row.values, ['姓名', 'name'])
      const orgCode = cell(row.values, ['组织编码', 'orgCode'])
      const orgName = cell(row.values, ['组织名称', '部门', 'orgName'])
      const job = cell(row.values, ['岗位名称', '原始岗位', 'job'])
      const kindRaw = cell(row.values, ['主岗/兼岗', '任职类型', 'kind'])
      const start = parseDate(cell(row.values, ['任职开始', '任职开始日期', 'startDate'])) ?? '2020-01-01'
      const endRaw = cell(row.values, ['任职结束', '任职结束日期', 'endDate'])
      const end = endRaw ? parseDate(endRaw) : null
      const status = cell(row.values, ['在职状态', 'status']) === '离职' ? 'inactive' : 'active'

      const existing = byEmp.get(emp)
      if (existing && existing.name !== name) {
        errors.push({
          row: row.row,
          sheet: row.sheet,
          field: '工号',
          message: `工号 ${emp} 已存在且姓名不一致（${existing.name} vs ${name}），无法解释的唯一标识冲突`,
          raw: row.values,
        })
        continue
      }

      let person = existing
      if (!person) {
        person = {
          id: nid('p'),
          employeeNo: emp,
          name,
          idMasked: '**************',
          status,
          source: `import:${filename}`,
        }
        next.people.push(person)
        byEmp.set(emp, person)
      }

      const orgResolved = orgCode
        ? next.orgs.find((o) => o.code === orgCode)
        : undefined
      const orgStd = orgResolved
        ? { id: orgResolved.id, auto: true, reason: '权威组织编码一致' }
        : orgName
          ? resolveStandardId('org', orgName, next, null)
          : { id: null as string | null, auto: false, reason: '组织为空' }

      if (!orgStd.id && !orgName && !orgCode) {
        errors.push({
          row: row.row,
          sheet: row.sheet,
          field: '组织名称',
          message: '组织名称或编码为空，无法确定归属，不得猜测',
          raw: row.values,
        })
        continue
      }

      const jobStd = resolveStandardId('job', job, next, orgStd.id)

      if (!orgStd.id && orgName) ensurePendingMapping(next, 'org', orgName, null)
      if (!jobStd.id) ensurePendingMapping(next, 'job', job, orgStd.id)

      const orgId = orgStd.id ?? ''
      const assignment: Assignment = {
        id: nid('asg'),
        personId: person.id,
        orgId,
        originalOrgName: orgName || orgResolved?.originalName || '',
        originalJobName: job,
        standardJobId: jobStd.id,
        jobStdStatus: jobStd.id ? 'mapped' : 'unmapped',
        kind: /兼/.test(kindRaw) ? 'concurrent' : 'primary',
        startDate: start,
        endDate: end,
        source: `import:${filename}`,
        suspectedAnomaly: suspectedAnomaly(orgName, job),
      }
      next.assignments.push(assignment)
      accepted += 1
      if (jobStd.id && orgStd.id) standardized += 1
      else pending += 1
    } else if (row.kind === 'certificate') {
      const emp = cell(row.values, ['工号', '人员工号', 'employeeNo'])
      const person = byEmp.get(emp)
      if (!person) {
        errors.push({
          row: row.row,
          sheet: row.sheet,
          field: '工号',
          message: `找不到工号 ${emp} 对应人员`,
          raw: row.values,
        })
        continue
      }
      const certName = cell(row.values, ['证书名称', '原始证书名称', 'certName'])
      const std = resolveStandardId('certificate', certName, next, null)
      if (!std.id) ensurePendingMapping(next, 'certificate', certName, null)
      const vf = parseDate(cell(row.values, ['有效开始', '有效开始日期', 'validFrom'])) ?? parseDate(cell(row.values, ['取得日期', 'obtainedAt'])) ?? '2020-01-01'
      const holding: CertHolding = {
        id: nid('h'),
        personId: person.id,
        standardCertId: std.id,
        originalName: certName,
        certStdStatus: std.id ? 'mapped' : 'unmapped',
        certNo: cell(row.values, ['证书编号', 'certNo']) || '—',
        issuer: cell(row.values, ['发证机构', 'issuer']) || '—',
        obtainedAt: parseDate(cell(row.values, ['取得日期', 'obtainedAt'])) ?? vf,
        validFrom: vf,
        validTo: parseDate(cell(row.values, ['有效截止', '有效截止日期', 'validTo'])),
        reviewDate: parseDate(cell(row.values, ['复审日期', 'reviewDate'])),
        registerStatus: cell(row.values, ['注册状态', 'registerStatus']) || '有效',
        source: `import:${filename}`,
      }
      next.holdings.push(holding)
      accepted += 1
      if (std.id) standardized += 1
      else pending += 1
    } else {
      const emp = cell(row.values, ['工号', '人员工号', 'employeeNo'])
      const person = byEmp.get(emp)
      if (!person) {
        errors.push({
          row: row.row,
          sheet: row.sheet,
          field: '工号',
          message: `找不到工号 ${emp} 对应人员`,
          raw: row.values,
        })
        continue
      }
      const scopeName = cell(row.values, ['作业范围', '职责标签', 'workScope'])
      const tag = next.workScopeTags.find((t) => t.name === scopeName)
      if (!tag) {
        errors.push({
          row: row.row,
          sheet: row.sheet,
          field: '作业范围',
          message: `作业范围「${scopeName}」不在受控标签库中，系统不得自动创建正式作业范围`,
          raw: row.values,
        })
        continue
      }
      const rec: PersonWorkScope = {
        id: nid('ws'),
        personId: person.id,
        tagId: tag.id,
        source: `import:${filename}`,
        confirmed: false,
        startDate: parseDate(cell(row.values, ['开始日期', 'startDate'])) ?? '2020-01-01',
        endDate: parseDate(cell(row.values, ['结束日期', 'endDate'])),
      }
      next.personWorkScopes.push(rec)
      accepted += 1
      pending += 1
    }
  }

  const batch: ImportBatch = {
    id: nid('bat'),
    at: new Date().toISOString(),
    by: actorName,
    filename,
    total: rows.length,
    accepted,
    standardized,
    pending,
    rejected: errors.length,
    errors,
    notes: `导入记录 ${rows.length}，成功接收 ${accepted}（已标准化 ${standardized} / 待治理 ${pending}），导入失败 ${errors.length}`,
  }
  next.batches = [batch, ...next.batches]
  next.audit = [
    {
      id: nid('aud'),
      at: batch.at,
      actorId,
      actorName,
      action: '导入',
      target: filename,
      detail: batch.notes,
    },
    ...next.audit,
  ]
  return { batch, db: next }
}

function ensurePendingMapping(db: DB, kind: 'org' | 'job' | 'certificate', originalName: string, scopeOrgId: string | null) {
  const exists = db.mappings.find(
    (m) => m.kind === kind && m.originalName === originalName && m.status !== 'disabled',
  )
  if (exists) {
    exists.usageCount += 1
    return
  }
  db.mappings.push({
    id: nid('map'),
    kind,
    originalName,
    standardId: null,
    standardName: null,
    scopeKind: scopeOrgId ? 'local' : 'global',
    scopeOrgId,
    source: 'manual',
    status: 'pending',
    usageCount: 1,
    candidates: suggest(kind, originalName, db, scopeOrgId),
    history: [{ at: new Date().toISOString(), by: 'system', action: 'create_pending' }],
  })
}

export function parseSheetKind(name: string, headers: string[]): RawRow['kind'] | null {
  const h = headers.join(' ')
  if (/作业范围|职责/.test(name + h)) return 'work_scope'
  if (/证书/.test(name + h)) return 'certificate'
  if (/工号/.test(h) || /人员|岗位/.test(name)) return 'person'
  return null
}
