import { useMemo, useState } from 'react'
import { AlertTriangle, BookOpenCheck, ShieldCheck } from 'lucide-react'
import { Badge, Card } from '../components/ui'
import { CERT_CAT } from '../format'
import { POLICY_CONFLICTS } from '../data/policy'
import { useDb } from '../store'
import type { CertCategory } from '../types'

const FILTERS: Array<{ id: 'all' | CertCategory; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'national', label: '国家管控类' },
  { id: 'group', label: '集团管控类' },
  { id: 'incentive', label: '激励提升类' },
]

export function PolicyStandards() {
  const db = useDb()
  const [filter, setFilter] = useState<'all' | CertCategory>('all')
  const rows = useMemo(
    () => db.certificates.filter((c) => filter === 'all' || c.category === filter),
    [db.certificates, filter],
  )
  const count = (category: CertCategory) => db.certificates.filter((c) => c.category === category).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">制度标准与受控证书库</h1>
        <p className="mt-1 text-sm text-slate-500">
          依据指导意见正文及附件 1、附件 2 建立。证书分类、适用范围和比例要求均保留制度依据；存在冲突的口径不自动发布。
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Summary icon={<ShieldCheck size={18} />} label="国家管控类" value={count('national')} tone="text-rose-700" />
        <Summary icon={<BookOpenCheck size={18} />} label="集团管控类" value={count('group')} tone="text-teal-700" />
        <Summary icon={<BookOpenCheck size={18} />} label="激励提升类" value={count('incentive')} tone="text-violet-700" />
      </div>

      <Card className="border-amber-200 bg-amber-50 p-4">
        <div className="mb-3 flex items-center gap-2 font-semibold text-amber-900">
          <AlertTriangle size={18} /> 制度口径待确认（系统拒绝猜测）
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {POLICY_CONFLICTS.map((item) => (
            <div key={item.id} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
              <div className="font-semibold text-slate-800">{item.topic}</div>
              <div className="mt-2 text-slate-600">{item.bodyText}</div>
              <div className="mt-1 text-slate-600">{item.attachmentText}</div>
              <div className="mt-2 text-xs leading-5 text-amber-800">处理原则：{item.handling}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            className={`btn ${filter === item.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card className="overflow-auto p-0">
        <table className="data">
          <thead>
            <tr>
              <th>类别</th>
              <th>证书名称</th>
              <th>子类 / 等级</th>
              <th>制度适用人员范围</th>
              <th>比例 / 管理要求</th>
              <th>有效期与复审</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Badge tone={c.category === 'national' ? 'red' : c.category === 'group' ? 'teal' : 'violet'}>
                    {CERT_CAT[c.category]}
                  </Badge>
                </td>
                <td>
                  <div className="font-medium">{c.name}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{c.id}</div>
                </td>
                <td>
                  {c.subCategory}
                  {c.grade ? <div className="text-xs text-slate-500">{c.grade}</div> : null}
                </td>
                <td className="min-w-72 max-w-md text-sm leading-5">{c.applicableScope ?? '待企业确认'}</td>
                <td className="min-w-44">{c.ratioRequirement ?? '待配置'}</td>
                <td>
                  {c.hasExpiry ? '有有效期' : '长期/无统一有效期'}
                  <div className="text-xs text-slate-500">{c.needsReview ? '需复审' : '不统一要求复审'}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs leading-5 text-slate-400">
        注：附件列出的持证范围用于建立受控候选和规则配置依据。涉及实际作业的证书仍须以人工确认的作业/职责标签触发，不能仅凭岗位名称自动下结论。
      </p>
    </div>
  )
}

function Summary({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <Card className="p-4">
      <div className={`flex items-center gap-2 text-sm font-medium ${tone}`}>{icon}{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-slate-400">受控标准证书条目</div>
    </Card>
  )
}
