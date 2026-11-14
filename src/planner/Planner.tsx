import { useId, useRef, useState } from 'react'
import { Ellipsis, Plus, ShoppingBasket } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useOrganizerAction } from '../components/use-organizer-action'
import { generateGroceryWeek } from '../data/grocery-store'
import { orderSlots, plannerMeals } from '../data/organizer'
import type { MealSlot, SlotKey } from '../data/organizer'
import type { ReadyLibrary } from '../data/use-recipe-library'
import { GroceryStaleNotice } from '../groceries/Groceries'
import { useGroceryWeek } from '../groceries/use-grocery-week'
import { totalMinutes } from '../recipes/recipe'
import type { RecipeWithPhoto } from '../recipes/recipe'
import { RecipeImage } from '../recipes/RecipeImage'
import { formatDay, formatWeek, formatWeekday, isPlannerDate, localDateKey, weekDates } from './calendar'
import { MealDialog } from './MealDialog'
import type { MealEntry } from './MealDialog'
import { DayPicker, WeekBar } from './WeekControls'
import './planner.css'

type ClearRange = { from: string; through: string; meals: MealSlot[]; scope: 'day' | 'week' }

function PlanCell({ target, slot, recipe, onOpen }: { target: SlotKey; slot?: MealSlot; recipe?: RecipeWithPhoto; onOpen: () => void }) {
  const description = useId()
  const day = formatDay(target.date)
  const meal = target.meal.toLowerCase()
  return (
    <div className="plan-cell">
      <span className="plan-cell-label">{target.meal}</span>
      {slot && recipe ? <>
        <button className="plan-slot filled" type="button" aria-describedby={description} onClick={onOpen}>
          <RecipeImage photo={recipe.photo} motif={recipe.motif} />
          <span className="plan-slot-text"><strong>{recipe.title}</strong><small>Serves {slot.servings}<span className="mobile-slot-time"> · {totalMinutes(recipe)} min</span></small></span>
          <Ellipsis size={21} className="mobile-slot-menu" aria-hidden="true" />
        </button>
        <span id={description} hidden>{day} {meal}, meal options</span>
      </> : (
        <button className="plan-slot empty" type="button" aria-label={`Add ${meal}, ${day}`} onClick={onOpen}><Plus size={18} aria-hidden="true" /> <span>Add<span className="mobile-slot-time"> {meal}</span></span></button>
      )}
    </div>
  )
}

