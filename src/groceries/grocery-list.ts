import { orderSlots, slotKey } from '../data/organizer'
import type { MealSlot } from '../data/organizer'
import { formatWeek } from '../planner/calendar'
import { parseAmount } from '../recipes/editor-draft'
import { formatQuantity, normalizeUnit } from '../recipes/ingredient-unit'
import { aisles } from '../recipes/recipe'
import type { Aisle, Motif, Recipe, Unit } from '../recipes/recipe'
import { scaleIngredients } from '../recipes/scale-ingredients'

export type GroceryStatus = 'unchecked' | 'checked' | 'cleared'
export type Contribution = MealSlot & { title: string; motif?: Motif; amount: number | null }
export type GeneratedItem = {
  kind: 'generated'
  id: string
  canonical: string
  name: string
  aisle: Aisle
  unit: Unit
  amount: number | null
  originalText: string
  sources: Contribution[]
  status: GroceryStatus
}
export type ManualItem = {
  kind: 'manual'
  id: string
  name: string
  aisle: Aisle
  quantityText: string
  status: Exclude<GroceryStatus, 'cleared'>
}
export type GroceryItem = GeneratedItem | ManualItem
export type GroceryWeek = {
  weekStart: string
  generationId: string | null
  stale: boolean
  plannedMeals: number
  rows: GeneratedItem[]
  manualItems: ManualItem[]
}

const aliases = [
  { canonical: 'onion', name: 'Onion', plural: 'Onions', forms: ['onion', 'onions'] },
  { canonical: 'tomato', name: 'Tomato', plural: 'Tomatoes', forms: ['tomato', 'tomatoes'] },
  { canonical: 'cumin seeds', name: 'Cumin seeds', forms: ['cumin seeds', 'cumin seed', 'jeera', 'cumin seeds (jeera)'] },
  { canonical: 'turmeric', name: 'Turmeric', forms: ['turmeric', 'haldi', 'turmeric (haldi)'] },
]

