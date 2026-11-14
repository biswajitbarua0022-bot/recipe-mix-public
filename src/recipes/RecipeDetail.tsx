import { useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, Copy, Ellipsis, Flame, Heart, Library, Minus, Pencil, Plus, ShoppingBasket, Timer, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CookbookPicker } from '../cookbooks/Cookbooks'
import type { MealSlot, RecipeImpact } from '../data/organizer'
import { recipeWriteError } from '../data/use-recipe-library'
import type { ReadyLibrary } from '../data/use-recipe-library'
import { formatSlotDate } from '../planner/calendar'
import { MealDialog } from '../planner/MealDialog'
import { IngredientList } from './IngredientList'
import { totalMinutes } from './recipe'
import type { RecipeWithPhoto } from './recipe'
import { DietTag } from './RecipeCard'
import { RecipeImage } from './RecipeImage'
import { scaleIngredients } from './scale-ingredients'
import './recipe-detail.css'

export function RecipeDetail({ recipe, library, servings, onServingsChange }: {
  recipe: RecipeWithPhoto
  library: ReadyLibrary
  servings: number
  onServingsChange: (servings: number) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<'plan' | 'cookbooks' | null>(null)
  const [planned, setPlanned] = useState<MealSlot | null>(null)
  const [deleteImpact, setDeleteImpact] = useState<RecipeImpact | null>(null)
  const confirmation = useRef<HTMLDialogElement>(null)
  const actions = useRef<HTMLDetailsElement>(null)
  const actionToggle = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const path = `/recipes/${recipe.id}`
  const ingredients = scaleIngredients(recipe, servings)
  const membershipCount = library.state.memberships.filter(({ recipeId }) => recipeId === recipe.id).length

  function closeActions() {
    actionToggle.current?.focus()
    if (actions.current) actions.current.open = false
  }

  async function write(action: string, operation: () => Promise<void>) {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await operation()
    } catch (error) {
      setError(recipeWriteError(error, action))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="recipe-detail" aria-labelledby="recipe-title">
      <header className="detail-bar">
        <div className="detail-width detail-bar-inner">
          <Link className="back-link" to="/recipes"><ChevronLeft size={18} aria-hidden="true" /> Recipe Box</Link>
          <div className="detail-bar-actions">
            <button className="icon-button detail-favourite" type="button" disabled={pending} aria-label="Favourite" aria-pressed={recipe.favourite} onClick={() => void write('update favourites', () => library.favourite(recipe.id, !recipe.favourite))}>
              <Heart size={19} fill={recipe.favourite ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
            <details className="detail-actions" ref={actions} onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
            }} onKeyDown={(event) => {
              if (event.key === 'Escape' && event.currentTarget.open) closeActions()
            }}>
              <summary className="icon-button" aria-label="Recipe actions" ref={actionToggle}><Ellipsis size={23} aria-hidden="true" /></summary>
              <div className="detail-menu">
                <Link to={`${path}/edit`} onClick={closeActions}><Pencil size={16} aria-hidden="true" /> Edit recipe</Link>
                <button type="button" disabled={pending} onClick={() => {
                  closeActions()
                  void write('duplicate the recipe', async () => {
                    const copy = await library.duplicate(recipe.id)
                    navigate(`/recipes/${copy.id}`)
                  })
                }}><Copy size={16} aria-hidden="true" /> Duplicate</button>
                <button className="delete-recipe" type="button" disabled={pending} onClick={() => {
                  closeActions()
                  void write('check where this recipe is used', async () => {
                    setDeleteImpact(await library.getRecipeImpact(recipe.id))
                    confirmation.current?.showModal()
                  })
                }}><Trash2 size={16} aria-hidden="true" /> Delete</button>
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="detail-width detail-content">
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="detail-hero">
          <div className={`detail-cover${recipe.photo ? '' : ' illustrated'}`}>
            <RecipeImage photo={recipe.photo} motif={recipe.motif} />
            {!recipe.photo && <Link className="button detail-photo-link" to={`${path}/edit`}><Plus size={16} aria-hidden="true" /> Add a photo</Link>}
          </div>
          <div className="detail-intro">
            <p className="detail-eyebrow">{recipe.meal} · {recipe.cuisine}</p>
            <h1 id="recipe-title">{recipe.title}</h1>
            <div className="detail-meta">
              <span className="detail-pill"><Timer size={15} aria-hidden="true" /> <strong>{totalMinutes(recipe)} min total</strong> <span>· {recipe.prepMinutes} prep, {recipe.cookMinutes} cook</span></span>
              <span className="detail-pill">{recipe.cuisine}</span>
              <DietTag diet={recipe.diet} />
            </div>
            <div className="detail-main-actions">
              {recipe.steps.length > 0 && <div className="detail-start">
                <Link className="button primary-button" to={`${path}/cook?servings=${servings}`}><Flame size={17} aria-hidden="true" /> Start cooking</Link>
              </div>}
              <button className="button" type="button" disabled={pending} onClick={() => setDialog('plan')}><CalendarDays size={17} aria-hidden="true" /> Add to plan</button>
              <button className="button" type="button" disabled={pending} onClick={() => setDialog('cookbooks')}><Library size={17} aria-hidden="true" /> {membershipCount ? `In ${membershipCount} ${membershipCount === 1 ? 'cookbook' : 'cookbooks'}` : 'Add to cookbook'}</button>
            </div>
            {planned && <div className="planner-notice"><p role="status">Meal saved for {formatSlotDate(planned.date)} · {planned.meal.toLowerCase()}.</p><Link className="back-link" to={`/planner?date=${planned.date}`}>View plan</Link></div>}
          </div>
        </div>

        <div className="detail-reading">
          <section className="detail-panel" aria-labelledby="ingredient-heading">
            <div className="detail-panel-heading">
              <h2 id="ingredient-heading">Ingredients</h2>
              <div className="detail-servings" role="group" aria-label="Adjust servings">
                <button className="icon-button" type="button" aria-label="Fewer servings" disabled={servings <= 1} onClick={() => onServingsChange(servings - 1)}><Minus size={16} aria-hidden="true" /></button>
                <output>{servings} {servings === 1 ? 'serving' : 'servings'}</output>
                <button className="icon-button" type="button" aria-label="More servings" disabled={servings >= Number.MAX_SAFE_INTEGER} onClick={() => onServingsChange(servings + 1)}><Plus size={16} aria-hidden="true" /></button>
              </div>
            </div>
            {servings !== recipe.baseServings && <p className="detail-scaling">Scaled from the original {recipe.baseServings} {recipe.baseServings === 1 ? 'serving' : 'servings'}. To-taste amounts and cooking times stay the same.</p>}
            <IngredientList ingredients={ingredients} />
            <div className="detail-grocery">
              <Link className="button" to="/groceries"><ShoppingBasket size={16} aria-hidden="true" /> Open Groceries</Link>
              <p className="detail-hint">Plan this recipe to include it in your weekly grocery list.</p>
            </div>
          </section>

          <section className="detail-panel" aria-labelledby="method-heading">
            <div className="detail-panel-heading">
              <h2 id="method-heading">Method</h2>
              <span className="detail-hint">{recipe.steps.length} {recipe.steps.length === 1 ? 'step' : 'steps'}</span>
            </div>
            {recipe.steps.length > 0 ? <ol className="detail-method" role="list">
              {recipe.steps.map((step, index) => <li key={index}>
                <span className="detail-step-number" aria-hidden="true">{index + 1}</span><p>{step}</p>
              </li>)}
            </ol> : <p className="detail-hint">Add steps in the editor to start cooking.</p>}
          </section>
        </div>
      </div>

      {dialog === 'cookbooks' && <CookbookPicker library={library} recipe={recipe} onClose={() => setDialog(null)} />}
      {dialog === 'plan' && <MealDialog library={library} entry={{ recipe, servings }} onClose={() => setDialog(null)} onSaved={(slot) => {
        setPlanned(slot)
        setDialog(null)
      }} />}
      <ConfirmDialog dialogRef={confirmation} title={`Delete ${recipe.title}?`} description="This removes the recipe, its photo, and the cookbook and meal links shown below." cancelLabel="Keep recipe" confirmLabel="Delete recipe" onConfirm={() => {
        if (!deleteImpact) return
        void write('delete the recipe', async () => {
          await library.remove(recipe.id, deleteImpact)
          navigate('/recipes', { replace: true })
        })
      }}>
        {deleteImpact && <ul className="organizer-impact">
          <li><strong>{deleteImpact.cookbooks.length} {deleteImpact.cookbooks.length === 1 ? 'cookbook' : 'cookbooks'}</strong></li>
          {deleteImpact.cookbooks.map((book) => <li key={book.id}>{book.name}</li>)}
          <li><strong>{deleteImpact.slots.length} planned {deleteImpact.slots.length === 1 ? 'meal' : 'meals'}</strong></li>
          {deleteImpact.slots.map((slot) => <li key={`${slot.date}/${slot.meal}`}>{formatSlotDate(slot.date)} · {slot.meal} · serves {slot.servings}</li>)}
        </ul>}
      </ConfirmDialog>
    </section>
  )
}
