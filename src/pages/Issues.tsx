import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Modal, Pager, PAGE_SIZE, issueTone } from '../components/ui'
import { can, startRemediation, useDb, visibleOrgIds } from '../store'
import { ISSUE_CLASS, ISSUE_STATUS } from '../format'
import { orgPath } from '../engine/org'
import type { Issue, IssueClass } from '../types'

const TABS: Array<{ id: IssueClass | 'all'; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'data_quality', label: '数据质量' },
  { id: 'risk', label: '风险预警' },
  { id: 'compliance', label: '合规问题' },
]

export function Issues() {
  const db = useDb()
  const scope = visibleOrgIds(db)
  const [tab, setTab] = useState<IssueClass | 'all'>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<Issue | null>(null)

  const rows = useMemo(() => {
    return db.issues.filter((i) => {
      if (i.status === 'closed') return tab === 'all'
      if (scope && i.orgId && !scope.has(i.orgId)) return false
      if (tab !== 'all' && i.class !== tab) return false
      if (q && !`${i.title}${i.code}${i.rationale}`.includes(q)) return false
      return true
    })
  }, [db.issues, scope, tab, q])

  const counts = {
    all: db.issues.filter((i) => i.status !== 'closed').length,
    data_quality: db.issues.filter((i) => i.class === 'data_quality' && i.status !== 'closed').length,
    risk: db.issues.filter((i) => i.class === 'risk' && i.status !== 'closed').length,
    compliance: db.issues.filter((i) => i.class === 'compliance' && i.status !== 'closed').length,
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">校验 / 预警问题中心</h1>
        <p className="mt-1 text-sm text-slate-500">
          三类问题分开列示，避免把所有东西都叫预警。数据质量表示「暂时没有足够证据做正式判断」；风险预警表示尚未违规但临近；合规问题表示已不满足正式要求。
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            kind={tab === t.id ? 'primary' : 'ghost'}
            onClick={() => {
              setTab(t.id)
              setPage(1)
            }}
          >
            {t.label} ({counts[t.id]})
          </Button>
        ))}
        <input
          className="input ml-auto"
          placeholder="搜索问题/依据"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
      </div>
      <Card className="overflow-auto p-0">
        <table className="data">
          <thead>
            <tr>
              <th>编号</th>
              <th>问题</th>
              <th>类别</th>
              <th>严重程度</th>
              <th>单位</th>
              <th>人员</th>
              <th>规则</th>
              <th>状态</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((i) => {
              const person = db.people.find((p) => p.id === i.personId)
              const rule = db.rules.find((r) => r.id === i.ruleId)
              return (
                <tr key={i.id}>
                  <td className="font-mono text-xs">{i.code}</td>
                  <td className="font-medium">{i.title}</td>
                  <td>
                    <Badge tone={issueTone(i.class)}>{ISSUE_CLASS[i.class]}</Badge>
                  </td>
                  <td>{severity(i.severity)}</td>
                  <td>{i.orgId ? orgPath(db, i.orgId) : '—'}</td>
                  <td>{person ? `${person.name} ${person.employeeNo}` : '—'}</td>
                  <td>{rule ? `${rule.code} v${i.ruleVersion ?? rule.version}` : '—'}</td>
                  <td>
                    <Badge tone={i.status === 'closed' ? 'green' : i.status === 'open' ? 'red' : 'amber'}>{ISSUE_STATUS[i.status]}</Badge>
                  </td>
                  <td>
                    <Button onClick={() => setSel(i)}>依据</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Pager page={page} total={rows.length} onPage={setPage} />
      </Card>

      {sel ? (
        <Modal wide title={`${sel.code} · ${sel.title}`} onClose={() => setSel(null)}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Item k="类别" v={ISSUE_CLASS[sel.class]} />
            <Item k="状态" v={ISSUE_STATUS[sel.status]} />
            <Item k="发现时点" v={sel.foundAt} />
            <Item k="整改期限" v={sel.dueDate ?? '—'} />
            <Item k="人员" v={personLine(db, sel.personId)} />
            <Item k="组织" v={sel.orgId ? orgPath(db, sel.orgId) : '—'} />
            <Item k="证书" v={db.certificates.find((c) => c.id === sel.certificateId)?.name ?? '—'} />
            <Item k="规则" v={ruleLine(db, sel)} />
            <Item k="原始字段" v={sel.field ? `${sel.field} = ${sel.originalValue ?? ''}` : '—'} />
            <Item k="指定复核人" v={db.users.find((u) => u.id === sel.reviewerId)?.name ?? '未指定'} />
          </dl>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            <div className="mb-1 font-semibold">判定依据</div>
            {sel.rationale}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {sel.status === 'open' && can('remediate') ? (
              <Button
                kind="primary"
                onClick={() => {
                  startRemediation(sel.id, '已接收问题，开始整改。')
                  setSel(null)
                }}
              >
                下发 / 开始整改
              </Button>
            ) : null}
            <Link className="btn btn-ghost" to="/remediation">
              去整改闭环
            </Link>
            {sel.personId ? (
              <Link className="btn btn-ghost" to="/personnel">
                查看人员持证
              </Link>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function severity(s: string) {
  return { low: '低', medium: '中', high: '高', critical: '紧急' }[s] ?? s
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{k}</div>
      <div>{v}</div>
    </div>
  )
}

function personLine(db: ReturnType<typeof useDb>, id?: string) {
  const p = db.people.find((x) => x.id === id)
  return p ? `${p.name}（${p.employeeNo}）` : '—'
}

function ruleLine(db: ReturnType<typeof useDb>, sel: Issue) {
  const r = db.rules.find((x) => x.id === sel.ruleId)
  if (!r) return '—'
  return `${r.name} v${sel.ruleVersion ?? r.version}`
}
