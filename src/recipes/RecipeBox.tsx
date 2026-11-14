import { useRef, useState } from 'react'
import { Check, Heart, ListFilter, Plus, Search, X } from 'lucide-react'
import { Link } from 'react-router'
import mark from '../assets/mark.svg'
import { recipeWriteError } from '../data/use-recipe-library'
import type { RecipeLibrary } from '../data/use-recipe-library'
import { emptyFilters, filterRecipes } from './filter-recipes'
import type { RecipeFilters } from './filter-recipes'
import { cuisines, diets, mealTypes, timeLimits } from './recipe'
import type { RecipeWithPhoto } from './recipe'
import { DietIcon, RecipeCard } from './RecipeCard'
import { RecipeArt } from './RecipeArt'

type FilterControlsProps = {
  filters: RecipeFilters
  onChange: <Key extends keyof RecipeFilters>(key: Key, value: RecipeFilters[Key]) => void
}

function FilterGroup<Option extends string | number>({ label, options, selected, onSelect, format = String, icon }: {
  label: string
  options: readonly Option[]
  selected: Option | null
  onSelect: (option: Option | null) => void
  format?: (option: Option) => string
  icon?: (option: Option) => React.ReactNode
}) {
  return (
    <fieldset className="filter-group">
      <legend>{label}</legend>
      <div className="filter-options">
        {options.map((option) => (
          <button key={option} className="filter-chip" type="button" aria-pressed={option === selected} onClick={() => onSelect(option === selected ? null : option)}>
            {option === selected && <Check size={14} aria-hidden="true" />}
            {icon?.(option)}
            {format(option)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

const timeLabel = (time: number) => `Under ${time} min`

function FilterControls({ filters, onChange }: FilterControlsProps) {
  return (
    <>
      <FilterGroup label="Cuisine" options={cuisines} selected={filters.cuisine} onSelect={(value) => onChange('cuisine', value)} />
      <FilterGroup label="Meal type" options={mealTypes} selected={filters.meal} onSelect={(value) => onChange('meal', value)} />
      <FilterGroup label="Veg / non-veg" options={diets} selected={filters.diet} onSelect={(value) => onChange('diet', value)} icon={(diet) => <DietIcon diet={diet} />} />
      <FilterGroup label="Total time" options={timeLimits} selected={filters.time} onSelect={(value) => onChange('time', value)} format={timeLabel} />
    </>
  )
}

export function RecipeBox({ recipes, onFavourite }: { recipes: RecipeWithPhoto[]; onFavourite: RecipeLibrary['favourite'] }) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const [showBanner, setShowBanner] = useState(true)
  const [pendingFavourite, setPendingFavourite] = useState<string | null>(null)
  const [error, setError] = useState('')
  const sheet = useRef<HTMLDialogElement>(null)
  const search = useRef<HTMLInputElement>(null)

  const searchTerm = query.trim()
  const results = filterRecipes(recipes, query, filters, favouritesOnly)
  const onlyStarters = recipes.length === 2 && recipes.every(({ id }) => id === 'dal-tadka' || id === 'poha')
  const filterCount = Object.values(filters).filter(Boolean).length
  const activeFilters = [
    { label: searchTerm && `“${searchTerm}”`, clear: () => setQuery('') },
    { label: favouritesOnly && 'Favourites', clear: () => setFavouritesOnly(false) },
    { label: filters.cuisine, clear: () => changeFilter('cuisine', null) },
    { label: filters.meal, clear: () => changeFilter('meal', null) },
    { label: filters.diet, clear: () => changeFilter('diet', null) },
    { label: filters.time && timeLabel(filters.time), clear: () => changeFilter('time', null) },
  ].filter(({ label }) => label)

  function changeFilter<Key extends keyof RecipeFilters>(key: Key, value: RecipeFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function clearAll() {
    setQuery('')
    setFilters(emptyFilters)
    setFavouritesOnly(false)
  }

  async function toggleFavourite(id: string, favourite: boolean) {
    if (pendingFavourite) return
    setPendingFavourite(id)
    setError('')
    try {
      await onFavourite(id, favourite)
    } catch (error) {
      setError(recipeWriteError(error, 'update favourites'))
    } finally {
      setPendingFavourite(null)
    }
  }

  return (
    <section className="recipe-box" aria-labelledby="recipe-box-title">
      <header className="page-heading">
        <h1 id="recipe-box-title">Recipe Box</h1>
        <p>{recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}</p>
      </header>

      {recipes.length === 0 ? <EmptyRecipeBox /> : <>
      {showBanner && onlyStarters && (
        <div className="sample-banner">
          <span className="sample-icon"><img src={mark} width="30" height="30" alt="" /></span>
          <div><strong>Two starter recipes to explore</strong><p>Make them your own or add a recipe from your kitchen.</p></div>
          <button type="button" className="icon-button" aria-label="Dismiss starter recipes notice" onClick={() => setShowBanner(false)}><X size={18} aria-hidden="true" /></button>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="recipe-toolbar">
        <div className="search-field">
          <Search aria-hidden="true" size={18} />
          <input ref={search} type="search" aria-label="Search recipes or ingredients" placeholder="Search recipes or ingredients" value={query} onChange={(event) => setQuery(event.target.value)} />
          {query && (
            <button type="button" className="icon-button" aria-label="Clear search" onClick={() => {
              setQuery('')
              search.current?.focus()
            }}><X size={16} aria-hidden="true" /></button>
          )}
        </div>
        <div className="toolbar-actions">
          <button className="button" type="button" aria-pressed={favouritesOnly} onClick={() => setFavouritesOnly((value) => !value)}>
            <Heart aria-hidden="true" size={17} fill={favouritesOnly ? 'currentColor' : 'none'} /> Favourites
          </button>
          <button className="button open-filters" type="button" aria-haspopup="dialog" onClick={() => sheet.current?.showModal()}>
            <ListFilter aria-hidden="true" size={17} /> Filters
            {filterCount > 0 && <span className="filter-count" aria-label={`${filterCount} active filters`}>{filterCount}</span>}
          </button>
        </div>
      </div>

      <div className="box-layout">
        <aside className="filter-panel" aria-labelledby="filter-heading">
          <h2 id="filter-heading">Filters</h2>
          <FilterControls filters={filters} onChange={changeFilter} />
        </aside>
        <div className="recipe-results">
          {activeFilters.length > 0 && (
            <div className="active-filters" aria-label="Active filters">
              {activeFilters.map(({ label, clear }) => (
                <button key={label || undefined} className="active-chip" type="button" aria-label={`Remove ${label} filter`} onClick={clear}>{label} <X size={14} aria-hidden="true" /></button>
              ))}
              <button className="text-button" type="button" onClick={clearAll}>Clear all</button>
            </div>
          )}
          <p className="result-count" role="status">Showing {results.length} of {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}</p>
          {results.length > 0 ? (
            <ul className="recipe-grid" aria-label="Recipes">
              {results.map((recipe) => (
                <li key={recipe.id}><RecipeCard recipe={recipe} busy={pendingFavourite !== null} onFavourite={(value) => void toggleFavourite(recipe.id, value)} /></li>
              ))}
            </ul>
          ) : (
            <div className="no-results">
              <RecipeArt motif="dal" />
              <h2>{searchTerm ? `No recipes match “${searchTerm}”` : 'No recipes match these filters'}</h2>
              <p>Try fewer filters, or search for an ingredient such as onion or curry leaves.</p>
              <button type="button" className="button" onClick={clearAll}>Clear all</button>
            </div>
          )}
        </div>
      </div>

      <div className="add-recipe"><Link className="button primary-button" to="/recipes/new"><Plus size={18} aria-hidden="true" /> Add recipe</Link></div>

      <dialog ref={sheet} className="filter-sheet" aria-labelledby="sheet-title">
        <header className="sheet-header">
          <h2 id="sheet-title">Filters</h2>
          <form method="dialog"><button className="icon-button" aria-label="Close filters"><X size={19} aria-hidden="true" /></button></form>
        </header>
        <div className="sheet-body"><FilterControls filters={filters} onChange={changeFilter} /></div>
        <form method="dialog" className="sheet-footer">
          <button type="button" className="text-button" onClick={() => setFilters(emptyFilters)}>Clear filters</button>
          <button className="button dark-button">Show {results.length} {results.length === 1 ? 'recipe' : 'recipes'}</button>
        </form>
      </dialog>
      </>}
    </section>
  )
}

function EmptyRecipeBox() {
  return (
    <div className="empty-box">
      <svg width="112" height="96" viewBox="0 0 112 96" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
        <ellipse cx="56" cy="86" rx="46" ry="5" fill="var(--cream-200)" stroke="none" />
        <path d="M22 36l12-20h56L78 36" fill="var(--white)" />
        <path d="M71 36c2-12 10-17 19-20-1 10-7 16-19 20Z" fill="var(--sage-500)" />
        <rect x="18" y="39" width="76" height="44" rx="7" fill="var(--turmeric-300)" />
        <path d="M15 35h82v10H15z" fill="var(--turmeric-500)" />
        <rect x="44" y="56" width="24" height="10" rx="3" fill="var(--white)" />
      </svg>
      <h2>Your Recipe Box is empty</h2>
      <p>Save a favourite family dish or a new recipe you want to make again.</p>
      <Link className="button primary-button" to="/recipes/new"><Plus size={18} aria-hidden="true" /> Add your first recipe</Link>
    </div>
  )
}
