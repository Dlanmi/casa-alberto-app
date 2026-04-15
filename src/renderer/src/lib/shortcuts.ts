type ShortcutCombo = {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
}

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.platform.toUpperCase().includes('MAC')
}

export function getPrimaryShortcutCombo(key: string): ShortcutCombo {
  return isMacPlatform() ? { key, meta: true } : { key, ctrl: true }
}

export function formatShortcut(combo: ShortcutCombo): string {
  const parts: string[] = []

  if (combo.ctrl) parts.push('Ctrl')
  if (combo.alt) parts.push('Alt')
  if (combo.shift) parts.push('Shift')
  if (combo.meta) parts.push('⌘')

  const normalizedKey = combo.key.length === 1 ? combo.key.toUpperCase() : combo.key
  return combo.meta ? `${parts.join('')}${normalizedKey}` : [...parts, normalizedKey].join('+')
}

export function formatPrimaryShortcut(key: string): string {
  return formatShortcut(getPrimaryShortcutCombo(key))
}
