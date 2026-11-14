import { useId, useRef, useState } from 'react'
import { BookOpen, BriefcaseBusiness, ChevronLeft, Ellipsis, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ChoiceRow, OrganizerDialog, PickerSearch, RecipeChoice } from '../components/OrganizerDialog'
import { useOrganizerAction } from '../components/use-organizer-action'
import type { Cookbook } from '../data/organizer'
import type { ReadyLibrary } from '../data/use-recipe-library'
import { emptyFilters, filterRecipes } from '../recipes/filter-recipes'
import { totalMinutes } from '../recipes/recipe'
import type { RecipeWithPhoto } from '../recipes/recipe'
import { DietTag } from '../recipes/RecipeCard'
import { RecipeImage } from '../recipes/RecipeImage'
import './cookbooks.css'

function cookbookRecipes(library: ReadyLibrary, cookbookId: string) {
  const recipeIds = new Set(library.state.memberships.filter((item) => item.cookbookId === cookbookId).map(({ recipeId }) => recipeId))
  return library.state.recipes.filter(({ id }) => recipeIds.has(id))
}

function sortedCookbooks(library: ReadyLibrary) {
  return [...library.state.cookbooks].sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name))
}

function recipeCount(count: number) { return `${count} ${count === 1 ? 'recipe' : 'recipes'}` }

