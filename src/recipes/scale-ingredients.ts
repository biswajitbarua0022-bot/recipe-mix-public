import type { Ingredient } from './recipe'

export function isServingCount(value: number) {
  return Number.isSafeInteger(value) && value > 0
}

export function unquantifiedQualifier(ingredient: Pick<Ingredient, 'name' | 'originalText'>) {
  return /\b(?:to taste|as needed)\b/i.exec(`${ingredient.name} ${ingredient.originalText}`)?.[0]
}

// Use the saved recipe and the target serving count for every calculation.
export function scaleIngredients(recipe: { baseServings: number; ingredients: readonly Ingredient[] }, servings: number): Ingredient[] {
  if (!isServingCount(recipe.baseServings) || !isServingCount(servings)) {
    throw new RangeError('Servings must be positive whole numbers.')
  }

  const ratio = servings / recipe.baseServings
  return recipe.ingredients.map((ingredient) => {
    const { amount } = ingredient
    const scaled = amount !== null && amount >= 0 && !unquantifiedQualifier(ingredient) ? amount * ratio : null
    return { ...ingredient, amount: Number.isFinite(scaled) ? scaled : null }
  })
}
