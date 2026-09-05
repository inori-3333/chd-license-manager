import { useState } from 'react'
import { Badge, Button, Card, Modal, Pager, PAGE_SIZE, PageHeader, ProgressiveSection, judgeTone } from '../components/ui'
import { confirmWorkScope, currentUser, liveCalc, useDb, visibleOrgIds } from '../store'
import { ITEM_STATUS, JUDGE } from '../format'
import { assignmentsAt } from '../engine/calculate'
import { orgPath } from '../engine/org'

export function Personnel() {
  const db = useDb()
  const calc = liveCalc(db)
  const scope = visibleOrgIds(db)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'attention' | 'all' | 'compliant'>('attention')
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<string | null>(null)
  const rows = calc.personResults.filter((r) => {
    const p = db.people.find((x) => x.id === r.personId)
    if (!p) return false
    if (scope) {
      const asg = db.assignments.find((a) => a.personId === p.id)
      if (!asg || !scope.has(asg.orgId)) return false
    }
    if (filter === 'attention' && r.judgement === 'compliant') return false
    if (filter === 'compliant' && r.judgement !== 'compliant') return false
    if (q && !`${p.name}${p.employeeNo}`.includes(q)) return false
    return true
  })
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const person = sel ? db.people.find((p) => p.id === sel) : undefined
  const result = sel ? calc.personResults.find((r) => r.personId === sel) : undefined

  return (
    <div className="space-y-5">
      <PageHeader
        title="人员持证详情"
        meta={<><span>{rows.length} 人符合当前条件</span><span>判定依据可追溯至规则版本</span></>}
        action={<input
          className="input"
          placeholder="搜索姓名/工号"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />}
      />
      <div className="view-switcher" aria-label="人员范围">
        <button className={filter === 'attention' ? 'active' : ''} onClick={() => { setFilter('attention'); setPage(1) }}>需要关注</button>
        <button className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); setPage(1) }}>全部人员</button>
        <button className={filter === 'compliant' ? 'active' : ''} onClick={() => { setFilter('compliant'); setPage(1) }}>合规</button>
      </div>
      <Card className="overflow-auto p-0">
        <table className="data personnel-table">
          <thead>
            <tr>
              <th>工号</th>
              <th>姓名</th>
              <th>组织</th>
              <th>原始岗位</th>
              <th>标准岗位</th>
              <th>判定</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const p = db.people.find((x) => x.id === r.personId)!
              const asg = assignmentsAt(db, p.id, db.asOfDate)[0]
              const job = asg?.standardJobId ? db.jobs.find((j) => j.id === asg.standardJobId) : undefined
              return (
                <tr key={p.id}>
                  <td>{p.employeeNo}</td>
                  <td>{p.name}</td>
                  <td>{asg ? orgPath(db, asg.orgId) : '—'}</td>
                  <td>{asg?.originalJobName}</td>
                  <td>{job?.name ?? <span className="text-amber-700">未标准化</span>}</td>
                  <td>
                    <Badge tone={judgeTone(r.judgement)}>{JUDGE[r.judgement]}</Badge>
                  </td>
                  <td>
                    <Button onClick={() => setSel(p.id)}>详情</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Pager page={page} total={rows.length} onPage={setPage} />
      </Card>
      {person && result ? <PersonDetail personId={person.id} onClose={() => setSel(null)} /> : null}
    </div>
  )
}

