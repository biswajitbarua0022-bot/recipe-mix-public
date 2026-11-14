import { useState } from 'react'
import { BriefcaseBusiness, Minus, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { OrganizerDialog, PickerSearch, RecipeChoice } from '../components/OrganizerDialog'
import { useOrganizerAction } from '../components/use-organizer-action'
import { plannerMeals } from '../data/organizer'
import type { MealSlot, PlannerMeal, SlotKey } from '../data/organizer'
import type { ReadyLibrary } from '../data/use-recipe-library'
import { emptyFilters, filterRecipes } from '../recipes/filter-recipes'
import type { RecipeWithPhoto } from '../recipes/recipe'
import { RecipeImage } from '../recipes/RecipeImage'
import { isServingCount } from '../recipes/scale-ingredients'
import { formatSlotDate, formatWeekday, localDateKey } from './calendar'
import { DayPicker, WeekBar } from './WeekControls'
import './planner.css'

export type MealEntry = { slot: SlotKey; existing?: MealSlot } | { recipe: RecipeWithPhoto; servings: number }

function ServingsField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const count = Number(value)
  const valid = isServingCount(count)
  return (
    <div className="slot-servings" role="group" aria-label="Servings for this meal">
      <button type="button" className="icon-button" aria-label="Fewer servings" disabled={disabled || !valid || count <= 1} onClick={() => onChange(String(count - 1))}><Minus size={16} aria-hidden="true" /></button>
      <label>Serves <input type="number" min="1" step="1" inputMode="numeric" aria-label="Servings" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>
      <button type="button" className="icon-button" aria-label="More servings" disabled={disabled || count >= Number.MAX_SAFE_INTEGER} onClick={() => onChange(String(valid ? count + 1 : 1))}><Plus size={16} aria-hidden="true" /></button>
    </div>
  )
}

