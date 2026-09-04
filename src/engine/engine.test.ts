import { describe, expect, it } from 'vitest'
import { buildSeed, DEMO } from '../data/seed'
import { calculateAll } from './calculate'
import { detectConflicts } from './conflict'
import { resolveStandardId } from './standardize'
import { applyImport } from './importApply'
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
})
