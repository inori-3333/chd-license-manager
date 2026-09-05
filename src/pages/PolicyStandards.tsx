import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Badge, Card, Empty, FocusTabs, PAGE_SIZE, PageHeader, Pager, ProgressiveSection, SearchField } from '../components/ui'
import { CERT_CAT } from '../format'
import { POLICY_CONFLICTS } from '../data/policy'
import { useDb } from '../store'
import type { CertCategory } from '../types'

type StandardFilter = 'all' | CertCategory

const FILTERS: Array<{ id: StandardFilter; label: string; tone?: 'blue' | 'red' | 'teal' | 'violet' }> = [
  { id: 'all', label: '全部', tone: 'blue' },
  { id: 'national', label: '国家管控', tone: 'red' },
  { id: 'group', label: '集团管控', tone: 'teal' },
  { id: 'incentive', label: '激励提升', tone: 'violet' },
]

export function PolicyStandards() {
  const db = useDb()
  const [filter, setFilter] = useState<StandardFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const count = (category: CertCategory) => db.certificates.filter((certificate) => certificate.category === category).length
  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return db.certificates.filter((certificate) => {
      if (filter !== 'all' && certificate.category !== filter) return false
      if (!keyword) return true
      return `${certificate.name}${certificate.subCategory}${certificate.grade ?? ''}${certificate.applicableScope ?? ''}${certificate.ratioRequirement ?? ''}`
        .toLowerCase()
        .includes(keyword)
    })
  }, [db.certificates, filter, query])

  function updateFilter(next: string) {
    setFilter(next as StandardFilter)
    setPage(1)
  }

  function updateQuery(next: string) {
    setQuery(next)
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="制度标准" />

      <Card className="data-workspace p-0">
        <div className="workspace-toolbar">
          <FocusTabs
            label="证书类别"
            value={filter}
            onChange={updateFilter}
            items={FILTERS.map((item) => ({
              ...item,
              count: item.id === 'all' ? db.certificates.length : count(item.id),
            }))}
          />
          <SearchField value={query} onChange={updateQuery} label="搜索制度标准" placeholder="搜索证书、范围或要求" />
        </div>

        <div className="table-scroll">
          <table className="data" aria-label="受控证书目录">
            <thead>
              <tr>
                <th>证书</th>
                <th>类别</th>
                <th>适用范围</th>
                <th>管理要求</th>
                <th>周期</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((certificate) => (
                <tr key={certificate.id}>
                  <td className="min-w-64">
                    <div className="font-medium text-slate-800">{certificate.name}</div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {certificate.subCategory}{certificate.grade ? ` · ${certificate.grade}` : ''}
                    </div>
                  </td>
                  <td>
                    <Badge tone={certificate.category === 'national' ? 'red' : certificate.category === 'group' ? 'teal' : 'violet'}>
                      {CERT_CAT[certificate.category]}
                    </Badge>
                  </td>
                  <td className="min-w-72 max-w-md text-sm leading-5">{certificate.applicableScope ?? '待企业确认'}</td>
                  <td className="min-w-44">{certificate.ratioRequirement ?? '待配置'}</td>
                  <td className="min-w-24">
                    <div>{certificate.hasExpiry ? '有效期管理' : '长期管理'}</div>
                    {certificate.needsReview ? <div className="mt-1 text-xs text-slate-500">定期复审</div> : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={5}><Empty>当前条件下共 0 个证书</Empty></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={rows.length} onPage={setPage} />
      </Card>

      <ProgressiveSection title="待确认口径" summary={`${POLICY_CONFLICTS.length} 项制度冲突`}>
        <div className="grid gap-3 xl:grid-cols-2">
          {POLICY_CONFLICTS.map((item) => (
            <article key={item.id} className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle size={17} />{item.topic}</div>
              <dl className="mt-3 grid gap-2 text-slate-600">
                <div><dt className="text-[11px] font-semibold text-slate-400">正文</dt><dd className="mt-1">{item.bodyText}</dd></div>
                <div><dt className="text-[11px] font-semibold text-slate-400">附件</dt><dd className="mt-1">{item.attachmentText}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </ProgressiveSection>
    </div>
  )
}
