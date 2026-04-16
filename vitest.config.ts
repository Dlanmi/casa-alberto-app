import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Excluir archivos AppleDouble resource forks (._*) que macOS crea y que
    // se filtran a Windows vía tar.gz, OneDrive, USB, etc. Son binarios
    // basura con extensión .test.ts — Vitest los intentaba parsear y
    // reportaba 13 suites falsas como "failed" sin ningún test dentro.
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/._*', '**/.claude/worktrees/**']
  }
})
