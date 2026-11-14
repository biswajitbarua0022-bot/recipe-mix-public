import { useEffect, useState } from 'react'
import type { RecipeInput, RecipeWithPhoto } from '../recipes/recipe'
import { OrganizerError } from './organizer'
import type { MealSlot, Membership, RecipeImpact } from './organizer'
import * as organizer from './organizer-store'
import type { LibraryContents, PhotoChange } from './recipe-store'
import * as store from './recipe-store'

type LibraryState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | ({ status: 'ready' } & LibraryContents)

function orderRecipes(recipes: RecipeWithPhoto[]) {
  return recipes.sort((a, b) => b.createdAt - a.createdAt || a.title.localeCompare(b.title))
}

export function recipeWriteError(error: unknown, action: string) {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'This browser is out of storage space. Free up space or try a smaller photo.'
  }
  if (error instanceof OrganizerError) return error.message
  return `Could not ${action}. Check that this browser allows local storage and try again.`
}

export function useRecipeLibrary() {
  const [state, setState] = useState<LibraryState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    store.listLibrary().then(
      (library) => {
        if (!cancelled) setState({ ...library, status: 'ready', recipes: orderRecipes(library.recipes) })
      },
      (error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error && error.message === 'Close other Recipe Mix tabs and try again.'
          ? error.message
          : 'Check that this browser allows local storage, then try again.'
        setState({ status: 'error', message })
      },
    )
    return () => { cancelled = true }
  }, [attempt])

  function retry() {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }

  function updateReady(change: (current: LibraryContents) => Partial<LibraryContents>) {
    setState((current) => current.status === 'ready' ? { ...current, ...change(current) } : current)
  }

  function updateLibrary(recipe: RecipeWithPhoto) {
    updateReady((current) => ({ recipes: orderRecipes([...current.recipes.filter(({ id }) => id !== recipe.id), recipe]) }))
    return recipe
  }

  async function save(input: RecipeInput, photo: PhotoChange, id?: string) {
    return updateLibrary(await store.saveRecipe(input, photo, id))
  }

  async function favourite(id: string, value: boolean) {
    await store.setFavourite(id, value).then(updateLibrary)
  }

  async function duplicate(id: string) {
    return updateLibrary(await store.duplicateRecipe(id))
  }

  async function remove(id: string, impact: RecipeImpact) {
    await store.deleteRecipe(id, impact)
    updateReady((current) => ({
      recipes: current.recipes.filter((recipe) => recipe.id !== id),
      memberships: current.memberships.filter(({ recipeId }) => recipeId !== id),
      mealSlots: current.mealSlots.filter(({ recipeId }) => recipeId !== id),
    }))
  }

  async function saveCookbook(name: string, id?: string) {
    const cookbook = await organizer.saveCookbook(name, id)
    updateReady((current) => ({ cookbooks: [...current.cookbooks.filter((book) => book.id !== cookbook.id), cookbook] }))
    return cookbook
  }

  async function deleteCookbook(id: string) {
    await organizer.deleteCookbook(id)
    updateReady((current) => ({
      cookbooks: current.cookbooks.filter((book) => book.id !== id),
      memberships: current.memberships.filter(({ cookbookId }) => cookbookId !== id),
    }))
  }

  async function changeMemberships(add: Membership[], remove: Membership[] = []) {
    const memberships = await organizer.changeMemberships(add, remove)
    updateReady(() => ({ memberships }))
  }

  async function saveMeal(slot: MealSlot, expected?: MealSlot) {
    const saved = await organizer.saveMeal(slot, expected)
    updateReady((current) => ({ mealSlots: [...current.mealSlots.filter((meal) => meal.date !== saved.date || meal.meal !== saved.meal), saved] }))
  }

  async function removeMeal(slot: MealSlot) {
    await organizer.removeMeal(slot)
    updateReady((current) => ({ mealSlots: current.mealSlots.filter((meal) => meal.date !== slot.date || meal.meal !== slot.meal) }))
  }

  async function clearMeals(from: string, through: string, expected: MealSlot[]) {
    await organizer.clearMeals(from, through, expected)
    updateReady((current) => ({ mealSlots: current.mealSlots.filter(({ date }) => date < from || date > through) }))
  }

  return { state, retry, save, favourite, duplicate, remove, getRecipeImpact: organizer.getRecipeImpact, saveCookbook, deleteCookbook, changeMemberships, saveMeal, removeMeal, clearMeals }
}

export type RecipeLibrary = ReturnType<typeof useRecipeLibrary>
export type ReadyLibrary = RecipeLibrary & { state: Extract<LibraryState, { status: 'ready' }> }
