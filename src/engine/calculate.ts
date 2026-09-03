import type {
  Assignment,
  CalcOutput,
  CategorySlice,
  CertHolding,
  CompanyStats,
  DB,
  GroupGoalStatus,
  GroupResult,
  IncentiveSlice,
  Issue,
  Person,
  PersonResult,
  PersonWorkScope,
  RequiredItem,
  RequiredItemStatus,
  Rule,
  UnitStats,
  WarningLevel,
} from '../types'
import { daysBetween, inRange } from './dates'
import { evalPersonApplicability, explainCondition } from './eval'
import { companies, companyOf, descendantIds, orgById, orgPath } from './org'

export function assignmentsAt(db: DB, personId: string, asOf: string): Assignment[] {
  return db.assignments.filter(
    (a) => a.personId === personId && inRange(asOf, a.startDate, a.endDate),
  )
}

export function scopesAt(db: DB, personId: string, asOf: string): PersonWorkScope[] {
  return db.personWorkScopes.filter(
    (s) => s.personId === personId && inRange(asOf, s.startDate, s.endDate),
  )
}

export function holdingsAt(db: DB, personId: string, asOf: string): CertHolding[] {
  return db.holdings.filter((h) => h.personId === personId)
}

export function effectiveRules(db: DB, asOf: string): Rule[] {
  return db.rules.filter((r) => {
    if (r.status === 'draft' || r.status === 'pending_review' || r.status === 'rejected') return false
    if (asOf < r.effectiveFrom) return false
    if (r.effectiveTo && asOf > r.effectiveTo) return false
    return true
  })
}

export function isHoldingEffective(h: CertHolding, asOf: string, db: DB): boolean {
  if (h.certStdStatus !== 'mapped' || !h.standardCertId) return false
  const cert = db.certificates.find((c) => c.id === h.standardCertId)
  if (!cert) return false
  if (cert.hasExpiry) {
    if (h.validFrom && asOf < h.validFrom) return false
    if (h.validTo && asOf > h.validTo) return false
  }
  return true
}

export function holdingProblems(
  h: CertHolding,
  asOf: string,
  db: DB,
): { expired: boolean; reviewOverdue: boolean; daysLeft?: number; warning?: WarningLevel } {
  const cert = h.standardCertId ? db.certificates.find((c) => c.id === h.standardCertId) : undefined
  let expired = false
  let reviewOverdue = false
  let daysLeft: number | undefined
  let warning: WarningLevel | undefined
  if (cert?.hasExpiry && h.validTo) {
    daysLeft = daysBetween(asOf, h.validTo)
    if (daysLeft < 0) {
      expired = true
      warning = 'expired'
    } else if (cert.warning.expiryEnabled) {
      const nodes = [...cert.warning.expiryNodes].sort((a, b) => a - b)
      if (nodes.includes(7) && daysLeft <= 7) warning = 'urgent_7'
      else if (nodes.some((n) => n <= 30) && daysLeft <= 30) warning = 'warn_30'
      else if (nodes.some((n) => n <= 90) && daysLeft <= 90) warning = 'warn_90'
      else if (nodes.some((n) => n <= 180) && daysLeft <= 180) warning = 'hint_180'
    }
  }
  if (cert?.needsReview && h.reviewDate && h.reviewDate < asOf) {
    reviewOverdue = true
  }
  return { expired, reviewOverdue, daysLeft, warning }
}

