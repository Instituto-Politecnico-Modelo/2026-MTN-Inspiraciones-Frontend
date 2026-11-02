import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronDown, Circle, Clock3, Inbox, LoaderCircle, Search, X, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Button({ children, variant = 'primary', loading = false, className = '', disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }) {
  return <button type="button" className={`button button-${variant} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <LoaderCircle aria-hidden="true" className="spin" size={19} />}
    {children}
  </button>
}

export function IconButton({ icon: Icon, label, active, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean }) {
  return <button type="button" className={`icon-button ${active ? 'is-active' : ''} ${className}`} aria-label={label} title={label} aria-pressed={active} {...props}>
    <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
  </button>
}

type FieldExtras = { label: string; hint?: string; error?: string }

export function Field({ label, hint, error, id: givenId, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & FieldExtras) {
  const generatedId = useId()
  const id = givenId ?? generatedId
  return <div className={`field ${className}`}>
    <label htmlFor={id}>{label}</label>
    <input id={id} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...props} />
    {hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
    {error && <p id={`${id}-error`} className="field-error">{error}</p>}
  </div>
}

export function TextArea({ label, hint, error, id: givenId, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldExtras) {
  const generatedId = useId()
  const id = givenId ?? generatedId
  return <div className={`field ${className}`}>
    <label htmlFor={id}>{label}</label>
    <textarea id={id} rows={4} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...props} />
    {hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
    {error && <p id={`${id}-error`} className="field-error">{error}</p>}
  </div>
}

export function SelectField({ label, options, id: givenId, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) {
  const generatedId = useId()
  const id = givenId ?? generatedId
  return <div className={`field ${className}`}>
    <label htmlFor={id}>{label}</label>
    <div className="select-wrap"><select id={id} {...props}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select><ChevronDown size={18} aria-hidden="true" /></div>
  </div>
}

export function SearchField({ value, onChange, placeholder = 'Buscar', label = 'Buscar' }: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string }) {
  const id = useId()
  return <div className="search-field">
    <label className="sr-only" htmlFor={id}>{label}</label>
    <Search size={20} aria-hidden="true" />
    <input id={id} type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" />
    {value && <IconButton icon={X} label="Limpiar búsqueda" onClick={() => onChange('')} />}
  </div>
}

export function Modal({ open, title, description, children, onClose, busy = false, className = '' }: { open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void; busy?: boolean; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const element = dialog.current
    if (!element || !open) return
    const previous = document.activeElement
    element.showModal()
    return () => {
      element.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
      else document.getElementById('contenido')?.focus({ preventScroll: true })
    }
  }, [open])
  return <dialog ref={dialog} className={`modal ${className}`} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="modal-heading"><h2 id={titleId}>{title}</h2><IconButton icon={X} label="Cerrar diálogo" onClick={onClose} disabled={busy} /></div>
    {description && <p className="muted" id={descriptionId}>{description}</p>}
    {open && children}
  </dialog>
}

export function Tabs({ items, value, onChange, label, children }: { items: { value: string; label: string; icon?: LucideIcon }[]; value: string; onChange: (value: string) => void; label: string; children: ReactNode }) {
  const id = useId()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  return <>
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => <button key={item.value} type="button" ref={element => { buttons.current[index] = element }}
        role="tab" id={`${id}-${item.value}`} aria-controls={`${id}-panel`} aria-selected={value === item.value} tabIndex={value === item.value ? 0 : -1}
        onClick={() => onChange(item.value)} onKeyDown={event => {
          let next: number
          if (event.key === 'ArrowRight') next = (index + 1) % items.length
          else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
          else if (event.key === 'Home') next = 0
          else if (event.key === 'End') next = items.length - 1
          else return
          event.preventDefault()
          onChange(items[next].value)
          buttons.current[next]?.focus()
        }}>
        {item.icon && <item.icon size={18} aria-hidden="true" />}{item.label}
      </button>)}
    </div>
    <div className="tab-content" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${value}`}>{children}</div>
  </>
}

export function Choice({ selected, children, onClick, icon: Icon }: { selected: boolean; children: ReactNode; onClick: () => void; icon?: LucideIcon }) {
  return <button type="button" className={`choice ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={onClick}>
    {Icon && <Icon size={24} aria-hidden="true" />}<span>{children}</span>
    {selected ? <Check size={19} aria-hidden="true" /> : <span className="choice-check" aria-hidden="true" />}
  </button>
}

export function PageTitle({ title, description, actions, back }: { title: string; description?: string; actions?: ReactNode; back?: { to: string; label: string } }) {
  return <header className="page-heading">
    <div>{back && <Link className="back-link" to={back.to}><ArrowLeft size={18} aria-hidden="true" />{back.label}</Link>}
      <h1>{title}</h1>{description && <p>{description}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>
}

export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description: string; action?: ReactNode; icon?: LucideIcon }) {
  return <div className="empty-state"><Icon size={32} strokeWidth={1.5} aria-hidden="true" /><h2>{title}</h2><p>{description}</p>{action}</div>
}

export function ErrorMessage({ message }: { message?: string | null }) {
  if (!message) return null
  return <div role="alert" className="error-message"><AlertCircle size={19} aria-hidden="true" /><span>{message}</span></div>
}

export const statusLabels: Record<string, string> = {
  open: 'Abierto', upcoming: 'Próximamente', closed: 'Finalizado', archived: 'Archivado',
  active: 'Activa', suspended: 'Suspendida', deleted: 'Eliminada',
  published: 'Visible', hidden: 'Oculta', pending: 'Pendiente',
  approved: 'Aprobada', rejected: 'Rechazada', accepted: 'Aceptado', dismissed: 'Desestimado',
  admin: 'Administrador', artist: 'Artista',
}

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const positive = ['open', 'active', 'published', 'approved', 'accepted'].includes(status ?? '')
  const warning = ['pending', 'suspended', 'upcoming'].includes(status ?? '')
  const Icon = positive ? CheckCircle2 : warning ? Clock3 : Circle
  return <span className={`badge ${positive ? 'badge-positive' : warning ? 'badge-warning' : ''}`}><Icon size={14} aria-hidden="true" />{children ?? statusLabels[status ?? ''] ?? status}</span>
}

export function Avatar({ user, size = 'small' }: { user: { name: string; avatar: string }; size?: 'small' | 'medium' | 'large' }) {
  return <span className={`avatar avatar-${size}`} aria-hidden="true">
    {user.avatar ? <img src={user.avatar} alt="" /> : user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('')}
  </span>
}
