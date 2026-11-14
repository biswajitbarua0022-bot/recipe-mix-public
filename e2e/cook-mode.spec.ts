import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test('scales 2 → 4 → 2 and uses the same serving choice throughout Cook Mode', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'wakeLock', { value: undefined }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#/recipes/poha')

  const ingredients = page.getByRole('region', { name: 'Ingredients', exact: true })
  const mustard = ingredients.getByRole('listitem').filter({ hasText: 'Mustard seeds' })
  const turmeric = ingredients.getByRole('listitem').filter({ hasText: 'Turmeric' })
  const salt = ingredients.getByRole('listitem').filter({ hasText: 'Salt to taste' })
  const more = page.getByRole('button', { name: 'More servings' })
  const fewer = page.getByRole('button', { name: 'Fewer servings' })

  await expect(mustard.getByText('½ tsp', { exact: true })).toBeVisible()
  await expect(turmeric.getByText('¼ tsp', { exact: true })).toBeVisible()
  await more.click()
  await more.click()
  await expect(mustard.getByText('1 tsp', { exact: true })).toBeVisible()
  await expect(turmeric.getByText('½ tsp', { exact: true })).toBeVisible()
  await expect(salt.getByText('Salt to taste', { exact: true })).toBeVisible()
  await fewer.click()
  await fewer.click()
  await expect(mustard.getByText('½ tsp', { exact: true })).toBeVisible()
  await expect(turmeric.getByText('¼ tsp', { exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Adjust servings' })).toContainText('2 servings')

  await more.click()
  await more.click()
  await page.getByRole('link', { name: 'Start cooking' }).click()
  await expect(page.getByRole('status')).toHaveText('Screen may dim')
  await expect(page.getByText('Step 1 of 3', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled()
  const instruction = page.getByLabel('Current instruction')
  await expect(instruction).toContainText('Rinse the poha in a colander')
  await expect(instruction).not.toContainText('Toast the peanuts')

  await page.getByRole('button', { name: 'Ingredients · 4 servings', exact: true }).click()
  const peek = page.getByRole('region', { name: 'Ingredients · 4 servings', exact: true })
  await expect(peek.getByRole('listitem').filter({ hasText: 'Mustard seeds' }).getByText('1 tsp', { exact: true })).toBeVisible()
  await expect(peek.getByText('Salt to taste', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(peek).toBeHidden()
  await expect(page.getByRole('button', { name: 'Ingredients · 4 servings', exact: true })).toBeFocused()

  await page.getByRole('button', { name: 'Next step' }).click()
  await expect(page.getByText('Step 2 of 3', { exact: true })).toBeVisible()
  await expect(instruction).toContainText('Toast the peanuts')
  await page.getByRole('button', { name: 'Previous' }).click()
  await expect(page.getByText('Step 1 of 3', { exact: true })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('Step 3 of 3', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Finish cooking' }).click()
  await expect(page.getByRole('heading', { name: 'Poha is ready' })).toBeFocused()
  await page.getByRole('button', { name: 'Cook again from step 1' }).click()
  await expect(page.getByText('Step 1 of 3', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Exit' }).click()
  await expect(page.getByRole('group', { name: 'Adjust servings' })).toContainText('4 servings')

  await page.goto('./#/recipes/poha?servings=-3')
  await expect(page.getByRole('group', { name: 'Adjust servings' })).toContainText('2 servings')
  await expect(mustard.getByText('½ tsp', { exact: true })).toBeVisible()
})

async function setVisibility(page: Page, state: DocumentVisibilityState) {
  await page.evaluate((visibility) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: visibility })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}

test('recovers a screen wake lock on visibility return and releases it on exit and finish', async ({ page }) => {
  await page.addInitScript(() => {
    let requests = 0
    let releases = 0
    let lock: TestWakeLock | undefined

    class TestWakeLock extends EventTarget {
      released = false

      releaseFromSystem() {
        this.released = true
        this.dispatchEvent(new Event('release'))
      }

      async release() {
        if (this.released) return
        document.documentElement.dataset.lockReleases = String(++releases)
        this.releaseFromSystem()
      }
    }

    Object.defineProperty(navigator, 'wakeLock', { value: {
      request: async () => {
        document.documentElement.dataset.lockRequests = String(++requests)
        if (requests === 1) throw new DOMException('Test permission denial', 'NotAllowedError')
        lock = new TestWakeLock()
        return lock
      },
    } })
    document.addEventListener('test-system-release', () => lock?.releaseFromSystem())
  })

  await page.goto('./#/recipes/dal-tadka/cook')
  await expect(page.locator('html')).toHaveAttribute('data-lock-requests', '1')
  await expect(page.getByRole('status')).toHaveText('Screen may dim')
  await setVisibility(page, 'hidden')
  await setVisibility(page, 'visible')
  await expect(page.getByRole('status')).toHaveText('Screen stays on')

  await page.evaluate(() => document.dispatchEvent(new Event('test-system-release')))
  await expect(page.getByRole('status')).toHaveText('Screen may dim')
  await setVisibility(page, 'hidden')
  await setVisibility(page, 'visible')
  await expect(page.getByRole('status')).toHaveText('Screen stays on')
  await expect(page.locator('html')).toHaveAttribute('data-lock-requests', '3')
  await page.getByRole('link', { name: 'Exit' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-lock-releases', '1')
  await setVisibility(page, 'hidden')
  await setVisibility(page, 'visible')
  await expect(page.locator('html')).toHaveAttribute('data-lock-requests', '3')

  await page.getByRole('link', { name: 'Start cooking' }).click()
  await expect(page.getByRole('status')).toHaveText('Screen stays on')
  await page.getByRole('button', { name: 'Next step' }).click()
  await page.getByRole('button', { name: 'Next step' }).click()
  await page.getByRole('button', { name: 'Finish cooking' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-lock-releases', '2')
  await expect(page.getByRole('status')).toHaveText('Screen may dim')
})

test('keeps cooking controls reachable below a long multiline step at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 630 })
  await page.goto('./#/recipes/new')
  await page.getByLabel('Recipe title').fill('Long method')
  await page.getByLabel('Prep time').fill('0')
  await page.getByLabel('Cook time').fill('5')
  await page.getByLabel('Ingredient', { exact: true }).fill('Water')
  const text = ['First line.', ...Array.from({ length: 25 }, (_, index) => `Stir slowly and check the pan after pass ${index + 1}.`), 'Final line.'].join('\n')
  await page.getByLabel('Step 1', { exact: true }).fill(text)
  await page.getByRole('button', { name: 'Save recipe' }).first().click()
  await page.getByRole('link', { name: 'Start cooking' }).click()
  const instruction = page.getByLabel('Current instruction')
  expect(await instruction.locator('p').textContent()).toBe(text)
  expect(await instruction.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  expect(await page.locator('body').evaluate((body) => body.scrollWidth)).toBe(320)
  await expect(page.getByRole('button', { name: 'Finish cooking' })).toBeInViewport()
  await instruction.focus()
  await page.keyboard.press('PageDown')
  await expect.poll(() => instruction.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Finish cooking' }).click()
  await expect(page.getByRole('heading', { name: 'Long method is ready' })).toBeVisible()
})
