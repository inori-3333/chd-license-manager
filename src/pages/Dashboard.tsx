import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from 'recharts'
import { Badge, Card, Kpi, PageHeader, ProgressiveSection, SectionTitle } from '../components/ui'
import { liveCalc, useDb } from '../store'
import { CERT_CAT, pct } from '../format'

export function Dashboard() {
  const db = useDb()
  const calc = liveCalc(db)
  const s = calc.stats
  const [chart, setChart] = useState<'units' | 'trend'>('units')
  const trend = db.snapshots
    .slice()
    .sort((a, b) => a.asOf.localeCompare(b.asOf))
    .map((x) => ({
      asOf: x.asOf.slice(5),
      人员合规率: x.personRate == null ? null : +(x.personRate * 100).toFixed(1),
      证项完成率: x.itemRate == null ? null : +(x.itemRate * 100).toFixed(1),
      统计覆盖率: +(x.coverage * 100).toFixed(1),
      合规问题: x.complianceIssues,
      风险预警: x.riskIssues,
    }))

  const unitBars = calc.unitStats.map((u) => ({
    name: u.orgName.replace('公司', ''),
    合规率: u.personRate == null ? null : +(u.personRate * 100).toFixed(1),
    证项完成率: u.itemRate == null ? null : +(u.itemRate * 100).toFixed(1),
    覆盖率: +(u.coverage * 100).toFixed(1),
  }))

  const rem = {
    open: db.issues.filter((i) => i.status === 'open').length,
    doing: db.issues.filter((i) => i.status === 'remediating').length,
    review: db.issues.filter((i) => i.status === 'pending_review').length,
    closed: db.issues.filter((i) => i.status === 'closed').length,
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="公司管理驾驶舱"
        meta={<><span>统计时点 {db.asOfDate}</span><span>{s.decidable} 人可判定</span></>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="应纳管人员" value={String(s.managed)} hint="在职且纳入统计" />
        <Kpi label="人员合规率" value={pct(s.personRate)} hint={`${s.compliant} / ${s.decidable} 可判定`} accent="#22a06b" />
        <Kpi label="应持证项完成率" value={pct(s.itemRate)} hint={`${s.satisfiedItems} / ${s.requiredItems} 已判定证项`} accent="#06a5c9" />
        <Kpi label="统计覆盖率" value={pct(s.coverage)} hint="可判定 / 应纳管" accent="#6d5ce7" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="p-4">
          <SectionTitle>需要关注</SectionTitle>
          <div className="attention-list">
            <Link className="attention-item" to="/issues">
              <span>合规问题</span><strong className="text-rose-600">{s.complianceIssues}</strong>
            </Link>
            <Link className="attention-item" to="/issues">
              <span>风险预警</span><strong className="text-amber-600">{s.riskIssues}</strong>
            </Link>
            <Link className="attention-item" to="/issues">
              <span>数据质量</span><strong>{s.qualityIssues}</strong>
            </Link>
            <Link className="attention-item" to="/remediation">
              <span>待复核整改</span><strong>{rem.review}</strong>
            </Link>
          </div>
        </Card>
        <Card className="p-4">
          <SectionTitle extra={
            <div className="view-switcher" aria-label="图表视图">
              <button className={chart === 'units' ? 'active' : ''} onClick={() => setChart('units')}>单位对比</button>
              <button className={chart === 'trend' ? 'active' : ''} onClick={() => setChart('trend')}>趋势</button>
            </div>
          }>经营视图</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer>
              {chart === 'units' ? (
                <BarChart data={unitBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" /><YAxis /><Tooltip formatter={(value) => (value == null ? '—' : String(value))} /><Legend />
                  <Bar dataKey="合规率" fill="#22a06b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="证项完成率" fill="#06a5c9" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="覆盖率" fill="#6d5ce7" radius={[3, 3, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="asOf" /><YAxis /><Tooltip /><Legend />
                  <Line type="monotone" dataKey="人员合规率" stroke="#22a06b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="证项完成率" stroke="#06a5c9" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="统计覆盖率" stroke="#6d5ce7" strokeWidth={2} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <ProgressiveSection title="分类口径明细" summary="国家、集团与激励类的应持、缺失和临期数据">
        <div className="grid gap-4 xl:grid-cols-3">
          {(['national', 'group', 'incentive'] as const).map((cat) => (
            <Card key={cat} className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">{CERT_CAT[cat]}</div>
                <Badge tone={cat === 'incentive' ? 'violet' : cat === 'national' ? 'red' : 'teal'}>{cat === 'incentive' ? '激励口径' : '强制口径'}</Badge>
              </div>
              {cat === 'incentive' ? (
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <Mini k="激励覆盖人数" v={String(s.incentive.coveragePeople)} /><Mini k="高等级持证" v={String(s.incentive.highGrade)} /><Mini k="本年新增取证" v={String(s.incentive.obtainedThisYear)} />
                </dl>
              ) : (
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <Mini k="应持人数" v={String(s[cat].requiredPeople)} /><Mini k="合规人数" v={String(s[cat].compliantPeople)} /><Mini k="应持未持" v={String(s[cat].missing)} />
                  <Mini k="证书过期" v={String(s[cat].expired)} /><Mini k="复审逾期" v={String(s[cat].reviewOverdue)} /><Mini k="临期" v={String(s[cat].expiring)} />
                </dl>
              )}
            </Card>
          ))}
        </div>
      </ProgressiveSection>

      <ProgressiveSection title="阶段目标与整改明细" summary={`${calc.groupResults.filter((g) => g.orgId).length} 个单位目标 · ${rem.open + rem.doing + rem.review} 项处理中`}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.5fr)]">
          <Card className="p-4">
            <SectionTitle extra={<Link className="text-xs text-teal-700" to="/rules">查看规则</Link>}>阶段目标监控</SectionTitle>
          <table className="data">
            <thead>
              <tr>
                <th>范围</th>
                <th>规则</th>
                <th>持证率</th>
                <th>本阶段</th>
                <th>覆盖率</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {calc.groupResults
                .filter((g) => g.orgId)
                .map((g) => (
                  <tr key={g.ruleId + (g.orgId ?? '')}>
                    <td>{g.orgName}</td>
                    <td>{g.ruleName}</td>
                    <td>{pct(g.rate)}</td>
                    <td>
                      {g.stageLabel}
                      {g.daysToDeadline != null ? <div className="text-[11px] text-slate-400">{g.daysToDeadline} 天后截止</div> : null}
                    </td>
                    <td>{pct(g.coverage)}</td>
                    <td>
                      <Badge tone={g.status === 'met' ? 'green' : g.status === 'not_met' ? 'red' : 'amber'}>
                        {g.status === 'met' ? '达标' : g.status === 'not_met' ? '未达标' : g.status === 'partial_met' ? '部分达标' : '数据不足'}
                      </Badge>
                      <div className="mt-1 max-w-xs text-[11px] text-slate-500">{g.message}</div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          </Card>
          <Card className="p-4">
            <SectionTitle extra={<Link className="text-xs text-teal-700" to="/remediation">进入闭环</Link>}>整改统计</SectionTitle>
            <div className="grid grid-cols-2 gap-2"><Mini k="待整改" v={String(rem.open)} /><Mini k="整改中" v={String(rem.doing)} /><Mini k="待复核" v={String(rem.review)} /><Mini k="已销项" v={String(rem.closed)} /></div>
          </Card>
        </div>
      </ProgressiveSection>
    </div>
  )
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-[#f7f7f5] px-2 py-2.5">
      <div className="text-[11px] text-slate-500">{k}</div>
      <div className="text-lg font-semibold">{v}</div>
    </div>
  )
}
