import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { getRecords, putRecords } from './idb-fixtures'

test.use({ timezoneId: 'America/Los_Angeles' })

async function createCookbook(page: Page, name: string) {
  await page.getByRole('button', { name: /Create (your first )?cookbook/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Create cookbook', exact: true })
  await dialog.getByLabel('Cookbook name').fill(name)
  await dialog.getByRole('button', { name: 'Create cookbook', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test('creates, renames and deletes cookbooks while preserving shared recipes', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#/cookbooks')
  await createCookbook(page, 'Weeknight dinners')
  await page.getByRole('button', { name: 'Create cookbook' }).click()
  const create = page.getByRole('dialog', { name: 'Create cookbook' })
  await create.getByLabel('Cookbook name').fill('  WEEKnight dinners  ')
  await create.getByRole('button', { name: 'Create cookbook' }).click()
  await expect(create.getByRole('alert')).toContainText('already uses that name')
  await create.getByLabel('Cookbook name').fill('Family favourites')
  await create.getByRole('button', { name: 'Create cookbook' }).click()
  await expect(create).toBeHidden()

  await page.goto('./#/recipes/dal-tadka')
  await page.getByRole('button', { name: 'Add to cookbook' }).click()
  const collections = page.getByRole('dialog', { name: 'Add Dal Tadka to cookbooks' })
  await collections.getByRole('searchbox', { name: 'Search cookbooks' }).fill('weeknight')
  await collections.getByRole('checkbox', { name: 'Weeknight dinners' }).check()
  await collections.getByRole('button', { name: 'Clear search' }).click()
  await collections.getByRole('checkbox', { name: 'Family favourites' }).check()
  await collections.getByRole('button', { name: 'Save cookbooks' }).click()
  await expect(page.getByRole('button', { name: 'In 2 cookbooks' })).toBeVisible()

  await page.goto('./#/cookbooks')
  await page.getByRole('link', { name: /^Family favourites/ }).click()
  await expect(page.getByRole('link', { name: /^Dal Tadka/ })).toBeVisible()
  await page.getByRole('button', { name: 'Add recipes' }).click()
  const picker = page.getByRole('dialog', { name: 'Add recipes to Family favourites' })
  await picker.getByRole('searchbox').fill('curry leaves')
  await picker.getByRole('checkbox', { name: 'Poha' }).check()
  await picker.getByRole('button', { name: 'Add 1 recipe' }).click()
  await expect(page.getByRole('link', { name: /^Poha/ })).toBeVisible()
  await page.getByRole('button', { name: 'Remove Poha' }).click()
  await expect(page.getByRole('link', { name: /^Poha/ })).toHaveCount(0)
  await page.getByLabel('Cookbook actions').click()
  await page.getByRole('button', { name: 'Rename cookbook' }).click()
  const rename = page.getByRole('dialog', { name: 'Rename cookbook' })
  await rename.getByLabel('Cookbook name').fill('Family recipes')
  await rename.getByRole('button', { name: 'Save name' }).click()
  await expect(page.getByRole('heading', { name: 'Family recipes' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Family recipes' })).toBeVisible()

  await page.getByRole('link', { name: 'Cookbooks', exact: true }).first().click()
  await page.getByRole('link', { name: /^Weeknight dinners/ }).click()
  await page.getByLabel('Cookbook actions').click()
  await page.getByRole('button', { name: 'Delete cookbook' }).click()
  const deletion = page.getByRole('dialog', { name: 'Delete Weeknight dinners?' })
  await deletion.getByRole('button', { name: 'Delete cookbook' }).click()
  await expect(page.getByRole('link', { name: /^Weeknight dinners/ })).toHaveCount(0)
  await page.getByRole('link', { name: /^Family recipes/ }).click()
  await expect(page.getByRole('link', { name: /^Dal Tadka/ })).toBeVisible()
  await page.goto('./#/recipes')
  await expect(page.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveCount(10)
})

test('schedules from both screens across a local New Year week and confirms replacements', async ({ page }) => {
  test.setTimeout(60_000)
  await page.clock.setFixedTime(new Date('2026-01-05T07:30:00Z'))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#/planner')
  await expect(page.getByText(/29 Dec 2025\s*–\s*4 Jan 2026/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Sun\s*4/, description: 'Sunday 4 Jan, 0 planned' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Add breakfast, Sunday 4 Jan' }).click()
  const add = page.getByRole('dialog', { name: 'Add breakfast' })
  await add.getByRole('searchbox').fill('curry leaves')
  await add.getByRole('radio', { name: 'Poha' }).check()
  await expect(add.getByRole('spinbutton', { name: 'Servings' })).toHaveValue('2')
  await add.getByRole('button', { name: 'Add to Sun breakfast' }).click()

  const breakfast = page.getByRole('button', { name: /Poha.*Serves 2/, description: /Sunday 4 Jan breakfast/ })
  await breakfast.click()
  await page.getByRole('dialog', { name: 'Poha', exact: true }).getByRole('link', { name: 'View recipe' }).click()
  await page.getByRole('button', { name: 'More servings' }).click()
  await page.getByRole('button', { name: 'More servings' }).click()
  await page.getByRole('button', { name: 'Add to plan' }).click()
  const detailPicker = page.getByRole('dialog', { name: 'Add Poha to the plan' })
  await expect(detailPicker.getByRole('radio', { name: 'Poha' })).toBeChecked()
  await expect(detailPicker.getByRole('spinbutton', { name: 'Servings' })).toHaveValue('4')
  await detailPicker.getByRole('button', { name: 'Lunch Free' }).click()
  await detailPicker.getByRole('button', { name: 'Add to Sun lunch' }).click()
  await page.getByRole('link', { name: 'View plan' }).click()
  await expect(breakfast).toBeVisible()
  const lunch = page.getByRole('button', { name: /Poha.*Serves 4/, description: /Sunday 4 Jan lunch/ })
  await expect(lunch).toBeVisible()
  await page.reload()
  await expect(lunch).toBeVisible()

  await breakfast.click()
  await page.getByRole('dialog', { name: 'Poha', exact: true }).getByRole('button', { name: 'Replace meal' }).click()
  const picker = page.getByRole('dialog', { name: 'Replace breakfast' })
  await picker.getByRole('radio', { name: 'Dal Tadka' }).check()
  await picker.getByRole('button', { name: 'Review replacement' }).click()
  const confirm = page.getByRole('dialog', { name: 'Replace Sun breakfast?' })
  await expect(confirm).toContainText('Poha (serves 2) with Dal Tadka (serves 4)')
  await confirm.getByRole('button', { name: 'Keep current meal' }).click()
  await picker.getByRole('button', { name: 'Review replacement' }).click()
  await confirm.getByRole('button', { name: 'Replace meal' }).click()
  await expect(page.getByRole('button', { name: /Dal Tadka.*Serves 4/, description: /Sunday 4 Jan breakfast/ })).toBeVisible()
  await expect(lunch).toBeVisible()

  await lunch.click()
  const options = page.getByRole('dialog', { name: 'Poha', exact: true })
  await options.getByRole('spinbutton', { name: 'Servings' }).fill('5')
  await options.getByRole('button', { name: 'Save servings' }).click()
  const biggerLunch = page.getByRole('button', { name: /Poha.*Serves 5/, description: /Sunday 4 Jan lunch/ })
  await biggerLunch.click()
  await options.getByRole('button', { name: 'Remove meal' }).click()
  await expect(page.getByRole('button', { name: 'Add lunch, Sunday 4 Jan' })).toBeVisible()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(biggerLunch).toBeVisible()
  await page.getByRole('button', { name: 'Next week' }).click()
  await expect(page.getByText(/5\s*–\s*11 Jan 2026/)).toBeVisible()
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(biggerLunch).toBeVisible()
  expect(await page.locator('body').evaluate((body) => body.scrollWidth)).toBe(390)
})

test('clears a day or week only after confirmation and preserves an unrelated week', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-01-04T20:00:00Z'))
  await page.goto('./#/planner')
  await expect(page.getByText('0 of 21 meals planned this week')).toBeVisible()
  const nextWeek = { date: '2026-01-05', meal: 'Dinner', recipeId: 'poha', servings: 7 }
  await putRecords(page, { mealSlots: [
    { date: '2025-12-29', meal: 'Dinner', recipeId: 'dal-tadka', servings: 2 },
    { date: '2026-01-04', meal: 'Breakfast', recipeId: 'poha', servings: 3 },
    { date: '2026-01-04', meal: 'Dinner', recipeId: 'dal-tadka', servings: 4 },
    nextWeek,
  ] })
  await page.reload()
  const clearDay = page.getByRole('button', { name: 'Clear day, Sunday 4 Jan' })
  const dayConfirm = page.getByRole('dialog', { name: 'Clear Sunday 4 Jan?' })
  await clearDay.click()
  await expect(dayConfirm).toContainText('Breakfast · Poha')
  await dayConfirm.getByRole('button', { name: 'Keep meals' }).click()
  await expect(page.getByText('3 of 21 meals planned this week')).toBeVisible()
  await clearDay.click()
  await dayConfirm.getByRole('button', { name: 'Clear day', exact: true }).click()
  await expect(page.getByText('1 of 21 meals planned this week')).toBeVisible()
  await expect(page.getByRole('button', { name: /Dal Tadka/, description: /Monday 29 Dec dinner/ })).toBeVisible()

  await page.getByRole('button', { name: 'Clear week', exact: true }).click()
  const weekConfirm = page.getByRole('dialog', { name: /^Clear the week/ })
  await expect(weekConfirm).toContainText('Dal Tadka')
  await weekConfirm.getByRole('button', { name: 'Clear week', exact: true }).click()
  await expect(page.getByText('0 of 21 meals planned this week')).toBeVisible()
  await page.getByRole('button', { name: 'Next week' }).click()
  await expect(page.getByRole('button', { name: /Poha.*Serves 7/, description: /Monday 5 Jan dinner/ })).toBeVisible()
  expect((await getRecords(page, ['mealSlots'])).mealSlots).toEqual([nextWeek])
})

test('previews recipe links, rolls back a failed deletion, then removes links together', async ({ page }) => {
  await page.goto('./#/recipes/dal-tadka')
  await expect(page.getByRole('heading', { name: 'Dal Tadka', exact: true })).toBeVisible()
  const books = [
    { id: 'family', name: 'Family favourites', nameKey: 'family favourites', createdAt: 1 },
    { id: 'weeknight', name: 'Weeknight dinners', nameKey: 'weeknight dinners', createdAt: 2 },
  ]
  const otherMembership = { cookbookId: 'family', recipeId: 'poha' }
  const otherMeal = { date: '2026-01-12', meal: 'Breakfast', recipeId: 'poha', servings: 2 }
  const snapshots = ['2025-12-29', '2026-01-05', '2026-01-12'].map((weekStart) => ({ weekStart, stale: false, rows: [{ name: 'Onion', checked: true }] }))
  await putRecords(page, {
    cookbooks: books,
    cookbookMemberships: books.map(({ id: cookbookId }) => ({ cookbookId, recipeId: 'dal-tadka' })).concat(otherMembership),
    mealSlots: [{ date: '2026-01-04', meal: 'Dinner', recipeId: 'dal-tadka', servings: 4 }, { date: '2026-01-06', meal: 'Lunch', recipeId: 'dal-tadka', servings: 2 }, otherMeal],
    groceryWeeks: snapshots,
  })

  const confirm = page.getByRole('dialog', { name: 'Delete Dal Tadka?' })
  async function openDelete() {
    await page.getByLabel('Recipe actions').click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(confirm).toContainText('Family favourites')
    await expect(confirm).toContainText('Weeknight dinners')
    await expect(confirm).toContainText('Dinner · serves 4')
    await expect(confirm).toContainText('Lunch · serves 2')
  }

  await openDelete()
  await page.evaluate(() => {
    const remove = IDBObjectStore.prototype.delete
    IDBObjectStore.prototype.delete = function (key) {
      if (this.name === 'mealSlots') {
        IDBObjectStore.prototype.delete = remove
        throw new DOMException('Test meal write failure', 'QuotaExceededError')
      }
      return remove.call(this, key)
    }
  })
  await confirm.getByRole('button', { name: 'Delete recipe' }).click()
  await expect(page.getByRole('alert')).toContainText('out of storage space')
  const stores = ['recipes', 'cookbooks', 'cookbookMemberships', 'mealSlots', 'groceryWeeks']
  const failed = await getRecords(page, stores)
  expect(failed.recipes).toHaveLength(10)
  expect(failed.cookbookMemberships).toHaveLength(3)
  expect(failed.mealSlots).toHaveLength(3)
  expect(failed.groceryWeeks).toEqual(snapshots)

  await openDelete()
  await putRecords(page, { mealSlots: [{ date: '2026-01-07', meal: 'Dinner', recipeId: 'dal-tadka', servings: 6 }] })
  await confirm.getByRole('button', { name: 'Delete recipe' }).click()
  await expect(page.getByRole('alert')).toContainText('links changed')
  expect((await getRecords(page, ['mealSlots'])).mealSlots).toHaveLength(4)

  await openDelete()
  await expect(confirm).toContainText('Dinner · serves 6')
  await confirm.getByRole('button', { name: 'Delete recipe' }).click()
  await expect(page.getByRole('heading', { name: 'Recipe Box' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Poha', exact: true })).toBeVisible()
  const remaining = await getRecords(page, stores)
  expect(remaining.recipes).toHaveLength(9)
  expect(remaining.recipes).not.toContainEqual(expect.objectContaining({ id: 'dal-tadka' }))
  expect(remaining.cookbooks).toEqual(books)
  expect(remaining.cookbookMemberships).toEqual([otherMembership])
  expect(remaining.mealSlots).toEqual([otherMeal])
  expect(remaining.groceryWeeks).toEqual(snapshots.map((snapshot, index) => ({ ...snapshot, stale: index < 2 })))
})

test('upgrades a C3 database without reseeding or losing a saved recipe', async ({ page }) => {
  await page.addInitScript(() => {
    const open = indexedDB.open('recipe-mix-public', 1)
    open.onupgradeneeded = () => {
      const db = open.result
      db.createObjectStore('recipes', { keyPath: 'id' }).add({
        id: 'saved-recipe', title: 'Already saved', baseServings: 2, prepMinutes: 5, cookMinutes: 10, cuisine: 'North Indian', meal: 'Dinner',
        diet: 'Veg', ingredients: [], steps: ['Stir.'], favourite: true, createdAt: 1,
      })
      db.createObjectStore('recipePhotos', { keyPath: 'recipeId' })
      db.createObjectStore('metadata').add(true, 'starterRecipesSeeded')
      db.createObjectStore('cookbooks', { keyPath: 'id' })
      db.createObjectStore('cookbookMemberships', { keyPath: ['cookbookId', 'recipeId'] })
      db.createObjectStore('mealSlots', { keyPath: ['date', 'meal'] })
      db.createObjectStore('groceryWeeks', { keyPath: 'weekStart' })
    }
    open.onsuccess = () => open.result.close()
  })
  await page.goto('./#/recipes')
  await expect(page.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Already saved' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Cookbooks' }).click()
  await createCookbook(page, 'After upgrade')
  await expect(page.getByRole('link', { name: /^After upgrade/ })).toBeVisible()
})
