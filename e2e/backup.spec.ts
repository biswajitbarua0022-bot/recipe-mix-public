import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { starterRecipes } from '../src/data/starter-recipes'
import { emptyGroceryWeek, generateItems } from '../src/groceries/grocery-list'
import type { GroceryWeek } from '../src/groceries/grocery-list'
import type { MealSlot } from '../src/data/organizer'
import type { BackupFile } from '../src/settings/backup-format'
import { getRecords, putRecords } from './idb-fixtures'

async function exportBackup(page: Page, button: string) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: button }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^recipe-mix-backup-\d{4}-\d{2}-\d{2}\.json$/)
  return JSON.parse(await readFile(await download.path(), 'utf8')) as BackupFile
}

function upload(page: Page, file: BackupFile | string) {
  return page.getByLabel('Backup file').setInputFiles({
    name: 'recipe-mix-backup-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(typeof file === 'string' ? file : JSON.stringify(file)),
  })
}

const empty: BackupFile = {
  format: 'recipe-mix-backup', version: 1, exportedAt: '2026-11-01T12:00:00.000Z',
  data: { recipes: [], recipePhotos: [], cookbooks: [], cookbookMemberships: [], mealSlots: [], groceryWeeks: [], starterRecipesSeeded: true },
}

test('exports and atomically restores photos, recipes, cookbooks, meals and grocery state', async ({ page }) => {
  await page.goto('./#/recipes/poha/edit')
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 32
    canvas.getContext('2d')!.fillRect(0, 0, 64, 32)
    return canvas.toDataURL().split(',')[1]
  })
  await page.locator('input[type=file]').setInputFiles({ name: 'round-trip.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') })
  await expect(page.getByRole('button', { name: 'Replace photo' })).toBeVisible()
  await page.getByRole('button', { name: 'Save recipe' }).first().click()
  await expect(page.getByRole('heading', { name: 'Poha', exact: true })).toBeVisible()
  const slots: MealSlot[] = [{ date: '2026-11-02', meal: 'Breakfast', servings: 4, recipeId: 'poha' }]
  const week: GroceryWeek = {
    ...emptyGroceryWeek('2026-11-02'), generationId: 'generated-1', stale: true, plannedMeals: 2,
    rows: generateItems([...slots, { date: '2026-11-03', meal: 'Dinner', servings: 2, recipeId: 'deleted-recipe' }], [
      ...starterRecipes, { ...starterRecipes[0], id: 'deleted-recipe', title: 'Former dinner' },
    ]).map((row, index) => ({ ...row, status: index === 0 ? 'checked' : index === 1 ? 'cleared' : 'unchecked' })),
    manualItems: [{ id: 'manual-1', kind: 'manual', name: 'Curd', quantityText: '500 g', aisle: 'Dairy & eggs', status: 'checked' }],
  }
  await putRecords(page, {
    cookbooks: [{ id: 'breakfast', name: 'Breakfast', nameKey: 'breakfast', createdAt: 1 }],
    cookbookMemberships: [{ cookbookId: 'breakfast', recipeId: 'poha' }],
    mealSlots: slots,
    groceryWeeks: [week],
  })

  await page.goto('./#/settings')
  const backup = await exportBackup(page, 'Export backup')
  expect(backup.data.recipePhotos).toEqual([{ recipeId: 'poha', blob: { type: expect.stringMatching(/^image\/(webp|png)$/), base64: expect.any(String) } }])
  expect(backup.data.groceryWeeks).toEqual(JSON.parse(JSON.stringify([week])))
  expect(backup.data.starterRecipesSeeded).toBe(true)
  await upload(page, empty)
  const dialog = page.getByRole('dialog', { name: 'Review backup' })
  await expect(dialog.getByRole('row', { name: /^Recipes/ })).toHaveText('Recipes010')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  expect((await getRecords(page, ['recipes'])).recipes).toHaveLength(10)

  await upload(page, empty)
  await dialog.getByRole('button', { name: 'Replace with backup' }).click()
  await expect(page.getByText('Backup restored')).toBeVisible()
  await page.getByRole('link', { name: 'Open Recipe Box' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your Recipe Box is empty' })).toBeVisible()

  await page.goto('./#/settings')
  await upload(page, backup)
  await expect(dialog.getByRole('row', { name: /^Photos/ })).toHaveText('Photos10')
  expect((await getRecords(page, ['recipes'])).recipes).toHaveLength(0)
  expect((await exportBackup(page, 'Export current data first')).data).toEqual(empty.data)
  await expect(dialog.getByText('Current backup download started.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Replace with backup' }).click()
  await expect(page.getByText('Backup restored')).toBeVisible()

  await page.getByRole('link', { name: 'Open Recipe Box' }).click()
  await page.getByRole('link', { name: 'Poha', exact: true }).click()
  await expect.poll(() => page.locator('.recipe-photo').evaluate((photo: HTMLImageElement) => photo.naturalWidth)).toBe(64)
  await page.goto('./#/settings')
  expect((await exportBackup(page, 'Export backup')).data).toEqual(backup.data)
})

