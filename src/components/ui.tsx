import type { ReactNode } from 'react'
import { cls } from '../format'

export function Badge({
  tone = 'slate',
  children,
}: {
  tone?: 'slate' | 'green' | 'red' | 'amber' | 'teal' | 'blue' | 'violet'
  children: ReactNode
}) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    red: 'bg-rose-50 text-rose-800 border-rose-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    teal: 'bg-teal-50 text-teal-800 border-teal-200',
    blue: 'bg-sky-50 text-sky-800 border-sky-200',
    violet: 'bg-violet-50 text-violet-800 border-violet-200',
  }
  return <span className={cls('badge', map[tone])}>{children}</span>
}

export function Button({
  children,
  onClick,
  kind = 'ghost',
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  kind?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cls('btn', kind === 'primary' ? 'btn-primary' : kind === 'danger' ? 'btn-danger' : 'btn-ghost')}>
      {children}
    </button>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cls('card', className)}>{children}</div>
}

export function Kpi({
  label,
  value,
  hint,
  accent = '#0d9488',
}: {
  label: string
  value: string
  hint?: string
  accent?: string
}) {
  return (
    <div className="card kpi p-4" style={{ ['--accent' as string]: accent }}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  )
}

export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={cls('modal p-5', wide && 'max-w-4xl')} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function SectionTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-sm font-semibold text-slate-800">{children}</h2>
      {extra}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-3 py-10 text-center text-sm text-slate-400">{children}</div>
}

export function judgeTone(j: string): 'green' | 'red' | 'amber' | 'slate' {
  if (j === 'compliant') return 'green'
  if (j === 'noncompliant') return 'red'
  if (j === 'undecidable' || j === 'at_risk') return 'amber'
  return 'slate'
}

export function issueTone(c: string): 'red' | 'amber' | 'blue' {
  if (c === 'compliance') return 'red'
  if (c === 'risk') return 'amber'
  return 'blue'
}

export const PAGE_SIZE = 40

export function Pager({
  page,
  total,
  pageSize = PAGE_SIZE,
  onPage,
}: {
  page: number
  total: number
  pageSize?: number
  onPage: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return <div className="px-3 py-2 text-xs text-slate-400">共 {total} 条</div>
  return (
    <div className="flex items-center justify-end gap-2 px-3 py-2 text-xs text-slate-500">
      <span>
        共 {total} 条 · {page}/{pages}
      </span>
      <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        上一页
      </button>
      <button className="btn btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        下一页
      </button>
    </div>
  )
}
