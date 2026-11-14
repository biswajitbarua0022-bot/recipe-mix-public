import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function fillRecipe(page: Page, title: string) {
  await page.getByLabel(/^Recipe title/).fill(title)
  await page.getByLabel('Servings', { exact: true }).fill('2')
  await page.getByLabel('Prep time').fill('7')
  await page.getByLabel('Cook time').fill('11')
  await page.getByLabel('Cuisine', { exact: true }).selectOption('South Indian')
  await page.getByRole('radio', { name: 'Lunch' }).check()
  await page.getByRole('radio', { name: 'Non-veg' }).check()
  const row = page.getByRole('group', { name: 'Ingredient 1' })
  await row.getByLabel('Ingredient', { exact: true }).fill('Eggs')
  await row.getByLabel('Amount').fill('1½')
  await row.getByLabel('Unit').selectOption('piece')
  await row.getByLabel('Aisle').selectOption('Dairy & eggs')
  await row.getByLabel('Note (optional)').fill('Beaten until frothy')
  await page.getByLabel('Step 1', { exact: true }).fill('Cook the eggs over low heat.')
}

async function chooseLargePhoto(page: Page) {
  const photo = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1600
    canvas.height = 800
    const context = canvas.getContext('2d')!
    context.fillStyle = '#b44020'
    context.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.locator('input[type=file]').setInputFiles({ name: 'test-recipe.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') })
  await expect(page.getByRole('button', { name: 'Replace photo' })).toBeVisible()
}

test('saves a manual recipe and resized photo, then edits a separate duplicate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#/recipes')
  await page.getByRole('link', { name: 'Add recipe' }).click()
  await page.getByRole('button', { name: 'Save recipe' }).first().click()
  await expect(page.getByText('Enter a recipe title.')).toBeVisible()
  await fillRecipe(page, 'Pepper Eggs')
  await page.getByRole('button', { name: 'Add step' }).click()
  await page.getByLabel('Step 2', { exact: true }).fill('Warm the pan.')
  await page.getByRole('button', { name: 'Move step 2 up' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid') })
  await expect(page.getByText(/Choose a JPG, PNG or WebP image/)).toBeVisible()
  await chooseLargePhoto(page)
  expect(await page.locator('body').evaluate((body) => body.scrollWidth)).toBe(390)
  await page.getByRole('button', { name: 'Save recipe' }).first().click()
  await expect(page.getByRole('heading', { name: 'Pepper Eggs' })).toBeVisible()
  const originalUrl = page.url()
  await page.getByRole('button', { name: 'Favourite', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Favourite', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Favourite', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('18 min total', { exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Adjust servings' })).toContainText('2 servings')
  await expect.poll(() => page.locator('.recipe-photo').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1200)

  await page.getByLabel('Recipe actions').click()
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.getByRole('heading', { name: 'Pepper Eggs (copy)' })).toBeVisible()
  expect(page.url()).not.toBe(originalUrl)
  await expect(page.getByRole('button', { name: 'Favourite', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => page.locator('.recipe-photo').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1200)
  await page.getByLabel('Recipe actions').click()
  await page.getByRole('link', { name: 'Edit recipe' }).click()
  await expect(page.getByLabel('Amount')).toHaveValue('1.5')
  await expect(page.getByLabel('Note (optional)')).toHaveValue('Beaten until frothy')
  await expect(page.getByLabel('Step 1', { exact: true })).toHaveValue('Warm the pan.')
  await expect(page.getByLabel('Step 2', { exact: true })).toHaveValue('Cook the eggs over low heat.')
  await page.getByLabel('Recipe title').fill('Pepper Eggs for Four')
  await page.getByLabel('Servings', { exact: true }).fill('4')
  await page.getByLabel('Amount').fill('3')
  await page.getByRole('button', { name: 'Remove photo' }).click()
  await page.getByRole('button', { name: 'Save recipe' }).first().click()
  await expect(page.getByRole('heading', { name: 'Pepper Eggs for Four' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('18 min total', { exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Adjust servings' })).toContainText('4 servings')
  await expect(page.locator('.recipe-photo')).toHaveCount(0)

  await page.goto(originalUrl)
  await expect(page.getByRole('heading', { name: 'Pepper Eggs', exact: true })).toBeVisible()
  await expect(page.getByText('18 min total', { exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Adjust servings' })).toContainText('2 servings')
  await expect(page.locator('.recipe-photo')).toHaveCount(1)
  await page.getByLabel('Recipe actions').click()
  await page.getByRole('link', { name: 'Edit recipe' }).click()
  await expect(page.getByLabel('Amount')).toHaveValue('1.5')
  await page.getByLabel('Recipe title').fill('Unsaved edit')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(page.getByRole('heading', { name: 'Pepper Eggs', exact: true })).toBeVisible()
})

test('seeds once and preserves an empty Recipe Box after reload', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('./#/recipes')
  await expect(page.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveCount(10)
  for (const title of ['Dal Tadka', 'Poha', 'Upma', 'Jeera Rice', 'Aloo Gobi', 'Chana Masala', 'Palak Paneer', 'Lemon Rice', 'Egg Bhurji', 'Chicken Curry']) {
    await page.getByRole('link', { name: title, exact: true }).click()
    await page.getByLabel('Recipe actions').click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: `Delete ${title}?` })
    await dialog.getByRole('button', { name: 'Delete recipe' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Your Recipe Box is empty' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your Recipe Box is empty' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add your first recipe' })).toBeVisible()
})

test('retains the draft and rolls back a recipe if the photo write fails', async ({ page }) => {
  await page.goto('./#/recipes/new')
  await fillRecipe(page, 'Retry Eggs')
  await chooseLargePhoto(page)
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add
    IDBObjectStore.prototype.add = function (value: unknown, key?: IDBValidKey) {
      if (this.name === 'recipePhotos') {
        IDBObjectStore.prototype.add = add
        throw new DOMException('Test quota error', 'QuotaExceededError')
      }
      return add.call(this, value, key)
    }
  })
  await page.getByRole('button', { name: 'Save recipe' }).first().click()
  await expect(page.getByRole('alert')).toContainText('out of storage space')
  await expect(page.getByLabel('Recipe title')).toHaveValue('Retry Eggs')
  await expect(page.getByRole('button', { name: 'Replace photo' })).toBeVisible()
  await page.getByRole('button', { name: 'Save recipe' }).first().click()
  await expect(page.getByRole('heading', { name: 'Retry Eggs' })).toBeVisible()
  await page.getByRole('link', { name: 'Recipe Box' }).first().click()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Retry Eggs', exact: true })).toHaveCount(1)
})

test('offers a retry when the database cannot open', async ({ page }) => {
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open
    IDBFactory.prototype.open = function () {
      IDBFactory.prototype.open = open
      throw new DOMException('Test storage denial', 'SecurityError')
    }
  })
  await page.goto('./#/recipes')
  await expect(page.getByRole('alert')).toContainText('Could not open your Recipe Box')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveCount(10)
})
