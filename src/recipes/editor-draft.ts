import type { Cuisine, Diet, Ingredient, MealType, Recipe, RecipeInput } from './recipe'

export type IngredientDraft = Omit<Ingredient, 'amount'> & { id: string; amount: string; reviewNote?: string }
export type StepDraft = { id: string; text: string }
export type RecipeDraft = {
  title: string
  baseServings: string
  prepMinutes: string
  cookMinutes: string
  cuisine: Cuisine
  meal: MealType
  diet: Diet
  ingredients: IngredientDraft[]
  steps: StepDraft[]
}

export function newIngredient(): IngredientDraft {
  return { id: crypto.randomUUID(), name: '', amount: '', unit: '', aisle: 'Other', originalText: '' }
}

export function newStep(text = ''): StepDraft {
  return { id: crypto.randomUUID(), text }
}

export function createDraft(recipe?: Recipe): RecipeDraft {
  return {
    title: recipe?.title ?? '',
    baseServings: String(recipe?.baseServings ?? 4),
    prepMinutes: recipe ? String(recipe.prepMinutes) : '',
    cookMinutes: recipe ? String(recipe.cookMinutes) : '',
    cuisine: recipe?.cuisine ?? 'North Indian',
    meal: recipe?.meal ?? 'Dinner',
    diet: recipe?.diet ?? 'Veg',
    ingredients: recipe?.ingredients.map((ingredient) => ({
      ...ingredient, id: crypto.randomUUID(), amount: ingredient.amount === null ? '' : String(ingredient.amount),
    })) ?? [newIngredient()],
    steps: recipe?.steps.map(newStep) ?? [newStep()],
  }
}

const vulgarFractions: Record<string, number> = {
  '¼': 1 / 4, '½': 1 / 2, '¾': 3 / 4, '⅐': 1 / 7, '⅑': 1 / 9, '⅒': 1 / 10,
  '⅓': 1 / 3, '⅔': 2 / 3, '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
}

export function parseAmount(value: string): number | null {
  const text = value.trim()
  if (!text) return null

  const vulgar = /^(\d*)\s*([^\d\s])$/u.exec(text)
  const fraction = /^(?:(\d+)\s+)?(\d+)\s*[/⁄]\s*(\d+)$/u.exec(text)
  if (vulgar && Object.hasOwn(vulgarFractions, vulgar[2])) return Number(vulgar[1]) + vulgarFractions[vulgar[2]]
  if (fraction) return Number(fraction[1] ?? 0) + Number(fraction[2]) / Number(fraction[3])
  if (/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return Number(text)
  return Number.NaN
}

export function wholeNumber(value: string) {
  const text = value.trim()
  const number = Number(text)
  return /^\d+$/.test(text) && Number.isSafeInteger(number) ? number : Number.NaN
}

type Validation = { errors: Record<string, string>; recipe: RecipeInput | null }

export function validateDraft(draft: RecipeDraft): Validation {
  const errors: Record<string, string> = {}
  const title = draft.title.trim()
  const baseServings = wholeNumber(draft.baseServings)
  const prepMinutes = wholeNumber(draft.prepMinutes)
  const cookMinutes = wholeNumber(draft.cookMinutes)

  if (!title) errors.title = 'Enter a recipe title.'
  if (!(baseServings > 0)) errors.baseServings = 'Enter a whole number of servings, at least 1.'
  if (!Number.isFinite(prepMinutes)) errors.prepMinutes = 'Enter whole minutes. Use 0 for no prep.'
  if (!Number.isFinite(cookMinutes)) errors.cookMinutes = 'Enter whole minutes. Use 0 for no cooking.'
  if (!errors.prepMinutes && !errors.cookMinutes && !Number.isSafeInteger(prepMinutes + cookMinutes)) {
    errors.cookMinutes = 'Enter a smaller time.'
  }

  const ingredients: Ingredient[] = []
  for (const row of draft.ingredients) {
    const name = row.name.trim()
    const originalText = row.originalText.trim()
    const amount = parseAmount(row.amount)
    if (!name && amount === null && !row.unit && !originalText && row.aisle === 'Other') continue
    if (!name) errors[`name-${row.id}`] = 'Add a name or remove this row.'
    if (amount !== null && !Number.isFinite(amount)) errors[`amount-${row.id}`] = 'Use a number or fraction. Keep ranges or “to taste” in the note.'
    ingredients.push({ name, amount, unit: row.unit, aisle: row.aisle, originalText })
  }
  if (ingredients.length === 0) errors.ingredients = 'Add at least one ingredient.'

  const steps = draft.steps.map(({ text }) => text.trim()).filter(Boolean)
  if (steps.length === 0) errors.steps = 'Describe at least one step.'

  if (Object.keys(errors).length > 0) return { errors, recipe: null }
  return { errors, recipe: { title, baseServings, prepMinutes, cookMinutes, cuisine: draft.cuisine, meal: draft.meal, diet: draft.diet, ingredients, steps } }
}
