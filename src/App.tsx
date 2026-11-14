import { useLayoutEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, Outlet, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router'
import { AppShell } from './components/AppShell'
import { Cookbooks } from './cookbooks/Cookbooks'
import { useRecipeLibrary } from './data/use-recipe-library'
import type { RecipeLibrary } from './data/use-recipe-library'
import { Groceries } from './groceries/Groceries'
import { Planner } from './planner/Planner'
import { CookMode } from './recipes/CookMode'
import { RecipeBox } from './recipes/RecipeBox'
import { RecipeDetail } from './recipes/RecipeDetail'
import { RecipeEditor } from './recipes/RecipeEditor'
import { isServingCount } from './recipes/scale-ingredients'
import { useOfflineApp } from './pwa/use-offline-app'
import { Settings } from './settings/Settings'

type PreviewScreenProps = {
  title: string
  description: string
}

function PreviewScreen({ title, description }: PreviewScreenProps) {
  return (
    <section className="preview-screen">
      <Link className="back-link" to="/recipes"><ArrowLeft size={16} aria-hidden="true" /> Recipe Box</Link>
      <h1>{title}</h1>
      <div className="preview-panel">
        <p className="eyebrow">Preview</p>
        <h2>Coming in a later milestone</h2>
        <p>{description}</p>
      </div>
    </section>
  )
}

function RecipeStorage({ library }: { library: RecipeLibrary }) {
  if (library.state.status === 'ready') return <Outlet />

  return (
    <section className="storage-state">
      <h1>Recipe Box</h1>
      {library.state.status === 'loading' ? <p role="status">Opening your Recipe Box…</p> : (
        <>
          <div className="form-error" role="alert"><strong>Could not open your Recipe Box.</strong><p>{library.state.message}</p></div>
          <button className="button" type="button" onClick={library.retry}>Try again</button>
        </>
      )}
    </section>
  )
}

function RecipeScreen({ mode, library }: { mode: 'detail' | 'edit' | 'cook'; library: RecipeLibrary }) {
  const { recipeId } = useParams()
  const [params, setParams] = useSearchParams()
  if (library.state.status !== 'ready') return null
  const ready = { ...library, state: library.state }
  const recipe = ready.state.recipes.find(({ id }) => id === recipeId)

  if (!recipe) {
    return (
      <section className="storage-state recipe-unavailable">
        <h1>Recipe unavailable</h1>
        <p>The recipe may have been deleted or saved on another device.</p>
        <Link className="button primary-button" to="/recipes">Back to Recipe Box</Link>
        <Link className="button" to="/recipes/new">Add a recipe</Link>
      </section>
    )
  }

  if (mode === 'edit') {
    return <RecipeEditor key={recipe.id} recipe={recipe} onSave={library.save} />
  }

  const requested = Number(params.get('servings'))
  const servings = isServingCount(requested) ? requested : recipe.baseServings

  if (mode === 'cook') {
    return <CookMode key={recipe.id} recipe={recipe} servings={servings} />
  }

  return <RecipeDetail key={recipe.id} recipe={recipe} library={ready} servings={servings} onServingsChange={(value) => {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (value === recipe.baseServings) updated.delete('servings')
      else updated.set('servings', String(value))
      return updated
    }, { replace: true })
  }} />
}

export function App() {
  const library = useRecipeLibrary()
  const offline = useOfflineApp()
  const { pathname } = useLocation()
  const ready = library.state.status === 'ready' ? { ...library, state: library.state } : null

  useLayoutEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/recipes" replace />} />
        <Route element={<RecipeStorage library={library} />}>
          <Route path="recipes" element={ready && <RecipeBox recipes={ready.state.recipes} onFavourite={library.favourite} />} />
          <Route path="cookbooks" element={ready && <Cookbooks library={ready} />} />
          <Route path="cookbooks/:cookbookId" element={ready && <Cookbooks library={ready} />} />
          <Route path="planner" element={ready && <Planner library={ready} />} />
          <Route path="groceries" element={ready && <Groceries library={ready} />} />
        </Route>
        <Route path="settings" element={<Settings offline={offline} onRestore={library.retry} />} />
        <Route path="*" element={<PreviewScreen title="Page not found" description="Return to Recipe Box to keep exploring." />} />
      </Route>
      <Route element={<AppShell immersive />}>
        <Route element={<RecipeStorage library={library} />}>
          <Route path="recipes/new" element={<RecipeEditor onSave={library.save} />} />
          <Route path="recipes/:recipeId" element={<RecipeScreen mode="detail" library={library} />} />
          <Route path="recipes/:recipeId/edit" element={<RecipeScreen mode="edit" library={library} />} />
          <Route path="recipes/:recipeId/cook" element={<RecipeScreen mode="cook" library={library} />} />
        </Route>
      </Route>
    </Routes>
  )
}
