import { isDateKey } from '../planner/calendar'
import { isServingCount } from '../recipes/scale-ingredients'
import { transact } from './database'
import type { ReadRequest } from './database'
import { markGroceryWeeksStale } from './grocery-store'
import { OrganizerError, orderSlots, plannerMeals, sameSlot, slotKey } from './organizer'
import type { Cookbook, MealSlot, Membership, RecipeImpact } from './organizer'

const collectionStores = ['cookbooks', 'cookbookMemberships']
const mealStores = ['mealSlots', 'groceryWeeks']
export const recipeImpactStores = [...collectionStores, ...mealStores]

export function saveCookbook(rawName: string, id?: string) {
  const name = rawName.trim()
  if (!name || name.length > 60) throw new OrganizerError('Enter a cookbook name between 1 and 60 characters.')
  const nameKey = name.normalize('NFC').toLowerCase()

  return transact<Cookbook>(['cookbooks'], 'readwrite', (tx, finish, read) => {
    const books = tx.objectStore('cookbooks')
    const duplicate = books.index('byName').getKey(nameKey)
    if (id) {
      read(books.get(id), (existing: Cookbook | undefined) => {
        if (!existing) throw new OrganizerError('This cookbook is no longer available.')
        if (duplicate.result && duplicate.result !== id) throw new OrganizerError('A cookbook already uses that name.')
        const updated = { ...existing, name, nameKey }
        books.put(updated)
        finish(updated)
      })
    } else {
      read(duplicate, (existing) => {
        if (existing) throw new OrganizerError('A cookbook already uses that name.')
        const book: Cookbook = { id: crypto.randomUUID(), name, nameKey, createdAt: Date.now() }
        books.add(book)
        finish(book)
      })
    }
  })
}

export function deleteCookbook(id: string) {
  return transact<void>(collectionStores, 'readwrite', (tx, finish, read) => {
    const links = tx.objectStore('cookbookMemberships')
    read(links.index('byCookbook').getAllKeys(id), (keys) => {
      for (const key of keys) links.delete(key)
      tx.objectStore('cookbooks').delete(id)
      finish(undefined)
    })
  })
}

export function changeMemberships(add: Membership[], remove: Membership[]) {
  return transact<Membership[]>([...collectionStores, 'recipes'], 'readwrite', (tx, finish, read) => {
    const links = tx.objectStore('cookbookMemberships')
    const bookIds = tx.objectStore('cookbooks').getAllKeys()
    read(tx.objectStore('recipes').getAllKeys(), (recipeIds) => {
      const books = new Set(bookIds.result)
      const recipes = new Set(recipeIds)
      if (add.some(({ cookbookId, recipeId }) => !books.has(cookbookId) || !recipes.has(recipeId))) {
        throw new OrganizerError('A recipe or cookbook is no longer available. Reload and try again.')
      }
      for (const { cookbookId, recipeId } of remove) links.delete([cookbookId, recipeId])
      for (const entry of add) links.put(entry)
      read(links.getAll(), finish)
    })
  })
}

export function readRecipeImpact(tx: IDBTransaction, read: ReadRequest, id: string, consume: (impact: RecipeImpact) => void) {
  const memberships = tx.objectStore('cookbookMemberships').index('byRecipe').getAll(id)
  const books = tx.objectStore('cookbooks').getAll()
  read(tx.objectStore('mealSlots').index('byRecipe').getAll(id), (slots: MealSlot[]) => {
    const ids = new Set((memberships.result as Membership[]).map(({ cookbookId }) => cookbookId))
    const cookbooks = (books.result as Cookbook[]).filter(({ id }) => ids.has(id)).map(({ id, name }) => ({ id, name }))
    consume({ cookbooks, slots: slots.sort(orderSlots) })
  })
}

export function getRecipeImpact(id: string) {
  return transact<RecipeImpact>(recipeImpactStores, 'readonly', (tx, finish, read) => readRecipeImpact(tx, read, id, finish))
}

function verifySlot(current: MealSlot | undefined, expected: MealSlot | undefined) {
  if (!sameSlot(current, expected)) throw new OrganizerError('This meal slot changed. Reload to see the current plan.')
}

export function saveMeal(slot: MealSlot, expected?: MealSlot) {
  if (!isDateKey(slot.date) || !plannerMeals.includes(slot.meal) || !isServingCount(slot.servings)) {
    throw new OrganizerError('Choose a valid date, meal, and whole number of servings.')
  }

  return transact<MealSlot>([...mealStores, 'recipes'], 'readwrite', (tx, finish, read) => {
    const slots = tx.objectStore('mealSlots')
    const recipe = tx.objectStore('recipes').getKey(slot.recipeId)
    read(slots.get(slotKey(slot)), (existing: MealSlot | undefined) => {
      if (!recipe.result) throw new OrganizerError('This recipe is no longer in Recipe Box.')
      verifySlot(existing, expected)
      if (!sameSlot(slot, existing)) {
        slots.put(slot)
        markGroceryWeeksStale(tx, read, [slot])
      }
      finish(slot)
    })
  })
}

export function removeMeal(slot: MealSlot) {
  return transact<void>(mealStores, 'readwrite', (tx, finish, read) => {
    const slots = tx.objectStore('mealSlots')
    read(slots.get(slotKey(slot)), (existing: MealSlot | undefined) => {
      verifySlot(existing, slot)
      slots.delete(slotKey(slot))
      markGroceryWeeksStale(tx, read, [slot])
      finish(undefined)
    })
  })
}

export function clearMeals(from: string, through: string, expected: MealSlot[]) {
  return transact<MealSlot[]>(mealStores, 'readwrite', (tx, finish, read) => {
    const slots = tx.objectStore('mealSlots')
    read(slots.index('byDate').getAll(IDBKeyRange.bound(from, through)), (current: MealSlot[]) => {
      const sorted = [...expected].sort(orderSlots)
      if (current.length !== sorted.length || !current.sort(orderSlots).every((slot, index) => sameSlot(slot, sorted[index]))) {
        throw new OrganizerError('The plan changed since you opened this confirmation. Reload and review the current meals.')
      }
      for (const slot of current) slots.delete(slotKey(slot))
      markGroceryWeeksStale(tx, read, current)
      finish(current)
    })
  })
}