function PersonDetail({ personId, onClose }: { personId: string; onClose: () => void }) {
  const db = useDb()
  const calc = liveCalc(db)
  const person = db.people.find((p) => p.id === personId)!
  const result = calc.personResults.find((r) => r.personId === personId)!
  const asg = db.assignments.filter((a) => a.personId === personId)
  const holds = db.holdings.filter((h) => h.personId === personId)
  const scopes = db.personWorkScopes.filter((s) => s.personId === personId)
  const [tag, setTag] = useState(db.workScopeTags[0].id)
  const user = currentUser(db)

  return (
    <Modal wide title={`${person.name} · ${person.employeeNo}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex gap-2">
          <Badge tone={judgeTone(result.judgement)}>{JUDGE[result.judgement]}</Badge>
          <span className="text-slate-400">身份证 {person.idMasked}（脱敏）</span>
        </div>
        <ProgressiveSection title="任职历史" summary={`${asg.length} 条记录 · 原始值保留`}>
          <table className="data">
            <thead>
              <tr>
                <th>组织</th>
                <th>原始岗位</th>
                <th>标准岗位</th>
                <th>类型</th>
                <th>期间</th>
              </tr>
            </thead>
            <tbody>
              {asg.map((a) => (
                <tr key={a.id}>
                  <td>
                    {orgPath(db, a.orgId)}
                    <div className="text-[11px] text-slate-400">原始组织 {a.originalOrgName}</div>
                  </td>
                  <td>{a.originalJobName}</td>
                  <td>{db.jobs.find((j) => j.id === a.standardJobId)?.name ?? '未标准化'}</td>
                  <td>{a.kind === 'primary' ? '主岗' : '兼岗'}</td>
                  <td>
                    {a.startDate} ~ {a.endDate ?? '至今'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ProgressiveSection>
        <section>
          <h4 className="mb-1 font-semibold">作业 / 职责范围</h4>
          <ul className="mb-2 list-disc pl-5">
            {scopes.map((s) => (
              <li key={s.id}>
                {db.workScopeTags.find((t) => t.id === s.tagId)?.name} · {s.confirmed ? `已确认（${s.confirmedBy}）` : '未确认'} · {s.startDate}
              </li>
            ))}
            {scopes.length === 0 ? <li className="text-amber-700">待补充作业 / 职责范围</li> : null}
          </ul>
          {user.role === 'unit' || user.role === 'admin' || user.role === 'hr' ? (
            <div className="flex gap-2">
              <select className="select" value={tag} onChange={(e) => setTag(e.target.value)}>
                {db.workScopeTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button kind="primary" onClick={() => confirmWorkScope(personId, tag)}>
                确认补充
              </Button>
            </div>
          ) : null}
        </section>
        <ProgressiveSection title="持证记录" summary={`${holds.length} 张证书`}>
          <table className="data">
            <thead>
              <tr>
                <th>原始证书</th>
                <th>标准证书</th>
                <th>编号</th>
                <th>有效期</th>
                <th>复审</th>
              </tr>
            </thead>
            <tbody>
              {holds.map((h) => (
                <tr key={h.id}>
                  <td>{h.originalName}</td>
                  <td>{db.certificates.find((c) => c.id === h.standardCertId)?.name ?? '未标准化'}</td>
                  <td>{h.certNo}</td>
                  <td>
                    {h.validFrom} ~ {h.validTo ?? '长期'}
                  </td>
                  <td>{h.reviewDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ProgressiveSection>
        <ProgressiveSection title="应持证项与判定依据" summary={`${result.requiredItems.length} 个证项`} defaultOpen={result.judgement !== 'compliant'}>
          {result.requiredItems.length === 0 ? <p className="text-slate-400">当前应持证项 0</p> : null}
          {result.requiredItems.map((i, idx) => (
            <div key={idx} className="mb-2 rounded-lg border border-slate-200 p-2">
              <div className="flex items-center justify-between">
                <span>
                  {i.certificateName} · {i.ruleName} v{i.ruleVersion}
                  {i.incentive ? '（激励类）' : ''}
                </span>
                <Badge tone={i.status === 'satisfied' ? 'green' : i.status === 'unknown' || i.status === 'in_transition' ? 'amber' : 'red'}>
                  {ITEM_STATUS[i.status]}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-slate-500">{i.explanation}</div>
              {i.sources && i.sources.length > 1 ? (
                <div className="mt-1 text-[11px] text-slate-400">
                  合并触发来源：{i.sources.map((s) => `${s.ruleName} v${s.ruleVersion}`).join('；')}
                </div>
              ) : null}
            </div>
          ))}
          <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-600">
            {result.explanation.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
            {result.qualityReasons.map((e, i) => (
              <div key={'q' + i} className="text-amber-700">
                {e}
              </div>
            ))}
          </div>
        </ProgressiveSection>
      </div>
    </Modal>
  )
}
