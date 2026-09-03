import type { ConflictReport, DB, Rule, SimulationReport } from '../types'
import { calculateAll } from './calculate'

function certSet(rule: Rule): Set<string> {
  return new Set(rule.requirement.items.map((i) => i.certificateId))
}

function overlapTime(a: Rule, b: Rule): boolean {
  const a1 = a.effectiveFrom
  const a2 = a.effectiveTo ?? '9999-12-31'
  const b1 = b.effectiveFrom
  const b2 = b.effectiveTo ?? '9999-12-31'
  return a1 <= b2 && b1 <= a2
}

function samePopulation(a: Rule, b: Rule): boolean {
  return JSON.stringify(a.condition) === JSON.stringify(b.condition)
}

export function detectConflicts(db: DB, candidate: Rule): ConflictReport {
  const peers = db.rules.filter(
    (r) =>
      r.id !== candidate.id &&
      r.familyId !== candidate.familyId &&
      (r.status === 'active' || r.status === 'pending_effective' || r.status === 'pending_review'),
  )
  const items: ConflictReport['items'] = []
  for (const p of peers) {
    if (!overlapTime(candidate, p)) continue
    const ca = certSet(candidate)
    const cb = certSet(p)
    const sameCert = [...ca].some((id) => cb.has(id))
    if (!sameCert && candidate.type !== p.type) continue
    if (candidate.type === 'group_ratio' && p.type === 'group_ratio' && samePopulation(candidate, p) && sameCert) {
      const sa = JSON.stringify(candidate.stages)
      const sb = JSON.stringify(p.stages)
      if (sa !== sb) {
        items.push({
          ruleId: p.id,
          ruleName: `${p.name} v${p.version}`,
          reason: '同一适用群体、同一证书、同一时间范围内存在不同阶段目标，构成互相矛盾的群体要求。系统不自动选择口径。',
        })
      }
    }
    if (
      candidate.type === 'personal_mandatory' &&
      p.type === 'personal_mandatory' &&
      samePopulation(candidate, p) &&
      sameCert
    ) {
      const ga = candidate.requirement.items.map((i) => i.minGradeOrder ?? 0).join(',')
      const gb = p.requirement.items.map((i) => i.minGradeOrder ?? 0).join(',')
      if (ga !== gb && candidate.requirement.logic !== p.requirement.logic) {
        items.push({
          ruleId: p.id,
          ruleName: `${p.name} v${p.version}`,
          reason: '同一群体对同一证书的组合逻辑或最低等级要求不一致。',
        })
      }
    }
  }
  return { conflicting: items.length > 0, items }
}

export function simulateRule(db: DB, rule: Rule): SimulationReport {
  const before = calculateAll(db, db.asOfDate)
  const clone: DB = {
    ...db,
    rules: [
      ...db.rules.filter((r) => r.id !== rule.id),
      { ...rule, status: 'active' },
    ],
  }
  const after = calculateAll(clone, db.asOfDate)
  const beforeReq = new Set(
    before.personResults.filter((p) => p.requiredItems.some((i) => i.ruleId === rule.id || i.status !== 'satisfied')).map((p) => p.personId),
  )
  const afterPeople = after.personResults.filter((p) => p.requiredItems.some((i) => i.ruleId === rule.familyId || i.ruleId === rule.id))
  const newRequired = afterPeople.filter((p) => !before.personResults.find((b) => b.personId === p.personId)?.requiredItems.some((i) => i.ruleId === rule.id))
  const newIssues = after.issues.filter((i) => i.ruleId === rule.id && !before.issues.some((b) => b.fingerprint === i.fingerprint))
  const orgSet = new Set(afterPeople.map((p) => before.personResults.find(() => true) && p.personId))
  const affectedOrgs = new Set(
    afterPeople
      .map((p) => db.assignments.find((a) => a.personId === p.personId && a.kind === 'primary')?.orgId)
      .filter(Boolean),
  )
  const groupStatusChanges: SimulationReport['groupStatusChanges'] = []
  for (const g of after.groupResults.filter((x) => x.ruleId === rule.id && x.orgId)) {
    const prev = before.groupResults.find((x) => x.ruleId === rule.id && x.orgId === g.orgId)
    const from = prev?.status ?? '（无）'
    if (from !== g.status) groupStatusChanges.push({ orgName: g.orgName, from: String(from), to: g.status })
  }
  void beforeReq
  void orgSet
  return {
    affectedPeople: afterPeople.length,
    affectedOrgs: affectedOrgs.size,
    newRequiredPeople: newRequired.length,
    newIssues: newIssues.length,
    groupStatusChanges,
  }
}