function toggleSelection(current: Set<string>, id: string) {
  const next = new Set(current)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

function NameCookbook({ library, book, onClose }: { library: ReadyLibrary; book?: Cookbook; onClose: () => void }) {
  const [name, setName] = useState(book?.name ?? '')
  const { busy, error, run } = useOrganizerAction()
  const formId = useId()
  return (
    <OrganizerDialog title={book ? 'Rename cookbook' : 'Create cookbook'} busy={busy} onClose={onClose}
      footer={<>
        <button className="button" type="button" disabled={busy} onClick={onClose}>Cancel</button>
        <button className="button dark-button" type="submit" form={formId} disabled={busy || !name.trim()}>{book ? 'Save name' : 'Create cookbook'}</button>
      </>}>
      <form id={formId} onSubmit={(event) => {
        event.preventDefault()
        void run('save the cookbook', async () => { await library.saveCookbook(name, book?.id); onClose() })
      }}>
        <label className="organizer-field">Cookbook name<input value={name} maxLength={60} placeholder="e.g. Weeknight dinners" onChange={(event) => setName(event.target.value)} /></label>
        <p className="organizer-count">{name.length}/60</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </OrganizerDialog>
  )
}

export function CookbookPicker({ library, recipe, onClose }: { library: ReadyLibrary; recipe: RecipeWithPhoto; onClose: () => void }) {
  const [initial] = useState(() => new Set(library.state.memberships.filter(({ recipeId }) => recipeId === recipe.id).map(({ cookbookId }) => cookbookId)))
  const [selected, setSelected] = useState(() => new Set(initial))
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const { busy, error, run } = useOrganizerAction()
  const cookbooks = sortedCookbooks(library).filter((book) => book.name.toLowerCase().includes(query.trim().toLowerCase()))
  const added = [...selected].filter((id) => !initial.has(id))
  const removed = [...initial].filter((id) => !selected.has(id))

  return (
    <OrganizerDialog title={`Add ${recipe.title} to cookbooks`} onClose={onClose} busy={busy} footer={<>
      <button className="button" type="button" onClick={onClose} disabled={busy}>Cancel</button>
      <button className="button dark-button" type="button" disabled={busy || added.length + removed.length === 0} onClick={() => void run('save cookbook memberships', async () => {
        await library.changeMemberships(added.map((cookbookId) => ({ cookbookId, recipeId: recipe.id })), removed.map((cookbookId) => ({ cookbookId, recipeId: recipe.id })))
        onClose()
      })}>Save cookbooks</button>
    </>}>
      <PickerSearch label="Search cookbooks" query={query} onChange={setQuery} />
      <p className="organizer-count">{selected.size} selected · {added.length} to add{removed.length > 0 ? ` · ${removed.length} to remove` : ''}</p>
      {cookbooks.map((book) => {
        const recipes = cookbookRecipes(library, book.id)
        return <ChoiceRow key={book.id} type="checkbox" title={book.name} caption={`${recipeCount(recipes.length)}${initial.has(book.id) ? ` · includes ${recipe.title}` : ''}`} image={recipes[0]} checked={selected.has(book.id)} disabled={busy} onChange={() => setSelected((current) => toggleSelection(current, book.id))} />
      })}
      {cookbooks.length === 0 && <p className="organizer-hint">{query.trim() ? 'No cookbooks match this search.' : 'Create a cookbook to start collecting recipes.'}</p>}
      {creating ? <form className="cookbook-inline-create" onSubmit={(event) => {
        event.preventDefault()
        void run('create the cookbook', async () => {
          const book = await library.saveCookbook(name)
          setSelected((current) => new Set([...current, book.id]))
          setCreating(false)
          setName('')
          setQuery('')
        })
      }}>
        <label className="organizer-field">Cookbook name<input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} /></label>
        <button className="button" type="submit" disabled={busy || !name.trim()}>Create cookbook</button>
      </form> : <button className="text-button" type="button" disabled={busy} onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> Create a new cookbook</button>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </OrganizerDialog>
  )
}

function AddRecipes({ library, book, onClose }: { library: ReadyLibrary; book: Cookbook; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(new Set<string>())
  const { busy, error, run } = useOrganizerAction()
  const existing = new Set(cookbookRecipes(library, book.id).map(({ id }) => id))
  const recipes = filterRecipes(library.state.recipes, query, emptyFilters, false)
  return (
    <OrganizerDialog title={`Add recipes to ${book.name}`} busy={busy} onClose={onClose} footer={<>
      <button className="button" type="button" disabled={busy} onClick={onClose}>Cancel</button>
      <button className="button dark-button" type="button" disabled={busy || selected.size === 0} onClick={() => void run('add recipes', async () => {
        await library.changeMemberships([...selected].map((recipeId) => ({ cookbookId: book.id, recipeId })))
        onClose()
      })}>{selected.size ? `Add ${recipeCount(selected.size)}` : 'Add recipes'}</button>
    </>}>
      <PickerSearch label="Search recipes or ingredients" query={query} onChange={setQuery} />
      <p className="organizer-count">{selected.size} to add · {recipeCount(recipes.length)} shown</p>
      {recipes.map((recipe) => <RecipeChoice key={recipe.id} recipe={recipe} type="checkbox" checked={existing.has(recipe.id) || selected.has(recipe.id)} disabled={busy || existing.has(recipe.id)} onChange={() => setSelected((current) => toggleSelection(current, recipe.id))} />)}
      {recipes.length === 0 && <p className="organizer-hint">{query.trim() ? 'No recipes match this search.' : 'Add a recipe to Recipe Box first.'}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </OrganizerDialog>
  )
}

function CookbookIndex({ library }: { library: ReadyLibrary }) {
  const [creating, setCreating] = useState(false)
  const books = sortedCookbooks(library)
  return (
    <section className="cookbooks-page cookbook-index">
      <header className="collection-heading">
        <div><h1>Cookbooks</h1><p>{books.length ? `${books.length} ${books.length === 1 ? 'cookbook' : 'cookbooks'} · a recipe can be in several` : 'Collections of your recipes'}</p></div>
        {books.length > 0 && <button className="button primary-button collection-primary" type="button" onClick={() => setCreating(true)}><Plus size={18} aria-hidden="true" /> Create cookbook</button>}
      </header>
      {books.length === 0 ? <div className="collection-empty">
        <BookOpen size={58} aria-hidden="true" />
        <h2>No cookbooks yet</h2>
        <p>Group recipes for weeknight dinners, family favourites, or festive menus.</p>
        <button className="button primary-button" type="button" onClick={() => setCreating(true)}><Plus size={18} aria-hidden="true" /> Create your first cookbook</button>
      </div> : <div className="cookbook-grid">
        {books.map((book) => {
          const recipes = cookbookRecipes(library, book.id)
          const [first, second, third] = recipes
          return <Link className="cookbook-card" key={book.id} to={`/cookbooks/${book.id}`}>
            <div className={`cookbook-art${first ? ' collage' : ''}`}>
              <RecipeImage photo={first?.photo ?? null} motif={first?.motif} />
              {first && <><RecipeImage photo={second?.photo ?? null} motif={second?.motif} /><RecipeImage photo={third?.photo ?? null} motif={third?.motif} /></>}
            </div>
            <div className="cookbook-card-body">
              <h2>{book.name}</h2>
              <p><BriefcaseBusiness size={15} aria-hidden="true" /> {recipeCount(recipes.length)}</p>
              <small>{recipes.length ? recipes.slice(0, 4).map(({ title }) => title).join(' · ') : 'Empty, add recipes'}</small>
            </div>
          </Link>
        })}
      </div>}
      {creating && <NameCookbook library={library} onClose={() => setCreating(false)} />}
    </section>
  )
}

function CookbookDetail({ library, book }: { library: ReadyLibrary; book: Cookbook }) {
  const [dialog, setDialog] = useState<'rename' | 'recipes' | null>(null)
  const confirmation = useRef<HTMLDialogElement>(null)
  const menu = useRef<HTMLDetailsElement>(null)
  const navigate = useNavigate()
  const { busy, error, run } = useOrganizerAction()
  const recipes = cookbookRecipes(library, book.id)

  function closeMenu() {
    const details = menu.current
    details?.querySelector('summary')?.focus()
    if (details) details.open = false
  }

  return (
    <section className="cookbooks-page">
      <div className="collection-bar">
        <Link className="back-link" to="/cookbooks"><ChevronLeft size={17} aria-hidden="true" /> Cookbooks</Link>
        <details className="detail-actions" ref={menu} onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
        }} onKeyDown={(event) => { if (event.key === 'Escape' && event.currentTarget.open) closeMenu() }}>
          <summary className="icon-button" aria-label="Cookbook actions"><Ellipsis size={23} aria-hidden="true" /></summary>
          <div className="detail-menu">
            <button type="button" disabled={busy} onClick={() => { closeMenu(); setDialog('rename') }}><Pencil size={16} aria-hidden="true" /> Rename cookbook</button>
            <button className="delete-recipe" type="button" disabled={busy} onClick={() => { closeMenu(); confirmation.current?.showModal() }}><Trash2 size={16} aria-hidden="true" /> Delete cookbook</button>
          </div>
        </details>
      </div>
      <header className="collection-heading">
        <div><h1>{book.name}</h1><p>{recipeCount(recipes.length)}</p></div>
        {recipes.length > 0 && <button className="button primary-button collection-primary" type="button" disabled={busy} onClick={() => setDialog('recipes')}><Plus size={18} aria-hidden="true" /> Add recipes</button>}
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {recipes.length === 0 ? <div className="collection-empty in-cookbook">
        <BriefcaseBusiness size={58} aria-hidden="true" />
        <h2>Nothing in {book.name} yet</h2>
        <p>Pick recipes from your Recipe Box. A recipe can be in several cookbooks.</p>
        <button className="button primary-button" type="button" disabled={busy} onClick={() => setDialog('recipes')}><Plus size={18} aria-hidden="true" /> Add recipes</button>
      </div> : <>
        <ul className="cookbook-recipe-grid" role="list">
          {recipes.map((recipe) => <li key={recipe.id}>
            <Link className="cookbook-recipe-link" to={`/recipes/${recipe.id}`}>
              <div className="organizer-thumb"><RecipeImage photo={recipe.photo} motif={recipe.motif} /></div>
              <span><strong>{recipe.title}</strong><small>{totalMinutes(recipe)} min total <DietTag diet={recipe.diet} /></small></span>
            </Link>
            <button className="button" type="button" disabled={busy} aria-label={`Remove ${recipe.title}`} onClick={() => void run('remove the recipe from this cookbook', () => library.changeMemberships([], [{ cookbookId: book.id, recipeId: recipe.id }]))}><Minus size={15} aria-hidden="true" /> Remove</button>
          </li>)}
        </ul>
        <p className="organizer-hint">Removing a recipe from this cookbook keeps it in your Recipe Box.</p>
      </>}
      {dialog === 'rename' && <NameCookbook library={library} book={book} onClose={() => setDialog(null)} />}
      {dialog === 'recipes' && <AddRecipes library={library} book={book} onClose={() => setDialog(null)} />}
      <ConfirmDialog dialogRef={confirmation} title={`Delete ${book.name}?`} description="The cookbook will be removed. Its recipes stay in Recipe Box and in any other cookbooks or meals that use them." cancelLabel="Keep cookbook" confirmLabel="Delete cookbook" onConfirm={() => void run('delete the cookbook', async () => {
        await library.deleteCookbook(book.id)
        navigate('/cookbooks', { replace: true })
      })} />
    </section>
  )
}

export function Cookbooks({ library }: { library: ReadyLibrary }) {
  const { cookbookId } = useParams()
  if (!cookbookId) return <CookbookIndex library={library} />
  const book = library.state.cookbooks.find(({ id }) => id === cookbookId)
  if (book) return <CookbookDetail key={book.id} library={library} book={book} />
  return <div className="collection-empty"><h1>Cookbook unavailable</h1><Link className="button" to="/cookbooks">Back to cookbooks</Link></div>
}
