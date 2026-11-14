import { useId, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { totalMinutes } from '../recipes/recipe'
import type { RecipeWithPhoto } from '../recipes/recipe'
import { RecipeImage } from '../recipes/RecipeImage'
import './organizer-dialog.css'

export function OrganizerDialog({ title, subtitle, busy, onClose, children, footer }: {
  title: string
  subtitle?: string
  busy?: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useLayoutEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return (
    <dialog ref={dialog} className="organizer-dialog" aria-labelledby={titleId} onCancel={(event) => {
      event.preventDefault()
      if (!busy) onClose()
    }}>
      <header className="organizer-dialog-header">
        <div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button className="icon-button" type="button" aria-label="Close" disabled={busy} onClick={onClose}><X size={19} aria-hidden="true" /></button>
      </header>
      <div className="organizer-dialog-body">{children}</div>
      {footer && <footer className="organizer-dialog-footer">{footer}</footer>}
    </dialog>
  )
}

export function PickerSearch({ label, query, onChange }: { label: string; query: string; onChange: (query: string) => void }) {
  return (
    <div className="search-field organizer-search">
      <Search size={17} aria-hidden="true" />
      <input type="search" aria-label={label} placeholder={label} value={query} onChange={(event) => onChange(event.target.value)} />
      {query && <button className="icon-button" type="button" aria-label="Clear search" onClick={() => onChange('')}><X size={16} aria-hidden="true" /></button>}
    </div>
  )
}

export function ChoiceRow({ title, caption, image, type, checked, disabled, onChange }: {
  title: string
  caption: string
  image?: RecipeWithPhoto
  type: 'checkbox' | 'radio'
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <label className="organizer-choice">
      <input type={type} name={type === 'radio' ? 'recipe-choice' : undefined} checked={checked} disabled={disabled} aria-label={title} onChange={onChange} />
      <RecipeImage photo={image?.photo ?? null} motif={image?.motif} />
      <span><strong>{title}</strong><small>{caption}</small></span>
    </label>
  )
}

export function RecipeChoice({ recipe, ...choice }: {
  recipe: RecipeWithPhoto
  type: 'checkbox' | 'radio'
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return <ChoiceRow {...choice} image={recipe} title={recipe.title} caption={`${totalMinutes(recipe)} min · ${recipe.diet}`} />
}
