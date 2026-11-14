import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import type { Ingredient, Recipe } from '../src/recipes/recipe'
import { getRecords, putRecords } from './idb-fixtures'

const week = '2026-01-05'
const groceryPath = `./#/groceries?date=${week}`
const plannerPath = `./#/planner?date=${week}`

function ingredient(name: string, amount: number | null, unit: Ingredient['unit'], aisle: Ingredient['aisle'], originalText = ''): Ingredient {
  return { name, amount, unit, aisle, originalText }
}

function recipe(id: string, title: string, ingredients: Ingredient[], baseServings: number): Recipe {
  return { id, title, baseServings, prepMinutes: 5, cookMinutes: 10, cuisine: 'North Indian', meal: 'Dinner', diet: 'Veg', favourite: false, createdAt: 1, steps: ['Cook.'], ingredients }
}

async function addItem(page: Page, text: string, aisle: Ingredient['aisle'] = 'Other') {
  await page.getByRole('textbox', { name: 'Add item' }).fill(text)
  await page.getByRole('combobox', { name: 'Aisle' }).selectOption(aisle)
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Add item' })).toHaveValue('')
}

async function checkItem(checkbox: Locator) {
  await checkbox.click()
  await expect(checkbox).toBeChecked()
}

test('persists per-meal totals, shares checks, and reconciles changed and unchanged rows on regeneration', async ({ page }) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: {
    writeText: async (text: string) => { document.body.dataset.copiedList = text },
  } }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(plannerPath)
  await expect(page.getByText('0 of 21 meals planned this week')).toBeVisible()
  await putRecords(page, {
    recipes: [
      recipe('weeknight-onions', 'Weeknight onions', [
        ingredient('Onions', 1, '', 'Vegetables & herbs'), ingredient('Jeera', .5, 'tsp', 'Masalas'), ingredient('Salt', null, '', 'Masalas', 'salt to taste'),
      ], 2),
      recipe('onion-rice', 'Onion rice', [
        ingredient('Onion', 100, 'g', 'Vegetables & herbs'), ingredient('Onion', null, '', 'Vegetables & herbs', '2–3 onions'),
        ingredient('Rice', 1, 'cup', 'Dals, rice & grains'), ingredient('Turmeric', .5, 'tsp', 'Masalas'),
      ], 4),
    ],
    mealSlots: [
      { date: week, meal: 'Dinner', recipeId: 'weeknight-onions', servings: 2 },
      { date: '2026-01-06', meal: 'Dinner', recipeId: 'weeknight-onions', servings: 4 },
      { date: '2026-01-07', meal: 'Lunch', recipeId: 'onion-rice', servings: 4 },
    ],
  })
  await page.reload()
  await page.getByRole('button', { name: 'Generate grocery list' }).click()
  await expect(page.getByRole('heading', { name: 'Groceries', exact: true })).toBeVisible()
  const checkbox = (name: string) => page.getByRole('checkbox', { name, exact: true })
  await expect(checkbox('Onions, 3')).toBeVisible()
  await expect(checkbox('Onion, 100 g')).toBeVisible()
  await expect(page.getByText('2–3 onions', { exact: true })).toBeVisible()
  await expect(page.getByText('salt to taste', { exact: true })).toHaveCount(2)

  await page.getByRole('button', { name: 'By recipe' }).click()
  const mondayMeal = page.getByRole('region', { name: /Weeknight onions, Mon.*dinner.*serves 2/ })
  const tuesdayMeal = page.getByRole('region', { name: /Weeknight onions, Tue.*dinner.*serves 4/ })
  await checkItem(mondayMeal.getByRole('checkbox', { name: 'Onions, 1', exact: true }))
  await expect(tuesdayMeal.getByRole('checkbox', { name: 'Onions, 2', exact: true })).toBeChecked()
  await expect(mondayMeal.getByText('Shared · 3 total', { exact: true })).toBeVisible()
  await page.reload()
  await expect(tuesdayMeal.getByRole('checkbox', { name: 'Onions, 2', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'By aisle' }).click()
  await expect(checkbox('Onions, 3')).toBeChecked()

  await checkItem(checkbox('Turmeric, ½ tsp'))
  await page.getByRole('button', { name: 'Clear checked', exact: true }).click()
  await page.getByRole('dialog', { name: 'Clear 2 checked items?' }).getByRole('button', { name: 'Clear checked', exact: true }).click()
  await expect(checkbox('Onions, 3')).toHaveCount(0)
  await expect(checkbox('Turmeric, ½ tsp')).toHaveCount(0)
  await checkItem(checkbox('Rice, 1 cup'))
  await checkItem(checkbox('Cumin seeds, 1½ tsp'))
  await addItem(page, 'Curd, 500 g', 'Dairy & eggs')
  await checkItem(checkbox('Curd, 500 g'))
  await addItem(page, 'Dishwash liquid, 1 bottle')
  await page.getByRole('textbox', { name: 'Add item' }).fill('onion')
  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('already on this week’s list')

  await page.getByRole('button', { name: 'By recipe' }).click()
  const manual = page.getByRole('region', { name: 'Added by you, Manual items' })
  await expect(manual.getByRole('checkbox', { name: 'Curd, 500 g' })).toBeChecked()
  await expect(manual.getByRole('checkbox', { name: 'Dishwash liquid, 1 bottle' })).not.toBeChecked()
  await page.getByRole('button', { name: 'Copy list' }).click()
  await expect(page.getByRole('status')).toContainText('Remaining items copied')
  const copied = await page.locator('body').getAttribute('data-copied-list')
  expect(copied).toContain('100 g Onion')
  expect(copied).toContain('2–3 onions')
  expect(copied).toContain('1 bottle Dishwash liquid')
  expect(copied).not.toMatch(/Curd|Cumin seeds|Turmeric|1 cup Rice/)
  const share = new URL((await page.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href'))!)
  expect(share.origin).toBe('https://wa.me')
  expect(share.searchParams.get('text')).toBe(copied)
  expect(await page.locator('body').evaluate((body) => body.scrollWidth)).toBe(390)

  await page.goto('./#/planner?date=2026-01-06')
  await page.getByRole('button', { name: /Weeknight onions.*Serves 4/, description: /Tuesday 6 Jan dinner/ }).click()
  const meal = page.getByRole('dialog', { name: 'Weeknight onions', exact: true })
  await meal.getByRole('spinbutton', { name: 'Servings' }).fill('6')
  await meal.getByRole('button', { name: 'Save servings' }).click()
  await expect(page.getByText('Grocery list is out of date', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Open saved list' }).click()
  await expect(checkbox('Cumin seeds, 1½ tsp')).toBeChecked()
  await expect(checkbox('Onions, 4')).toHaveCount(0)
  await page.getByRole('button', { name: 'Refresh from plan' }).click()
  await expect(checkbox('Onions, 4')).toBeVisible()
  await expect(checkbox('Onions, 4')).not.toBeChecked()
  await expect(checkbox('Cumin seeds, 2 tsp')).not.toBeChecked()
  await expect(checkbox('Rice, 1 cup')).toBeChecked()
  await expect(checkbox('Turmeric, ½ tsp')).toHaveCount(0)
  await expect(checkbox('Curd, 500 g')).toBeChecked()
  await expect(checkbox('Dishwash liquid, 1 bottle')).not.toBeChecked()
  await expect(page.getByText('Grocery list is out of date', { exact: true })).toHaveCount(0)

  await page.goto('./#/recipes/weeknight-onions/edit')
  await page.getByLabel('Servings', { exact: true }).fill('4')
  await page.getByRole('button', { name: 'Save recipe' }).first().click()
  await expect(page.getByRole('heading', { name: 'Weeknight onions', exact: true })).toBeVisible()
  await page.goto(groceryPath)
  await expect(page.getByText('Grocery list is out of date', { exact: true })).toBeVisible()
  await expect(checkbox('Onions, 4')).toBeVisible()
  await page.getByRole('button', { name: 'Refresh from plan' }).click()
  await expect(checkbox('Onions, 2')).toHaveCount(1)
  await expect(checkbox('Onion, 100 g')).toHaveCount(1)
  await page.reload()
  await expect(checkbox('Onions, 2')).toHaveCount(1)
  expect((await getRecords(page, ['groceryWeeks'])).groceryWeeks).toHaveLength(1)
})

test('keeps manual-only weeks separate and offers a copy fallback', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: {
    writeText: async () => { throw new DOMException('Clipboard denied', 'NotAllowedError') },
  } }))
  await page.goto(groceryPath)
  await expect(page.getByRole('heading', { name: /^Nothing planned/ })).toBeVisible()
  await addItem(page, 'Bread, 1 loaf')
  await addItem(page, 'Milk, 500 ml', 'Dairy & eggs')
  await checkItem(page.getByRole('checkbox', { name: 'Bread, 1 loaf' }))
  await page.getByRole('button', { name: 'Clear checked', exact: true }).click()
  await page.getByRole('dialog', { name: 'Clear 1 checked item?' }).getByRole('button', { name: 'Clear checked' }).click()
  await expect(page.getByRole('checkbox', { name: 'Bread, 1 loaf' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Next week' }).click()
  await expect(page.getByRole('heading', { name: /^Nothing planned/ })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Milk, 500 ml' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Previous week' }).click()
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Milk, 500 ml' })).toBeVisible()
  await page.getByRole('button', { name: 'Copy list' }).click()
  const copy = page.getByRole('dialog', { name: 'Copy grocery list' })
  await expect(copy.getByRole('textbox', { name: 'Remaining grocery items' })).toHaveValue(/500 ml Milk/)
  await copy.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Remove Milk' }).click()
  await expect(page.getByRole('heading', { name: /^Nothing planned/ })).toBeVisible()
})
