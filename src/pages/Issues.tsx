import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Empty, FocusTabs, Modal, Pager, PAGE_SIZE, PageHeader, SearchField, issueTone } from '../components/ui'
import { can, issueInScope, startRemediation, useDb } from '../store'
import { ISSUE_CLASS, ISSUE_STATUS } from '../format'
import { orgPath } from '../engine/org'
import type { Issue, IssueClass } from '../types'

const TABS: Array<{ id: IssueClass | 'all'; label: string }> = [
  { id: 'compliance', label: '合规问题' },
  { id: 'risk', label: '风险预警' },
  { id: 'data_quality', label: '数据质量' },
  { id: 'all', label: '全部' },
]

export function Issues() {
  const db = useDb()
  const [tab, setTab] = useState<IssueClass | 'all'>('compliance')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<Issue | null>(null)

  const scoped = useMemo(() => db.issues.filter((i) => issueInScope(i, db)), [db])

  const rows = useMemo(() => {
    return scoped.filter((i) => {
      if (i.status === 'closed') return false
      if (tab !== 'all' && i.class !== tab) return false
      if (q && !`${i.title}${i.code}${i.rationale}`.includes(q)) return false
      return true
    })
  }, [scoped, tab, q])

  const openScoped = scoped.filter((i) => i.status !== 'closed')
  const counts = {
    all: openScoped.length,
    data_quality: openScoped.filter((i) => i.class === 'data_quality').length,
    risk: openScoped.filter((i) => i.class === 'risk').length,
    compliance: openScoped.filter((i) => i.class === 'compliance').length,
  }

  return (
    <div className="space-y-5">
      <PageHeader title="问题中心" />
      <Card className="data-workspace p-0">
        <div className="workspace-toolbar">
          <FocusTabs
            label="问题类型"
            value={tab}
            onChange={(next) => { setTab(next as IssueClass | 'all'); setPage(1) }}
            items={TABS.map((item) => ({
              ...item,
              count: counts[item.id],
              tone: item.id === 'compliance' ? 'red' : item.id === 'risk' ? 'amber' : item.id === 'data_quality' ? 'blue' : undefined,
            }))}
          />
          <SearchField
            value={q}
            onChange={(next) => { setQ(next); setPage(1) }}
            label="搜索问题"
            placeholder="搜索问题或判定依据"
          />
        </div>
        <div className="table-scroll">
        <table className="data" aria-label="待处理问题列表">
          <thead>
            <tr>
              <th>问题</th>
              <th>类型 / 程度</th>
              <th>涉及范围</th>
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
                  <td><div className="font-medium">{i.title}</div><div className="mt-1 font-mono text-[10px] text-slate-400">{i.code}</div></td>
                  <td>
                    <Badge tone={issueTone(i.class)}>{ISSUE_CLASS[i.class]}</Badge>
                    <div className="mt-1 text-[11px] text-slate-400">{severity(i.severity)}</div>
                  </td>
                  <td><div>{person ? `${person.name} ${person.employeeNo}` : '—'}</div><div className="mt-1 max-w-md truncate text-[11px] text-slate-400">{i.orgId ? orgPath(db, i.orgId) : '—'}</div>{rule ? <div className="mt-1 text-[10px] text-slate-400">{rule.code} v{i.ruleVersion ?? rule.version}</div> : null}</td>
                  <td>
                    <Badge tone={i.status === 'closed' ? 'green' : i.status === 'open' ? 'red' : 'amber'}>{ISSUE_STATUS[i.status]}</Badge>
                  </td>
                  <td>
                    <Button onClick={() => setSel(i)}>依据</Button>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 ? <tr><td colSpan={5}><Empty>当前视图共 0 个问题</Empty></td></tr> : null}
          </tbody>
        </table>
        </div>
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
