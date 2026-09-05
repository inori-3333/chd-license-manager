import { useState } from 'react'
import { Badge, Button, Card, Modal, PAGE_SIZE, PageHeader, Pager } from '../components/ui'
import { can, confirmMapping, disableMapping, rejectMapping, useDb } from '../store'
import { MAP_KIND } from '../format'

export function Standardize() {
  const db = useDb()
  const [tab, setTab] = useState<'pending' | 'confirmed'>('pending')
  const [page, setPage] = useState(1)
  const [noneId, setNoneId] = useState<string | null>(null)
  const pending = db.mappings.filter((m) => m.status === 'pending').sort((a, b) => b.usageCount - a.usageCount)
  const confirmed = db.mappings.filter((m) => m.status !== 'pending')
  const current = tab === 'pending' ? pending : confirmed
  const visible = current.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-5">
      <PageHeader title="名称标准化处理" meta={<><span>{pending.length} 项待处理</span><span>每页 {PAGE_SIZE} 项</span></>} />
      <div className="flex gap-2">
        <Button kind={tab === 'pending' ? 'primary' : 'ghost'} onClick={() => { setTab('pending'); setPage(1) }}>
          待处理名称 ({pending.length})
        </Button>
        <Button kind={tab === 'confirmed' ? 'primary' : 'ghost'} onClick={() => { setTab('confirmed'); setPage(1) }}>
          已确认映射库 ({confirmed.length})
        </Button>
      </div>

      {tab === 'pending' ? (
        <Card className="overflow-auto p-0">
          <table className="data">
            <thead>
              <tr>
                <th>类型</th>
                <th>原始名称</th>
                <th>范围</th>
                <th>出现次数</th>
                <th>算法候选（须确认）</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Badge tone="teal">{MAP_KIND[m.kind]}</Badge>
                  </td>
                  <td className="font-medium">{m.originalName}</td>
                  <td>{m.scopeKind === 'local' ? db.orgs.find((o) => o.id === m.scopeOrgId)?.standardName ?? '局部' : '全局'}</td>
                  <td>{m.usageCount}</td>
                  <td>
                    <div className="space-y-1">
                      {m.candidates.length === 0 ? <span className="text-slate-400">待补充候选</span> : null}
                      {m.candidates.map((c) => (
                        <div key={c.standardId} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1">
                          <div>
                            <span className="font-medium">{c.standardName}</span>
                            <span className="ml-2 text-[11px] text-slate-400">
                              {(c.score * 100).toFixed(0)}% · {c.reason}
                            </span>
                          </div>
                          <Button
                            kind="primary"
                            disabled={!can('confirm_mapping')}
                            onClick={() => confirmMapping(m.id, c.standardId, c.standardName)}
                          >
                            确认
                          </Button>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Button disabled={!can('confirm_mapping')} onClick={() => setNoneId(m.id)}>
                      保留待治理
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} total={pending.length} onPage={setPage} />
        </Card>
      ) : (
        <Card className="overflow-auto p-0">
          <table className="data">
            <thead>
              <tr>
                <th>原始名称</th>
                <th>标准名称</th>
                <th>类型</th>
                <th>范围</th>
                <th>确认人</th>
                <th>确认时间</th>
                <th>使用次数</th>
                <th>状态</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.id}>
                  <td>{m.originalName}</td>
                  <td>{m.standardName ?? '—'}</td>
                  <td>{MAP_KIND[m.kind]}</td>
                  <td>{m.scopeKind === 'global' ? '全局' : '局部'}</td>
                  <td>{m.confirmedBy ?? '—'}</td>
                  <td>{m.confirmedAt?.replace('T', ' ').slice(0, 16) ?? '—'}</td>
                  <td>{m.usageCount}</td>
                  <td>
                    <Badge tone={m.status === 'confirmed' ? 'green' : 'slate'}>{m.status === 'confirmed' ? '生效' : '已停用'}</Badge>
                  </td>
                  <td>
                    {m.status === 'confirmed' ? (
                      <Button disabled={!can('confirm_mapping')} onClick={() => disableMapping(m.id)}>
                        停用
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} total={confirmed.length} onPage={setPage} />
        </Card>
      )}

      {noneId ? (
        <Modal title="保留待治理" onClose={() => setNoneId(null)}>
          <p className="mb-3 text-sm text-slate-600">后续可补充标准库或人工指定。</p>
          <Button
            kind="primary"
            onClick={() => {
              rejectMapping(noneId, '候选集均不正确')
              setNoneId(null)
            }}
          >
            保留待治理
          </Button>
        </Modal>
      ) : null}
    </div>
  )
}
