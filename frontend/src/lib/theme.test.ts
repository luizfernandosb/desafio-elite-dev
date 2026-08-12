import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, getStoredTheme, setTheme } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('applyTheme aplica data-theme no <html>', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('applyTheme("system") remove o atributo -- cai no @media (prefers-color-scheme)', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    applyTheme('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('getStoredTheme retorna "system" quando nada foi salvo', () => {
    expect(getStoredTheme()).toBe('system')
  })

  it('setTheme persiste e aplica na mesma chamada', () => {
    setTheme('dark')
    expect(getStoredTheme()).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('setTheme("system") remove a persistência anterior', () => {
    setTheme('light')
    setTheme('system')
    expect(getStoredTheme()).toBe('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})
