import { emptyGroceryWeek, generateItems, hasDuplicateItem, retainGeneratedStatus } from '../groceries/grocery-list'
import type { GroceryWeek, ManualItem } from '../groceries/grocery-list'
import { addDays, isPlannerDate, weekStart } from '../planner/calendar'
import { aisles } from '../recipes/recipe'
import type { Aisle, Recipe } from '../recipes/recipe'
import { transact } from './database'
import type { ReadRequest } from './database'
import { OrganizerError } from './organizer'
import type { MealSlot } from './organizer'

function validSnapshot(record: GroceryWeek | undefined) {
  return record && Array.isArray(record.rows) && Array.isArray(record.manualItems) ? record : null
}

function validateWeek(monday: string) {
  if (!isPlannerDate(monday) || weekStart(monday) !== monday) throw new OrganizerError('Choose a valid grocery week.')
}

export function getGroceryWeek(monday: string) {
  validateWeek(monday)
  return transact<GroceryWeek | null>(['groceryWeeks'], 'readonly', (tx, finish, read) => {
    read(tx.objectStore('groceryWeeks').get(monday), (record) => finish(validSnapshot(record)))
  })
}

export function generateGroceryWeek(monday: string) {
  validateWeek(monday)
  return transact<GroceryWeek>(['groceryWeeks', 'mealSlots', 'recipes'], 'readwrite', (tx, finish, read) => {
    const weeks = tx.objectStore('groceryWeeks')
    const previous = weeks.get(monday)
    const recipes = tx.objectStore('recipes').getAll()
    const range = IDBKeyRange.bound(monday, addDays(monday, 6))
    read(tx.objectStore('mealSlots').index('byDate').getAll(range), (slots: MealSlot[]) => {
      const current = validSnapshot(previous.result) ?? emptyGroceryWeek(monday)
      const rows = generateItems(slots, recipes.result as Recipe[])
      const snapshot: GroceryWeek = {
        ...current,
        generationId: crypto.randomUUID(),
        stale: false,
        plannedMeals: slots.length,
        rows: retainGeneratedStatus(rows, current.rows),
      }
      weeks.put(snapshot)
      finish(snapshot)
    })
  })
}

export function markGroceryWeeksStale(tx: IDBTransaction, read: ReadRequest, slots: MealSlot[]) {
  const groceryWeeks = tx.objectStore('groceryWeeks')
  const weeks = new Set(slots.map(({ date }) => weekStart(date)))
  for (const week of weeks) {
    read(groceryWeeks.get(week), (snapshot: GroceryWeek | undefined) => {
      if (snapshot && snapshot.generationId !== null && !snapshot.stale) groceryWeeks.put({ ...snapshot, stale: true })
    })
  }
}

function updateWeek(monday: string, update: (snapshot: GroceryWeek) => GroceryWeek) {
  validateWeek(monday)
  return transact<GroceryWeek>(['groceryWeeks'], 'readwrite', (tx, finish, read) => {
    const weeks = tx.objectStore('groceryWeeks')
    read(weeks.get(monday), (record) => {
      const snapshot = update(validSnapshot(record) ?? emptyGroceryWeek(monday))
      weeks.put(snapshot)
      finish(snapshot)
    })
  })
}

export function addManualItem(monday: string, text: string, aisle: Aisle) {
  const comma = text.indexOf(',')
  const name = (comma === -1 ? text : text.slice(0, comma)).trim()
  const quantityText = comma === -1 ? '' : text.slice(comma + 1).trim()
  if (!name || name.length > 160 || quantityText.length > 80 || !aisles.includes(aisle)) {
    throw new OrganizerError('Enter an item name up to 160 characters and an optional quantity up to 80 characters.')
  }
  return updateWeek(monday, (snapshot) => {
    if (hasDuplicateItem(snapshot, name, quantityText)) throw new OrganizerError(`${name} is already on this week’s list${quantityText ? ' for that unit' : ''}.`)
    const item: ManualItem = { kind: 'manual', id: `manual-${crypto.randomUUID()}`, name, aisle, quantityText, status: 'unchecked' }
    return { ...snapshot, manualItems: [...snapshot.manualItems, item] }
  })
}

function verifyGeneration(snapshot: GroceryWeek, generationId: string | null) {
  if (snapshot.generationId !== generationId) throw new OrganizerError('This list was regenerated. Reload to see the current items.')
}

export function setItemChecked(monday: string, id: string, checked: boolean, generationId: string | null) {
  return updateWeek(monday, (snapshot) => {
    verifyGeneration(snapshot, generationId)
    const status = checked ? 'checked' : 'unchecked'
    const generated = snapshot.rows.find((row) => row.id === id && row.status !== 'cleared')
    if (generated) return { ...snapshot, rows: snapshot.rows.map((row) => row.id === id ? { ...row, status } : row) }
    if (snapshot.manualItems.some((item) => item.id === id)) {
      return { ...snapshot, manualItems: snapshot.manualItems.map((item) => item.id === id ? { ...item, status } : item) }
    }
    throw new OrganizerError('This item was cleared or removed. Reload to see the current list.')
  })
}

export function removeManualItem(monday: string, id: string) {
  return updateWeek(monday, (snapshot) => ({ ...snapshot, manualItems: snapshot.manualItems.filter((item) => item.id !== id) }))
}

export function clearCheckedItems(monday: string, ids: string[], generationId: string | null) {
  return updateWeek(monday, (snapshot) => {
    verifyGeneration(snapshot, generationId)
    const selected = new Set(ids)
    const checked = new Set([...snapshot.rows, ...snapshot.manualItems].filter((item) => item.status === 'checked').map(({ id }) => id))
    if (!ids.every((id) => checked.has(id))) throw new OrganizerError('Checked items changed. Reload to review the current list.')
    return {
      ...snapshot,
      rows: snapshot.rows.map((item) => selected.has(item.id) ? { ...item, status: 'cleared' } : item),
      manualItems: snapshot.manualItems.filter((item) => !selected.has(item.id)),
    }
  })
}