function matchHolding(
  db: DB,
  holdings: CertHolding[],
  certificateId: string,
  minGradeOrder: number | undefined,
  asOf: string,
): { status: RequiredItemStatus; matched: CertHolding[]; daysLeft?: number; warning?: WarningLevel; note: string } {
  const target = db.certificates.find((c) => c.id === certificateId)
  if (!target) return { status: 'unknown', matched: [], note: '标准证书不存在' }

  const unmapped = holdings.filter((h) => h.certStdStatus === 'unmapped')
  const mapped = holdings.filter((h) => h.certStdStatus === 'mapped' && h.standardCertId)

  const seriesHits = mapped.filter((h) => {
    const c = db.certificates.find((x) => x.id === h.standardCertId)
    if (!c) return false
    if (h.standardCertId === certificateId) return true
    if (minGradeOrder != null && c.series === target.series && c.gradeOrder != null) return true
    return false
  })

  if (seriesHits.length === 0) {
    if (unmapped.length > 0) {
      return {
        status: 'unknown',
        matched: unmapped,
        note: `存在未标准化证书（${unmapped.map((h) => h.originalName).join('、')}），不得推断为已持或未持`,
      }
    }
    return { status: 'missing', matched: [], note: `未持有「${target.name}」` }
  }

  const gradeOk = seriesHits.filter((h) => {
    if (minGradeOrder == null) return h.standardCertId === certificateId || true
    const c = db.certificates.find((x) => x.id === h.standardCertId)!
    if (h.standardCertId === certificateId) {
      return c.gradeOrder == null || c.gradeOrder >= minGradeOrder
    }
    return c.series === target.series && (c.gradeOrder ?? 0) >= minGradeOrder
  })

  if (gradeOk.length === 0) {
    return { status: 'grade_insufficient', matched: seriesHits, note: `已持相关证书但等级不足（要求≥${minGradeOrder}）` }
  }

  const problems = gradeOk.map((h) => ({ h, p: holdingProblems(h, asOf, db) }))
  const live = problems.filter((x) => !x.p.expired)
  if (live.length === 0) {
    return { status: 'expired', matched: gradeOk, note: `持有「${target.name}」但在统计时点已过期` }
  }
  const reviewBad = live.filter((x) => x.p.reviewOverdue)
  if (reviewBad.length === live.length) {
    return { status: 'review_overdue', matched: reviewBad.map((x) => x.h), note: `持有「${target.name}」但复审已逾期` }
  }
  const best = live.sort((a, b) => (a.p.daysLeft ?? 99999) - (b.p.daysLeft ?? 99999))[0]
  return {
    status: 'satisfied',
    matched: live.map((x) => x.h),
    daysLeft: best.p.daysLeft,
    warning: best.p.warning,
    note: `已持有效「${target.name}」`,
  }
}

function transitionOverlay(
  db: DB,
  rules: Rule[],
  person: Person,
  assignments: Assignment[],
  scopes: PersonWorkScope[],
  certId: string,
  asOf: string,
): { inTransition: boolean; deadline?: string; daysLeft?: number; rule?: Rule } {
  const tRules = rules.filter((r) => r.type === 'transition' || r.type === 'new_post')
  for (const rule of tRules) {
    if (!rule.requirement.items.some((i) => i.certificateId === certId)) continue
    const app = evalPersonApplicability(rule.condition, db, person, assignments, scopes, asOf)
    if (app.result !== 'true') continue
    const days = rule.transitionDays ?? 90
    const starts: string[] = []
    for (const a of assignments) starts.push(a.startDate)
    for (const s of scopes.filter((x) => x.confirmed)) starts.push(s.startDate)
    if (starts.length === 0) continue
    const latestRelevant = starts.sort()[starts.length - 1]
    const assignmentForCert = assignments
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    const start = assignmentForCert[assignmentForCert.length - 1]?.startDate ?? latestRelevant
    const deadlineMs = Date.parse(start + 'T00:00:00') + days * 86400000
    const deadline = new Date(deadlineMs).toISOString().slice(0, 10)
    if (asOf <= deadline) {
      return {
        inTransition: true,
        deadline,
        daysLeft: daysBetween(asOf, deadline),
        rule,
      }
    }
  }
  return { inTransition: false }
}

function emptySlice(): CategorySlice {
  return { requiredPeople: 0, compliantPeople: 0, missing: 0, expired: 0, reviewOverdue: 0, expiring: 0 }
}

function ownerOrg(db: DB, personId: string, asOf: string): string | undefined {
  const asg = assignmentsAt(db, personId, asOf)
  const primary = asg.find((a) => a.kind === 'primary') ?? asg[0]
  return primary?.orgId
}

function fingerprint(parts: string[]): string {
  return parts.join('|')
}

function nextIssueCode(existing: Issue[], i: number): string {
  return `IS-${String(existing.length + i + 1).padStart(5, '0')}`
}

