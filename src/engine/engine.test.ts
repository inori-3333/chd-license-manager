import { describe, expect, it } from 'vitest'
import { buildSeed, DEMO } from '../data/seed'
import { calculateAll, mergeIssues } from './calculate'
import { detectConflicts } from './conflict'
import { evalPersonApplicability } from './eval'
import { resolveStandardId } from './standardize'
import { applyImport } from './importApply'
import type { Issue } from '../types'
import type { RawRow } from './validate'

describe('规则引擎与口径', () => {
  const db = buildSeed()
  const calc = calculateAll(db, db.asOfDate)

  it('种子人员全部来自岗位示例表', () => {
    expect(db.people.length).toBe(1315)
    expect(db.people.every((p) => p.source === '岗位示例表.xlsx')).toBe(true)
  })

  it('高压适用岗位 + 缺失高压作业属性 → 无法判定，不产生正式合规结论', () => {
    const r = calc.personResults.find((x) => x.personId === DEMO.missingScope)
    expect(r?.judgement).toBe('undecidable')
    expect(calc.issues.some((i) => i.personId === DEMO.missingScope && i.class === 'data_quality')).toBe(true)
    expect(calc.issues.some((i) => i.personId === DEMO.missingScope && i.class === 'compliance' && i.ruleId === 'rule_hv_v2')).toBe(false)
  })

  it('财务岗位即使作业范围缺失，高压规则也不适用', () => {
    const r = calc.personResults.find((x) => x.personId === DEMO.finance)
    expect(r?.explanation.some((e) => e.includes('不适用'))).toBe(true)
    expect(r?.requiredItems.filter((i) => i.ruleId === 'rule_hv_v2')).toHaveLength(0)
  })

  it('应持未持生成合规问题', () => {
    expect(calc.issues.some((i) => i.personId === DEMO.missingCert && i.class === 'compliance' && i.title.includes('应持未持'))).toBe(true)
  })

  it('180/90/30/7 天临期分别生成风险预警而非合规问题', () => {
    const levels = [
      [DEMO.exp180, '180'],
      [DEMO.exp90, '90'],
      [DEMO.exp30, '30'],
      [DEMO.exp7, '7'],
    ]
    for (const [pid, label] of levels) {
      const hit = calc.issues.find((i) => i.personId === pid && i.class === 'risk')
      expect(hit, `${pid} ${label}`).toBeTruthy()
    }
  })

  it('过期证书生成合规问题', () => {
    expect(calc.issues.some((i) => i.personId === DEMO.expired && i.class === 'compliance' && i.title.includes('过期'))).toBe(true)
  })

  it('复审逾期生成合规问题', () => {
    expect(calc.issues.some((i) => i.personId === DEMO.review && i.title.includes('复审'))).toBe(true)
  })

  it('新上岗过渡期内未持证记预警而非不合规', () => {
    const r = calc.personResults.find((x) => x.personId === DEMO.transition)
    expect(r?.requiredItems.some((i) => i.certificateId === 'cert_hv' && i.status === 'in_transition')).toBe(true)
    expect(calc.issues.some((i) => i.personId === DEMO.transition && i.class === 'risk' && i.title.includes('过渡期'))).toBe(true)
    expect(calc.issues.some((i) => i.personId === DEMO.transition && i.class === 'compliance' && i.title.includes('应持未持'))).toBe(false)
  })

  it('人员合规率分母仅为可判定人员', () => {
    expect(calc.stats.decidable).toBeLessThan(calc.stats.managed)
    expect(calc.stats.coverage).toBeLessThan(1)
    if (calc.stats.personRate != null) {
      expect(calc.stats.compliant / calc.stats.decidable).toBeCloseTo(calc.stats.personRate)
    }
  })

  it('未标准化证书不得算作已持', () => {
    const r = calc.personResults.find((x) => x.personId === DEMO.unmappedCert)
    expect(r?.judgement === 'undecidable' || calc.issues.some((i) => i.personId === DEMO.unmappedCert && i.class === 'data_quality')).toBe(true)
  })

  it('激励提升类不生成无证上岗违规', () => {
    expect(calc.issues.filter((i) => i.ruleId === 'rule_inc' && i.class === 'compliance')).toHaveLength(0)
  })

  it('群体比例不达标不等于个人全部违规', () => {
    const groupA = calc.groupResults.find((g) => g.ruleId === 'rule_cse' && g.orgName === 'A公司')
    expect(groupA).toBeTruthy()
  })

  it('兼岗人员并集适用规则', () => {
    const r = calc.personResults.find((x) => x.personId === DEMO.concurrent)
    expect(r?.requiredItems.some((i) => i.certificateId === 'cert_hv')).toBe(true)
    expect(r?.requiredItems.some((i) => i.certificateId === 'cert_crane_c')).toBe(true)
  })

  it('历史规则版本可按统计时点还原', () => {
    const old = calculateAll(db, '2024-06-01')
    const ruleIds = new Set(
      old.personResults.flatMap((p) => p.requiredItems.map((i) => i.ruleId)),
    )
    expect(ruleIds.has('rule_hv_v2')).toBe(false)
  })

  it('复审临期按证书 reviewNodes 生成风险预警，逾期仍为合规问题', () => {
    expect(calc.issues.some((i) => i.personId === DEMO.exp90 && i.class === 'risk' && i.title.includes('复审'))).toBe(true)
    expect(calc.issues.some((i) => i.personId === DEMO.review && i.class === 'compliance' && i.title.includes('复审逾期'))).toBe(true)
    expect(calc.issues.some((i) => i.personId === DEMO.review && i.class === 'risk' && i.title.includes('复审'))).toBe(false)
  })

  it('过渡期只用适用任职/作业开始日，不取无关兼岗更晚日期', () => {
    const local = buildSeed()
    const pid = DEMO.missingCert
    const primary = local.assignments.find((a) => a.personId === pid)!
    local.assignments.push({
      ...primary,
      id: 'asg_late_unrelated',
      originalJobName: '会计',
      standardJobId: local.jobs.find((j) => j.category === '财务管理')?.id ?? primary.standardJobId,
      jobStdStatus: 'mapped',
      kind: 'concurrent',
      startDate: '2026-08-01',
      source: 'test',
    })
    const next = calculateAll(local, local.asOfDate)
    const r = next.personResults.find((x) => x.personId === pid)
    expect(r?.requiredItems.some((i) => i.certificateId === 'cert_hv' && i.status === 'in_transition')).toBe(false)
    expect(next.issues.some((i) => i.personId === pid && i.class === 'compliance' && i.title.includes('应持未持'))).toBe(true)
  })

  it('种子待治理名称覆盖演示用的电修技术员、注安师、生技部', () => {
    expect(db.jobs.some((j) => j.name === '电气检修技术员')).toBe(true)
    expect(db.orgs.some((o) => o.standardName === '生产技术部')).toBe(true)
    const names = db.mappings.filter((m) => m.status === 'pending').map((m) => m.originalName)
    expect(names).toContain('电修技术员')
    expect(names).toContain('注安师')
    expect(names).toContain('生技部')
    expect(db.mappings.find((m) => m.originalName === '电修技术员')?.candidates.some((c) => c.standardName === '电气检修技术员')).toBe(true)
    expect(db.mappings.find((m) => m.originalName === '生技部')?.candidates.some((c) => c.standardName === '生产技术部')).toBe(true)
  })
})

