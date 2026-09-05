import { useState, type ReactNode } from 'react'
import { Badge, Button, Card, Empty, FocusTabs, Modal, PAGE_SIZE, PageHeader, Pager, SearchField } from '../components/ui'
import {
  ackConflict,
  can,
  conflictsOf,
  newDraftRule,
  previewRule,
  reviewRule,
  saveRule,
  submitRule,
  useDb,
} from '../store'
import { CERT_CAT, RULE_STATUS, RULE_TYPE } from '../format'
import { explainCondition, isGroup } from '../engine/eval'
import type { Condition, ConditionGroup, Rule, SimulationReport } from '../types'

const FIELDS: Array<{ id: Condition['field']; label: string }> = [
  { id: 'job_category', label: '岗位类别' },
  { id: 'standard_job_id', label: '标准岗位' },
  { id: 'work_scope', label: '作业范围' },
  { id: 'duty_tag', label: '职责标签' },
  { id: 'major', label: '专业' },
  { id: 'job_tag', label: '岗位标签' },
  { id: 'is_production', label: '生产岗位' },
  { id: 'org_id', label: '组织' },
  { id: 'org_type', label: '组织类型' },
  { id: 'person_status', label: '人员状态' },
  { id: 'assignment_start', label: '任职开始' },
  { id: 'work_scope_start', label: '作业开始' },
]

type RuleView = 'attention' | 'active' | 'draft' | 'all'

