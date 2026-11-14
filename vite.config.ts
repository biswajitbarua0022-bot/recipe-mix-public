import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

function offlineShell(): Plugin {
  return {
    name: 'recipe-mix-offline-shell',
    apply: 'build',
    writeBundle: {
      order: 'post',
      handler(output, bundle) {
        const directory = output.dir ?? 'dist'
        const files = [...new Set([
          ...Object.keys(bundle),
          ...readdirSync('public', { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => resolve(entry.parentPath, entry.name).slice(resolve('public').length + 1).replaceAll('\\', '/')),
        ])].sort()
        const source = readFileSync('src/pwa/service-worker.js', 'utf8')
        const hash = createHash('sha256').update(source)
        for (const file of files) hash.update(file).update(readFileSync(resolve(directory, file)))
        const version = hash.digest('hex').slice(0, 16)
        const worker = `const BUILD_VERSION = ${JSON.stringify(version)}\nconst APP_FILES = ${JSON.stringify(files)}\n${source}`
        writeFileSync(resolve(directory, 'sw.js'), worker)
      },
    },
  }
}

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/recipe-mix-public/' : '/',
  plugins: [react(), offlineShell()],
  build: { license: { fileName: 'third-party-licenses.txt' } },
  test: { include: ['src/**/*.test.ts'] },
}))
