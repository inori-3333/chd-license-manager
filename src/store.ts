import { useSyncExternalStore } from 'react'
import type {
  ConditionGroup,
  DB,
  Issue,
  PersonWorkScope,
  RemediationRecord,
  Rule,
  User,
} from './types'
import { buildSeed } from './data/seed'
import { calculateAll, mergeIssues } from './engine/calculate'
import { nid } from './engine/ids'
import { applyImport } from './engine/importApply'
import type { RawRow } from './engine/validate'
import { suggest } from './engine/standardize'
import { detectConflicts, simulateRule } from './engine/conflict'
import { descendantIds } from './engine/org'

const KEY = 'chd-license-manager.db.v1'

let db: DB = load()
const listeners = new Set<() => void>()

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed?.version === 1 && parsed.people?.length) return parsed
    }
  } catch {
    /* ignore */
  }
  return buildSeed()
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* quota */
  }
}

function emit() {
  persist()
  listeners.forEach((l) => l())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getDb(): DB {
  return db
}

export function useDb(): DB {
  return useSyncExternalStore(subscribe, getDb, getDb)
}

export function currentUser(d = db): User {
  return d.users.find((u) => u.id === d.currentUserId) ?? d.users[0]
}

export function setUser(id: string) {
  db = { ...db, currentUserId: id }
  emit()
}

export function setAsOf(date: string) {
  db = { ...db, asOfDate: date }
  recalc('切换统计时点')
}

function audit(action: string, target: string, detail: string) {
  const u = currentUser()
  db = {
    ...db,
    audit: [
      {
        id: nid('aud'),
        at: new Date().toISOString(),
        actorId: u.id,
        actorName: u.name,
        action,
        target,
        detail,
      },
      ...db.audit,
    ],
  }
}

export function recalc(reason = '手动重算') {
  const calc = calculateAll(db, db.asOfDate)
  const issues = mergeIssues(db.issues, calc.issues)
  const snap = {
    id: nid('snap'),
    asOf: db.asOfDate,
    capturedAt: new Date().toISOString(),
    source: 'recalc' as const,
    managed: calc.stats.managed,
    decidable: calc.stats.decidable,
    compliant: calc.stats.compliant,
    personRate: calc.stats.personRate,
    itemRate: calc.stats.itemRate,
    coverage: calc.stats.coverage,
    complianceIssues: calc.stats.complianceIssues,
    riskIssues: calc.stats.riskIssues,
    qualityIssues: calc.stats.qualityIssues,
  }
  db = {
    ...db,
    issues,
    snapshots: [...db.snapshots.filter((s) => s.asOf !== db.asOfDate || s.source === 'scheduled'), snap],
    lastCalcAt: snap.capturedAt,
  }
  audit('规则重算', db.asOfDate, reason)
  emit()
  return calc
}

export function resetDemo() {
  db = buildSeed()
  persist()
  emit()
}

export function confirmMapping(mappingId: string, standardId: string, standardName: string) {
  const u = currentUser()
  db = {
    ...db,
    mappings: db.mappings.map((m) => {
      if (m.id !== mappingId) return m
      return {
        ...m,
        standardId,
        standardName,
        status: 'confirmed' as const,
        source: 'manual' as const,
        confirmedBy: u.name,
        confirmedAt: new Date().toISOString(),
        history: [...m.history, { at: new Date().toISOString(), by: u.name, action: 'confirm', note: standardName }],
      }
    }),
  }
  const m = db.mappings.find((x) => x.id === mappingId)!
  if (m.kind === 'job') {
    db = {
      ...db,
      assignments: db.assignments.map((a) =>
        a.originalJobName === m.originalName && !a.standardJobId
          ? { ...a, standardJobId: standardId, jobStdStatus: 'mapped' }
          : a,
      ),
    }
  }
  if (m.kind === 'certificate') {
    db = {
      ...db,
      holdings: db.holdings.map((h) =>
        h.originalName === m.originalName && !h.standardCertId
          ? { ...h, standardCertId: standardId, certStdStatus: 'mapped' }
          : h,
      ),
    }
  }
  if (m.kind === 'org') {
    db = {
      ...db,
      assignments: db.assignments.map((a) =>
        a.originalOrgName === m.originalName ? { ...a, orgId: standardId } : a,
      ),
    }
  }
  audit('名称映射确认', m.originalName, `→ ${standardName}`)
  recalc('名称映射确认后重算')
}

export function rejectMapping(mappingId: string, note: string) {
  const u = currentUser()
  db = {
    ...db,
    mappings: db.mappings.map((m) =>
      m.id === mappingId
        ? {
            ...m,
            status: 'pending' as const,
            candidates: [],
            history: [...m.history, { at: new Date().toISOString(), by: u.name, action: 'none_of_candidates', note }],
          }
        : m,
    ),
  }
  audit('名称映射驳回候选', mappingId, note || '都不正确')
  emit()
}

export function disableMapping(mappingId: string) {
  const u = currentUser()
  db = {
    ...db,
    mappings: db.mappings.map((m) =>
      m.id === mappingId
        ? {
            ...m,
            status: 'disabled' as const,
            history: [...m.history, { at: new Date().toISOString(), by: u.name, action: 'disable' }],
          }
        : m,
    ),
  }
  audit('停用映射', mappingId, '错误映射停用，历史保留')
  emit()
}

export function confirmWorkScope(personId: string, tagId: string) {
  const u = currentUser()
  const exists = db.personWorkScopes.find((s) => s.personId === personId && s.tagId === tagId && !s.endDate)
  if (exists) {
    db = {
      ...db,
      personWorkScopes: db.personWorkScopes.map((s) =>
        s.id === exists.id
          ? { ...s, confirmed: true, confirmedBy: u.name, confirmedAt: new Date().toISOString() }
          : s,
      ),
    }
  } else {
    const rec: PersonWorkScope = {
      id: nid('ws'),
      personId,
      tagId,
      source: 'unit-fill',
      confirmed: true,
      confirmedBy: u.name,
      confirmedAt: new Date().toISOString(),
      startDate: db.asOfDate,
      endDate: null,
    }
    db = { ...db, personWorkScopes: [...db.personWorkScopes, rec] }
  }
  audit('作业范围补充', personId, tagId)
  recalc('作业范围确认后重算')
}

export function saveRule(rule: Rule, asNewVersion = false) {
  const u = currentUser()
  if (asNewVersion) {
    const next: Rule = {
      ...rule,
      id: nid('rule'),
      version: rule.version + 1,
      status: 'draft',
      supersedesId: rule.id,
      createdBy: u.id,
      reviewedBy: undefined,
      reviewedAt: undefined,
    }
    db = { ...db, rules: [...db.rules, next] }
    audit('规则新版本', next.name, `v${next.version}`)
    emit()
    return next
  }
  const exists = db.rules.some((r) => r.id === rule.id)
  db = {
    ...db,
    rules: exists ? db.rules.map((r) => (r.id === rule.id ? rule : r)) : [...db.rules, rule],
  }
  audit(exists ? '规则修改' : '规则创建', rule.name, `status=${rule.status}`)
  emit()
  return rule
}

export function submitRule(ruleId: string) {
  const u = currentUser()
  db = {
    ...db,
    rules: db.rules.map((r) =>
      r.id === ruleId ? { ...r, status: 'pending_review' as const, submittedBy: u.id, submittedAt: new Date().toISOString() } : r,
    ),
  }
  audit('规则提交审核', ruleId, '')
  emit()
}

export function reviewRule(ruleId: string, pass: boolean, comment: string) {
  const u = currentUser()
  const rule = db.rules.find((r) => r.id === ruleId)
  if (!rule) return { ok: false, message: '规则不存在' }
  if (pass) {
    const c = detectConflicts(db, { ...rule, status: 'pending_effective' })
    if (c.conflicting && !rule.conflictAck) {
      return { ok: false, message: '发现规则冲突，必须人工确认后才能发布', conflicts: c }
    }
    db = {
      ...db,
      rules: db.rules.map((r) => {
        if (r.id === ruleId) {
          return {
            ...r,
            status: r.effectiveFrom > db.asOfDate ? ('pending_effective' as const) : ('active' as const),
            reviewedBy: u.id,
            reviewedAt: new Date().toISOString(),
            reviewComment: comment,
          }
        }
        if (r.familyId === rule.familyId && r.id !== ruleId && r.status === 'active') {
          return { ...r, status: 'expired' as const, effectiveTo: db.asOfDate }
        }
        return r
      }),
    }
    audit('规则发布', rule.name, comment)
    recalc('规则发布后重算')
    return { ok: true }
  }
  db = {
    ...db,
    rules: db.rules.map((r) =>
      r.id === ruleId
        ? { ...r, status: 'draft' as const, reviewedBy: u.id, reviewedAt: new Date().toISOString(), reviewComment: comment }
        : r,
    ),
  }
  audit('规则驳回', rule.name, comment)
  emit()
  return { ok: true }
}

export function ackConflict(ruleId: string) {
  db = { ...db, rules: db.rules.map((r) => (r.id === ruleId ? { ...r, conflictAck: true } : r)) }
  emit()
}

export function previewRule(rule: Rule) {
  return simulateRule(db, rule)
}

export function conflictsOf(rule: Rule) {
  return detectConflicts(db, rule)
}

export function importRows(rows: RawRow[], filename: string) {
  const u = currentUser()
  const result = applyImport(db, rows, filename, u.id, u.name)
  db = result.db
  recalc('导入后重算')
  return result.batch
}

export function addPersonManual(input: {
  employeeNo: string
  name: string
  orgId: string
  originalJobName: string
  startDate: string
}) {
  const person = {
    id: nid('p'),
    employeeNo: input.employeeNo,
    name: input.name,
    idMasked: '**************',
    status: 'active' as const,
    source: 'manual',
  }
  const job = db.jobs.find((j) => j.name === input.originalJobName)
  db = {
    ...db,
    people: [...db.people, person],
    assignments: [
      ...db.assignments,
      {
        id: nid('asg'),
        personId: person.id,
        orgId: input.orgId,
        originalOrgName: db.orgs.find((o) => o.id === input.orgId)?.standardName ?? '',
        originalJobName: input.originalJobName,
        standardJobId: job?.id ?? null,
        jobStdStatus: job ? 'mapped' : 'unmapped',
        kind: 'primary',
        startDate: input.startDate,
        endDate: null,
        source: 'manual',
      },
    ],
  }
  if (!job) {
    const exist = db.mappings.find((m) => m.kind === 'job' && m.originalName === input.originalJobName)
    if (!exist) {
      db = {
        ...db,
        mappings: [
          ...db.mappings,
          {
            id: nid('map'),
            kind: 'job',
            originalName: input.originalJobName,
            standardId: null,
            standardName: null,
            scopeKind: 'local',
            scopeOrgId: input.orgId,
            source: 'manual',
            status: 'pending',
            usageCount: 1,
            candidates: suggest('job', input.originalJobName, db, input.orgId),
            history: [{ at: new Date().toISOString(), by: currentUser().name, action: 'create_pending' }],
          },
        ],
      }
    }
  }
  audit('单条维护', person.name, '新增人员')
  recalc('单条维护后重算')
}

export function startRemediation(issueId: string, comment: string) {
  const u = currentUser()
  patchIssue(issueId, { status: 'remediating', assigneeId: u.id }, '开始整改', comment)
}

export function submitRemediation(issueId: string, comment: string) {
  patchIssue(issueId, { status: 'pending_review' }, '提交复核', comment)
}

export function assignReviewer(issueId: string, reviewerId: string, comment: string) {
  patchIssue(issueId, { reviewerId }, '指定复核人', comment)
}

export function reviewIssue(issueId: string, pass: boolean, comment: string) {
  if (pass) {
    patchIssue(issueId, { status: 'closed', closedAt: new Date().toISOString() }, '复核通过并销项', comment)
    recalc('销项后重新计算')
  } else {
    patchIssue(issueId, { status: 'remediating' }, '复核驳回', comment)
  }
}

function patchIssue(issueId: string, patch: Partial<Issue>, action: string, comment: string) {
  const u = currentUser()
  const rec: RemediationRecord = {
    id: nid('rem'),
    issueId,
    at: new Date().toISOString(),
    by: u.name,
    action,
    comment,
  }
  db = {
    ...db,
    issues: db.issues.map((i) => (i.id === issueId ? { ...i, ...patch } : i)),
    remediations: [...db.remediations, rec],
  }
  audit(action, issueId, comment)
  emit()
}

export function can(action: string, d = db): boolean {
  const role = currentUser(d).role
  const table: Record<string, Array<User['role']>> = {
    confirm_mapping: ['admin', 'hr'],
    edit_rule: ['admin', 'specialist'],
    submit_rule: ['admin', 'specialist'],
    approve_rule: ['admin', 'hr'],
    import: ['admin', 'hr'],
    fill_scope: ['admin', 'unit', 'hr'],
    remediate: ['admin', 'unit'],
    assign_reviewer: ['admin', 'hr'],
    review_issue: ['admin', 'reviewer'],
    close_issue: ['admin', 'reviewer'],
    view_all: ['admin', 'hr', 'specialist'],
  }
  return table[action]?.includes(role) ?? role === 'admin'
}

export function visibleOrgIds(d = db): Set<string> | null {
  const u = currentUser(d)
  if (!u.orgScopeId) return null
  return descendantIds(d, u.orgScopeId)
}

export function newDraftRule(): Rule {
  const u = currentUser()
  return {
    id: nid('rule'),
    code: 'R-NEW',
    name: '新规则草稿',
    type: 'personal_mandatory',
    certCategory: 'national',
    version: 1,
    familyId: nid('fam'),
    status: 'draft',
    condition: { logic: 'AND', conditions: [{ field: 'job_category', operator: 'IN', value: ['电气检修'] }] },
    requirement: { logic: 'AND', items: [{ certificateId: db.certificates[0]?.id }] },
    effectiveFrom: db.asOfDate,
    effectiveTo: null,
    createdBy: u.id,
    notes: '',
  }
}

export function emptyGroup(): ConditionGroup {
  return { logic: 'AND', conditions: [] }
}

export function liveCalc(d = db) {
  return calculateAll(d, d.asOfDate)
}
