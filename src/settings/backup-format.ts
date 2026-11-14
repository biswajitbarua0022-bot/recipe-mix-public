import type { BackupData } from '../data/backup-store'
import { plannerMeals, slotKey } from '../data/organizer'
import type { Cookbook, MealSlot, Membership } from '../data/organizer'
import type { Contribution, GeneratedItem, GroceryWeek, ManualItem } from '../groceries/grocery-list'
import { isDateKey, isPlannerDate, weekStart } from '../planner/calendar'
import { aisles, cuisines, diets, mealTypes, units } from '../recipes/recipe'
import type { Ingredient, Recipe } from '../recipes/recipe'
import { isServingCount } from '../recipes/scale-ingredients'

const format = 'recipe-mix-backup'
const version = 1
const motifs = ['dal', 'peas', 'potato', 'lemon', 'spinach', 'eggs'] as const
const photoTypes = ['image/jpeg', 'image/png', 'image/webp'] as const
export type EncodedPhoto = { type: (typeof photoTypes)[number]; base64: string }
export type BackupFile = { format: typeof format; version: typeof version; exportedAt: string; data: BackupData<EncodedPhoto> }

type Row = Record<string, unknown>
function object(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function text(value: unknown): value is string { return typeof value === 'string' && Boolean(value.trim()) }
function id(value: unknown): value is string { return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,127}$/i.test(value) }
function integer(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
function amount(value: unknown) {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
}
function choice(options: readonly string[], value: unknown) {
  return typeof value === 'string' && options.includes(value)
}
function motif(value: unknown) { return value === undefined || choice(motifs, value) }

function array<T>(value: unknown, valid: (entry: unknown) => entry is T): value is T[] {
  return Array.isArray(value) && value.every(valid)
}

function unique<T>(entries: T[], key: (entry: T) => string) {
  return new Set(entries.map(key)).size === entries.length
}

function ingredient(row: unknown): row is Ingredient {
  return object(row) && text(row.name) && amount(row.amount) && choice(units, row.unit)
    && choice(aisles, row.aisle) && typeof row.originalText === 'string'
}

function recipe(row: unknown): row is Recipe {
  return object(row) && id(row.id) && text(row.title)
    && typeof row.baseServings === 'number' && isServingCount(row.baseServings)
    && integer(row.prepMinutes) && integer(row.cookMinutes) && Number.isSafeInteger(row.prepMinutes + row.cookMinutes)
    && choice(cuisines, row.cuisine) && choice(mealTypes, row.meal) && choice(diets, row.diet)
    && typeof row.favourite === 'boolean' && integer(row.createdAt) && motif(row.motif)
    && array(row.ingredients, ingredient) && row.ingredients.length > 0 && array(row.steps, text) && row.steps.length > 0
}

function cookbook(row: unknown): row is Cookbook {
  return object(row) && id(row.id) && text(row.name) && row.name === row.name.trim() && row.name.length <= 60
    && row.nameKey === row.name.normalize('NFC').toLowerCase() && integer(row.createdAt)
}

function membership(row: unknown): row is Membership {
  return object(row) && id(row.cookbookId) && id(row.recipeId)
}

function slot(row: unknown): row is MealSlot {
  return object(row) && typeof row.date === 'string' && isDateKey(row.date) && choice(plannerMeals, row.meal)
    && id(row.recipeId) && typeof row.servings === 'number' && isServingCount(row.servings)
}

function contribution(row: unknown): row is Contribution {
  return object(row) && text(row.title) && motif(row.motif) && amount(row.amount) && slot(row)
}

function generated(row: unknown): row is GeneratedItem {
  return object(row) && row.kind === 'generated' && text(row.id) && text(row.canonical) && text(row.name)
    && choice(aisles, row.aisle) && choice(units, row.unit) && amount(row.amount)
    && typeof row.originalText === 'string' && choice(['unchecked', 'checked', 'cleared'], row.status)
    && array(row.sources, contribution) && row.sources.length > 0
    && unique(row.sources, (source) => JSON.stringify(slotKey(source)))
}

function manual(row: unknown): row is ManualItem {
  return object(row) && row.kind === 'manual' && id(row.id) && text(row.name) && row.name.length <= 160
    && typeof row.quantityText === 'string' && row.quantityText.length <= 80 && choice(aisles, row.aisle)
    && choice(['unchecked', 'checked'], row.status)
}

function groceryWeek(row: unknown): row is GroceryWeek {
  if (!object(row) || typeof row.weekStart !== 'string' || !isPlannerDate(row.weekStart) || weekStart(row.weekStart) !== row.weekStart
    || typeof row.stale !== 'boolean' || !integer(row.plannedMeals) || row.plannedMeals > 21
    || !array(row.rows, generated) || !array(row.manualItems, manual)) return false
  if (row.generationId === null ? row.stale || row.plannedMeals !== 0 || row.rows.length !== 0 : !id(row.generationId)) return false
  // Snapshots can intentionally retain contributions from a deleted recipe or a replaced meal.
  return unique([...row.rows, ...row.manualItems], ({ id }) => id)
    && row.rows.every(({ sources }) => sources.every(({ date }) => weekStart(date) === row.weekStart))
}

function photo(row: unknown): row is BackupData<EncodedPhoto>['recipePhotos'][number] {
  return object(row) && id(row.recipeId) && object(row.blob)
    && choice(photoTypes, row.blob.type) && text(row.blob.base64)
}

function requireValid(valid: unknown, section: string): asserts valid {
  if (!valid) throw new Error(`The backup contains invalid ${section}.`)
}

export function makeBackupFile(data: BackupData<EncodedPhoto>, now: Date): BackupFile {
  return { format, version, exportedAt: now.toISOString(), data }
}

export function parseBackupFile(content: string): BackupFile {
  let file: unknown
  try { file = JSON.parse(content) } catch { throw new Error('The selected file does not contain valid JSON.') }
  if (!object(file) || file.format !== format) throw new Error('Choose a JSON backup exported from Recipe Mix.')
  if (file.version !== version) throw new Error('This backup version is unsupported.')
  requireValid(typeof file.exportedAt === 'string' && Number.isFinite(Date.parse(file.exportedAt))
    && new Date(file.exportedAt).toISOString() === file.exportedAt, 'export date')
  requireValid(object(file.data), 'data')
  const { recipes, recipePhotos, cookbooks, cookbookMemberships, mealSlots, groceryWeeks, starterRecipesSeeded } = file.data
  requireValid(typeof starterRecipesSeeded === 'boolean', 'starter recipe state')
  requireValid(array(recipes, recipe) && unique(recipes, ({ id }) => id), 'recipes')
  requireValid(array(cookbooks, cookbook) && unique(cookbooks, ({ id }) => id) && unique(cookbooks, ({ nameKey }) => nameKey), 'cookbooks')
  const recipeIds = new Set(recipes.map(({ id }) => id))
  const cookbookIds = new Set(cookbooks.map(({ id }) => id))
  requireValid(array(recipePhotos, photo) && unique(recipePhotos, ({ recipeId }) => recipeId)
    && recipePhotos.every(({ recipeId }) => recipeIds.has(recipeId)), 'photo records')
  requireValid(array(cookbookMemberships, membership) && unique(cookbookMemberships, (row) => JSON.stringify([row.cookbookId, row.recipeId]))
    && cookbookMemberships.every((row) => cookbookIds.has(row.cookbookId) && recipeIds.has(row.recipeId)), 'cookbook memberships')
  requireValid(array(mealSlots, slot) && unique(mealSlots, (row) => JSON.stringify(slotKey(row)))
    && mealSlots.every(({ recipeId }) => recipeIds.has(recipeId)), 'planned meals')
  requireValid(array(groceryWeeks, groceryWeek) && unique(groceryWeeks, ({ weekStart }) => weekStart), 'grocery lists')
  return {
    format, version, exportedAt: file.exportedAt,
    data: { recipes, recipePhotos, cookbooks, cookbookMemberships, mealSlots, groceryWeeks, starterRecipesSeeded },
  }
}
