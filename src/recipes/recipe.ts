export const cuisines = ['North Indian', 'South Indian', 'West Indian', 'East Indian', 'Other'] as const
export const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const
export const diets = ['Veg', 'Non-veg'] as const
export const timeLimits = [20, 30, 45] as const
export const units = ['', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece', 'clove', 'pinch', 'medium', 'sprig', 'bunch'] as const
export const aisles = ['Vegetables & herbs', 'Fruit', 'Dairy & eggs', 'Dals, rice & grains', 'Masalas', 'Meat & seafood', 'Other'] as const

export type Cuisine = (typeof cuisines)[number]
export type MealType = (typeof mealTypes)[number]
export type Diet = (typeof diets)[number]
export type TimeLimit = (typeof timeLimits)[number]
export type Unit = (typeof units)[number]
export type Aisle = (typeof aisles)[number]
export type Motif = 'dal' | 'peas' | 'potato' | 'lemon' | 'spinach' | 'eggs'

export type Ingredient = {
  name: string
  amount: number | null
  unit: Unit
  aisle: Aisle
  originalText: string
}

export type RecipeInput = {
  title: string
  baseServings: number
  prepMinutes: number
  cookMinutes: number
  cuisine: Cuisine
  meal: MealType
  diet: Diet
  ingredients: Ingredient[]
  steps: string[]
}

export type Recipe = RecipeInput & {
  id: string
  favourite: boolean
  createdAt: number
  motif?: Motif
}

export type RecipeWithPhoto = Recipe & { photo: Blob | null }

export function totalMinutes(recipe: Pick<RecipeInput, 'prepMinutes' | 'cookMinutes'>) {
  return recipe.prepMinutes + recipe.cookMinutes
}