describe('标准化漏斗', () => {
  const db = buildSeed()
  it('完全一致自动通过', () => {
    const r = resolveStandardId('job', '安全专工', db, null)
    expect(r.auto).toBe(true)
    expect(r.id).toBeTruthy()
  })
  it('AI/算法推荐不得自动通过', () => {
    const r = resolveStandardId('job', '电修技术员', db, 'org_co_A公司')
    expect(r.auto).toBe(false)
    expect(r.id).toBeNull()
  })
  it('已确认历史映射自动通过', () => {
    const r = resolveStandardId('certificate', '高压电工证', db, null)
    expect(r.auto).toBe(true)
    expect(r.id).toBe('cert_hv')
  })
})

describe('规则冲突', () => {
  it('阻止发布互相矛盾的群体目标', () => {
    const db = buildSeed()
    const draft = db.rules.find((r) => r.id === 'rule_cse_conflict')!
    const c = detectConflicts(db, draft)
    expect(c.conflicting).toBe(true)
  })
})

describe('部分成功导入', () => {
  it('合法行进入、非法行进入错误清单', () => {
    const db = buildSeed()
    const rows: RawRow[] = [
      {
        sheet: '人员',
        row: 2,
        kind: 'person',
        values: { 工号: 'Z001', 姓名: '合法', 组织名称: 'A公司', 岗位名称: '安全专工', 任职开始: '2024-01-01' },
      },
      {
        sheet: '人员',
        row: 3,
        kind: 'person',
        values: { 工号: '', 姓名: '无工号', 岗位名称: '安全专工' },
      },
      {
        sheet: '人员',
        row: 4,
        kind: 'person',
        values: { 工号: 'Z002', 姓名: '数字岗', 岗位名称: '999' },
      },
    ]
    const { batch } = applyImport(db, rows, 't.xlsx', 'u_admin', '测')
    expect(batch.accepted).toBe(1)
    expect(batch.rejected).toBeGreaterThanOrEqual(2)
  })

  it('组织无法标准化时不得挂到根组织', () => {
    const db = buildSeed()
    const rows: RawRow[] = [
      {
        sheet: '人员',
        row: 2,
        kind: 'person',
        values: { 工号: 'Z009', 姓名: '未知组织', 组织名称: '生技部某某', 岗位名称: '安全专工', 任职开始: '2024-01-01' },
      },
    ]
    const { db: next, batch } = applyImport(db, rows, 't.xlsx', 'u_admin', '测')
    expect(batch.accepted).toBe(1)
    const person = next.people.find((p) => p.employeeNo === 'Z009')!
    const asg = next.assignments.find((a) => a.personId === person.id)!
    expect(asg.orgId).toBe('')
    expect(asg.orgId).not.toBe(db.orgs[0].id)
    expect(next.mappings.some((m) => m.kind === 'org' && m.originalName === '生技部某某' && m.status === 'pending')).toBe(true)
    const calc = calculateAll(next, next.asOfDate)
    expect(calc.issues.some((i) => i.personId === person.id && i.class === 'data_quality' && i.field === 'originalOrgName')).toBe(true)
  })
})

