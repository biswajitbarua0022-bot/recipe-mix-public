import type { Page } from '@playwright/test'

export async function putRecords(page: Page, records: Record<string, unknown[]>) {
  await page.evaluate((values) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('recipe-mix-public')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction(Object.keys(values), 'readwrite')
      for (const [store, rows] of Object.entries(values)) {
        for (const row of rows) transaction.objectStore(store).put(row)
      }
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }), records)
}

export async function getRecords(page: Page, stores: string[]) {
  return page.evaluate((names) => new Promise<Record<string, unknown[]>>((resolve, reject) => {
    const open = indexedDB.open('recipe-mix-public')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction(names, 'readonly')
      const requests = names.map((name) => [name, transaction.objectStore(name).getAll()] as const)
      transaction.oncomplete = () => { db.close(); resolve(Object.fromEntries(requests.map(([name, request]) => [name, request.result]))) }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }), stores)
}
