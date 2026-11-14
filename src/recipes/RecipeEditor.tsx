import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, ChevronDown, ChevronUp, Minus, Plus, Timer, Trash2, TriangleAlert, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { PhotoChange } from '../data/recipe-store'
import { recipeWriteError } from '../data/use-recipe-library'
import type { RecipeLibrary } from '../data/use-recipe-library'
import { createDraft, newIngredient, newStep, validateDraft, wholeNumber } from './editor-draft'
import type { IngredientDraft, RecipeDraft, StepDraft } from './editor-draft'
import { parseIngredientLine, withoutListMarker } from './parse-recipe'
import { createPasteReview, EntryOptions, PasteInput, ReviewNotice, UnclearLines } from './PasteRecipe'
import type { LineAction, PasteReview, UnclearLine } from './PasteRecipe'
import { preparePhoto } from './prepare-photo'
import { aisles, cuisines, diets, mealTypes, units } from './recipe'
import type { RecipeWithPhoto } from './recipe'
import { DietIcon, DietTag } from './RecipeCard'
import { RecipeImage } from './RecipeImage'
import './recipe-editor.css'

type FieldErrors = Record<string, string>

function fieldError(errors: FieldErrors, id: string) {
  return errors[id] ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {}
}

function FieldError({ errors, id }: { errors: FieldErrors; id: string }) {
  return errors[id] ? <small className="field-error" id={`${id}-error`}>{errors[id]}</small> : null
}

function SelectField<Option extends string>({ label, className, options, value, onChange, emptyLabel }: {
  label: string
  className?: string
  options: readonly Option[]
  value: Option
  onChange: (value: Option) => void
  emptyLabel?: string
}) {
  const labelId = useId()
  return (
    <label className={className}>
      <span id={labelId}>{label}</span>
      <select aria-labelledby={labelId} value={value} onChange={(event) => onChange(event.target.value as Option)}>
        {options.map((option) => <option key={option} value={option}>{option || emptyLabel}</option>)}
      </select>
    </label>
  )
}

function IngredientRow({ row, index, errors, fromPaste, onChange, onRemove }: {
  row: IngredientDraft
  index: number
  errors: FieldErrors
  fromPaste: boolean
  onChange: (change: Partial<IngredientDraft>) => void
  onRemove: () => void
}) {
  const nameId = `name-${row.id}`
  const amountId = `amount-${row.id}`
  return (
    <div className={`ingredient-row${row.reviewNote ? ' needs-review' : ''}`} role="group" aria-label={`Ingredient ${index + 1}`}>
      {row.reviewNote && <p className="ingredient-warning"><TriangleAlert size={15} aria-hidden="true" /> {row.reviewNote}</p>}
      <label className="ingredient-name">Ingredient
        <input aria-label="Ingredient" value={row.name} placeholder="e.g. Cumin seeds" onChange={(event) => onChange({ name: event.target.value })} {...fieldError(errors, nameId)} />
        <FieldError errors={errors} id={nameId} />
      </label>
      <label className="ingredient-amount">Amount
        <input aria-label="Amount" value={row.amount} placeholder="½" onChange={(event) => onChange({ amount: event.target.value })} {...fieldError(errors, amountId)} />
        <FieldError errors={errors} id={amountId} />
      </label>
      <SelectField label="Unit" className="ingredient-unit" options={units} value={row.unit} onChange={(unit) => onChange({ unit })} emptyLabel="No unit" />
      <SelectField label="Aisle" className="ingredient-aisle" options={aisles} value={row.aisle} onChange={(aisle) => onChange({ aisle })} />
      <button className="icon-button ingredient-remove" type="button" aria-label={`Remove ingredient ${index + 1}`} onClick={onRemove}><Trash2 size={16} aria-hidden="true" /></button>
      <label className="ingredient-note">{fromPaste ? 'Original text' : 'Note (optional)'}
        <input value={row.originalText} placeholder="e.g. finely chopped, or the line as written" onChange={(event) => onChange({ originalText: event.target.value })} />
      </label>
    </div>
  )
}

