import { useState } from 'react'
import { X } from 'lucide-react'
import { MAX_OWN_TAGS, normalizeOwnTags } from '../data/places'
import { Button, ErrorMessage, Field } from './UI'

export function OwnTagsField({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const add = () => {
    if (!draft.trim()) return
    const result = normalizeOwnTags([...tags, draft])
    setError(result.error)
    if (result.error) return
    onChange(result.tags)
    setDraft('')
  }
  return <div className="form-stack">
    <div className="tag-entry">
      <Field label="Tags propios (opcional)" value={draft} maxLength={100} placeholder="Por ejemplo, faro"
        onChange={event => { setDraft(event.target.value); setError('') }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} />
      <Button variant="secondary" onClick={add}>Agregar tag</Button>
    </div>
    <p className="field-hint" aria-live="polite">{tags.length}/{MAX_OWN_TAGS}</p>
    {!!tags.length && <ul className="tag-list" aria-label="Tags propios elegidos">{tags.map(tag => <li key={tag}>
      <span>{tag}</span>
      <button type="button" aria-label={`Quitar tag ${tag}`} onClick={() => onChange(tags.filter(item => item !== tag))}><X size={14} aria-hidden="true" /></button>
    </li>)}</ul>}
    <ErrorMessage message={error} />
  </div>
}