export function Planner({ library }: { library: ReadyLibrary }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<MealEntry | null>(null)
  const [clear, setClear] = useState<ClearRange | null>(null)
  const [notice, setNotice] = useState('')
  const [undo, setUndo] = useState<MealSlot | null>(null)
  const confirmation = useRef<HTMLDialogElement>(null)
  const { busy, error, run } = useOrganizerAction()
  const today = localDateKey()
  const requested = params.get('date') ?? ''
  const date = isPlannerDate(requested) ? requested : today
  const dates = weekDates(date)
  const monday = dates[0]
  const sunday = dates[6]
  const weekMeals = library.state.mealSlots.filter((slot) => slot.date >= monday && slot.date <= sunday)
  const recipes = new Map(library.state.recipes.map((recipe) => [recipe.id, recipe]))
  const { state: groceryState, retry: retryGroceries } = useGroceryWeek(monday, library.state.mealSlots)
  const groceryWeek = groceryState.status === 'ready' ? groceryState.snapshot : null
  const generated = Boolean(groceryWeek?.generationId)
  const groceryLink = `/groceries?date=${date}`

  function generateGroceries() {
    void run('generate the grocery list', async () => {
      await generateGroceryWeek(monday)
      navigate(groceryLink)
    })
  }

  function selectDate(next: string) {
    setParams(next === today ? {} : { date: next }, { replace: true })
    setNotice('')
    setUndo(null)
  }

  function confirmClear(from: string, through: string, scope: ClearRange['scope']) {
    const meals = weekMeals.filter((slot) => slot.date >= from && slot.date <= through).sort(orderSlots)
    if (!meals.length) return
    setClear({ from, through, scope, meals })
    confirmation.current?.showModal()
  }

  return (
    <section className="meal-planner organizer-controls">
      <header className="collection-heading planner-heading">
        <div><h1>Planner</h1><p>{weekMeals.length} of 21 meals planned this week</p></div>
        <div className="planner-grocery-action">
          {generated && !groceryWeek?.stale ? <Link className="button primary-button" to={groceryLink}><ShoppingBasket size={17} aria-hidden="true" /> Open grocery list</Link>
            : <button className="button primary-button" type="button" disabled={busy || groceryState.status !== 'ready' || (!weekMeals.length && !generated)} onClick={generateGroceries}>
              <ShoppingBasket size={17} aria-hidden="true" /> {generated ? 'Refresh grocery list' : 'Generate grocery list'}
            </button>}
        </div>
      </header>
      <WeekBar date={date} onSelect={selectDate} disabled={busy} hasMeals={!busy && weekMeals.length > 0} clearWeek={() => confirmClear(monday, sunday, 'week')} />
      {generated && groceryWeek?.stale && <GroceryStaleNotice busy={busy} onRefresh={generateGroceries} savedList={groceryLink} />}
      {groceryState.status === 'error' && <div className="form-error" role="alert">Could not open this week’s grocery list. <button className="text-button" type="button" onClick={retryGroceries}>Try again</button></div>}
      <div className="planner-day-picker"><DayPicker date={date} onSelect={selectDate} slots={weekMeals} /></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <div className="planner-notice"><p role="status">{notice}</p>{undo && <button className="text-button" type="button" disabled={busy} onClick={() => void run('restore this meal', async () => {
        await library.saveMeal(undo)
        setUndo(null)
        setNotice('Meal restored.')
      })}>Undo</button>}</div>}
      <div className="planner-grid">
        <div className="planner-row-labels" aria-hidden="true"><span />{plannerMeals.map((meal) => <span key={meal}>{meal}</span>)}</div>
        {dates.map((day) => {
          const dayMeals = weekMeals.filter((slot) => slot.date === day)
          return <section className={`plan-day${day === date ? ' selected' : ''}`} key={day} aria-label={formatDay(day)}>
            <header className={`plan-day-header${day === today ? ' today' : ''}`}>
              <div className="desktop-day-label"><span>{formatWeekday(day)}</span><strong>{Number(day.slice(-2))}</strong>{day === today && <small>Today</small>}</div>
              <h2 className="mobile-day-label">{formatDay(day)}{day === today ? ' · Today' : ''}</h2>
              <button className="text-button clear-day" type="button" aria-label={`Clear day, ${formatDay(day)}`} disabled={busy || dayMeals.length === 0} onClick={() => confirmClear(day, day, 'day')}>Clear day</button>
            </header>
            {plannerMeals.map((meal) => {
              const existing = dayMeals.find((slot) => slot.meal === meal)
              const target = { date: day, meal }
              return <PlanCell key={meal} target={target} slot={existing} recipe={existing ? recipes.get(existing.recipeId) : undefined} onOpen={() => setEntry({ slot: target, existing })} />
            })}
          </section>
        })}
      </div>
      {entry && <MealDialog library={library} entry={entry} onClose={() => setEntry(null)} onSaved={(slot) => {
        setEntry(null)
        setUndo(null)
        setNotice(`${recipes.get(slot.recipeId)?.title ?? 'Meal'} saved for ${formatDay(slot.date)} ${slot.meal.toLowerCase()}.`)
      }} onRemoved={(slot) => {
        setEntry(null)
        setUndo(slot)
        setNotice(`${recipes.get(slot.recipeId)?.title ?? 'Meal'} removed from ${formatDay(slot.date)} ${slot.meal.toLowerCase()}.`)
      }} />}
      <ConfirmDialog dialogRef={confirmation} title={clear?.scope === 'week' ? `Clear the week of ${formatWeek(clear.from)}?` : clear ? `Clear ${formatDay(clear.from)}?` : 'Clear meals?'}
        description={clear?.scope === 'week' ? 'This removes the planned meals for this week. Other weeks and your Recipe Box stay as they are.' : 'This removes the planned meals for this day. Your recipes stay in Recipe Box.'}
        cancelLabel="Keep meals" confirmLabel={clear?.scope === 'week' ? 'Clear week' : 'Clear day'} onConfirm={() => {
          if (!clear) return
          void run('clear the planned meals', async () => {
            await library.clearMeals(clear.from, clear.through, clear.meals)
            setUndo(null)
            setNotice(`${clear.meals.length} ${clear.meals.length === 1 ? 'meal' : 'meals'} cleared.`)
          })
        }}>
        {clear && <ul className="organizer-impact">{clear.meals.map((slot) => <li key={`${slot.date}/${slot.meal}`}>{formatWeekday(slot.date)} · {slot.meal} · <strong>{recipes.get(slot.recipeId)?.title ?? 'Recipe'}</strong> · serves {slot.servings}</li>)}</ul>}
      </ConfirmDialog>
    </section>
  )
}
