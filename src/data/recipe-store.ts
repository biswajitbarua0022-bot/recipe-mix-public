import { groceryRecipeChanged } from '../groceries/grocery-list'
import type { Recipe, RecipeInput, RecipeWithPhoto } from '../recipes/recipe'
import { transact } from './database'
import type { ReadRequest } from './database'
import { markGroceryWeeksStale } from './grocery-store'
import { OrganizerError, sameSlot, slotKey } from './organizer'
import type { Cookbook, MealSlot, Membership, RecipeImpact } from './organizer'
import { readRecipeImpact, recipeImpactStores } from './organizer-store'

const recipeStores = ['recipes', 'recipePhotos']
type PhotoRecord = { recipeId: string; blob: Blob }

// An omitted photo leaves an existing photo in place. Null removes it.
export type PhotoChange = Blob | null | undefined

export type LibraryContents = {
  recipes: RecipeWithPhoto[]
  cookbooks: Cookbook[]
  memberships: Membership[]
  mealSlots: MealSlot[]
}

export function listLibrary() {
  return transact<LibraryContents>([...recipeStores, 'cookbooks', 'cookbookMemberships', 'mealSlots'], 'readonly', (tx, finish, read) => {
    const allRecipes = tx.objectStore('recipes').getAll()
    const allPhotos = tx.objectStore('recipePhotos').getAll()
    const cookbooks = tx.objectStore('cookbooks').getAll()
    const memberships = tx.objectStore('cookbookMemberships').getAll()
    read(tx.objectStore('mealSlots').getAll(), (mealSlots: MealSlot[]) => {
      const photosByRecipe = new Map((allPhotos.result as PhotoRecord[]).map(({ recipeId, blob }) => [recipeId, blob]))
      const recipes = (allRecipes.result as Recipe[]).map((recipe) => ({ ...recipe, photo: photosByRecipe.get(recipe.id) ?? null }))
      finish({ recipes, cookbooks: cookbooks.result, memberships: memberships.result, mealSlots })
    })
  })
}

function changeExisting<Result>(id: string, change: (
  recipe: Recipe, photo: Blob | null, recipes: IDBObjectStore, photos: IDBObjectStore, tx: IDBTransaction, read: ReadRequest,
) => Result, stores = recipeStores) {
  return transact<Result>(stores, 'readwrite', (tx, finish, read) => {
    const recipes = tx.objectStore('recipes')
    const photos = tx.objectStore('recipePhotos')
    const existing = recipes.get(id)
    read(photos.get(id), (photo: PhotoRecord | undefined) => {
      const recipe = existing.result as Recipe | undefined
      if (!recipe) throw new OrganizerError('This recipe is no longer in Recipe Box.')
      finish(change(recipe, photo?.blob ?? null, recipes, photos, tx, read))
    })
  })
}

export function saveRecipe(input: RecipeInput, photo: PhotoChange, id?: string) {
  if (id) {
    return changeExisting(id, (previous, previousPhoto, recipes, photos, tx, read): RecipeWithPhoto => {
      const recipe = { ...previous, ...input }
      recipes.put(recipe)
      if (photo) photos.put({ recipeId: id, blob: photo } satisfies PhotoRecord)
      if (photo === null) photos.delete(id)
      if (groceryRecipeChanged(previous, recipe)) {
        read(tx.objectStore('mealSlots').index('byRecipe').getAll(id), (slots: MealSlot[]) => markGroceryWeeksStale(tx, read, slots))
      }
      return { ...recipe, photo: photo === undefined ? previousPhoto : photo }
    }, [...recipeStores, 'mealSlots', 'groceryWeeks'])
  }

  return transact<RecipeWithPhoto>(recipeStores, 'readwrite', (tx, finish) => {
    const recipe: Recipe = { ...input, id: crypto.randomUUID(), createdAt: Date.now(), favourite: false }
    tx.objectStore('recipes').add(recipe)
    if (photo) tx.objectStore('recipePhotos').add({ recipeId: recipe.id, blob: photo } satisfies PhotoRecord)
    finish({ ...recipe, photo: photo ?? null })
  })
}

export function setFavourite(id: string, favourite: boolean) {
  return changeExisting(id, (recipe, photo, recipes): RecipeWithPhoto => {
    const updated = { ...recipe, favourite }
    recipes.put(updated)
    return { ...updated, photo }
  })
}

export function duplicateRecipe(id: string) {
  return changeExisting(id, (original, photo, recipes, photos): RecipeWithPhoto => {
    const copy = { ...original, id: crypto.randomUUID(), title: `${original.title} (copy)`, createdAt: Date.now(), favourite: false }
    recipes.add(copy)
    if (photo) photos.add({ recipeId: copy.id, blob: photo } satisfies PhotoRecord)
    return { ...copy, photo }
  })
}

export function deleteRecipe(id: string, expected: RecipeImpact) {
  return transact<void>([...recipeStores, ...recipeImpactStores], 'readwrite', (tx, finish, read) => {
    readRecipeImpact(tx, read, id, (current) => {
      const sameBooks = current.cookbooks.length === expected.cookbooks.length && current.cookbooks.every((book, index) => (
        book.id === expected.cookbooks[index].id && book.name === expected.cookbooks[index].name
      ))
      const sameMeals = current.slots.length === expected.slots.length && current.slots.every((slot, index) => sameSlot(slot, expected.slots[index]))
      if (!sameBooks || !sameMeals) throw new OrganizerError('The recipe’s cookbook or meal links changed. Open Delete again to review them.')

      const memberships = tx.objectStore('cookbookMemberships')
      read(memberships.index('byRecipe').getAllKeys(id), (keys) => {
        tx.objectStore('recipes').delete(id)
        tx.objectStore('recipePhotos').delete(id)
        for (const key of keys) memberships.delete(key)
        const slots = tx.objectStore('mealSlots')
        for (const slot of current.slots) slots.delete(slotKey(slot))
        markGroceryWeeksStale(tx, read, current.slots)
        finish(undefined)
      })
    })
  })
}
