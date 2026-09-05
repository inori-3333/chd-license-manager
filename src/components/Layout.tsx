import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  ListChecks,
  Menu,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldCheck,
  SpellCheck,
  Table2,
  TriangleAlert,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { currentUser, recalc, resetDemo, setAsOf, setUser, useDb } from '../store'
import { ROLE_LABEL } from '../format'
import { Button, Modal } from './ui'

const NAV = [
  {
    label: '总览',
    items: [
      { to: '/', label: '管理驾驶舱', icon: LayoutDashboard },
      { to: '/workbench', label: '基层工作台', icon: Building2 },
    ],
  },
  {
    label: '数据治理',
    items: [
      { to: '/import', label: '数据导入', icon: Upload },
      { to: '/standardize', label: '名称标准化', icon: SpellCheck },
      { to: '/personnel', label: '人员持证', icon: Users },
    ],
  },
  {
    label: '规则与处置',
    items: [
      { to: '/policy-standards', label: '制度标准', icon: BookOpenCheck },
      { to: '/rules', label: '规则中心', icon: Scale },
      { to: '/issues', label: '问题中心', icon: TriangleAlert },
      { to: '/remediation', label: '整改闭环', icon: ListChecks },
    ],
  },
  {
    label: '分析',
    items: [{ to: '/reports', label: '统计报表', icon: Table2 }],
  },
]

const FLAT_NAV = NAV.flatMap((group) => group.items)

export function Layout() {
  const db = useDb()
  const user = currentUser(db)
  const location = useLocation()
  const [welcome, setWelcome] = useState(() => !sessionStorage.getItem('chd.welcome'))
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const currentPage = useMemo(
    () => FLAT_NAV.find((item) => item.to === location.pathname) ?? FLAT_NAV[0],
    [location.pathname],
  )

  useEffect(() => setMobileNavOpen(false), [location.pathname])
  useEffect(() => {
    document.title = `${currentPage.label} — 持证上岗统计分析`
  }, [currentPage.label])

  return (
    <div className="app-shell">
      {mobileNavOpen ? <button className="sidebar-scrim" aria-label="关闭导航" onClick={() => setMobileNavOpen(false)} /> : null}
      <aside className={`sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <ShieldCheck size={20} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="brand-name">持证上岗</div>
            <div className="brand-subtitle">统计分析系统</div>
          </div>
          <button className="sidebar-close" aria-label="关闭导航" onClick={() => setMobileNavOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          {NAV.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              <div className="nav-group-items">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <item.icon size={17} strokeWidth={1.9} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

      </aside>

      <div className="app-content">
        <header className="topbar">
          <div className="topbar-title">
            <button className="mobile-menu" aria-label="打开导航" onClick={() => setMobileNavOpen(true)}>
              <Menu size={19} />
            </button>
            <div className="page-icon" aria-hidden="true">
              <currentPage.icon size={16} strokeWidth={2} />
            </div>
            <span>{currentPage.label}</span>
          </div>

          <div className="topbar-actions">
            <label className="date-control">
              <CalendarDays size={15} aria-hidden="true" />
              <span>统计时点</span>
              <input aria-label="统计时点" type="date" value={db.asOfDate} onChange={(e) => setAsOf(e.target.value)} />
            </label>
            <button className="icon-button" title="重新计算" aria-label="重新计算" onClick={() => recalc('手动重算')}>
              <RefreshCw size={16} />
            </button>
            <button
              className="icon-button desktop-only"
              title="重置演示数据"
              aria-label="重置演示数据"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw size={16} />
            </button>
            <label className="user-control">
              <span className="user-avatar">{user.name.slice(0, 1)}</span>
              <span className="user-copy">
                <strong>{user.name}</strong>
                <small>{ROLE_LABEL[user.role]}</small>
              </span>
              <select aria-label="切换用户" value={user.id} onChange={(e) => setUser(e.target.value)}>
                {db.users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {ROLE_LABEL[item.role]}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
          </div>
        </header>

        <main className="page min-w-0 flex-1 overflow-auto">
          <div className="page-transition" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      {welcome ? (
        <div className="modal-backdrop">
          <div className="modal welcome-modal" role="dialog" aria-modal="true" aria-label="欢迎使用">
            <div className="welcome-icon"><BarChart3 size={24} /></div>
            <div className="welcome-kicker">欢迎使用</div>
            <h2>把持证治理，变成清晰的闭环</h2>
            <p className="welcome-lead">串联数据接入、名称治理、规则计算与整改销项。</p>
            <div className="welcome-steps">
              <div><span>01</span><strong>汇入数据</strong><small>人员、岗位和证书统一治理</small></div>
              <div><span>02</span><strong>计算判定</strong><small>以已发布规则完成三值计算</small></div>
              <div><span>03</span><strong>闭环整改</strong><small>问题、复核和销项全程留痕</small></div>
            </div>
            <div className="welcome-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  sessionStorage.setItem('chd.welcome', '1')
                  setWelcome(false)
                }}
              >
                进入工作台
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resetOpen ? (
        <Modal title="重置演示数据" onClose={() => setResetOpen(false)}>
          <p className="mb-5 text-sm leading-6 text-slate-600">重置后恢复种子数据，并清除当前浏览器中的演示改动。</p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setResetOpen(false)}>取消</Button>
            <Button
              kind="danger"
              onClick={() => {
                resetDemo()
                setResetOpen(false)
              }}
            >
              确认重置
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
