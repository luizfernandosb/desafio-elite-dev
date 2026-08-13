/// <reference types="node" />
// Único arquivo do front que precisa dos tipos de Node (`node:fs`) -- tsconfig.app.json
// (types: ["vite/client"]) não os inclui de propósito, pro resto do bundle nunca
// enxergar globais de Node que não existem no navegador. Este teste roda em Vitest
// (processo Node de verdade) e varre `src/` como texto -- não é código de produção.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Teste de contrato (§ etapa 07): o cliente Supabase é só LEITURA em todo o front --
// nenhuma escrita (`insert`/`update`/`upsert`/`delete`) em lugar nenhum de `src/`.
// Toda escrita de estado de assento passa pela API (POST/DELETE .../holds); usar o
// cliente Supabase disponível no bundle "por conveniência" para escrever é a
// tentação que este teste existe para nunca deixar passar despercebida. Espelha,
// como teste de verdade (não só um grep manual), o critério de aceite da etapa:
// `grep -rn "supabase.*\.\(insert\|update\|upsert\|delete\)" src/` tem que ficar vazio.
const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

// mesma semântica do grep do plano -- por LINHA (`.` não cruza quebra de linha em
// grep nem em regex JS sem a flag `s`), então uma menção a "supabase" numa linha e
// um `.update(` de outro objeto qualquer linhas depois nunca gera falso positivo
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