test('rejects invalid backups before showing a replacement action', async ({ page }) => {
  await page.goto('./#/settings')
  const cases = [
    { file: '{invalid JSON', error: 'does not contain valid JSON' },
    { file: JSON.stringify({ ...empty, version: 99 }), error: 'version is unsupported' },
    { file: { ...empty, data: { ...empty.data, mealSlots: [{ date: '2026-11-02', meal: 'Dinner', servings: 4, recipeId: 'missing' }] } }, error: 'invalid planned meals' },
    { file: { ...empty, data: { ...empty.data, recipes: [starterRecipes[0]], recipePhotos: [{ recipeId: 'dal-tadka', blob: { type: 'image/png', base64: 'eHl6' } }] } }, error: 'photo is invalid' },
  ] as const
  for (const { file, error } of cases) {
    await upload(page, typeof file === 'string' ? file : JSON.stringify(file))
    await expect(page.getByRole('alert')).toContainText(error)
    await expect(page.getByRole('button', { name: 'Replace with backup' })).toHaveCount(0)
    expect((await getRecords(page, ['recipes'])).recipes).toHaveLength(10)
  }
})

test('rolls back all stores if a later restore write fails', async ({ page }) => {
  await page.goto('./#/settings')
  await expect(page.getByText('No backup exported')).toBeVisible()
  const stores = ['recipes', 'cookbooks', 'cookbookMemberships', 'mealSlots', 'groceryWeeks']
  const data = { ...empty.data, recipes: [starterRecipes[0]], groceryWeeks: [emptyGroceryWeek('2026-11-02')] }
  await putRecords(page, { cookbooks: [{ id: 'current', name: 'Current', nameKey: 'current', createdAt: 1 }], groceryWeeks: [emptyGroceryWeek('2026-10-26')] })
  const before = await getRecords(page, stores)

  await upload(page, { ...empty, data })
  const dialog = page.getByRole('dialog', { name: 'Review backup' })
  await expect(dialog).toBeVisible()
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add
    IDBObjectStore.prototype.add = function (value: unknown, key?: IDBValidKey) {
      const request = add.call(this, value, key)
      // A duplicate queued on the last store fails asynchronously after the clears and earlier writes.
      if (this.name === 'groceryWeeks') {
        IDBObjectStore.prototype.add = add
        add.call(this, value, key)
      }
      return request
    }
  })
  await dialog.getByRole('button', { name: 'Replace with backup' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Your existing data is safe')
  expect(await getRecords(page, stores)).toEqual(before)
  await dialog.getByRole('button', { name: 'Replace with backup' }).click()
  await expect(page.getByText('Backup restored')).toBeVisible()
  expect((await getRecords(page, ['recipes'])).recipes).toHaveLength(1)
})
