import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, PageHeader, ProgressiveSection, SectionTitle, judgeTone } from '../components/ui'
import { currentUser, liveCalc, useDb, visibleOrgIds } from '../store'
import { ISSUE_CLASS, ISSUE_STATUS, JUDGE, pct } from '../format'
import { orgPath } from '../engine/org'

export function Workbench() {
  const db = useDb()
  const calc = liveCalc(db)
  const scope = visibleOrgIds(db)
  const user = currentUser(db)
  const [view, setView] = useState<'issues' | 'people'>('issues')
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
  const activeTodo = todo.filter((item) => item.n > 0).sort((a, b) => b.n - a.n)

  return (
    <div className="space-y-5">
      <PageHeader
        title="基层单位工作台"
        meta={<><span>{user.name} · {user.title}</span><span>{activeTodo.length} 类待办</span></>}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {activeTodo.slice(0, 4).map((t) => <Link key={t.k} to={t.to} className="attention-item card"><span>{t.k}</span><strong>{t.n}</strong></Link>)}
      </div>

      <dl className="metric-strip">
        <div><dt>应纳管</dt><dd>{('managed' in unit ? unit.managed : calc.stats.managed) as number}</dd></div>
        <div><dt>人员合规率</dt><dd>{pct('personRate' in unit ? unit.personRate : calc.stats.personRate)}</dd></div>
        <div><dt>证项完成率</dt><dd>{pct('itemRate' in unit ? unit.itemRate : calc.stats.itemRate)}</dd></div>
        <div><dt>统计覆盖率</dt><dd>{pct('coverage' in unit ? unit.coverage : calc.stats.coverage)}</dd></div>
      </dl>

      <Card className="p-4">
        <SectionTitle extra={<div className="view-switcher"><button className={view === 'issues' ? 'active' : ''} onClick={() => setView('issues')}>最新问题</button><button className={view === 'people' ? 'active' : ''} onClick={() => setView('people')}>人员判定</button></div>}>处理线索</SectionTitle>
        {view === 'issues' ? (
        <Card className="p-4">
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
        ) : (
        <Card className="p-4">
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
        )}
      </Card>

      {activeTodo.length > 4 ? (
        <ProgressiveSection title="其他待办" summary={`${activeTodo.length - 4} 类低优先事项`}>
          <div className="grid gap-3 md:grid-cols-3">
            {activeTodo.slice(4).map((t) => <Link key={t.k} to={t.to} className="attention-item"><span>{t.k}</span><strong>{t.n}</strong></Link>)}
          </div>
        </ProgressiveSection>
      ) : null}
    </div>
  )
}
