import { useEffect, useId, useRef, type ReactNode } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
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

export function PageHeader({
  title,
  action,
  meta,
}: {
  title: string
  action?: ReactNode
  meta?: ReactNode
}) {
  return (
    <header className="focus-header">
      <div className="min-w-0">
        <h1>{title}</h1>
        {meta ? <div className="focus-header-meta">{meta}</div> : null}
      </div>
      {action ? <div className="focus-header-action">{action}</div> : null}
    </header>
  )
}

export function FocusTabs({
  label,
  value,
  items,
  onChange,
}: {
  label: string
  value: string
  items: Array<{ id: string; label: string; count?: number; tone?: 'blue' | 'red' | 'amber' | 'teal' | 'violet' }>
  onChange: (id: string) => void
}) {
  return (
    <div className="focus-tabs" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={value === item.id ? 'focus-tab active' : 'focus-tab'}
          data-tone={item.tone}
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
        >
          <span>{item.label}</span>
          {item.count != null ? <strong>{item.count}</strong> : null}
        </button>
      ))}
    </div>
  )
}

export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="search-field">
      <Search size={15} aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          aria-label="清空搜索"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  )
}

export function ProgressiveSection({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string
  summary?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className="progressive-section" open={defaultOpen || undefined}>
      <summary>
        <span>
          <strong>{title}</strong>
          {summary ? <small>{summary}</small> : null}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <div className="progressive-section-body">{children}</div>
    </details>
  )
}

export function Kpi({
  label,
  value,
  hint,
  accent = '#3b82f6',
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
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'),
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={dialogRef} className={cls('modal p-5', wide && 'max-w-4xl')} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="mb-4 flex items-center justify-between">
          <h3 id={titleId} className="text-base font-semibold">{title}</h3>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={16} />
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

export const PAGE_SIZE = 12

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
    <div className="pager flex items-center justify-end gap-2 px-3 py-2 text-xs text-slate-500">
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