describe('作业范围 CONTAINS', () => {
  it('包含匹配不等于精确属于', () => {
    const db = buildSeed()
    const person = db.people.find((p) => p.id === DEMO.missingCert)!
    const asg = db.assignments.filter((a) => a.personId === person.id)
    const scopes = db.personWorkScopes.filter((s) => s.personId === person.id)
    const contains = evalPersonApplicability(
      { logic: 'AND', conditions: [{ field: 'work_scope', operator: 'CONTAINS', value: '高压' }] },
      db,
      person,
      asg,
      scopes,
      db.asOfDate,
    )
    const inn = evalPersonApplicability(
      { logic: 'AND', conditions: [{ field: 'work_scope', operator: 'IN', value: ['高压'] }] },
      db,
      person,
      asg,
      scopes,
      db.asOfDate,
    )
    expect(contains.result).toBe('true')
    expect(inn.result).toBe('false')
    const empty = evalPersonApplicability(
      { logic: 'AND', conditions: [{ field: 'work_scope', operator: 'CONTAINS', value: '' }] },
      db,
      person,
      asg,
      scopes,
      db.asOfDate,
    )
    expect(empty.result).toBe('false')
  })
})

describe('问题合并', () => {
  const sample = (fp: string, status: Issue['status']): Issue => ({
    id: fp,
    code: fp,
    class: 'compliance',
    severity: 'high',
    status,
    title: '应持未持',
    rationale: '原依据',
    foundAt: '2026-01-01',
    fingerprint: fp,
  })

  it('销项后问题仍存在则重新打开', () => {
    const closed = sample('fp1', 'closed')
    closed.closedAt = '2026-09-01T00:00:00.000Z'
    const next = [{ ...sample('fp1', 'open'), rationale: '仍应持未持' }]
    const out = mergeIssues([closed], next)
    expect(out).toHaveLength(1)
    expect(out[0].status).toBe('open')
    expect(out[0].closedAt).toBeUndefined()
    expect(out[0].id).toBe('fp1')
    expect(out[0].rationale).toContain('销项后重算仍存在')
  })

  it('整改中的问题消失后进入已消除待销项', () => {
    const doing = sample('fp2', 'remediating')
    const out = mergeIssues([doing], [])
    expect(out[0].status).toBe('resolved_pending_close')
    expect(out[0].rationale).toContain('重算后问题已不存在')
  })

  it('已消除待销项若问题再次出现则重新打开', () => {
    const pending = sample('fp3', 'resolved_pending_close')
    const out = mergeIssues([pending], [sample('fp3', 'open')])
    expect(out[0].status).toBe('open')
    expect(out[0].rationale).toContain('问题再次出现')
  })
})
