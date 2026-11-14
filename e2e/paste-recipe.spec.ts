import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function readRecipe(page: Page, source: string) {
  await page.getByRole('button', { name: /^Paste recipe text/ }).click()
  await page.getByRole('textbox', { name: 'Pasted recipe' }).fill(source)
  await page.getByRole('button', { name: 'Read recipe', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review recipe', exact: true })).toBeVisible()
}

test('reviews a headed recipe and saves only after Save recipe is selected', async ({ page, context }) => {
  const source = [
    'Cumin Rice (serves 3)', 'Prep 5 min, cook 20 min', 'Ingredients:',
    '- 1 1/2 cups rice', '• ½ tsp cumin seeds', 'salt to taste',
    'Method', '1. Rinse the rice.', '2) Cook it with cumin.',
  ].join('\n')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#/recipes/new')
  await page.getByLabel('Recipe title').fill('A separate manual draft')
  await page.getByRole('button', { name: /^Paste recipe text/ }).click()
  await page.getByRole('button', { name: /^Manual entry/ }).click()
  await expect(page.getByLabel('Recipe title')).toHaveValue('A separate manual draft')
  await readRecipe(page, source)

  await expect(page.getByRole('heading', { name: 'We found 3 ingredients and 2 steps' })).toBeVisible()
  await expect(page.getByLabel('Servings', { exact: true })).toHaveValue('3')
  await expect(page.getByLabel('Prep time')).toHaveValue('5')
  await expect(page.getByLabel('Cook time')).toHaveValue('20')
  const rows = page.getByRole('group', { name: /^Ingredient \d+$/ })
  await expect(rows.nth(0).getByLabel('Amount')).toHaveValue('1 1/2')
  await expect(rows.nth(1).getByLabel('Amount')).toHaveValue('½')
  await expect(rows.nth(2).getByLabel('Amount')).toHaveValue('')
  await expect(rows.nth(2).getByLabel('Original text')).toHaveValue('salt to taste')
  await expect(page.getByLabel('Step 2', { exact: true })).toHaveValue('Cook it with cumin.')
  expect(await page.locator('body').evaluate((body) => body.scrollWidth)).toBe(390)

  await page.getByLabel('Recipe title').fill('Cumin Rice for Dinner')
  await page.getByLabel('Recipe title').press('Enter')
  await page.getByRole('button', { name: 'Back to pasted text' }).click()
  await expect(page.getByRole('textbox', { name: 'Pasted recipe' })).toHaveValue(source)
  await page.getByRole('textbox', { name: 'Pasted recipe' }).fill(`${source}\n3. Serve warm.`)
  await page.getByRole('button', { name: 'Read recipe', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Replace the current review?' })).toBeVisible()
  await page.getByRole('button', { name: 'Keep current review' }).click()
  await page.getByRole('button', { name: 'Return to review' }).click()
  await expect(page.getByLabel('Recipe title')).toHaveValue('Cumin Rice for Dinner')

  const box = await context.newPage()
  await box.goto('./#/recipes')
  await expect(box.getByRole('list', { name: 'Recipes' }).getByRole('listitem')).toHaveCount(10)
  await page.getByRole('button', { name: 'Save recipe' }).first().click()
  await expect(page.getByRole('heading', { name: 'Cumin Rice for Dinner', exact: true })).toBeVisible()
  await box.reload()
  await expect(box.getByRole('link', { name: 'Cumin Rice for Dinner', exact: true })).toBeVisible()
  await page.getByLabel('Recipe actions').click()
  await page.getByRole('link', { name: 'Edit recipe' }).click()
  await expect(rows.nth(0).getByLabel('Amount')).toHaveValue('1.5')
  await expect(rows.nth(1).getByLabel('Amount')).toHaveValue('0.5')
  await expect(rows.nth(2).getByLabel('Note (optional)')).toHaveValue('salt to taste')
})

test('keeps unclear lines editable and treats pasted HTML as literal text', async ({ page }) => {
  const markup = '<img src="missing-paste-image" onerror="document.body.dataset.pasteExecuted=1">'
  await page.goto('./#/recipes/new')
  await readRecipe(page, [
    'Recipe: Simple dal', 'Prep 5 min, cook 20 min', 'Notes from my kitchen', markup,
    'Ingredients', '2–3 onions', 'a handful of dhaniya', 'Directions', '1. Simmer.',
  ].join('\n'))

  await expect(page.getByRole('heading', { name: 'Unclear lines' })).toBeVisible()
  const line = page.getByRole('group', { name: 'Unclear line 1' })
  await expect(line.getByRole('textbox')).toHaveValue('Notes from my kitchen')
  await expect(page.getByRole('group', { name: 'Unclear line 2' }).getByRole('textbox')).toHaveValue(markup)
  await expect(page.locator('img[src="missing-paste-image"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveAttribute('data-paste-executed')
  const range = page.getByRole('group', { name: 'Ingredient 1' })
  await expect(range.getByLabel('Amount')).toHaveValue('')
  await expect(range.getByLabel('Original text')).toHaveValue('2–3 onions')

  await page.getByRole('button', { name: 'Save recipe' }).first().click()
  await expect(page.getByRole('alert')).toContainText('Assign or remove the unclear lines before saving.')
  await line.getByRole('textbox').fill('1 tsp cumin seeds')
  await expect(line.getByText('Original text: Notes from my kitchen')).toBeVisible()
  await line.getByRole('button', { name: 'Use as ingredient' }).click()
  const assigned = page.getByRole('group', { name: 'Ingredient 3' })
  await expect(assigned.getByLabel('Ingredient', { exact: true })).toHaveValue('cumin seeds')
  await expect(assigned.getByLabel('Original text')).toHaveValue('Notes from my kitchen')
  await line.getByRole('button', { name: 'Use as step' }).click()
  await expect(page.getByLabel('Step 2', { exact: true })).toHaveValue(markup)
  await expect(page.locator('img[src="missing-paste-image"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save recipe' }).first().click()
  await expect(page.getByRole('heading', { name: 'Simple dal', exact: true })).toBeVisible()
  await expect(page.locator('img[src="missing-paste-image"]')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Method' })).toContainText(markup)
  await page.getByLabel('Recipe actions').click()
  await page.getByRole('link', { name: 'Edit recipe' }).click()
  await expect(page.getByLabel('Step 2', { exact: true })).toHaveValue(markup)
})
