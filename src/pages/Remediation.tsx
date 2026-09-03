import { useState } from 'react'
import { Badge, Button, Card, Modal, issueTone } from '../components/ui'
import {
  assignReviewer,
  can,
  currentUser,
  reviewIssue,
  startRemediation,
  submitRemediation,
  useDb,
  visibleOrgIds,
} from '../store'
import { ISSUE_CLASS, ISSUE_STATUS } from '../format'
import { orgPath } from '../engine/org'
import type { Issue } from '../types'

const COLS: Array<{ id: Issue['status']; title: string }> = [
  { id: 'open', title: '待整改' },
  { id: 'remediating', title: '整改中' },
  { id: 'pending_review', title: '待复核' },
  { id: 'resolved_pending_close', title: '已消除待销项' },
  { id: 'closed', title: '已销项' },
]

export function Remediation() {
  const db = useDb()
  const user = currentUser(db)
  const scope = visibleOrgIds(db)
  const [sel, setSel] = useState<Issue | null>(null)
  const [comment, setComment] = useState('')
  const [reviewerId, setReviewerId] = useState(db.users.find((u) => u.role === 'reviewer')?.id ?? '')

  const issues = db.issues.filter((i) => {
    if (scope && i.orgId && !scope.has(i.orgId)) return false
    return true
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">整改闭环</h1>
        <p className="mt-1 text-sm text-slate-500">
          基层单位不得自行销项。流程：待整改 → 整改中 → 待复核 → 指定复核人通过后销项。销项后重新计算，校验问题是否真正消除。
        </p>
      </div>
      <div className="grid gap-3 xl:grid-cols-5">
        {COLS.map((col) => {
          const list = issues.filter((i) => i.status === col.id)
          return (
            <Card key={col.id} className="p-3">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                {col.title}
                <span className="text-slate-400">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.slice(0, 12).map((i) => (
                  <button
                    key={i.id}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-left text-xs hover:border-teal-300"
                    onClick={() => {
                      setSel(i)
                      setComment('')
                    }}
                  >
                    <div className="font-medium text-slate-800">{i.title}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <Badge tone={issueTone(i.class)}>{ISSUE_CLASS[i.class]}</Badge>
                      <span className="text-slate-400">{i.code}</span>
                    </div>
                  </button>
                ))}
                {list.length === 0 ? <div className="py-6 text-center text-xs text-slate-400">无</div> : null}
              </div>
            </Card>
          )
        })}
      </div>

      {sel ? (
        <Modal wide title={`${sel.code} · ${ISSUE_STATUS[sel.status]}`} onClose={() => setSel(null)}>
          <div className="space-y-3 text-sm">
            <div className="font-semibold">{sel.title}</div>
            <div className="text-slate-500">{sel.orgId ? orgPath(db, sel.orgId) : ''}</div>
            <div className="rounded-lg bg-slate-50 p-3 leading-6">{sel.rationale}</div>
            <div>
              <div className="mb-1 font-semibold">整改过程</div>
              <ul className="space-y-1">
                {db.remediations
                  .filter((r) => r.issueId === sel.id)
                  .map((r) => (
                    <li key={r.id} className="rounded border border-slate-100 px-2 py-1">
                      <span className="text-slate-400">{r.at.replace('T', ' ').slice(0, 16)}</span> · {r.by} · {r.action}
                      <div>{r.comment}</div>
                    </li>
                  ))}
                {db.remediations.filter((r) => r.issueId === sel.id).length === 0 ? <li className="text-slate-400">尚无记录</li> : null}
              </ul>
            </div>
            <textarea className="textarea" placeholder="处理意见 / 整改说明" value={comment} onChange={(e) => setComment(e.target.value)} />

            {user.role === 'unit' && (sel.status === 'open' || sel.status === 'remediating' || sel.status === 'resolved_pending_close') ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                当前角色是基层单位管理员，可以整改和提交复核，但不能销项。
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {sel.status === 'open' && can('remediate') ? (
                <Button
                  kind="primary"
                  onClick={() => {
                    startRemediation(sel.id, comment || '开始整改')
                    setSel(null)
                  }}
                >
                  开始整改
                </Button>
              ) : null}
              {sel.status === 'remediating' && can('remediate') ? (
                <Button
                  kind="primary"
                  onClick={() => {
                    submitRemediation(sel.id, comment || '已完成整改，提交复核')
                    setSel(null)
                  }}
                >
                  提交复核
                </Button>
              ) : null}
              {can('assign_reviewer') && sel.status !== 'closed' ? (
                <>
                  <select className="select" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
                    {db.users
                      .filter((u) => u.role === 'reviewer' || u.role === 'hr' || u.role === 'admin')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} · {u.title}
                        </option>
                      ))}
                  </select>
                  <Button
                    onClick={() => {
                      assignReviewer(sel.id, reviewerId, comment || `指定复核人`)
                      setSel(null)
                    }}
                  >
                    指定复核人
                  </Button>
                </>
              ) : null}
              {can('review_issue') && (sel.status === 'pending_review' || sel.status === 'resolved_pending_close') ? (
                <>
                  <Button
                    kind="primary"
                    onClick={() => {
                      reviewIssue(sel.id, true, comment || '复核通过，问题已消除')
                      setSel(null)
                    }}
                  >
                    复核通过并销项
                  </Button>
                  <Button
                    kind="danger"
                    onClick={() => {
                      reviewIssue(sel.id, false, comment || '材料不足，驳回整改')
                      setSel(null)
                    }}
                  >
                    复核驳回
                  </Button>
                </>
              ) : null}
              {!can('review_issue') && !can('remediate') && !can('assign_reviewer') ? (
                <span className="text-slate-400">当前角色仅可查看。</span>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