function normalizedText(text: string) {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

function canonicalIngredient(name: string) {
  const key = normalizedText(name)
  return aliases.find(({ forms }) => forms.includes(key)) ?? { canonical: key, name: name.trim() }
}

export function groceryItemName(item: GroceryItem) {
  if (item.kind === 'manual') return item.name
  const alias = aliases.find(({ canonical }) => canonical === item.canonical)
  return alias?.plural && (item.unit === '' || item.unit === 'piece' || item.unit === 'medium') && (item.amount ?? 0) > 1 ? alias.plural : item.name
}

export const aisleNames: Record<Aisle, string> = {
  'Vegetables & herbs': 'Vegetables',
  Fruit: 'Fruit',
  'Dairy & eggs': 'Dairy & eggs',
  'Dals, rice & grains': 'Grains and dals',
  Masalas: 'Masalas',
  'Meat & seafood': 'Meat & seafood',
  Other: 'Other',
}

export function emptyGroceryWeek(weekStart: string): GroceryWeek {
  return { weekStart, generationId: null, stale: false, plannedMeals: 0, rows: [], manualItems: [] }
}

export function visibleItems(week: GroceryWeek): GroceryItem[] {
  return [...week.rows.filter(({ status }) => status !== 'cleared'), ...week.manualItems]
}

export function groupByAisle(items: GroceryItem[]) {
  return aisles.map((aisle) => ({ aisle, items: items.filter((item) => item.aisle === aisle) })).filter((group) => group.items.length > 0)
}

function total(amounts: number[]) {
  // Use a stable order so ingredient reordering cannot change a rounded display or a row's identity.
  const sum = amounts.sort((a, b) => a - b).reduce((acc, amount) => acc + amount, 0)
  return Number.isFinite(sum) ? sum : null
}

type MeasuredGroup = Omit<GeneratedItem, 'sources' | 'amount' | 'status'> & {
  parts: Map<string, { meal: Omit<Contribution, 'amount'>; amounts: number[] }>
}

export function generateItems(slots: MealSlot[], recipes: Pick<Recipe, 'id' | 'title' | 'motif' | 'ingredients' | 'baseServings'>[]) {
  const byRecipe = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const measured = new Map<string, MeasuredGroup>()
  const unmeasured: GeneratedItem[] = []

  for (const slot of [...slots].sort(orderSlots)) {
    const recipe = byRecipe.get(slot.recipeId)
    if (!recipe) continue
    const meal = { ...slot, title: recipe.title, motif: recipe.motif }
    const mealKey = JSON.stringify(slotKey(slot))
    const occurrences = new Map<string, number>()

    for (const [index, ingredient] of scaleIngredients(recipe, slot.servings).entries()) {
      const item = canonicalIngredient(ingredient.name)
      const normalizedUnit = normalizeUnit(ingredient.unit)
      const unit = normalizedUnit ?? ''
      const aisle = aisles.includes(ingredient.aisle) ? ingredient.aisle : 'Other'
      const entry = { kind: 'generated' as const, ...item, unit, aisle }
      if (ingredient.amount === null || normalizedUnit === undefined) {
        const original = recipe.ingredients[index]
        const originalText = original.originalText || (original.amount === null ? original.name : `${original.amount} ${original.unit} ${original.name}`.replace(/\s+/g, ' ').trim())
        const identity = JSON.stringify([item.canonical, unit, originalText])
        const occurrence = occurrences.get(identity) ?? 0
        occurrences.set(identity, occurrence + 1)
        unmeasured.push({ ...entry, id: JSON.stringify(['text', mealKey, recipe.id, identity, occurrence]), amount: null, originalText, sources: [{ ...meal, amount: null }], status: 'unchecked' })
        continue
      }

      const id = JSON.stringify(['measured', item.canonical, unit])
      let group = measured.get(id)
      if (!group) {
        group = { ...entry, id, originalText: '', parts: new Map() }
        measured.set(id, group)
      } else if (group.aisle === 'Other') {
        group.aisle = aisle
      }
      const contribution = group.parts.get(mealKey) ?? { meal, amounts: [] }
      contribution.amounts.push(ingredient.amount)
      group.parts.set(mealKey, contribution)
    }
  }

  return [...measured.values()].map(({ parts, ...item }): GeneratedItem => {
    const contributions = [...parts.values()]
    const amount = total(contributions.flatMap((source) => source.amounts))
    const sources = contributions.map(({ meal, amounts }) => ({ ...meal, amount: total(amounts) }))
    return { ...item, amount, sources, status: 'unchecked', originalText: amount === null ? 'Check the individual meal quantities.' : '' }
  }).concat(unmeasured)
}

function sameGeneratedItem(previous: GeneratedItem, next: GeneratedItem) {
  return previous.amount === next.amount && previous.originalText === next.originalText && previous.sources.length === next.sources.length
    && previous.sources.every((source, index) => {
      const other = next.sources[index]
      return source.date === other.date && source.meal === other.meal && source.recipeId === other.recipeId && source.amount === other.amount
    })
}

export function retainGeneratedStatus(next: GeneratedItem[], previous: GeneratedItem[]) {
  const previousById = new Map(previous.map((item) => [item.id, item]))
  return next.map((item) => {
    const before = previousById.get(item.id)
    return before && sameGeneratedItem(before, item) ? { ...item, status: before.status } : item
  })
}

function quantityUnit(text: string) {
  if (Number.isFinite(parseAmount(text))) return ''
  const measured = /^(.+?)\s*([a-z]+\.?)$/i.exec(text)
  return measured && Number.isFinite(parseAmount(measured[1])) ? normalizeUnit(measured[2]) : undefined
}

export function hasDuplicateItem(week: GroceryWeek, name: string, quantityText: string) {
  const { canonical } = canonicalIngredient(name)
  const unit = quantityUnit(quantityText)
  return visibleItems(week).some((item) => {
    const existingKey = item.kind === 'manual' ? canonicalIngredient(item.name).canonical : item.canonical
    if (existingKey !== canonical) return false
    if (!quantityText) return true
    if (item.kind === 'generated') return item.amount !== null && item.unit === unit
    const existingUnit = quantityUnit(item.quantityText)
    return unit === undefined || existingUnit === undefined
      ? normalizedText(item.quantityText) === normalizedText(quantityText)
      : unit === existingUnit
  })
}

export function remainingListText(week: GroceryWeek) {
  const groups = groupByAisle(visibleItems(week).filter(({ status }) => status === 'unchecked'))
  if (groups.length === 0) return ''
  const sections = groups.map(({ aisle, items }) => [aisleNames[aisle], ...items.map((item) => {
    const name = groceryItemName(item)
    if (item.kind === 'manual') return `- ${[item.quantityText, name].filter(Boolean).join(' ')}`
    if (item.amount !== null) return `- ${formatQuantity(item.amount, item.unit)} ${name}`
    if (!item.originalText) return `- ${name}`
    return `- ${normalizedText(item.originalText).includes(normalizedText(name)) ? item.originalText : `${name} — ${item.originalText}`}`
  })].join('\n'))
  return [`Recipe Mix groceries · ${formatWeek(week.weekStart)}`, ...sections].join('\n\n')
}

export function groceryRecipeChanged(before: Recipe, after: Recipe) {
  const ingredients = ({ ingredients }: Recipe) => ingredients.map(({ name, amount, unit, aisle, originalText }) => [name, amount, unit, aisle, originalText])
  return before.baseServings !== after.baseServings || before.title !== after.title || JSON.stringify(ingredients(before)) !== JSON.stringify(ingredients(after))
}
