import type {
  Assignment,
  Condition,
  ConditionGroup,
  DB,
  Person,
  PersonWorkScope,
  StandardJob,
  Tri,
} from '../types'
import { andAll, fromBool, orAll } from './trilean'
import { inRange } from './dates'
import { ancestors, orgById } from './org'

export function isGroup(x: Condition | ConditionGroup): x is ConditionGroup {
  return (x as ConditionGroup).logic != null && Array.isArray((x as ConditionGroup).conditions)
}

export interface EvalCtx {
  db: DB
  person: Person
  assignment: Assignment
  job: StandardJob | null
  scopes: PersonWorkScope[]
  asOf: string
}

function hasUnknownJob(ctx: EvalCtx): boolean {
  return !ctx.job || ctx.assignment.jobStdStatus === 'unmapped'
}

function confirmedScopes(ctx: EvalCtx): PersonWorkScope[] {
  return ctx.scopes.filter((s) => s.confirmed && inRange(ctx.asOf, s.startDate, s.endDate))
}

function evalCondition(c: Condition, ctx: EvalCtx): Tri {
  const job = ctx.job
  const org = orgById(ctx.db, ctx.assignment.orgId)
  const val = c.value
  const one = Array.isArray(val) ? val[0] : val
  const many = Array.isArray(val) ? val : [val]

  switch (c.field) {
    case 'person_status': {
      const hit = ctx.person.status === one
      return applyOp(fromBool(hit), c.operator, hit)
    }
    case 'org_id': {
      if (!org) return 'unknown'
      const ids = new Set([org.id, ...ancestors(ctx.db, org.id).map((o) => o.id)])
      const hit = many.some((id) => ids.has(id))
      return c.operator === 'NOT_IN' || c.operator === 'NE' ? fromBool(!hit) : fromBool(hit)
    }
    case 'org_type': {
      if (!org) return 'unknown'
      const hit = many.includes(org.type)
      return c.operator === 'NOT_IN' || c.operator === 'NE' ? fromBool(!hit) : fromBool(hit)
    }
    case 'major': {
      if (hasUnknownJob(ctx)) return 'unknown'
      const hit = many.includes(job!.major)
      return c.operator === 'NOT_IN' || c.operator === 'NE' ? fromBool(!hit) : fromBool(hit)
    }
    case 'standard_job_id': {
      if (hasUnknownJob(ctx)) return 'unknown'
      const hit = many.includes(job!.id)
      return c.operator === 'NOT_IN' || c.operator === 'NE' ? fromBool(!hit) : fromBool(hit)
    }
    case 'job_category': {
      if (hasUnknownJob(ctx)) return 'unknown'
      const hit = many.includes(job!.category)
      return c.operator === 'NOT_IN' || c.operator === 'NE' ? fromBool(!hit) : fromBool(hit)
    }
    case 'job_tag': {
      if (hasUnknownJob(ctx)) return 'unknown'
      const hit = many.some((t) => job!.tags.includes(t))
      return c.operator === 'NOT_IN' || c.operator === 'NE' ? fromBool(!hit) : fromBool(hit)
    }
    case 'is_production': {
      if (hasUnknownJob(ctx)) return 'unknown'
      const want = one === 'true' || one === '1' || one === '是'
      const hit = job!.isProduction === want
      return fromBool(c.operator === 'NE' ? !hit : hit)
    }
    case 'work_scope':
    case 'duty_tag': {
      const conf = confirmedScopes(ctx)
      if (conf.length === 0) return 'unknown'
      const names = conf.map((s) => ctx.db.workScopeTags.find((t) => t.id === s.tagId)?.name).filter(Boolean) as string[]
      const ids = conf.map((s) => s.tagId)
      const hit = many.some((v) => names.includes(v) || ids.includes(v))
      if (c.operator === 'NOT_IN' || c.operator === 'NE') return fromBool(!hit)
      return fromBool(hit)
    }
    case 'assignment_start': {
      if (!ctx.assignment.startDate) return 'unknown'
      if (c.operator === 'BEFORE') return fromBool(ctx.assignment.startDate < one)
      if (c.operator === 'AFTER') return fromBool(ctx.assignment.startDate > one)
      return fromBool(ctx.assignment.startDate === one)
    }
    case 'work_scope_start': {
      const conf = confirmedScopes(ctx)
      if (conf.length === 0) return 'unknown'
      const starts = conf.map((s) => s.startDate)
      if (c.operator === 'BEFORE') return fromBool(starts.some((d) => d < one))
      if (c.operator === 'AFTER') return fromBool(starts.some((d) => d > one))
      return fromBool(starts.includes(one))
    }
    default:
      return 'unknown'
  }
}

function applyOp(base: Tri, op: Condition['operator'], hit: boolean): Tri {
  if (op === 'NE' || op === 'NOT_IN') return fromBool(!hit)
  return base
}

export function evalGroup(group: ConditionGroup, ctx: EvalCtx): Tri {
  const parts = group.conditions.map((c) => (isGroup(c) ? evalGroup(c, ctx) : evalCondition(c, ctx)))
  return group.logic === 'AND' ? andAll(parts) : orAll(parts)
}

export function evalPersonApplicability(
  group: ConditionGroup,
  db: DB,
  person: Person,
  assignments: Assignment[],
  scopes: PersonWorkScope[],
  asOf: string,
): { result: Tri; perAssignment: Array<{ assignmentId: string; result: Tri }> } {
  if (assignments.length === 0) {
    return { result: 'unknown', perAssignment: [] }
  }
  const per = assignments.map((assignment) => {
    const job = assignment.standardJobId
      ? db.jobs.find((j) => j.id === assignment.standardJobId) ?? null
      : null
    const ctx: EvalCtx = { db, person, assignment, job, scopes, asOf }
    return { assignmentId: assignment.id, result: evalGroup(group, ctx) }
  })
  const result = orAll(per.map((p) => p.result))
  return { result, perAssignment: per }
}

export function explainCondition(group: ConditionGroup): string {
  const parts = group.conditions.map((c) => {
    if (isGroup(c)) return `(${explainCondition(c)})`
    const val = Array.isArray(c.value) ? c.value.join('、') : c.value
    const op: Record<string, string> = {
      EQ: '=',
      NE: '≠',
      IN: '∈',
      NOT_IN: '∉',
      CONTAINS: '包含',
      BEFORE: '早于',
      AFTER: '晚于',
    }
    const field: Record<string, string> = {
      org_id: '组织',
      org_type: '组织类型',
      major: '专业',
      standard_job_id: '标准岗位',
      job_category: '岗位类别',
      job_tag: '岗位标签',
      work_scope: '作业范围',
      duty_tag: '职责标签',
      assignment_start: '任职开始',
      work_scope_start: '作业开始',
      person_status: '人员状态',
      is_production: '生产岗位',
    }
    return `${field[c.field] ?? c.field} ${op[c.operator] ?? c.operator} ${val}`
  })
  return parts.join(group.logic === 'AND' ? ' 且 ' : ' 或 ')
}