export function calculateAll(db: DB, asOf: string): CalcOutput {
  const rules = effectiveRules(db, asOf)
  const people = db.people.filter((p) => p.status === 'active')
  const personResults: PersonResult[] = []
  const genIssues: Issue[] = []
  const pushIssue = (issue: Omit<Issue, 'id' | 'code' | 'foundAt'>) => {
    const fp = issue.fingerprint
    if (genIssues.some((x) => x.fingerprint === fp)) return
    genIssues.push({
      ...issue,
      id: `iss_${genIssues.length + 1}_${fp.slice(0, 6)}`,
      code: nextIssueCode(genIssues, 0),
      foundAt: asOf,
    })
  }

  for (const person of people) {
    const assignments = assignmentsAt(db, person.id, asOf)
    const scopes = scopesAt(db, person.id, asOf)
    const holdings = holdingsAt(db, person.id, asOf)
    const orgId = ownerOrg(db, person.id, asOf)
    const qualityReasons: string[] = []
    const explanation: string[] = []

    if (assignments.length === 0) {
      qualityReasons.push('统计时点无有效任职记录')
    }
    for (const a of assignments) {
      if (a.jobStdStatus === 'unmapped' || !a.standardJobId) {
        qualityReasons.push(`岗位未标准化：原始「${a.originalJobName}」`)
        pushIssue({
          class: 'data_quality',
          severity: 'medium',
          status: 'open',
          title: `岗位名称待治理：${a.originalJobName}`,
          personId: person.id,
          orgId,
          assignmentId: a.id,
          field: 'originalJobName',
          originalValue: a.originalJobName,
          rationale: `原始岗位「${a.originalJobName}」尚未确认标准岗位，不得据此产生正式持证结论。`,
          ownerOrgId: orgId,
          fingerprint: fingerprint(['dq', 'job', person.id, a.originalJobName]),
        })
      }
      if (a.suspectedAnomaly) {
        pushIssue({
          class: 'data_quality',
          severity: 'low',
          status: 'open',
          title: `疑似异常任职：${person.name}`,
          personId: person.id,
          orgId,
          assignmentId: a.id,
          rationale: a.suspectedAnomaly,
          ownerOrgId: orgId,
          fingerprint: fingerprint(['dq', 'anomaly', a.id]),
        })
      }
    }
    for (const h of holdings) {
      if (h.certStdStatus === 'unmapped' || !h.standardCertId) {
        qualityReasons.push(`证书未标准化：原始「${h.originalName}」`)
        pushIssue({
          class: 'data_quality',
          severity: 'medium',
          status: 'open',
          title: `证书名称待治理：${h.originalName}`,
          personId: person.id,
          orgId,
          holdingId: h.id,
          certificateId: undefined,
          field: 'originalCertName',
          originalValue: h.originalName,
          rationale: `原始证书「${h.originalName}」尚未确认标准证书，不能计入实持。`,
          ownerOrgId: orgId,
          fingerprint: fingerprint(['dq', 'cert', person.id, h.originalName]),
        })
      }
    }

    const requiredItems: RequiredItem[] = []
    let undecidable = qualityReasons.length > 0

    for (const rule of rules.filter((r) => r.type === 'personal_mandatory' || r.type === 'incentive')) {
      const app = evalPersonApplicability(rule.condition, db, person, assignments, scopes, asOf)
      const condText = explainCondition(rule.condition)
      if (app.result === 'false') {
        explanation.push(`规则「${rule.name}」v${rule.version} 不适用（${condText}）`)
        continue
      }
      if (app.result === 'unknown') {
        explanation.push(`规则「${rule.name}」v${rule.version} 无法判定适用性（${condText}）。数据不足，不产生正式合规结论。`)
        if (rule.type === 'personal_mandatory') {
          undecidable = true
          const missingScope = !scopes.some((s) => s.confirmed)
          pushIssue({
            class: 'data_quality',
            severity: 'high',
            status: 'open',
            title: missingScope ? `作业范围缺失，无法判定：${person.name}` : `规则适用性未知：${person.name} / ${rule.name}`,
            personId: person.id,
            orgId,
            ruleId: rule.id,
            ruleVersion: rule.version,
            field: missingScope ? 'work_scope' : 'applicability',
            rationale: `条件「${condText}」在当前数据下为「无法判定」。系统拒绝猜测是否应持证。`,
            ownerOrgId: orgId,
            fingerprint: fingerprint(['dq', 'unknown', person.id, rule.id, String(rule.version)]),
          })
        }
        continue
      }

      explanation.push(`规则「${rule.name}」v${rule.version} 适用（${condText}）`)
      const req = rule.requirement
      const evalOne = (certificateId: string, minGradeOrder?: number) => {
        const cert = db.certificates.find((c) => c.id === certificateId)
        const match = matchHolding(db, holdings, certificateId, minGradeOrder, asOf)
        let status = match.status
        let extra = match.note
        if (status === 'unknown') undecidable = true
        if ((status === 'missing' || status === 'expired' || status === 'review_overdue') && rule.type === 'personal_mandatory') {
          const overlay = transitionOverlay(db, rules, person, assignments, scopes, certificateId, asOf)
          if (overlay.inTransition) {
            status = 'in_transition'
            extra = `${match.note}；处于新上岗/过渡期，截止日期 ${overlay.deadline}（剩余 ${overlay.daysLeft} 天），当前记风险预警而非正式不合规。`
          }
        }
        const item: RequiredItem = {
          certificateId,
          certificateName: cert?.name ?? certificateId,
          minGradeOrder,
          ruleId: rule.id,
          ruleName: rule.name,
          ruleVersion: rule.version,
          incentive: rule.type === 'incentive',
          status,
          actualHoldingIds: match.matched.map((h) => h.id),
          explanation: extra,
          daysLeft: match.daysLeft,
          warningLevel: match.warning,
        }
        requiredItems.push(item)

        if (rule.type === 'incentive') return

        if (status === 'missing' || status === 'expired' || status === 'review_overdue' || status === 'grade_insufficient') {
          const titleMap: Record<string, string> = {
            missing: `应持未持：${person.name} / ${item.certificateName}`,
            expired: `证书过期：${person.name} / ${item.certificateName}`,
            review_overdue: `复审逾期：${person.name} / ${item.certificateName}`,
            grade_insufficient: `证书等级不足：${person.name} / ${item.certificateName}`,
          }
          pushIssue({
            class: 'compliance',
            severity: status === 'missing' || status === 'expired' ? 'high' : 'medium',
            status: 'open',
            title: titleMap[status],
            personId: person.id,
            orgId,
            certificateId,
            ruleId: rule.id,
            ruleVersion: rule.version,
            rationale: `触发规则「${rule.name}」v${rule.version}。${extra} 判定依据：${condText}。`,
            ownerOrgId: orgId,
            dueDate: addDaysSafe(asOf, 30),
            fingerprint: fingerprint(['cp', status, person.id, certificateId, rule.id]),
          })
        } else if (status === 'in_transition') {
          pushIssue({
            class: 'risk',
            severity: 'medium',
            status: 'open',
            title: `过渡期临期：${person.name} / ${item.certificateName}`,
            personId: person.id,
            orgId,
            certificateId,
            ruleId: rule.id,
            ruleVersion: rule.version,
            rationale: extra,
            ownerOrgId: orgId,
            fingerprint: fingerprint(['rk', 'trans', person.id, certificateId, rule.id]),
          })
        } else if (status === 'satisfied' && match.warning) {
          const label: Record<string, string> = {
            hint_180: '一级提示（180天）',
            warn_90: '二级预警（90天）',
            warn_30: '三级预警（30天）',
            urgent_7: '紧急预警（7天）',
            expired: '已过期',
          }
          pushIssue({
            class: 'risk',
            severity: match.warning === 'urgent_7' ? 'critical' : match.warning === 'warn_30' ? 'high' : 'medium',
            status: 'open',
            title: `${label[match.warning]}：${person.name} / ${item.certificateName}`,
            personId: person.id,
            orgId,
            certificateId,
            holdingId: match.matched[0]?.id,
            ruleId: rule.id,
            ruleVersion: rule.version,
            rationale: `证书有效截止剩余 ${match.daysLeft} 天，按该证书预警方案触发${label[match.warning]}。当前尚未构成正式不合规。`,
            ownerOrgId: orgId,
            fingerprint: fingerprint(['rk', match.warning, person.id, certificateId]),
          })
        }
      }

      if (req.logic === 'AND') {
        for (const it of req.items) evalOne(it.certificateId, it.minGradeOrder)
      } else {
        const trial = req.items.map((it) => ({
          it,
          match: matchHolding(db, holdings, it.certificateId, it.minGradeOrder, asOf),
        }))
        const ok = trial.find((t) => t.match.status === 'satisfied')
        if (ok) evalOne(ok.it.certificateId, ok.it.minGradeOrder)
        else {
          const unknown = trial.find((t) => t.match.status === 'unknown')
          if (unknown) evalOne(unknown.it.certificateId, unknown.it.minGradeOrder)
          else evalOne(req.items[0].certificateId, req.items[0].minGradeOrder)
        }
      }
    }

    for (const h of holdings) {
      if (h.certStdStatus !== 'mapped' || !h.standardCertId) continue
      const already = genIssues.some(
        (i) => i.holdingId === h.id || (i.personId === person.id && i.certificateId === h.standardCertId && i.class === 'risk'),
      )
      if (already) continue
      const p = holdingProblems(h, asOf, db)
      const cert = db.certificates.find((c) => c.id === h.standardCertId)
      if (p.expired) {
        pushIssue({
          class: 'compliance',
          severity: 'high',
          status: 'open',
          title: `证书过期：${person.name} / ${cert?.name}`,
          personId: person.id,
          orgId,
          certificateId: h.standardCertId,
          holdingId: h.id,
          rationale: `证书「${h.originalName}」有效期至 ${h.validTo}，统计时点已过期。`,
          ownerOrgId: orgId,
          fingerprint: fingerprint(['cp', 'expired-hold', h.id]),
        })
      } else if (p.reviewOverdue) {
        pushIssue({
          class: 'compliance',
          severity: 'medium',
          status: 'open',
          title: `复审逾期：${person.name} / ${cert?.name}`,
          personId: person.id,
          orgId,
          certificateId: h.standardCertId,
          holdingId: h.id,
          rationale: `复审日期 ${h.reviewDate} 早于统计时点。`,
          ownerOrgId: orgId,
          fingerprint: fingerprint(['cp', 'review', h.id]),
        })
      } else if (p.warning) {
        const label: Record<string, string> = {
          hint_180: '一级提示（180天）',
          warn_90: '二级预警（90天）',
          warn_30: '三级预警（30天）',
          urgent_7: '紧急预警（7天）',
          expired: '已过期',
        }
        pushIssue({
          class: 'risk',
          severity: p.warning === 'urgent_7' ? 'critical' : p.warning === 'warn_30' ? 'high' : 'medium',
          status: 'open',
          title: `${label[p.warning]}：${person.name} / ${cert?.name}`,
          personId: person.id,
          orgId,
          certificateId: h.standardCertId,
          holdingId: h.id,
          rationale: `剩余 ${p.daysLeft} 天，按证书预警方案触发。尚未构成正式不合规。`,
          ownerOrgId: orgId,
          fingerprint: fingerprint(['rk', p.warning, person.id, h.standardCertId ?? '']),
        })
      }
    }

    const mandatory = requiredItems.filter((i) => !i.incentive)
    if (undecidable || mandatory.some((i) => i.status === 'unknown')) {
      personResults.push({
        personId: person.id,
        asOf,
        judgement: 'undecidable',
        requiredItems,
        qualityReasons,
        explanation,
      })
    } else if (mandatory.some((i) => ['missing', 'expired', 'review_overdue', 'grade_insufficient'].includes(i.status))) {
      personResults.push({
        personId: person.id,
        asOf,
        judgement: 'noncompliant',
        requiredItems,
        qualityReasons,
        explanation,
      })
    } else {
      personResults.push({
        personId: person.id,
        asOf,
        judgement: 'compliant',
        requiredItems,
        qualityReasons,
        explanation,
      })
    }
  }

  const groupResults: GroupResult[] = []
  for (const rule of rules.filter((r) => r.type === 'group_ratio')) {
    const stage = pickStage(rule, asOf)
    const next = nextStage(rule, asOf)
    for (const org of [{ id: null as string | null, name: '全公司' }, ...companies(db).map((c) => ({ id: c.id as string | null, name: c.standardName }))]) {
      const scopePeople = people.filter((p) => {
        if (!org.id) return true
        const oid = ownerOrg(db, p.id, asOf)
        return oid ? descendantIds(db, org.id).has(oid) : false
      })
      let population = 0
      let decidable = 0
      let certified = 0
      for (const p of scopePeople) {
        const assignments = assignmentsAt(db, p.id, asOf)
        const scopes = scopesAt(db, p.id, asOf)
        const app = evalPersonApplicability(rule.condition, db, p, assignments, scopes, asOf)
        if (app.result === 'false') continue
        population += 1
        if (app.result === 'unknown') continue
        decidable += 1
        const holdings = holdingsAt(db, p.id, asOf)
        const ok = rule.requirement.items.some((it) => matchHolding(db, holdings, it.certificateId, it.minGradeOrder, asOf).status === 'satisfied')
        if (ok) certified += 1
      }
      const coverage = population === 0 ? 1 : decidable / population
      const rate = decidable === 0 ? null : certified / decidable
      let status: GroupGoalStatus
      let message: string
      if (population === 0) {
        status = 'insufficient_data'
        message = '该范围内无适用人员'
      } else if (coverage < 1) {
        if (rate != null && rate >= stage.target) {
          status = 'partial_met'
          message = '已确认范围达到目标，但总体数据尚不足以确认最终达标。'
        } else {
          status = 'insufficient_data'
          message = '关键数据不完整，不宣告整体达标。'
        }
      } else if (rate != null && rate >= stage.target) {
        status = 'met'
        message = `已达到本阶段目标 ${pct(stage.target)}`
      } else {
        status = 'not_met'
        message = `低于本阶段目标 ${pct(stage.target)}`
      }
      groupResults.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleVersion: rule.version,
        asOf,
        orgId: org.id,
        orgName: org.name,
        population,
        decidable,
        certified,
        rate,
        coverage,
        stageLabel: stage.label,
        stageTarget: stage.target,
        nextStageLabel: next?.label,
        nextStageTarget: next?.target,
        daysToDeadline: daysBetween(asOf, stage.until),
        status,
        message,
      })
      if (org.id && status === 'not_met') {
        pushIssue({
          class: 'compliance',
          severity: 'high',
          status: 'open',
          title: `群体比例未达标：${org.name} / ${rule.name}`,
          orgId: org.id,
          ruleId: rule.id,
          ruleVersion: rule.version,
          rationale: `${org.name} 当前持证率 ${rate == null ? '—' : pct(rate)}，阶段目标 ${pct(stage.target)}。${message} 不得将群体未达标理解为每一名未持证人员都已个人违规；个人结论仍按个人强制规则计算。`,
          ownerOrgId: org.id,
          fingerprint: fingerprint(['cp', 'group', org.id, rule.id, stage.until]),
        })
      }
    }
  }

  const stats = summarize(db, personResults, genIssues, asOf)
  const unitStats = companies(db).map((c) => summarizeUnit(db, personResults, genIssues, asOf, c.id, c.standardName))

  return { asOf, personResults, groupResults, issues: genIssues, stats, unitStats }
}

