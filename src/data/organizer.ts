export const plannerMeals = ['Breakfast', 'Lunch', 'Dinner'] as const
export type PlannerMeal = (typeof plannerMeals)[number]

export type Cookbook = { id: string; name: string; nameKey: string; createdAt: number }
export type Membership = { cookbookId: string; recipeId: string }
export type SlotKey = { date: string; meal: PlannerMeal }
export type MealSlot = SlotKey & { recipeId: string; servings: number }
export type RecipeImpact = { cookbooks: Pick<Cookbook, 'id' | 'name'>[]; slots: MealSlot[] }

export class OrganizerError extends Error {}

export function slotKey(slot: SlotKey): [string, PlannerMeal] { return [slot.date, slot.meal] }
export function sameSlot(first: MealSlot | undefined, second: MealSlot | undefined) {
  if (!first || !second) return first === second
  return first.date === second.date && first.meal === second.meal && first.recipeId === second.recipeId && first.servings === second.servings
}

export function orderSlots(a: SlotKey, b: SlotKey) {
  return a.date.localeCompare(b.date) || plannerMeals.indexOf(a.meal) - plannerMeals.indexOf(b.meal)
}
