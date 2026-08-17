/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

const FORBIDDEN_WRITE_PATTERN = /supabase.*\.(insert|update|upsert|delete)/

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      collectSourceFiles(fullPath, files)
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath)
    }
  }
  return files
}

describe('contrato: cliente Supabase nunca escreve (§4.4.2, § etapa 07)', () => {
  it('nenhum arquivo de src/ chama um método de escrita a partir de "supabase"', () => {
    const offenders: string[] = []

    for (const file of collectSourceFiles(SRC_DIR)) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (FORBIDDEN_WRITE_PATTERN.test(line)) {
          offenders.push(`${file}:${index + 1}: ${line.trim()}`)
        }
      })
    }

    expect(offenders).toEqual([])
  })
})
