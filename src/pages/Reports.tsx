import { useMemo, useState } from 'react'
import { Badge, Card, judgeTone } from '../components/ui'
import { liveCalc, useDb } from '../store'
import { ISSUE_CLASS, ISSUE_STATUS, JUDGE, pct } from '../format'
import { orgPath } from '../engine/org'
import { assignmentsAt } from '../engine/calculate'

const TABS = [
  '单位综合',
  '证书情况',
  '岗位匹配',
  '应持未持',
  '临期复审',
  '阶段目标',
  '数据质量',
  '整改闭环',
  '审计日志',
] as const

export function Reports() {
  const db = useDb()
  const calc = liveCalc(db)
  const [tab, setTab] = useState<(typeof TABS)[number]>('单位综合')

  const certRows = useMemo(() => {
    const map = new Map<
      string,
      { category: string; name: string; required: number; held: number; valid: number; expiring: number; expired: number }
    >()
    for (const r of calc.personResults) {
      for (const it of r.requiredItems.filter((i) => !i.incentive)) {
        const cert = db.certificates.find((c) => c.id === it.certificateId)
        const cur = map.get(it.certificateId) ?? {
          category: cert?.category ?? '',
          name: it.certificateName,
          required: 0,
          held: 0,
          valid: 0,
          expiring: 0,
          expired: 0,
        }
        cur.required += 1
        if (it.status !== 'missing' && it.status !== 'unknown') cur.held += 1
        if (it.status === 'satisfied' || it.status === 'in_transition') cur.valid += 1
        if (it.warningLevel && it.status === 'satisfied') cur.expiring += 1
        if (it.status === 'expired') cur.expired += 1
        map.set(it.certificateId, cur)
      }
    }
    return [...map.values()]
  }, [calc.personResults, db.certificates])

  const jobRows = useMemo(() => {
    const map = new Map<string, { org: string; major: string; job: string; people: number; certs: string; held: number; missing: number; rate: number | null }>()
    for (const r of calc.personResults) {
      const asg = assignmentsAt(db, r.personId, db.asOfDate).find((a) => a.kind === 'primary') ?? assignmentsAt(db, r.personId, db.asOfDate)[0]
      if (!asg) continue
      const job = db.jobs.find((j) => j.id === asg.standardJobId)
      const key = `${asg.orgId}|${job?.id ?? asg.originalJobName}`
      const cur = map.get(key) ?? {
        org: orgPath(db, asg.orgId),
        major: job?.major ?? '—',
        job: job?.name ?? asg.originalJobName,
        people: 0,
        certs: [...new Set(r.requiredItems.filter((i) => !i.incentive).map((i) => i.certificateName))].join('、') || '—',
        held: 0,
        missing: 0,
        rate: null,
      }
      cur.people += 1
      if (r.judgement === 'compliant') cur.held += 1
      if (r.judgement === 'noncompliant') cur.missing += 1
      const decidable = cur.held + cur.missing
      cur.rate = decidable ? cur.held / decidable : null
      map.set(key, cur)
    }
    return [...map.values()]
  }, [calc.personResults, db])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">统计报表与追溯</h1>
        <p className="mt-1 text-sm text-slate-500">
          正式考核以确认后的统计快照为依据；当前页按统计时点 {db.asOfDate} 即时重算，便于核查。
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === '单位综合' ? (
        <Card className="overflow-auto p-0">
          <table className="data">
            <thead>
              <tr>
                <th>单位</th>
                <th>应纳管</th>
                <th>可判定</th>
                <th>合规</th>
                <th>人员合规率</th>
                <th>应持证项</th>
                <th>已完成证项</th>
                <th>证项完成率</th>
                <th>覆盖率</th>
                <th>合规问题</th>
                <th>风险预警</th>
              </tr>
            </thead>
            <tbody>
              {calc.unitStats.map((u) => (
                <tr key={u.orgId}>
                  <td>{u.orgName}</td>
                  <td>{u.managed}</td>
                  <td>{u.decidable}</td>
                  <td>{u.compliant}</td>
                  <td>{pct(u.personRate)}</td>
                  <td>{u.requiredItems}</td>
                  <td>{u.satisfiedItems}</td>
                  <td>{pct(u.itemRate)}</td>
                  <td>{pct(u.coverage)}</td>
                  <td>{u.complianceIssues}</td>
                  <td>{u.riskIssues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === '证书情况' ? (
        <Card className="overflow-auto p-0">
          <table className="data">
            <thead>
              <tr>
                <th>类别</th>
                <th>证书</th>
                <th>应持</th>
                <th>已持</th>
                <th>有效</th>
                <th>临期</th>
                <th>过期</th>
                <th>完成率</th>
              </tr>
            </thead>
            <tbody>
              {certRows.map((r) => (
                <tr key={r.name}>
                  <td>{r.category}</td>
                  <td>{r.name}</td>
                  <td>{r.required}</td>
                  <td>{r.held}</td>
                  <td>{r.valid}</td>
                  <td>{r.expiring}</td>
                  <td>{r.expired}</td>
                  <td>{pct(r.required ? r.valid / r.required : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === '岗位匹配' ? (
        <Card className="overflow-auto p-0">
          <table className="data">
            <thead>
              <tr>
                <th>单位</th>
                <th>专业</th>
                <th>标准岗位</th>
                <th>人数</th>
                <th>应持证书</th>
                <th>合规</th>
                <th>不合规</th>
                <th>人员合规率</th>
              </tr>
            </thead>
            <tbody>
              {jobRows.map((r, i) => (
                <tr key={i}>
                  <td>{r.org}</td>
                  <td>{r.major}</td>
                  <td>{r.job}</td>
                  <td>{r.people}</td>
                  <td className="max-w-xs truncate">{r.certs}</td>
                  <td>{r.held}</td>
                  <td>{r.missing}</td>
                  <td>{pct(r.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === '应持未持' ? (
        <Card className="overflow-auto p-0">
          <table className="data">
            <thead>
              <tr>
                <th>单位</th>
                <th>人员</th>
                <th>工号</th>
                <th>标准岗位</th>
                <th>作业范围</th>
                <th>缺失证书</th>
                <th>规则</th>
                <th>整改状态</th>
              </tr>
            </thead>
            <tbody>
              {calc.personResults.flatMap((r) => {
                const p = db.people.find((x) => x.id === r.personId)!
                const asg = assignmentsAt(db, p.id, db.asOfDate)[0]
                const job = asg?.standardJobId ? db.jobs.find((j) => j.id === asg.standardJobId)?.name : asg?.originalJobName
                const scopes = db.personWorkScopes
                  .filter((s) => s.personId === p.id && s.confirmed)
                  .map((s) => db.workScopeTags.find((t) => t.id === s.tagId)?.name)
                  .filter(Boolean)
                  .join('、')
                return r.requiredItems
                  .filter((i) => !i.incentive && i.status === 'missing')
                  .map((i) => {
                    const iss = db.issues.find((x) => x.personId === p.id && x.certificateId === i.certificateId && x.class === 'compliance')
                    return (
                      <tr key={p.id + i.certificateId + i.ruleId}>
                        <td>{asg ? orgPath(db, asg.orgId) : '—'}</td>
                        <td>{p.name}</td>
                        <td>{p.employeeNo}</td>
                        <td>{job}</td>
                        <td>{scopes || '—'}</td>
                        <td>{i.certificateName}</td>
                        <td>
                          {i.ruleName} v{i.ruleVersion}
                        </td>
                        <td>{iss ? ISSUE_STATUS[iss.status] : '—'}</td>
                      </tr>
                    )
                  })
              })}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === '临期复审' ? (
        <Card className="overflow-auto p-0">
          <table className="data">
            <thead>
              <tr>
                <th>单位</th>
                <th>人员</th>
                <th>证书</th>
                <th>编号</th>
                <th>到期</th>
                <th>剩余天数</th>
                <th>预警级别</th>
                <th>复审日期</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {db.issues
                .filter((i) => i.class === 'risk' || i.title.includes('复审') || i.title.includes('过期'))
                .map((i) => {
                  const p = db.people.find((x) => x.id === i.personId)
                  const h = db.holdings.find((x) => x.id === i.holdingId) ?? db.holdings.find((x) => x.personId === i.personId && x.standardCertId === i.certificateId)
                  const cert = db.certificates.find((c) => c.id === i.certificateId)
                  return (
                    <tr key={i.id}>
                      <td>{i.orgId ? orgPath(db, i.orgId) : '—'}</td>
                      <td>{p?.name}</td>
                      <td>{cert?.name}</td>
                      <td>{h?.certNo ?? '—'}</td>
                      <td>{h?.validTo ?? '—'}</td>
                      <td>{h?.validTo ? daysLeft(db.asOfDate, h.validTo) : '—'}</td>
                      <td>{i.title.split('：')[0]}</td>
                      <td>{h?.reviewDate ?? '—'}</td>
                      <td>{ISSUE_STATUS[i.status]}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === '阶段目标' ? (
        <Card className="overflow-auto p-0">
          <table className="data">
            <thead>
              <tr>
                <th>单位</th>
                <th>人员群体 / 规则</th>
                <th>持证人数</th>
                <th>可统计</th>
                <th>持证率</th>
                <th>本阶段</th>
                <th>下一阶段</th>
                <th>覆盖率</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {calc.groupResults.map((g) => (
                <tr key={g.ruleId + (g.orgId ?? 'all')}>
                  <td>{g.orgName}</td>
                  <td>{g.ruleName}</td>
                  <td>{g.certified}</td>
                  <td>{g.decidable}</td>
                  <td>{pct(g.rate)}</td>
                  <td>
                    {g.stageLabel}（{(g.stageTarget * 100).toFixed(0)}%）
                  </td>
                  <td>{g.nextStageLabel ?? '—'}</td>
                  <td>{pct(g.coverage)}</td>
                  <td>
                    <Badge tone={g.status === 'met' ? 'green' : g.status === 'not_met' ? 'red' : 'amber'}>{g.message}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === '数据质量' ? (
        <Card className="overflow-auto p-0">
          <table className="data">
            <thead>
              <tr>
                <th>单位</th>
                <th>人员</th>
                <th>字段</th>
                <th>原始值</th>
                <th>问题类型</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {db.issues
                .filter((i) => i.class === 'data_quality')
                .map((i) => (
                  <tr key={i.id}>
                    <td>{i.orgId ? orgPath(db, i.orgId) : '—'}</td>
                    <td>{db.people.find((p) => p.id === i.personId)?.name ?? '—'}</td>
                    <td>{i.field ?? '—'}</td>
                    <td>{i.originalValue ?? '—'}</td>
                    <td>{i.title}</td>
                    <td>{ISSUE_STATUS[i.status]}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === '整改闭环' ? (
        <Card className="overflow-auto p-0">
          <table className="data">
            <thead>
              <tr>
                <th>编号</th>
                <th>责任单位</th>
                <th>类型</th>
                <th>发现</th>
                <th>期限</th>
                <th>状态</th>
                <th>整改人</th>
                <th>复核人</th>
                <th>销项</th>
              </tr>
            </thead>
            <tbody>
              {db.issues.map((i) => (
                <tr key={i.id}>
                  <td>{i.code}</td>
                  <td>{i.orgId ? orgPath(db, i.orgId) : '—'}</td>
                  <td>{ISSUE_CLASS[i.class]}</td>
                  <td>{i.foundAt}</td>
                  <td>{i.dueDate ?? '—'}</td>
                  <td>{ISSUE_STATUS[i.status]}</td>
                  <td>{db.users.find((u) => u.id === i.assigneeId)?.name ?? '—'}</td>
                  <td>{db.users.find((u) => u.id === i.reviewerId)?.name ?? '—'}</td>
                  <td>{i.closedAt?.replace('T', ' ').slice(0, 16) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === '审计日志' ? (
        <Card className="overflow-auto p-0">
          <table className="data">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>动作</th>
                <th>对象</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {db.audit.map((a) => (
                <tr key={a.id}>
                  <td>{a.at.replace('T', ' ').slice(0, 19)}</td>
                  <td>{a.actorName}</td>
                  <td>{a.action}</td>
                  <td>{a.target}</td>
                  <td className="max-w-xl truncate">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === '单位综合' ? (
        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold">人员判定明细（口径核对）</div>
          <table className="data">
            <thead>
              <tr>
                <th>人员</th>
                <th>判定</th>
                <th>强制证项</th>
                <th>原因摘要</th>
              </tr>
            </thead>
            <tbody>
              {calc.personResults.map((r) => {
                const p = db.people.find((x) => x.id === r.personId)!
                return (
                  <tr key={p.id}>
                    <td>
                      {p.name} {p.employeeNo}
                    </td>
                    <td>
                      <Badge tone={judgeTone(r.judgement)}>{JUDGE[r.judgement]}</Badge>
                    </td>
                    <td>{r.requiredItems.filter((i) => !i.incentive).length}</td>
                    <td className="max-w-lg truncate text-slate-500">{r.qualityReasons[0] || r.explanation[0]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  )
}

function daysLeft(asOf: string, to: string) {
  const a = Date.parse(asOf + 'T00:00:00')
  const b = Date.parse(to + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}
