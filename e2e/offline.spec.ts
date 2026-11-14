import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const mime: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain',
}

test('caches a scoped production app, preserves offline edits and applies an update on request', async ({ page, context }) => {
  test.setTimeout(60_000)
  const prefix = '/recipe-mix-public/'
  const worker = await readFile('dist/sw.js', 'utf8')
  let updated = false
  const server = createServer(async (request, response) => {
    const path = request.url?.split('?')[0] ?? ''
    if (!path.startsWith(prefix) || !/^[\w/.-]+$/.test(path) || path.includes('..')) {
      response.writeHead(404).end()
      return
    }
    const file = path.slice(prefix.length) || 'index.html'
    try {
      const body = file === 'sw.js' && updated
        ? worker.replace(/^const BUILD_VERSION = "([^"]+)"/, 'const BUILD_VERSION = "$1-update"')
        : await readFile(resolve('dist', file))
      response.writeHead(200, { 'content-type': mime[extname(file)], 'cache-control': 'no-store' }).end(body)
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise<void>((done) => { server.listen(0, '127.0.0.1', done) })
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Could not start the app update test server.')
    const base = `http://127.0.0.1:${address.port}${prefix}`

    await page.goto(`${base}#/settings`)
    await expect(page.getByText('Ready to open offline on this device.')).toBeVisible()
    const manifest = await (await page.request.get(`${base}manifest.webmanifest`)).json()
    expect(manifest).toMatchObject({ start_url: '/recipe-mix-public/#/recipes', scope: '/recipe-mix-public/', display: 'standalone' })
    expect(manifest.icons).toContainEqual(expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }))
    for (const { src, sizes } of manifest.icons) {
      const size = await page.evaluate(async (url) => {
        const image = new Image()
        image.src = url
        await image.decode()
        return `${image.naturalWidth}x${image.naturalHeight}`
      }, new URL(src, base).href)
      expect(size).toBe(sizes)
    }
    const originalCaches = await page.evaluate(() => caches.keys())
    expect(originalCaches).toEqual([expect.stringMatching(/^recipe-mix-public-shell:/)])
    expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).toBe(base)

    await context.setOffline(true)
    await expect(page.getByText('Recipe Mix 1.0 · Offline')).toBeVisible()
    await page.goto(`${base}#/recipes/poha/edit`)
    await page.getByLabel('Recipe title').fill('Offline Poha')
    await page.getByRole('button', { name: 'Save recipe' }).first().click()
    await expect(page.getByRole('heading', { name: 'Offline Poha', exact: true })).toBeVisible()
    const recipeUrl = page.url()
    const reopened = await context.newPage()
    await reopened.goto(recipeUrl)
    await expect(reopened.getByRole('heading', { name: 'Offline Poha', exact: true })).toBeVisible()
    await reopened.close()

    await context.setOffline(false)
    await page.goto(`${base}#/settings`)
    updated = true
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update())
    await expect(page.getByText('An app update is ready.')).toBeVisible()
    expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting))).toBe(true)
    await page.getByRole('button', { name: 'Reload to update' }).click()
    await expect(page.getByRole('button', { name: 'Reload to update' })).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([`${originalCaches[0]}-update`])

    await context.setOffline(true)
    await page.goto(recipeUrl)
    await expect(page.getByRole('heading', { name: 'Offline Poha', exact: true })).toBeVisible()
  } finally {
    server.close()
  }
})
