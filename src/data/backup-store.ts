import type { GroceryWeek } from '../groceries/grocery-list'
import type { Recipe } from '../recipes/recipe'
import { transact } from './database'
import type { Cookbook, MealSlot, Membership } from './organizer'

export type BackupData<Photo = Blob> = {
  recipes: Recipe[]
  recipePhotos: { recipeId: string; blob: Photo }[]
  cookbooks: Cookbook[]
  cookbookMemberships: Membership[]
  mealSlots: MealSlot[]
  groceryWeeks: GroceryWeek[]
  starterRecipesSeeded: boolean
}

type RecordStores = Omit<BackupData, 'starterRecipesSeeded'>
const recordStores = ['recipes', 'recipePhotos', 'cookbooks', 'cookbookMemberships', 'mealSlots', 'groceryWeeks'] as const satisfies readonly (keyof RecordStores)[]
const stores = [...recordStores, 'metadata']
const seedKey = 'starterRecipesSeeded'
const exportKey = 'lastBackupExport'

export function readBackupData() {
  return transact<{ data: BackupData; lastExport: number | undefined }>(stores, 'readonly', (tx, finish, read) => {
    const records = {
      recipes: tx.objectStore('recipes').getAll(),
      recipePhotos: tx.objectStore('recipePhotos').getAll(),
      cookbooks: tx.objectStore('cookbooks').getAll(),
      cookbookMemberships: tx.objectStore('cookbookMemberships').getAll(),
      mealSlots: tx.objectStore('mealSlots').getAll(),
      groceryWeeks: tx.objectStore('groceryWeeks').getAll(),
    }
    const metadata = tx.objectStore('metadata')
    const seed = metadata.get(seedKey)
    read(metadata.get(exportKey), (lastExport) => {
      finish({
        data: {
          recipes: records.recipes.result,
          recipePhotos: records.recipePhotos.result,
          cookbooks: records.cookbooks.result,
          cookbookMemberships: records.cookbookMemberships.result,
          mealSlots: records.mealSlots.result,
          groceryWeeks: records.groceryWeeks.result,
          starterRecipesSeeded: seed.result ?? true,
        },
        lastExport,
      })
    })
  })
}

export function markBackupExported(time: number) {
  return transact<void>(['metadata'], 'readwrite', (tx) => {
    tx.objectStore('metadata').put(time, exportKey)
  })
}

export function replaceBackupData(data: BackupData) {
  return transact<void>(stores, 'readwrite', (tx) => {
    for (const storeName of recordStores) {
      const store = tx.objectStore(storeName)
      store.clear()
      for (const record of data[storeName]) store.add(record)
    }
    tx.objectStore('metadata').put(data.starterRecipesSeeded, seedKey)
  })
}
