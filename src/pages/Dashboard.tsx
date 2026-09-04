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
import { Card, Kpi, SectionTitle, Badge } from '../components/ui'
import { liveCalc, useDb } from '../store'
import { CERT_CAT, pct } from '../format'

export function Dashboard() {
  const db = useDb()
  const calc = liveCalc(db)
  const s = calc.stats
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
    合规率: u.personRate == null ? 0 : +(u.personRate * 100).toFixed(1),
    证项完成率: u.itemRate == null ? 0 : +(u.itemRate * 100).toFixed(1),
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
      <div>
        <h1 className="text-xl font-semibold">公司管理驾驶舱</h1>
        <p className="mt-1 text-sm text-slate-500">
          回答「全公司现在整体怎么样」。三项比例必须同时看：人员合规率分母不含数据不足人员，覆盖率单独暴露未知。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Kpi label="应纳管人员" value={String(s.managed)} hint="在职且纳入统计" />
        <Kpi label="人员合规率" value={pct(s.personRate)} hint={`${s.compliant} / ${s.decidable} 可判定`} accent="#15803d" />
        <Kpi label="应持证项完成率" value={pct(s.itemRate)} hint={`${s.satisfiedItems} / ${s.requiredItems} 已判定证项`} accent="#0f766e" />
        <Kpi label="统计覆盖率" value={pct(s.coverage)} hint="可判定 / 应纳管" accent="#0369a1" />
        <Kpi label="当前合规问题" value={String(s.complianceIssues)} accent="#c2410c" />
        <Kpi label="当前风险预警" value={String(s.riskIssues)} accent="#d97706" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {(['national', 'group', 'incentive'] as const).map((cat) => (
          <Card key={cat} className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">{CERT_CAT[cat]}</div>
              <Badge tone={cat === 'incentive' ? 'violet' : cat === 'national' ? 'red' : 'teal'}>{cat === 'incentive' ? '不记违规率' : '强制口径'}</Badge>
            </div>
            {cat === 'incentive' ? (
              <dl className="grid grid-cols-3 gap-2 text-center">
                <Mini k="激励覆盖人数" v={String(s.incentive.coveragePeople)} />
                <Mini k="高等级持证" v={String(s.incentive.highGrade)} />
                <Mini k="本年新增取证" v={String(s.incentive.obtainedThisYear)} />
              </dl>
            ) : (
              <dl className="grid grid-cols-3 gap-2 text-center">
                <Mini k="应持人数" v={String(s[cat].requiredPeople)} />
                <Mini k="合规人数" v={String(s[cat].compliantPeople)} />
                <Mini k="应持未持" v={String(s[cat].missing)} />
                <Mini k="证书过期" v={String(s[cat].expired)} />
                <Mini k="复审逾期" v={String(s[cat].reviewOverdue)} />
                <Mini k="临期" v={String(s[cat].expiring)} />
              </dl>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>单位对比（禁止只按合规率排名）</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={unitBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="合规率" fill="#15803d" />
                <Bar dataKey="证项完成率" fill="#0d9488" />
                <Bar dataKey="覆盖率" fill="#0284c7" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-400">低覆盖率单位的合规率不可直接横向比较。</p>
        </Card>
        <Card className="p-4">
          <SectionTitle>趋势（快照）</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="asOf" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="人员合规率" stroke="#15803d" dot={false} />
                <Line type="monotone" dataKey="证项完成率" stroke="#0d9488" dot={false} />
                <Line type="monotone" dataKey="统计覆盖率" stroke="#0284c7" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <SectionTitle extra={<Link className="text-xs text-teal-700" to="/rules">查看规则</Link>}>
            阶段目标监控
          </SectionTitle>
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
          <SectionTitle extra={<Link className="text-xs text-teal-700" to="/remediation">整改闭环</Link>}>
            整改统计
          </SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            <Mini k="待整改" v={String(rem.open)} />
            <Mini k="整改中" v={String(rem.doing)} />
            <Mini k="待复核" v={String(rem.review)} />
            <Mini k="已销项" v={String(rem.closed)} />
          </div>
          <div className="mt-4 text-sm text-slate-600">
            数据质量问题 {s.qualityIssues} 项单独列示，不与合规问题混称「预警」。
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            人员与岗位来自《岗位示例表》（1315 条）。建议演示：名称标准化确认「学习岗 / 注安师」→ 为郑华补充高压作业范围 →
            观察覆盖率与合规率变化 → 走王芳应持未持的整改复核。
          </div>
        </Card>
      </div>
    </div>
  )
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <div className="text-[11px] text-slate-500">{k}</div>
      <div className="text-lg font-semibold">{v}</div>
    </div>
  )
}
