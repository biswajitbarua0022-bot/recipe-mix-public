import { totalMinutes } from './recipe'
import type { Cuisine, Diet, MealType, Recipe, TimeLimit } from './recipe'

export type RecipeFilters = {
  cuisine: Cuisine | null
  meal: MealType | null
  diet: Diet | null
  time: TimeLimit | null
}

export const emptyFilters: RecipeFilters = { cuisine: null, meal: null, diet: null, time: null }

export function filterRecipes<Entry extends Recipe>(
  recipes: readonly Entry[],
  query: string,
  filters: RecipeFilters,
  favouritesOnly: boolean,
) {
  const search = query.trim().toLowerCase()

  return recipes.filter((recipe) => (
    (!favouritesOnly || recipe.favourite) &&
    (!filters.cuisine || recipe.cuisine === filters.cuisine) &&
    (!filters.meal || recipe.meal === filters.meal) &&
    (!filters.diet || recipe.diet === filters.diet) &&
    (!filters.time || totalMinutes(recipe) < filters.time) &&
    (!search || recipe.title.toLowerCase().includes(search) || recipe.ingredients.some(({ name, originalText }) => (
      name.toLowerCase().includes(search) || originalText.toLowerCase().includes(search)
    )))
  ))
}
