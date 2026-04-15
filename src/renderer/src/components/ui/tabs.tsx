import { useMemo, useRef } from 'react'
import { cn } from '@renderer/lib/cn'

type Tab = {
  key: string
  label: string
  count?: number
}

type TabsProps = {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
  className?: string
  ariaLabel?: string
  idBase?: string
}

function getPanelId(idBase: string, key: string): string {
  return `${idBase}-panel-${key}`
}

function getTabId(idBase: string, key: string): string {
  return `${idBase}-tab-${key}`
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
  ariaLabel = 'Pestañas',
  idBase = 'tabs'
}: TabsProps): React.JSX.Element {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = useMemo(
    () =>
      Math.max(
        0,
        tabs.findIndex((tab) => tab.key === active)
      ),
    [active, tabs]
  )

  function focusTab(index: number): void {
    refs.current[index]?.focus()
  }

  function moveTo(index: number): void {
    const tab = tabs[index]
    if (!tab) return
    onChange(tab.key)
    focusTab(index)
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ): void {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        moveTo((currentIndex + 1) % tabs.length)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        moveTo((currentIndex - 1 + tabs.length) % tabs.length)
        break
      case 'Home':
        event.preventDefault()
        moveTo(0)
        break
      case 'End':
        event.preventDefault()
        moveTo(tabs.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div
      className={cn(
        'flex gap-1 border-b border-border overflow-x-auto scrollbar-hidden',
        className
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.key}
          ref={(node) => {
            refs.current[index] = node
          }}
          role="tab"
          id={getTabId(idBase, tab.key)}
          aria-selected={active === tab.key}
          aria-controls={getPanelId(idBase, tab.key)}
          tabIndex={activeIndex === index ? 0 : -1}
          onClick={() => onChange(tab.key)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer -mb-px rounded-t-[var(--radius-sm)]',
            active === tab.key
              ? 'text-accent-strong border-b-2 border-accent bg-surface'
              : 'text-text-soft hover:text-text-muted'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'ml-1.5 text-xs rounded-full px-1.5 py-0.5',
                active === tab.key
                  ? 'bg-accent/10 text-accent-strong'
                  : 'bg-surface-muted text-text-soft'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
