import { useState, type ReactNode } from 'react'
import { Badge, Button, Card, Modal, PageHeader, ProgressiveSection } from '../components/ui'
import { addPersonManual, can, importRows, useDb } from '../store'
import { detectKind, normalizeHeaderMap, type RawRow } from '../engine/validate'

const PERSON_HEADERS = ['工号', '姓名', '组织编码', '组织名称', '岗位名称', '主岗/兼岗', '任职开始', '任职结束', '在职状态']
const CERT_HEADERS = ['工号', '证书名称', '证书编号', '发证机构', '取得日期', '有效开始', '有效截止', '复审日期']
const SCOPE_HEADERS = ['工号', '作业范围', '开始日期', '结束日期']

export function DataImport() {
  const db = useDb()
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ employeeNo: '', name: '', orgId: db.orgs.find((o) => o.type === 'team')?.id ?? db.orgs[0].id, originalJobName: '', startDate: db.asOfDate })

  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const person = [
      PERSON_HEADERS,
      ['C001', '示例合格', 'A-热控检修车间-程控班', '程控班', '检修工', '主岗', '2024-01-01', '', '在职'],
      ['C002', '非标岗位', 'A-热控检修车间-程控班', '程控班', '专工（学习岗）', '主岗', '2023-05-01', '', '在职'],
      ['', '缺工号', 'A-热控检修车间-程控班', '程控班', '检修工', '主岗', '2024-01-01', '', '在职'],
      ['C003', '非法岗位', 'A-热控检修车间-程控班', '程控班', '12345', '主岗', '2024-01-01', '', '在职'],
      ['C004', '日期错误', 'A-热控检修车间-程控班', '程控班', '检修工', '主岗', '不是日期', '', '在职'],
      ['C005', '结束早于开始', 'A-热控检修车间-程控班', '程控班', '检修工', '主岗', '2024-06-01', '2024-01-01', '在职'],
      ['C006', '疑似异常', 'A-锅炉检修车间', '锅炉检修车间', '财务主管', '主岗', '2024-01-01', '', '在职'],
    ]
    const cert = [
      CERT_HEADERS,
      ['C001', '高压电工作业证', 'HV-C001', '省应急厅', '2024-03-01', '2024-03-01', '2028-03-01', '2027-03-01'],
      ['C002', '注安师', 'ZA-C002', '人社部', '2023-01-01', '2023-01-01', '2028-01-01', '2027-01-01'],
      ['C001', '高压电工作业证', 'HV-BAD', '省应急厅', '2024-01-01', '2024-01-01', '2023-01-01', ''],
    ]
    const scope = [SCOPE_HEADERS, ['C001', '高压电气作业', '2024-01-01', ''], ['C002', '高压电气作业', '2023-05-01', '']]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(person), '人员岗位')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cert), '人员证书')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(scope), '作业范围')
    XLSX.writeFile(wb, '持证上岗导入模板与示例.xlsx')
  }

  async function onFile(file: File) {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const rows: RawRow[] = []
    for (const sheet of wb.SheetNames) {
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet], { defval: '', raw: false })
      if (!json.length) continue
      const headers = Object.keys(json[0])
      const kind = detectKind(sheet, headers)
      if (!kind) continue
      json.forEach((r, i) => {
        rows.push({ sheet, row: i + 2, kind, values: normalizeHeaderMap(r) })
      })
    }
    if (!rows.length) {
      setMsg('请选择包含「工号」的工作表，或使用导入模板。')
      return
    }
    const batch = importRows(rows, file.name)
    setMsg(batch.notes)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="数据导入" meta={<span>{db.batches.length} 个导入批次</span>} />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button kind="primary" disabled={!can('import')} onClick={downloadTemplate}>
            下载 Excel 模板（含校验示例）
          </Button>
          <label className={`btn btn-ghost ${!can('import') ? 'opacity-40' : ''}`}>
            上传 Excel / CSV
            <input
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              disabled={!can('import')}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
                e.target.value = ''
              }}
            />
          </label>
          <Button onClick={() => setShowForm(true)}>网页单条维护</Button>
        </div>
        {msg ? <div className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">{msg}</div> : null}
      </Card>

      {db.batches.slice(0, 1).map((b) => <BatchCard key={b.id} b={b} />)}
      {db.batches.length > 1 ? (
        <ProgressiveSection title="历史导入批次" summary={`${db.batches.length - 1} 个较早批次`}>
          <div className="space-y-3">{db.batches.slice(1).map((b) => <BatchCard key={b.id} b={b} />)}</div>
        </ProgressiveSection>
      ) : null}

      {showForm ? (
        <Modal title="单条维护人员" onClose={() => setShowForm(false)}>
          <div className="grid gap-3">
            <L k="工号">
              <input className="input w-full" value={form.employeeNo} onChange={(e) => setForm({ ...form, employeeNo: e.target.value })} />
            </L>
            <L k="姓名">
              <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </L>
            <L k="组织">
              <select className="select w-full" value={form.orgId} onChange={(e) => setForm({ ...form, orgId: e.target.value })}>
                {db.orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.standardName}
                  </option>
                ))}
              </select>
            </L>
            <L k="岗位名称（允许非标准）">
              <input className="input w-full" value={form.originalJobName} onChange={(e) => setForm({ ...form, originalJobName: e.target.value })} />
            </L>
            <L k="任职开始">
              <input className="input w-full" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </L>
            <Button
              kind="primary"
              onClick={() => {
                if (!form.employeeNo || !form.name || !form.originalJobName) return
                addPersonManual(form)
                setShowForm(false)
              }}
            >
              保存原始数据
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function BatchCard({ b }: { b: ReturnType<typeof useDb>['batches'][number] }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between gap-3"><div><div className="font-semibold">{b.filename}</div><div className="text-xs text-slate-400">{b.at.replace('T', ' ').slice(0, 19)} · {b.by}</div></div><Badge tone={b.rejected ? 'amber' : 'green'}>{b.notes}</Badge></div>
      <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-5"><Stat k="导入记录" v={b.total} /><Stat k="成功接收" v={b.accepted} /><Stat k="已标准化" v={b.standardized} /><Stat k="待治理" v={b.pending} /><Stat k="导入失败" v={b.rejected} /></div>
      {b.errors.length ? <ProgressiveSection title="查看失败明细" summary={`${b.errors.length} 条`}><table className="data"><thead><tr><th>行</th><th>表</th><th>字段</th><th>原因</th></tr></thead><tbody>{b.errors.map((e, i) => <tr key={i}><td>{e.row}</td><td>{e.sheet}</td><td>{e.field}</td><td>{e.message}</td></tr>)}</tbody></table></ProgressiveSection> : null}
    </Card>
  )
}

function Stat({ k, v }: { k: string; v: number }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className="text-[11px] text-slate-500">{k}</div>
      <div className="text-lg font-semibold">{v}</div>
    </div>
  )
}

function L({ k, children }: { k: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-slate-500">{k}</div>
      {children}
    </label>
  )
}
