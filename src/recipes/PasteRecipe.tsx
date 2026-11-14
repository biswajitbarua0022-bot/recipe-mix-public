import { ArrowLeft, ArrowRight, CircleAlert, Link2, Pencil } from 'lucide-react'
import type { PhotoChange } from '../data/recipe-store'
import { createDraft, newIngredient, newStep } from './editor-draft'
import type { RecipeDraft } from './editor-draft'
import { parseRecipe } from './parse-recipe'

export type UnclearLine = { id: string; original: string; text: string }

export type PasteReview = {
  source: string
  titleSource?: string
  timeSources: string[]
  draft: RecipeDraft
  photo: PhotoChange
  ingredientCount: number
  stepCount: number
  unassigned: UnclearLine[]
  edited: boolean
}

export function createPasteReview(source: string): PasteReview {
  const parsed = parseRecipe(source)
  const blank = createDraft()
  return {
    source,
    titleSource: parsed.titleSource,
    timeSources: parsed.timeSources,
    draft: {
      ...blank,
      title: parsed.title,
      baseServings: parsed.servings || blank.baseServings,
      prepMinutes: parsed.prepMinutes,
      cookMinutes: parsed.cookMinutes,
      ingredients: parsed.ingredients.length ? parsed.ingredients.map((row) => ({ ...newIngredient(), ...row })) : blank.ingredients,
      steps: parsed.steps.length ? parsed.steps.map(newStep) : blank.steps,
    },
    photo: undefined,
    ingredientCount: parsed.ingredients.length,
    stepCount: parsed.steps.length,
    unassigned: parsed.unassigned.map((line) => ({ id: crypto.randomUUID(), original: line, text: line })),
    edited: false,
  }
}

export function EntryOptions({ mode, disabled, onChange }: { mode: 'manual' | 'paste'; disabled?: boolean; onChange: (mode: 'manual' | 'paste') => void }) {
  return (
    <div className="entry-options" role="group" aria-label="Entry method">
      <button type="button" className="entry-option" aria-pressed={mode === 'manual'} disabled={disabled} onClick={() => onChange('manual')}>
        <strong><Pencil size={16} aria-hidden="true" /> Manual entry</strong><span>Type each field yourself</span>
      </button>
      <button type="button" className="entry-option" aria-pressed={mode === 'paste'} disabled={disabled} onClick={() => onChange('paste')}>
        <strong><Link2 size={16} aria-hidden="true" /> Paste recipe text</strong><span>We split it up for you to check</span>
      </button>
    </div>
  )
}

export function PasteInput({ text, error, onChange, onRead, onResume }: {
  text: string
  error: string
  onChange: (text: string) => void
  onRead: () => void
  onResume?: () => void
}) {
  return (
    <section className="editor-panel paste-panel" aria-labelledby="paste-heading">
      <h2 id="paste-heading">Paste recipe text</h2>
      <p id="paste-help" className="editor-help">Paste a recipe from your notes or a message. Headings such as Ingredients and Method help separate the lines.</p>
      <textarea aria-label="Pasted recipe" aria-invalid={error ? true : undefined} aria-describedby={error ? 'paste-help paste-error' : 'paste-help'} value={text} onChange={(event) => onChange(event.target.value)}
        placeholder={'Dal Tadka (serves 4)\nPrep 10 min, cook 25 min\n\nIngredients\n1 cup toor dal\n½ tsp cumin seeds\nsalt to taste\n\nMethod\n1. Rinse the dal.\n2. Cook until tender.'} />
      {error && <p id="paste-error" className="field-error" role="alert">{error}</p>}
      <div className="paste-actions">
        <button type="button" className="button primary-button" onClick={onRead}>Read recipe <ArrowRight size={16} aria-hidden="true" /></button>
        <button type="button" className="text-button" disabled={!text} onClick={() => onChange('')}>Clear text</button>
        {onResume && <button type="button" className="text-button" onClick={onResume}>Return to review</button>}
      </div>
    </section>
  )
}

export function ReviewNotice({ review, busy, onBack }: { review: PasteReview; busy: boolean; onBack: () => void }) {
  const warningCount = review.unassigned.length + review.draft.ingredients.filter(({ reviewNote }) => reviewNote).length
  const { ingredientCount, stepCount } = review
  return (
    <section className={`review-notice${warningCount ? ' needs-review' : ''}`} aria-label="Paste review summary">
      <CircleAlert size={19} aria-hidden="true" />
      <div>
        <h2>We found {ingredientCount} {ingredientCount === 1 ? 'ingredient' : 'ingredients'} and {stepCount} {stepCount === 1 ? 'step' : 'steps'}</h2>
        <p>{warningCount > 0 && `${warningCount} ${warningCount === 1 ? 'line needs' : 'lines need'} a look. Check the highlighted lines and their original text. `}Review the fields, then select Save recipe to add it to your Recipe Box.</p>
        <button type="button" className="text-button" disabled={busy} onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Back to pasted text</button>
      </div>
    </section>
  )
}

export type LineAction = 'title' | 'ingredient' | 'step' | 'remove'

export function UnclearLines({ lines, canUseTitle, onChange, onAssign }: {
  lines: UnclearLine[]
  canUseTitle: boolean
  onChange: (id: string, text: string) => void
  onAssign: (line: UnclearLine, action: LineAction) => void
}) {
  return (
    <section className="editor-panel unclear-lines" aria-labelledby="unclear-heading">
      <h2 id="unclear-heading">Unclear lines</h2>
      <p className="editor-help">Edit each line and choose where it belongs, or remove it before saving.</p>
      {lines.map((line, index) => (
        <div key={line.id} className="unclear-line" role="group" aria-label={`Unclear line ${index + 1}`}>
          <label>Line {index + 1}<textarea value={line.text} rows={2} onChange={(event) => onChange(line.id, event.target.value)} /></label>
          {line.text !== line.original && <p className="editor-help">Original text: {line.original}</p>}
          <div className="paste-actions">
            {canUseTitle && <button type="button" className="button" disabled={!line.text.trim()} onClick={() => onAssign(line, 'title')}>Use as title</button>}
            <button type="button" className="button" disabled={!line.text.trim()} onClick={() => onAssign(line, 'ingredient')}>Use as ingredient</button>
            <button type="button" className="button" disabled={!line.text.trim()} onClick={() => onAssign(line, 'step')}>Use as step</button>
            <button type="button" className="text-button" onClick={() => onAssign(line, 'remove')}>Remove line</button>
          </div>
        </div>
      ))}
    </section>
  )
}