function addDaysSafe(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function pickStage(rule: Rule, asOf: string): { until: string; target: number; label: string } {
  const stages = [...(rule.stages ?? [])].sort((a, b) => a.until.localeCompare(b.until))
  const hit = stages.find((s) => asOf <= s.until) ?? stages[stages.length - 1]
  return hit ?? { until: '9999-12-31', target: 1, label: '默认 100%' }
}

function nextStage(rule: Rule, asOf: string) {
  const stages = [...(rule.stages ?? [])].sort((a, b) => a.until.localeCompare(b.until))
  const idx = stages.findIndex((s) => asOf <= s.until)
  if (idx >= 0 && idx < stages.length - 1) return stages[idx + 1]
  return undefined
}

function summarize(db: DB, results: PersonResult[], issues: Issue[], asOf: string): CompanyStats {
  const managed = results.length
  const decidable = results.filter((r) => r.judgement !== 'undecidable').length
  const compliant = results.filter((r) => r.judgement === 'compliant').length
  const items = results.flatMap((r) => r.requiredItems.filter((i) => !i.incentive && i.status !== 'unknown'))
  const satisfied = items.filter((i) => i.status === 'satisfied' || i.status === 'in_transition')
  const national = sliceOf(db, results, 'national')
  const group = sliceOf(db, results, 'group')
  const year = asOf.slice(0, 4)
  const incentive: IncentiveSlice = {
    coveragePeople: new Set(
      results.filter((r) => r.requiredItems.some((i) => i.incentive && i.status === 'satisfied')).map((r) => r.personId),
    ).size,
    highGrade: results.filter((r) =>
      r.requiredItems.some((i) => i.incentive && i.status === 'satisfied' && (i.minGradeOrder ?? 0) >= 3),
    ).length,
    obtainedThisYear: db.holdings.filter((h) => h.obtainedAt.startsWith(year)).length,
  }

  return {
    managed,
    decidable,
    compliant,
    personRate: decidable === 0 ? null : compliant / decidable,
    requiredItems: items.length,
    satisfiedItems: satisfied.length,
    itemRate: items.length === 0 ? null : satisfied.length / items.length,
    coverage: managed === 0 ? 1 : decidable / managed,
    complianceIssues: issues.filter((i) => i.class === 'compliance').length,
    riskIssues: issues.filter((i) => i.class === 'risk').length,
    qualityIssues: issues.filter((i) => i.class === 'data_quality').length,
    national,
    group,
    incentive,
  }
}

function sliceOf(db: DB, results: PersonResult[], cat: 'national' | 'group'): CategorySlice {
  const s = emptySlice()
  const people = new Set<string>()
  const ok = new Set<string>()
  for (const r of results) {
    const items = r.requiredItems.filter((i) => {
      const c = db.certificates.find((x) => x.id === i.certificateId)
      return c?.category === cat && !i.incentive
    })
    if (items.length === 0) continue
    people.add(r.personId)
    if (items.every((i) => i.status === 'satisfied' || i.status === 'in_transition')) ok.add(r.personId)
    for (const i of items) {
      if (i.status === 'missing') s.missing += 1
      if (i.status === 'expired') s.expired += 1
      if (i.status === 'review_overdue') s.reviewOverdue += 1
      if (i.status === 'satisfied' && i.warningLevel) s.expiring += 1
    }
  }
  s.requiredPeople = people.size
  s.compliantPeople = ok.size
  return s
}

function summarizeUnit(
  db: DB,
  results: PersonResult[],
  issues: Issue[],
  asOf: string,
  orgId: string,
  orgName: string,
): UnitStats {
  const ids = descendantIds(db, orgId)
  const people = results.filter((r) => {
    const asg = assignmentsAt(db, r.personId, asOf)
    return asg.some((a) => ids.has(a.orgId))
  })
  const managed = people.length
  const decidable = people.filter((r) => r.judgement !== 'undecidable').length
  const compliant = people.filter((r) => r.judgement === 'compliant').length
  const items = people.flatMap((r) => r.requiredItems.filter((i) => !i.incentive && i.status !== 'unknown'))
  const satisfied = items.filter((i) => i.status === 'satisfied' || i.status === 'in_transition')
  return {
    orgId,
    orgName,
    managed,
    decidable,
    compliant,
    personRate: decidable === 0 ? null : compliant / decidable,
    requiredItems: items.length,
    satisfiedItems: satisfied.length,
    itemRate: items.length === 0 ? null : satisfied.length / items.length,
    coverage: managed === 0 ? 1 : decidable / managed,
    complianceIssues: issues.filter((i) => i.class === 'compliance' && i.orgId && ids.has(i.orgId)).length,
    riskIssues: issues.filter((i) => i.class === 'risk' && i.orgId && ids.has(i.orgId)).length,
  }
}

export function mergeIssues(prev: Issue[], next: Issue[]): Issue[] {
  const prevByFp = new Map(prev.map((i) => [i.fingerprint, i]))
  const out: Issue[] = []
  const seen = new Set<string>()
  for (const n of next) {
    seen.add(n.fingerprint)
    const old = prevByFp.get(n.fingerprint)
    if (!old) {
      out.push(n)
      continue
    }
    if (old.status === 'closed') {
      out.push(old)
      continue
    }
    out.push({
      ...n,
      id: old.id,
      code: old.code,
      foundAt: old.foundAt,
      status: old.status,
      assigneeId: old.assigneeId,
      reviewerId: old.reviewerId,
      dueDate: old.dueDate ?? n.dueDate,
    })
  }
  for (const old of prev) {
    if (seen.has(old.fingerprint)) continue
    if (old.status === 'closed') {
      out.push(old)
      continue
    }
    if (old.status === 'open') {
      out.push({ ...old, status: 'resolved_pending_close', rationale: old.rationale + '（重算后问题已不存在，待销项确认）' })
    } else {
      out.push(old)
    }
  }
  return out
}

export { orgPath, orgById, companyOf, explainCondition }
