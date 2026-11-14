import { starterRecipes } from './starter-recipes'

const databaseName = 'recipe-mix-public'
const databaseVersion = 2
let connection: Promise<IDBDatabase> | undefined

function openDatabase() {
  if (connection) return connection

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    let blocked = false

    request.onupgradeneeded = (event) => {
      const database = request.result
      if (event.oldVersion < 1) {
        const recipes = database.createObjectStore('recipes', { keyPath: 'id' })
        database.createObjectStore('recipePhotos', { keyPath: 'recipeId' })
        const metadata = database.createObjectStore('metadata')
        database.createObjectStore('cookbooks', { keyPath: 'id' })
        database.createObjectStore('cookbookMemberships', { keyPath: ['cookbookId', 'recipeId'] })
        database.createObjectStore('mealSlots', { keyPath: ['date', 'meal'] })
        database.createObjectStore('groceryWeeks', { keyPath: 'weekStart' })
        for (const recipe of starterRecipes) recipes.add(recipe)
        metadata.add(true, 'starterRecipesSeeded')
      }
      if (event.oldVersion < 2) {
        const upgrade = request.transaction!
        upgrade.objectStore('cookbooks').createIndex('byName', 'nameKey', { unique: true })
        const memberships = upgrade.objectStore('cookbookMemberships')
        memberships.createIndex('byCookbook', 'cookbookId')
        memberships.createIndex('byRecipe', 'recipeId')
        const slots = upgrade.objectStore('mealSlots')
        slots.createIndex('byDate', 'date')
        slots.createIndex('byRecipe', 'recipeId')
      }
    }

    request.onblocked = () => {
      blocked = true
      reject(new Error('Close other Recipe Mix tabs and try again.'))
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      if (blocked) {
        database.close()
        return
      }
      database.onclose = () => { if (connection === opening) connection = undefined }
      database.onversionchange = () => {
        database.close()
        if (connection === opening) connection = undefined
      }
      resolve(database)
    }
  })

  connection = opening
  void opening.catch(() => { if (connection === opening) connection = undefined })
  return opening
}

export type ReadRequest = <Value>(request: IDBRequest<Value>, consume: (value: Value) => void) => void

export async function transact<Result>(stores: string[], mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction, finish: (result: Result) => void, read: ReadRequest) => void,
) {
  const database = await openDatabase()
  return new Promise<Result>((resolve, reject) => {
    const transaction = database.transaction(stores, mode)
    let result: Result
    let failure: unknown

    transaction.oncomplete = () => resolve(result)
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('The storage transaction was interrupted.'))

    function run(action: () => void) {
      try {
        action()
      } catch (error) {
        failure = error
        transaction.abort()
      }
    }

    // Queue dependent requests within success handlers while the transaction is active.
    const read: ReadRequest = (request, consume) => {
      request.onsuccess = () => run(() => consume(request.result))
    }
    run(() => operation(transaction, (value) => { result = value }, read))
  })
}
