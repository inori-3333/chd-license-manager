import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Upload,
  SpellCheck,
  Users,
  Scale,
  TriangleAlert,
  ListChecks,
  Table2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { currentUser, recalc, resetDemo, setAsOf, setUser, useDb } from '../store'
import { ROLE_LABEL } from '../format'
import { useState } from 'react'

const NAV = [
  { to: '/', label: '管理驾驶舱', icon: LayoutDashboard },
  { to: '/workbench', label: '基层工作台', icon: Building2 },
  { to: '/import', label: '数据导入', icon: Upload },
  { to: '/standardize', label: '名称标准化', icon: SpellCheck },
  { to: '/personnel', label: '人员持证', icon: Users },
  { to: '/rules', label: '规则中心', icon: Scale },
  { to: '/issues', label: '问题中心', icon: TriangleAlert },
  { to: '/remediation', label: '整改闭环', icon: ListChecks },
  { to: '/reports', label: '统计报表', icon: Table2 },
]

export function Layout() {
  const db = useDb()
  const user = currentUser(db)
  const [welcome, setWelcome] = useState(() => !sessionStorage.getItem('chd.welcome'))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="brand-mark">证</div>
          <div>
            <div className="text-sm font-semibold text-white">持证上岗统计分析</div>
            <div className="text-[11px] text-teal-200/80">人岗证治理 · 规则计算 · 闭环</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <n.icon size={16} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="m-3 rounded-lg border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-slate-300">
          宁可标记「未知、待确认、数据不足」，也不得根据不充分信息自行推断正式合规结论。
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="topbar">
          <div className="text-sm text-slate-500">
            统计时点
            <input
              className="input ml-2"
              type="date"
              value={db.asOfDate}
              onChange={(e) => setAsOf(e.target.value)}
            />
            {db.lastCalcAt ? <span className="ml-3 text-xs">最近重算 {db.lastCalcAt.replace('T', ' ').slice(0, 16)}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <select className="select" value={user.id} onChange={(e) => setUser(e.target.value)}>
              {db.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {ROLE_LABEL[u.role]}
                </option>
              ))}
            </select>
            <button className="btn btn-ghost" onClick={() => recalc('手动重算')}>
              <RefreshCw size={14} /> 重算
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (confirm('将清除本机演示改动并恢复种子数据？')) resetDemo()
              }}
            >
              <RotateCcw size={14} /> 重置演示
            </button>
          </div>
        </header>
        <main className="page min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      {welcome ? (
        <div className="modal-backdrop">
          <div className="modal p-6">
            <div className="mb-2 text-lg font-semibold">持证上岗统计分析系统 · 可演示 MVP</div>
            <p className="text-sm leading-6 text-slate-600">
              这不是证书台账电子化，而是一条可体验的闭环：数据接入 → 名称治理 → 作业范围确认 → 已发布规则版本 →
              三值规则计算 → 质量/预警/合规三类问题 → 整改复核销项 → 驾驶舱三项口径。
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>数据保存在本机浏览器，可随时重置。</li>
              <li>名称推荐使用可降级本地算法，AI 不参与合规裁决，推荐必须人工确认。</li>
              <li>请用右上角切换角色走完：管理员确认映射 → 基层补作业范围 → HR 审规则 → 整改复核。</li>
            </ul>
            <div className="mt-5 flex justify-end">
              <button
                className="btn btn-primary"
                onClick={() => {
                  sessionStorage.setItem('chd.welcome', '1')
                  setWelcome(false)
                }}
              >
                开始体验
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