export function Rules() {
  const db = useDb()
  const rules = db.rules.slice().sort((a, b) => a.code.localeCompare(b.code) || b.version - a.version)
  const needsAction = (rule: Rule) =>
    (rule.status === 'pending_review' && can('approve_rule'))
    || (rule.status === 'draft' && (can('submit_rule') || can('edit_rule')))
  const attentionCount = rules.filter(needsAction).length
  const [edit, setEdit] = useState<Rule | null>(null)
  const [sim, setSim] = useState<SimulationReport | null>(null)
  const [msg, setMsg] = useState('')
  const [view, setView] = useState<RuleView>(attentionCount ? 'attention' : 'active')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const visibleRules = rules.filter((rule) => {
    if (view === 'attention' && !needsAction(rule)) return false
    if (view === 'active' && rule.status !== 'active') return false
    if (view === 'draft' && rule.status !== 'draft') return false
    const keyword = query.trim().toLowerCase()
    return !keyword || `${rule.code}${rule.name}${RULE_TYPE[rule.type]}${CERT_CAT[rule.certCategory]}`.toLowerCase().includes(keyword)
  })

  function statusTone(s: string) {
    if (s === 'active') return 'green' as const
    if (s === 'pending_review' || s === 'pending_effective') return 'amber' as const
    if (s === 'draft') return 'blue' as const
    return 'slate' as const
  }

  return (
    <div className="space-y-5">
      <PageHeader title="规则中心" action={can('edit_rule') ? <Button kind="primary" onClick={() => setEdit(newDraftRule())}>新建草稿</Button> : undefined} />
      {msg ? <div role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{msg}</div> : null}
      <Card className="data-workspace p-0">
        <div className="workspace-toolbar">
          <FocusTabs
            label="规则范围"
            value={view}
            onChange={(next) => { setView(next as RuleView); setPage(1) }}
            items={[
              { id: 'attention', label: '待我处理', count: attentionCount, tone: 'amber' },
              { id: 'active', label: '生效中', count: rules.filter((rule) => rule.status === 'active').length, tone: 'teal' },
              { id: 'draft', label: '草稿', count: rules.filter((rule) => rule.status === 'draft').length, tone: 'blue' },
              { id: 'all', label: '全部', count: rules.length },
            ]}
          />
          <SearchField
            value={query}
            onChange={(next) => { setQuery(next); setPage(1) }}
            label="搜索规则"
            placeholder="搜索规则名称或编码"
          />
        </div>

        <div className="table-scroll">
          <table className="data" aria-label="规则列表">
            <thead>
              <tr>
                <th>规则</th>
                <th>类型 / 类别</th>
                <th>版本 / 状态</th>
                <th>生效周期</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleRules.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((rule) => (
                <tr key={rule.id}>
                  <td className="min-w-64"><div className="font-medium text-slate-800">{rule.name}</div><div className="mt-1 font-mono text-[10px] text-slate-400">{rule.code}</div></td>
                  <td><div>{RULE_TYPE[rule.type]}</div><div className="mt-1 text-[11px] text-slate-400">{CERT_CAT[rule.certCategory]}</div></td>
                  <td><div className="mb-1 text-[11px] text-slate-400">v{rule.version}</div><Badge tone={statusTone(rule.status)}>{RULE_STATUS[rule.status]}</Badge></td>
                  <td>{rule.effectiveFrom} ~ {rule.effectiveTo ?? '长期'}</td>
                  <td className="space-x-1 whitespace-nowrap">
                    <Button onClick={() => setEdit({ ...rule })}>查看</Button>
                    {rule.status === 'active' && can('edit_rule') ? (
                      <Button onClick={() => setEdit({ ...rule, status: 'draft', notes: '将另存为新版本' })}>新版本</Button>
                    ) : null}
                    {rule.status === 'draft' && can('submit_rule') ? <Button onClick={() => submitRule(rule.id)}>提交审核</Button> : null}
                    {rule.status === 'pending_review' && can('approve_rule') ? (
                      <>
                        <Button
                          kind="primary"
                          onClick={() => {
                            const result = reviewRule(rule.id, true, '审核通过')
                            if (!result.ok) setMsg(result.message + (result.conflicts ? '：' + result.conflicts.items.map((item) => item.reason).join('；') : ''))
                            else setMsg('')
                          }}
                        >通过</Button>
                        <Button onClick={() => reviewRule(rule.id, false, '请补充条件说明')}>驳回</Button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
              {visibleRules.length === 0 ? <tr><td colSpan={5}><Empty>当前视图共 0 条规则</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={visibleRules.length} onPage={setPage} />
      </Card>

      {edit ? (
        <Modal wide title={`${edit.name} · ${RULE_STATUS[edit.status]}`} onClose={() => setEdit(null)}>
          <RuleEditor
            rule={edit}
            onChange={setEdit}
            onSave={() => {
              const published = db.rules.find((r) => r.id === edit.id && r.status === 'active')
              if (published && edit.status === 'draft' && edit.notes.includes('新版本')) {
                saveRule(edit, true)
              } else if (published && edit.status === 'active') {
                saveRule(edit, true)
              } else {
                saveRule(edit)
              }
              setEdit(null)
            }}
            onSim={() => setSim(previewRule(edit))}
            onAck={() => ackConflict(edit.id)}
          />
        </Modal>
      ) : null}

      {sim ? (
        <Modal title="发布前模拟" onClose={() => setSim(null)}>
          <ul className="space-y-2 text-sm">
            <li>影响人员：{sim.affectedPeople}</li>
            <li>涉及单位：{sim.affectedOrgs}</li>
            <li>新增应持人员：{sim.newRequiredPeople}</li>
            <li>预计新增问题：{sim.newIssues}</li>
            {sim.groupStatusChanges.map((g, i) => (
              <li key={i}>
                {g.orgName} 群体目标 {g.from} → {g.to}
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}
    </div>
  )
}

function RuleEditor({
  rule,
  onChange,
  onSave,
  onSim,
  onAck,
}: {
  rule: Rule
  onChange: (r: Rule) => void
  onSave: () => void
  onSim: () => void
  onAck: () => void
}) {
  const db = useDb()
  const locked = rule.status === 'active' || rule.status === 'expired' || rule.status === 'pending_effective'
  const c = detectSafe(rule)

  function setGroup(next: ConditionGroup) {
    onChange({ ...rule, condition: next })
  }

  function patchLeaf(i: number, patch: Partial<Condition>) {
    const conditions = rule.condition.conditions.map((item, idx) => {
      if (idx !== i || isGroup(item)) return item
      return { ...item, ...patch }
    })
    setGroup({ ...rule.condition, conditions })
  }

  function removeAt(i: number) {
    if (rule.condition.conditions.length <= 1) return
    setGroup({ ...rule.condition, conditions: rule.condition.conditions.filter((_, idx) => idx !== i) })
  }

  function addLeaf() {
    setGroup({
      ...rule.condition,
      conditions: [...rule.condition.conditions, { field: 'work_scope', operator: 'CONTAINS', value: '' }],
    })
  }

  return (
    <div className="space-y-3 text-sm">
      {locked ? <div className="rounded bg-amber-50 px-3 py-2 text-amber-900">已发布规则只读。如需变更请生成新版本重新审核。</div> : null}
      <div className="grid grid-cols-2 gap-3">
        <L k="名称">
          <input className="input w-full" disabled={locked} value={rule.name} onChange={(e) => onChange({ ...rule, name: e.target.value })} />
        </L>
        <L k="编码">
          <input className="input w-full" disabled={locked} value={rule.code} onChange={(e) => onChange({ ...rule, code: e.target.value })} />
        </L>
        <L k="类型">
          <select className="select w-full" disabled={locked} value={rule.type} onChange={(e) => onChange({ ...rule, type: e.target.value as Rule['type'] })}>
            {Object.entries(RULE_TYPE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </L>
        <L k="证书类别">
          <select className="select w-full" disabled={locked} value={rule.certCategory} onChange={(e) => onChange({ ...rule, certCategory: e.target.value as Rule['certCategory'] })}>
            {Object.entries(CERT_CAT).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </L>
        <L k="生效开始">
          <input className="input w-full" type="date" disabled={locked} value={rule.effectiveFrom} onChange={(e) => onChange({ ...rule, effectiveFrom: e.target.value })} />
        </L>
        <L k="过渡天数">
          <input
            className="input w-full"
            type="number"
            disabled={locked}
            value={rule.transitionDays ?? ''}
            onChange={(e) => onChange({ ...rule, transitionDays: Number(e.target.value) || undefined })}
          />
        </L>
      </div>
      <div>
        <div className="mb-1 flex items-center gap-2 text-slate-500">
          适用条件
          <select
            className="select"
            disabled={locked}
            value={rule.condition.logic}
            onChange={(e) => setGroup({ ...rule.condition, logic: e.target.value as ConditionGroup['logic'] })}
          >
            <option value="AND">全部满足（且）</option>
            <option value="OR">任一满足（或）</option>
          </select>
        </div>
        {rule.condition.conditions.map((cnd, i) =>
          isGroup(cnd) ? (
            <div key={i} className="mb-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
              嵌套组（只读）：{explainCondition(cnd)}
            </div>
          ) : (
            <div key={i} className="mb-2 flex gap-2">
              <select
                className="select"
                disabled={locked}
                value={cnd.field}
                onChange={(e) => patchLeaf(i, { field: e.target.value as Condition['field'] })}
              >
                {FIELDS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                className="select"
                disabled={locked}
                value={cnd.operator}
                onChange={(e) => patchLeaf(i, { operator: e.target.value as Condition['operator'] })}
              >
                <option value="IN">属于</option>
                <option value="NOT_IN">不属于</option>
                <option value="EQ">等于</option>
                <option value="CONTAINS">包含</option>
                <option value="BEFORE">早于</option>
                <option value="AFTER">晚于</option>
              </select>
              <input
                className="input flex-1"
                disabled={locked}
                value={Array.isArray(cnd.value) ? cnd.value.join(',') : cnd.value}
                onChange={(e) => {
                  const v = e.target.value
                  patchLeaf(i, { value: v.includes(',') ? v.split(',').map((s) => s.trim()) : v })
                }}
              />
              {!locked ? (
                <Button disabled={rule.condition.conditions.length <= 1} onClick={() => removeAt(i)}>
                  删除
                </Button>
              ) : null}
            </div>
          ),
        )}
        {!locked ? (
          <Button onClick={addLeaf}>添加条件</Button>
        ) : null}
      </div>
      <div>
        <div className="mb-1 text-slate-500">证书要求</div>
        {rule.requirement.items.map((it, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <select
              className="select flex-1"
              disabled={locked}
              value={it.certificateId}
              onChange={(e) => {
                const items = [...rule.requirement.items]
                items[i] = { ...it, certificateId: e.target.value }
                onChange({ ...rule, requirement: { ...rule.requirement, items } })
              }}
            >
              {db.certificates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              className="input w-28"
              placeholder="最低等级"
              disabled={locked}
              value={it.minGradeOrder ?? ''}
              onChange={(e) => {
                const items = [...rule.requirement.items]
                items[i] = { ...it, minGradeOrder: Number(e.target.value) || undefined }
                onChange({ ...rule, requirement: { ...rule.requirement, items } })
              }}
            />
            {!locked ? (
              <Button
                disabled={rule.requirement.items.length <= 1}
                onClick={() =>
                  onChange({
                    ...rule,
                    requirement: { ...rule.requirement, items: rule.requirement.items.filter((_, idx) => idx !== i) },
                  })
                }
              >
                删除
              </Button>
            ) : null}
          </div>
        ))}
        {!locked ? (
          <Button
            onClick={() =>
              onChange({
                ...rule,
                requirement: {
                  ...rule.requirement,
                  items: [...rule.requirement.items, { certificateId: db.certificates[0]?.id }],
                },
              })
            }
          >
            添加证书
          </Button>
        ) : null}
      </div>
      {rule.type === 'group_ratio' ? (
        <div>
          <div className="mb-1 text-slate-500">阶段目标</div>
          {(rule.stages ?? []).map((st, i) => (
            <div key={i} className="text-xs text-slate-600">
              {st.label}（截至 {st.until}，{(st.target * 100).toFixed(0)}%）
            </div>
          ))}
        </div>
      ) : null}
      <L k="说明">
        <textarea className="textarea resize-none" disabled={locked} value={rule.notes} onChange={(e) => onChange({ ...rule, notes: e.target.value })} />
      </L>
      {c.conflicting ? (
        <div className="rounded border border-rose-200 bg-rose-50 p-3 text-rose-900">
          <div className="font-semibold">发现潜在冲突</div>
          {c.items.map((i) => (
            <div key={i.ruleId} className="text-xs">
              {i.ruleName}：{i.reason}
            </div>
          ))}
          {!locked ? <Button onClick={onAck}>确认后继续提交</Button> : null}
        </div>
      ) : null}
      <div className="flex gap-2">
        {!locked && can('edit_rule') ? (
          <Button kind="primary" onClick={onSave}>
            保存草稿
          </Button>
        ) : null}
        <Button onClick={onSim}>模拟运行</Button>
      </div>
    </div>
  )
}

function detectSafe(rule: Rule) {
  try {
    return conflictsOf(rule)
  } catch {
    return { conflicting: false, items: [] }
  }
}

function L({ k, children }: { k: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-slate-500">{k}</div>
      {children}
    </label>
  )
}
