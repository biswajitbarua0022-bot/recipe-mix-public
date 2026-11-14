import { Heart, Timer } from 'lucide-react'
import { Link } from 'react-router'
import { totalMinutes } from './recipe'
import type { Diet, RecipeWithPhoto } from './recipe'
import { RecipeImage } from './RecipeImage'

export function DietIcon({ diet }: { diet: Diet }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
      {diet === 'Veg'
        ? <circle cx="8" cy="8" r="3.3" fill="currentColor" />
        : <path d="M8 4.4 11.7 11.3H4.3Z" fill="currentColor" />}
    </svg>
  )
}

export function DietTag({ diet }: { diet: Diet }) {
  return <span className={`diet-tag${diet === 'Non-veg' ? ' non-veg' : ''}`}><DietIcon diet={diet} /> {diet}</span>
}

export function RecipeCard({ recipe, busy, onFavourite }: {
  recipe: RecipeWithPhoto
  busy: boolean
  onFavourite: (value: boolean) => void
}) {
  return (
    <article className="recipe-card">
      <RecipeImage photo={recipe.photo} motif={recipe.motif} />
      <div className="recipe-card-body">
        <h2><Link to={`/recipes/${recipe.id}`}>{recipe.title}</Link></h2>
        <div className="recipe-meta">
          <span className="recipe-time"><Timer aria-hidden="true" size={15} /> {totalMinutes(recipe)} min total</span>
          <DietTag diet={recipe.diet} />
        </div>
      </div>
      <button className="card-favourite" type="button" disabled={busy} aria-label={`Favourite ${recipe.title}`} aria-pressed={recipe.favourite} onClick={() => onFavourite(!recipe.favourite)}>
        <span><Heart aria-hidden="true" size={16} fill={recipe.favourite ? 'currentColor' : 'none'} /></span>
      </button>
    </article>
  )
}