export function MealDialog({ library, entry, onClose, onSaved, onRemoved }: {
  library: ReadyLibrary
  entry: MealEntry
  onClose: () => void
  onSaved: (slot: MealSlot) => void
  onRemoved?: (slot: MealSlot) => void
}) {
  const fixed = 'slot' in entry ? entry.slot : undefined
  const preset = 'recipe' in entry ? entry.recipe : undefined
  const original = 'slot' in entry ? entry.existing : undefined
  const [date, setDate] = useState(fixed?.date ?? localDateKey())
  const [meal, setMeal] = useState<PlannerMeal>(() => fixed?.meal ?? (preset && preset.meal !== 'Snack' ? preset.meal : 'Dinner'))
  const [recipeId, setRecipeId] = useState(original?.recipeId ?? preset?.id ?? '')
  const [servings, setServings] = useState(String('recipe' in entry ? entry.servings : original?.servings ?? 1))
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState(Boolean(original))
  const [replacement, setReplacement] = useState<{ previous: MealSlot; next: MealSlot } | null>(null)
  const { busy, error, run } = useOrganizerAction()

  const current = fixed ? original : library.state.mealSlots.find((slot) => slot.date === date && slot.meal === meal)
  const recipes = library.state.recipes
  const selected = recipes.find(({ id }) => id === recipeId)
  const currentRecipe = recipes.find(({ id }) => id === current?.recipeId)
  const valid = Boolean(selected) && isServingCount(Number(servings))
  const subtitle = `${formatSlotDate(date)} · ${meal}`
  const mealName = meal.toLowerCase()
  const sameRecipe = current?.recipeId === recipeId

  function save(next: MealSlot, expected?: MealSlot) {
    void run('save this meal', async () => {
      await library.saveMeal(next, expected)
      onSaved(next)
    })
  }

  function submit() {
    if (!valid || busy) return
    const next = { date, meal, recipeId, servings: Number(servings) }
    if (current && !sameRecipe) setReplacement({ previous: current, next })
    else save(next, current)
  }

  const feedback = error && <p className="form-error" role="alert">{error}</p>
  if (replacement) {
    return (
      <OrganizerDialog title={`Replace ${formatWeekday(date)} ${mealName}?`} subtitle={subtitle} busy={busy} onClose={onClose} footer={<>
        <button className="button" type="button" disabled={busy} onClick={() => setReplacement(null)}>Keep current meal</button>
        <button className="button primary-button" type="button" disabled={busy} onClick={() => save(replacement.next, replacement.previous)}>Replace meal</button>
      </>}>
        <p className="organizer-hint">Replace <strong>{currentRecipe?.title ?? 'the current meal'}</strong> (serves {replacement.previous.servings}) with <strong>{selected?.title}</strong> (serves {replacement.next.servings})?</p>
        {feedback}
      </OrganizerDialog>
    )
  }

  if (options && original) {
    return (
      <OrganizerDialog title={currentRecipe?.title ?? 'Meal options'} subtitle={subtitle} busy={busy} onClose={onClose} footer={<>
        <button className="button" type="button" disabled={busy} onClick={onClose}>Cancel</button>
        <button className="button dark-button" type="button" disabled={busy || !valid || Number(servings) === original.servings} onClick={submit}>Save servings</button>
      </>}>
        <div className="meal-options-servings">
          <div className="organizer-thumb"><RecipeImage photo={currentRecipe?.photo ?? null} motif={currentRecipe?.motif} /></div>
          <ServingsField value={servings} onChange={setServings} disabled={busy} />
        </div>
        <div className="meal-options-actions">
          {currentRecipe && <Link className="button" to={`/recipes/${original.recipeId}?servings=${original.servings}`}><BriefcaseBusiness size={17} aria-hidden="true" /> View recipe</Link>}
          <button className="button" type="button" disabled={busy} onClick={() => setOptions(false)}><RefreshCcw size={17} aria-hidden="true" /> Replace meal</button>
          <button className="button delete-recipe" type="button" disabled={busy} onClick={() => void run('remove this meal', async () => {
            await library.removeMeal(original)
            onRemoved?.(original)
          })}><Trash2 size={17} aria-hidden="true" /> Remove meal</button>
        </div>
        {feedback}
      </OrganizerDialog>
    )
  }

  const matches = filterRecipes(recipes, query, emptyFilters, false)
  const title = preset ? `Add ${preset.title} to the plan` : current ? `Replace ${mealName}` : `Add ${mealName}`
  const buttonLabel = current ? sameRecipe ? 'Save servings' : 'Review replacement' : `Add to ${formatWeekday(date)} ${mealName}`
  return (
    <OrganizerDialog title={title} subtitle={subtitle} busy={busy} onClose={onClose} footer={<>
      <ServingsField value={servings} onChange={setServings} disabled={busy} />
      <button className="button dark-button" type="button" disabled={busy || !valid} onClick={submit}>{buttonLabel}</button>
    </>}>
      {!fixed && <div className="slot-when">
        <WeekBar date={date} onSelect={setDate} disabled={busy} />
        <DayPicker date={date} onSelect={setDate} slots={library.state.mealSlots} disabled={busy} />
        <div className="slot-meal-choices" role="group" aria-label="Choose a meal">
          {plannerMeals.map((item) => {
            const planned = library.state.mealSlots.find((slot) => slot.date === date && slot.meal === item)
            const plannedRecipe = recipes.find(({ id }) => id === planned?.recipeId)
            return <button type="button" key={item} disabled={busy} aria-pressed={item === meal} onClick={() => setMeal(item)}><strong>{item}</strong><small>{plannedRecipe?.title ?? 'Free'}</small></button>
          })}
        </div>
      </div>}
      {currentRecipe && <p className="plan-warning">Currently planned · {currentRecipe.title} (serves {current?.servings})</p>}
      <PickerSearch label="Search recipes or ingredients" query={query} onChange={setQuery} />
      {matches.map((recipe) => <RecipeChoice key={recipe.id} recipe={recipe} type="radio" checked={recipe.id === recipeId} disabled={busy} onChange={() => {
        setRecipeId(recipe.id)
        setServings(String(recipe.id === original?.recipeId ? original.servings : recipe.id === preset?.id && 'recipe' in entry ? entry.servings : recipe.baseServings))
      }} />)}
      {matches.length === 0 && <p className="organizer-hint">{query.trim() ? 'No recipes match this search.' : 'Add a recipe to Recipe Box first.'}</p>}
      {feedback}
    </OrganizerDialog>
  )
}
