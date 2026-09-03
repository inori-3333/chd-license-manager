import { Link } from 'react-router-dom'
import { Card, Badge, SectionTitle, judgeTone } from '../components/ui'
import { currentUser, liveCalc, useDb, visibleOrgIds } from '../store'
import { ISSUE_CLASS, ISSUE_STATUS, JUDGE, pct } from '../format'
import { orgPath } from '../engine/org'

export function Workbench() {
  const db = useDb()
  const calc = liveCalc(db)
  const scope = visibleOrgIds(db)
  const user = currentUser(db)
  const inScope = (orgId?: string, personId?: string) => {
    if (!scope) return true
    if (orgId && scope.has(orgId)) return true
    if (personId) {
      const asg = db.assignments.find((a) => a.personId === personId && a.kind === 'primary')
      return asg ? scope.has(asg.orgId) : false
    }
    return false
  }

  const issues = db.issues.filter((i) => i.status !== 'closed' && inScope(i.orgId, i.personId))
  const pendingNames = db.mappings.filter((m) => m.status === 'pending')
  const missingScopePeople = calc.personResults.filter((r) => r.qualityReasons.some((q) => q.includes('作业范围') || q.includes('无法判定')) && inScope(undefined, r.personId))
  const unit = calc.unitStats.find((u) => u.orgId === user.orgScopeId) ?? calc.stats

  const todo = [
    { k: '待补作业范围/数据', n: missingScopePeople.length, to: '/personnel' },
    { k: '待确认名称', n: pendingNames.length, to: '/standardize' },
    { k: '合规问题', n: issues.filter((i) => i.class === 'compliance').length, to: '/issues' },
    { k: '临期证书', n: issues.filter((i) => i.class === 'risk').length, to: '/issues' },
    { k: '待整改', n: issues.filter((i) => i.status === 'open').length, to: '/remediation' },
    { k: '待提交复核', n: issues.filter((i) => i.status === 'remediating').length, to: '/remediation' },
    { k: '被驳回/待销项', n: issues.filter((i) => i.status === 'resolved_pending_close').length, to: '/remediation' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">基层单位工作台</h1>
        <p className="mt-1 text-sm text-slate-500">
          回答「我现在需要处理什么」。当前身份：{user.name}（{user.title}）
          {user.orgScopeId ? '，数据范围已限制为本单位。' : '，可查看全公司。'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {todo.map((t) => (
          <Link key={t.k} to={t.to} className="card p-3 hover:border-teal-300">
            <div className="text-xs text-slate-500">{t.k}</div>
            <div className="text-2xl font-semibold">{t.n}</div>
          </Link>
        ))}
      </div>

      <Card className="p-4">
        <SectionTitle>本单位持证统计</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>应纳管 {('managed' in unit ? unit.managed : calc.stats.managed) as number}</div>
          <div>人员合规率 {pct('personRate' in unit ? unit.personRate : calc.stats.personRate)}</div>
          <div>证项完成率 {pct('itemRate' in unit ? unit.itemRate : calc.stats.itemRate)}</div>
          <div>覆盖率 {pct('coverage' in unit ? unit.coverage : calc.stats.coverage)}</div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>最新问题</SectionTitle>
          <table className="data">
            <thead>
              <tr>
                <th>问题</th>
                <th>类别</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {issues.slice(0, 8).map((i) => (
                <tr key={i.id}>
                  <td>
                    <div className="font-medium">{i.title}</div>
                    <div className="text-[11px] text-slate-400">{i.orgId ? orgPath(db, i.orgId) : ''}</div>
                  </td>
                  <td>{ISSUE_CLASS[i.class]}</td>
                  <td>
                    <Badge tone={i.class === 'compliance' ? 'red' : i.class === 'risk' ? 'amber' : 'blue'}>{ISSUE_STATUS[i.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="p-4">
          <SectionTitle>人员判定（本范围）</SectionTitle>
          <table className="data">
            <thead>
              <tr>
                <th>人员</th>
                <th>判定</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {calc.personResults
                .filter((r) => inScope(undefined, r.personId))
                .slice(0, 8)
                .map((r) => {
                  const p = db.people.find((x) => x.id === r.personId)!
                  return (
                    <tr key={r.personId}>
                      <td>
                        {p.name} <span className="text-slate-400">{p.employeeNo}</span>
                      </td>
                      <td>
                        <Badge tone={judgeTone(r.judgement)}>{JUDGE[r.judgement]}</Badge>
                      </td>
                      <td className="max-w-xs truncate text-slate-500">{r.qualityReasons[0] || r.explanation[0] || '—'}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