function MethodRows({ steps, errors, onChange }: { steps: StepDraft[]; errors: FieldErrors; onChange: (steps: StepDraft[]) => void }) {
  function move(index: number, offset: number) {
    const next = [...steps]
    const target = index + offset
    next[index] = steps[target]
    next[target] = steps[index]
    onChange(next)
  }

  return (
    <section className="editor-panel" aria-labelledby="method-heading">
      <div className="editor-panel-heading"><h2 id="method-heading">Method</h2><span>{steps.length} {steps.length === 1 ? 'step' : 'steps'}</span></div>
      <FieldError errors={errors} id="steps" />
      <ol className="method-list">
        {steps.map((step, index) => (
          <li key={step.id}>
            <span className="step-number" aria-hidden="true">{index + 1}</span>
            <div>
              <textarea aria-label={`Step ${index + 1}`} placeholder="Describe this step" value={step.text} onChange={(event) => onChange(steps.map((item) => item.id === step.id ? { ...item, text: event.target.value } : item))} />
              <div className="step-actions">
                <button className="icon-button" type="button" disabled={index === 0} aria-label={`Move step ${index + 1} up`} onClick={() => move(index, -1)}><ChevronUp size={16} aria-hidden="true" /></button>
                <button className="icon-button" type="button" disabled={index === steps.length - 1} aria-label={`Move step ${index + 1} down`} onClick={() => move(index, 1)}><ChevronDown size={16} aria-hidden="true" /></button>
                <button className="icon-button" type="button" aria-label={`Remove step ${index + 1}`} onClick={() => onChange(steps.filter(({ id }) => id !== step.id))}><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button className="button editor-add-row" type="button" onClick={() => onChange([...steps, newStep()])}><Plus size={17} aria-hidden="true" /> Add step</button>
    </section>
  )
}

export function RecipeEditor({ recipe, onSave }: { recipe?: RecipeWithPhoto; onSave: RecipeLibrary['save'] }) {
  const [manualDraft, setManualDraft] = useState(() => createDraft(recipe))
  const [mode, setMode] = useState<'manual' | 'paste' | 'review'>('manual')
  const [pastedText, setPastedText] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [importReview, setImportReview] = useState<PasteReview | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [manualPhoto, setManualPhoto] = useState<PhotoChange>(undefined)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const discard = useRef<HTMLDialogElement>(null)
  const replaceReview = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const errorSummary = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const review = mode === 'review' ? importReview : null
  const draft = review?.draft ?? manualDraft
  const photoChange = review ? review.photo : manualPhoto
  const photo = photoChange === undefined ? recipe?.photo ?? null : photoChange
  const servings = wholeNumber(draft.baseServings)
  const minutes = wholeNumber(draft.prepMinutes) + wholeNumber(draft.cookMinutes)
  const total = Number.isSafeInteger(minutes) ? minutes : null
  const errors = showErrors ? validateDraft(draft).errors : {}
  const invalid = Object.keys(errors).length > 0
  const busy = saving || photoBusy
  const returnTo = recipe ? `/recipes/${recipe.id}` : '/recipes'

  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = true
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function update<Key extends keyof RecipeDraft>(key: Key, value: RecipeDraft[Key]) {
    if (review) revise({ draft: { ...draft, [key]: value } })
    else setManualDraft((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  function revise(change: Partial<PasteReview>) {
    setImportReview((current) => current && { ...current, ...change, edited: true })
  }

  function selectMode(next: typeof mode) {
    if (next === mode) return
    setMode(next)
    setSaveError('')
    setShowErrors(false)
    setPhotoError('')
    window.scrollTo(0, 0)
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }))
  }

  function updatePaste(text: string) {
    setPastedText(text)
    setPasteError('')
    setDirty(true)
  }

  function startReview() {
    setImportReview(createPasteReview(pastedText))
    setDirty(true)
    selectMode('review')
  }

  function readPaste() {
    if (!pastedText.trim()) {
      setPasteError('Paste a recipe to start the review.')
    } else if (pastedText.length > 30_000 || pastedText.split(/\r\n?|\n|[\u2028\u2029]/u).filter((line) => line.trim()).length > 250) {
      setPasteError('Shorten the text to one recipe, up to 30,000 characters and 250 non-empty lines.')
    } else if (importReview?.source === pastedText) {
      selectMode('review')
    } else if (importReview?.edited) {
      replaceReview.current?.showModal()
    } else {
      startReview()
    }
  }

  function assignLine(line: UnclearLine, action: LineAction) {
    if (!review) return
    const unassigned = review.unassigned.filter(({ id }) => id !== line.id)
    const updated = { ...draft }
    if (action === 'title') updated.title = withoutListMarker(line.text)
    if (action === 'ingredient') {
      const row = { ...newIngredient(), ...parseIngredientLine(line.text), originalText: line.original }
      const [first] = draft.ingredients
      const placeholder = draft.ingredients.length === 1 && !first.name && !first.amount && !first.originalText && !first.unit && first.aisle === 'Other'
      updated.ingredients = placeholder ? [row] : [...draft.ingredients, row]
    }
    if (action === 'step') {
      const step = newStep(withoutListMarker(line.text))
      updated.steps = draft.steps.length === 1 && !draft.steps[0].text.trim() ? [step] : [...draft.steps, step]
    }
    revise({ draft: updated, unassigned, titleSource: action === 'title' ? line.original : review.titleSource })
    setSaveError('')
  }

  function changePhoto(photo: PhotoChange) {
    if (review) revise({ photo })
    else setManualPhoto(photo)
    setDirty(true)
  }

  function cancel() {
    if (dirty || photoBusy) discard.current?.showModal()
    else navigate(returnTo, { replace: true })
  }

  async function choosePhoto(file: File) {
    setPhotoBusy(true)
    setPhotoError('')
    try {
      changePhoto(await preparePhoto(file))
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'The photo could not be prepared.'
      setPhotoError(`${reason} ${photo ? 'Your current photo is still selected.' : 'You can save without a photo.'}`)
    } finally {
      setPhotoBusy(false)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || mode === 'paste') return
    setSaveError('')
    if (review?.unassigned.length) {
      setSaveError('Assign or remove the unclear lines before saving.')
      requestAnimationFrame(() => errorSummary.current?.focus())
      return
    }
    const validation = validateDraft(draft)
    if (!validation.recipe) {
      setShowErrors(true)
      requestAnimationFrame(() => errorSummary.current?.focus())
      return
    }
    setSaving(true)
    try {
      const saved = await onSave(validation.recipe, photoChange, recipe?.id)
      setDirty(false)
      navigate(`/recipes/${saved.id}`, { replace: true })
    } catch (error) {
      setSaveError(recipeWriteError(error, 'save the recipe'))
      requestAnimationFrame(() => errorSummary.current?.focus())
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="editor-header">
        <div className="editor-header-inner">
          <button className="editor-cancel" type="button" disabled={saving} aria-label="Cancel" onClick={cancel}><X size={18} aria-hidden="true" /> <span>Cancel</span></button>
          <div className="editor-heading">
            <h1 ref={heading} tabIndex={-1}>{review ? 'Review recipe' : recipe ? 'Edit recipe' : 'Add recipe'}</h1>
            {review && <p>Unsaved changes</p>}
          </div>
          {mode !== 'paste' && <button className="button primary-button" type="submit" form="recipe-form" disabled={busy}><Check size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save recipe'}</button>}
        </div>
      </header>

      <div className="editor-layout">
        {mode === 'paste' ? (
          <div className="editor-form paste-flow">
            <EntryOptions mode="paste" onChange={selectMode} />
            <PasteInput text={pastedText} error={pasteError} onChange={updatePaste} onRead={readPaste} onResume={importReview ? () => selectMode('review') : undefined} />
          </div>
        ) : <>
        <form id="recipe-form" className="editor-form" noValidate onSubmit={(event) => void save(event)} onKeyDown={(event) => {
          if (review && event.key === 'Enter' && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) event.preventDefault()
        }}>
          <fieldset className="editor-fields" disabled={saving}>
            {!recipe && !review && <EntryOptions mode="manual" disabled={busy} onChange={selectMode} />}
            {review && <ReviewNotice review={review} busy={busy} onBack={() => selectMode('paste')} />}

            {(invalid || saveError) && <div className="form-error editor-error-summary" role="alert" tabIndex={-1} ref={errorSummary}>
              {saveError || 'Check the highlighted fields before saving.'}
            </div>}

            {review && review.unassigned.length > 0 && <UnclearLines lines={review.unassigned} canUseTitle={!draft.title.trim()}
              onChange={(id, text) => revise({ unassigned: review.unassigned.map((line) => line.id === id ? { ...line, text } : line) })}
              onAssign={assignLine} />}

            <section className="editor-panel editor-details" aria-labelledby="details-heading">
              <h2 id="details-heading">Details</h2>
              <label>Recipe title
                <input aria-label="Recipe title" placeholder="e.g. Dal Tadka" value={draft.title} onChange={(event) => update('title', event.target.value)} {...fieldError(errors, 'title')} />
                <FieldError errors={errors} id="title" />
                {review?.titleSource && <span className="editor-help source-note">From “{review.titleSource}”</span>}
              </label>

              <div className="photo-field">
                <p className="editor-label">Photo <span>(optional)</span></p>
                <div className="photo-picker">
                  <RecipeImage photo={photo} motif={recipe?.motif} />
                  <div>
                    <input type="file" hidden ref={fileInput} accept="image/jpeg,image/png,image/webp" aria-label="Recipe photo" onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file) void choosePhoto(file)
                    }} />
                    <button className="button" type="button" disabled={photoBusy} onClick={() => fileInput.current?.click()}><Plus size={16} aria-hidden="true" /> {photo ? 'Replace photo' : 'Choose photo'}</button>
                    {photo && <button className="text-button" type="button" disabled={photoBusy} onClick={() => {
                      changePhoto(null)
                      setPhotoError('')
                    }}>Remove photo</button>}
                    <p className="editor-help">JPG, PNG or WebP, up to 10 MB. Cards use an illustration until you add a photo.</p>
                    {photoBusy && <p className="editor-help" role="status">Preparing photo…</p>}
                  </div>
                </div>
                {photoError && <p className="field-error" role="alert">{photoError}</p>}
              </div>

              <div className="editor-numbers">
                <div>
                  <label htmlFor="base-servings">Servings</label>
                  <div className="servings-control">
                    <button className="icon-button" type="button" disabled={!(servings > 1)} aria-label="Fewer servings" onClick={() => update('baseServings', String(servings - 1))}><Minus size={16} aria-hidden="true" /></button>
                    <input id="base-servings" inputMode="numeric" value={draft.baseServings} onChange={(event) => update('baseServings', event.target.value)} {...fieldError(errors, 'baseServings')} />
                    <button className="icon-button" type="button" disabled={servings === Number.MAX_SAFE_INTEGER} aria-label="More servings" onClick={() => update('baseServings', String(servings > 0 ? servings + 1 : 1))}><Plus size={16} aria-hidden="true" /></button>
                  </div>
                  <FieldError errors={errors} id="baseServings" />
                </div>
                {(['prepMinutes', 'cookMinutes'] as const).map((key) => (
                  <label key={key}>{key === 'prepMinutes' ? 'Prep time' : 'Cook time'}
                    <span className="minutes-field"><input inputMode="numeric" value={draft[key]} onChange={(event) => update(key, event.target.value)} {...fieldError(errors, key)} /><span aria-hidden="true">min</span></span>
                    <FieldError errors={errors} id={key} />
                  </label>
                ))}
              </div>
              <div className="total-time-group">
                <p className="editor-help total-time"><Timer size={15} aria-hidden="true" /> {total === null ? 'Total time appears once both times are numbers' : `${total} min total`}</p>
                {review && review.timeSources.length > 0 && <p className="editor-help source-note">From “{review.timeSources.join(' · ')}”</p>}
              </div>

              <SelectField label="Cuisine" options={cuisines} value={draft.cuisine} onChange={(value) => update('cuisine', value)} />
              <fieldset className="editor-choices">
                <legend>Meal type</legend>
                <div className="meal-choices">{mealTypes.map((meal) => (
                  <label key={meal}><input type="radio" name="meal-type" checked={draft.meal === meal} onChange={() => update('meal', meal)} /><span>{meal}</span></label>
                ))}</div>
              </fieldset>
              <fieldset className="editor-choices">
                <legend>Dietary tag</legend>
                <div className="diet-choices">{diets.map((diet) => (
                  <label key={diet}><input type="radio" name="dietary-tag" checked={draft.diet === diet} onChange={() => update('diet', diet)} /><span><DietIcon diet={diet} /> {diet}{draft.diet === diet && <Check className="choice-check" size={16} aria-hidden="true" />}</span></label>
                ))}</div>
              </fieldset>
            </section>

            <section className="editor-panel" aria-labelledby="ingredients-heading">
              <div className="editor-panel-heading"><h2 id="ingredients-heading">Ingredients</h2><span>{draft.ingredients.filter(({ name }) => name.trim()).length} of {draft.ingredients.length} named</span></div>
              <FieldError errors={errors} id="ingredients" />
              {draft.ingredients.map((row, index) => (
                <IngredientRow key={row.id} row={row} index={index} errors={errors} fromPaste={Boolean(review)}
                  onChange={(change) => update('ingredients', draft.ingredients.map((item) => item.id === row.id ? { ...item, ...change } : item))}
                  onRemove={() => update('ingredients', draft.ingredients.filter(({ id }) => id !== row.id))} />
              ))}
              <button className="button editor-add-row" type="button" onClick={() => update('ingredients', [...draft.ingredients, newIngredient()])}><Plus size={17} aria-hidden="true" /> Add ingredient</button>
            </section>

            <MethodRows steps={draft.steps} errors={errors} onChange={(steps) => update('steps', steps)} />
            <button className="button primary-button editor-save" type="submit" disabled={busy}><Check size={18} aria-hidden="true" /> {saving ? 'Saving…' : 'Save recipe'}</button>
            <p className="editor-help editor-save-note">Recipes are saved on this device.</p>
          </fieldset>
        </form>

        <aside className="editor-preview" aria-label="Card preview">
          <h2>Card preview</h2>
          <div className="recipe-card">
            <RecipeImage photo={photo} motif={recipe?.motif} />
            <div className="recipe-card-body">
              <h3>{draft.title.trim() || 'Untitled recipe'}</h3>
              <div className="recipe-meta">
                <span className="recipe-time"><Timer size={15} aria-hidden="true" /> {total === null ? 'Add times' : `${total} min total`}</span>
                <DietTag diet={draft.diet} />
              </div>
            </div>
          </div>
          <p className="editor-help">This is how the recipe appears in your Recipe Box.</p>
        </aside>
        </>}
      </div>

      <ConfirmDialog dialogRef={discard} title="Discard unsaved changes?" description="Your edits will be lost if you leave the editor." cancelLabel="Keep editing" confirmLabel="Discard changes" onConfirm={() => navigate(returnTo, { replace: true })} />
      {importReview && <ConfirmDialog dialogRef={replaceReview} title="Replace the current review?" description="Reading the new text will replace the edits you made to the previous review." cancelLabel="Keep current review" confirmLabel="Read new text" onConfirm={startReview} />}
    </>
  )
}
